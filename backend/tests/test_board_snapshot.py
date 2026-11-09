"""Board-snapshot reconciliation and board-faithful layout (overlay acceptance criteria, deterministic part).

The live end-to-end check against real Gemini is backend/acceptance_overlay.py; these tests pin the session logic
it depends on without any model calls.
"""
import xml.etree.ElementTree as ET

from graph_engine import (
    BOARD_ANCHOR_PREFIX,
    BOARD_H,
    BOARD_W,
    EdgeAddition,
    GraphDeltaSchema,
    LiveGraphSession,
    VisibleVertex,
)


def snapshot(vertices, edges=(), changed=True, occluded=False, empty=False):
    return GraphDeltaSchema(
        person_occluding_board=occluded,
        has_meaningful_change=changed,
        board_is_empty=empty,
        visible_vertices=[VisibleVertex(label=l, node_type=t, x=x, y=y, width=w, height=h) for l, t, x, y, w, h in vertices],
        visible_edges=[EdgeAddition(source_label=s, target_label=d, edge_label=lbl) for s, d, lbl in edges],
    )


K2 = snapshot(
    [
        ("CLIENT", "terminal", 0.16, 0.47, 0.21, 0.24),
        ("API GATEWAY", "service", 0.57, 0.47, 0.22, 0.26),
        ("CORE SERVICE", "service", 0.88, 0.47, 0.20, 0.26),
        ("POSTGRES DB", "database", 0.88, 0.83, 0.15, 0.22),
    ],
    [("CLIENT", "API GATEWAY", "HMAC"), ("API GATEWAY", "CORE SERVICE", ""), ("CORE SERVICE", "POSTGRES DB", "")],
)


def diagram(session):
    root = ET.fromstring(session.compile_layout_xml())
    cells = list(root.iter("mxCell"))
    nodes, ids = {}, {}
    for c in cells:
        if c.get("vertex") == "1" and not c.get("id", "").startswith(BOARD_ANCHOR_PREFIX):
            g = c.find("mxGeometry")
            ids[c.get("id")] = c.get("value").lower()
            nodes[c.get("value").lower()] = (
                (float(g.get("x", 0)) + float(g.get("width")) / 2) / BOARD_W,
                (float(g.get("y", 0)) + float(g.get("height")) / 2) / BOARD_H,
                c.get("style", ""),
            )
    edges = {(ids[c.get("source")], ids[c.get("target")]): (c.get("value") or "").lower()
             for c in cells if c.get("edge") == "1"}
    anchors = [c.get("id") for c in cells if c.get("id", "").startswith(BOARD_ANCHOR_PREFIX)]
    return nodes, edges, anchors


def test_snapshot_builds_the_board_diagram_in_place():
    s = LiveGraphSession("m")
    assert s.apply_vision(K2) > 0
    nodes, edges, anchors = diagram(s)
    assert set(nodes) == {"client", "api gateway", "core service", "postgres db"}
    assert edges == {("client", "api gateway"): "hmac", ("api gateway", "core service"): "", ("core service", "postgres db"): ""}
    assert "cylinder" in nodes["postgres db"][2]
    for label, (x, y, _) in nodes.items():  # AC8: each box is where it is drawn
        want = {"client": (0.16, 0.47), "api gateway": (0.57, 0.47), "core service": (0.88, 0.47), "postgres db": (0.88, 0.83)}[label]
        assert abs(x - want[0]) < 0.02 and abs(y - want[1]) < 0.02, label
    assert len(anchors) == 2, "corner anchors make the overlay PNG span the whole board"


def test_snapshot_corrects_a_cropped_earlier_capture():
    """AC9: a centre-cropped capture ('NT', 'SERVICE') followed by a full one ends up exactly as drawn."""
    s = LiveGraphSession("m")
    s.apply_vision(snapshot(
        [("NT", "terminal", 0.02, 0.47, 0.04, 0.24), ("API GATEWAY", "service", 0.5, 0.47, 0.4, 0.3), ("SERVICE", "service", 0.97, 0.47, 0.05, 0.26)],
        [("NT", "API GATEWAY", "HMAC"), ("API GATEWAY", "SERVICE", "")],
    ))
    s.apply_vision(K2)
    nodes, edges, _ = diagram(s)
    assert set(nodes) == {"client", "api gateway", "core service", "postgres db"}
    assert set(edges) == {("client", "api gateway"), ("api gateway", "core service"), ("core service", "postgres db")}
    assert abs(nodes["api gateway"][0] - 0.57) < 0.02, "positions are refreshed, not kept from the cropped frame"


def test_recapturing_the_same_board_changes_nothing():
    s = LiveGraphSession("m")
    s.apply_vision(K2)
    before = diagram(s)
    assert s.apply_vision(K2) == 0
    assert diagram(s) == before


def test_empty_result_without_a_change_never_wipes_the_diagram():
    s = LiveGraphSession("m")
    s.apply_vision(K2)
    assert s.apply_vision(snapshot([], changed=False)) == 0
    assert len(diagram(s)[0]) == 4


def test_erased_board_clears_the_diagram():
    s = LiveGraphSession("m")
    s.apply_vision(K2)
    s.apply_vision(snapshot([], changed=True, empty=True))
    assert diagram(s)[0] == {}


def test_a_change_with_no_shapes_listed_never_wipes_the_diagram():
    """Regression from the 19:02 take: vision said 'Added CORE SERVICE...' but listed no shapes; that wiped the overlay."""
    s = LiveGraphSession("m")
    s.apply_vision(K2)
    assert s.apply_vision(snapshot([], changed=True)) == 0
    assert len(diagram(s)[0]) == 4


def test_occluded_board_leaves_the_diagram_unchanged():
    s = LiveGraphSession("m")
    s.apply_vision(K2)
    s.apply_vision(snapshot([("CLIENT", "terminal", 0.1, 0.1, 0.1, 0.1)], occluded=True))
    assert len(diagram(s)[0]) == 4


def test_nodes_without_board_positions_fall_back_to_left_to_right_layout():
    s = LiveGraphSession("m")
    s.add_node("client", "Client")
    s.add_node("service", "API Gateway")
    s.add_edge("Client", "API Gateway")
    nodes, _, anchors = diagram(s)
    assert nodes["client"][0] < nodes["api gateway"][0], "left to right, like the board"
    assert anchors == []


def test_image_boxes_are_converted_to_board_fractions():
    from graph_engine import place_on_board

    delta = GraphDeltaSchema(
        person_occluding_board=False,
        has_meaningful_change=True,
        board_box_2d=[100, 100, 900, 900],  # board fills the middle 80% of the image
        visible_vertices=[VisibleVertex(label="Client", node_type="terminal", box_2d=[300, 100, 500, 300])],
    )
    place_on_board(delta)
    v = delta.visible_vertices[0]
    assert (round(v.x, 3), round(v.y, 3), round(v.width, 3), round(v.height, 3)) == (0.125, 0.375, 0.25, 0.25)
