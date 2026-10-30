"""
Unit tests for RaisingHandAgent Supabase transcript_turns fallback (Task 58 - AC3).
Verifies:
- When memory_store["transcript_turns"] is empty (e.g., after a backend restart),
  RaisingHandAgent._get_recent_context() and evaluate_proactive_async() fall back to
  querying Supabase transcript_turns for the last 60s window.
"""

import os
import sys
from unittest.mock import MagicMock
import pytest

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from agents.raising_hand_agent import (
    MAX_SPOKEN_SUMMARY_CHARS,
    MAX_TTS_AUDIO_BYTES,
    RaisingHandAgent,
    RaisingHandEvaluation,
)


class _MockSupabaseWithTranscripts:
    def __init__(self, rows):
        self.rows = rows
        self.queried_tables = []
        self.queried_meetings = []

    def table(self, name):
        outer = self
        outer.queried_tables.append(name)

        class _Query:
            def select(self, *_a, **_k):
                return self

            def eq(self, col, val):
                if col == "meeting_id":
                    outer.queried_meetings.append(val)
                return self

            def order(self, *_a, **_k):
                return self

            def insert(self, *_a, **_k):
                return self

            def execute(self):
                res = MagicMock()
                res.data = list(outer.rows)
                return res

        return _Query()


@pytest.mark.asyncio
async def test_raising_hand_get_recent_context_falls_back_to_supabase():
    """
    AC3: When in-memory transcript_turns is empty for a meeting, RaisingHandAgent._get_recent_context
    retrieves the last 60s of transcript_turns from Supabase.
    """
    meeting_id = "00000000-0000-4000-8000-000000000585"
    supabase_turns = [
        {
            "id": "db-t1",
            "meeting_id": meeting_id,
            "speaker_label": "Speaker 0 (Wearer)",
            "transcript_text": "Early turn outside the 60s window.",
            "timestamp_ms": 5000,
        },
        {
            "id": "db-t2",
            "meeting_id": meeting_id,
            "speaker_label": "Speaker 1 (Architect)",
            "transcript_text": "Let us add a Redis cache layer in front of the primary database.",
            "timestamp_ms": 45000,
        },
        {
            "id": "db-t3",
            "meeting_id": meeting_id,
            "speaker_label": "Speaker 0 (Wearer)",
            "transcript_text": "We also need an authentication token service on ingress.",
            "timestamp_ms": 75000,
        },
    ]

    mock_sb = _MockSupabaseWithTranscripts(supabase_turns)
    # Empty in-memory transcript_turns simulating a backend restart
    empty_memory_store = {
        "transcript_turns": {},
        "agent_interventions": {meeting_id: []},
    }

    agent = RaisingHandAgent(
        api_key="",
        supabase_client=mock_sb,
        memory_store=empty_memory_store,
    )

    # 1. Verify _get_recent_context works both when awaited and called synchronously
    turns_awaited = await agent._get_recent_context(meeting_id, timestamp_ms=80000, window_ms=60000)
    assert len(turns_awaited) == 2
    assert [t["id"] for t in turns_awaited] == ["db-t2", "db-t3"]
    assert "transcript_turns" in mock_sb.queried_tables
    assert meeting_id in mock_sb.queried_meetings

    turns_sync = agent._get_recent_context(meeting_id, timestamp_ms=80000, window_ms=60000)
    assert [t["id"] for t in turns_sync] == ["db-t2", "db-t3"]

    # 2. Verify evaluate_proactive_async uses the Supabase fallback turns to detect architectural risks
    evaluation = await agent.evaluate_proactive_async(
        meeting_id=meeting_id,
        timestamp_ms=80000,
        drawio_xml="<mxfile/>",
    )
    assert evaluation.trigger is True
    assert evaluation.category == "VULNERABILITY"
    assert "Stampede" in evaluation.short_title


@pytest.mark.asyncio
async def test_raising_hand_prefers_memory_store_when_populated():
    """
    AC3: When memory_store["transcript_turns"] is already populated, RaisingHandAgent uses
    in-memory turns without querying Supabase.
    """
    meeting_id = "00000000-0000-4000-8000-000000000586"
    mock_sb = _MockSupabaseWithTranscripts([])
    memory_store = {
        "transcript_turns": {
            meeting_id: [
                {
                    "id": "mem-t1",
                    "meeting_id": meeting_id,
                    "speaker_label": "Speaker 0",
                    "transcript_text": "In-memory turn about PostgreSQL single database.",
                    "timestamp_ms": 50000,
                }
            ]
        },
        "agent_interventions": {meeting_id: []},
    }

    agent = RaisingHandAgent(
        api_key="",
        supabase_client=mock_sb,
        memory_store=memory_store,
    )

    turns = await agent._get_recent_context(meeting_id, timestamp_ms=60000, window_ms=60000)
    assert len(turns) == 1
    assert turns[0]["id"] == "mem-t1"
    assert mock_sb.queried_tables == []


@pytest.mark.asyncio
async def test_task60_persist_and_broadcast_attaches_spoken_summary_and_deepgram_tts_audio():
    """
    Task 60 (AC2): RaisingHandAgent synthesizes a concise spoken_summary and attaches
    base64-encoded TTS audio (via Deepgram Aura TTS when available) to HAND_RAISED payloads.
    """
    import base64

    meeting_id = "00000000-0000-4000-8000-000000000601"
    fake_wav_bytes = b"RIFF$\x00\x00\x00WAVEfmt \x10\x00\x00\x00\x01\x00\x01\x00@\x1f\x00\x00@\x1f\x00\x00\x01\x00\x08\x00data\x00\x00\x00\x00"

    mock_dg_client = MagicMock()
    mock_dg_client.speak.v1.audio.generate.return_value = iter([fake_wav_bytes[:16], fake_wav_bytes[16:]])

    memory_store = {
        "transcript_turns": {},
        "agent_interventions": {meeting_id: []},
    }
    agent = RaisingHandAgent(
        api_key="",
        memory_store=memory_store,
        deepgram_client=mock_dg_client,
    )

    evaluation = RaisingHandEvaluation(
        trigger=True,
        category="VULNERABILITY",
        short_title="🚩 Cache Stampede Risk",
        detailed_body=(
            "• High-concurrency cache misses on Redis will overload PostgreSQL.\n"
            "• Add mutex lock / request coalescing on cache miss."
        ),
    )

    broadcast_payloads = []

    async def _capture_broadcast(mid, payload):
        broadcast_payloads.append((mid, payload))

    record = await agent.persist_and_broadcast(
        meeting_id=meeting_id,
        evaluation=evaluation,
        timestamp_ms=90000,
        was_pinched=True,
        broadcast_fn=_capture_broadcast,
    )

    expected_b64 = base64.b64encode(fake_wav_bytes).decode("ascii")
    assert record["audio_b64"] == expected_b64
    assert "Cache Stampede Risk" in record["spoken_summary"]
    assert len(record["spoken_summary"]) <= MAX_SPOKEN_SUMMARY_CHARS

    assert len(broadcast_payloads) == 1
    mid, payload = broadcast_payloads[0]
    assert mid == meeting_id
    assert payload["event"] == "HAND_RAISED"
    assert payload["spoken_summary"] == record["spoken_summary"]
    assert payload["audio_b64"] == expected_b64

    mock_dg_client.speak.v1.audio.generate.assert_called_once()
    call_kwargs = mock_dg_client.speak.v1.audio.generate.call_args.kwargs
    assert call_kwargs["model"] == "aura-asteria-en"
    assert "Cache Stampede Risk" in call_kwargs["text"]


@pytest.mark.asyncio
async def test_task60_tts_synthesis_caps_audio_at_64kb_and_falls_back_cleanly_on_error():
    """
    Task 60: TTS helper caps raw audio at 64KB to protect Spectacles WebSocket JSON parsing,
    and returns None cleanly (falling back to notification chime) when Deepgram is unconfigured or errors.
    """
    import base64

    meeting_id = "00000000-0000-4000-8000-000000000602"

    # 1. Oversized stream (> 64KB) is capped at MAX_TTS_AUDIO_BYTES (64KB)
    oversized_chunk = b"A" * (MAX_TTS_AUDIO_BYTES + 8192)
    mock_dg_large = MagicMock()
    mock_dg_large.speak.v1.audio.generate.return_value = [oversized_chunk]

    agent_large = RaisingHandAgent(api_key="", deepgram_client=mock_dg_large)
    b64_capped = await agent_large.synthesize_critique_tts_async("Short architectural warning.")
    assert b64_capped is not None
    decoded_bytes = base64.b64decode(b64_capped)
    assert len(decoded_bytes) == MAX_TTS_AUDIO_BYTES

    # 2. When Deepgram raises an error, persist_and_broadcast still succeeds with audio_b64=None
    mock_dg_err = MagicMock()
    mock_dg_err.speak.v1.audio.generate.side_effect = RuntimeError("Deepgram network timeout")

    agent_err = RaisingHandAgent(
        api_key="",
        memory_store={"agent_interventions": {meeting_id: []}},
        deepgram_client=mock_dg_err,
    )
    eval_obj = RaisingHandEvaluation(
        trigger=True,
        category="LOGIC_FLAW",
        short_title="⚡ Single Point of Failure",
        detailed_body="• Single database lacks failover.",
    )
    broadcasted = []
    record = await agent_err.persist_and_broadcast(
        meeting_id=meeting_id,
        evaluation=eval_obj,
        timestamp_ms=95000,
        was_pinched=False,
        broadcast_fn=lambda _m, p: broadcasted.append(p),
    )
    assert record["audio_b64"] is None
    assert "Single Point of Failure" in record["spoken_summary"]
    assert len(broadcasted) == 1
    assert broadcasted[0]["audio_b64"] is None

