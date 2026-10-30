"""
SpecScribe AR - Live Speaker Transcript Ingestion & Temporal Decision Linker (T-07)
Synthesizes decision rationales from recent transcript windows and generates pgvector embeddings.
"""

import asyncio
import hashlib
import json
import logging
import os
import re
import uuid
from datetime import datetime, timezone
from typing import Any, Callable, Dict, List, Literal, Optional

from pydantic import BaseModel, Field

import llm

logger = logging.getLogger("specscribe.decision_linker")


REQUIREMENT_INTENT_PATTERN = re.compile(
    r"\b(?:"
    r"need|needs|needed|must|should|shall|require|requires|required|requirement|requirements|"
    r"decide|decided|decision|agree|agreed|propose|proposed|architect|architecture|design|"
    r"service|microservice|database|db|cache|caching|redis|postgres|postgresql|mysql|mongo|dynamodb|"
    r"kafka|queue|broker|pubsub|sqs|gateway|api|rest|graphql|grpc|websocket|webhook|endpoint|"
    r"auth|authn|authz|authentication|authorization|jwt|oauth|token|tokens|tls|mtls|encrypt|encryption|"
    r"latency|throughput|scalability|scalable|scale|replica|replicas|failover|cluster|storage|bucket|"
    r"worker|rate[- ]?limit|sla|slo|p99|p95|load[- ]?balancer|ingress|cdn|firewall|vpc"
    r")\b",
    re.IGNORECASE,
)

DECISION_CUE_PATTERN = re.compile(
    r"\b(?:agreed|decide|decided|decision|let's use|lets use|we will use|we'll use|going with|settled on|choose|chosen)\b",
    re.IGNORECASE,
)


def has_requirement_intent(text: str) -> bool:
    """Returns True when a spoken utterance contains substantive requirement or architectural intent."""
    if not text:
        return False
    words = text.strip().split()
    if len(words) < 5:
        return False
    return bool(REQUIREMENT_INTENT_PATTERN.search(text))


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


class TranscriptRequirementSchema(BaseModel):
    """Structured output schema for continuous real-time requirement and decision extraction from speech."""
    has_requirement: bool = Field(
        description="True if the dialogue contains a substantive functional/non-functional requirement or architectural decision; False for casual chatter."
    )
    chunk_type: Literal["REQUIREMENT", "DECISION"] = Field(
        default="REQUIREMENT",
        description="'DECISION' if an explicit architectural choice was agreed upon, or 'REQUIREMENT' for a system requirement."
    )
    summary: str = Field(
        default="",
        description="Concise 1-sentence summary of the requirement or decision (max 120 chars)."
    )
    rationale: str = Field(
        default="",
        description="1-2 sentences explaining the requirement context, why the decision was made, and who proposed it."
    )
    speaker: Optional[str] = Field(
        default=None,
        description="Primary speaker who articulated the requirement or decision."
    )
    suggested_node_label: Optional[str] = Field(
        default=None,
        description="Optional graph node label suggested by the requirement (e.g., 'Redis Cache', 'Auth Service')."
    )
    suggested_node_type: Optional[str] = Field(
        default=None,
        description="Optional node type ('service', 'database', 'decision', 'terminal') if a graph node is suggested."
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


DEFAULT_EMBEDDING_MODEL = "gemini-embedding-001"
OFFLINE_EMBEDDING_MODEL = "offline-deterministic"


def get_embedding_model() -> str:
    """Returns the single pinned embedding model name (env SPECSCRIBE_EMBEDDING_MODEL)."""
    if offline_embeddings_enabled():
        return OFFLINE_EMBEDDING_MODEL
    return os.environ.get("SPECSCRIBE_EMBEDDING_MODEL") or DEFAULT_EMBEDDING_MODEL


def offline_embeddings_enabled() -> bool:
    """Deterministic (non-semantic) vectors are allowed only when SPECSCRIBE_OFFLINE_EMBEDDINGS=1."""
    return os.environ.get("SPECSCRIBE_OFFLINE_EMBEDDINGS") == "1"


def _extract_vector(emb: Any, target_dim: int) -> Optional[List[float]]:
    """Returns the raw vector only if it matches target_dim exactly; never pads or truncates."""
    vals = list(emb.values) if emb is not None and getattr(emb, "values", None) is not None else []
    if len(vals) != target_dim:
        logger.warning(
            "Embedding dimension mismatch (got %d, expected %d); discarding vector", len(vals), target_dim
        )
        return None
    return vals


def generate_text_embedding(
    text: str,
    api_key: Optional[str] = None,
    target_dim: int = 1536,
) -> Optional[List[float]]:
    """
    Generates a vector embedding with the pinned model. Returns None on any failure
    (no fabricated vectors). Deterministic vectors only when SPECSCRIBE_OFFLINE_EMBEDDINGS=1.
    """
    if offline_embeddings_enabled():
        return generate_deterministic_embedding(text, dim=target_dim)

    key = api_key or os.environ.get("GEMINI_API_KEY")
    if not key:
        logger.warning("No GEMINI_API_KEY; skipping embedding")
        return None

    try:
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=key)
        response = client.models.embed_content(
            model=get_embedding_model(),
            contents=text,
            config=types.EmbedContentConfig(output_dimensionality=target_dim),
        )
        if response.embeddings:
            return _extract_vector(response.embeddings[0], target_dim)
        logger.warning("Embedding response contained no embeddings")
    except Exception as e:
        logger.warning("Gemini text embedding failed: %s; skipping embedding", e)
    return None


async def generate_text_embedding_async(
    text: str,
    api_key: Optional[str] = None,
    target_dim: int = 1536,
) -> Optional[List[float]]:
    """
    Asynchronously generates an embedding with the pinned model via client.aio.
    Returns None on any failure; deterministic vectors only when SPECSCRIBE_OFFLINE_EMBEDDINGS=1.
    """
    if offline_embeddings_enabled():
        return generate_deterministic_embedding(text, dim=target_dim)

    key = api_key or os.environ.get("GEMINI_API_KEY")
    if not key:
        logger.warning("No GEMINI_API_KEY; skipping embedding")
        return None

    try:
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=key)
        response = await client.aio.models.embed_content(
            model=get_embedding_model(),
            contents=text,
            config=types.EmbedContentConfig(output_dimensionality=target_dim),
        )
        if response.embeddings:
            return _extract_vector(response.embeddings[0], target_dim)
        logger.warning("Embedding response contained no embeddings")
    except Exception as e:
        logger.warning("Gemini async text embedding failed: %s; skipping embedding", e)
    return None


async def generate_text_embeddings_batch_async(
    texts: List[str],
    api_key: Optional[str] = None,
    target_dim: int = 1536,
) -> List[Optional[List[float]]]:
    """
    Asynchronously embeds a batch of texts in one round trip with the pinned model.
    Returns a list aligned with texts; entries are None on failure (callers must skip them).
    """
    if not texts:
        return []

    if offline_embeddings_enabled():
        return [generate_deterministic_embedding(t, dim=target_dim) for t in texts]

    key = api_key or os.environ.get("GEMINI_API_KEY")
    if not key:
        logger.warning("No GEMINI_API_KEY; skipping batch embedding")
        return [None] * len(texts)

    try:
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=key)
        response = await client.aio.models.embed_content(
            model=get_embedding_model(),
            contents=texts,
            config=types.EmbedContentConfig(output_dimensionality=target_dim),
        )
        if response.embeddings and len(response.embeddings) == len(texts):
            return [_extract_vector(emb, target_dim) for emb in response.embeddings]
        logger.warning("Batch embedding response size mismatch; skipping batch")
    except Exception as e:
        logger.warning("Gemini batch text embedding failed: %s; skipping embeddings", e)
    return [None] * len(texts)


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
        self.api_key = api_key if api_key is not None else os.environ.get("GEMINI_API_KEY")
        self.supabase_client = supabase_client
        self.memory_store = memory_store

    async def fetch_recent_transcripts(
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
                res = await asyncio.to_thread(
                    lambda: self.supabase_client.table("transcript_turns")
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
        Uses the shared async llm helper to prevent blocking the asyncio event loop (Fixes #1).
        """
        if self.api_key:
            try:
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

                text = await llm.generate_structured(prompt, schema=DecisionRationaleSchema, api_key=self.api_key)
                if text:
                    parsed = json.loads(text)
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
        recent_turns = await self.fetch_recent_transcripts(meeting_id, timestamp_ms, window_ms=45000)
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

        # 4. Insert into knowledge_chunks (skipped entirely if embedding failed: no fabricated vectors)
        chunk_id: Optional[str] = None
        if embedding_vec is None:
            logger.warning(
                "Embedding failed for snapshot %s; skipping knowledge_chunk persistence", snapshot_id
            )
        else:
            chunk_id = str(uuid.uuid4())
            chunk_record = {
                "id": chunk_id,
                "meeting_id": meeting_id,
                "chunk_type": "DECISION",
                "timestamp_ms": timestamp_ms,
                "content": chunk_content,
                "embedding": embedding_vec,
                "embedding_model": get_embedding_model(),
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

    def _infer_suggested_node(self, text: str) -> Optional[Dict[str, str]]:
        """Extracts an optional graph node suggestion from spoken requirement text."""
        lower = text.lower()
        candidates = [
            ("redis", "Redis Cache", "database"),
            ("postgres", "PostgreSQL", "database"),
            ("kafka", "Kafka Broker", "database"),
            ("dynamodb", "DynamoDB", "database"),
            ("mongo", "MongoDB", "database"),
            ("database", "Primary Database", "database"),
            ("auth", "Auth Service", "service"),
            ("gateway", "API Gateway", "service"),
            ("worker", "Worker Service", "service"),
            ("webhook", "Webhook Service", "service"),
            ("rate limit", "Rate Limiter", "decision"),
            ("load balancer", "Load Balancer", "service"),
        ]
        for keyword, label, node_type in candidates:
            if keyword in lower:
                return {"label": label, "node_type": node_type}
        return None

    def _heuristic_transcript_window_fallback(
        self,
        substantive_turns: List[Dict[str, Any]],
    ) -> Optional[Dict[str, Any]]:
        """Heuristic requirement/decision extractor for offline or fallback execution."""
        intent_turns = [
            t for t in substantive_turns if has_requirement_intent(t.get("transcript_text", ""))
        ]
        if not intent_turns:
            return None

        combined_text = " ".join(t.get("transcript_text", "").strip() for t in intent_turns)
        chunk_type = "DECISION" if DECISION_CUE_PATTERN.search(combined_text) else "REQUIREMENT"

        target_turn = intent_turns[-1]
        speaker = (
            target_turn.get("speaker_label")
            or target_turn.get("speaker")
            or "Speaker 0 (Wearer)"
        )
        raw_summary = target_turn.get("transcript_text", "").strip()
        summary = raw_summary if len(raw_summary) <= 120 else raw_summary[:117] + "..."

        speakers: List[str] = []
        for t in substantive_turns:
            spk = t.get("speaker_label") or t.get("speaker") or "Speaker"
            if spk not in speakers:
                speakers.append(spk)
        other_speakers = [s for s in speakers if s != speaker]

        if other_speakers:
            rationale = (
                f"{speaker} articulated {chunk_type.lower()} in discussion with "
                f"{', '.join(other_speakers)}: {summary}"
            )
        else:
            rationale = f"{speaker} specified {chunk_type.lower()}: {summary}"

        suggested_node = self._infer_suggested_node(combined_text)
        return {
            "has_requirement": True,
            "chunk_type": chunk_type,
            "summary": summary,
            "speaker": speaker,
            "rationale": rationale,
            "suggested_node": suggested_node,
        }

    async def process_transcript_window(
        self,
        meeting_id: str,
        turns: Optional[List[Dict[str, Any]]] = None,
        current_xml: str = "",
        *,
        recent_turns: Optional[List[Dict[str, Any]]] = None,
        timestamp_ms: Optional[int] = None,
        broadcast_fn: Optional[Callable[[str, Dict[str, Any]], Any]] = None,
    ) -> Optional[Dict[str, Any]]:
        """
        Reasons over a rolling window of spoken transcript turns (even without a whiteboard snapshot)
        to extract structured REQUIREMENT and DECISION chunks with speaker attribution and optional
        graph node suggestions.
        """
        active_turns = turns if turns is not None else recent_turns
        if active_turns is None:
            if self.memory_store and "transcript_turns" in self.memory_store:
                active_turns = list(self.memory_store["transcript_turns"].get(meeting_id, []))[-6:]
            else:
                active_turns = []

        substantive_turns = [
            t
            for t in active_turns
            if isinstance(t, dict) and len((t.get("transcript_text") or "").strip().split()) >= 5
        ]
        if not substantive_turns:
            return None

        extracted: Optional[Dict[str, Any]] = None
        if self.api_key:
            try:
                turns_formatted = "\n".join([
                    f"- [{t.get('timestamp_ms', 0)}ms] {t.get('speaker_label') or t.get('speaker') or 'Speaker'}: {t.get('transcript_text', '')}"
                    for t in substantive_turns
                ])
                prompt = (
                    "You are SpecScribe's Real-Time Requirement & Decision Synthesis Agent.\n"
                    "Analyze the rolling window of spoken meeting transcript turns and the current architecture diagram XML.\n"
                    "Determine whether the participants articulated any substantive functional/non-functional requirement "
                    "or architectural decision.\n\n"
                    f"Current Architecture XML:\n{current_xml or '(Empty diagram)'}\n\n"
                    f"Recent Spoken Transcript Turns:\n{turns_formatted}\n\n"
                    "Instructions:\n"
                    "1. If the turns are only casual chatter, greetings, or filler without architectural or system requirements, "
                    "set has_requirement=false.\n"
                    "2. If a requirement or decision is present, set has_requirement=true, choose chunk_type ('REQUIREMENT' or 'DECISION'), "
                    "provide a concise summary, a 1-2 sentence rationale, the primary speaker label, and optional suggested graph node."
                )
                text = await llm.generate_structured(
                    prompt,
                    schema=TranscriptRequirementSchema,
                    api_key=self.api_key,
                )
                if text:
                    parsed = json.loads(text)
                    if isinstance(parsed, dict):
                        if parsed.get("has_requirement") is False:
                            return None
                        raw_type = str(parsed.get("chunk_type") or parsed.get("source_type") or "REQUIREMENT").upper()
                        chunk_type = "DECISION" if raw_type == "DECISION" else "REQUIREMENT"
                        summary = (parsed.get("summary") or parsed.get("diff_summary") or "").strip()
                        rationale = (parsed.get("rationale") or parsed.get("decision_rationale") or summary).strip()
                        speaker = (
                            parsed.get("speaker")
                            or parsed.get("primary_speaker")
                            or substantive_turns[-1].get("speaker_label")
                            or "Speaker 0 (Wearer)"
                        )
                        node_label = parsed.get("suggested_node_label")
                        node_type = parsed.get("suggested_node_type") or "service"
                        suggested_node = (
                            parsed.get("suggested_node")
                            if isinstance(parsed.get("suggested_node"), dict)
                            else ({"label": node_label, "node_type": node_type} if node_label else None)
                        )
                        if summary or rationale:
                            extracted = {
                                "has_requirement": True,
                                "chunk_type": chunk_type,
                                "summary": summary or rationale,
                                "speaker": speaker,
                                "rationale": rationale or summary,
                                "suggested_node": suggested_node,
                            }
            except Exception as e:
                logger.warning("Gemini transcript window synthesis failed: %s; using heuristic fallback", e)

        if extracted is None:
            extracted = self._heuristic_transcript_window_fallback(substantive_turns)

        if not extracted or not extracted.get("has_requirement", True):
            return None

        chunk_type = extracted["chunk_type"]
        summary = extracted["summary"]
        speaker = extracted["speaker"]
        rationale = extracted["rationale"]
        suggested_node = extracted.get("suggested_node")
        latest_ts = (
            timestamp_ms
            if timestamp_ms is not None
            else max((int(t.get("timestamp_ms", 0) or 0) for t in substantive_turns), default=0)
        )

        chunk_content = f"{chunk_type} at {latest_ts}ms ({speaker}): {summary}. Rationale: {rationale}"
        embedding_vec = await generate_text_embedding_async(
            chunk_content,
            api_key=self.api_key,
            target_dim=1536,
        )

        chunk_id: Optional[str] = None
        if embedding_vec is None:
            logger.warning(
                "Embedding failed for transcript window in meeting %s; skipping knowledge_chunk persistence",
                meeting_id,
            )
        else:
            chunk_id = str(uuid.uuid4())
            db_record = {
                "id": chunk_id,
                "meeting_id": meeting_id,
                "chunk_type": chunk_type,
                "timestamp_ms": latest_ts,
                "content": chunk_content,
                "embedding": embedding_vec,
                "embedding_model": get_embedding_model(),
            }
            mem_record = {
                **db_record,
                "source_type": chunk_type,
                "summary": summary,
                "speaker": speaker,
                "rationale": rationale,
                "suggested_node": suggested_node,
            }

            if self.memory_store is not None and "knowledge_chunks" in self.memory_store:
                chunks_store = self.memory_store["knowledge_chunks"]
                if isinstance(chunks_store, dict):
                    chunks_store.setdefault(meeting_id, []).append(mem_record)

            if self.supabase_client:
                try:
                    await asyncio.to_thread(
                        lambda: self.supabase_client.table("knowledge_chunks")
                        .insert(db_record)
                        .execute()
                    )
                except Exception as e:
                    logger.warning("Failed to insert transcript knowledge_chunk in Supabase: %s", e)

        result = {
            "id": chunk_id,
            "chunk_id": chunk_id,
            "meeting_id": meeting_id,
            "timestamp_ms": latest_ts,
            "has_requirement": True,
            "chunk_type": chunk_type,
            "source_type": chunk_type,
            "summary": summary,
            "diff_summary": summary,
            "speaker": speaker,
            "speaker_label": speaker,
            "rationale": rationale,
            "decision_rationale": rationale,
            "suggested_node": suggested_node,
        }

        if broadcast_fn:
            for event_name in ("REQUIREMENT_SYNTHESIZED", "DECISION_LOGGED"):
                payload = {
                    "event": event_name,
                    "type": event_name,
                    "snapshot_id": chunk_id,
                    "chunk_id": chunk_id,
                    "meeting_id": meeting_id,
                    "timestamp_ms": latest_ts,
                    "chunk_type": chunk_type,
                    "source_type": chunk_type,
                    "summary": summary,
                    "diff_summary": summary,
                    "rationale": rationale,
                    "decision_rationale": rationale,
                    "speaker": speaker,
                    "speaker_label": speaker,
                    "suggested_node": suggested_node,
                }
                try:
                    res = broadcast_fn(meeting_id, payload)
                    if asyncio.iscoroutine(res):
                        await res
                except Exception as e:
                    logger.warning("Failed to broadcast %s: %s", event_name, e)

        return result
