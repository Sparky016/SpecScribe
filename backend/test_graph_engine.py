"""
Unit tests for the vision fallback in extract_graph_delta_from_gemini (DEV_TASK_10).
Gemini is mocked throughout; no network calls are made.
"""

import json
from types import SimpleNamespace

import pytest

from graph_engine import extract_graph_delta_from_gemini, GraphDeltaSchema


@pytest.fixture(autouse=True)
def _gemini_env(monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.delenv("GEMINI_MODEL", raising=False)
    monkeypatch.delenv("SPECSCRIBE_DEMO_MODE", raising=False)


def _install_fake_gemini(monkeypatch, text=None, error=None):
    from google import genai

    class FakeModels:
        async def generate_content(self, **kwargs):
            if error is not None:
                raise error
            return SimpleNamespace(text=text)

    class FakeClient:
        def __init__(self, api_key=None):
            self.aio = SimpleNamespace(models=FakeModels())

    monkeypatch.setattr(genai, "Client", FakeClient)


def _assert_no_change(delta: GraphDeltaSchema):
    assert isinstance(delta, GraphDeltaSchema)
    assert delta.has_meaningful_change is False
    assert delta.added_vertices == []
    assert delta.added_edges == []
    assert delta.diff_summary == ""
    assert delta.person_occluding_board is False


@pytest.mark.asyncio
async def test_valid_no_change_response_returns_parsed_no_change(monkeypatch):
    """AC1: a valid Gemini 'no change' answer is returned as-is, with no invented vertices."""
    no_change = {
        "person_occluding_board": False,
        "has_meaningful_change": False,
        "added_vertices": [],
        "added_edges": [],
        "diff_summary": "",
    }
    _install_fake_gemini(monkeypatch, text=json.dumps(no_change))

    delta = await extract_graph_delta_from_gemini(b"img", [], api_key="test-key")

    _assert_no_change(delta)


@pytest.mark.asyncio
async def test_valid_change_response_is_returned(monkeypatch):
    """A validated Gemini answer with real changes is returned unmodified."""
    change = {
        "person_occluding_board": False,
        "has_meaningful_change": True,
        "added_vertices": [{"temp_id": "a1", "label": "API Gateway", "node_type": "service"}],
        "added_edges": [],
        "diff_summary": "+ API Gateway",
    }
    _install_fake_gemini(monkeypatch, text=json.dumps(change))

    delta = await extract_graph_delta_from_gemini(b"img", [], api_key="test-key")

    assert delta.has_meaningful_change is True
    assert [v.label for v in delta.added_vertices] == ["API Gateway"]


@pytest.mark.asyncio
async def test_gemini_exception_returns_empty_no_change(monkeypatch):
    """AC2: an exception from every Gemini model yields an empty no-change delta."""
    _install_fake_gemini(monkeypatch, error=RuntimeError("boom"))

    delta = await extract_graph_delta_from_gemini(b"img", [], api_key="test-key")

    _assert_no_change(delta)


@pytest.mark.asyncio
async def test_client_construction_exception_returns_empty_no_change(monkeypatch):
    """AC2: an exception outside the model loop also yields an empty no-change delta."""
    from google import genai

    def _raise(*args, **kwargs):
        raise RuntimeError("client init failed")

    monkeypatch.setattr(genai, "Client", _raise)

    delta = await extract_graph_delta_from_gemini(b"img", [], api_key="test-key")

    _assert_no_change(delta)


@pytest.mark.asyncio
async def test_malformed_response_returns_empty_no_change(monkeypatch):
    """AC2: a response that fails to parse/validate yields an empty no-change delta."""
    _install_fake_gemini(monkeypatch, text="not json")

    delta = await extract_graph_delta_from_gemini(b"img", [], api_key="test-key")

    _assert_no_change(delta)


@pytest.mark.asyncio
async def test_missing_api_key_returns_empty_no_change(monkeypatch):
    """AC2: no API key yields an empty no-change delta and never calls Gemini."""
    from google import genai

    def _fail_if_called(*args, **kwargs):
        raise AssertionError("Gemini client must not be built without a key")

    monkeypatch.setattr(genai, "Client", _fail_if_called)

    delta = await extract_graph_delta_from_gemini(b"img", [], api_key=None)

    _assert_no_change(delta)


@pytest.mark.asyncio
async def test_demo_mode_restores_node_when_no_api_key(monkeypatch):
    """AC3: SPECSCRIBE_DEMO_MODE=1 restores the demo 'Whiteboard Node' on the no-key path."""
    monkeypatch.setenv("SPECSCRIBE_DEMO_MODE", "1")

    delta = await extract_graph_delta_from_gemini(b"img", [], api_key=None)

    assert delta.has_meaningful_change is True
    assert [v.label for v in delta.added_vertices] == ["Whiteboard Node"]


@pytest.mark.asyncio
async def test_demo_mode_restores_ingress_on_gemini_failure(monkeypatch):
    """AC3: SPECSCRIBE_DEMO_MODE=1 restores the demo 'Whiteboard Ingress' on the failure path."""
    monkeypatch.setenv("SPECSCRIBE_DEMO_MODE", "1")
    _install_fake_gemini(monkeypatch, error=RuntimeError("boom"))

    delta = await extract_graph_delta_from_gemini(b"img", [], api_key="test-key")

    assert delta.has_meaningful_change is True
    assert [v.label for v in delta.added_vertices] == ["Whiteboard Ingress"]
