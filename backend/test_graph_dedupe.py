"""
Node dedupe tests for LiveGraphSession.add_node (DEV_TASK_13).
Dedupe key is (lowercase label, node type). No network calls are made.
"""

import asyncio
from types import SimpleNamespace

from envelope_router import PinchCommandHandler
from graph_engine import LiveGraphSession


def test_same_label_different_types_create_two_nodes():
    session = LiveGraphSession("meeting-dedupe-1")

    service_id = session.add_node("service", "Cache")
    database_id = session.add_node("database", "Cache")

    assert service_id != database_id
    assert session.last_node_reused is False
    assert session.node_metadata[service_id] == {"label": "Cache", "type": "service"}
    assert session.node_metadata[database_id] == {"label": "Cache", "type": "database"}


def test_same_label_and_type_reuses_existing_node():
    session = LiveGraphSession("meeting-dedupe-2")

    first_id = session.add_node("service", "API Gateway")
    assert session.last_node_reused is False

    second_id = session.add_node("SERVICE", "  api gateway  ")

    assert second_id == first_id
    assert session.last_node_reused is True
    assert len(session.node_metadata) == 1
    vertices = [c for c in session.diagram.cells if c.vertex]
    assert len(vertices) == 1


def test_missing_label_gets_auto_generated_label():
    session = LiveGraphSession("meeting-dedupe-3")

    none_id = session.add_node("service", None)
    blank_id = session.add_node("service", "   ")
    empty_id = session.add_node("database", "")

    assert session.node_metadata[none_id]["label"] == "Svc 1"
    assert session.node_metadata[blank_id]["label"] == "Svc 2"
    assert session.node_metadata[empty_id]["label"] == "DB 1"
    assert session.last_node_reused is False
    assert len({none_id, blank_id, empty_id}) == 3


def test_generated_label_does_not_collide_with_existing_label():
    session = LiveGraphSession("meeting-dedupe-4")

    existing_id = session.add_node("service", "Svc 1")
    generated_id = session.add_node("service", "")

    assert generated_id != existing_id
    assert session.node_metadata[generated_id]["label"] == "Svc 2"


def test_pinch_add_node_diff_summary_reports_added_then_updated():
    session = LiveGraphSession("meeting-dedupe-5")

    class _Recorder:
        def __init__(self):
            self.broadcasts = []

        async def render_b64_png(self, _xml):
            return "b64png"

        async def db_save_diagram_snapshot(self, **_kwargs):
            return "snapshot-1"

        async def broadcast_to_meeting(self, _meeting_id, payload):
            self.broadcasts.append(payload)

        def get_or_create_session(self, _meeting_id):
            return session

        def spawn(self, coro):
            coro.close()

    async def _noop(**_kwargs):
        return None

    recorder = _Recorder()
    recorder.renderer_daemon = recorder
    recorder.decision_linker = SimpleNamespace(process_snapshot=_noop)
    recorder.raising_hand_agent = SimpleNamespace(evaluate_proactive_on_change=_noop)

    class _Socket:
        async def send_text(self, _text):
            raise AssertionError("ADD_NODE should not send COMMAND_ERROR")

    handler = PinchCommandHandler()
    msg = {"action": "ADD_NODE", "node_type": "service", "label": "Gateway", "timestamp_ms": 1}

    asyncio.run(handler.handle(msg, _Socket(), recorder, "meeting-dedupe-5"))
    asyncio.run(handler.handle(msg, _Socket(), recorder, "meeting-dedupe-5"))

    assert recorder.broadcasts[0]["diff_summary"] == "+ Added [service] Gateway"
    assert recorder.broadcasts[1]["diff_summary"] == "~ Updated [service] Gateway"
    assert len(session.node_metadata) == 1


def test_pinch_add_node_without_label_reports_generated_label():
    session = LiveGraphSession("meeting-dedupe-6")

    class _Recorder:
        def __init__(self):
            self.broadcasts = []

        async def render_b64_png(self, _xml):
            return "b64png"

        async def db_save_diagram_snapshot(self, **_kwargs):
            return "snapshot-2"

        async def broadcast_to_meeting(self, _meeting_id, payload):
            self.broadcasts.append(payload)

        def get_or_create_session(self, _meeting_id):
            return session

        def spawn(self, coro):
            coro.close()

    async def _noop(**_kwargs):
        return None

    recorder = _Recorder()
    recorder.renderer_daemon = recorder
    recorder.decision_linker = SimpleNamespace(process_snapshot=_noop)
    recorder.raising_hand_agent = SimpleNamespace(evaluate_proactive_on_change=_noop)

    class _Socket:
        async def send_text(self, _text):
            raise AssertionError("ADD_NODE should not send COMMAND_ERROR")

    handler = PinchCommandHandler()
    msg = {"action": "ADD_NODE", "node_type": "database", "label": None, "timestamp_ms": 2}

    asyncio.run(handler.handle(msg, _Socket(), recorder, "meeting-dedupe-6"))

    assert recorder.broadcasts[0]["diff_summary"] == "+ Added [database] DB 1"
