"""
Unit & Integration Test Suite for SpecScribe AR Intelligence Agents
Tasks T-07 (Live Speaker Transcript Linker) & T-08 (Raising-Hand Agent)
"""

import asyncio
import json
import uuid
import pytest
from datetime import datetime, timezone
from fastapi.testclient import TestClient

from agents.decision_linker import (
    DecisionLinkerAgent,
    DecisionRationaleSchema,
    generate_deterministic_embedding,
    generate_text_embedding,
)
from agents.raising_hand_agent import (
    RaisingHandAgent,
    RaisingHandEvaluation,
)
from main import app, live_sessions, memory_store, db_save_transcript_turn, db_save_diagram_snapshot


@pytest.fixture
def test_meeting_id():
    return str(uuid.uuid4())


# ============================================================================
# T-07: Decision Linker Agent Unit Tests
# ============================================================================

def test_generate_text_embedding_dimensions():
    """Verify text embedding generation strictly guarantees 1536-dimensional vector for pgvector."""
    text = "Decision: Added Redis Cache between API Gateway and PostgreSQL."
    vec = generate_text_embedding(text, target_dim=1536)

    assert isinstance(vec, list)
    assert len(vec) == 1536
    assert all(isinstance(v, float) for v in vec)
    # Check deterministic consistency
    vec2 = generate_text_embedding(text, target_dim=1536)
    assert vec == vec2


def test_transcript_window_filtering(test_meeting_id):
    """Verify fetch_recent_transcripts extracts turns strictly within the 45-second window."""
    store = {
        "transcript_turns": {
            test_meeting_id: [
                # 60s ago -> outside 45s window
                {"id": "t1", "meeting_id": test_meeting_id, "speaker_label": "Speaker 0", "transcript_text": "Old turn", "timestamp_ms": 10000},
                # 35s ago -> inside 45s window
                {"id": "t2", "meeting_id": test_meeting_id, "speaker_label": "Speaker 1", "transcript_text": "We should use Redis.", "timestamp_ms": 35000},
                # 10s ago -> inside 45s window
                {"id": "t3", "meeting_id": test_meeting_id, "speaker_label": "Speaker 0", "transcript_text": "Adding Redis now.", "timestamp_ms": 60000},
                # Future -> outside window
                {"id": "t4", "meeting_id": test_meeting_id, "speaker_label": "Speaker 1", "transcript_text": "Future turn", "timestamp_ms": 80000},
            ]
        }
    }

    linker = DecisionLinkerAgent(api_key="", memory_store=store)
    # Snapshot taken at 70,000ms (window: [25,000ms, 70,000ms])
    recent = linker.fetch_recent_transcripts(test_meeting_id, timestamp_ms=70000, window_ms=45000)

    turn_ids = [t["id"] for t in recent]
    assert "t2" in turn_ids
    assert "t3" in turn_ids
    assert "t1" not in turn_ids
    assert "t4" not in turn_ids


@pytest.mark.asyncio
async def test_decision_linker_process_snapshot(test_meeting_id):
    """Verify decision_linker synthesizes rationale, updates snapshot, and creates knowledge chunk."""
    store = {
        "transcript_turns": {
            test_meeting_id: [
                {
                    "id": "t1",
                    "meeting_id": test_meeting_id,
                    "speaker_label": "Speaker 1 (Architect)",
                    "transcript_text": "Let's put Redis in front of PostgreSQL to prevent auth stampedes.",
                    "timestamp_ms": 20000,
                },
                {
                    "id": "t2",
                    "meeting_id": test_meeting_id,
                    "speaker_label": "Speaker 0 (Ruan)",
                    "transcript_text": "Agreed, dropping in the Redis database node now.",
                    "timestamp_ms": 28000,
                },
            ]
        },
        "diagram_snapshots": {
            test_meeting_id: [
                {
                    "id": "snap-123",
                    "meeting_id": test_meeting_id,
                    "timestamp_ms": 30000,
                    "drawio_xml": "<mxfile/>",
                    "diff_summary": "+ Added [database] Redis Cache",
                    "decision_rationale": "Pending analysis...",
                    "triggered_by": "PINCH_PALETTE",
                }
            ]
        },
        "knowledge_chunks": {test_meeting_id: []},
    }

    broadcast_events = []

    async def mock_broadcast(meeting_id, payload):
        broadcast_events.append(payload)

    linker = DecisionLinkerAgent(api_key="", memory_store=store)
    res = await linker.process_snapshot(
        meeting_id=test_meeting_id,
        snapshot_id="snap-123",
        timestamp_ms=30000,
        diff_summary="+ Added [database] Redis Cache",
        broadcast_fn=mock_broadcast,
    )

    assert res["snapshot_id"] == "snap-123"
    assert res["turns_considered"] == 2
    assert len(res["decision_rationale"]) > 10

    # Verify snapshot record was updated with rationale
    updated_snap = store["diagram_snapshots"][test_meeting_id][0]
    assert updated_snap["decision_rationale"] == res["decision_rationale"]
    assert "Pending analysis" not in updated_snap["decision_rationale"]

    # Verify 1536-dim knowledge chunk was created
    chunks = store["knowledge_chunks"][test_meeting_id]
    assert len(chunks) == 1
    assert chunks[0]["chunk_type"] == "DECISION"
    assert len(chunks[0]["embedding"]) == 1536
    assert "Redis Cache" in chunks[0]["content"]

    # Verify DECISION_LOGGED event was broadcast
    assert len(broadcast_events) == 1
    assert broadcast_events[0]["event"] == "DECISION_LOGGED"
    assert broadcast_events[0]["snapshot_id"] == "snap-123"


# ============================================================================
# T-08: Raising-Hand Agent Unit Tests
# ============================================================================

def test_raising_hand_short_title_constraint():
    """Verify short_title never exceeds 28 chars for AR optical waveguide display."""
    agent = RaisingHandAgent()
    long_title = "🚩 Critical Authentication Token Leakage Risk in External Ingress"
    truncated = agent._truncate_title(long_title, max_chars=28)

    assert len(truncated) <= 28
    assert truncated.endswith("…")


def test_raising_hand_heuristic_anti_pattern_detection(test_meeting_id):
    """Verify Mode A catches cache stampede and SPOF anti-patterns in offline mode."""
    store = {
        "transcript_turns": {
            test_meeting_id: [
                {
                    "speaker_label": "Speaker 0",
                    "transcript_text": "We added Redis cache and PostgreSQL.",
                    "timestamp_ms": 15000,
                }
            ]
        },
        "agent_interventions": {test_meeting_id: []},
    }
    agent = RaisingHandAgent(api_key="", memory_store=store)

    # 1. First evaluation: should trigger Cache Stampede Risk
    eval1 = agent.evaluate_proactive(
        meeting_id=test_meeting_id,
        timestamp_ms=20000,
        drawio_xml="<mxfile><mxCell value='Redis Cache'/><mxCell value='PostgreSQL'/></mxfile>",
    )
    assert eval1.trigger is True
    assert eval1.category == "VULNERABILITY"
    assert len(eval1.short_title) <= 28
    assert "Stampede" in eval1.short_title
    assert "mutex" in eval1.detailed_body.lower() or "coalescing" in eval1.detailed_body.lower()


@pytest.mark.asyncio
async def test_raising_hand_deduplication(test_meeting_id):
    """Verify Raising-Hand Agent does not repeatedly trigger duplicate alerts for the same issue."""
    store = {"agent_interventions": {test_meeting_id: []}, "transcript_turns": {test_meeting_id: []}}
    agent = RaisingHandAgent(api_key="", memory_store=store)

    eval1 = agent.evaluate_proactive(
        meeting_id=test_meeting_id,
        timestamp_ms=10000,
        drawio_xml="<mxCell value='Redis Cache'/>",
    )
    assert eval1.trigger is True

    # Persist first intervention
    await agent.persist_and_broadcast(
        meeting_id=test_meeting_id,
        evaluation=eval1,
        timestamp_ms=10000,
        was_pinched=False,
    )
    assert len(store["agent_interventions"][test_meeting_id]) == 1

    # Second evaluation on same diagram state: should be suppressed
    eval2 = agent.evaluate_proactive(
        meeting_id=test_meeting_id,
        timestamp_ms=30000,
        drawio_xml="<mxCell value='Redis Cache'/>",
    )
    assert eval2.trigger is False


@pytest.mark.asyncio
async def test_raising_hand_mode_b_on_demand_research_pull(test_meeting_id):
    """Verify Mode B (ASK_AGENT) synthesizes technical research guidance and flags was_pinched=True."""
    store = {"agent_interventions": {test_meeting_id: []}, "transcript_turns": {test_meeting_id: []}}
    broadcast_events = []

    async def mock_broadcast(meeting_id, payload):
        broadcast_events.append(payload)

    agent = RaisingHandAgent(api_key="", memory_store=store)

    record = await agent.handle_research_pull(
        meeting_id=test_meeting_id,
        query="What eviction policy should we use for Redis sessions?",
        timestamp_ms=45000,
        drawio_xml="<mxfile><mxCell value='Redis Session Cache'/></mxfile>",
        broadcast_fn=mock_broadcast,
    )

    assert record["was_pinched"] is True
    assert record["category"] == "RESEARCH"
    assert len(record["short_title"]) <= 28
    assert "LRU" in record["short_title"] or "Redis" in record["short_title"]
    assert len(record["detailed_body"]) > 20

    # Verify event broadcast
    assert len(broadcast_events) == 1
    assert broadcast_events[0]["event"] == "HAND_RAISED"
    assert broadcast_events[0]["was_pinched"] is True
    assert broadcast_events[0]["short_title"] == record["short_title"]


# ============================================================================
# Integration Tests: FastAPI Endpoints & WebSocket Full-Duplex Flow
# ============================================================================

def test_api_meeting_interventions_and_knowledge():
    """Verify REST endpoints for retrieving interventions and knowledge chunks."""
    client = TestClient(app)

    # 1. Create meeting
    resp = client.post("/api/meetings", json={"title": "Agents Integration Review"})
    assert resp.status_code == 200
    mid = resp.json()["id"]

    # 2. Trigger proactive critique endpoint
    critique_resp = client.post(f"/api/meetings/{mid}/proactive-critique")
    assert critique_resp.status_code == 200
    critique_data = critique_resp.json()
    assert "trigger" in critique_data
    assert "evaluation" in critique_data

    # 3. Check interventions endpoint
    i_resp = client.get(f"/api/meetings/{mid}/interventions")
    assert i_resp.status_code == 200
    assert isinstance(i_resp.json(), list)

    # 4. Check timeline endpoint contains safe knowledge_chunks
    t_resp = client.get(f"/api/meetings/{mid}/timeline")
    assert t_resp.status_code == 200
    timeline = t_resp.json()
    assert "agent_interventions" in timeline
    assert "knowledge_chunks" in timeline


def test_websocket_ask_agent_research_pull():
    """Verify WebSocket pinchCommand with action == 'ASK_AGENT' triggers Mode B research intervention."""
    client = TestClient(app)

    # Create meeting
    resp = client.post("/api/meetings", json={"title": "WS Agents Test"})
    mid = resp.json()["id"]

    with client.websocket_connect(f"/ws/meeting/{mid}") as ws:
        # Handshake
        ws.send_text(json.dumps({
            "eventType": "handshake",
            "protocolVersion": "1.1.0",
            "device": "Snap Spectacles 2024",
        }))
        ack = json.loads(ws.receive_text())
        assert ack["event"] in ["HANDSHAKE_ACK", "DIAGRAM_UPDATED"]

        # User pinches 3D Orb and speaks research query
        ws.send_text(json.dumps({
            "eventType": "pinchCommand",
            "action": "ASK_AGENT",
            "label": "How to prevent Redis cache stampede?",
            "timestamp_ms": 25000,
        }))

        # Expect HAND_RAISED message
        hand_msg = json.loads(ws.receive_text())
        assert hand_msg["event"] == "HAND_RAISED"
        assert hand_msg["was_pinched"] is True
        assert hand_msg["category"] == "RESEARCH"
        assert len(hand_msg["short_title"]) <= 28
        assert "Stampede" in hand_msg["detailed_body"] or "Redis" in hand_msg["detailed_body"] or "LRU" in hand_msg["short_title"]
