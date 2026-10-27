"""Task 17: pinned embedding model, no fabricated embeddings on failure."""

import sys
import types as pytypes

import pytest

import llm
from agents.decision_linker import (
    DecisionLinkerAgent,
    generate_text_embedding,
    generate_text_embedding_async,
    generate_text_embeddings_batch_async,
    get_embedding_model,
)


class _FailingModels:
    def __init__(self):
        self.models_used = []

    async def embed_content(self, model, contents, config=None):
        self.models_used.append(model)
        raise RuntimeError("embedding service down")


class _FakeClient:
    def __init__(self, *a, **k):
        self.aio = types_ns(models=_FailingModels())
        self.models = self.aio.models


def types_ns(**kw):
    return pytypes.SimpleNamespace(**kw)


class _FakeSupabase:
    def __init__(self):
        self.inserts = []

    def table(self, name):
        outer = self

        class _T:
            def update(self, *_a, **_k):
                return self

            def eq(self, *_a, **_k):
                return self

            def insert(self, rec):
                outer.inserts.append((name, rec))
                return self

            def execute(self):
                return None

        return _T()


@pytest.fixture
def online_failing(monkeypatch):
    """Offline mode off, key present, embedding client always raises."""
    monkeypatch.delenv("SPECSCRIBE_OFFLINE_EMBEDDINGS", raising=False)
    monkeypatch.delenv("SPECSCRIBE_EMBEDDING_MODEL", raising=False)
    client = _FakeClient()
    from google import genai

    monkeypatch.setattr(genai, "Client", lambda *a, **k: client)
    return client


@pytest.fixture(autouse=True)
def _no_llm(monkeypatch):
    """Rationale generation fails (heuristic rationale, no network); only embeddings are under test."""

    async def _unavailable(prompt, schema=None, contents=None, api_key=None):
        return None

    monkeypatch.setattr(llm, "generate_structured", _unavailable)


def _linker(store, supabase):
    return DecisionLinkerAgent(api_key="fake-key", supabase_client=supabase, memory_store=store)


@pytest.mark.asyncio
async def test_embedding_failure_skips_insert(online_failing):
    store = {"knowledge_chunks": {"m1": []}, "diagram_snapshots": {"m1": []}, "transcript_turns": {}}
    sb = _FakeSupabase()
    result = await _linker(store, sb).process_snapshot("m1", "s1", 1000, "Added cache")

    assert store["knowledge_chunks"]["m1"] == []
    assert not [i for i in sb.inserts if i[0] == "knowledge_chunks"]
    assert result["chunk_id"] is None
    assert online_failing.aio.models.models_used == ["gemini-embedding-001"]  # single pinned model


@pytest.mark.asyncio
async def test_failure_returns_none_everywhere(online_failing):
    assert await generate_text_embedding_async("x") is None
    assert await generate_text_embeddings_batch_async(["a", "b"]) == [None, None]


def test_no_key_without_offline_flag_returns_none(monkeypatch):
    monkeypatch.delenv("SPECSCRIBE_OFFLINE_EMBEDDINGS", raising=False)
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    assert generate_text_embedding("x") is None


@pytest.mark.asyncio
async def test_inserted_chunk_includes_embedding_model(monkeypatch):
    monkeypatch.setenv("SPECSCRIBE_OFFLINE_EMBEDDINGS", "1")
    store = {"knowledge_chunks": {"m1": []}, "diagram_snapshots": {"m1": []}, "transcript_turns": {}}
    sb = _FakeSupabase()
    await _linker(store, sb).process_snapshot("m1", "s1", 1000, "Added cache")

    rows = [r for t, r in sb.inserts if t == "knowledge_chunks"]
    assert len(rows) == 1
    assert rows[0]["embedding_model"] == get_embedding_model() == "offline-deterministic"
    assert len(rows[0]["embedding"]) == 1536
    assert store["knowledge_chunks"]["m1"][0]["embedding_model"] == "offline-deterministic"


def test_embedding_model_pinned_via_env(monkeypatch):
    monkeypatch.delenv("SPECSCRIBE_OFFLINE_EMBEDDINGS", raising=False)
    assert get_embedding_model() == "gemini-embedding-001"
    monkeypatch.setenv("SPECSCRIBE_EMBEDDING_MODEL", "my-model")
    assert get_embedding_model() == "my-model"


@pytest.mark.asyncio
async def test_wrong_dimension_vector_is_discarded_not_padded(monkeypatch):
    monkeypatch.delenv("SPECSCRIBE_OFFLINE_EMBEDDINGS", raising=False)

    class _Models:
        async def embed_content(self, model, contents, config=None):
            return types_ns(embeddings=[types_ns(values=[0.1] * 768)])

    from google import genai

    monkeypatch.setattr(
        genai, "Client", lambda *a, **k: types_ns(aio=types_ns(models=_Models()))
    )
    assert await generate_text_embedding_async("x", api_key="k") is None
