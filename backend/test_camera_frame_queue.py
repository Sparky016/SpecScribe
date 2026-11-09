"""CameraFrameHandler: pinch (manual) frames are never dropped while a vision analysis is in flight."""

import asyncio
import types

from envelope_router import CameraFrameHandler


class FakeSessionMgr:
    def __init__(self, session):
        self.session = session
        self.spawned = []

    def get_or_create_session(self, meeting_id):
        return self.session

    def spawn(self, coro):
        self.spawned.append(coro)
        coro.close()  # recorded only; not run


def run(coro):
    return asyncio.run(coro)


def test_manual_frame_is_queued_while_analysis_in_flight():
    session = types.SimpleNamespace(_vision_in_flight=True)
    mgr = FakeSessionMgr(session)
    msg = {"eventType": "cameraFrame", "image_b64": "aGk=", "isManual": True, "captureMode": "AUTO"}

    run(CameraFrameHandler().handle(msg, None, mgr, "m1"))

    assert session._pending_manual_frame is msg
    assert session._vision_in_flight is True, "the running analysis keeps the lock"


def test_auto_frame_is_still_skipped_while_analysis_in_flight():
    session = types.SimpleNamespace(_vision_in_flight=True)
    mgr = FakeSessionMgr(session)

    run(CameraFrameHandler().handle({"eventType": "cameraFrame", "image_b64": "aGk="}, None, mgr, "m1"))

    assert getattr(session, "_pending_manual_frame", None) is None


def test_queued_pinch_frame_runs_when_the_analysis_finishes():
    pending = {"eventType": "cameraFrame", "image_b64": "aGk=", "isManual": True}
    # check_image_diff raising simulates any analysis outcome; the finally block must still hand over the queue.
    session = types.SimpleNamespace(
        _vision_in_flight=False,
        _pending_manual_frame=pending,
        check_image_diff=lambda *a, **k: (_ for _ in ()).throw(RuntimeError("boom")),
    )
    mgr = FakeSessionMgr(session)

    run(CameraFrameHandler().handle({"eventType": "cameraFrame", "image_b64": "aGk=", "isManual": True}, None, mgr, "m1"))

    assert session._vision_in_flight is False
    assert session._pending_manual_frame is None
    assert len(mgr.spawned) == 1, "the queued pinch frame is dispatched exactly once"
