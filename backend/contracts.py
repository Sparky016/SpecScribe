"""Shared wire-protocol constants for the Spectacles Lens <-> backend contract."""


class PinchAction:
    """`action` values accepted on an inbound `pinchCommand` envelope (see docs/spec.md section 3.1 D)."""

    ADD_NODE = "ADD_NODE"
    CONNECT_NODES = "CONNECT_NODES"
    ASK_AGENT = "ASK_AGENT"
    CONCLUDE_MEETING = "CONCLUDE_MEETING"
    CALIBRATE_AREA = "CALIBRATE_AREA"
    INGEST_DRAWING = "INGEST_DRAWING"
    UPDATE_SNAPSHOT = "UPDATE_SNAPSHOT"

    # Handled entirely on the Lens; the backend only acknowledges them.
    CLIENT_ONLY = frozenset({CALIBRATE_AREA, INGEST_DRAWING, UPDATE_SNAPSHOT})
