"""
EnvelopeRouter and message handlers for SpecScribe WebSocket Hub
Part of SpecScribe AR Backend (T-05, T-06, T-07, T-08)
Decomposing meeting_websocket_hub into modular SRP handlers.
Source: SPEC_DOC.md §4.2 (Finding #7)
"""

from abc import ABC, abstractmethod
import asyncio
import base64
import json
import logging
import os
import sys
import time
from typing import Any, Dict, Optional
import uuid

from fastapi import WebSocket

from contracts import PinchAction

backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

try:
    from graph_engine import extract_graph_delta_from_gemini
except (ImportError, ModuleNotFoundError):
    from backend.graph_engine import extract_graph_delta_from_gemini

logger = logging.getLogger("specscribe.envelope_router")


class BaseEnvelopeHandler(ABC):
    """Abstract base class for all envelope message handlers."""

    @abstractmethod
    async def handle(
        self,
        msg: Dict[str, Any],
        websocket: WebSocket,
        session_mgr: Any,
        meeting_id: str,
    ) -> None:
        """Process an inbound envelope message."""
        pass


class HandshakeHandler(BaseEnvelopeHandler):
    """Handles device protocol handshake and initial diagram synchronization."""

    async def handle(
        self,
        msg: Dict[str, Any],
        websocket: WebSocket,
        session_mgr: Any,
        meeting_id: str,
    ) -> None:
        logger.info(
            "Handshake received from %s (protocol %s)",
            msg.get("device"),
            msg.get("protocolVersion"),
        )
        session = session_mgr.get_or_create_session(meeting_id)
        timestamp_ms = msg.get("timestamp_ms", 0)

        # If diagram already has nodes, send current rendered diagram immediately
        if len(session.diagram.cells) > 2:
            try:
                drawio_xml = session.compile_layout_xml()
                b64_png = await session_mgr.renderer_daemon.render_b64_png(drawio_xml)
                await websocket.send_text(
                    json.dumps({
                        "event": "DIAGRAM_UPDATED",
                        "snapshot_id": str(uuid.uuid4()),
                        "timestamp_ms": timestamp_ms,
                        "diff_summary": "Initial diagram sync",
                        "decision_rationale": "Initial session synchronization",
                        "image_b64": b64_png,
                    })
                )
            except Exception as e:
                logger.warning("Initial render sync error: %s", e)
        else:
            await websocket.send_text(
                json.dumps({
                    "event": "HANDSHAKE_ACK",
                    "status": "ready",
                    "meeting_id": meeting_id,
                })
            )


class AsrHandler(BaseEnvelopeHandler):
    """Handles speech-to-text transcript turns, persisting and broadcasting them."""

    async def handle(
        self,
        msg: Dict[str, Any],
        websocket: WebSocket,
        session_mgr: Any,
        meeting_id: str,
    ) -> None:
        speaker = msg.get("speaker_label", "Speaker 0")
        text = msg.get("transcript_text", "")
        timestamp_ms = msg.get("timestamp_ms", 0)

        if text.strip():
            try:
                turn_id = await session_mgr.db_save_transcript_turn(
                    meeting_id, speaker, text, timestamp_ms
                )
                logger.info("[%s @ %dms]: %s", speaker, timestamp_ms, text)
                await session_mgr.broadcast_to_meeting(
                    meeting_id,
                    {
                        "event": "TRANSCRIPT_LOGGED",
                        "turn_id": turn_id,
                        "speaker_label": speaker,
                        "transcript_text": text,
                        "timestamp_ms": timestamp_ms,
                    },
                    exclude=websocket,
                )
            except Exception as e:
                logger.error(
                    "Error processing asrTranscription in meeting %s: %s",
                    meeting_id,
                    e,
                    exc_info=True,
                )


class CameraFrameHandler(BaseEnvelopeHandler):
    """Handles perceptual hash diff gating, vision analysis, and diagram re-render."""

    VISION_COOLDOWN_SEC: float = 2.5

    async def handle(
        self,
        msg: Dict[str, Any],
        websocket: WebSocket,
        session_mgr: Any,
        meeting_id: str,
    ) -> None:
        img_b64 = msg.get("image_b64")
        if not img_b64 and isinstance(msg.get("payload"), dict):
            img_b64 = msg.get("payload", {}).get("image_b64")
        if not img_b64:
            return

        timestamp_ms = msg.get("timestamp_ms", 0)
        session = session_mgr.get_or_create_session(meeting_id)

        # Prevent concurrent vision extractions on the same session
        if getattr(session, "_vision_in_flight", False):
            logger.debug("Vision analysis already in-flight; skipping frame.")
            return

        payload = msg.get("payload") if isinstance(msg.get("payload"), dict) else msg
        is_manual = bool(
            payload.get("isManual", False)
            or payload.get("isManualTrigger", False)
            or payload.get("captureMode") == "MANUAL"
            or msg.get("isManual", False)
            or msg.get("isManualTrigger", False)
            or msg.get("captureMode") == "MANUAL"
        )

        now = time.time()
        # Cooldown between vision calls to avoid Gemini 429 quota exhaustion
        last_vision = getattr(session, "_last_vision_time", None)
        if not is_manual and last_vision is not None and (now - last_vision < self.VISION_COOLDOWN_SEC):
            logger.debug("Vision analysis cooldown active; skipping frame.")
            return

        session._vision_in_flight = True
        try:
            img_bytes = base64.b64decode(img_b64)
            has_diff, hamming, current_hash = await asyncio.to_thread(
                session.check_image_diff, img_bytes, threshold=6
            )

            if is_manual:
                session.last_phash = current_hash

            if not has_diff and not is_manual:
                logger.debug(
                    "Frame skipped by perceptual hash (hamming distance: %d < 6)",
                    hamming,
                )
                return

            logger.info("Frame diff accepted (hamming: %d, is_manual=%s). Analyzing whiteboard...", hamming, is_manual)
            session._last_vision_time = now
            existing_nodes = list(session.node_metadata.values())
            delta = await extract_graph_delta_from_gemini(img_bytes, existing_nodes)

            logger.info(
                "Vision delta result: occluding=%s, meaningful=%s, summary=%s, nodes=%d",
                delta.person_occluding_board,
                delta.has_meaningful_change,
                delta.diff_summary,
                len(delta.added_vertices),
            )

            # Step-aside rule: only skip if the person is truly occluding AND no vertices were identified
            if delta.person_occluding_board and not delta.added_vertices and not delta.added_edges:
                logger.info("Person occluding whiteboard; skipping diagram mutation.")
                return

            if delta.has_meaningful_change or delta.added_vertices or delta.added_edges:
                session.apply_delta(delta)
                drawio_xml = session.compile_layout_xml()
                b64_png = await session_mgr.renderer_daemon.render_b64_png(drawio_xml)

                snapshot_id = await session_mgr.db_save_diagram_snapshot(
                    meeting_id=meeting_id,
                    timestamp_ms=timestamp_ms,
                    drawio_xml=drawio_xml,
                    diff_summary=delta.diff_summary,
                    decision_rationale="Incremental whiteboard updates detected",
                    triggered_by="VISION_DIFF",
                )

                await session_mgr.broadcast_to_meeting(
                    meeting_id,
                    {
                        "event": "DIAGRAM_UPDATED",
                        "snapshot_id": snapshot_id,
                        "timestamp_ms": timestamp_ms,
                        "diff_summary": delta.diff_summary,
                        "decision_rationale": "Incremental whiteboard updates detected",
                        "image_b64": b64_png,
                    },
                )

                # Asynchronous Intelligence Sub-Agents (T-07 & T-08)
                session_mgr.spawn(
                    session_mgr.decision_linker.process_snapshot(
                        meeting_id=meeting_id,
                        snapshot_id=snapshot_id,
                        timestamp_ms=timestamp_ms,
                        diff_summary=delta.diff_summary,
                        drawio_xml=drawio_xml,
                        broadcast_fn=session_mgr.broadcast_to_meeting,
                    )
                )
                session_mgr.spawn(
                    session_mgr.raising_hand_agent.evaluate_proactive_on_change(
                        meeting_id=meeting_id,
                        timestamp_ms=timestamp_ms,
                        drawio_xml=drawio_xml,
                        broadcast_fn=session_mgr.broadcast_to_meeting,
                    )
                )
        except Exception as e:
            logger.error("Error processing cameraFrame: %s", e)
        finally:
            session._vision_in_flight = False


class PinchCommandHandler(BaseEnvelopeHandler):
    """Handles SIK Pinch gestures (ADD_NODE, CONNECT_NODES, ASK_AGENT) with COMMAND_ERROR resilience."""

    async def handle(
        self,
        msg: Dict[str, Any],
        websocket: WebSocket,
        session_mgr: Any,
        meeting_id: str,
    ) -> None:
        action = msg.get("action", "ADD_NODE")
        timestamp_ms = msg.get("timestamp_ms", 0)
        session = session_mgr.get_or_create_session(meeting_id)

        try:
            node_type = msg.get("node_type", "service")
            label = msg.get("label", f"New {node_type.capitalize()}")

            if action == PinchAction.ADD_NODE:
                node_id = session.add_node(node_type, label)
                label = session.node_metadata[node_id]["label"]
                verb = "~ Updated" if session.last_node_reused else "+ Added"
                drawio_xml = session.compile_layout_xml()
                b64_png = await session_mgr.renderer_daemon.render_b64_png(drawio_xml)

                diff_summary = f"{verb} [{node_type}] {label}"
                snapshot_id = await session_mgr.db_save_diagram_snapshot(
                    meeting_id=meeting_id,
                    timestamp_ms=timestamp_ms,
                    drawio_xml=drawio_xml,
                    diff_summary=diff_summary,
                    decision_rationale=f"User pinched palette to add {node_type}: '{label}'",
                    triggered_by="PINCH_PALETTE",
                )

                logger.info("Pinch ADD_NODE '%s' (%s) rendered in sub-150ms", label, node_type)
                await session_mgr.broadcast_to_meeting(
                    meeting_id,
                    {
                        "event": "DIAGRAM_UPDATED",
                        "snapshot_id": snapshot_id,
                        "timestamp_ms": timestamp_ms,
                        "diff_summary": diff_summary,
                        "decision_rationale": f"User added {node_type}: '{label}'",
                        "image_b64": b64_png,
                    },
                )

                session_mgr.spawn(
                    session_mgr.decision_linker.process_snapshot(
                        meeting_id=meeting_id,
                        snapshot_id=snapshot_id,
                        timestamp_ms=timestamp_ms,
                        diff_summary=diff_summary,
                        drawio_xml=drawio_xml,
                        broadcast_fn=session_mgr.broadcast_to_meeting,
                    )
                )
                session_mgr.spawn(
                    session_mgr.raising_hand_agent.evaluate_proactive_on_change(
                        meeting_id=meeting_id,
                        timestamp_ms=timestamp_ms,
                        drawio_xml=drawio_xml,
                        broadcast_fn=session_mgr.broadcast_to_meeting,
                    )
                )

            elif action == PinchAction.CONNECT_NODES:
                source = msg.get("source") or msg.get("source_id", "")
                target = msg.get("target") or msg.get("target_id", "")
                edge_label = msg.get("edge_label", "")
                edge_id = session.add_edge(source, target, edge_label)
                if edge_id:
                    drawio_xml = session.compile_layout_xml()
                    b64_png = await session_mgr.renderer_daemon.render_b64_png(drawio_xml)
                    diff_summary = f"Connected {source} → {target}"
                    snapshot_id = await session_mgr.db_save_diagram_snapshot(
                        meeting_id=meeting_id,
                        timestamp_ms=timestamp_ms,
                        drawio_xml=drawio_xml,
                        diff_summary=diff_summary,
                        decision_rationale=f"Connected {source} to {target}",
                        triggered_by="PINCH_PALETTE",
                    )
                    await session_mgr.broadcast_to_meeting(
                        meeting_id,
                        {
                            "event": "DIAGRAM_UPDATED",
                            "snapshot_id": snapshot_id,
                            "timestamp_ms": timestamp_ms,
                            "diff_summary": diff_summary,
                            "decision_rationale": f"Connected {source} to {target}",
                            "image_b64": b64_png,
                        },
                    )

                    session_mgr.spawn(
                        session_mgr.decision_linker.process_snapshot(
                            meeting_id=meeting_id,
                            snapshot_id=snapshot_id,
                            timestamp_ms=timestamp_ms,
                            diff_summary=diff_summary,
                            drawio_xml=drawio_xml,
                            broadcast_fn=session_mgr.broadcast_to_meeting,
                        )
                    )
                    session_mgr.spawn(
                        session_mgr.raising_hand_agent.evaluate_proactive_on_change(
                            meeting_id=meeting_id,
                            timestamp_ms=timestamp_ms,
                            drawio_xml=drawio_xml,
                            broadcast_fn=session_mgr.broadcast_to_meeting,
                        )
                    )
                else:
                    logger.warning(
                        "Failed to connect nodes '%s' → '%s' (nodes not found in session)",
                        source,
                        target,
                    )
                    await websocket.send_text(
                        json.dumps({
                            "event": "COMMAND_ERROR",
                            "action": "CONNECT_NODES",
                            "message": f"Could not connect '{source}' to '{target}': one or both nodes not found in graph.",
                            "timestamp_ms": timestamp_ms,
                        })
                    )

            elif action == PinchAction.ASK_AGENT:
                query = msg.get("label", "") or msg.get("query", "Architectural feedback")
                logger.info("User triggered research pull: %s", query)
                await session_mgr.raising_hand_agent.handle_research_pull(
                    meeting_id=meeting_id,
                    query=query,
                    timestamp_ms=timestamp_ms,
                    drawio_xml=session.get_xml(),
                    broadcast_fn=session_mgr.broadcast_to_meeting,
                )

            elif action == PinchAction.CONCLUDE_MEETING:
                result = await session_mgr.spec_generator.finalize_meeting(
                    meeting_id=meeting_id,
                    drawio_xml=session.compile_layout_xml(),
                    title=session_mgr.memory_store["meetings"].get(meeting_id, {}).get("title"),
                )
                session_mgr.raising_hand_agent.stop_proactive_loop(meeting_id)
                await session_mgr.broadcast_to_meeting(
                    meeting_id,
                    {
                        "type": "MEETING_FINALIZED",
                        "event": "MEETING_FINALIZED",
                        "meeting_id": meeting_id,
                        "timestamp_ms": timestamp_ms,
                        "chunks_created": result.get("chunks_created"),
                    },
                )

            elif action in PinchAction.CLIENT_ONLY:
                if action == PinchAction.CALIBRATE_AREA and os.environ.get("SPECSCRIBE_DEMO_MODE") == "1":
                    from drawio_mcp.models import DrawioFile
                    session.file = DrawioFile()
                    session.diagram = session.file.active_diagram
                    session.diagram.name = "ARStream"
                    session.node_by_label.clear()
                    session.node_by_key.clear()
                    session.node_metadata.clear()
                    logger.info("CALIBRATE_AREA: reset session diagram for fresh whiteboard demo ingestion.")
                await websocket.send_text(
                    json.dumps({
                        "event": "COMMAND_ACK",
                        "action": action,
                        "timestamp_ms": timestamp_ms,
                    })
                )

            else:
                logger.warning("Unrecognized pinchCommand action: %s", action)
                await websocket.send_text(
                    json.dumps({
                        "event": "COMMAND_ERROR",
                        "action": action,
                        "message": f"Unrecognized pinchCommand action: '{action}'",
                        "timestamp_ms": timestamp_ms,
                    })
                )

        except Exception as e:
            logger.error("Error executing pinchCommand '%s': %s", action, e, exc_info=True)
            try:
                await websocket.send_text(
                    json.dumps({
                        "event": "COMMAND_ERROR",
                        "action": action,
                        "message": str(e),
                        "timestamp_ms": timestamp_ms,
                    })
                )
            except Exception as send_err:
                logger.warning("Failed to dispatch COMMAND_ERROR to client: %s", send_err)


class EnvelopeRouter:
    """Dispatches inbound WebSocket envelopes to registered handlers."""

    def __init__(self):
        self._handlers: Dict[str, BaseEnvelopeHandler] = {}
        self._register_default_handlers()

    def _register_default_handlers(self):
        self.register("handshake", HandshakeHandler())
        self.register("asrTranscription", AsrHandler())
        self.register("cameraFrame", CameraFrameHandler())
        self.register("pinchCommand", PinchCommandHandler())

    def register(self, event_type: str, handler: BaseEnvelopeHandler) -> None:
        self._handlers[event_type] = handler

    async def dispatch(
        self,
        msg: Dict[str, Any],
        websocket: WebSocket,
        session_mgr: Any,
        meeting_id: str,
    ) -> None:
        event_type = msg.get("eventType")
        handler = self._handlers.get(event_type)
        if handler:
            await handler.handle(msg, websocket, session_mgr, meeting_id)
        else:
            logger.warning("No handler registered for eventType: %s", event_type)
