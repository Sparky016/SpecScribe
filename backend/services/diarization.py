"""
Multi-Speaker Diarization & Conversational Turn Attribution Service (Task 57).

Supports two complementary speaker attribution pipelines:
1. Path A (Deepgram Audio Diarization): When DEEPGRAM_API_KEY is configured and
   an audioChunk (base64 WAV/PCM) or audio URL is received, calls deepgram-sdk
   with model="nova-2", diarize=True, smart_format=True to extract per-utterance
   or per-word speaker segments (Speaker 0, Speaker 1, etc.).
2. Path B (ASR Text + Pause & Contextual Speaker Attribution): When text-only
   asrTranscription envelopes arrive from LensStudio:AsrModule with silenceGapMs
   / silenceDurationMs and speaker_label="auto", infers speaker transitions
   using pause duration + conversational handoff/polarity shift cues while
   preserving explicit speaker labels.
"""

import asyncio
import base64
from dataclasses import dataclass
import logging
import os
import re
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger("specscribe.diarization")

WEARER_LABEL = "Speaker 0 (Wearer)"
PARTICIPANT_LABELS = [
    WEARER_LABEL,
    "Speaker 1 (Participant)",
    "Speaker 2 (Participant)",
    "Speaker 3 (Participant)",
]

# Minimum silence gap (ms) required before switching speakers on heuristic text turns
DEFAULT_SILENCE_SWITCH_THRESHOLD_MS = 2500

# Explicit speaker prefix pattern, e.g. "[Speaker 1]: ...", "Speaker 2: ..."
_EXPLICIT_PREFIX_RE = re.compile(
    r"^\s*\[?(Speaker\s+\d+(?:\s*\([^)]+\))?)\]?\s*:\s*(.+)$",
    re.IGNORECASE,
)

# Self-identification / third-speaker introduction cues
_THIRD_SPEAKER_INTRO_RE = re.compile(
    r"\b(?:from\s+the\s+(?:security|infra|devops|product|qa|frontend|data|ops)\s+(?:side|team)|"
    r"i\s+also\s+want\s+to\s+chime\s+in|"
    r"jumping\s+in\s+here|"
    r"third\s+perspective|"
    r"speaking\s+as\s+the)\b",
    re.IGNORECASE,
)

# Conversational response / agreement / disagreement / handoff starters
_RESPONSE_STARTER_RE = re.compile(
    r"^\s*(?:yes|yeah|yep|no|nope|sure|agreed|exactly|right|good\s+point|"
    r"i\s+agree|i\s+disagree|i\s+think|we\s+should|we\s+can|let's|lets|"
    r"actually|instead|well|maybe|definitely|absolutely|makes\s+sense|"
    r"on\s+the\s+other\s+hand|however|what\s+if|how\s+about|why\s+don't\s+we)\b",
    re.IGNORECASE,
)

# Direct address / handoff cues at the end of a turn
_HANDOFF_PROMPT_RE = re.compile(
    r"(?:\?\s*$|what\s+do\s+you\s+think|how\s+does\s+that\s+sound|"
    r"do\s+you\s+agree|your\s+thoughts|right\?\s*$)",
    re.IGNORECASE,
)


@dataclass
class DiarizedUtterance:
    """Single diarized utterance extracted from audio or text attribution."""

    speaker_label: str
    transcript_text: str
    start_ms: int = 0
    end_ms: int = 0
    speaker_index: int = 0
    confidence: float = 1.0


@dataclass
class _MeetingSpeakerState:
    """Per-meeting state for conversational turn-taking attribution."""

    current_speaker_idx: int = 0
    turn_count: int = 0
    last_text: str = ""
    last_timestamp_ms: int = 0
    last_was_question_or_handoff: bool = False
    known_speakers: int = 2


def format_speaker_label(speaker_index: int) -> str:
    """Map a 0-based speaker index to a canonical SpecScribe speaker label."""
    if speaker_index <= 0:
        return WEARER_LABEL
    if speaker_index < len(PARTICIPANT_LABELS):
        return PARTICIPANT_LABELS[speaker_index]
    return f"Speaker {speaker_index} (Participant)"


def is_auto_speaker_label(speaker_label: Optional[str]) -> bool:
    """Return True if speaker_label requests automatic diarization/attribution."""
    if speaker_label is None:
        return True
    cleaned = speaker_label.strip().lower()
    return cleaned in ("", "auto", "unknown")


class SpeakerDiarizer:
    """
    Multi-speaker diarization service supporting Deepgram Nova-2 audio diarization
    and conversational turn-taking fallback for text-only ASR streams.
    """

    def __init__(
        self,
        deepgram_client: Optional[Any] = None,
        api_key: Optional[str] = None,
        silence_threshold_ms: int = DEFAULT_SILENCE_SWITCH_THRESHOLD_MS,
    ):
        self._explicit_client = deepgram_client
        self._api_key = api_key
        self.silence_threshold_ms = silence_threshold_ms
        self._meeting_states: Dict[str, _MeetingSpeakerState] = {}

    @property
    def api_key(self) -> Optional[str]:
        return self._api_key or os.environ.get("DEEPGRAM_API_KEY")

    def _get_deepgram_client(self) -> Optional[Any]:
        if self._explicit_client is not None:
            return self._explicit_client
        key = self.api_key
        if not key:
            return None
        try:
            from deepgram import DeepgramClient

            return DeepgramClient(api_key=key)
        except Exception as e:
            logger.warning("Failed to initialize DeepgramClient: %s", e)
            return None

    def reset_meeting(self, meeting_id: str) -> None:
        """Clear cached speaker state for a meeting."""
        self._meeting_states.pop(meeting_id, None)

    def attribute_text_turn(
        self,
        meeting_id: str,
        transcript_text: str,
        speaker_label: Optional[str] = "auto",
        silence_gap_ms: Optional[int] = None,
        timestamp_ms: int = 0,
    ) -> Tuple[str, str]:
        """
        Determine the speaker label (and cleaned text) for an inbound ASR text turn.

        - Preserves any explicit speaker_label (when not None, "", "auto", or "unknown").
        - Supports inline "[Speaker 1]: ..." prefix tags in transcript_text.
        - Otherwise uses silence_gap_ms (>2500ms threshold) combined with conversational
          polarity shifts (question -> answer, handoff -> response, or third-speaker
          self-intro cues) to attribute turns across speakers.
        """
        text = (transcript_text or "").strip()

        # 1. Explicit inline prefix tag in text, e.g. "[Speaker 1]: Let's use Redis"
        prefix_match = _EXPLICIT_PREFIX_RE.match(text)
        if prefix_match and is_auto_speaker_label(speaker_label):
            raw_tag = prefix_match.group(1).strip()
            cleaned_text = prefix_match.group(2).strip()
            idx_match = re.search(r"(\d+)", raw_tag)
            if idx_match and "(" not in raw_tag:
                idx = int(idx_match.group(1))
                resolved = format_speaker_label(idx)
            else:
                resolved = raw_tag
            state = self._meeting_states.setdefault(meeting_id, _MeetingSpeakerState())
            if idx_match:
                state.current_speaker_idx = int(idx_match.group(1))
            state.turn_count += 1
            state.last_text = cleaned_text
            state.last_timestamp_ms = timestamp_ms
            state.last_was_question_or_handoff = bool(_HANDOFF_PROMPT_RE.search(cleaned_text))
            return resolved, cleaned_text

        # 2. Explicit speaker_label field preserved unchanged (AC3)
        if not is_auto_speaker_label(speaker_label):
            explicit_label = str(speaker_label).strip()
            state = self._meeting_states.setdefault(meeting_id, _MeetingSpeakerState())
            idx_match = re.search(r"Speaker\s+(\d+)", explicit_label, re.IGNORECASE)
            if idx_match:
                state.current_speaker_idx = int(idx_match.group(1))
            state.turn_count += 1
            state.last_text = text
            state.last_timestamp_ms = timestamp_ms
            state.last_was_question_or_handoff = bool(_HANDOFF_PROMPT_RE.search(text))
            return explicit_label, text

        # 3. Automatic conversational turn-taking attribution (AC2)
        state = self._meeting_states.setdefault(meeting_id, _MeetingSpeakerState())

        # Compute effective silence gap if not explicitly provided
        effective_gap_ms = silence_gap_ms
        if effective_gap_ms is None and state.turn_count > 0 and timestamp_ms > state.last_timestamp_ms:
            effective_gap_ms = timestamp_ms - state.last_timestamp_ms
        if effective_gap_ms is None:
            effective_gap_ms = 0

        if state.turn_count == 0:
            # First utterance in session defaults to Speaker 0 (Wearer)
            state.current_speaker_idx = 0
        else:
            gap_exceeds_threshold = effective_gap_ms >= self.silence_threshold_ms
            has_polarity_shift = self._detect_conversational_shift(
                prev_text=state.last_text,
                prev_was_handoff=state.last_was_question_or_handoff,
                curr_text=text,
            )
            if gap_exceeds_threshold and has_polarity_shift:
                if _THIRD_SPEAKER_INTRO_RE.search(text):
                    state.known_speakers = max(state.known_speakers, 3)
                    state.current_speaker_idx = 2 if state.current_speaker_idx != 2 else 1
                else:
                    # Toggle between Wearer (0) and Participant (1)
                    state.current_speaker_idx = 1 if state.current_speaker_idx == 0 else 0

        state.turn_count += 1
        state.last_text = text
        state.last_timestamp_ms = timestamp_ms
        state.last_was_question_or_handoff = bool(_HANDOFF_PROMPT_RE.search(text))

        return format_speaker_label(state.current_speaker_idx), text

    @staticmethod
    def _detect_conversational_shift(
        prev_text: str,
        prev_was_handoff: bool,
        curr_text: str,
    ) -> bool:
        """
        Check whether consecutive turns exhibit a conversational polarity shift
        (e.g. question followed by answer, handoff cue, or response starter).
        """
        if not curr_text:
            return False
        # Previous turn ended with a question or handoff prompt
        if prev_was_handoff or (prev_text and prev_text.rstrip().endswith("?")):
            return True
        # Current turn starts with a conversational reply / agreement / counterpoint cue
        if _RESPONSE_STARTER_RE.search(curr_text):
            return True
        # Current turn introduces a third speaker role
        if _THIRD_SPEAKER_INTRO_RE.search(curr_text):
            return True
        # Current turn asks a direct question back after a statement
        if curr_text.rstrip().endswith("?") and prev_text and not prev_text.rstrip().endswith("?"):
            return True
        return False

    async def diarize_audio_chunk(
        self,
        audio_bytes_or_b64: Any,
        timestamp_ms: int = 0,
        audio_url: Optional[str] = None,
    ) -> List[DiarizedUtterance]:
        """
        Diarize raw audio bytes, base64-encoded WAV/PCM, or an audio URL via Deepgram Nova-2.

        Calls deepgram-sdk with model="nova-2", diarize=True, smart_format=True,
        utterances=True and returns a list of DiarizedUtterance items with distinct
        speaker_label values ("Speaker 0 (Wearer)", "Speaker 1 (Participant)", etc.).
        """
        client = self._get_deepgram_client()
        if client is None:
            logger.debug("Deepgram client unavailable (no API key or mock); skipping audio diarization.")
            return []

        raw_bytes: bytes = b""
        if not audio_url:
            if isinstance(audio_bytes_or_b64, (bytes, bytearray)):
                raw_bytes = bytes(audio_bytes_or_b64)
            elif isinstance(audio_bytes_or_b64, str) and audio_bytes_or_b64.strip():
                b64_str = audio_bytes_or_b64.strip()
                if "," in b64_str and b64_str.startswith("data:"):
                    b64_str = b64_str.split(",", 1)[1]
                raw_bytes = base64.b64decode(b64_str)

        if not audio_url and not raw_bytes:
            return []

        response = await self._invoke_deepgram(client, raw_bytes=raw_bytes, audio_url=audio_url)
        if response is None:
            return []

        return self._parse_deepgram_response(response, base_timestamp_ms=timestamp_ms)

    async def _invoke_deepgram(
        self,
        client: Any,
        raw_bytes: bytes,
        audio_url: Optional[str] = None,
    ) -> Any:
        """Invoke Deepgram SDK v7 (`listen.v1.media`) or legacy prerecorded interface."""
        kwargs = {
            "model": "nova-2",
            "diarize": True,
            "smart_format": True,
            "utterances": True,
        }

        def _call_sync() -> Any:
            # Deepgram SDK v7.x: client.listen.v1.media.transcribe_file / transcribe_url
            listen = getattr(client, "listen", None)
            v1 = getattr(listen, "v1", None) if listen else None
            media = getattr(v1, "media", None) if v1 else None
            if media is not None:
                if audio_url and hasattr(media, "transcribe_url"):
                    return media.transcribe_url(url=audio_url, **kwargs)
                if hasattr(media, "transcribe_file"):
                    return media.transcribe_file(request=raw_bytes, **kwargs)

            # Fallback for custom/mocked clients exposing transcribe_file directly
            if hasattr(client, "transcribe_file"):
                return client.transcribe_file(request=raw_bytes, **kwargs)
            raise AttributeError("Deepgram client does not expose listen.v1.media.transcribe_file")

        res = await asyncio.to_thread(_call_sync)
        if asyncio.iscoroutine(res):
            res = await res
        return res

    def _parse_deepgram_response(
        self,
        response: Any,
        base_timestamp_ms: int = 0,
    ) -> List[DiarizedUtterance]:
        """
        Extract speaker-attributed utterances from a Deepgram ListenV1Response
        (either via `results.utterances` or by grouping `results.channels[0].alternatives[0].words`
        by `word.speaker`).
        """
        results = self._get_field(response, "results")
        if not results:
            return []

        utterances_out: List[DiarizedUtterance] = []

        # 1. Prefer top-level results.utterances when present
        raw_utterances = self._get_field(results, "utterances")
        if raw_utterances:
            for utt in raw_utterances:
                text = (self._get_field(utt, "transcript") or "").strip()
                if not text:
                    continue
                speaker_idx = int(self._get_field(utt, "speaker") or 0)
                start_sec = float(self._get_field(utt, "start") or 0.0)
                end_sec = float(self._get_field(utt, "end") or start_sec)
                confidence = float(self._get_field(utt, "confidence") or 1.0)
                utterances_out.append(
                    DiarizedUtterance(
                        speaker_label=format_speaker_label(speaker_idx),
                        transcript_text=text,
                        start_ms=base_timestamp_ms + int(start_sec * 1000),
                        end_ms=base_timestamp_ms + int(end_sec * 1000),
                        speaker_index=speaker_idx,
                        confidence=confidence,
                    )
                )
            if utterances_out:
                return utterances_out

        # 2. Group per-word diarized output from channels[0].alternatives[0].words
        channels = self._get_field(results, "channels") or []
        if not channels:
            return []
        alternatives = self._get_field(channels[0], "alternatives") or []
        if not alternatives:
            return []
        alt = alternatives[0]
        words = self._get_field(alt, "words") or []

        if words:
            current_speaker: Optional[int] = None
            current_words: List[str] = []
            seg_start_sec: float = 0.0
            seg_end_sec: float = 0.0

            for w in words:
                token = self._get_field(w, "punctuated_word") or self._get_field(w, "word") or ""
                token = str(token).strip()
                if not token:
                    continue
                spk = int(self._get_field(w, "speaker") or 0)
                w_start = float(self._get_field(w, "start") or 0.0)
                w_end = float(self._get_field(w, "end") or w_start)

                if current_speaker is None:
                    current_speaker = spk
                    current_words = [token]
                    seg_start_sec = w_start
                    seg_end_sec = w_end
                elif spk == current_speaker:
                    current_words.append(token)
                    seg_end_sec = w_end
                else:
                    utterances_out.append(
                        DiarizedUtterance(
                            speaker_label=format_speaker_label(current_speaker),
                            transcript_text=" ".join(current_words),
                            start_ms=base_timestamp_ms + int(seg_start_sec * 1000),
                            end_ms=base_timestamp_ms + int(seg_end_sec * 1000),
                            speaker_index=current_speaker,
                        )
                    )
                    current_speaker = spk
                    current_words = [token]
                    seg_start_sec = w_start
                    seg_end_sec = w_end

            if current_words and current_speaker is not None:
                utterances_out.append(
                    DiarizedUtterance(
                        speaker_label=format_speaker_label(current_speaker),
                        transcript_text=" ".join(current_words),
                        start_ms=base_timestamp_ms + int(seg_start_sec * 1000),
                        end_ms=base_timestamp_ms + int(seg_end_sec * 1000),
                        speaker_index=current_speaker,
                    )
                )
            return utterances_out

        # 3. Final fallback if only transcript string is present on the alternative
        transcript = (self._get_field(alt, "transcript") or "").strip()
        if transcript:
            utterances_out.append(
                DiarizedUtterance(
                    speaker_label=WEARER_LABEL,
                    transcript_text=transcript,
                    start_ms=base_timestamp_ms,
                    end_ms=base_timestamp_ms,
                    speaker_index=0,
                )
            )
        return utterances_out

    @staticmethod
    def _get_field(obj: Any, key: str) -> Any:
        if obj is None:
            return None
        if isinstance(obj, dict):
            return obj.get(key)
        return getattr(obj, key, None)
