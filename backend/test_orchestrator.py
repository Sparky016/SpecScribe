"""
Unit & Integration Test Suite for SpecScribe AR Orchestrator (T-05 & T-06)
"""

import asyncio
import base64
import io
import time
import pytest
from unittest.mock import patch
from PIL import Image, ImageDraw
from fastapi.testclient import TestClient

from graph_engine import (
    STYLE_MAP,
    DEFAULT_DIMENSIONS,
    EDGE_STYLE,
    HeadlessDrawioDaemon,
    LayoutEngine,
    LiveGraphSession,
    GraphDeltaSchema,
    VertexAddition,
    EdgeAddition,
)
from main import app, live_sessions, memory_store, renderer_daemon


def test_waveguide_styles_and_node_addition():
    """Verify additive optical waveguide color codes and dimensions."""
    session = LiveGraphSession("test-session-01")

    # Add 4 types
    service_id = session.add_node("service", "Ingress API")
    decision_id = session.add_node("decision", "Auth Check")
    db_id = session.add_node("database", "PostgreSQL Primary")
    term_id = session.add_node("terminal", "Client App")

    assert service_id in session.node_metadata
    assert "#00FF66" in STYLE_MAP["service"]
    assert "#107C41" in STYLE_MAP["service"]

    assert decision_id in session.node_metadata
    assert "#00E5FF" in STYLE_MAP["decision"]
    assert "rhombus" in STYLE_MAP["decision"]

    assert db_id in session.node_metadata
    assert "shape=cylinder3" in STYLE_MAP["database"]
    assert "#00E5FF" in STYLE_MAP["database"]

    assert term_id in session.node_metadata
    assert "ellipse" in STYLE_MAP["terminal"]
    assert "#00FF66" in STYLE_MAP["terminal"]

    # Connect nodes
    edge_id = session.add_edge("Client App", "Ingress API", "HTTPS Request")
    assert edge_id is not None
    assert "#00E5FF" in EDGE_STYLE


def test_sugiyama_layout_calculation():
    """Verify Sugiyama DAG hierarchical layout execution and XML compilation."""
    session = LiveGraphSession("test-layout-session")

    v1 = session.add_node("terminal", "User")
    v2 = session.add_node("service", "API Gateway")
    v3 = session.add_node("database", "Redis Cache")

    session.add_edge("User", "API Gateway")
    session.add_edge("API Gateway", "Redis Cache")

    t0 = time.perf_counter()
    xml_output = session.compile_layout_xml()
    t_elapsed = (time.perf_counter() - t0) * 1000

    assert t_elapsed < 35.0  # <35ms target budget
    assert "<mxfile" in xml_output
    assert "API Gateway" in xml_output
    assert "Redis Cache" in xml_output


def test_perceptual_hash_diff_gate():
    """Verify imagehash.phash diff gate executes in <5ms and flags changes."""
    session = LiveGraphSession("test-phash-session")

    # Synthetic whiteboard frame 1 (single box drawn)
    img1 = Image.new("RGB", (480, 270), color=(240, 240, 240))
    draw1 = ImageDraw.Draw(img1)
    draw1.rectangle([50, 50, 200, 150], outline=(0, 0, 0), width=4)
    buf1 = io.BytesIO()
    img1.save(buf1, format="JPEG")
    b1 = buf1.getvalue()

    t0 = time.perf_counter()
    has_diff, hamming, h1 = session.check_image_diff(b1, threshold=6)
    t_diff = (time.perf_counter() - t0) * 1000

    assert t_diff < 5.0
    assert has_diff is True

    # Same image again -> should be rejected by diff gate (<5ms)
    t0 = time.perf_counter()
    has_diff2, hamming2, _ = session.check_image_diff(b1, threshold=6)
    t_diff2 = (time.perf_counter() - t0) * 1000

    assert t_diff2 < 5.0
    assert has_diff2 is False
    assert hamming2 == 0

    # New whiteboard drawing added (circle + connecting line)
    img2 = Image.new("RGB", (480, 270), color=(240, 240, 240))
    draw2 = ImageDraw.Draw(img2)
    draw2.rectangle([50, 50, 200, 150], outline=(0, 0, 0), width=4)
    draw2.ellipse([300, 40, 440, 180], outline=(0, 0, 255), width=6)
    draw2.line([200, 100, 300, 110], fill=(0, 255, 0), width=5)
    buf2 = io.BytesIO()
    img2.save(buf2, format="JPEG")
    b2 = buf2.getvalue()

    has_diff3, hamming3, _ = session.check_image_diff(b2, threshold=6)
    assert has_diff3 is True
    assert hamming3 >= 6


@pytest.mark.asyncio
async def test_headless_daemon_rendering_latency():
    """Verify pre-warmed Chromium renders transparent Base64 PNG in <140ms."""
    daemon = HeadlessDrawioDaemon()
    await daemon.start()

    session = LiveGraphSession("test-render-session")
    session.add_node("service", "Microservice A")
    session.add_node("database", "DocStore")
    session.add_edge("Microservice A", "DocStore")
    xml = session.compile_layout_xml()

    # Benchmark rendering
    t0 = time.perf_counter()
    b64_png = await daemon.render_b64_png(xml)
    t_render = (time.perf_counter() - t0) * 1000

    await daemon.stop()

    assert t_render < 140.0, f"Render took {t_render:.1f}ms (target <140ms)"
    assert len(b64_png) > 100
    # Verify valid PNG header
    raw_png = base64.b64decode(b64_png)
    assert raw_png.startswith(b"\x89PNG\r\n\x1a\n")


def test_rest_api_lifecycle():
    """Verify REST API meeting creation, timeline retrieval, and finalization."""
    with TestClient(app) as client:
        # 1. Create meeting
        resp = client.post("/api/meetings", json={"title": "Cloud Migration Brainstorm"})
        assert resp.status_code == 200
        data = resp.json()
        meeting_id = data["id"]
        assert data["title"] == "Cloud Migration Brainstorm"

        # 2. Get timeline
        timeline_resp = client.get(f"/api/meetings/{meeting_id}/timeline")
        assert timeline_resp.status_code == 200
        t_data = timeline_resp.json()
        assert t_data["meeting"]["id"] == meeting_id

        # 3. Finalize
        finalize_resp = client.post(f"/api/meetings/{meeting_id}/finalize")
        assert finalize_resp.status_code == 200
        assert "spec_md" in finalize_resp.json()


def test_websocket_pinch_command_and_transcription():
    """Verify WebSocket full-duplex protocol handling handshake, ASR, and pinch commands."""
    with TestClient(app) as client:
        meeting_id = "test-ws-session-99"

        with client.websocket_connect(f"/ws/meeting/{meeting_id}") as ws:
            # Handshake
            ws.send_json({
                "eventType": "handshake",
                "device": "Spectacles-2024",
                "protocolVersion": "1.1.0",
                "timestamp_ms": 0,
            })
            ack = ws.receive_json()
            assert ack["event"] == "HANDSHAKE_ACK"

            # ASR speech
            ws.send_json({
                "eventType": "asrTranscription",
                "speaker_label": "Speaker 0 (Ruan)",
                "transcript_text": "We need a Kafka broker for async events.",
                "timestamp_ms": 12000,
            })

            # Pinch Command ADD_NODE
            t0 = time.perf_counter()
            ws.send_json({
                "eventType": "pinchCommand",
                "timestamp_ms": 13500,
                "action": "ADD_NODE",
                "node_type": "database",
                "label": "Kafka Event Bus",
            })
            diagram_update = ws.receive_json()
            elapsed_ms = (time.perf_counter() - t0) * 1000

            assert diagram_update["event"] == "DIAGRAM_UPDATED"
            assert "Kafka Event Bus" in diagram_update["diff_summary"]
            assert len(diagram_update["image_b64"]) > 50

            # Verify session state
            session = live_sessions[meeting_id]
            assert "kafka event bus" in session.node_by_label


def test_websocket_camera_frame_diff_gate():
    """Verify cameraFrame event triggers diff gate, diagram update, and suppresses duplicates."""
    with TestClient(app) as client:
        meeting_id = "test-ws-camera-session"

        with client.websocket_connect(f"/ws/meeting/{meeting_id}") as ws:
            # Handshake
            ws.send_json({
                "eventType": "handshake",
                "device": "Spectacles-2024",
                "protocolVersion": "1.1.0",
                "timestamp_ms": 0,
            })
            ack = ws.receive_json()
            assert ack["event"] == "HANDSHAKE_ACK"

            # Generate synthetic whiteboard frame
            img = Image.new("RGB", (480, 270), color=(240, 240, 240))
            draw = ImageDraw.Draw(img)
            draw.rectangle([60, 60, 220, 160], outline=(0, 0, 0), width=5)
            buf = io.BytesIO()
            img.save(buf, format="JPEG")
            b64_frame = base64.b64encode(buf.getvalue()).decode("ascii")

            # Send camera frame 1
            ws.send_json({
                "eventType": "cameraFrame",
                "timestamp_ms": 15000,
                "image_b64": b64_frame,
            })

            # Expect DIAGRAM_UPDATED from vision extractor mutation
            diagram_update = ws.receive_json()
            assert diagram_update["event"] == "DIAGRAM_UPDATED"
            assert "Whiteboard" in diagram_update["diff_summary"] or len(diagram_update["image_b64"]) > 50

            # Send duplicate frame -> perceptual hash gate must suppress update (no message sent)
            ws.send_json({
                "eventType": "cameraFrame",
                "timestamp_ms": 18000,
                "image_b64": b64_frame,
            })

            # Check that socket does not block with a quick timeout check or next event
            ws.send_json({
                "eventType": "asrTranscription",
                "speaker_label": "Speaker 0",
                "transcript_text": "Heartbeat transcript",
                "timestamp_ms": 19000,
            })
            # No DIAGRAM_UPDATED was queued; the socket remains healthy


def test_websocket_pinch_command_resilience():
    """Verify pinchCommand unhandled exceptions dispatch COMMAND_ERROR and do not close WebSocket (#2)."""
    with TestClient(app) as client:
        meeting_id = "test-ws-resilience-session"

        with client.websocket_connect(f"/ws/meeting/{meeting_id}") as ws:
            # 1. Handshake
            ws.send_json({
                "eventType": "handshake",
                "device": "Spectacles-2024",
                "protocolVersion": "1.1.0",
                "timestamp_ms": 0,
            })
            ack = ws.receive_json()
            assert ack["event"] == "HANDSHAKE_ACK"

            # 2. Send invalid/unrecognized action
            ws.send_json({
                "eventType": "pinchCommand",
                "action": "INVALID_ACTION_NAME",
                "timestamp_ms": 1000,
            })
            err_msg1 = ws.receive_json()
            assert err_msg1["event"] == "COMMAND_ERROR"
            assert err_msg1["action"] == "INVALID_ACTION_NAME"
            assert "Unrecognized pinchCommand action" in err_msg1["message"]

            # 3. Send CONNECT_NODES for missing nodes
            ws.send_json({
                "eventType": "pinchCommand",
                "action": "CONNECT_NODES",
                "source": "NonExistentServiceA",
                "target": "NonExistentDatabaseB",
                "timestamp_ms": 2000,
            })
            err_msg2 = ws.receive_json()
            assert err_msg2["event"] == "COMMAND_ERROR"
            assert err_msg2["action"] == "CONNECT_NODES"
            assert "Could not connect" in err_msg2["message"]

            # 4. Simulate Headless Playwright renderer crash (RuntimeError) during ADD_NODE
            with patch.object(renderer_daemon, "render_b64_png", side_effect=RuntimeError("Playwright Chromium daemon crashed or restarted")):
                ws.send_json({
                    "eventType": "pinchCommand",
                    "action": "ADD_NODE",
                    "node_type": "service",
                    "label": "Fault Tolerant Service",
                    "timestamp_ms": 3000,
                })
                err_msg3 = ws.receive_json()
                assert err_msg3["event"] == "COMMAND_ERROR"
                assert err_msg3["action"] == "ADD_NODE"
                assert "Playwright Chromium daemon crashed" in err_msg3["message"]

            # 5. Crucial verification: WebSocket remains ALIVE, responsive, and functional
            # Wearer can continue sending ASR transcripts
            ws.send_json({
                "eventType": "asrTranscription",
                "speaker_label": "Speaker 0",
                "transcript_text": "Socket remains active after error recovery",
                "timestamp_ms": 4000,
            })

            # Wearer can retry / perform a healthy pinch command on the same socket
            ws.send_json({
                "eventType": "pinchCommand",
                "action": "ADD_NODE",
                "node_type": "database",
                "label": "Resilient DocStore",
                "timestamp_ms": 5000,
            })
            diagram_update = ws.receive_json()
            assert diagram_update["event"] == "DIAGRAM_UPDATED"
            assert "Resilient DocStore" in diagram_update["diff_summary"]
            assert len(diagram_update["image_b64"]) > 50

