"""
Unit tests for Multi-Speaker Diarization Pipeline (Task 57).
Covers:
- AC1: Deepgram Nova-2 audio chunk diarization (diarize=True, smart_format=True)
       assigning distinct speaker_label values (Speaker 0, Speaker 1, etc.).
- AC2: AsrHandler conversational turn attribution when speaker_label="auto"
       with silence gaps and conversational handoffs/polarity shifts.
- AC3: Preservation of explicit speaker labels (simulated voice notes / calibrated speakers).
"""

import base64
import os
import sys
from unittest.mock import AsyncMock, MagicMock, patch
import pytest

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from envelope_router import AsrHandler, AudioChunkHandler, EnvelopeRouter
from services.diarization import (
    SpeakerDiarizer,
    format_speaker_label,
    is_auto_speaker_label,
)


def _make_mock_session_mgr():
    session_mgr = MagicMock()
    saved_turns = []

    async def _save_turn(meeting_id, speaker_label, transcript_text, timestamp_ms):
        turn_id = f"turn-{len(saved_turns) + 1}"
        saved_turns.append(
            {
                "turn_id": turn_id,
                "meeting_id": meeting_id,
                "speaker_label": speaker_label,
                "transcript_text": transcript_text,
                "timestamp_ms": timestamp_ms,
            }
        )
        return turn_id

    session_mgr.db_save_transcript_turn = AsyncMock(side_effect=_save_turn)
    session_mgr.broadcast_to_meeting = AsyncMock()
    session_mgr.speaker_diarizer = None
    session_mgr._saved_turns = saved_turns
    return session_mgr


@pytest.mark.asyncio
async def test_ac1_deepgram_diarize_utterances_assigns_distinct_speakers():
    """
    AC1: When audio chunks are processed with DEEPGRAM_API_KEY set (or mocked Deepgram client),
    utterances from different speakers are assigned distinct speaker_label values (Speaker 0, Speaker 1, etc.).
    """
    mock_client = MagicMock()
    mock_response = {
        "results": {
            "utterances": [
                {
                    "speaker": 0,
                    "transcript": "How should we handle session caching between the API gateway and database?",
                    "start": 0.5,
                    "end": 4.2,
                    "confidence": 0.98,
                },
                {
                    "speaker": 1,
                    "transcript": "Let's deploy a Redis cluster with TLS and read replicas.",
                    "start": 4.8,
                    "end": 8.1,
                    "confidence": 0.96,
                },
                {
                    "speaker": 2,
                    "transcript": "From the security side, we should also enforce mutual TLS on Redis.",
                    "start": 8.9,
                    "end": 12.4,
                    "confidence": 0.95,
                },
            ]
        }
    }
    mock_client.listen.v1.media.transcribe_file.return_value = mock_response

    diarizer = SpeakerDiarizer(deepgram_client=mock_client)
    fake_pcm = base64.b64encode(b"RIFF\x00\x00\x00\x00WAVEfmt ").decode("ascii")

    utterances = await diarizer.diarize_audio_chunk(fake_pcm, timestamp_ms=10000)

    assert len(utterances) == 3
    assert utterances[0].speaker_label == "Speaker 0 (Wearer)"
    assert utterances[0].speaker_index == 0
    assert "session caching" in utterances[0].transcript_text

    assert utterances[1].speaker_label == "Speaker 1 (Participant)"
    assert utterances[1].speaker_index == 1
    assert "Redis cluster" in utterances[1].transcript_text

    assert utterances[2].speaker_label == "Speaker 2 (Participant)"
    assert utterances[2].speaker_index == 2
    assert "mutual TLS" in utterances[2].transcript_text

    # Verify Deepgram SDK was invoked with nova-2, diarize=True, smart_format=True
    mock_client.listen.v1.media.transcribe_file.assert_called_once()
    call_kwargs = mock_client.listen.v1.media.transcribe_file.call_args.kwargs
    assert call_kwargs["model"] == "nova-2"
    assert call_kwargs["diarize"] is True
    assert call_kwargs["smart_format"] is True


@pytest.mark.asyncio
async def test_ac1_deepgram_word_level_grouping_and_audio_chunk_handler():
    """
    AC1: When Deepgram returns word-level speaker tags (without top-level utterances)
    and AudioChunkHandler processes an audioChunk envelope, each speaker segment is
    persisted and broadcast with its distinct speaker_label.
    """
    mock_client = MagicMock()
    mock_response = {
        "results": {
            "channels": [
                {
                    "alternatives": [
                        {
                            "transcript": "Should we use Postgres? Yes Postgres with pgvector works well.",
                            "words": [
                                {"word": "should", "punctuated_word": "Should", "speaker": 0, "start": 0.1, "end": 0.4},
                                {"word": "we", "punctuated_word": "we", "speaker": 0, "start": 0.4, "end": 0.6},
                                {"word": "use", "punctuated_word": "use", "speaker": 0, "start": 0.6, "end": 0.8},
                                {"word": "postgres", "punctuated_word": "Postgres?", "speaker": 0, "start": 0.8, "end": 1.3},
                                {"word": "yes", "punctuated_word": "Yes,", "speaker": 1, "start": 2.0, "end": 2.3},
                                {"word": "postgres", "punctuated_word": "Postgres", "speaker": 1, "start": 2.3, "end": 2.8},
                                {"word": "works", "punctuated_word": "works.", "speaker": 1, "start": 2.8, "end": 3.2},
                            ],
                        }
                    ]
                }
            ]
        }
    }
    mock_client.listen.v1.media.transcribe_file.return_value = mock_response

    diarizer = SpeakerDiarizer(deepgram_client=mock_client)
    router = EnvelopeRouter(diarizer=diarizer)
    session_mgr = _make_mock_session_mgr()
    mock_ws = AsyncMock()

    audio_b64 = base64.b64encode(b"\x00\x01\x02\x03" * 64).decode("ascii")
    await router.dispatch(
        {
            "eventType": "audioChunk",
            "audio_b64": audio_b64,
            "timestamp_ms": 5000,
        },
        mock_ws,
        session_mgr,
        "meeting-dg-words",
    )

    assert len(session_mgr._saved_turns) == 2
    assert session_mgr._saved_turns[0]["speaker_label"] == "Speaker 0 (Wearer)"
    assert session_mgr._saved_turns[0]["transcript_text"] == "Should we use Postgres?"
    assert session_mgr._saved_turns[1]["speaker_label"] == "Speaker 1 (Participant)"
    assert session_mgr._saved_turns[1]["transcript_text"] == "Yes, Postgres works."
    assert session_mgr.broadcast_to_meeting.call_count == 2


@pytest.mark.asyncio
async def test_ac2_asr_handler_conversational_turn_attribution_across_speakers():
    """
    AC2: When AsrModule text turns arrive with speaker_label="auto" and conversational
    handoffs/gaps, AsrHandler attributes turns across speakers rather than hardcoding
    every turn to Speaker 0 (Wearer).
    """
    diarizer = SpeakerDiarizer()
    handler = AsrHandler(diarizer=diarizer)
    session_mgr = _make_mock_session_mgr()
    mock_ws = AsyncMock()
    meeting_id = "meeting-ac2-conv"

    # Turn 1: Wearer starts the conversation and asks a question
    await handler.handle(
        {
            "eventType": "asrTranscription",
            "speaker_label": "auto",
            "transcript_text": "What database should we put behind the Auth Service?",
            "timestamp_ms": 1000,
            "silenceGapMs": 0,
        },
        mock_ws,
        session_mgr,
        meeting_id,
    )

    # Turn 2: Participant answers after a 3200ms pause (>2500ms threshold)
    await handler.handle(
        {
            "eventType": "asrTranscription",
            "speaker_label": "auto",
            "transcript_text": "I think we should use PostgreSQL for primary storage and Redis for token caching.",
            "timestamp_ms": 4200,
            "silenceGapMs": 3200,
        },
        mock_ws,
        session_mgr,
        meeting_id,
    )

    # Turn 3: Same speaker (Participant) continues quickly after a brief 800ms pause (below 2500ms threshold)
    await handler.handle(
        {
            "eventType": "asrTranscription",
            "speaker_label": "auto",
            "transcript_text": "That gives us sub-millisecond session lookups.",
            "timestamp_ms": 5000,
            "silenceGapMs": 800,
        },
        mock_ws,
        session_mgr,
        meeting_id,
    )

    # Turn 4: Wearer responds after a 3000ms pause with agreement cue
    await handler.handle(
        {
            "eventType": "asrTranscription",
            "speaker_label": "auto",
            "transcript_text": "Agreed, let's add the Redis Cache node to the diagram now.",
            "timestamp_ms": 8000,
            "silenceGapMs": 3000,
        },
        mock_ws,
        session_mgr,
        meeting_id,
    )

    # Turn 5: Third participant chimes in with self-identification after a 3500ms pause
    await handler.handle(
        {
            "eventType": "asrTranscription",
            "speaker_label": "auto",
            "transcript_text": "From the security side, make sure Redis requires HMAC token verification.",
            "timestamp_ms": 11500,
            "silenceGapMs": 3500,
        },
        mock_ws,
        session_mgr,
        meeting_id,
    )

    turns = session_mgr._saved_turns
    assert len(turns) == 5
    assert turns[0]["speaker_label"] == "Speaker 0 (Wearer)"
    assert turns[1]["speaker_label"] == "Speaker 1 (Participant)"
    # Turn 3 had a short pause (800ms < 2500ms), so it stays with Speaker 1
    assert turns[2]["speaker_label"] == "Speaker 1 (Participant)"
    # Turn 4 switched back to Speaker 0 (Wearer)
    assert turns[3]["speaker_label"] == "Speaker 0 (Wearer)"
    # Turn 5 attributed to Speaker 2 (Participant)
    assert turns[4]["speaker_label"] == "Speaker 2 (Participant)"


@pytest.mark.asyncio
async def test_ac2_risk_mitigation_no_false_switch_without_polarity_or_pause():
    """
    Risk mitigation check: Back-to-back declarative sentences by the same speaker
    do not switch speakers when silenceGapMs is below threshold OR when there is
    no conversational polarity shift.
    """
    diarizer = SpeakerDiarizer()
    handler = AsrHandler(diarizer=diarizer)
    session_mgr = _make_mock_session_mgr()
    mock_ws = AsyncMock()
    meeting_id = "meeting-risk-check"

    # Turn 1: Wearer makes a declarative statement (not a question)
    await handler.handle(
        {
            "eventType": "asrTranscription",
            "speaker_label": "auto",
            "transcript_text": "The API Gateway routes incoming traffic to the internal cluster.",
            "timestamp_ms": 1000,
            "silenceGapMs": 0,
        },
        mock_ws,
        session_mgr,
        meeting_id,
    )

    # Turn 2: Wearer pauses 4000ms to draw on whiteboard, then continues with another declarative statement
    await handler.handle(
        {
            "eventType": "asrTranscription",
            "speaker_label": "auto",
            "transcript_text": "The worker queue processes background jobs asynchronously.",
            "timestamp_ms": 5000,
            "silenceGapMs": 4000,
        },
        mock_ws,
        session_mgr,
        meeting_id,
    )

    assert session_mgr._saved_turns[0]["speaker_label"] == "Speaker 0 (Wearer)"
    assert session_mgr._saved_turns[1]["speaker_label"] == "Speaker 0 (Wearer)"


@pytest.mark.asyncio
async def test_ac3_explicit_speaker_labels_preserved_unchanged():
    """
    AC3: Explicit speaker labels (e.g., from simulated voice notes or calibrated speakers)
    are preserved unchanged.
    """
    diarizer = SpeakerDiarizer()
    handler = AsrHandler(diarizer=diarizer)
    session_mgr = _make_mock_session_mgr()
    mock_ws = AsyncMock()
    meeting_id = "meeting-ac3-explicit"

    explicit_cases = [
        ("Speaker 0 (Ruan)", "We need a low-latency WebSocket hub.", 1000),
        ("Speaker 1 (Architect)", "Yes, FastAPI with async workers handles that.", 5000),
        ("Alice (Security Lead)", "Ensure every endpoint validates the bearer token.", 9000),
        ("Speaker 0 (Wearer)", "Adding the auth middleware now.", 12000),
    ]

    for label, text, ts in explicit_cases:
        await handler.handle(
            {
                "eventType": "asrTranscription",
                "speaker_label": label,
                "transcript_text": text,
                "timestamp_ms": ts,
                "silenceGapMs": 4000,
            },
            mock_ws,
            session_mgr,
            meeting_id,
        )

    assert len(session_mgr._saved_turns) == 4
    for idx, (expected_label, expected_text, _) in enumerate(explicit_cases):
        assert session_mgr._saved_turns[idx]["speaker_label"] == expected_label
        assert session_mgr._saved_turns[idx]["transcript_text"] == expected_text
