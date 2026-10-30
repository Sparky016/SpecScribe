"""Unit and integration tests for Backend Vision Cooldown Gate & Immediate Manual Capture (Task 56)."""

import asyncio
import base64
import io
import os
import sys
import time
from unittest.mock import AsyncMock, MagicMock, patch
import pytest
from PIL import Image, ImageDraw

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from envelope_router import CameraFrameHandler
from graph_engine import GraphDeltaSchema, LiveGraphSession, VertexAddition


def _make_jpeg_b64(color=(240, 240, 240), box=(60, 60, 220, 160)) -> str:
    """Helper to create distinct synthetic JPEG base64 strings."""
    img = Image.new("RGB", (480, 270), color=color)
    draw = ImageDraw.Draw(img)
    draw.rectangle(list(box), outline=(0, 0, 0), width=5)
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    return base64.b64encode(buf.getvalue()).decode("ascii")


def _mock_session_mgr(session: LiveGraphSession):
    session_mgr = MagicMock()
    session_mgr.get_or_create_session.return_value = session
    session_mgr.renderer_daemon = MagicMock()
    session_mgr.renderer_daemon.render_b64_png = AsyncMock(return_value="png-data")
    session_mgr.db_save_diagram_snapshot = AsyncMock(return_value="snap-123")
    session_mgr.broadcast_to_meeting = AsyncMock()

    def _mock_spawn(coro):
        if asyncio.iscoroutine(coro):
            coro.close()

    session_mgr.spawn = MagicMock(side_effect=_mock_spawn)
    session_mgr.decision_linker = MagicMock()
    session_mgr.decision_linker.process_snapshot = MagicMock(return_value=asyncio.sleep(0))
    session_mgr.raising_hand_agent = MagicMock()
    session_mgr.raising_hand_agent.evaluate_proactive_on_change = MagicMock(return_value=asyncio.sleep(0))
    return session_mgr


@pytest.mark.asyncio
async def test_camera_frame_static_does_not_update_cooldown():
    """
    AC1: A static camera frame (check_image_diff == False) does not update
    session._last_vision_time, so a changed frame arriving 3.0s later is processed immediately.
    """
    handler = CameraFrameHandler()
    session = LiveGraphSession("test-meeting-ac1")
    session_mgr = _mock_session_mgr(session)
    mock_ws = AsyncMock()

    b64_img1 = _make_jpeg_b64(box=(10, 10, 50, 50))
    b64_img2 = _make_jpeg_b64(box=(100, 100, 200, 200))

    vision_delta = GraphDeltaSchema(
        person_occluding_board=False,
        has_meaningful_change=True,
        added_vertices=[VertexAddition(temp_id="v1", label="Node 1", node_type="service")],
        added_edges=[],
        diff_summary="+ Node 1",
    )

    with patch("envelope_router.extract_graph_delta_from_gemini", new_callable=AsyncMock, return_value=vision_delta) as mock_gemini:
        # 1. t = 10.0: Initial frame (changed). Processes and sets _last_vision_time = 10.0.
        with patch("time.time", return_value=10.0):
            await handler.handle(
                {"image_b64": b64_img1, "timestamp_ms": 10000},
                mock_ws,
                session_mgr,
                "test-meeting-ac1",
            )
        assert mock_gemini.call_count == 1
        assert session._last_vision_time == 10.0

        # 2. t = 13.0 (3.0s later): Static / duplicate frame.
        # Check diff returns False.
        with patch("time.time", return_value=13.0):
            await handler.handle(
                {"image_b64": b64_img1, "timestamp_ms": 13000},
                mock_ws,
                session_mgr,
                "test-meeting-ac1",
            )
        # Gemini is NOT called for duplicate/static frame
        assert mock_gemini.call_count == 1
        # CRITICAL AC1 CHECK: _last_vision_time was NOT updated to 13.0, remains 10.0
        assert session._last_vision_time == 10.0

        # 3. t = 13.5 (only 0.5s after the static frame, but 3.5s after the last vision run):
        # Changed frame arrives. Since _last_vision_time is still 10.0, 13.5 - 10.0 = 3.5s >= 2.5s cooldown.
        # It MUST be processed immediately.
        with patch("time.time", return_value=13.5):
            await handler.handle(
                {"image_b64": b64_img2, "timestamp_ms": 13500},
                mock_ws,
                session_mgr,
                "test-meeting-ac1",
            )
        assert mock_gemini.call_count == 2
        assert session._last_vision_time == 13.5


@pytest.mark.asyncio
async def test_camera_frame_auto_cooldown_3s_cadence():
    """
    AC2: Continuous changed frames arriving at 3.0s intervals in AUTO mode
    pass the 2.5s cooldown gate.
    """
    handler = CameraFrameHandler()
    assert handler.VISION_COOLDOWN_SEC == 2.5

    session = LiveGraphSession("test-meeting-ac2")
    session_mgr = _mock_session_mgr(session)
    mock_ws = AsyncMock()

    vision_delta = GraphDeltaSchema(
        person_occluding_board=False,
        has_meaningful_change=True,
        added_vertices=[VertexAddition(temp_id="v1", label="Node", node_type="service")],
        added_edges=[],
        diff_summary="+ Node",
    )

    with patch("envelope_router.extract_graph_delta_from_gemini", new_callable=AsyncMock, return_value=vision_delta) as mock_gemini:
        # Simulate changed frames arriving at t = 100.0, 103.0, 106.0, 109.0 (all 3.0s intervals)
        for i, t in enumerate([100.0, 103.0, 106.0, 109.0], start=1):
            frame_b64 = _make_jpeg_b64(box=(i * 10, i * 10, i * 20 + 50, i * 20 + 50))
            with patch("time.time", return_value=t):
                await handler.handle(
                    {"image_b64": frame_b64, "timestamp_ms": int(t * 1000), "isManual": False},
                    mock_ws,
                    session_mgr,
                    "test-meeting-ac2",
                )
            assert mock_gemini.call_count == i
            assert session._last_vision_time == t

        # Verify that a frame arriving at t = 110.5 (< 2.5s after t=109.0) IS throttled by cooldown
        with patch("time.time", return_value=110.5):
            fast_frame = _make_jpeg_b64(box=(120, 120, 240, 240))
            await handler.handle(
                {"image_b64": fast_frame, "timestamp_ms": 110500, "isManual": False},
                mock_ws,
                session_mgr,
                "test-meeting-ac2",
            )
        # Call count must still be 4 (throttled)
        assert mock_gemini.call_count == 4
        assert session._last_vision_time == 109.0


@pytest.mark.asyncio
async def test_camera_frame_manual_bypasses_cooldown():
    """
    AC3: A cameraFrame with isManual=True bypasses the cooldown timer and processes immediately.
    """
    handler = CameraFrameHandler()
    session = LiveGraphSession("test-meeting-ac3")
    session_mgr = _mock_session_mgr(session)
    mock_ws = AsyncMock()

    b64_img1 = _make_jpeg_b64(box=(20, 20, 80, 80))
    b64_img2 = _make_jpeg_b64(box=(30, 30, 90, 90))

    vision_delta = GraphDeltaSchema(
        person_occluding_board=False,
        has_meaningful_change=True,
        added_vertices=[VertexAddition(temp_id="vm", label="Manual Node", node_type="decision")],
        added_edges=[],
        diff_summary="+ Manual Node",
    )

    with patch("envelope_router.extract_graph_delta_from_gemini", new_callable=AsyncMock, return_value=vision_delta) as mock_gemini:
        # 1. Background frame processed at t = 10.0
        with patch("time.time", return_value=10.0):
            await handler.handle(
                {"image_b64": b64_img1, "timestamp_ms": 10000, "isManual": False},
                mock_ws,
                session_mgr,
                "test-meeting-ac3",
            )
        assert mock_gemini.call_count == 1
        assert session._last_vision_time == 10.0

        # 2. Manual capture arrives only 0.5s later (t = 10.5s), well under the 2.5s cooldown.
        with patch("time.time", return_value=10.5):
            await handler.handle(
                {
                    "image_b64": b64_img2,
                    "timestamp_ms": 10500,
                    "isManual": True,
                    "captureMode": "MANUAL",
                },
                mock_ws,
                session_mgr,
                "test-meeting-ac3",
            )
        # Must have bypassed cooldown and called Gemini immediately
        assert mock_gemini.call_count == 2
        assert session._last_vision_time == 10.5

        # 3. Another manual frame with isManualTrigger=True also bypasses cooldown
        with patch("time.time", return_value=10.8):
            await handler.handle(
                {
                    "image_b64": b64_img1,
                    "timestamp_ms": 10800,
                    "isManualTrigger": True,
                },
                mock_ws,
                session_mgr,
                "test-meeting-ac3",
            )
        assert mock_gemini.call_count == 3
        assert session._last_vision_time == 10.8
