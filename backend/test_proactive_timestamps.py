"""Tests for per-session elapsed-time timestamps on proactive interventions (task 11)."""
import asyncio
import os
import sys
import uuid

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from agents.raising_hand_agent import RaisingHandAgent, RaisingHandEvaluation
from session_manager import SessionManager

DAY_MS = 86_400_000


def test_elapsed_ms_is_small_and_monotonic():
    mgr = SessionManager()
    session = mgr.get_or_create_session(str(uuid.uuid4()))
    a = session.elapsed_ms()
    b = session.elapsed_ms()
    assert 0 <= a <= b < DAY_MS


def test_proactive_loop_uses_session_elapsed_ms():
    mgr = SessionManager()
    mid = str(uuid.uuid4())
    mgr.get_or_create_session(mid)
    agent = RaisingHandAgent(api_key="", memory_store={"agent_interventions": {}})
    seen = []

    async def fake_eval(meeting_id, timestamp_ms, drawio_xml, **kw):
        seen.append(timestamp_ms)
        return RaisingHandEvaluation(trigger=False)

    agent.evaluate_proactive_async = fake_eval

    async def run():
        task = agent.start_proactive_loop(
            meeting_id=mid,
            interval_seconds=0.01,
            get_diagram_fn=lambda m: "",
            get_timestamp_fn=lambda m: mgr.get_or_create_session(m).elapsed_ms(),
        )
        await asyncio.sleep(0.1)
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass

    asyncio.run(run())
    assert seen
    assert all(0 <= ts < DAY_MS for ts in seen)


def test_default_timestamp_is_not_epoch():
    agent = RaisingHandAgent(api_key="", memory_store={"agent_interventions": {}})
    seen = []

    async def fake_eval(meeting_id, timestamp_ms, drawio_xml, **kw):
        seen.append(timestamp_ms)
        return RaisingHandEvaluation(trigger=False)

    agent.evaluate_proactive_async = fake_eval

    async def run():
        task = agent.start_proactive_loop(meeting_id="m", interval_seconds=0.01)
        await asyncio.sleep(0.1)
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass

    asyncio.run(run())
    assert seen and all(0 <= ts < DAY_MS for ts in seen)


def test_get_recent_context_finds_turns_in_elapsed_window():
    mid = "m1"
    store = {"transcript_turns": {mid: [
        {"timestamp_ms": 1_000, "transcript_text": "old"},
        {"timestamp_ms": 50_000, "transcript_text": "a"},
        {"timestamp_ms": 70_000, "transcript_text": "b"},
        {"timestamp_ms": 200_000, "transcript_text": "future"},
    ]}}
    agent = RaisingHandAgent(api_key="", memory_store=store)
    turns = agent._get_recent_context(mid, 80_000, window_ms=60_000)
    assert [t["transcript_text"] for t in turns] == ["a", "b"]
