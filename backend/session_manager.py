"""
SessionManager: Encapsulates all in-memory live sessions, connections,
stores, and agent instances for FastAPI app.state dependency injection.
Source: SPEC_DOC.md §4.1 (Finding #4)
"""

import asyncio
from collections import defaultdict
from datetime import datetime, timezone
import json
import logging
import time
from typing import Any, Coroutine, Dict, Optional, Set
import uuid

from fastapi import Request, WebSocket

import os
import sys

backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

try:
    from graph_engine import HeadlessDrawioDaemon, LiveGraphSession
    from agents.decision_linker import DecisionLinkerAgent
    from agents.raising_hand_agent import RaisingHandAgent
    from agents.spec_generator import SpecGeneratorAgent
except (ImportError, ModuleNotFoundError):
    from backend.graph_engine import HeadlessDrawioDaemon, LiveGraphSession
    from backend.agents.decision_linker import DecisionLinkerAgent
    from backend.agents.raising_hand_agent import RaisingHandAgent
    from backend.agents.spec_generator import SpecGeneratorAgent

logger = logging.getLogger("specscribe.session_manager")

# Demo meeting IDs (non-UUID) accepted only when SPECSCRIBE_DEMO_MODE=1.
DEMO_MEETING_IDS = ("demo", "demo-session-01")
DEMO_MEETING_UUID = "00000000-0000-4000-8000-000000000d0e"


DEFAULT_SESSION_TTL_SECONDS = 1800.0
DEFAULT_MAX_SESSIONS = 50
DEFAULT_SWEEP_INTERVAL_SECONDS = 60.0


def _env_number(name: str, default: float) -> float:
    """Read a non-negative number from the environment, falling back to the default."""
    raw = os.getenv(name)
    if raw is None or raw.strip() == "":
        return default
    try:
        value = float(raw)
    except ValueError:
        logger.warning("Ignoring invalid %s=%r; using %s", name, raw, default)
        return default
    return value if value >= 0 else default


class TimedLiveGraphSession(LiveGraphSession):
    """LiveGraphSession that tracks elapsed time since the session started."""

    def __init__(self, *args: Any, **kwargs: Any):
        super().__init__(*args, **kwargs)
        self.started_at_monotonic: float = time.monotonic()

    def elapsed_ms(self) -> int:
        """Milliseconds since meeting/session start (PRD timestamp_ms)."""
        return int((time.monotonic() - self.started_at_monotonic) * 1000)


def resolve_meeting_id(meeting_id: str) -> str:
    """Return the canonical UUID string for a meeting ID, or raise ValueError.

    The demo IDs map to a fixed UUID only when SPECSCRIBE_DEMO_MODE=1.
    """
    if meeting_id in DEMO_MEETING_IDS and os.getenv("SPECSCRIBE_DEMO_MODE") == "1":
        return DEMO_MEETING_UUID
    return str(uuid.UUID(meeting_id))


class SessionManager:
    """
    Centralized container managing all stateful components across the backend:
    - LiveGraphSession instances per meeting
    - Active WebSocket client connections
    - In-memory persistence store (meetings, turns, snapshots, interventions, chunks)
    - Headless Draw.io renderer daemon
    - Autonomous agents (DecisionLinker, RaisingHand, SpecGenerator)
    """

    def __init__(self, supabase_client: Optional[Any] = None):
        self.supabase_client = supabase_client
        self.live_sessions: Dict[str, LiveGraphSession] = {}
        self.active_connections: Dict[str, Set[WebSocket]] = defaultdict(set)
        self.memory_store: Dict[str, Dict[str, Any]] = {
            "meetings": {},
            "transcript_turns": defaultdict(list),
            "diagram_snapshots": defaultdict(list),
            "agent_interventions": defaultdict(list),
            "knowledge_chunks": defaultdict(list),
        }
        self.renderer_daemon = HeadlessDrawioDaemon()
        self.decision_linker = DecisionLinkerAgent(
            supabase_client=self.supabase_client,
            memory_store=self.memory_store,
        )
        self.raising_hand_agent = RaisingHandAgent(
            supabase_client=self.supabase_client,
            memory_store=self.memory_store,
        )
        self.spec_generator = SpecGeneratorAgent(
            supabase_client=self.supabase_client,
            memory_store=self.memory_store,
        )
        self._bg_tasks: Set[asyncio.Task] = set()
        self.last_activity: Dict[str, float] = {}
        self._clock = time.monotonic

    def spawn(self, coro: Coroutine[Any, Any, Any]) -> asyncio.Task:
        """Run a fire-and-forget coroutine while holding a reference to its task.

        Exceptions are logged at ERROR from the done callback; cancellation
        happens in cancel_background_tasks() during application shutdown.
        """
        task = asyncio.create_task(coro)
        self._bg_tasks.add(task)
        task.add_done_callback(self._on_bg_task_done)
        return task

    def _on_bg_task_done(self, task: asyncio.Task) -> None:
        self._bg_tasks.discard(task)
        if task.cancelled():
            return
        exc = task.exception()
        if exc is not None:
            logger.error("Background task failed: %s", exc, exc_info=exc)

    async def cancel_background_tasks(self) -> None:
        """Cancel and await every outstanding task started via spawn()."""
        tasks = list(self._bg_tasks)
        for task in tasks:
            task.cancel()
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)
        self._bg_tasks.clear()

    @property
    def session_ttl_seconds(self) -> float:
        return _env_number("SPECSCRIBE_SESSION_TTL_SECONDS", DEFAULT_SESSION_TTL_SECONDS)

    @property
    def max_sessions(self) -> int:
        return int(_env_number("SPECSCRIBE_MAX_SESSIONS", DEFAULT_MAX_SESSIONS))

    def can_admit(self, meeting_id: str) -> bool:
        """True when the meeting already has a live session or the session cap has room."""
        return meeting_id in self.live_sessions or len(self.live_sessions) < self.max_sessions

    async def meeting_exists(self, meeting_id: str) -> bool:
        """True when the meeting is in memory or in Supabase. Never creates state."""
        if meeting_id in self.memory_store["meetings"] or meeting_id in self.live_sessions:
            return True
        if self.supabase_client:
            try:
                res = await asyncio.to_thread(
                    lambda: self.supabase_client.table("meetings").select("id").eq("id", meeting_id).execute()
                )
                return bool(res.data)
            except Exception as e:
                logger.error("Supabase meetings lookup error: %s", e, exc_info=True)
        return False

    def touch(self, meeting_id: str) -> None:
        self.last_activity[meeting_id] = self._clock()

    def evict(self, meeting_id: str) -> bool:
        """Drop all in-memory state for a meeting. Refuses (False) while any socket is live."""
        if self.active_connections.get(meeting_id):
            return False
        self.raising_hand_agent.clear_meeting(meeting_id)
        self.active_connections.pop(meeting_id, None)
        self.live_sessions.pop(meeting_id, None)
        self.last_activity.pop(meeting_id, None)
        self.memory_store["meetings"].pop(meeting_id, None)
        for key in ("transcript_turns", "diagram_snapshots", "agent_interventions", "knowledge_chunks"):
            self.memory_store[key].pop(meeting_id, None)
        logger.info("Evicted idle session for meeting %s", meeting_id)
        return True

    def evict_if_idle(self, meeting_id: str) -> bool:
        """Evict a socketless session whose idle time has reached the TTL (TTL=0 evicts at once)."""
        if meeting_id not in self.live_sessions or self.active_connections.get(meeting_id):
            return False
        idle = self._clock() - self.last_activity.get(meeting_id, 0.0)
        if idle < self.session_ttl_seconds:
            return False
        return self.evict(meeting_id)

    def sweep_idle_sessions(self) -> int:
        """Evict every idle, socketless session past the TTL; returns the number evicted."""
        return sum(1 for mid in list(self.live_sessions) if self.evict_if_idle(mid))

    async def run_eviction_loop(self) -> None:
        """Periodic idle-session sweep; per-iteration errors are logged, cancellation propagates."""
        while True:
            interval = _env_number("SPECSCRIBE_SESSION_SWEEP_SECONDS", DEFAULT_SWEEP_INTERVAL_SECONDS)
            await asyncio.sleep(interval or DEFAULT_SWEEP_INTERVAL_SECONDS)
            try:
                self.sweep_idle_sessions()
            except asyncio.CancelledError:
                raise
            except Exception as e:
                logger.error("Session eviction sweep failed: %s", e, exc_info=True)

    def get_or_create_session(self, meeting_id: str) -> LiveGraphSession:
        self.touch(meeting_id)
        if meeting_id not in self.live_sessions:
            session = TimedLiveGraphSession(meeting_id)
            self.live_sessions[meeting_id] = session
            if meeting_id not in self.memory_store["meetings"]:
                self.memory_store["meetings"][meeting_id] = {
                    "id": meeting_id,
                    "title": f"Meeting {meeting_id[:8]}",
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    "latest_drawio_xml": session.get_xml(),
                    "generated_spec_md": None,
                }
        return self.live_sessions[meeting_id]

    async def ensure_session(self, meeting_id: str) -> LiveGraphSession:
        """Validate the UUID, upsert the meetings row, then create the live session.

        The meetings upsert runs before any child insert (FK parent). Raises
        ValueError for a non-UUID meeting_id.
        """
        meeting_id = resolve_meeting_id(meeting_id)
        session = self.get_or_create_session(meeting_id)
        if self.supabase_client:
            meeting = self.memory_store["meetings"][meeting_id]
            record = {
                "id": meeting_id,
                "title": meeting.get("title") or f"Live meeting {datetime.now(timezone.utc).date().isoformat()}",
            }
            try:
                await asyncio.to_thread(
                    lambda: self.supabase_client.table("meetings").upsert(record, on_conflict="id").execute()
                )
            except Exception as e:
                logger.error("Supabase meetings upsert error: %s", e, exc_info=True)
        return session

    async def broadcast_to_meeting(
        self,
        meeting_id: str,
        message: Dict[str, Any],
        exclude: Optional[WebSocket] = None,
    ):
        sockets = self.active_connections.get(meeting_id, set()).copy()
        payload = json.dumps(message)
        for ws in sockets:
            if ws != exclude:
                try:
                    await ws.send_text(payload)
                except Exception as e:
                    logger.warning("Failed to send WebSocket message to client: %s", e)

    async def db_save_transcript_turn(
        self,
        meeting_id: str,
        speaker_label: str,
        transcript_text: str,
        timestamp_ms: int,
    ) -> str:
        turn_id = str(uuid.uuid4())
        record = {
            "id": turn_id,
            "meeting_id": meeting_id,
            "speaker_label": speaker_label,
            "transcript_text": transcript_text,
            "timestamp_ms": timestamp_ms,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        self.memory_store["transcript_turns"][meeting_id].append(record)

        if self.supabase_client:
            try:
                res = await asyncio.to_thread(
                    lambda: self.supabase_client.table("transcript_turns").insert(record).execute()
                )
                if res.data:
                    return res.data[0]["id"]
            except Exception as e:
                logger.error("Supabase transcript_turns insert error: %s", e, exc_info=True)

        return turn_id

    async def db_save_diagram_snapshot(
        self,
        meeting_id: str,
        timestamp_ms: int,
        drawio_xml: str,
        diff_summary: str,
        decision_rationale: Optional[str],
        triggered_by: str,
        overlay_image_url: Optional[str] = None,
    ) -> str:
        snapshot_id = str(uuid.uuid4())
        record = {
            "id": snapshot_id,
            "meeting_id": meeting_id,
            "timestamp_ms": timestamp_ms,
            "drawio_xml": drawio_xml,
            "overlay_image_url": overlay_image_url or f"/snapshots/{snapshot_id}.png",
            "diff_summary": diff_summary,
            "decision_rationale": decision_rationale,
            "triggered_by": triggered_by,
        }
        self.memory_store["diagram_snapshots"][meeting_id].append(record)

        if meeting_id in self.memory_store["meetings"]:
            self.memory_store["meetings"][meeting_id]["latest_drawio_xml"] = drawio_xml

        if self.supabase_client:
            try:
                await asyncio.to_thread(
                    lambda: self.supabase_client.table("diagram_snapshots").insert(record).execute()
                )
                await asyncio.to_thread(
                    lambda: self.supabase_client.table("meetings").update({"latest_drawio_xml": drawio_xml}).eq("id", meeting_id).execute()
                )
            except Exception as e:
                logger.error("Supabase diagram_snapshots insert error: %s", e, exc_info=True)

        return snapshot_id


def get_session_manager(request: Request) -> SessionManager:
    """FastAPI Request dependency to inject SessionManager.

    Raises RuntimeError when lifespan has not set app.state.session_manager,
    rather than silently building a fresh (empty) SessionManager.
    """
    if hasattr(request.app.state, "session_manager"):
        return request.app.state.session_manager
    raise RuntimeError("SessionManager not configured on app.state")

