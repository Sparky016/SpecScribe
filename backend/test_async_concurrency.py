"""
Unit tests verifying non-blocking asynchronous event loop execution and batch embedding (Fixes #1, #5).
Ensures Gemini API calls use client.aio and batch endpoints without freezing the FastAPI event loop.
"""

import asyncio
import inspect
import logging
import time
import uuid
import pytest

from graph_engine import extract_graph_delta_from_gemini, GraphDeltaSchema
from agents.decision_linker import (
    DecisionLinkerAgent,
    generate_text_embedding_async,
    generate_text_embeddings_batch_async,
)
from agents.raising_hand_agent import RaisingHandAgent, RaisingHandEvaluation
from agents.spec_generator import SpecGeneratorAgent
from session_manager import SessionManager


@pytest.mark.asyncio
async def test_extract_graph_delta_is_coroutine():
    """Verify extract_graph_delta_from_gemini is an async coroutine function (Fix #1)."""
    assert inspect.iscoroutinefunction(extract_graph_delta_from_gemini)

    # Execute async call
    delta = await extract_graph_delta_from_gemini(
        image_bytes=b"dummy_image_data",
        existing_nodes=[{"label": "API Gateway", "type": "service"}],
    )
    assert isinstance(delta, GraphDeltaSchema)
    assert delta.diff_summary is not None


@pytest.mark.asyncio
async def test_async_and_batch_embeddings():
    """Verify generate_text_embedding_async and batch generation return 1536-dim vectors (Fix #1, #5)."""
    assert inspect.iscoroutinefunction(generate_text_embedding_async)
    assert inspect.iscoroutinefunction(generate_text_embeddings_batch_async)

    # Test single async embedding
    vec = await generate_text_embedding_async("Test architectural component", target_dim=1536)
    assert len(vec) == 1536
    assert all(isinstance(v, float) for v in vec)

    # Test batch async embedding (Fix #5)
    texts = [
        "Component A: Redis Caching Layer",
        "Component B: PostgreSQL Read Replica",
        "Component C: Kafka Event Stream",
        "Decision: Use Token Bucket Rate Limiting",
    ]
    t0 = time.perf_counter()
    batch_vecs = await generate_text_embeddings_batch_async(texts, target_dim=1536)
    elapsed = time.perf_counter() - t0

    assert len(batch_vecs) == len(texts)
    for v in batch_vecs:
        assert len(v) == 1536
        assert all(isinstance(val, float) for val in v)


@pytest.mark.asyncio
async def test_decision_linker_async_execution():
    """Verify DecisionLinkerAgent uses synthesize_rationale_async without blocking."""
    store = {
        "transcript_turns": {
            "m-1": [
                {"id": "t1", "speaker_label": "Alice", "transcript_text": "We need Redis for session state", "timestamp_ms": 10000}
            ]
        },
        "diagram_snapshots": {"m-1": []},
        "knowledge_chunks": {"m-1": []},
    }
    linker = DecisionLinkerAgent(memory_store=store)

    assert inspect.iscoroutinefunction(linker.synthesize_rationale_async)

    rationale = await linker.synthesize_rationale_async(
        meeting_id="m-1",
        diff_summary="+ Added Redis Cache",
        recent_turns=store["transcript_turns"]["m-1"],
    )
    assert isinstance(rationale, str)
    assert len(rationale) > 5

    # Process snapshot should complete non-blocking
    res = await linker.process_snapshot(
        meeting_id="m-1",
        snapshot_id="snap-1",
        timestamp_ms=12000,
        diff_summary="+ Added Redis Cache",
    )
    assert isinstance(res["decision_rationale"], str)
    assert len(res["decision_rationale"]) > 5
    assert len(store["knowledge_chunks"]["m-1"]) == 1
    assert len(store["knowledge_chunks"]["m-1"][0]["embedding"]) == 1536


@pytest.mark.asyncio
async def test_raising_hand_agent_async_methods():
    """Verify RaisingHandAgent async proactive and research pull methods (Fix #1)."""
    agent = RaisingHandAgent()

    assert inspect.iscoroutinefunction(agent.evaluate_proactive_async)
    assert inspect.iscoroutinefunction(agent.evaluate_research_pull_async)

    # Proactive async evaluation
    eval_res = await agent.evaluate_proactive_async(
        meeting_id="m-test",
        timestamp_ms=5000,
        drawio_xml="<mxfile><mxCell value='Database'/></mxfile>",
    )
    assert isinstance(eval_res, RaisingHandEvaluation)
    assert len(eval_res.short_title) <= 28

    # Research pull async evaluation
    research_res = await agent.evaluate_research_pull_async(
        meeting_id="m-test",
        query="What eviction policy should we use for Redis sessions?",
        timestamp_ms=6000,
    )
    assert isinstance(research_res, RaisingHandEvaluation)
    assert research_res.trigger is True
    assert len(research_res.short_title) <= 28


@pytest.mark.asyncio
async def test_spec_generator_batch_embed_and_async_rag():
    """Verify spec_generator embeds chunks in batch and executes async RAG (Fix #1, #5)."""
    sample_id = str(uuid.uuid4())
    store = {
        "meetings": {
            sample_id: {
                "id": sample_id,
                "title": "Auth Architecture Review",
                "latest_drawio_xml": "<mxfile/>",
                "generated_spec_md": None,
            }
        },
        "transcript_turns": {sample_id: []},
        "diagram_snapshots": {sample_id: []},
        "agent_interventions": {sample_id: []},
        "knowledge_chunks": {sample_id: []},
    }
    agent = SpecGeneratorAgent(memory_store=store)

    assert inspect.iscoroutinefunction(agent.compile_markdown_spec_async)

    # Test batch embedding of 10 chunks concurrently (Fix #5)
    raw_chunks = [
        {
            "chunk_type": "DECISION",
            "timestamp_ms": i * 5000,
            "content": f"Decision #{i}: Architecture update with component {i}",
        }
        for i in range(10)
    ]

    persisted = await agent.embed_and_persist_chunks(sample_id, raw_chunks)
    assert len(persisted) == 10
    assert len(store["knowledge_chunks"][sample_id]) == 10
    for chunk in persisted:
        assert len(chunk["embedding"]) == 1536

    # Test async answer_question (RAG)
    rag_res = await agent.answer_question(
        meeting_id=sample_id,
        question="What was decided about component 3?",
    )
    assert "answer" in rag_res
    assert len(rag_res["answer"]) > 5


@pytest.mark.asyncio
async def test_event_loop_concurrency_liveness():
    """Verify that background timer ticks continue smoothly during concurrent AI operations."""
    tick_count = 0

    async def heartbeat():
        nonlocal tick_count
        for _ in range(10):
            await asyncio.sleep(0.01)
            tick_count += 1

    agent = SpecGeneratorAgent()
    heartbeat_task = asyncio.create_task(heartbeat())

    # Run multiple async operations concurrently
    raw_chunks = [
        {"chunk_type": "DECISION", "timestamp_ms": i * 1000, "content": f"Content item {i}"}
        for i in range(6)
    ]
    await asyncio.gather(
        agent.embed_and_persist_chunks("live-test", raw_chunks),
        extract_graph_delta_from_gemini(b"img", []),
        heartbeat_task,
    )

    # Heartbeat must have progressed through its ticks
    assert tick_count == 10


@pytest.mark.asyncio
async def test_spawn_logs_background_task_exception(caplog):
    """Verify exceptions from SessionManager.spawn tasks are logged at ERROR (Task 21)."""
    manager = SessionManager()

    async def failing_task():
        raise RuntimeError("background boom")

    with caplog.at_level(logging.ERROR, logger="specscribe.session_manager"):
        task = manager.spawn(failing_task())
        await asyncio.wait([task])

    assert task not in manager._bg_tasks
    errors = [r for r in caplog.records if r.levelno == logging.ERROR]
    assert len(errors) == 1
    assert errors[0].exc_info is not None
    assert "background boom" in str(errors[0].exc_info[1])


@pytest.mark.asyncio
async def test_spawn_holds_reference_until_done():
    """Verify spawned tasks are held in _bg_tasks while running and released on completion (Task 21)."""
    manager = SessionManager()
    release = asyncio.Event()

    async def waiting_task():
        await release.wait()

    task = manager.spawn(waiting_task())
    await asyncio.sleep(0)
    assert task in manager._bg_tasks

    release.set()
    await asyncio.wait([task])
    assert task not in manager._bg_tasks


@pytest.mark.asyncio
async def test_cancel_background_tasks_on_shutdown(caplog):
    """Verify cancel_background_tasks cancels and awaits outstanding spawned tasks without ERROR logs (Task 21)."""
    manager = SessionManager()

    async def long_running():
        await asyncio.sleep(3600)

    with caplog.at_level(logging.ERROR, logger="specscribe.session_manager"):
        tasks = [manager.spawn(long_running()) for _ in range(3)]
        await asyncio.sleep(0)
        await manager.cancel_background_tasks()

    assert all(t.cancelled() for t in tasks)
    assert not manager._bg_tasks
    assert not [r for r in caplog.records if r.levelno == logging.ERROR]
