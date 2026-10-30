"""
Unit and integration tests for Continuous Real-Time Requirement Reasoning on Transcript Turns (Task 58 - AC1).
Verifies:
- DecisionLinkerAgent.process_transcript_window reasons over rolling spoken turns without a diagram snapshot.
- Casual chatter / short filler (< 5 words) returns None (has_requirement=False) and does not pollute knowledge_chunks.
- AsrHandler.handle schedules speech-driven requirement reasoning (every 2+ substantive turns or >= 8s with intent),
  persists synthesized chunks in knowledge_chunks, and broadcasts REQUIREMENT_SYNTHESIZED and DECISION_LOGGED.
"""

import json
import os
import sys
from unittest.mock import AsyncMock, MagicMock, patch
import pytest

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

import llm
from agents.decision_linker import DecisionLinkerAgent, has_requirement_intent
from envelope_router import AsrHandler, EnvelopeRouter
from session_manager import SessionManager


class _FakeSupabase:
    def __init__(self):
        self.inserts = []

    def table(self, name):
        outer = self

        class _Table:
            def insert(self, rec):
                outer.inserts.append((name, rec))
                return self

            def select(self, *_a, **_k):
                return self

            def eq(self, *_a, **_k):
                return self

            def order(self, *_a, **_k):
                return self

            def execute(self):
                res = MagicMock()
                res.data = []
                return res

        return _Table()


@pytest.mark.asyncio
async def test_process_transcript_window_extracts_requirement_and_persists_chunk():
    """
    AC1: process_transcript_window extracts a structured REQUIREMENT chunk with speaker attribution,
    persists to knowledge_chunks (memory + Supabase), and returns summary/speaker/rationale.
    """
    meeting_id = "00000000-0000-4000-8000-000000000581"
    store = {
        "transcript_turns": {meeting_id: []},
        "knowledge_chunks": {meeting_id: []},
    }
    sb = _FakeSupabase()
    linker = DecisionLinkerAgent(api_key="test-key", supabase_client=sb, memory_store=store)

    llm_payload = {
        "has_requirement": True,
        "chunk_type": "REQUIREMENT",
        "summary": "Auth service must enforce sub-50ms p99 JWT verification latency using Redis.",
        "rationale": "Speaker 1 (Architect) specified a strict latency SLA for token validation to avoid ingress bottlenecks.",
        "speaker": "Speaker 1 (Architect)",
        "suggested_node_label": "Redis Cache",
        "suggested_node_type": "database",
    }

    turns = [
        {
            "id": "t1",
            "meeting_id": meeting_id,
            "speaker_label": "Speaker 0 (Wearer)",
            "transcript_text": "What latency target do we need on the authentication gateway?",
            "timestamp_ms": 10000,
        },
        {
            "id": "t2",
            "meeting_id": meeting_id,
            "speaker_label": "Speaker 1 (Architect)",
            "transcript_text": "The auth service must enforce sub-50ms p99 JWT verification latency using Redis.",
            "timestamp_ms": 14000,
        },
    ]

    with patch.object(llm, "generate_structured", new_callable=AsyncMock, return_value=json.dumps(llm_payload)):
        res = await linker.process_transcript_window(meeting_id, turns, current_xml="<mxfile/>")

    assert res is not None
    assert res["chunk_type"] == "REQUIREMENT"
    assert res["speaker"] == "Speaker 1 (Architect)"
    assert "sub-50ms" in res["summary"]
    assert "latency SLA" in res["rationale"]
    assert res["suggested_node"] == {"label": "Redis Cache", "node_type": "database"}

    # Verify persisted in memory_store["knowledge_chunks"]
    chunks = store["knowledge_chunks"][meeting_id]
    assert len(chunks) == 1
    assert chunks[0]["chunk_type"] == "REQUIREMENT"
    assert len(chunks[0]["embedding"]) == 1536
    assert "sub-50ms" in chunks[0]["content"]

    # Verify persisted in Supabase knowledge_chunks
    sb_rows = [r for tbl, r in sb.inserts if tbl == "knowledge_chunks"]
    assert len(sb_rows) == 1
    assert sb_rows[0]["chunk_type"] == "REQUIREMENT"
    assert sb_rows[0]["timestamp_ms"] == 14000


@pytest.mark.asyncio
async def test_process_transcript_window_ignores_casual_chatter_and_short_utterances():
    """
    AC1 & Risk Mitigation: Short utterances (< 5 words) and casual chatter (has_requirement=False)
    return None and do not insert noise into knowledge_chunks.
    """
    meeting_id = "00000000-0000-4000-8000-000000000582"
    store = {"knowledge_chunks": {meeting_id: []}}
    sb = _FakeSupabase()
    linker = DecisionLinkerAgent(api_key="test-key", supabase_client=sb, memory_store=store)

    # 1. Utterances shorter than 5 words are filtered before calling LLM
    short_turns = [
        {"speaker_label": "Speaker 0", "transcript_text": "uh-huh yeah", "timestamp_ms": 1000},
        {"speaker_label": "Speaker 1", "transcript_text": "sounds good to me", "timestamp_ms": 2000},
    ]
    with patch.object(llm, "generate_structured", new_callable=AsyncMock) as mock_llm:
        res_short = await linker.process_transcript_window(meeting_id, short_turns, current_xml="")
        assert res_short is None
        assert mock_llm.call_count == 0
        assert store["knowledge_chunks"][meeting_id] == []

    # 2. Casual chatter where Gemini returns has_requirement=False
    chatter_turns = [
        {
            "speaker_label": "Speaker 0",
            "transcript_text": "Hey everyone how was your weekend trip to the mountains?",
            "timestamp_ms": 3000,
        }
    ]
    with patch.object(
        llm,
        "generate_structured",
        new_callable=AsyncMock,
        return_value=json.dumps({"has_requirement": False, "chunk_type": "REQUIREMENT", "summary": "", "rationale": ""}),
    ):
        res_chatter = await linker.process_transcript_window(meeting_id, chatter_turns, current_xml="")
        assert res_chatter is None
        assert store["knowledge_chunks"][meeting_id] == []


@pytest.mark.asyncio
async def test_asr_handler_triggers_requirement_reasoning_and_broadcasts_without_snapshot():
    """
    AC1: Speaking requirement statements into AsrHandler (without taking a whiteboard snapshot)
    triggers DecisionLinkerAgent.process_transcript_window, stores the synthesized requirement in
    knowledge_chunks, and broadcasts DECISION_LOGGED and REQUIREMENT_SYNTHESIZED.
    """
    meeting_id = "00000000-0000-4000-8000-000000000583"
    session_mgr = SessionManager()
    session_mgr.get_or_create_session(meeting_id)

    sender_ws = AsyncMock()
    dashboard_ws = AsyncMock()
    glasses_ws = AsyncMock()
    session_mgr.active_connections[meeting_id].update({dashboard_ws, glasses_ws})

    router = EnvelopeRouter()

    with patch("time.time", return_value=100.0):
        # Turn 1: Speaker 0 states a requirement
        await router.dispatch(
            {
                "eventType": "asrTranscription",
                "speaker_label": "Speaker 0 (Wearer)",
                "transcript_text": "We need a PostgreSQL primary database with read replicas for user accounts.",
                "timestamp_ms": 10000,
                "silenceGapMs": 0,
            },
            sender_ws,
            session_mgr,
            meeting_id,
        )

    # Verify knowledge_chunks was populated without any diagram snapshot
    assert len(session_mgr.memory_store["diagram_snapshots"][meeting_id]) == 0
    chunks = session_mgr.memory_store["knowledge_chunks"][meeting_id]
    assert len(chunks) >= 1
    assert chunks[0]["chunk_type"] in ("REQUIREMENT", "DECISION")
    assert "PostgreSQL" in chunks[0]["content"]

    # Verify both REQUIREMENT_SYNTHESIZED and DECISION_LOGGED were broadcast to connected clients
    sent_payloads = [json.loads(call.args[0]) for call in glasses_ws.send_text.call_args_list]
    events = [p.get("event") for p in sent_payloads]
    assert "REQUIREMENT_SYNTHESIZED" in events
    assert "DECISION_LOGGED" in events

    req_msg = next(p for p in sent_payloads if p.get("event") == "REQUIREMENT_SYNTHESIZED")
    assert req_msg["meeting_id"] == meeting_id
    assert "PostgreSQL" in req_msg["summary"]
    assert req_msg["speaker"] == "Speaker 0 (Wearer)"


@pytest.mark.asyncio
async def test_asr_handler_sliding_window_two_turns_and_debounce():
    """
    AC1: Verify 2+ substantive turns trigger reasoning even when within the 8s debounce window,
    while short filler turns (< 5 words) are ignored.
    """
    meeting_id = "00000000-0000-4000-8000-000000000584"
    session_mgr = SessionManager()
    session = session_mgr.get_or_create_session(meeting_id)
    session.last_speech_reasoning_time = 500.0  # Simulate recent reasoning at t=500.0

    handler = AsrHandler()
    mock_ws = AsyncMock()
    broadcasts = []

    async def _capture_broadcast(mid, payload, exclude=None):
        broadcasts.append(payload)

    session_mgr.broadcast_to_meeting = AsyncMock(side_effect=_capture_broadcast)

    # Short utterance (< 5 words) at t=501.0 -> ignored, unreasoned_turn_count remains 0
    with patch("time.time", return_value=501.0):
        await handler.handle(
            {
                "eventType": "asrTranscription",
                "speaker_label": "Speaker 0",
                "transcript_text": "Yeah okay sure",
                "timestamp_ms": 1000,
            },
            mock_ws,
            session_mgr,
            meeting_id,
        )
    assert session.unreasoned_turn_count == 0

    # Substantive Turn 1 at t=502.0 (only 2s after last reasoning, < 8s debounce) -> count becomes 1, no trigger yet
    with patch("time.time", return_value=502.0):
        await handler.handle(
            {
                "eventType": "asrTranscription",
                "speaker_label": "Speaker 0 (Wearer)",
                "transcript_text": "How should we handle rate limiting on the public ingress endpoints?",
                "timestamp_ms": 2000,
            },
            mock_ws,
            session_mgr,
            meeting_id,
        )
    assert session.unreasoned_turn_count == 1
    assert not any(b.get("event") == "REQUIREMENT_SYNTHESIZED" for b in broadcasts)

    # Substantive Turn 2 at t=504.0 (unreasoned_turn_count reaches 2) -> triggers process_transcript_window!
    with patch("time.time", return_value=504.0):
        await handler.handle(
            {
                "eventType": "asrTranscription",
                "speaker_label": "Speaker 1 (Architect)",
                "transcript_text": "Agreed, we will use a distributed Redis token bucket rate limiter.",
                "timestamp_ms": 4000,
                "silenceGapMs": 3000,
            },
            mock_ws,
            session_mgr,
            meeting_id,
        )

    assert session.unreasoned_turn_count == 0
    req_events = [b for b in broadcasts if b.get("event") == "REQUIREMENT_SYNTHESIZED"]
    dec_events = [b for b in broadcasts if b.get("event") == "DECISION_LOGGED"]
    assert len(req_events) == 1
    assert len(dec_events) == 1
    assert req_events[0]["chunk_type"] == "DECISION"
    assert "rate limiter" in req_events[0]["summary"].lower()


def test_has_requirement_intent_helper():
    assert has_requirement_intent("uh-huh") is False
    assert has_requirement_intent("yes I agree") is False
    assert has_requirement_intent("We need a Redis cache in front of PostgreSQL.") is True
