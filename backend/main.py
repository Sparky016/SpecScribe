"""
SpecScribe AR - FastAPI Full-Duplex WebSocket Hub & Orchestrator
Core Backend Architecture (T-05, T-06, T-07, T-08)
"""

import asyncio
import base64
import json
import logging
import os
import sys
import uuid
from collections import defaultdict
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Set

backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)


from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, Query, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from auth import WS_UNAUTHORIZED_CLOSE_CODE, require_api_token, validate_auth_config, ws_token_ok
from graph_engine import (
    HeadlessDrawioDaemon,
    LiveGraphSession,
    extract_graph_delta_from_gemini,
)
from agents.decision_linker import DecisionLinkerAgent
from agents.raising_hand_agent import RaisingHandAgent
from agents.spec_generator import SpecGeneratorAgent

try:
    from session_manager import (
        SessionManager,
        get_session_manager,
        get_ws_session_manager,
    )
    from envelope_router import EnvelopeRouter
except ImportError:
    from backend.session_manager import (
        SessionManager,
        get_session_manager,
        get_ws_session_manager,
    )
    from backend.envelope_router import EnvelopeRouter


# Load environment variables from .env if present
load_dotenv()

# Logging configuration
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] [%(name)s] %(message)s",
)
logger = logging.getLogger("specscribe.main")

# Supabase Client Setup (with robust fallback)
supabase_client = None
try:
    from supabase import Client, create_client

    sb_url = os.environ.get("SUPABASE_URL")
    sb_key = os.environ.get("SUPABASE_SERVICE_KEY") or os.environ.get("SUPABASE_KEY")
    if sb_url and sb_key:
        supabase_client = create_client(sb_url, sb_key)
        logger.info("Supabase client successfully initialized for: %s", sb_url)
    else:
        logger.info("Supabase credentials not configured; in-memory repository active.")
except Exception as e:
    logger.warning("Supabase initialization skipped: %s", e)


# Encapsulated In-Memory Session & State Manager (DIP)
session_manager = SessionManager(supabase_client=supabase_client)
envelope_router = EnvelopeRouter()

# Module-Level Backward-Compatibility Aliases
renderer_daemon = session_manager.renderer_daemon
live_sessions: Dict[str, LiveGraphSession] = session_manager.live_sessions
active_connections: Dict[str, Set[WebSocket]] = session_manager.active_connections
memory_store: Dict[str, Dict[str, Any]] = session_manager.memory_store
decision_linker = session_manager.decision_linker
raising_hand_agent = session_manager.raising_hand_agent
spec_generator = session_manager.spec_generator


def get_or_create_session(meeting_id: str) -> LiveGraphSession:
    return session_manager.get_or_create_session(meeting_id)


async def broadcast_to_meeting(meeting_id: str, message: Dict[str, Any], exclude: Optional[WebSocket] = None):
    await session_manager.broadcast_to_meeting(meeting_id, message, exclude=exclude)


# Database Persistence Helpers (backward compatibility wrappers)
async def db_save_transcript_turn(meeting_id: str, speaker_label: str, transcript_text: str, timestamp_ms: int) -> str:
    return await session_manager.db_save_transcript_turn(meeting_id, speaker_label, transcript_text, timestamp_ms)


async def db_save_diagram_snapshot(
    meeting_id: str,
    timestamp_ms: int,
    drawio_xml: str,
    diff_summary: str,
    decision_rationale: Optional[str],
    triggered_by: str,
    overlay_image_url: Optional[str] = None,
) -> str:
    return await session_manager.db_save_diagram_snapshot(
        meeting_id=meeting_id,
        timestamp_ms=timestamp_ms,
        drawio_xml=drawio_xml,
        diff_summary=diff_summary,
        decision_rationale=decision_rationale,
        triggered_by=triggered_by,
        overlay_image_url=overlay_image_url,
    )


# FastAPI Lifespan Handler
@asynccontextmanager
async def lifespan(app: FastAPI):
    validate_auth_config()
    logger.info("Initializing SpecScribe FastAPI Orchestrator lifespan...")
    app.state.session_manager = session_manager
    try:
        await session_manager.renderer_daemon.start()
    except Exception as e:
        logger.error("Failed to pre-warm HeadlessDrawioDaemon: %s", e)

    yield

    logger.info("Shutting down SpecScribe FastAPI Orchestrator...")
    session_manager.raising_hand_agent.stop_all()
    try:
        await session_manager.renderer_daemon.stop()
    except Exception as e:
        logger.warning("Error stopping renderer daemon: %s", e)



app = FastAPI(
    title="SpecScribe AR Orchestrator",
    version="1.2.0",
    description="Full-Duplex Spatial Architecture Hub & Autonomous Agents for Snap Spectacles",
    lifespan=lifespan,
)
app.state.session_manager = session_manager


raw_origins = os.environ.get(
    "ALLOWED_ORIGINS",
    "http://localhost:3000,http://127.0.0.1:3000,https://specscribe.vercel.app",
)
allowed_origins = [o.strip() for o in raw_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# REST Schemas
class CreateMeetingRequest(BaseModel):
    title: Optional[str] = "Spatial Architecture Review"


class AskQuestionRequest(BaseModel):
    question: str


# REST Endpoints
@app.get("/api/health")
async def health_check(session_mgr: SessionManager = Depends(get_session_manager)):
    return {
        "status": "online",
        "renderer_ready": session_mgr.renderer_daemon._is_ready,
        "active_sessions": len(session_mgr.live_sessions),
        "active_agents": {
            "decision_linker": True,
            "raising_hand_agent": True,
            "spec_generator": True,
            "proactive_loops": len(session_mgr.raising_hand_agent._active_loops),
            "proactive_telemetry": session_mgr.raising_hand_agent._loop_telemetry,
        },
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@app.post("/api/meetings", dependencies=[Depends(require_api_token)])
async def create_meeting(
    request: CreateMeetingRequest,
    session_mgr: SessionManager = Depends(get_session_manager),
):
    meeting_id = str(uuid.uuid4())
    session = session_mgr.get_or_create_session(meeting_id)
    record = {
        "id": meeting_id,
        "title": request.title,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "latest_drawio_xml": session.get_xml(),
        "generated_spec_md": None,
    }
    session_mgr.memory_store["meetings"][meeting_id] = record

    if session_mgr.supabase_client:
        try:
            await asyncio.to_thread(
                lambda: session_mgr.supabase_client.table("meetings").insert(record).execute()
            )
        except Exception as e:
            logger.warning("Supabase create meeting error: %s", e)

    return record


def filter_by_window(items: List[Dict[str, Any]], from_t: Optional[int], to_t: Optional[int]) -> List[Dict[str, Any]]:
    res = items
    if from_t is not None:
        res = [x for x in res if x.get("timestamp_ms", 0) >= from_t]
    if to_t is not None:
        res = [x for x in res if x.get("timestamp_ms", 0) <= to_t]
    return res


@app.get("/api/meetings/{meeting_id}/timeline", dependencies=[Depends(require_api_token)])
async def get_meeting_timeline(
    meeting_id: str,
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    from_ms: Optional[int] = Query(default=None, ge=0),
    to_ms: Optional[int] = Query(default=None, ge=0),
    session_mgr: SessionManager = Depends(get_session_manager),
):
    meeting = session_mgr.memory_store["meetings"].get(meeting_id)
    all_turns: List[Dict[str, Any]] = []
    snapshots: List[Dict[str, Any]] = []
    interventions: List[Dict[str, Any]] = []
    knowledge_chunks: List[Dict[str, Any]] = []

    if session_mgr.supabase_client:
        try:
            m_res = await asyncio.to_thread(
                lambda: session_mgr.supabase_client.table("meetings").select("*").eq("id", meeting_id).execute()
            )
            if m_res.data:
                meeting = m_res.data[0]
            t_res = await asyncio.to_thread(
                lambda: session_mgr.supabase_client.table("transcript_turns").select("*").eq("meeting_id", meeting_id).order("timestamp_ms").execute()
            )
            s_res = await asyncio.to_thread(
                lambda: session_mgr.supabase_client.table("diagram_snapshots").select("*").eq("meeting_id", meeting_id).order("timestamp_ms").execute()
            )
            i_res = await asyncio.to_thread(
                lambda: session_mgr.supabase_client.table("agent_interventions").select("*").eq("meeting_id", meeting_id).order("timestamp_ms").execute()
            )
            k_res = await asyncio.to_thread(
                lambda: session_mgr.supabase_client.table("knowledge_chunks").select("id, meeting_id, chunk_type, timestamp_ms, content").eq("meeting_id", meeting_id).order("timestamp_ms").execute()
            )
            all_turns = t_res.data if t_res.data else session_mgr.memory_store["transcript_turns"].get(meeting_id, [])
            snapshots = s_res.data if s_res.data else session_mgr.memory_store["diagram_snapshots"].get(meeting_id, [])
            interventions = i_res.data if i_res.data else session_mgr.memory_store["agent_interventions"].get(meeting_id, [])
            knowledge_chunks = k_res.data if k_res.data else session_mgr.memory_store["knowledge_chunks"].get(meeting_id, [])
        except Exception as e:
            logger.warning("Supabase timeline fetch fallback: %s", e)
            all_turns = session_mgr.memory_store["transcript_turns"].get(meeting_id, [])
            snapshots = session_mgr.memory_store["diagram_snapshots"].get(meeting_id, [])
            interventions = session_mgr.memory_store["agent_interventions"].get(meeting_id, [])
            knowledge_chunks = session_mgr.memory_store["knowledge_chunks"].get(meeting_id, [])
    else:
        all_turns = session_mgr.memory_store["transcript_turns"].get(meeting_id, [])
        snapshots = session_mgr.memory_store["diagram_snapshots"].get(meeting_id, [])
        interventions = session_mgr.memory_store["agent_interventions"].get(meeting_id, [])
        knowledge_chunks = session_mgr.memory_store["knowledge_chunks"].get(meeting_id, [])

    if not meeting:
        # Check if requested demo session
        meeting = {
            "id": meeting_id,
            "title": "Core Architecture Brainstorming: Auth & Real-Time Ingestion",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "latest_drawio_xml": session_mgr.memory_store["meetings"].get(meeting_id, {}).get("latest_drawio_xml"),
        }

    # Time-window filtering
    filtered_turns = filter_by_window(all_turns, from_ms, to_ms)
    filtered_snapshots = filter_by_window(snapshots, from_ms, to_ms) if (from_ms is not None or to_ms is not None) else snapshots
    filtered_interventions = filter_by_window(interventions, from_ms, to_ms) if (from_ms is not None or to_ms is not None) else interventions
    filtered_knowledge = filter_by_window(knowledge_chunks, from_ms, to_ms) if (from_ms is not None or to_ms is not None) else knowledge_chunks

    # Pagination on transcript turns
    total_turns = len(filtered_turns)
    paginated_turns = filtered_turns[offset : offset + limit]
    has_more = (offset + limit) < total_turns

    # Format in-memory knowledge chunks without exposing huge float lists by default
    safe_knowledge_chunks = [
        {
            "id": k.get("id"),
            "meeting_id": k.get("meeting_id"),
            "chunk_type": k.get("chunk_type"),
            "timestamp_ms": k.get("timestamp_ms"),
            "content": k.get("content"),
        }
        for k in filtered_knowledge
    ]

    return {
        "meeting": meeting,
        "transcript_turns": paginated_turns,
        "diagram_snapshots": filtered_snapshots,
        "agent_interventions": filtered_interventions,
        "knowledge_chunks": safe_knowledge_chunks,
        "pagination": {
            "total_turns": total_turns,
            "limit": limit,
            "offset": offset,
            "has_more": has_more,
        },
    }



@app.get("/api/meetings/{meeting_id}/interventions", dependencies=[Depends(require_api_token)])
async def get_meeting_interventions(
    meeting_id: str,
    session_mgr: SessionManager = Depends(get_session_manager),
):
    """Returns all Raising-Hand agent interventions for the specified meeting."""
    if session_mgr.supabase_client:
        try:
            res = await asyncio.to_thread(
                lambda: session_mgr.supabase_client.table("agent_interventions").select("*").eq("meeting_id", meeting_id).order("timestamp_ms").execute()
            )
            if res.data:
                return res.data
        except Exception as e:
            logger.warning("Supabase interventions fetch fallback: %s", e)

    return session_mgr.memory_store["agent_interventions"].get(meeting_id, [])


@app.get("/api/meetings/{meeting_id}/knowledge", dependencies=[Depends(require_api_token)])
async def get_meeting_knowledge_chunks(
    meeting_id: str,
    session_mgr: SessionManager = Depends(get_session_manager),
):
    """Returns all synthesized decision and knowledge chunks for the specified meeting."""
    if session_mgr.supabase_client:
        try:
            res = await asyncio.to_thread(
                lambda: session_mgr.supabase_client.table("knowledge_chunks").select("id, meeting_id, chunk_type, timestamp_ms, content").eq("meeting_id", meeting_id).order("timestamp_ms").execute()
            )
            if res.data:
                return res.data
        except Exception as e:
            logger.warning("Supabase knowledge_chunks fetch fallback: %s", e)

    return [
        {
            "id": k["id"],
            "meeting_id": k["meeting_id"],
            "chunk_type": k["chunk_type"],
            "timestamp_ms": k["timestamp_ms"],
            "content": k["content"],
        }
        for k in session_mgr.memory_store["knowledge_chunks"].get(meeting_id, [])
    ]


@app.post("/api/meetings/{meeting_id}/proactive-critique", dependencies=[Depends(require_api_token)])
async def trigger_proactive_critique(
    meeting_id: str,
    session_mgr: SessionManager = Depends(get_session_manager),
):
    """Triggers an immediate Raising-Hand proactive evaluation for the meeting."""
    session = session_mgr.get_or_create_session(meeting_id)
    xml = session.get_xml()
    ts = int(datetime.now(timezone.utc).timestamp() * 1000)

    evaluation = await session_mgr.raising_hand_agent.evaluate_proactive_async(
        meeting_id=meeting_id,
        timestamp_ms=ts,
        drawio_xml=xml,
    )
    result = None
    if evaluation.trigger:
        result = await session_mgr.raising_hand_agent.persist_and_broadcast(
            meeting_id=meeting_id,
            evaluation=evaluation,
            timestamp_ms=ts,
            was_pinched=False,
            broadcast_fn=session_mgr.broadcast_to_meeting,
        )
    return {
        "trigger": evaluation.trigger,
        "intervention": result,
        "evaluation": evaluation.model_dump(),
    }


@app.post("/api/meetings/{meeting_id}/finalize", dependencies=[Depends(require_api_token)])
async def finalize_meeting(
    meeting_id: str,
    session_mgr: SessionManager = Depends(get_session_manager),
):
    session = session_mgr.get_or_create_session(meeting_id)
    final_xml = session.compile_layout_xml()
    meeting_meta = session_mgr.memory_store["meetings"].get(meeting_id, {})
    title = meeting_meta.get("title")

    result = await session_mgr.spec_generator.finalize_meeting(
        meeting_id=meeting_id,
        drawio_xml=final_xml,
        title=title,
    )
    return result


@app.post("/api/meetings/{meeting_id}/ask", dependencies=[Depends(require_api_token)])
async def ask_meeting_rag(
    meeting_id: str,
    request: AskQuestionRequest,
    session_mgr: SessionManager = Depends(get_session_manager),
):
    return await session_mgr.spec_generator.answer_question(
        meeting_id=meeting_id,
        question=request.question,
    )


# WebSocket Full-Duplex Hub (`/ws/meeting/{meeting_id}`)
@app.websocket("/ws/meeting/{meeting_id}")
async def meeting_websocket_hub(websocket: WebSocket, meeting_id: str):
    session_mgr = getattr(app.state, "session_manager", session_manager)
    if not ws_token_ok(websocket):
        # Close before accept(): the handshake is rejected.
        await websocket.close(code=WS_UNAUTHORIZED_CLOSE_CODE)
        return
    await websocket.accept()
    session_mgr.active_connections[meeting_id].add(websocket)
    session = session_mgr.get_or_create_session(meeting_id)

    if meeting_id not in session_mgr.raising_hand_agent._active_loops or session_mgr.raising_hand_agent._active_loops[meeting_id].done():
        session_mgr.raising_hand_agent.start_proactive_loop(
            meeting_id=meeting_id,
            interval_seconds=20.0,
            get_diagram_fn=lambda mid: session_mgr.live_sessions[mid].get_xml() if mid in session_mgr.live_sessions else "",
            get_timestamp_fn=lambda mid: int(datetime.now(timezone.utc).timestamp() * 1000),
            broadcast_fn=session_mgr.broadcast_to_meeting,
        )

    try:
        while True:
            raw_text = await websocket.receive_text()
            try:
                msg = json.loads(raw_text)
            except Exception as e:
                logger.warning("Malformed JSON received: %s", e)
                continue
            await envelope_router.dispatch(msg, websocket, session_mgr, meeting_id)
    except WebSocketDisconnect:
        logger.info("Client disconnected from meeting %s", meeting_id)
    except Exception as e:
        logger.error("Unexpected WebSocket error in meeting %s: %s", meeting_id, e)
    finally:
        session_mgr.active_connections[meeting_id].discard(websocket)
        if not session_mgr.active_connections[meeting_id]:
            session_mgr.active_connections.pop(meeting_id, None)
            session_mgr.raising_hand_agent.stop_proactive_loop(meeting_id)



if __name__ == "__main__":
    import uvicorn

    host = os.environ.get("HOST", "0.0.0.0")
    port = int(os.environ.get("PORT", "8000"))
    uvicorn.run("main:app", host=host, port=port, reload=False)
