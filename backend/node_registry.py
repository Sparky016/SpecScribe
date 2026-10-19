"""
Node Registry Specification for Draw.io / mxGraph Architecture Elements
Source: SPEC_DOC.md §4.5 (Finding #10)
"""
from dataclasses import dataclass
from typing import Dict, Tuple


@dataclass(frozen=True)
class NodeDefinition:
    type_name: str
    drawio_style: str
    default_dimensions: Tuple[float, float]
    fill_color: str
    stroke_color: str
    label_prefix: str


NODE_REGISTRY: Dict[str, NodeDefinition] = {
    "service": NodeDefinition(
        type_name="service",
        drawio_style="rounded=1;whiteSpace=wrap;html=1;fillColor=#107C41;strokeColor=#00FF66;fontColor=#FFFFFF;strokeWidth=2;",
        default_dimensions=(140.0, 60.0),
        fill_color="#107C41",
        stroke_color="#00FF66",
        label_prefix="Svc",
    ),
    "decision": NodeDefinition(
        type_name="decision",
        drawio_style="rhombus;whiteSpace=wrap;html=1;fillColor=#004D40;strokeColor=#00E5FF;fontColor=#FFFFFF;strokeWidth=2;",
        default_dimensions=(120.0, 80.0),
        fill_color="#004D40",
        stroke_color="#00E5FF",
        label_prefix="Dec",
    ),
    "database": NodeDefinition(
        type_name="database",
        drawio_style="shape=cylinder3;whiteSpace=wrap;html=1;boundedLbl=1;backgroundOutline=1;size=15;fillColor=#0D47A1;strokeColor=#00E5FF;fontColor=#FFFFFF;strokeWidth=2;",
        default_dimensions=(120.0, 80.0),
        fill_color="#0D47A1",
        stroke_color="#00E5FF",
        label_prefix="DB",
    ),
    "terminal": NodeDefinition(
        type_name="terminal",
        drawio_style="ellipse;whiteSpace=wrap;html=1;fillColor=#311B92;strokeColor=#00FF66;fontColor=#FFFFFF;strokeWidth=2;",
        default_dimensions=(100.0, 60.0),
        fill_color="#311B92",
        stroke_color="#00FF66",
        label_prefix="Client",
    ),
}
