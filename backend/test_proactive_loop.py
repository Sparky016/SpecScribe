"""Tests for per-iteration error isolation in the proactive loop (task 20).

The evaluator is always faked; no test makes a network call. Intervals are
short and every loop task is cancelled before the test returns.
"""
import asyncio
import os
import sys
from types import SimpleNamespace

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from agents.raising_hand_agent import RaisingHandAgent  # noqa: E402

MEETING = "task20-meeting"
INTERVAL = 0.01
WAIT_TIMEOUT = 5.0


def _agent_with_evaluator(side_effects, calls):
    """Returns an agent whose evaluate_proactive_async follows side_effects in order."""
    agent = RaisingHandAgent(api_key="")  # no real client is created

    async def fake_evaluate(**kwargs):
        calls.append(kwargs)
        outcome = side_effects[min(len(calls), len(side_effects)) - 1]
        if isinstance(outcome, BaseException):
            raise outcome
        return outcome

    agent.evaluate_proactive_async = fake_evaluate
    return agent


def _no_trigger():
    return SimpleNamespace(trigger=False)


def test_loop_continues_after_iteration_exception():
    async def scenario():
        calls = []
        agent = _agent_with_evaluator([RuntimeError("boom"), _no_trigger()], calls)
        task = agent.start_proactive_loop(MEETING, interval_seconds=INTERVAL)
        try:
            for _ in range(int(WAIT_TIMEOUT / INTERVAL)):
                if len(calls) >= 2:
                    break
                await asyncio.sleep(INTERVAL)
            assert len(calls) >= 2, "loop stopped after the first exception"
            assert not task.done()
            telemetry = agent._loop_telemetry[MEETING]
            assert telemetry["error_count"] == 1
            assert telemetry["last_error"] == "boom"
            assert telemetry["status"] == "running"
        finally:
            agent.stop_proactive_loop(MEETING)
            await asyncio.gather(task, return_exceptions=True)

    asyncio.run(scenario())


def test_cancellation_still_stops_loop():
    async def scenario():
        calls = []
        agent = _agent_with_evaluator([_no_trigger()], calls)
        task = agent.start_proactive_loop(MEETING, interval_seconds=INTERVAL)
        for _ in range(int(WAIT_TIMEOUT / INTERVAL)):
            if calls:
                break
            await asyncio.sleep(INTERVAL)
        assert calls, "loop never evaluated"
        task.cancel()
        results = await asyncio.gather(task, return_exceptions=True)
        assert task.cancelled() or isinstance(results[0], asyncio.CancelledError)
        count_at_cancel = len(calls)
        await asyncio.sleep(INTERVAL * 3)
        assert len(calls) == count_at_cancel, "loop kept evaluating after cancel"

    asyncio.run(scenario())
