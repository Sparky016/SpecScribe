"""
Unit tests for the shared async LLM helper (DEV_TASK_46).
genai.Client is faked throughout; no network calls are made.
"""

import asyncio
import logging
from types import SimpleNamespace

import pytest
from pydantic import BaseModel

import llm


class _Schema(BaseModel):
    value: str


@pytest.fixture(autouse=True)
def _isolated_llm(monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.delenv("GEMINI_MODEL", raising=False)
    monkeypatch.delenv(llm.TIMEOUT_ENV_VAR, raising=False)
    monkeypatch.setattr(llm, "_client", None)
    monkeypatch.setattr(llm, "_client_key", None)


def _install_client(monkeypatch, behaviours):
    """behaviours: model name -> text to return, an Exception to raise, or a float seconds to hang."""
    from google import genai

    calls = []
    constructed = []

    class FakeModels:
        async def generate_content(self, **kwargs):
            calls.append(kwargs)
            outcome = behaviours.get(kwargs["model"], RuntimeError("unknown model"))
            if isinstance(outcome, Exception):
                raise outcome
            if isinstance(outcome, float):
                await asyncio.sleep(outcome)
                return SimpleNamespace(text="too late")
            return SimpleNamespace(text=outcome)

    class FakeClient:
        def __init__(self, api_key=None):
            constructed.append(api_key)
            self.aio = SimpleNamespace(models=FakeModels())

    monkeypatch.setattr(genai, "Client", FakeClient)
    return calls, constructed


@pytest.mark.asyncio
async def test_no_api_key_returns_none_without_building_a_client(monkeypatch):
    calls, constructed = _install_client(monkeypatch, {})

    assert await llm.generate_structured("p") is None
    assert await llm.generate_structured("p", api_key="") is None
    assert constructed == []
    assert calls == []


@pytest.mark.asyncio
async def test_falls_back_to_next_model_and_logs_warning(monkeypatch, caplog):
    calls, _ = _install_client(monkeypatch, {
        "gemini-3.5-flash": RuntimeError("quota exhausted"),
        "gemini-3.8-flash": "answer",
    })

    with caplog.at_level(logging.WARNING, logger="specscribe.llm"):
        text = await llm.generate_structured("p", api_key="k")

    assert text == "answer"
    assert [c["model"] for c in calls] == ["gemini-3.5-flash", "gemini-3.8-flash"]
    warnings = [r for r in caplog.records if r.levelno == logging.WARNING]
    assert any("gemini-3.5-flash" in r.getMessage() and "quota exhausted" in r.getMessage() for r in warnings)


@pytest.mark.asyncio
async def test_configured_model_is_tried_first(monkeypatch):
    monkeypatch.setenv("GEMINI_MODEL", "custom-model")
    calls, _ = _install_client(monkeypatch, {"custom-model": "ok"})

    assert await llm.generate_structured("p", api_key="k") == "ok"
    assert [c["model"] for c in calls] == ["custom-model"]


def test_configured_model_already_listed_is_not_duplicated(monkeypatch):
    monkeypatch.setenv("GEMINI_MODEL", "gemini-2.5-flash")

    assert llm.get_candidate_models() == list(llm.DEFAULT_CANDIDATE_MODELS)


@pytest.mark.asyncio
async def test_each_attempt_is_bounded_by_the_timeout(monkeypatch, caplog):
    monkeypatch.setenv(llm.TIMEOUT_ENV_VAR, "0.05")
    calls, _ = _install_client(monkeypatch, {
        "gemini-3.5-flash": 5.0,
        "gemini-3.8-flash": "fast answer",
    })

    with caplog.at_level(logging.WARNING, logger="specscribe.llm"):
        text = await asyncio.wait_for(llm.generate_structured("p", api_key="k"), timeout=2)

    assert text == "fast answer"
    assert any("timed out" in r.getMessage() for r in caplog.records if r.levelno == logging.WARNING)


@pytest.mark.asyncio
async def test_all_models_failing_returns_none(monkeypatch, caplog):
    calls, _ = _install_client(monkeypatch, {
        "gemini-3.5-flash": RuntimeError("a"),
        "gemini-3.8-flash": "",
        "gemini-2.5-flash": RuntimeError("c"),
    })

    with caplog.at_level(logging.WARNING, logger="specscribe.llm"):
        assert await llm.generate_structured("p", api_key="k") is None

    assert len(calls) == 3
    assert any("All Gemini models failed" in r.getMessage() for r in caplog.records)


@pytest.mark.asyncio
async def test_schema_requests_json_and_contents_precede_prompt(monkeypatch):
    calls, _ = _install_client(monkeypatch, {"gemini-3.5-flash": '{"value": "x"}'})

    await llm.generate_structured("the prompt", schema=_Schema, contents=["image-part"], api_key="k")

    assert calls[0]["contents"] == ["image-part", "the prompt"]
    config = calls[0]["config"]
    assert config.response_mime_type == "application/json"
    assert config.response_schema is _Schema


@pytest.mark.asyncio
async def test_no_schema_sends_plain_request(monkeypatch):
    calls, _ = _install_client(monkeypatch, {"gemini-3.5-flash": "markdown"})

    assert await llm.generate_structured("p", api_key="k") == "markdown"
    assert calls[0]["contents"] == ["p"]
    assert "config" not in calls[0]


@pytest.mark.asyncio
async def test_one_client_is_shared_across_calls(monkeypatch):
    _, constructed = _install_client(monkeypatch, {"gemini-3.5-flash": "ok"})

    await llm.generate_structured("a", api_key="k")
    await llm.generate_structured("b", api_key="k")

    assert constructed == ["k"]


@pytest.mark.asyncio
async def test_client_construction_failure_returns_none(monkeypatch):
    from google import genai

    def _raise(*args, **kwargs):
        raise RuntimeError("client init failed")

    monkeypatch.setattr(genai, "Client", _raise)

    assert await llm.generate_structured("p", api_key="k") is None


@pytest.mark.parametrize("raw", ["abc", "0", "-3"])
def test_invalid_timeout_uses_default(monkeypatch, raw):
    monkeypatch.setenv(llm.TIMEOUT_ENV_VAR, raw)

    assert llm.get_timeout_seconds() == llm.DEFAULT_TIMEOUT_SECONDS
