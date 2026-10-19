"""
SpecScribe AR - Live Speaker Transcript Ingestion & Temporal Decision Linker (T-07)
Synthesizes decision rationales from recent transcript windows and generates pgvector embeddings.
"""

import asyncio
import hashlib
import json
import logging
import os
import uuid
from datetime import datetime, timezone
from typing import Any, Callable, Dict, List, Optional

from pydantic import BaseModel, Field

logger = logging.getLogger("specscribe.decision_linker")


class DecisionRationaleSchema(BaseModel):
    """Structured output schema for Gemini 2.5 Flash decision rationale synthesis."""
    decision_rationale: str = Field(
        description="1-2 sentences explaining WHY this architectural change was made and WHO proposed or agreed to it."
    )
    primary_speaker: Optional[str] = Field(
        default=None,
        description="The primary speaker who advocated for or proposed the decision."
    )
    architectural_intent: Optional[str] = Field(
        default=None,
        description="Core intent (e.g., latency, security, fault-tolerance, scalability)."
    )


def generate_deterministic_embedding(text: str, dim: int = 1536) -> List[float]:
    """
    Generates a deterministic, normalized 1536-dimensional mock embedding vector.
    Used for offline execution, unit tests, and CI/CD environments without Gemini API key.
    """
    digest = hashlib.sha256(text.encode("utf-8")).digest()
    vals: List[float] = []
    for i in range(dim):
        byte_val = digest[i % len(digest)]
        # Normalize to small centered float values [-0.01, +0.01]
        val = round(((byte_val / 255.0) * 0.02) - 0.01, 6)
        vals.append(val)
    return vals


def _normalize_embedding_dim(raw_vals: List[float], target_dim: int = 1536) -> List[float]:
    if len(raw_vals) == target_dim:
        return raw_vals
    if len(raw_vals) < target_dim:
        return raw_vals + [0.0] * (target_dim - len(raw_vals))
    return raw_vals[:target_dim]


def generate_text_embedding(
    text: str,
    api_key: Optional[str] = None,
    target_dim: int = 1536,
) -> List[float]:
    """
    Generates a vector embedding for the given text using Google GenAI embedding models.
    Guarantees an exact vector length matching target_dim (default: 1536 for pgvector schema).
    """
    key = api_key or os.environ.get("GEMINI_API_KEY")
    if not key:
        return generate_deterministic_embedding(text, dim=target_dim)

    try:
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=key)
        candidate_models = ["gemini-embedding-001", "text-embedding-004"]
        configured_model = os.environ.get("GEMINI_EMBED_MODEL")
        if configured_model and configured_model not in candidate_models:
            candidate_models.insert(0, configured_model)

        for model_name in candidate_models:
            try:
                response = client.models.embed_content(
                    model=model_name,
                    contents=text,
                    config=types.EmbedContentConfig(output_dimensionality=target_dim),
                )
                if response.embeddings and len(response.embeddings) > 0:
                    raw_vals = list(response.embeddings[0].values)
                    return _normalize_embedding_dim(raw_vals, target_dim)
            except Exception as m_err:
                logger.debug("Sync embedding model %s failed: %s; trying next", model_name, m_err)
    except Exception as e:
        logger.warning("Gemini text embedding API error: %s; falling back to deterministic vector", e)

    return generate_deterministic_embedding(text, dim=target_dim)


async def generate_text_embedding_async(
    text: str,
    api_key: Optional[str] = None,
    target_dim: int = 1536,
) -> List[float]:
    """
    Asynchronously generates a vector embedding for the given text using client.aio.
    Non-blocking to the FastAPI asyncio event loop (Fixes #1).
    """
    key = api_key or os.environ.get("GEMINI_API_KEY")
    if not key:
        return generate_deterministic_embedding(text, dim=target_dim)

    try:
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=key)
        candidate_models = ["gemini-embedding-001", "text-embedding-004"]
        configured_model = os.environ.get("GEMINI_EMBED_MODEL")
        if configured_model and configured_model not in candidate_models:
            candidate_models.insert(0, configured_model)

        for model_name in candidate_models:
            try:
                response = await client.aio.models.embed_content(
                    model=model_name,
                    contents=text,
                    config=types.EmbedContentConfig(output_dimensionality=target_dim),
                )
                if response.embeddings and len(response.embeddings) > 0:
                    raw_vals = list(response.embeddings[0].values)
                    return _normalize_embedding_dim(raw_vals, target_dim)
            except Exception as m_err:
                logger.debug("Async embedding model %s failed: %s; trying next", model_name, m_err)
    except Exception as e:
        logger.warning("Gemini async text embedding API error: %s; falling back to deterministic vector", e)

    return generate_deterministic_embedding(text, dim=target_dim)


async def generate_text_embeddings_batch_async(
    texts: List[str],
    api_key: Optional[str] = None,
    target_dim: int = 1536,
) -> List[List[float]]:
    """
    Asynchronously generates embeddings for a batch of texts in a single non-blocking round trip.
    Eliminates multi-second serial loops and prevents event loop blocking (Fixes #5).
    """
    if not texts:
        return []

    key = api_key or os.environ.get("GEMINI_API_KEY")
    if not key:
        return [generate_deterministic_embedding(t, dim=target_dim) for t in texts]

    try:
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=key)
        candidate_models = ["gemini-embedding-001", "text-embedding-004"]
        configured_model = os.environ.get("GEMINI_EMBED_MODEL")
        if configured_model and configured_model not in candidate_models:
            candidate_models.insert(0, configured_model)

        for model_name in candidate_models:
            try:
                response = await client.aio.models.embed_content(
                    model=model_name,
                    contents=texts,
                    config=types.EmbedContentConfig(output_dimensionality=target_dim),
                )
                if response.embeddings and len(response.embeddings) == len(texts):
                    return [
                        _normalize_embedding_dim(list(emb.values), target_dim)
                        for emb in response.embeddings
                    ]
            except Exception as m_err:
                logger.debug("Batch embedding model %s failed: %s; trying next", model_name, m_err)

        # Fallback to parallel asynchronous individual calls if batch API is rejected
        tasks = [generate_text_embedding_async(t, api_key=key, target_dim=target_dim) for t in texts]
        return list(await asyncio.gather(*tasks))
    except Exception as e:
        logger.warning("Gemini batch text embedding failed: %s; falling back to deterministic vectors", e)

    return [generate_deterministic_embedding(t, dim=target_dim) for t in texts]


class DecisionLinkerAgent:
    """
    Temporal Decision Linker (T-07).
    Watches live diagram snapshot creations, fetches the temporal window (last 45 seconds of speech),
    synthesizes a 1-2 sentence decision rationale via Gemini 2.5 Flash, updates snapshot records,
    and inserts a 1536-dimensional knowledge chunk for downstream RAG.
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        supabase_client: Any = None,
        memory_store: Optional[Dict[str, Any]] = None,
    ):
        self.api_key = api_key or os.environ.get("GEMINI_API_KEY")
        self.supabase_client = supabase_client
        self.memory_store = memory_store
        self._genai_client = None

        if self.api_key:
            try:
                from google import genai

                self._genai_client = genai.Client(api_key=self.api_key)
            except Exception as e:
                logger.warning("Could not initialize Google GenAI Client: %s", e)

    def fetch_recent_transcripts(
        self,
        meeting_id: str,
        timestamp_ms: int,
        window_ms: int = 45000,
    ) -> List[Dict[str, Any]]:
        """
        Retrieves transcript turns that occurred within the last window_ms (default: 45s = 45,000ms)
        relative to the snapshot timestamp.
        """
        all_turns: List[Dict[str, Any]] = []

        if self.memory_store and "transcript_turns" in self.memory_store:
            all_turns = list(self.memory_store["transcript_turns"].get(meeting_id, []))

        # If memory store is empty and supabase_client is connected, attempt DB query
        if not all_turns and self.supabase_client:
            try:
                res = (
                    self.supabase_client.table("transcript_turns")
                    .select("*")
                    .eq("meeting_id", meeting_id)
                    .order("timestamp_ms")
                    .execute()
                )
                if res.data:
                    all_turns = res.data
            except Exception as e:
                logger.warning("Supabase transcript lookup error: %s", e)

        if not all_turns:
            return []

        # Filter strictly within [timestamp_ms - window_ms, timestamp_ms]
        lower_bound = max(0, timestamp_ms - window_ms)
        matching = [
            t
            for t in all_turns
            if lower_bound <= t.get("timestamp_ms", 0) <= timestamp_ms
        ]

        # If strict window returned empty (e.g., minor clock skew), grab the latest turns up to timestamp_ms
        if not matching:
            prior_turns = [t for t in all_turns if t.get("timestamp_ms", 0) <= timestamp_ms]
            matching = prior_turns[-5:] if prior_turns else all_turns[-5:]

        return matching

    async def synthesize_rationale_async(
        self,
        meeting_id: str,
        diff_summary: str,
        recent_turns: List[Dict[str, Any]],
        drawio_xml: Optional[str] = None,
    ) -> str:
        """
        Asynchronously uses Gemini to synthesize a 1-2 sentence decision rationale explaining
        WHY the architectural change was made and WHO proposed it.
        Uses client.aio to prevent blocking the asyncio event loop (Fixes #1).
        """
        if self._genai_client:
            try:
                from google.genai import types

                turns_formatted = "\n".join([
                    f"- [{t.get('timestamp_ms', 0)}ms] {t.get('speaker_label', 'Speaker')}: {t.get('transcript_text', '')}"
                    for t in recent_turns
                ]) or "(No speech recorded in the 45s window)"

                prompt = (
                    "You are SpecScribe's Temporal Decision Linker Agent.\n"
                    "An architectural change was just committed to the live whiteboard diagram:\n"
                    f"Change Summary: {diff_summary}\n\n"
                    "Recent Transcript Context (last 45 seconds of conversation):\n"
                    f"{turns_formatted}\n\n"
                    "Task: Synthesize a concise 1-2 sentence decision rationale explaining:\n"
                    "1. WHY this specific architectural change was made.\n"
                    "2. WHO proposed, advocated for, or agreed to it.\n"
                    "Ensure your output strictly conforms to the JSON schema."
                )

                candidate_models = ["gemini-3.8-flash", "gemini-2.5-flash"]
                configured_model = os.environ.get("GEMINI_MODEL")
                if configured_model and configured_model not in candidate_models:
                    candidate_models.insert(0, configured_model)

                response = None
                for model_name in candidate_models:
                    try:
                        response = await self._genai_client.aio.models.generate_content(
                            model=model_name,
                            contents=[prompt],
                            config=types.GenerateContentConfig(
                                response_mime_type="application/json",
                                response_schema=DecisionRationaleSchema,
                            ),
                        )
                        if response:
                            break
                    except Exception as m_err:
                        logger.debug("Async rationale model %s failed: %s; trying next", model_name, m_err)

                if response and response.text:
                    parsed = json.loads(response.text)
                    rationale = parsed.get("decision_rationale")
                    if rationale and rationale.strip():
                        return rationale.strip()
            except Exception as e:
                logger.warning("Gemini async rationale synthesis failed: %s; using heuristic fallback", e)

        return self._heuristic_rationale_fallback(diff_summary, recent_turns)

    def _heuristic_rationale_fallback(self, diff_summary: str, recent_turns: List[Dict[str, Any]]) -> str:
        if not recent_turns:
            return f"Architectural change '{diff_summary}' applied to diagram."

        speakers = []
        for t in recent_turns:
            spk = t.get("speaker_label", "Speaker")
            if spk not in speakers:
                speakers.append(spk)

        primary_speaker = speakers[-1] if speakers else "Team"
        other_speakers = [s for s in speakers if s != primary_speaker]

        if other_speakers:
            return (
                f"{primary_speaker} applied '{diff_summary}' following discussion with "
                f"{', '.join(other_speakers)} to support system requirements."
            )
        return f"{primary_speaker} introduced '{diff_summary}' to optimize architecture flow."

    def synthesize_rationale(
        self,
        meeting_id: str,
        diff_summary: str,
        recent_turns: List[Dict[str, Any]],
        drawio_xml: Optional[str] = None,
    ) -> str:
        """Synchronous wrapper for offline testing or blocking execution contexts."""
        if self._genai_client:
            try:
                from google.genai import types

                turns_formatted = "\n".join([
                    f"- [{t.get('timestamp_ms', 0)}ms] {t.get('speaker_label', 'Speaker')}: {t.get('transcript_text', '')}"
                    for t in recent_turns
                ]) or "(No speech recorded in the 45s window)"

                prompt = (
                    "You are SpecScribe's Temporal Decision Linker Agent.\n"
                    "An architectural change was just committed to the live whiteboard diagram:\n"
                    f"Change Summary: {diff_summary}\n\n"
                    "Recent Transcript Context (last 45 seconds of conversation):\n"
                    f"{turns_formatted}\n\n"
                    "Task: Synthesize a concise 1-2 sentence decision rationale explaining:\n"
                    "1. WHY this specific architectural change was made.\n"
                    "2. WHO proposed, advocated for, or agreed to it.\n"
                    "Ensure your output strictly conforms to the JSON schema."
                )

                candidate_models = ["gemini-3.8-flash", "gemini-2.5-flash"]
                configured_model = os.environ.get("GEMINI_MODEL")
                if configured_model and configured_model not in candidate_models:
                    candidate_models.insert(0, configured_model)

                for model_name in candidate_models:
                    try:
                        response = self._genai_client.models.generate_content(
                            model=model_name,
                            contents=[prompt],
                            config=types.GenerateContentConfig(
                                response_mime_type="application/json",
                                response_schema=DecisionRationaleSchema,
                            ),
                        )
                        if response and response.text:
                            parsed = json.loads(response.text)
                            rationale = parsed.get("decision_rationale")
                            if rationale and rationale.strip():
                                return rationale.strip()
                    except Exception as m_err:
                        logger.debug("Sync rationale model %s failed: %s; trying next", model_name, m_err)
            except Exception as e:
                logger.warning("Gemini sync rationale synthesis failed: %s; using heuristic fallback", e)

        return self._heuristic_rationale_fallback(diff_summary, recent_turns)

    async def process_snapshot(
        self,
        meeting_id: str,
        snapshot_id: str,
        timestamp_ms: int,
        diff_summary: str,
        drawio_xml: Optional[str] = None,
        broadcast_fn: Optional[Callable[[str, Dict[str, Any]], Any]] = None,
    ) -> Dict[str, Any]:
        """
        Asynchronously links the snapshot to recent transcript turns:
        1. Fetches turns from the last 45s.
        2. Synthesizes a 1-2 sentence decision rationale (non-blocking).
        3. Updates diagram_snapshots.decision_rationale in memory store and Supabase.
        4. Generates 1536-dim embedding asynchronously and inserts into knowledge_chunks.
        5. Optionally broadcasts DECISION_LOGGED event to connected WebSockets.
        """
        recent_turns = self.fetch_recent_transcripts(meeting_id, timestamp_ms, window_ms=45000)
        rationale = await self.synthesize_rationale_async(meeting_id, diff_summary, recent_turns, drawio_xml)

        logger.info(
            "Synthesized decision rationale for snapshot %s: %s",
            snapshot_id,
            rationale,
        )

        # 1. Update in memory store
        if self.memory_store and "diagram_snapshots" in self.memory_store:
            for snap in self.memory_store["diagram_snapshots"].get(meeting_id, []):
                if snap.get("id") == snapshot_id:
                    snap["decision_rationale"] = rationale
                    break

        # 2. Update in Supabase
        if self.supabase_client:
            try:
                await asyncio.to_thread(
                    lambda: self.supabase_client.table("diagram_snapshots")
                    .update({"decision_rationale": rationale})
                    .eq("id", snapshot_id)
                    .execute()
                )
            except Exception as e:
                logger.warning("Failed to update snapshot in Supabase: %s", e)

        # 3. Generate 1536-dim embedding asynchronously (Fixes #1)
        chunk_content = f"Decision at {timestamp_ms}ms: {diff_summary}. Rationale: {rationale}"
        embedding_vec = await generate_text_embedding_async(
            chunk_content,
            api_key=self.api_key,
            target_dim=1536,
        )

        # 4. Insert into knowledge_chunks
        chunk_id = str(uuid.uuid4())
        chunk_record = {
            "id": chunk_id,
            "meeting_id": meeting_id,
            "chunk_type": "DECISION",
            "timestamp_ms": timestamp_ms,
            "content": chunk_content,
            "embedding": embedding_vec,
        }

        if self.memory_store and "knowledge_chunks" in self.memory_store:
            self.memory_store["knowledge_chunks"][meeting_id].append(chunk_record)

        if self.supabase_client:
            try:
                await asyncio.to_thread(
                    lambda: self.supabase_client.table("knowledge_chunks")
                    .insert(chunk_record)
                    .execute()
                )
            except Exception as e:
                logger.warning("Failed to insert knowledge_chunk in Supabase: %s", e)

        # 5. Broadcast DECISION_LOGGED event if callback provided
        if broadcast_fn:
            payload = {
                "event": "DECISION_LOGGED",
                "snapshot_id": snapshot_id,
                "meeting_id": meeting_id,
                "timestamp_ms": timestamp_ms,
                "diff_summary": diff_summary,
                "decision_rationale": rationale,
                "chunk_id": chunk_id,
            }
            try:
                res = broadcast_fn(meeting_id, payload)
                if asyncio.iscoroutine(res):
                    await res
            except Exception as e:
                logger.warning("Failed to broadcast DECISION_LOGGED: %s", e)

        return {
            "snapshot_id": snapshot_id,
            "meeting_id": meeting_id,
            "decision_rationale": rationale,
            "chunk_id": chunk_id,
            "turns_considered": len(recent_turns),
        }
