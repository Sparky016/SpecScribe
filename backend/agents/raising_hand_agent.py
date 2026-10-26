"""
SpecScribe AR - 'Raising-Hand' Proactive Critique & Research Sub-Agent (T-08)
Supports Mode A (Proactive Push every 20s/diagram change) and Mode B (On-Demand Research Pull via pinchCommand).
"""

import asyncio
import json
import logging
import os
import re
import time
import uuid
from datetime import datetime, timezone
from typing import Any, Callable, Dict, List, Literal, Optional, Set

from pydantic import BaseModel, Field

logger = logging.getLogger("specscribe.raising_hand")


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
    ):
        self.api_key = api_key if api_key is not None else os.environ.get("GEMINI_API_KEY")
        self.supabase_client = supabase_client
        self.memory_store = memory_store
        self._genai_client = None

        # Tracking per meeting: meeting_id -> Set of triggered short_titles (to avoid duplicates)
        self._history: Dict[str, Set[str]] = {}
        # Last intervention timestamp per meeting: meeting_id -> int (ms)
        self._last_intervention_time: Dict[str, int] = {}
        # Active background tasks: meeting_id -> asyncio.Task
        self._active_loops: Dict[str, asyncio.Task] = {}
        # Structured health telemetry: meeting_id -> telemetry dict
        self._loop_telemetry: Dict[str, Dict[str, Any]] = {}

        if self.api_key:
            try:
                from google import genai

                self._genai_client = genai.Client(api_key=self.api_key)
            except Exception as e:
                logger.warning("Could not initialize Google GenAI Client: %s", e)

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
        """Retrieves recent transcript turns for evaluation."""
        turns: List[Dict[str, Any]] = []
        if self.memory_store and "transcript_turns" in self.memory_store:
            all_turns = self.memory_store["transcript_turns"].get(meeting_id, [])
            lower = max(0, timestamp_ms - window_ms)
            turns = [t for t in all_turns if lower <= t.get("timestamp_ms", 0) <= timestamp_ms]
            if not turns and all_turns:
                turns = all_turns[-5:]
        return turns

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
        Uses client.aio to prevent blocking the asyncio event loop (Fixes #1).
        """
        turns = recent_turns or self._get_recent_context(meeting_id, timestamp_ms, window_ms=60000)
        xml_content = drawio_xml or ""
        history = self._history.setdefault(meeting_id, set())

        if self._genai_client:
            try:
                from google.genai import types

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

                candidate_models = ["gemini-3.5-flash", "gemini-3.8-flash", "gemini-2.5-flash"]
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
                                response_schema=RaisingHandEvaluation,
                            ),
                        )
                        if response:
                            break
                    except Exception as m_err:
                        logger.debug("Async proactive model %s failed: %s; trying next", model_name, m_err)

                if response and response.text:
                    parsed = json.loads(response.text)
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

    def evaluate_proactive(
        self,
        meeting_id: str,
        timestamp_ms: int,
        drawio_xml: Optional[str] = None,
        recent_turns: Optional[List[Dict[str, Any]]] = None,
    ) -> RaisingHandEvaluation:
        """
        Evaluates current whiteboard architecture and recent speech using Gemini (synchronous wrapper).
        """
        turns = recent_turns or self._get_recent_context(meeting_id, timestamp_ms, window_ms=60000)
        xml_content = drawio_xml or ""
        history = self._history.setdefault(meeting_id, set())

        # If Gemini client is available, call Gemini
        if self._genai_client:
            try:
                from google.genai import types

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

                candidate_models = ["gemini-3.5-flash", "gemini-3.8-flash", "gemini-2.5-flash"]
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
                                response_schema=RaisingHandEvaluation,
                            ),
                        )
                        if response and response.text:
                            parsed = json.loads(response.text)
                            evaluation = RaisingHandEvaluation.model_validate(parsed)
                            evaluation.short_title = self._truncate_title(evaluation.short_title)
                            if evaluation.trigger and evaluation.short_title not in history:
                                return evaluation
                    except Exception as m_err:
                        logger.debug("Sync proactive model %s failed: %s; trying next", model_name, m_err)
            except Exception as e:
                logger.warning("Gemini proactive evaluation error: %s; falling back to heuristic", e)

        # Fallback to heuristic evaluation
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
        Mode B: Asynchronous On-Demand Research Pull via client.aio (Fixes #1).
        """
        turns = recent_turns or self._get_recent_context(meeting_id, timestamp_ms, window_ms=60000)
        xml_content = drawio_xml or ""

        if self._genai_client:
            try:
                from google.genai import types

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

                candidate_models = ["gemini-3.5-flash", "gemini-3.8-flash", "gemini-2.5-flash"]
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
                                response_schema=RaisingHandEvaluation,
                            ),
                        )
                        if response:
                            break
                    except Exception as m_err:
                        logger.debug("Async research model %s failed: %s; trying next", model_name, m_err)

                if response and response.text:
                    parsed = json.loads(response.text)
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

    def evaluate_research_pull(
        self,
        meeting_id: str,
        query: str,
        timestamp_ms: int,
        drawio_xml: Optional[str] = None,
        recent_turns: Optional[List[Dict[str, Any]]] = None,
    ) -> RaisingHandEvaluation:
        """
        Mode B: On-Demand Research Pull (synchronous wrapper).
        """
        turns = recent_turns or self._get_recent_context(meeting_id, timestamp_ms, window_ms=60000)
        xml_content = drawio_xml or ""

        if self._genai_client:
            try:
                from google.genai import types

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

                candidate_models = ["gemini-3.5-flash", "gemini-3.8-flash", "gemini-2.5-flash"]
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
                                response_schema=RaisingHandEvaluation,
                            ),
                        )
                        if response and response.text:
                            parsed = json.loads(response.text)
                            evaluation = RaisingHandEvaluation.model_validate(parsed)
                            evaluation.short_title = self._truncate_title(evaluation.short_title)
                            evaluation.trigger = True
                            return evaluation
                    except Exception as m_err:
                        logger.debug("Sync research model %s failed: %s; trying next", model_name, m_err)
            except Exception as e:
                logger.warning("Gemini sync research pull failed: %s; falling back to heuristic", e)

        return self._heuristic_research_fallback(query)

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
        and broadcasts HAND_RAISED to active WebSockets.
        """
        intervention_id = str(uuid.uuid4())
        short_title = self._truncate_title(evaluation.short_title)
        record = {
            "id": intervention_id,
            "meeting_id": meeting_id,
            "timestamp_ms": timestamp_ms,
            "category": evaluation.category,
            "short_title": short_title,
            "detailed_body": evaluation.detailed_body,
            "was_pinched": was_pinched,
        }

        # Save to memory store
        if self.memory_store and "agent_interventions" in self.memory_store:
            self.memory_store["agent_interventions"][meeting_id].append(record)

        # Save to Supabase
        if self.supabase_client:
            try:
                await asyncio.to_thread(
                    lambda: self.supabase_client.table("agent_interventions").insert(record).execute()
                )
            except Exception as e:
                logger.warning("Supabase agent_interventions insert error: %s", e)

        # Update history and timestamp
        self._history.setdefault(meeting_id, set()).add(short_title)
        self._last_intervention_time[meeting_id] = timestamp_ms

        # Broadcast via WebSocket
        payload = {
            "event": "HAND_RAISED",
            "intervention_id": intervention_id,
            "meeting_id": meeting_id,
            "timestamp_ms": timestamp_ms,
            "category": evaluation.category,
            "short_title": short_title,
            "detailed_body": evaluation.detailed_body,
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


    def stop_all(self) -> None:
        """Stops all active proactive loops."""
        for meeting_id in list(self._active_loops.keys()):
            self.stop_proactive_loop(meeting_id)
