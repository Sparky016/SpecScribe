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
from typing import Any, Dict, Optional, Set
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

    def get_or_create_session(self, meeting_id: str) -> LiveGraphSession:
        if meeting_id not in self.live_sessions:
            session = LiveGraphSession(meeting_id)
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
                logger.warning("Supabase transcript_turns insert error: %s", e)

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
                logger.warning("Supabase diagram_snapshots insert error: %s", e)

        return snapshot_id


def get_session_manager(request: Request) -> SessionManager:
    """FastAPI Request dependency to inject SessionManager."""
    if hasattr(request.app.state, "session_manager"):
        return request.app.state.session_manager
    try:
        from main import session_manager
        return session_manager
    except (ImportError, ModuleNotFoundError):
        try:
            from backend.main import session_manager
            return session_manager
        except Exception:
            return SessionManager()


def get_ws_session_manager(websocket: WebSocket) -> SessionManager:
    """FastAPI WebSocket dependency/helper to inject SessionManager."""
    if hasattr(websocket.app.state, "session_manager"):
        return websocket.app.state.session_manager
    try:
        from main import session_manager
        return session_manager
    except (ImportError, ModuleNotFoundError):
        try:
            from backend.main import session_manager
            return session_manager
        except Exception:
            return SessionManager()

