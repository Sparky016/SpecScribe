"""Unit tests for Full Graph Delta Mutations (Node/Edge Deletion, Rename & Rewiring) in Vision Pipeline (Task 59)."""

import json
import os
import sys
from unittest.mock import AsyncMock, patch
import pytest

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from graph_engine import (
    EdgeAddition,
    GraphDeltaSchema,
    LiveGraphSession,
    RemovedEdgeSchema,
    UpdatedVertexSchema,
    VertexAddition,
    extract_graph_delta_from_gemini,
    extract_graph_delta_from_gemini_async,
)


def test_get_existing_edges_summary():
    """LiveGraphSession.get_existing_edges_summary() returns ['Source -> Target', ...]."""
    session = LiveGraphSession("test-edges-summary")
    session.add_node("service", "API Gateway")
    session.add_node("service", "Auth Service")
    session.add_node("database", "User DB")
    session.add_edge("API Gateway", "Auth Service")
    session.add_edge("Auth Service", "User DB")

    summary = session.get_existing_edges_summary()
    assert summary == ["API Gateway -> Auth Service", "Auth Service -> User DB"]


def test_apply_delta_remove_vertex_and_incident_edges():
    """
    AC1: LiveGraphSession.apply_delta() removes erased vertices and their incident edges
    from the Draw.io XML and internal lookup maps.
    """
    session = LiveGraphSession("test-remove-vertex")
    id_a = session.add_node("service", "Ingress")
    id_b = session.add_node("service", "Legacy Cache")
    id_c = session.add_node("database", "Postgres DB")

    session.add_edge("Ingress", "Legacy Cache", "Read")
    session.add_edge("Legacy Cache", "Postgres DB", "Fallback")
    session.add_edge("Ingress", "Postgres DB", "Direct")

    assert "legacy cache" in session.label_to_id
    assert (id_a, id_b) in session.edge_set
    assert (id_b, id_c) in session.edge_set
    assert (id_a, id_c) in session.edge_set

    delta = GraphDeltaSchema(
        person_occluding_board=False,
        has_meaningful_change=True,
        removed_vertices=["Legacy Cache"],
        diff_summary="- Erased Legacy Cache",
    )
    mutations = session.apply_delta(delta)
    assert mutations == 1

    # Internal lookup maps must no longer contain the erased vertex or its incident edges
    assert "legacy cache" not in session.label_to_id
    assert "legacy cache" not in session.node_by_label
    assert ("legacy cache", "service") not in session.node_by_key
    assert id_b not in session.node_metadata
    assert (id_a, id_b) not in session.edge_set
    assert (id_b, id_c) not in session.edge_set
    assert (id_a, id_c) in session.edge_set

    # Remaining structure in Draw.io XML
    xml = session.get_xml()
    assert "Legacy Cache" not in xml
    assert "Ingress" in xml
    assert "Postgres DB" in xml
    assert session.get_existing_edges_summary() == ["Ingress -> Postgres DB"]


def test_apply_delta_update_vertex_rename_and_type_preserves_edges():
    """
    AC2: LiveGraphSession.apply_delta() renames updated vertices and updates lookup maps
    while preserving incident edges and remaining graph structure.
    """
    session = LiveGraphSession("test-update-vertex")
    id_gw = session.add_node("service", "API GW")
    id_db = session.add_node("database", "Main DB")
    session.add_edge("API GW", "Main DB", "SQL")

    delta = GraphDeltaSchema(
        person_occluding_board=False,
        has_meaningful_change=True,
        updated_vertices=[
            UpdatedVertexSchema(old_label="API GW", new_label="Edge Router", node_type="decision")
        ],
        diff_summary="~ Renamed API GW to Edge Router",
    )
    mutations = session.apply_delta(delta)
    assert mutations == 1

    # Cell ID preserved, maps re-keyed
    assert "api gw" not in session.label_to_id
    assert session.label_to_id.get("edge router") == id_gw
    assert session.node_by_key.get(("edge router", "decision")) == id_gw
    assert session.node_metadata[id_gw] == {"label": "Edge Router", "type": "decision"}

    # Incident edge still connected to the renamed vertex
    assert (id_gw, id_db) in session.edge_set
    assert session.get_existing_edges_summary() == ["Edge Router -> Main DB"]

    xml = session.get_xml()
    assert "Edge Router" in xml
    assert "API GW" not in xml
    assert "rhombus" in xml


def test_apply_delta_remove_and_rewire_edges():
    """
    AC2: LiveGraphSession.apply_delta() removes erased edges and supports rewiring arrows
    while preserving vertices and remaining graph structure.
    """
    session = LiveGraphSession("test-remove-edge")
    id_client = session.add_node("terminal", "Mobile App")
    id_monolith = session.add_node("service", "Monolith")
    id_worker = session.add_node("service", "Queue Worker")

    session.add_edge("Mobile App", "Monolith")
    session.add_edge("Monolith", "Queue Worker")
    assert (id_client, id_monolith) in session.edge_set
    assert (id_monolith, id_worker) in session.edge_set

    # Erase Mobile App -> Monolith arrow and rewire Mobile App -> Queue Worker
    delta = GraphDeltaSchema(
        person_occluding_board=False,
        has_meaningful_change=True,
        removed_edges=[RemovedEdgeSchema(source_label="Mobile App", target_label="Monolith")],
        added_edges=[EdgeAddition(source_label="Mobile App", target_label="Queue Worker", edge_label="Async")],
        diff_summary="Rewired Mobile App to Queue Worker",
    )
    mutations = session.apply_delta(delta)
    assert mutations == 2

    assert (id_client, id_monolith) not in session.edge_set
    assert (id_client, id_worker) in session.edge_set
    assert (id_monolith, id_worker) in session.edge_set

    edges_summary = session.get_existing_edges_summary()
    assert "Mobile App -> Monolith" not in edges_summary
    assert "Mobile App -> Queue Worker" in edges_summary
    assert "Monolith -> Queue Worker" in edges_summary


def test_apply_delta_skips_when_person_occluding_board():
    """
    AC3: When person_occluding_board is True, apply_delta is skipped so occluded shapes
    are never accidentally deleted or mutated.
    """
    session = LiveGraphSession("test-occlusion-guard")
    id_auth = session.add_node("service", "Auth Service")
    id_db = session.add_node("database", "Session Store")
    session.add_edge("Auth Service", "Session Store")

    occluded_delta = GraphDeltaSchema(
        person_occluding_board=True,
        has_meaningful_change=True,
        removed_vertices=["Auth Service"],
        updated_vertices=[UpdatedVertexSchema(old_label="Session Store", new_label="Deleted Store")],
        removed_edges=[RemovedEdgeSchema(source_label="Auth Service", target_label="Session Store")],
        added_vertices=[VertexAddition(temp_id="v-phantom", label="Phantom", node_type="service")],
        diff_summary="Speaker standing in front of board",
    )

    mutations = session.apply_delta(occluded_delta)
    assert mutations == 0

    # All existing vertices and edges remain intact
    assert session.label_to_id.get("auth service") == id_auth
    assert session.label_to_id.get("session store") == id_db
    assert (id_auth, id_db) in session.edge_set
    assert "phantom" not in session.label_to_id
    assert session.get_existing_edges_summary() == ["Auth Service -> Session Store"]


@pytest.mark.asyncio
async def test_extract_graph_delta_from_gemini_prompt_and_removals_update():
    """
    Verifies extract_graph_delta_from_gemini includes both existing_nodes and existing_edges
    in the prompt, instructs against removal during occlusion, and parses full delta mutations.
    """
    assert extract_graph_delta_from_gemini_async is extract_graph_delta_from_gemini

    existing_nodes = [{"label": "Gateway", "type": "service"}, {"label": "Old Worker", "type": "service"}]
    existing_edges = ["Gateway -> Old Worker"]

    mock_response = GraphDeltaSchema(
        person_occluding_board=False,
        has_meaningful_change=True,
        added_vertices=[VertexAddition(temp_id="v2", label="Redis Queue", node_type="database")],
        added_edges=[EdgeAddition(source_label="Gateway", target_label="Redis Queue", edge_label="Pub")],
        removed_vertices=["Old Worker"],
        updated_vertices=[UpdatedVertexSchema(old_label="Gateway", new_label="API Gateway", node_type="service")],
        removed_edges=[RemovedEdgeSchema(source_label="Gateway", target_label="Old Worker")],
        diff_summary="Replaced Old Worker with Redis Queue",
    )

    with patch("graph_engine.llm.generate_structured", new_callable=AsyncMock) as mock_gen:
        mock_gen.return_value = json.dumps(mock_response.model_dump())

        delta = await extract_graph_delta_from_gemini(
            b"fake-jpeg-bytes",
            existing_nodes=existing_nodes,
            existing_edges=existing_edges,
            api_key="test-key",
        )

        assert mock_gen.call_count == 1
        prompt_sent = mock_gen.call_args[0][0]
        assert "Gateway" in prompt_sent
        assert "Old Worker" in prompt_sent
        assert "Gateway -> Old Worker" in prompt_sent
        assert "person_occluding_board" in prompt_sent
        assert "removed_vertices" in prompt_sent
        assert "removed_edges" in prompt_sent

        assert delta.removed_vertices == ["Old Worker"]
        assert len(delta.updated_vertices) == 1
        assert delta.updated_vertices[0].old_label == "Gateway"
        assert delta.updated_vertices[0].new_label == "API Gateway"
        assert len(delta.removed_edges) == 1
        assert delta.removed_edges[0].source_label == "Gateway"
        assert delta.removed_edges[0].target_label == "Old Worker"


@pytest.mark.asyncio
async def test_extract_graph_delta_clears_removals_when_occluded():
    """
    AC3 safety check: Even if the LLM returns removed_vertices/removed_edges while
    person_occluding_board is True, extract_graph_delta_from_gemini strips them out.
    """
    raw_llm_payload = {
        "person_occluding_board": True,
        "has_meaningful_change": False,
        "added_vertices": [],
        "added_edges": [],
        "removed_vertices": ["Occluded Node"],
        "updated_vertices": [],
        "removed_edges": [{"source_label": "A", "target_label": "Occluded Node"}],
        "diff_summary": "Person blocking board",
    }

    with patch("graph_engine.llm.generate_structured", new_callable=AsyncMock) as mock_gen:
        mock_gen.return_value = json.dumps(raw_llm_payload)

        delta = await extract_graph_delta_from_gemini(
            b"fake-jpeg-bytes",
            existing_nodes=[{"label": "Occluded Node", "type": "service"}],
            existing_edges=["A -> Occluded Node"],
            api_key="test-key",
        )

        assert delta.person_occluding_board is True
        assert delta.removed_vertices == []
        assert delta.removed_edges == []
