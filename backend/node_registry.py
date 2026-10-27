"""
Node Registry Specification for Draw.io / mxGraph Architecture Elements
Source: SPEC_DOC.md §4.5 (Finding #10)
"""
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Tuple


@dataclass(frozen=True)
class NodeDefinition:
    type_name: str
    drawio_style: str
    default_dimensions: Tuple[float, float]
    fill_color: str
    stroke_color: str
    label_prefix: str


def _registry_path() -> Path:
    here = Path(__file__).resolve().parent
    # Repo checkout uses shared/; the Docker image (context = backend/) gets a copy beside this file.
    for candidate in (here.parent / "shared" / "node_registry.json", here / "node_registry.json"):
        if candidate.is_file():
            return candidate
    raise FileNotFoundError("node_registry.json not found (expected shared/ or backend/)")


def _load_registry() -> Dict[str, NodeDefinition]:
    nodes = json.loads(_registry_path().read_text(encoding="utf-8"))["nodes"]
    return {
        n["typeName"]: NodeDefinition(
            type_name=n["typeName"],
            drawio_style=n["drawioStyle"],
            default_dimensions=(float(n["width"]), float(n["height"])),
            fill_color=n["fillColor"],
            stroke_color=n["strokeColor"],
            label_prefix=n["labelPrefix"],
        )
        for n in nodes
    }


# Single source: shared/node_registry.json (regenerate TS with scripts/gen_node_registry.mjs)
NODE_REGISTRY: Dict[str, NodeDefinition] = _load_registry()
