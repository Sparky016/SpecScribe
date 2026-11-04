"""Tests for the post-meeting dashboard API: meeting list and multi-turn chat over meeting data."""

import uuid

import pytest
from fastapi.testclient import TestClient

import llm
from agents.spec_generator import (
    MAX_CHAT_HISTORY_TURNS,
    SpecGeneratorAgent,
    build_raw_record_chunks,
    normalize_chat_history,
    select_raw_record_context,
)
from main import app, session_manager


def _unfinalized_store(meeting_id: str) -> dict:
    return {
        "meetings": {
            meeting_id: {
                "id": meeting_id,
                "title": "Payments Review",
                "created_at": "2026-10-30T10:00:00+00:00",
                "latest_drawio_xml": (
                    "<mxGraphModel><root><mxCell id='0'/><mxCell id='1' parent='0'/>"
                    "<mxCell id='n1' value='Kafka Broker' vertex='1' parent='1'/>"
                    "<mxCell id='n2' value='Ledger DB' vertex='1' parent='1'/>"
                    "</root></mxGraphModel>"
                ),
                "generated_spec_md": None,
            }
        },
        "transcript_turns": {
            meeting_id: [
                {"speaker_label": "Speaker 0", "transcript_text": "We need idempotency keys on the payment API.", "timestamp_ms": 12000},
                {"speaker_label": "Speaker 1", "transcript_text": "Put Kafka in front of the ledger writer.", "timestamp_ms": 40000},
            ]
        },
        "diagram_snapshots": {
            meeting_id: [
                {
                    "id": "s1",
                    "timestamp_ms": 45000,
                    "drawio_xml": "<mxfile/>",
                    "diff_summary": "+ Added [queue] Kafka Broker",
                    "decision_rationale": "Absorb payment bursts before the ledger.",
                    "triggered_by": "PINCH_PALETTE",
                }
            ]
        },
        "agent_interventions": {
            meeting_id: [
                {
                    "id": "i1",
                    "timestamp_ms": 70000,
                    "category": "VULNERABILITY",
                    "short_title": "Replay attack risk",
                    "detailed_body": "Sign webhook payloads.",
                    "was_pinched": False,
                }
            ]
        },
        "knowledge_chunks": {meeting_id: []},
    }


# ---------------------------------------------------------------------------
# Raw-record retrieval helpers
# ---------------------------------------------------------------------------

def test_build_raw_record_chunks_covers_every_record_type():
    mid = str(uuid.uuid4())
    store = _unfinalized_store(mid)
    records = {
        "meeting": store["meetings"][mid],
        "transcript_turns": store["transcript_turns"][mid],
        "diagram_snapshots": store["diagram_snapshots"][mid],
        "agent_interventions": store["agent_interventions"][mid],
    }
    chunks = build_raw_record_chunks(records)
    types = [c["chunk_type"] for c in chunks]
    assert types.count("TRANSCRIPT") == 2
    assert "DECISION" in types and "AGENT_INSIGHT" in types
    diagram = next(c for c in chunks if c["chunk_type"] == "DIAGRAM")
    assert "Kafka Broker" in diagram["content"] and "Ledger DB" in diagram["content"]


def test_select_raw_record_context_puts_keyword_matches_first():
    chunks = [
        {"chunk_type": "TRANSCRIPT", "timestamp_ms": 1000, "content": "Speaker 0: hello everyone"},
        {"chunk_type": "TRANSCRIPT", "timestamp_ms": 2000, "content": "Speaker 1: Kafka absorbs bursts"},
    ]
    selected = select_raw_record_context("why kafka?", chunks)
    assert selected[0]["timestamp_ms"] == 2000
    # Non-matching records still follow, so broad questions see the whole meeting.
    assert len(selected) == 2


def test_normalize_chat_history_drops_invalid_and_keeps_recent():
    history = [{"role": "system", "content": "ignore"}, {"role": "user", "content": "  "}]
    history += [{"role": "user", "content": f"q{i}"} for i in range(MAX_CHAT_HISTORY_TURNS + 5)]
    turns = normalize_chat_history(history)
    assert len(turns) == MAX_CHAT_HISTORY_TURNS
    assert all(t["role"] == "user" for t in turns)
    assert turns[-1]["content"] == f"q{MAX_CHAT_HISTORY_TURNS + 4}"


# ---------------------------------------------------------------------------
# answer_question on meetings that were never finalized
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_answer_question_uses_raw_records_before_finalize():
    mid = str(uuid.uuid4())
    agent = SpecGeneratorAgent(api_key="", memory_store=_unfinalized_store(mid))
    result = await agent.answer_question(meeting_id=mid, question="Why did we add Kafka?")
    assert "Kafka" in result["answer"]
    assert result["citations"], "expected citations from raw meeting records"
    assert result["citations"][0]["timestamp_ms"] in (40000, 45000)


@pytest.mark.asyncio
async def test_answer_question_sends_history_and_meeting_data_to_llm(monkeypatch):
    mid = str(uuid.uuid4())
    captured = {}

    async def fake_generate(prompt, schema=None, contents=None, api_key=None):
        captured["prompt"] = prompt
        return "Kafka was added at [00:45] to absorb payment bursts."

    monkeypatch.setattr(llm, "generate_structured", fake_generate)
    agent = SpecGeneratorAgent(api_key="test-key", memory_store=_unfinalized_store(mid))
    result = await agent.answer_question(
        meeting_id=mid,
        question="Why was that added?",
        history=[
            {"role": "user", "content": "What sits in front of the ledger?"},
            {"role": "assistant", "content": "A Kafka Broker [00:45]."},
        ],
    )
    prompt = captured["prompt"]
    assert "User: What sits in front of the ledger?" in prompt
    assert "Assistant: A Kafka Broker [00:45]." in prompt
    assert "Latest question: Why was that added?" in prompt
    assert "Absorb payment bursts before the ledger." in prompt
    assert result["citations"] == [
        {"timestamp_ms": 45000, "label": "00:45", "excerpt": result["citations"][0]["excerpt"]}
    ]


# ---------------------------------------------------------------------------
# REST: GET /api/meetings and POST /ask with history
# ---------------------------------------------------------------------------

@pytest.fixture
def seeded_meetings():
    store = session_manager.memory_store
    old_id, new_id = str(uuid.uuid4()), str(uuid.uuid4())
    store["meetings"][old_id] = {
        "id": old_id, "title": "Older", "created_at": "2026-01-01T00:00:00+00:00", "generated_spec_md": "# spec",
    }
    store["meetings"][new_id] = {
        "id": new_id, "title": "Newer", "created_at": "2026-12-01T00:00:00+00:00", "generated_spec_md": None,
    }
    yield old_id, new_id
    store["meetings"].pop(old_id, None)
    store["meetings"].pop(new_id, None)


def test_list_meetings_returns_summaries_newest_first(seeded_meetings):
    old_id, new_id = seeded_meetings
    with TestClient(app) as client:
        resp = client.get("/api/meetings")
    assert resp.status_code == 200
    meetings = resp.json()["meetings"]
    ids = [m["id"] for m in meetings]
    assert ids.index(new_id) < ids.index(old_id)
    by_id = {m["id"]: m for m in meetings}
    assert by_id[old_id]["finalized"] is True
    assert by_id[new_id]["finalized"] is False
    assert by_id[new_id]["is_live"] is False
    assert "generated_spec_md" not in by_id[old_id]


def test_list_meetings_requires_token(monkeypatch, seeded_meetings):
    monkeypatch.setenv("SPECSCRIBE_API_TOKEN", "secret-token")
    monkeypatch.delenv("SPECSCRIBE_AUTH_DISABLED", raising=False)
    with TestClient(app) as client:
        assert client.get("/api/meetings").status_code == 401
        ok = client.get("/api/meetings", headers={"Authorization": "Bearer secret-token"})
    assert ok.status_code == 200


def test_ask_endpoint_accepts_history_and_rejects_bad_roles():
    mid = str(uuid.uuid4())
    store = _unfinalized_store(mid)
    for key in ("meetings", "transcript_turns", "diagram_snapshots", "agent_interventions"):
        session_manager.memory_store[key][mid] = store[key][mid]
    try:
        with TestClient(app) as client:
            ok = client.post(
                f"/api/meetings/{mid}/ask",
                json={"question": "Why Kafka?", "history": [{"role": "user", "content": "hi"}]},
            )
            bad = client.post(
                f"/api/meetings/{mid}/ask",
                json={"question": "Why Kafka?", "history": [{"role": "system", "content": "x"}]},
            )
        assert ok.status_code == 200
        assert ok.json()["citations"]
        assert bad.status_code == 422
    finally:
        for key in ("meetings", "transcript_turns", "diagram_snapshots", "agent_interventions"):
            session_manager.memory_store[key].pop(mid, None)
