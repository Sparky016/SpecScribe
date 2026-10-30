"""
SpecScribe AR - 'Raising-Hand' Proactive Critique & Research Sub-Agent (T-08)
Supports Mode A (Proactive Push every 20s/diagram change) and Mode B (On-Demand Research Pull via pinchCommand).
"""

import asyncio
import base64
import inspect
import json
import logging
import os
import re
import time
import uuid
from datetime import datetime, timezone
from typing import Any, Callable, Dict, List, Literal, Optional, Set

from pydantic import BaseModel, Field

import llm

logger = logging.getLogger("specscribe.raising_hand")

# Maximum raw TTS audio size (64 KB) to keep HAND_RAISED JSON payloads fast on Spectacles
MAX_TTS_AUDIO_BYTES = 64 * 1024
MAX_SPOKEN_SUMMARY_CHARS = 220


class _AwaitableTurnList(list):
    """List of transcript turns that can be consumed synchronously or awaited in async contexts."""

    def __await__(self):
        async def _coro():
            return list(self)

        return _coro().__await__()


class RaisingHandEvaluation(BaseModel):
    """Structured output schema for Gemini 2.5 Flash proactive evaluation and research answers."""
    trigger: bool = Field(
        description="True if an architectural intervention is warranted, False otherwise."
    )
    category: Literal["VULNERABILITY", "LOGIC_FLAW", "ALTERNATIVE_IDEA", "RESEARCH"] = Field(
        description="The intervention classification category."
    )
    short_title: str = Field(
        description="Ultra-concise badge title for AR waveguide pill display. Maximum 28 characters. e.g. '🚩 Auth Token Leak Risk'."
    )
    detailed_body: str = Field(
        description="Actionable 2-3 bullet point technical critique, trade-offs, and mitigation instructions."
    )
    spoken_summary: Optional[str] = Field(
        default=None,
        description="Concise 1-2 sentence spoken summary (<15s) for AgentVoicePlayer TTS readout.",
    )
    audio_b64: Optional[str] = Field(
        default=None,
        description="Optional base64-encoded TTS audio clip (<64KB) for AgentVoicePlayer playback.",
    )


class RaisingHandAgent:
    """
    Raising-Hand Proactive Critique & Research Sub-Agent (T-08).
    - Mode A (Proactive Push): Evaluates recent transcript + diagram XML periodically (every 20s)
      or upon diagram mutation to catch critical vulnerabilities or logic flaws.
    - Mode B (On-Demand Research Pull): Triggered immediately when wearer pinches the AI Teammate Orb
      with action == 'ASK_AGENT'.
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        supabase_client: Any = None,
        memory_store: Optional[Dict[str, Any]] = None,
        deepgram_api_key: Optional[str] = None,
        deepgram_client: Optional[Any] = None,
    ):
        self.api_key = api_key if api_key is not None else os.environ.get("GEMINI_API_KEY")
        self.supabase_client = supabase_client
        self.memory_store = memory_store
        self._explicit_deepgram_api_key = deepgram_api_key
        self._deepgram_client = deepgram_client

        # Tracking per meeting: meeting_id -> Set of triggered short_titles (to avoid duplicates)
        self._history: Dict[str, Set[str]] = {}
        # Active background tasks: meeting_id -> asyncio.Task
        self._active_loops: Dict[str, asyncio.Task] = {}
        # Structured health telemetry: meeting_id -> telemetry dict
        self._loop_telemetry: Dict[str, Dict[str, Any]] = {}

    @property
    def deepgram_api_key(self) -> Optional[str]:
        if self._explicit_deepgram_api_key is not None:
            return self._explicit_deepgram_api_key or None
        if self.api_key == "":
            return None
        return os.environ.get("DEEPGRAM_API_KEY") or None

    def _get_deepgram_client(self) -> Optional[Any]:
        if self._deepgram_client is not None:
            return self._deepgram_client
        key = self.deepgram_api_key
        if not key:
            return None
        try:
            from deepgram import DeepgramClient

            return DeepgramClient(api_key=key)
        except Exception as e:
            logger.warning("Failed to initialize DeepgramClient for TTS: %s", e)
            return None

    def _build_spoken_summary(
        self,
        short_title: str,
        detailed_body: str,
        max_chars: int = MAX_SPOKEN_SUMMARY_CHARS,
    ) -> str:
        """Builds a concise (<15s) plain-text spoken summary from the pill title and bullet points."""
        clean_title = re.sub(r"^[^\w\s]+\s*", "", (short_title or "").strip()).rstrip("….")
        lines = []
        for raw_line in (detailed_body or "").splitlines():
            stripped = re.sub(r"^[\s•\-\*]+", "", raw_line).strip()
            if stripped:
                lines.append(stripped.rstrip(".") + ".")
        body_text = " ".join(lines)
        combined = f"{clean_title}: {body_text}".strip() if clean_title and body_text else (clean_title or body_text)
        if len(combined) <= max_chars:
            return combined
        return combined[: max_chars - 1].rstrip() + "…"

    def _extract_audio_bytes(self, response: Any) -> bytes:
        """Normalizes a Deepgram Aura TTS response (bytes, iterator of chunks, or stream object) into raw bytes."""
        if response is None:
            return b""
        if isinstance(response, (bytes, bytearray)):
            return bytes(response)
        if isinstance(response, str):
            try:
                return base64.b64decode(response)
            except Exception:
                return response.encode("utf-8")
        for attr in ("audio", "content", "stream"):
            val = getattr(response, attr, None)
            if val is not None and val is not response:
                return self._extract_audio_bytes(val)
        if hasattr(response, "read") and callable(response.read):
            data = response.read()
            return bytes(data) if isinstance(data, (bytes, bytearray)) else b""
        if hasattr(response, "__iter__"):
            chunks: List[bytes] = []
            total = 0
            for chunk in response:
                if isinstance(chunk, (bytes, bytearray)):
                    b = bytes(chunk)
                elif isinstance(chunk, str):
                    b = chunk.encode("utf-8")
                else:
                    continue
                chunks.append(b)
                total += len(b)
                if total >= MAX_TTS_AUDIO_BYTES:
                    break
            return b"".join(chunks)
        return b""

    def synthesize_critique_tts(
        self,
        text: str,
        model: str = "aura-asteria-en",
    ) -> Optional[str]:
        """
        Synchronously synthesizes a short spoken critique via Deepgram Aura TTS when available.
        Returns a base64-encoded audio string (<64KB raw) or None if TTS is unconfigured/unavailable.
        """
        clean_text = (text or "").strip()
        if not clean_text:
            return None
        if len(clean_text) > MAX_SPOKEN_SUMMARY_CHARS:
            clean_text = clean_text[:MAX_SPOKEN_SUMMARY_CHARS]

        client = self._get_deepgram_client()
        if client is None:
            return None

        try:
            speak = getattr(client, "speak", None)
            v1 = getattr(speak, "v1", None) if speak is not None else None
            audio = getattr(v1, "audio", None) if v1 is not None else None
            if audio is not None and hasattr(audio, "generate"):
                raw_resp = audio.generate(text=clean_text, model=model)
            elif hasattr(client, "synthesize"):
                raw_resp = client.synthesize(text=clean_text, model=model)
            elif hasattr(client, "generate"):
                raw_resp = client.generate(text=clean_text, model=model)
            else:
                return None

            raw_bytes = self._extract_audio_bytes(raw_resp)
            if not raw_bytes:
                return None
            if len(raw_bytes) > MAX_TTS_AUDIO_BYTES:
                raw_bytes = raw_bytes[:MAX_TTS_AUDIO_BYTES]
            return base64.b64encode(raw_bytes).decode("ascii")
        except Exception as e:
            logger.warning("Deepgram Aura TTS synthesis failed; falling back to notification chime: %s", e)
            return None

    async def synthesize_critique_tts_async(
        self,
        text: str,
        model: str = "aura-asteria-en",
    ) -> Optional[str]:
        """Asynchronous wrapper for Deepgram Aura TTS critique synthesis."""
        if self._deepgram_client is None and not self.deepgram_api_key:
            return None
        return await asyncio.to_thread(self.synthesize_critique_tts, text, model)

    synthesize_tts_async = synthesize_critique_tts_async

    def _truncate_title(self, title: str, max_chars: int = 28) -> str:
        """Enforces strict character limit for Snap Spectacles AR waveguide pill display."""
        clean = title.strip().replace("\n", " ")
        if len(clean) <= max_chars:
            return clean
        return clean[: max_chars - 1] + "…"

    def _get_recent_context(
        self,
        meeting_id: str,
        timestamp_ms: int,
        window_ms: int = 60000,
    ) -> List[Dict[str, Any]]:
        """
        Retrieves recent transcript turns for evaluation within the last window_ms (default: 60s).
        Falls back to Supabase transcript_turns when memory_store["transcript_turns"] is empty
        (e.g., after a backend restart), matching DecisionLinkerAgent.
        """
        all_turns: List[Dict[str, Any]] = []
        if self.memory_store and "transcript_turns" in self.memory_store:
            all_turns = list(self.memory_store["transcript_turns"].get(meeting_id, []))

        if not all_turns and self.supabase_client:
            try:
                res = (
                    self.supabase_client.table("transcript_turns")
                    .select("*")
                    .eq("meeting_id", meeting_id)
                    .order("timestamp_ms")
                    .execute()
                )
                if res and getattr(res, "data", None):
                    all_turns = list(res.data)
            except Exception as e:
                logger.warning("Supabase transcript lookup error in RaisingHandAgent: %s", e)

        if not all_turns:
            return _AwaitableTurnList()

        lower = max(0, timestamp_ms - window_ms)
        turns = [t for t in all_turns if lower <= t.get("timestamp_ms", 0) <= timestamp_ms]
        if not turns:
            prior_turns = [t for t in all_turns if t.get("timestamp_ms", 0) <= timestamp_ms]
            turns = prior_turns[-5:] if prior_turns else all_turns[-5:]
        return _AwaitableTurnList(turns)

    async def _resolve_recent_context_async(
        self,
        meeting_id: str,
        timestamp_ms: int,
        window_ms: int = 60000,
    ) -> List[Dict[str, Any]]:
        """Resolves _get_recent_context off the event loop when Supabase fallback is needed."""
        has_mem = bool(
            self.memory_store
            and "transcript_turns" in self.memory_store
            and self.memory_store["transcript_turns"].get(meeting_id)
        )
        if not has_mem and self.supabase_client:
            res = await asyncio.to_thread(self._get_recent_context, meeting_id, timestamp_ms, window_ms)
        else:
            res = self._get_recent_context(meeting_id, timestamp_ms, window_ms=window_ms)
        if not isinstance(res, list) and inspect.isawaitable(res):
            return list(await res)
        return list(res)

    def _evaluate_heuristic_proactive(
        self,
        meeting_id: str,
        drawio_xml: str,
        recent_turns: List[Dict[str, Any]],
    ) -> RaisingHandEvaluation:
        """
        Rule-based heuristic evaluator for offline/dry-run environments.
        Detects common architectural anti-patterns in the diagram or transcripts.
        """
        combined_text = (drawio_xml or "").lower() + " " + " ".join(
            t.get("transcript_text", "").lower() for t in recent_turns
        )

        history = self._history.setdefault(meeting_id, set())

        # Rule 1: Redis / Cache added without stampede / mutex protection
        if re.search(r"\b(?:redis|cache|caches|caching)\b", combined_text):
            title = "🚩 Cache Stampede Risk"
            if title not in history:
                return RaisingHandEvaluation(
                    trigger=True,
                    category="VULNERABILITY",
                    short_title=title,
                    detailed_body=(
                        "• High-concurrency cache misses on Redis will overload PostgreSQL.\n"
                        "• Add mutex lock / request coalescing on cache miss.\n"
                        "• Configure jittered TTLs (300s ± 30s)."
                    ),
                )

        # Rule 2: Single database without replica or clustering
        if re.search(r"\b(?:postgres|postgresql|database|databases)\b", combined_text) and not re.search(
            r"\breplicas?\b", combined_text
        ):
            title = "⚡ Single Point of Failure"
            if title not in history:
                return RaisingHandEvaluation(
                    trigger=True,
                    category="LOGIC_FLAW",
                    short_title=title,
                    detailed_body=(
                        "• Single database instance lacks automatic failover.\n"
                        "• Add a read replica or configure multi-AZ clustering.\n"
                        "• Implement connection pooling (e.g., PgBouncer)."
                    ),
                )

        # Rule 3: Auth or Token service without rate limiting
        if re.search(
            r"\b(?:auth|authn|authz|authentication|authorization|tokens?)\b", combined_text
        ) and not re.search(r"\brate[- ]?limit", combined_text, re.I):
            title = "🚩 Auth Flooding Risk"
            if title not in history:
                return RaisingHandEvaluation(
                    trigger=True,
                    category="VULNERABILITY",
                    short_title=title,
                    detailed_body=(
                        "• Auth endpoints vulnerable to credential stuffing / DDoS.\n"
                        "• Implement distributed token-bucket rate limiter.\n"
                        "• Place IP reputation filter in front of ingress."
                    ),
                )

        return RaisingHandEvaluation(
            trigger=False,
            category="LOGIC_FLAW",
            short_title="Architecture Sound",
            detailed_body="No critical vulnerabilities or flaws detected.",
        )

    async def evaluate_proactive_async(
        self,
        meeting_id: str,
        timestamp_ms: int,
        drawio_xml: Optional[str] = None,
        recent_turns: Optional[List[Dict[str, Any]]] = None,
    ) -> RaisingHandEvaluation:
        """
        Asynchronously evaluates current whiteboard architecture and recent speech using Gemini.
        Uses the shared async llm helper to prevent blocking the asyncio event loop (Fixes #1).
        """
        turns = (
            recent_turns
            if recent_turns is not None
            else await self._resolve_recent_context_async(meeting_id, timestamp_ms, window_ms=60000)
        )
        xml_content = drawio_xml or ""
        history = self._history.setdefault(meeting_id, set())

        if self.api_key:
            try:
                turns_formatted = "\n".join([
                    f"- [{t.get('timestamp_ms', 0)}ms] {t.get('speaker_label', 'Speaker')}: {t.get('transcript_text', '')}"
                    for t in turns
                ]) or "(No recent speech recorded)"

                history_formatted = ", ".join(f"'{h}'" for h in history) or "None"

                prompt = (
                    "You are SpecScribe's 'Raising-Hand' Proactive Architecture Critic on Snap Spectacles AR.\n"
                    "Your goal is to catch critical system vulnerabilities, logic flaws, and architectural risks "
                    "in real-time before bad design decisions become permanent.\n\n"
                    f"Current Live Draw.io XML Architecture:\n{xml_content}\n\n"
                    f"Recent Meeting Dialogue (last 60s):\n{turns_formatted}\n\n"
                    f"Issues already flagged in this meeting (DO NOT repeat these): {history_formatted}\n\n"
                    "CRITICAL CONSTRAINTS:\n"
                    "1. Only set trigger=True if there is an actionable, high-severity issue (VULNERABILITY, LOGIC_FLAW, or ALTERNATIVE_IDEA).\n"
                    "2. If everything is acceptable or already discussed, set trigger=False.\n"
                    "3. short_title MUST NOT exceed 28 characters (for AR waveguide display). Example: '🚩 Cache Stampede Risk'.\n"
                    "4. detailed_body must contain 2-3 crisp bullet points with direct technical mitigations."
                )

                text = await llm.generate_structured(prompt, schema=RaisingHandEvaluation, api_key=self.api_key)
                if text:
                    parsed = json.loads(text)
                    evaluation = RaisingHandEvaluation.model_validate(parsed)
                    evaluation.short_title = self._truncate_title(evaluation.short_title)
                    # Gemini's verdict is authoritative: a duplicate title is suppressed, never re-raised.
                    if evaluation.short_title in history:
                        evaluation.trigger = False
                    return evaluation
            except Exception as e:
                logger.warning("Gemini async proactive evaluation error: %s; falling back to heuristic", e)

        # Heuristic runs only when no Gemini client exists or the Gemini call failed.
        evaluation = self._evaluate_heuristic_proactive(meeting_id, xml_content, turns)
        evaluation.short_title = self._truncate_title(evaluation.short_title)
        return evaluation

    async def evaluate_research_pull_async(
        self,
        meeting_id: str,
        query: str,
        timestamp_ms: int,
        drawio_xml: Optional[str] = None,
        recent_turns: Optional[List[Dict[str, Any]]] = None,
    ) -> RaisingHandEvaluation:
        """
        Mode B: Asynchronous On-Demand Research Pull via the shared async llm helper (Fixes #1).
        """
        turns = (
            recent_turns
            if recent_turns is not None
            else await self._resolve_recent_context_async(meeting_id, timestamp_ms, window_ms=60000)
        )
        xml_content = drawio_xml or ""

        if self.api_key:
            try:
                turns_formatted = "\n".join([
                    f"- [{t.get('timestamp_ms', 0)}ms] {t.get('speaker_label', 'Speaker')}: {t.get('transcript_text', '')}"
                    for t in turns
                ]) or "(No recent speech recorded)"

                prompt = (
                    "You are SpecScribe's Senior Research Sub-Agent.\n"
                    "The wearer just pinched the AR AI Teammate Orb to ask an on-demand architectural research question.\n"
                    f"User Spoken Question: '{query}'\n\n"
                    f"Current Live Diagram Architecture (.drawio XML):\n{xml_content}\n\n"
                    f"Recent Conversation Context:\n{turns_formatted}\n\n"
                    "Task: Provide a concrete, high-signal architectural recommendation.\n"
                    "- category: 'RESEARCH' or 'ALTERNATIVE_IDEA'\n"
                    "- short_title: max 28 characters starting with an icon (e.g. '🔍 Redis Eviction (LRU)').\n"
                    "- detailed_body: 2-3 concise bullet points answering the question directly with trade-offs.\n"
                    "- trigger: must be True."
                )

                text = await llm.generate_structured(prompt, schema=RaisingHandEvaluation, api_key=self.api_key)
                if text:
                    parsed = json.loads(text)
                    evaluation = RaisingHandEvaluation.model_validate(parsed)
                    evaluation.short_title = self._truncate_title(evaluation.short_title)
                    evaluation.trigger = True
                    return evaluation
            except Exception as e:
                logger.warning("Gemini async research pull failed: %s; falling back to heuristic", e)

        return self._heuristic_research_fallback(query)

    def _heuristic_research_fallback(self, query: str) -> RaisingHandEvaluation:
        q_lower = query.lower()
        if "eviction" in q_lower or "redis" in q_lower or "cache" in q_lower:
            title = "🔍 Redis LRU Policy"
            body = (
                "• Use volatile-lru if all cache keys have TTLs configured.\n"
                "• Use allkeys-lru if cache is pure ephemeral data.\n"
                "• Set maxmemory-samples to 10 for high accuracy."
            )
        elif "kafka" in q_lower or "queue" in q_lower or "sqs" in q_lower:
            title = "🔍 Queue Partitioning"
            body = (
                "• Kafka excels at high-throughput ordered stream replays.\n"
                "• SQS is simpler for standard task worker decoupling.\n"
                "• Partition by entity ID to guarantee per-entity order."
            )
        else:
            clean_q = re.sub(r"[^a-zA-Z0-9 ]", "", query).strip()
            short_q = clean_q[:20] if clean_q else "Query"
            title = f"🔍 {short_q}"
            body = (
                f"• Analyze data access patterns for '{short_q}'.\n"
                "• Benchmark network and serialization overhead.\n"
                "• Establish health probes and fallback paths."
            )

        return RaisingHandEvaluation(
            trigger=True,
            category="RESEARCH",
            short_title=self._truncate_title(title),
            detailed_body=body,
        )

    async def persist_and_broadcast(
        self,
        meeting_id: str,
        evaluation: RaisingHandEvaluation,
        timestamp_ms: int,
        was_pinched: bool,
        broadcast_fn: Optional[Callable[[str, Dict[str, Any]], Any]] = None,
    ) -> Dict[str, Any]:
        """
        Inserts the intervention into agent_interventions table / memory_store
        and broadcasts HAND_RAISED to active WebSockets (with optional spoken_summary and audio_b64).
        """
        intervention_id = str(uuid.uuid4())
        short_title = self._truncate_title(evaluation.short_title)
        spoken_summary = (
            evaluation.spoken_summary
            if evaluation.spoken_summary
            else self._build_spoken_summary(short_title, evaluation.detailed_body)
        )
        audio_b64 = evaluation.audio_b64
        if audio_b64 is None and (self._deepgram_client is not None or self.deepgram_api_key):
            audio_b64 = await self.synthesize_critique_tts_async(spoken_summary)

        db_record = {
            "id": intervention_id,
            "meeting_id": meeting_id,
            "timestamp_ms": timestamp_ms,
            "category": evaluation.category,
            "short_title": short_title,
            "detailed_body": evaluation.detailed_body,
            "was_pinched": was_pinched,
        }
        record = {
            **db_record,
            "spoken_summary": spoken_summary,
            "audio_b64": audio_b64,
        }

        # Save to memory store
        if self.memory_store and "agent_interventions" in self.memory_store:
            self.memory_store["agent_interventions"][meeting_id].append(record)

        # Save to Supabase
        if self.supabase_client:
            try:
                await asyncio.to_thread(
                    lambda: self.supabase_client.table("agent_interventions").insert(db_record).execute()
                )
            except Exception as e:
                logger.warning("Supabase agent_interventions insert error: %s", e)

        # Update history and timestamp
        self._history.setdefault(meeting_id, set()).add(short_title)

        # Broadcast via WebSocket
        payload = {
            "event": "HAND_RAISED",
            "intervention_id": intervention_id,
            "meeting_id": meeting_id,
            "timestamp_ms": timestamp_ms,
            "category": evaluation.category,
            "short_title": short_title,
            "detailed_body": evaluation.detailed_body,
            "spoken_summary": spoken_summary,
            "audio_b64": audio_b64,
            "was_pinched": was_pinched,
        }

        if broadcast_fn:
            try:
                res = broadcast_fn(meeting_id, payload)
                if asyncio.iscoroutine(res):
                    await res
            except Exception as e:
                logger.warning("Failed to broadcast HAND_RAISED event: %s", e)

        logger.info(
            "HAND_RAISED [%s] for meeting %s: %s (pinched=%s)",
            evaluation.category,
            meeting_id,
            short_title,
            was_pinched,
        )

        return record

    async def handle_research_pull(
        self,
        meeting_id: str,
        query: str,
        timestamp_ms: int,
        drawio_xml: Optional[str] = None,
        broadcast_fn: Optional[Callable[[str, Dict[str, Any]], Any]] = None,
    ) -> Dict[str, Any]:
        """Mode B entry point: User pinched orb with ASK_AGENT."""
        evaluation = await self.evaluate_research_pull_async(
            meeting_id=meeting_id,
            query=query,
            timestamp_ms=timestamp_ms,
            drawio_xml=drawio_xml,
        )
        return await self.persist_and_broadcast(
            meeting_id=meeting_id,
            evaluation=evaluation,
            timestamp_ms=timestamp_ms,
            was_pinched=True,
            broadcast_fn=broadcast_fn,
        )

    async def evaluate_proactive_on_change(
        self,
        meeting_id: str,
        timestamp_ms: int,
        drawio_xml: Optional[str] = None,
        broadcast_fn: Optional[Callable[[str, Dict[str, Any]], Any]] = None,
    ) -> Optional[Dict[str, Any]]:
        """Mode A event-driven entry point: Called upon diagram mutations."""
        evaluation = await self.evaluate_proactive_async(
            meeting_id=meeting_id,
            timestamp_ms=timestamp_ms,
            drawio_xml=drawio_xml,
        )
        if evaluation.trigger:
            return await self.persist_and_broadcast(
                meeting_id=meeting_id,
                evaluation=evaluation,
                timestamp_ms=timestamp_ms,
                was_pinched=False,
                broadcast_fn=broadcast_fn,
            )
        return None

    def start_proactive_loop(
        self,
        meeting_id: str,
        interval_seconds: float = 20.0,
        get_diagram_fn: Optional[Callable[[str], str]] = None,
        get_timestamp_fn: Optional[Callable[[str], int]] = None,
        broadcast_fn: Optional[Callable[[str, Dict[str, Any]], Any]] = None,
    ) -> asyncio.Task:
        """Starts a background asyncio periodic loop evaluating the meeting every interval_seconds."""
        if meeting_id in self._active_loops and not self._active_loops[meeting_id].done():
            logger.debug("Proactive loop already running for meeting %s", meeting_id)
            return self._active_loops[meeting_id]

        loop_started = time.monotonic()

        async def _loop():
            logger.info("Started RaisingHand proactive loop for meeting %s (interval=%ss)", meeting_id, interval_seconds)
            while True:
                try:
                    await asyncio.sleep(interval_seconds)
                    xml = get_diagram_fn(meeting_id) if get_diagram_fn else ""
                    ts = get_timestamp_fn(meeting_id) if get_timestamp_fn else int((time.monotonic() - loop_started) * 1000)

                    self._loop_telemetry[meeting_id] = {
                        "status": "healthy",
                        "last_eval_ms": ts,
                        "error_count": self._loop_telemetry.get(meeting_id, {}).get("error_count", 0),
                        "last_error": self._loop_telemetry.get(meeting_id, {}).get("last_error"),
                    }

                    evaluation = await self.evaluate_proactive_async(
                        meeting_id=meeting_id,
                        timestamp_ms=ts,
                        drawio_xml=xml,
                    )
                    if evaluation.trigger:
                        await self.persist_and_broadcast(
                            meeting_id=meeting_id,
                            evaluation=evaluation,
                            timestamp_ms=ts,
                            was_pinched=False,
                            broadcast_fn=broadcast_fn,
                        )
                    self._loop_telemetry.setdefault(meeting_id, {})["status"] = "running"
                except asyncio.CancelledError:
                    logger.info("RaisingHand proactive loop cancelled for meeting %s", meeting_id)
                    raise
                except Exception as e:
                    logger.error(
                        "Error in RaisingHand proactive loop iteration for meeting %s; continuing: %s",
                        meeting_id,
                        e,
                        exc_info=True,
                    )
                    telemetry = self._loop_telemetry.setdefault(meeting_id, {})
                    telemetry["status"] = "degraded"
                    telemetry["error_count"] = telemetry.get("error_count", 0) + 1
                    telemetry["last_error"] = str(e)
                    telemetry["last_error_time"] = datetime.now(timezone.utc).isoformat()

        task = asyncio.create_task(_loop())
        self._active_loops[meeting_id] = task
        return task

    def stop_proactive_loop(self, meeting_id: str) -> None:
        """Stops the periodic loop for a specific meeting."""
        task = self._active_loops.pop(meeting_id, None)
        if task and not task.done():
            task.cancel()
        self._loop_telemetry.pop(meeting_id, None)


    def clear_meeting(self, meeting_id: str) -> None:
        """Stops the meeting's loop and drops its per-meeting history (used on session eviction)."""
        self.stop_proactive_loop(meeting_id)
        self._history.pop(meeting_id, None)

    def health(self) -> Dict[str, Any]:
        """Public read-only snapshot of proactive-loop health (used by /api/health)."""
        return {
            "proactive_loops": sum(1 for task in self._active_loops.values() if not task.done()),
            "proactive_telemetry": {mid: dict(telemetry) for mid, telemetry in self._loop_telemetry.items()},
        }

    def stop_all(self) -> None:
        """Stops all active proactive loops."""
        for meeting_id in list(self._active_loops.keys()):
            self.stop_proactive_loop(meeting_id)
