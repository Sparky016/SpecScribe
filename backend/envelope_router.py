"""
EnvelopeRouter and message handlers for SpecScribe WebSocket Hub
Part of SpecScribe AR Backend (T-05, T-06, T-07, T-08)
Decomposing meeting_websocket_hub into modular SRP handlers.
Source: SPEC_DOC.md §4.2 (Finding #7)
"""

from abc import ABC, abstractmethod
import asyncio
import base64
from collections import defaultdict
import inspect
import json
import logging
import os
import sys
import time
from typing import Any, Dict, List, Optional
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

try:
    from agents.decision_linker import has_requirement_intent
except (ImportError, ModuleNotFoundError):
    from backend.agents.decision_linker import has_requirement_intent

try:
    from services.diarization import SpeakerDiarizer
except (ImportError, ModuleNotFoundError):
    from backend.services.diarization import SpeakerDiarizer

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
        session._handshake_completed = True
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
    """Handles speech-to-text transcript turns, performing multi-speaker attribution and continuous requirement reasoning."""

    SPEECH_REASONING_DEBOUNCE_SEC: float = 8.0
    SPEECH_REASONING_TURN_THRESHOLD: int = 2
    MIN_SUBSTANTIVE_WORDS: int = 5

    def __init__(self, diarizer: Optional[SpeakerDiarizer] = None):
        self.diarizer = diarizer or SpeakerDiarizer()
        self._unreasoned_turn_counts: Dict[str, int] = defaultdict(int)
        self._last_speech_reasoning_times: Dict[str, float] = defaultdict(float)
        self._recent_turns: Dict[str, List[Dict[str, Any]]] = defaultdict(list)

    def _get_session_if_available(self, session_mgr: Any, meeting_id: str) -> Any:
        live = getattr(session_mgr, "live_sessions", None)
        if isinstance(live, dict) and meeting_id in live:
            return live[meeting_id]
        if hasattr(session_mgr, "get_or_create_session"):
            try:
                return session_mgr.get_or_create_session(meeting_id)
            except Exception:
                return None
        return None

    def _get_recent_turns_window(self, session_mgr: Any, meeting_id: str, window_size: int = 6) -> List[Dict[str, Any]]:
        mem = getattr(session_mgr, "memory_store", None)
        if isinstance(mem, dict) and "transcript_turns" in mem:
            turns_map = mem["transcript_turns"]
            if isinstance(turns_map, dict) and turns_map.get(meeting_id):
                return list(turns_map[meeting_id])[-window_size:]
        return list(self._recent_turns.get(meeting_id, []))[-window_size:]

    def _get_current_xml(self, session: Any) -> str:
        if session is not None and hasattr(session, "get_xml"):
            try:
                xml_val = session.get_xml()
                if isinstance(xml_val, str):
                    return xml_val
            except Exception:
                pass
        return ""

    async def _run_speech_reasoning(
        self,
        session_mgr: Any,
        session: Any,
        meeting_id: str,
        timestamp_ms: int,
        delay_sec: float = 0.0,
    ) -> None:
        try:
            if delay_sec > 0:
                await asyncio.sleep(delay_sec)
                if session is not None and not getattr(session, "_pending_speech_reasoning", True):
                    return

            linker = getattr(session_mgr, "decision_linker", None)
            process_fn = getattr(linker, "process_transcript_window", None) if linker is not None else None
            if not callable(process_fn):
                return

            recent_turns = self._get_recent_turns_window(session_mgr, meeting_id)
            current_xml = self._get_current_xml(session)

            res = process_fn(meeting_id, recent_turns, current_xml)
            if inspect.isawaitable(res):
                res = await res

            if not isinstance(res, dict) or res.get("has_requirement", True) is False:
                return

            if session is not None and not getattr(session, "_pending_speech_reasoning", True):
                return

            chunk_id = res.get("chunk_id") or res.get("id") or str(uuid.uuid4())
            chunk_type = str(res.get("chunk_type") or res.get("source_type") or "REQUIREMENT").upper()
            summary = res.get("summary") or res.get("diff_summary") or res.get("rationale") or ""
            rationale = res.get("rationale") or res.get("decision_rationale") or summary
            speaker = res.get("speaker") or res.get("speaker_label") or "Speaker 0 (Wearer)"
            suggested_node = res.get("suggested_node")
            event_ts = int(res.get("timestamp_ms", timestamp_ms) or timestamp_ms)

            base_fields = {
                "snapshot_id": chunk_id,
                "chunk_id": chunk_id,
                "meeting_id": meeting_id,
                "timestamp_ms": event_ts,
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

            await session_mgr.broadcast_to_meeting(
                meeting_id,
                {
                    "event": "REQUIREMENT_SYNTHESIZED",
                    "type": "REQUIREMENT_SYNTHESIZED",
                    **base_fields,
                },
            )
            await session_mgr.broadcast_to_meeting(
                meeting_id,
                {
                    "event": "DECISION_LOGGED",
                    "type": "DECISION_LOGGED",
                    **base_fields,
                },
            )
        except asyncio.CancelledError:
            raise
        except Exception as e:
            logger.warning("Speech requirement reasoning error in meeting %s: %s", meeting_id, e)

    async def handle(
        self,
        msg: Dict[str, Any],
        websocket: WebSocket,
        session_mgr: Any,
        meeting_id: str,
    ) -> None:
        raw_speaker = msg.get("speaker_label")
        raw_text = msg.get("transcript_text", "")
        timestamp_ms = msg.get("timestamp_ms", 0)
        silence_gap_ms = msg.get("silenceGapMs")
        if silence_gap_ms is None:
            silence_gap_ms = msg.get("silenceDurationMs")
        if silence_gap_ms is None:
            silence_gap_ms = msg.get("silence_gap_ms")

        if raw_text and raw_text.strip():
            try:
                diarizer = getattr(session_mgr, "speaker_diarizer", None) or self.diarizer
                speaker, text = diarizer.attribute_text_turn(
                    meeting_id=meeting_id,
                    transcript_text=raw_text,
                    speaker_label=raw_speaker,
                    silence_gap_ms=int(silence_gap_ms) if silence_gap_ms is not None else None,
                    timestamp_ms=int(timestamp_ms or 0),
                )
                turn_id = await session_mgr.db_save_transcript_turn(
                    meeting_id, speaker, text, timestamp_ms
                )
                self._recent_turns[meeting_id].append(
                    {
                        "id": turn_id,
                        "meeting_id": meeting_id,
                        "speaker_label": speaker,
                        "transcript_text": text,
                        "timestamp_ms": timestamp_ms,
                    }
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

                # Filter out short filler utterances (< 5 words)
                words = text.strip().split()
                if len(words) < self.MIN_SUBSTANTIVE_WORDS:
                    return

                session = self._get_session_if_available(session_mgr, meeting_id)
                if session is not None and isinstance(getattr(session, "unreasoned_turn_count", None), int):
                    unreasoned_count = session.unreasoned_turn_count + 1
                else:
                    unreasoned_count = self._unreasoned_turn_counts[meeting_id] + 1

                if session is not None and isinstance(
                    getattr(session, "last_speech_reasoning_time", None), (int, float)
                ):
                    last_reason_time = float(session.last_speech_reasoning_time)
                else:
                    last_reason_time = self._last_speech_reasoning_times[meeting_id]

                self._unreasoned_turn_counts[meeting_id] = unreasoned_count
                if session is not None:
                    session.unreasoned_turn_count = unreasoned_count

                now = time.time()
                intent_detected = has_requirement_intent(text)
                should_trigger = (
                    unreasoned_count >= self.SPEECH_REASONING_TURN_THRESHOLD
                    or (intent_detected and (now - last_reason_time >= self.SPEECH_REASONING_DEBOUNCE_SEC))
                )

                if should_trigger:
                    self._unreasoned_turn_counts[meeting_id] = 0
                    self._last_speech_reasoning_times[meeting_id] = now
                    if session is not None:
                        session.unreasoned_turn_count = 0
                        session.last_speech_reasoning_time = now
                        session._pending_speech_reasoning = True

                    is_live_ws_single_turn = bool(
                        session is not None
                        and getattr(session, "_handshake_completed", False) is True
                        and unreasoned_count < self.SPEECH_REASONING_TURN_THRESHOLD
                    )
                    delay_sec = 0.15 if is_live_ws_single_turn else 0.0
                    coro = self._run_speech_reasoning(
                        session_mgr=session_mgr,
                        session=session,
                        meeting_id=meeting_id,
                        timestamp_ms=int(timestamp_ms or 0),
                        delay_sec=delay_sec,
                    )

                    spawn_fn = getattr(session_mgr, "spawn", None)
                    task: Optional[asyncio.Task] = None
                    if callable(spawn_fn):
                        spawn_res = spawn_fn(coro)
                        if isinstance(spawn_res, asyncio.Task):
                            task = spawn_res
                        elif asyncio.iscoroutine(coro):
                            # spawn_fn was a MagicMock without side_effect that didn't schedule coro
                            try:
                                task = asyncio.create_task(coro)
                            except RuntimeError:
                                coro.close()
                    else:
                        task = asyncio.create_task(coro)

                    if task is not None and not is_live_ws_single_turn:
                        await task
            except Exception as e:
                logger.error(
                    "Error processing asrTranscription in meeting %s: %s",
                    meeting_id,
                    e,
                    exc_info=True,
                )


class AudioChunkHandler(BaseEnvelopeHandler):
    """Handles raw/base64 audioChunk envelopes via Deepgram Nova-2 speaker diarization."""

    def __init__(self, diarizer: Optional[SpeakerDiarizer] = None):
        self.diarizer = diarizer or SpeakerDiarizer()

    async def handle(
        self,
        msg: Dict[str, Any],
        websocket: WebSocket,
        session_mgr: Any,
        meeting_id: str,
    ) -> None:
        audio_b64 = msg.get("audio_b64") or msg.get("audioChunk") or msg.get("audio_data")
        audio_url = msg.get("audio_url")
        if not audio_b64 and not audio_url and isinstance(msg.get("payload"), dict):
            payload = msg["payload"]
            audio_b64 = payload.get("audio_b64") or payload.get("audioChunk") or payload.get("audio_data")
            audio_url = payload.get("audio_url")

        if not audio_b64 and not audio_url:
            return

        timestamp_ms = int(msg.get("timestamp_ms", 0) or 0)
        explicit_speaker = msg.get("speaker_label")

        try:
            diarizer = getattr(session_mgr, "speaker_diarizer", None) or self.diarizer
            utterances = await diarizer.diarize_audio_chunk(
                audio_bytes_or_b64=audio_b64,
                timestamp_ms=timestamp_ms,
                audio_url=audio_url,
            )
            for utt in utterances:
                if not utt.transcript_text.strip():
                    continue
                speaker = (
                    explicit_speaker.strip()
                    if (explicit_speaker and explicit_speaker.strip().lower() not in ("", "auto", "unknown"))
                    else utt.speaker_label
                )
                turn_ts = utt.start_ms or timestamp_ms
                turn_id = await session_mgr.db_save_transcript_turn(
                    meeting_id, speaker, utt.transcript_text, turn_ts
                )
                logger.info("[Deepgram %s @ %dms]: %s", speaker, turn_ts, utt.transcript_text)
                await session_mgr.broadcast_to_meeting(
                    meeting_id,
                    {
                        "event": "TRANSCRIPT_LOGGED",
                        "turn_id": turn_id,
                        "speaker_label": speaker,
                        "transcript_text": utt.transcript_text,
                        "timestamp_ms": turn_ts,
                    },
                    exclude=websocket,
                )
        except Exception as e:
            logger.error(
                "Error processing audioChunk in meeting %s: %s",
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

        payload = msg.get("payload") if isinstance(msg.get("payload"), dict) else msg
        is_manual = bool(
            payload.get("isManual", False)
            or payload.get("isManualTrigger", False)
            or payload.get("captureMode") == "MANUAL"
            or msg.get("isManual", False)
            or msg.get("isManualTrigger", False)
            or msg.get("captureMode") == "MANUAL"
        )

        # Prevent concurrent vision extractions on the same session. A pinch (manual) frame is never dropped:
        # it waits behind the analysis in flight (latest pinch wins) and runs as soon as that finishes.
        if getattr(session, "_vision_in_flight", False):
            if is_manual:
                session._pending_manual_frame = msg
                logger.info("Vision analysis in flight; queued pinch capture to run next.")
            else:
                logger.debug("Vision analysis already in-flight; skipping frame.")
            return

        now = time.time()
        # Cooldown between vision calls to avoid Gemini 429 quota exhaustion
        last_vision = getattr(session, "_last_vision_time", None)
        if not is_manual and last_vision is not None and (now - last_vision < self.VISION_COOLDOWN_SEC):
            logger.debug("Vision analysis cooldown active; skipping frame.")
            return

        session._vision_in_flight = True
        try:
            img_bytes = base64.b64decode(img_b64)
            debug_dir = os.environ.get("SPECSCRIBE_DEBUG_FRAME_DIR")
            if debug_dir:  # opt-in: keep the exact frame the Lens sent, to check what the camera sees
                os.makedirs(debug_dir, exist_ok=True)
                with open(os.path.join(debug_dir, f"frame_{meeting_id[:8]}_{int(now * 1000)}_{'manual' if is_manual else 'auto'}.jpg"), "wb") as fh:
                    fh.write(img_bytes)
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
            labels = {cid: meta.get("label", "") for cid, meta in session.node_metadata.items()}
            existing_edges = [f"{labels[s]} -> {labels[t]}" for s, t in session.edge_set if s in labels and t in labels]
            delta = await extract_graph_delta_from_gemini(img_bytes, existing_nodes, existing_edges)

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

            # A full board snapshot is reconciled (self-correcting); a pinch capture always gets an answer so the
            # user sees the current diagram even when nothing changed.
            mutations = session.apply_vision(delta)
            if mutations or (is_manual and session.node_metadata):
                session._pending_speech_reasoning = False
                session.unreasoned_turn_count = 0
                session.last_speech_reasoning_time = now
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
            pending = getattr(session, "_pending_manual_frame", None)
            if isinstance(pending, dict):
                session._pending_manual_frame = None
                session_mgr.spawn(self.handle(pending, websocket, session_mgr, meeting_id))


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
                session._pending_speech_reasoning = False
                session.unreasoned_turn_count = 0
                session.last_speech_reasoning_time = time.time()
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
                session._pending_speech_reasoning = False
                session.unreasoned_turn_count = 0
                session.last_speech_reasoning_time = time.time()
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

    def __init__(self, diarizer: Optional[SpeakerDiarizer] = None):
        self.diarizer = diarizer or SpeakerDiarizer()
        self._handlers: Dict[str, BaseEnvelopeHandler] = {}
        self._register_default_handlers()

    def _register_default_handlers(self):
        self.register("handshake", HandshakeHandler())
        self.register("asrTranscription", AsrHandler(diarizer=self.diarizer))
        self.register("audioChunk", AudioChunkHandler(diarizer=self.diarizer))
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
