"""Tests for proactive heuristic fallback scope and whole-word matching (task 19).

Gemini is always mocked; no test makes a network call.
"""
import asyncio
import json
import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import llm  # noqa: E402
from agents.raising_hand_agent import RaisingHandAgent  # noqa: E402

MEETING = "task19-meeting"


class _FakeLLM:
    """Stands in for llm.generate_structured: returns the payload as JSON, or None (all models failed)."""

    def __init__(self, payload=None, fail=False):
        self.payload = payload
        self.fail = fail
        self.calls = []

    async def __call__(self, prompt, schema=None, contents=None, api_key=None):
        self.calls.append(schema)
        if self.fail:
            return None
        return json.dumps(self.payload)


@pytest.fixture
def fake_llm(monkeypatch):
    def _install(payload=None, fail=False):
        fake = _FakeLLM(payload=payload, fail=fail)
        monkeypatch.setattr(llm, "generate_structured", fake)
        return fake

    return _install


def _agent_with_llm():
    return RaisingHandAgent(api_key="test-key")


def _eval(agent, xml, turns=None):
    return asyncio.run(
        agent.evaluate_proactive_async(
            meeting_id=MEETING,
            timestamp_ms=20_000,
            drawio_xml=xml,
            recent_turns=turns or [{"transcript_text": "", "timestamp_ms": 1}],
        )
    )


def test_gemini_trigger_false_suppresses_heuristic_even_with_cache_keyword(fake_llm):
    fake = fake_llm(payload={
        "trigger": False,
        "category": "LOGIC_FLAW",
        "short_title": "Architecture Sound",
        "detailed_body": "Looks fine.",
    })
    agent = _agent_with_llm()
    turns = [{"transcript_text": "We put a cache in front of it.", "timestamp_ms": 1}]

    result = _eval(agent, "<mxCell value='Redis Cache'/>", turns)

    assert fake.calls, "Gemini should have been consulted"
    assert result.trigger is False
    assert result.short_title == "Architecture Sound"


def test_gemini_duplicate_title_is_not_reraised(fake_llm):
    fake_llm(payload={
        "trigger": True,
        "category": "VULNERABILITY",
        "short_title": "🚩 Cache Stampede Risk",
        "detailed_body": "Duplicate.",
    })
    agent = _agent_with_llm()
    agent._history[MEETING] = {"🚩 Cache Stampede Risk"}

    result = _eval(agent, "<mxCell value='Redis Cache'/>")

    assert result.trigger is False


def test_gemini_new_finding_is_returned_as_is(fake_llm):
    fake_llm(payload={
        "trigger": True,
        "category": "ALTERNATIVE_IDEA",
        "short_title": "🔁 Use Event Sourcing",
        "detailed_body": "Consider event sourcing.",
    })
    agent = _agent_with_llm()

    result = _eval(agent, "<mxCell value='Ledger'/>")

    assert result.trigger is True
    assert result.short_title == "🔁 Use Event Sourcing"
    assert result.category == "ALTERNATIVE_IDEA"


def test_heuristic_runs_when_no_api_key(fake_llm):
    fake = fake_llm(payload={"trigger": False})
    agent = RaisingHandAgent(api_key="")

    result = _eval(agent, "<mxCell value='Redis Cache'/>")

    assert not fake.calls, "Gemini must not be consulted without an API key"
    assert result.trigger is True
    assert "Stampede" in result.short_title


def test_heuristic_runs_when_gemini_call_fails(fake_llm):
    fake = fake_llm(fail=True)
    agent = _agent_with_llm()

    result = _eval(agent, "<mxCell value='Redis Cache'/>")

    assert fake.calls, "Gemini should have been attempted"
    assert result.trigger is True
    assert "Stampede" in result.short_title


def test_generate_does_not_satisfy_rate_limit_keyword():
    agent = RaisingHandAgent(api_key="")
    xml = "<mxCell value='Auth token service'/>"
    turns = [{"transcript_text": "We will generate the reports nightly.", "timestamp_ms": 1}]

    result = agent._evaluate_heuristic_proactive(MEETING, xml, turns)

    assert result.trigger is True
    assert "Auth Flooding" in result.short_title


def test_real_rate_limit_suppresses_auth_rule():
    agent = RaisingHandAgent(api_key="")
    xml = "<mxCell value='Auth token service with rate limiting'/>"

    result = agent._evaluate_heuristic_proactive(MEETING, xml, [])

    assert result.trigger is False


def test_heuristic_matches_whole_words_only_for_cache():
    agent = RaisingHandAgent(api_key="")
    # 'cache' inside a longer word must not raise the cache-stampede hand
    result = agent._evaluate_heuristic_proactive(MEETING, "<mxCell value='Cachet'/>", [])

    assert result.trigger is False
