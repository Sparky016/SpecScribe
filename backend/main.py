"""
SpecScribe AR - FastAPI Full-Duplex WebSocket Hub & Orchestrator
Core Backend Architecture (T-05, T-06, T-07, T-08)
"""

import asyncio
import base64
import json
import logging
import os
import uuid
from collections import defaultdict
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Set

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

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
except ImportError:
    from backend.session_manager import (
        SessionManager,
        get_session_manager,
        get_ws_session_manager,
    )

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
        },
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@app.post("/api/meetings")
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


@app.get("/api/meetings/{meeting_id}/timeline")
async def get_meeting_timeline(
    meeting_id: str,
    session_mgr: SessionManager = Depends(get_session_manager),
):
    meeting = session_mgr.memory_store["meetings"].get(meeting_id)

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
            return {
                "meeting": meeting or {"id": meeting_id, "title": "Untitled Meeting"},
                "transcript_turns": t_res.data if t_res.data else session_mgr.memory_store["transcript_turns"].get(meeting_id, []),
                "diagram_snapshots": s_res.data if s_res.data else session_mgr.memory_store["diagram_snapshots"].get(meeting_id, []),
                "agent_interventions": i_res.data if i_res.data else session_mgr.memory_store["agent_interventions"].get(meeting_id, []),
                "knowledge_chunks": k_res.data if k_res.data else [
                    {
                        "id": k["id"],
                        "meeting_id": k["meeting_id"],
                        "chunk_type": k["chunk_type"],
                        "timestamp_ms": k["timestamp_ms"],
                        "content": k["content"],
                    }
                    for k in session_mgr.memory_store["knowledge_chunks"].get(meeting_id, [])
                ],
            }
        except Exception as e:
            logger.warning("Supabase timeline fetch fallback: %s", e)

    if not meeting:
        # Check if requested demo session
        meeting = {
            "id": meeting_id,
            "title": "Core Architecture Brainstorming: Auth & Real-Time Ingestion",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "latest_drawio_xml": session_mgr.memory_store["meetings"].get(meeting_id, {}).get("latest_drawio_xml"),
        }

    # Format in-memory knowledge chunks without exposing huge float lists by default
    safe_knowledge_chunks = [
        {
            "id": k["id"],
            "meeting_id": k["meeting_id"],
            "chunk_type": k["chunk_type"],
            "timestamp_ms": k["timestamp_ms"],
            "content": k["content"],
        }
        for k in session_mgr.memory_store["knowledge_chunks"].get(meeting_id, [])
    ]

    return {
        "meeting": meeting,
        "transcript_turns": session_mgr.memory_store["transcript_turns"].get(meeting_id, []),
        "diagram_snapshots": session_mgr.memory_store["diagram_snapshots"].get(meeting_id, []),
        "agent_interventions": session_mgr.memory_store["agent_interventions"].get(meeting_id, []),
        "knowledge_chunks": safe_knowledge_chunks,
    }


@app.get("/api/meetings/{meeting_id}/interventions")
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


@app.get("/api/meetings/{meeting_id}/knowledge")
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


@app.post("/api/meetings/{meeting_id}/proactive-critique")
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


@app.post("/api/meetings/{meeting_id}/finalize")
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


@app.post("/api/meetings/{meeting_id}/ask")
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
    await websocket.accept()
    session = get_or_create_session(meeting_id)
    active_connections[meeting_id].add(websocket)
    logger.info("Client connected to meeting %s (total clients: %d)", meeting_id, len(active_connections[meeting_id]))

    # Start Raising-Hand Agent proactive loop (Mode A: every 20s) if not already active
    if meeting_id not in raising_hand_agent._active_loops or raising_hand_agent._active_loops[meeting_id].done():
        raising_hand_agent.start_proactive_loop(
            meeting_id=meeting_id,
            interval_seconds=20.0,
            get_diagram_fn=lambda mid: live_sessions[mid].get_xml() if mid in live_sessions else "",
            get_timestamp_fn=lambda mid: int(datetime.now(timezone.utc).timestamp() * 1000),
            broadcast_fn=broadcast_to_meeting,
        )

    try:
        while True:
            raw_text = await websocket.receive_text()
            try:
                msg = json.loads(raw_text)
            except Exception as e:
                logger.warning("Malformed JSON received: %s", e)
                continue

            event_type = msg.get("eventType")
            timestamp_ms = msg.get("timestamp_ms", 0)

            # 1. Handshake Envelope
            if event_type == "handshake":
                logger.info("Handshake received from %s (protocol %s)", msg.get("device"), msg.get("protocolVersion"))
                # If diagram already has nodes, send current rendered diagram immediately
                if len(session.diagram.cells) > 2:
                    try:
                        drawio_xml = session.get_xml()
                        b64_png = await renderer_daemon.render_b64_png(drawio_xml)
                        await websocket.send_text(json.dumps({
                            "event": "DIAGRAM_UPDATED",
                            "snapshot_id": str(uuid.uuid4()),
                            "timestamp_ms": timestamp_ms,
                            "diff_summary": "Initial diagram sync",
                            "decision_rationale": "Initial session synchronization",
                            "image_b64": b64_png,
                        }))
                    except Exception as e:
                        logger.warning("Initial render sync error: %s", e)
                else:
                    await websocket.send_text(json.dumps({
                        "event": "HANDSHAKE_ACK",
                        "status": "ready",
                        "meeting_id": meeting_id,
                    }))

            # 2. ASR Transcription Envelope (T-07 Ingestion)
            elif event_type == "asrTranscription":
                speaker = msg.get("speaker_label", "Speaker 0")
                text = msg.get("transcript_text", "")
                if text.strip():
                    try:
                        turn_id = await db_save_transcript_turn(meeting_id, speaker, text, timestamp_ms)
                        logger.info("[%s @ %dms]: %s", speaker, timestamp_ms, text)
                        await broadcast_to_meeting(meeting_id, {
                            "event": "TRANSCRIPT_LOGGED",
                            "turn_id": turn_id,
                            "speaker_label": speaker,
                            "transcript_text": text,
                            "timestamp_ms": timestamp_ms,
                        }, exclude=websocket)
                    except Exception as e:
                        logger.error("Error processing asrTranscription in meeting %s: %s", meeting_id, e, exc_info=True)

            # 3. Camera Frame Envelope (Perceptual Hash Diff Gate + Vision Extractor)
            elif event_type == "cameraFrame":
                img_b64 = msg.get("image_b64")
                if not img_b64:
                    continue

                try:
                    img_bytes = base64.b64decode(img_b64)
                    has_diff, hamming, current_hash = session.check_image_diff(img_bytes, threshold=6)

                    if not has_diff:
                        logger.debug("Frame skipped by perceptual hash (hamming distance: %d < 6)", hamming)
                        continue

                    logger.info("Frame diff accepted (hamming: %d). Analyzing whiteboard...", hamming)
                    existing_nodes = list(session.node_metadata.values())
                    delta = await extract_graph_delta_from_gemini(img_bytes, existing_nodes)

                    if delta.person_occluding_board:
                        logger.info("Person occluding whiteboard; skipping diagram mutation.")
                        continue

                    if delta.has_meaningful_change:
                        session.apply_delta(delta)
                        drawio_xml = session.compile_layout_xml()
                        b64_png = await renderer_daemon.render_b64_png(drawio_xml)

                        snapshot_id = await db_save_diagram_snapshot(
                            meeting_id=meeting_id,
                            timestamp_ms=timestamp_ms,
                            drawio_xml=drawio_xml,
                            diff_summary=delta.diff_summary,
                            decision_rationale="Incremental whiteboard updates detected",
                            triggered_by="VISION_DIFF",
                        )

                        await broadcast_to_meeting(meeting_id, {
                            "event": "DIAGRAM_UPDATED",
                            "snapshot_id": snapshot_id,
                            "timestamp_ms": timestamp_ms,
                            "diff_summary": delta.diff_summary,
                            "decision_rationale": "Incremental whiteboard updates detected",
                            "image_b64": b64_png,
                        })

                        # Asynchronous Intelligence Sub-Agents (T-07 & T-08)
                        asyncio.create_task(
                            decision_linker.process_snapshot(
                                meeting_id=meeting_id,
                                snapshot_id=snapshot_id,
                                timestamp_ms=timestamp_ms,
                                diff_summary=delta.diff_summary,
                                drawio_xml=drawio_xml,
                                broadcast_fn=broadcast_to_meeting,
                            )
                        )
                        asyncio.create_task(
                            raising_hand_agent.evaluate_proactive_on_change(
                                meeting_id=meeting_id,
                                timestamp_ms=timestamp_ms,
                                drawio_xml=drawio_xml,
                                broadcast_fn=broadcast_to_meeting,
                            )
                        )
                except Exception as e:
                    logger.error("Error processing cameraFrame: %s", e)

            # 4. SIK Pinch Command Envelope (Instant Sub-150ms Mutate & Re-layout)
            elif event_type == "pinchCommand":
                action = msg.get("action", "ADD_NODE")
                try:
                    node_type = msg.get("node_type", "service")
                    label = msg.get("label", f"New {node_type.capitalize()}")

                    if action == "ADD_NODE":
                        node_id = session.add_node(node_type, label)
                        drawio_xml = session.compile_layout_xml()
                        b64_png = await renderer_daemon.render_b64_png(drawio_xml)

                        diff_summary = f"+ Added [{node_type}] {label}"
                        snapshot_id = await db_save_diagram_snapshot(
                            meeting_id=meeting_id,
                            timestamp_ms=timestamp_ms,
                            drawio_xml=drawio_xml,
                            diff_summary=diff_summary,
                            decision_rationale=f"User pinched palette to add {node_type}: '{label}'",
                            triggered_by="PINCH_PALETTE",
                        )

                        logger.info("Pinch ADD_NODE '%s' (%s) rendered in sub-150ms", label, node_type)
                        await broadcast_to_meeting(meeting_id, {
                            "event": "DIAGRAM_UPDATED",
                            "snapshot_id": snapshot_id,
                            "timestamp_ms": timestamp_ms,
                            "diff_summary": diff_summary,
                            "decision_rationale": f"User added {node_type}: '{label}'",
                            "image_b64": b64_png,
                        })

                        # Asynchronously trigger Decision Linker & Raising-Hand Agent (T-07 & T-08)
                        asyncio.create_task(
                            decision_linker.process_snapshot(
                                meeting_id=meeting_id,
                                snapshot_id=snapshot_id,
                                timestamp_ms=timestamp_ms,
                                diff_summary=diff_summary,
                                drawio_xml=drawio_xml,
                                broadcast_fn=broadcast_to_meeting,
                            )
                        )
                        asyncio.create_task(
                            raising_hand_agent.evaluate_proactive_on_change(
                                meeting_id=meeting_id,
                                timestamp_ms=timestamp_ms,
                                drawio_xml=drawio_xml,
                                broadcast_fn=broadcast_to_meeting,
                            )
                        )

                    elif action == "CONNECT_NODES":
                        source = msg.get("source") or msg.get("source_id", "")
                        target = msg.get("target") or msg.get("target_id", "")
                        edge_label = msg.get("edge_label", "")
                        edge_id = session.add_edge(source, target, edge_label)
                        if edge_id:
                            drawio_xml = session.compile_layout_xml()
                            b64_png = await renderer_daemon.render_b64_png(drawio_xml)
                            diff_summary = f"Connected {source} → {target}"
                            snapshot_id = await db_save_diagram_snapshot(
                                meeting_id=meeting_id,
                                timestamp_ms=timestamp_ms,
                                drawio_xml=drawio_xml,
                                diff_summary=diff_summary,
                                decision_rationale=f"Connected {source} to {target}",
                                triggered_by="PINCH_PALETTE",
                            )
                            await broadcast_to_meeting(meeting_id, {
                                "event": "DIAGRAM_UPDATED",
                                "snapshot_id": snapshot_id,
                                "timestamp_ms": timestamp_ms,
                                "diff_summary": diff_summary,
                                "decision_rationale": f"Connected {source} to {target}",
                                "image_b64": b64_png,
                            })

                            asyncio.create_task(
                                decision_linker.process_snapshot(
                                    meeting_id=meeting_id,
                                    snapshot_id=snapshot_id,
                                    timestamp_ms=timestamp_ms,
                                    diff_summary=diff_summary,
                                    drawio_xml=drawio_xml,
                                    broadcast_fn=broadcast_to_meeting,
                                )
                            )
                            asyncio.create_task(
                                raising_hand_agent.evaluate_proactive_on_change(
                                    meeting_id=meeting_id,
                                    timestamp_ms=timestamp_ms,
                                    drawio_xml=drawio_xml,
                                    broadcast_fn=broadcast_to_meeting,
                                )
                            )
                        else:
                            logger.warning("Failed to connect nodes '%s' → '%s' (nodes not found in session)", source, target)
                            await websocket.send_text(json.dumps({
                                "event": "COMMAND_ERROR",
                                "action": "CONNECT_NODES",
                                "message": f"Could not connect '{source}' to '{target}': one or both nodes not found in graph.",
                                "timestamp_ms": timestamp_ms,
                            }))

                    elif action == "ASK_AGENT":
                        query = msg.get("label", "") or msg.get("query", "Architectural feedback")
                        logger.info("User triggered research pull: %s", query)
                        # Mode B (On-Demand Research Pull via RaisingHandAgent)
                        intervention = await raising_hand_agent.handle_research_pull(
                            meeting_id=meeting_id,
                            query=query,
                            timestamp_ms=timestamp_ms,
                            drawio_xml=session.get_xml(),
                            broadcast_fn=broadcast_to_meeting,
                        )

                    else:
                        logger.warning("Unrecognized pinchCommand action: %s", action)
                        await websocket.send_text(json.dumps({
                            "event": "COMMAND_ERROR",
                            "action": action,
                            "message": f"Unrecognized pinchCommand action: '{action}'",
                            "timestamp_ms": timestamp_ms,
                        }))

                except Exception as e:
                    logger.error("Error executing pinchCommand '%s': %s", action, e, exc_info=True)
                    try:
                        await websocket.send_text(json.dumps({
                            "event": "COMMAND_ERROR",
                            "action": action,
                            "message": str(e),
                            "timestamp_ms": timestamp_ms,
                        }))
                    except Exception as send_err:
                        logger.warning("Failed to dispatch COMMAND_ERROR to client: %s", send_err)

    except WebSocketDisconnect:
        logger.info("Client disconnected from meeting %s", meeting_id)
    except Exception as e:
        logger.error("Unexpected WebSocket error in meeting %s: %s", meeting_id, e)
    finally:
        active_connections[meeting_id].discard(websocket)
        if not active_connections[meeting_id]:
            active_connections.pop(meeting_id, None)
            raising_hand_agent.stop_proactive_loop(meeting_id)


if __name__ == "__main__":
    import uvicorn

    host = os.environ.get("HOST", "0.0.0.0")
    port = int(os.environ.get("PORT", "8000"))
    uvicorn.run("main:app", host=host, port=port, reload=False)
