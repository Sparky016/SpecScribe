"""
Unit & Integration Test Suite for SpecScribe AR Post-Meeting Tech Spec & pgvector Pipeline (T-09)
"""

import json
import uuid
import pytest
from fastapi.testclient import TestClient

from agents.spec_generator import (
    SpecGeneratorAgent,
    cosine_similarity,
    format_timestamp_ms,
    parse_timestamp_label,
)
from main import app, live_sessions, memory_store, get_or_create_session


@pytest.fixture
def sample_meeting_id():
    return str(uuid.uuid4())


# ============================================================================
# T-09 Unit Tests: Utilities, Formatting & Cosine Similarity
# ============================================================================

def test_timestamp_formatting_and_parsing():
    """Verify millisecond to [MM:SS] label formatting and inverse parsing."""
    assert format_timestamp_ms(0) == "00:00"
    assert format_timestamp_ms(15000) == "00:15"
    assert format_timestamp_ms(36000) == "00:36"
    assert format_timestamp_ms(125000) == "02:05"

    assert parse_timestamp_label("00:36") == 36000
    assert parse_timestamp_label("[00:36]") == 36000
    assert parse_timestamp_label("[02:05]") == 125000
    assert parse_timestamp_label("invalid") == 0


def test_cosine_similarity_math():
    """Verify vector cosine similarity calculation for pgvector in-memory fallback."""
    v1 = [1.0, 0.0, 0.0]
    v2 = [1.0, 0.0, 0.0]
    v3 = [0.0, 1.0, 0.0]
    v4 = [-1.0, 0.0, 0.0]

    assert pytest.approx(cosine_similarity(v1, v2), 0.001) == 1.0
    assert pytest.approx(cosine_similarity(v1, v3), 0.001) == 0.0
    assert pytest.approx(cosine_similarity(v1, v4), 0.001) == -1.0
    # Zero norm protection
    assert cosine_similarity([0.0, 0.0], [0.0, 0.0]) == 0.0
    assert cosine_similarity([], [1.0]) == 0.0


# ============================================================================
# T-09 Unit Tests: Spec Compilation & Chunking
# ============================================================================

def test_compile_markdown_spec_structure(sample_meeting_id):
    """Verify Markdown Tech Spec includes all required sections, XML codeblock, and decision logs."""
    agent = SpecGeneratorAgent()

    test_xml = "<mxfile><diagram><mxCell id='v1' value='Ingress'/></diagram></mxfile>"
    snapshots = [
        {
            "id": "s1",
            "timestamp_ms": 36000,
            "diff_summary": "+ Added [database] Redis Cache",
            "decision_rationale": "Mitigate token validation storms on auth.",
            "triggered_by": "PINCH_PALETTE",
        }
    ]
    interventions = [
        {
            "id": "i1",
            "timestamp_ms": 50000,
            "category": "VULNERABILITY",
            "short_title": "🚩 Cache Stampede Risk",
            "detailed_body": "• High concurrency cache misses.\n• Add mutex lock.",
        }
    ]
    transcripts = [
        {"speaker_label": "Speaker 0", "transcript_text": "Adding Redis.", "timestamp_ms": 35000}
    ]

    spec_md = agent.compile_markdown_spec(
        meeting_id=sample_meeting_id,
        meeting_title="Auth Architecture Review",
        drawio_xml=test_xml,
        transcript_turns=transcripts,
        diagram_snapshots=snapshots,
        agent_interventions=interventions,
    )

    assert "Technical Specification: Auth Architecture Review" in spec_md
    assert "## 1. Executive Summary" in spec_md
    assert "## 2. System Architecture Overview" in spec_md
    assert "## 3. Architecture Model (.drawio XML)" in spec_md
    assert "```xml\n" + test_xml in spec_md
    assert "## 4. Chronological Decision Log" in spec_md
    assert "[00:36]" in spec_md
    assert "Redis Cache" in spec_md
    assert "## 5. Security, Reliability & Failure Modes" in spec_md
    assert "Cache Stampede Risk" in spec_md
    assert "## 6. Action Items & Implementation Roadmap" in spec_md


def test_chunk_meeting_artifacts_types(sample_meeting_id):
    """Verify chunk_meeting_artifacts generates all 4 required chunk_types."""
    agent = SpecGeneratorAgent()

    spec_md = (
        "# Technical Specification: Test\n\n"
        "## 1. Executive Summary\nSummary text.\n\n"
        "## 2. Architecture Overview\nOverview text.\n"
    )
    snapshots = [
        {"timestamp_ms": 15000, "diff_summary": "+ Added API Gateway", "decision_rationale": "Ingress entry point"}
    ]
    transcripts = [
        {"speaker_label": "Speaker 0", "transcript_text": "First turn", "timestamp_ms": 10000},
        {"speaker_label": "Speaker 1", "transcript_text": "Second turn", "timestamp_ms": 12000},
    ]
    interventions = [
        {"timestamp_ms": 20000, "category": "VULNERABILITY", "short_title": "Auth Risk", "detailed_body": "Mitigate brute force."}
    ]

    raw_chunks = agent.chunk_meeting_artifacts(
        meeting_id=sample_meeting_id,
        spec_md=spec_md,
        transcript_turns=transcripts,
        diagram_snapshots=snapshots,
        agent_interventions=interventions,
    )

    types = {c["chunk_type"] for c in raw_chunks}
    assert "DECISION" in types
    assert "TRANSCRIPT_WINDOW" in types
    assert "AGENT_INSIGHT" in types
    assert "TECH_SPEC" in types

    # Check timestamps and content
    dec_chunk = next(c for c in raw_chunks if c["chunk_type"] == "DECISION")
    assert dec_chunk["timestamp_ms"] == 15000
    assert "[00:15]" in dec_chunk["content"]

    agent_chunk = next(c for c in raw_chunks if c["chunk_type"] == "AGENT_INSIGHT")
    assert agent_chunk["timestamp_ms"] == 20000
    assert "Auth Risk" in agent_chunk["content"]


# ============================================================================
# T-09 Integration Tests: Finalize & Grounded RAG Pipeline
# ============================================================================

@pytest.mark.asyncio
async def test_finalize_meeting_pipeline(sample_meeting_id):
    """Verify complete finalize_meeting execution creates spec and embeds 1536-dim chunks."""
    store = {
        "meetings": {
            sample_meeting_id: {
                "id": sample_meeting_id,
                "title": "Auth & Cache Brainstorming",
                "latest_drawio_xml": "<mxfile/>",
                "generated_spec_md": None,
            }
        },
        "transcript_turns": {
            sample_meeting_id: [
                {"speaker_label": "Speaker 1", "transcript_text": "Let's place Redis between Gateway and DB.", "timestamp_ms": 25000},
                {"speaker_label": "Speaker 0", "transcript_text": "Done, added Redis node.", "timestamp_ms": 36000},
            ]
        },
        "diagram_snapshots": {
            sample_meeting_id: [
                {
                    "id": "s1",
                    "timestamp_ms": 36000,
                    "drawio_xml": "<mxfile><mxCell value='Redis Cache'/></mxfile>",
                    "diff_summary": "+ Added [database] Redis Cache",
                    "decision_rationale": "Protect against token validation storms on PostgreSQL.",
                    "triggered_by": "PINCH_PALETTE",
                }
            ]
        },
        "agent_interventions": {
            sample_meeting_id: [
                {
                    "id": "i1",
                    "timestamp_ms": 50000,
                    "category": "VULNERABILITY",
                    "short_title": "🚩 Cache Stampede Risk",
                    "detailed_body": "• Add mutex locking on cache miss.",
                    "was_pinched": False,
                }
            ]
        },
        "knowledge_chunks": {sample_meeting_id: []},
    }

    agent = SpecGeneratorAgent(memory_store=store)
    result = await agent.finalize_meeting(
        meeting_id=sample_meeting_id,
        drawio_xml="<mxfile><mxCell value='Redis Cache'/></mxfile>",
        title="Auth & Cache Brainstorming",
    )

    assert result["meeting_id"] == sample_meeting_id
    assert result["chunks_created"] >= 4
    assert len(result["spec_md"]) > 200

    # Verify meeting record updated with generated spec
    assert store["meetings"][sample_meeting_id]["generated_spec_md"] == result["spec_md"]

    # Verify 1536-dim embeddings on all chunks
    persisted_chunks = store["knowledge_chunks"][sample_meeting_id]
    assert len(persisted_chunks) == result["chunks_created"]
    for c in persisted_chunks:
        assert len(c["embedding"]) == 1536
        assert isinstance(c["content"], str)

    # Test grounded RAG query on the finalized meeting
    rag_result = await agent.answer_question(
        meeting_id=sample_meeting_id,
        question="Why was Redis cache added?",
    )
    assert rag_result["meeting_id"] == sample_meeting_id
    assert len(rag_result["answer"]) > 10
    assert len(rag_result["citations"]) > 0
    # Verify [MM:SS] citation format
    first_cit = rag_result["citations"][0]
    assert ":" in first_cit["label"]
    assert first_cit["timestamp_ms"] >= 0


# ============================================================================
# FastAPI REST Endpoints Integration Tests
# ============================================================================

def test_rest_api_finalize_and_ask_flow():
    """Verify end-to-end REST lifecycle for /api/meetings/{id}/finalize and /api/meetings/{id}/ask."""
    client = TestClient(app)

    # 1. Create meeting
    create_resp = client.post("/api/meetings", json={"title": "RAG End-to-End Test"})
    assert create_resp.status_code == 200
    mid = create_resp.json()["id"]

    # 2. Add transcript turn via session memory
    memory_store["transcript_turns"][mid].append({
        "id": "t1",
        "meeting_id": mid,
        "speaker_label": "Speaker 0 (Ruan)",
        "transcript_text": "Adding Redis to handle peak auth traffic.",
        "timestamp_ms": 36000,
    })
    memory_store["diagram_snapshots"][mid].append({
        "id": "s1",
        "meeting_id": mid,
        "timestamp_ms": 36000,
        "drawio_xml": "<mxfile><mxCell value='Redis Cache'/></mxfile>",
        "diff_summary": "+ Added [database] Redis Cache",
        "decision_rationale": "Handle peak auth traffic without PostgreSQL contention.",
        "triggered_by": "PINCH_PALETTE",
    })

    # 3. Call POST /api/meetings/{id}/finalize
    finalize_resp = client.post(f"/api/meetings/{mid}/finalize")
    assert finalize_resp.status_code == 200
    fin_data = finalize_resp.json()
    assert "spec_md" in fin_data
    assert "chunks_created" in fin_data
    assert fin_data["chunks_created"] >= 2
    assert "Technical Specification:" in fin_data["spec_md"]

    # 4. Call POST /api/meetings/{id}/ask
    ask_resp = client.post(
        f"/api/meetings/{mid}/ask",
        json={"question": "What is the purpose of the Redis node?"},
    )
    assert ask_resp.status_code == 200
    ask_data = ask_resp.json()
    assert ask_data["meeting_id"] == mid
    assert "answer" in ask_data
    assert len(ask_data["citations"]) > 0
    assert ask_data["citations"][0]["label"] == "00:36"

    # 5. Verify timeline endpoint now includes generated spec and knowledge chunks
    timeline_resp = client.get(f"/api/meetings/{mid}/timeline")
    assert timeline_resp.status_code == 200
    tl = timeline_resp.json()
    assert tl["meeting"]["generated_spec_md"] is not None
    assert len(tl["knowledge_chunks"]) >= 2
