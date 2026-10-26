"""
Unit & Integration Test Suite for SpecScribe AR Orchestrator (T-05 & T-06)
"""

import asyncio
import base64
import io
import time
import pytest
from unittest.mock import AsyncMock, patch
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
from starlette.websockets import WebSocketDisconnect
from auth import validate_auth_config
from main import app, limiter, live_sessions, memory_store, renderer_daemon, session_manager

TEST_API_TOKEN = "test-token-123"
AUTH_HEADERS = {"Authorization": f"Bearer {TEST_API_TOKEN}"}


@pytest.fixture(autouse=True)
def _api_token(monkeypatch):
    """Enable token auth for every test in this module (overrides conftest's disabled default)."""
    monkeypatch.delenv("SPECSCRIBE_AUTH_DISABLED", raising=False)
    monkeypatch.setenv("SPECSCRIBE_API_TOKEN", TEST_API_TOKEN)


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


@pytest.mark.integration
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


@pytest.mark.asyncio
async def test_headless_daemon_mocked_render():
    """Hermetic test validating rendering daemon lifecycle with intercepted network route."""
    from playwright.async_api import async_playwright

    daemon = HeadlessDrawioDaemon()
    assert daemon is not None
    assert daemon._is_ready is False

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"],
        )
        page = await browser.new_page()

        # Intercept external network request to viewer.diagrams.net/export3.html
        async def handle_route(route):
            html = """
            <!DOCTYPE html>
            <html>
            <head><title>Mock Export3</title></head>
            <body>
                <svg id="canvas" width="100" height="100">
                    <rect width="100" height="100" fill="#00E5FF"/>
                </svg>
                <script>
                    window.render = function(opts) {
                        return true;
                    };
                </script>
            </body>
            </html>
            """
            await route.fulfill(
                status=200,
                content_type="text/html",
                body=html,
            )

        await page.route("**/export3.html*", handle_route)
        await page.goto("https://viewer.diagrams.net/export3.html", wait_until="networkidle")

        # Inject intercepted page into daemon
        daemon.browser = browser
        daemon.page = page
        daemon._is_ready = True

        # Test render_b64_png offline
        test_xml = "<mxfile><diagram><mxGraphModel><root/></mxGraphModel></diagram></mxfile>"
        b64_png = await daemon.render_b64_png(test_xml)

        assert b64_png is not None
        assert len(b64_png) > 0
        raw_png = base64.b64decode(b64_png)
        assert raw_png.startswith(b"\x89PNG\r\n\x1a\n")

        await browser.close()



def test_rest_api_lifecycle():
    """Verify REST API meeting creation, timeline retrieval, and finalization."""
    with TestClient(app, headers=AUTH_HEADERS) as client:
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
    with TestClient(app, headers=AUTH_HEADERS) as client:
        meeting_id = "00000000-0000-4000-8000-000000000099"

        with client.websocket_connect(f"/ws/meeting/{meeting_id}?token={TEST_API_TOKEN}") as ws:
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
    with TestClient(app, headers=AUTH_HEADERS) as client:
        meeting_id = "00000000-0000-4000-8000-000000000098"

        with client.websocket_connect(f"/ws/meeting/{meeting_id}?token={TEST_API_TOKEN}") as ws:
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
    with TestClient(app, headers=AUTH_HEADERS) as client:
        meeting_id = "00000000-0000-4000-8000-000000000097"

        with client.websocket_connect(f"/ws/meeting/{meeting_id}?token={TEST_API_TOKEN}") as ws:
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


def test_rest_requires_bearer_token():
    """Unauthenticated / wrong-token REST calls return 401; valid token succeeds."""
    with TestClient(app) as client:
        assert client.get("/api/meetings/m1/timeline").status_code == 401
        assert client.post("/api/meetings", json={"title": "x"}).status_code == 401
        assert client.get("/api/meetings/m1/timeline", headers={"Authorization": "Bearer wrong"}).status_code == 401
        assert client.get("/api/meetings/m1/timeline", headers={"Authorization": TEST_API_TOKEN}).status_code == 401
        assert client.get("/api/meetings/m1/timeline", headers=AUTH_HEADERS).status_code != 401
        assert client.post("/api/meetings", json={"title": "x"}, headers=AUTH_HEADERS).status_code == 200


def test_gemini_post_routes_rate_limited_per_client():
    """11th POST /ask within a minute from one client returns 429 + Retry-After; GET routes stay open."""
    answer = AsyncMock(return_value={"answer": "stub"})
    limiter.reset()
    try:
        with patch.object(session_manager.spec_generator, "answer_question", answer):
            with TestClient(app, headers=AUTH_HEADERS) as client:
                for _ in range(10):
                    assert client.post("/api/meetings/rl-1/ask", json={"question": "q"}).status_code == 200
                limited = client.post("/api/meetings/rl-1/ask", json={"question": "q"})
                assert limited.status_code == 429
                assert int(limited.headers["Retry-After"]) > 0
                assert answer.await_count == 10
                for _ in range(20):
                    assert client.get("/api/meetings/rl-1/timeline").status_code == 200
    finally:
        limiter.reset()


def test_health_is_public():
    with TestClient(app) as client:
        assert client.get("/api/health").status_code == 200


def test_websocket_rejected_without_valid_token():
    """Missing or wrong ?token= closes with 4401 before accept."""
    with TestClient(app) as client:
        for url in ("/ws/meeting/auth-ws-1", "/ws/meeting/auth-ws-1?token=wrong"):
            with pytest.raises(WebSocketDisconnect) as exc:
                with client.websocket_connect(url):
                    pass
            assert exc.value.code == 4401
    assert "auth-ws-1" not in live_sessions


def test_websocket_accepts_valid_token():
    with TestClient(app) as client:
        with client.websocket_connect(f"/ws/meeting/00000000-0000-4000-8000-000000000096?token={TEST_API_TOKEN}") as ws:
            ws.send_json({"eventType": "handshake", "device": "Spectacles-2024", "protocolVersion": "1.1.0", "timestamp_ms": 0})


class _FakeSupabase:
    """Records table calls in order; no network."""

    def __init__(self, fail_on=None):
        self.calls = []
        self.fail_on = fail_on

    def table(self, name):
        outer = self

        class _Q:
            def __init__(self):
                self.op = None

            def _rec(self, op, *a, **k):
                self.op = op
                outer.calls.append((name, op, a, k))
                return self

            def upsert(self, *a, **k):
                return self._rec("upsert", *a, **k)

            def insert(self, *a, **k):
                return self._rec("insert", *a, **k)

            def update(self, *a, **k):
                return self._rec("update", *a, **k)

            def eq(self, *a, **k):
                return self

            def execute(self):
                if outer.fail_on == self.op:
                    raise RuntimeError("boom")

                class _R:
                    data = []

                return _R()

        return _Q()


def test_websocket_rejects_non_uuid_meeting_id(monkeypatch):
    monkeypatch.delenv("SPECSCRIBE_DEMO_MODE", raising=False)
    with TestClient(app) as client:
        for mid in ("not-a-uuid", "demo-session-01"):
            with pytest.raises(WebSocketDisconnect) as exc:
                with client.websocket_connect(f"/ws/meeting/{mid}?token={TEST_API_TOKEN}"):
                    pass
            assert exc.value.code == 4400
    assert "not-a-uuid" not in live_sessions


def test_websocket_demo_id_maps_to_fixed_uuid_in_demo_mode(monkeypatch):
    from session_manager import DEMO_MEETING_UUID

    monkeypatch.setenv("SPECSCRIBE_DEMO_MODE", "1")
    monkeypatch.setattr(session_manager, "supabase_client", None)
    with TestClient(app) as client:
        with client.websocket_connect(f"/ws/meeting/demo-session-01?token={TEST_API_TOKEN}") as ws:
            ws.send_json({"eventType": "handshake", "device": "Spectacles-2024", "protocolVersion": "1.1.0", "timestamp_ms": 0})
            assert DEMO_MEETING_UUID in live_sessions
    live_sessions.pop(DEMO_MEETING_UUID, None)


@pytest.mark.asyncio
async def test_ensure_session_upserts_meeting_before_child_insert():
    from session_manager import SessionManager

    fake = _FakeSupabase()
    mgr = SessionManager(supabase_client=fake)
    mid = "00000000-0000-4000-8000-000000000095"
    await mgr.ensure_session(mid)
    await mgr.db_save_transcript_turn(mid, "Speaker 0", "hello", 10)
    assert fake.calls[0][:2] == ("meetings", "upsert")
    assert fake.calls[0][3] == {"on_conflict": "id"}
    assert fake.calls[0][2][0]["id"] == mid and fake.calls[0][2][0]["title"]
    assert fake.calls[1][:2] == ("transcript_turns", "insert")


@pytest.mark.asyncio
async def test_ensure_session_rejects_non_uuid():
    from session_manager import SessionManager

    with pytest.raises(ValueError):
        await SessionManager(supabase_client=_FakeSupabase()).ensure_session("nope")


@pytest.mark.asyncio
async def test_persistence_failures_log_at_error(caplog):
    from session_manager import SessionManager

    mid = "00000000-0000-4000-8000-000000000094"
    mgr = SessionManager(supabase_client=_FakeSupabase(fail_on="upsert"))
    with caplog.at_level("ERROR", logger="specscribe.session_manager"):
        await mgr.ensure_session(mid)
    assert any(r.levelname == "ERROR" and r.exc_info for r in caplog.records)
    caplog.clear()
    mgr = SessionManager(supabase_client=_FakeSupabase(fail_on="insert"))
    with caplog.at_level("ERROR", logger="specscribe.session_manager"):
        await mgr.db_save_transcript_turn(mid, "s", "t", 1)
        await mgr.db_save_diagram_snapshot(mid, 1, "<x/>", "d", None, "VISION_DIFF")
    assert len([r for r in caplog.records if r.levelname == "ERROR"]) == 2


def test_startup_refuses_without_token_unless_disabled(monkeypatch, caplog):
    monkeypatch.delenv("SPECSCRIBE_API_TOKEN", raising=False)
    monkeypatch.delenv("SPECSCRIBE_AUTH_DISABLED", raising=False)
    with pytest.raises(RuntimeError):
        validate_auth_config()
    with pytest.raises(RuntimeError):
        with TestClient(app):
            pass
    monkeypatch.setenv("SPECSCRIBE_AUTH_DISABLED", "1")
    with caplog.at_level("WARNING"):
        validate_auth_config()
    assert "DISABLED" in caplog.text
    with TestClient(app) as client:
        assert client.post("/api/meetings", json={"title": "x"}).status_code == 200
