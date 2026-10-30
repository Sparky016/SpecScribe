"""
In-Memory drawio-mcp Sugiyama Layout Engine & Headless Playwright Renderer
Part of SpecScribe AR Backend (T-05 & T-06)
"""

import asyncio
import base64
import io
import json
import logging
import os
import uuid
from typing import Any, Dict, List, Literal, Optional, Set, Tuple

import imagehash
from PIL import Image
from pydantic import BaseModel, Field

# drawio-mcp imports
from drawio_mcp.layout_engine import LayoutEngineConfig, relayout_diagram
from drawio_mcp.models import Diagram, DrawioFile, MxCell

logger = logging.getLogger("specscribe.graph_engine")

# Pre-warm scipy DCT C-extensions for sub-millisecond perceptual hashing
try:
    _ = imagehash.phash(Image.new("RGB", (16, 16)))
except Exception:
    pass

try:
    from node_registry import NODE_REGISTRY
except ImportError:
    from backend.node_registry import NODE_REGISTRY

try:
    import llm
except ImportError:
    from backend import llm

NodeTypeLiteral = Literal[tuple(NODE_REGISTRY)]  # type: ignore[valid-type]

# Waveguide-Optimized drawio-mcp Styling Matrix (Snap Spectacles 2024 additive waveguides)
STYLE_MAP: Dict[str, str] = {k: v.drawio_style for k, v in NODE_REGISTRY.items()}

DEFAULT_DIMENSIONS: Dict[str, Tuple[float, float]] = {
    k: v.default_dimensions for k, v in NODE_REGISTRY.items()
}

EDGE_STYLE = (
    "edgeStyle=orthogonalEdgeStyle;rounded=1;html=1;strokeColor=#00E5FF;"
    "strokeWidth=3;fontColor=#00E5FF;"
)


class VertexAddition(BaseModel):
    temp_id: str = Field(description="Unique identifier or existing vertex ID")
    label: str = Field(description="Concise label written inside the whiteboard shape")
    node_type: NodeTypeLiteral


class EdgeAddition(BaseModel):
    source_label: str
    target_label: str
    edge_label: str = ""


class UpdatedVertexSchema(BaseModel):
    old_label: str = Field(description="Existing label of the shape on the board")
    new_label: str = Field(description="Updated label written on the board")
    node_type: Optional[Literal["service", "database", "client", "decision", "terminal"]] = None


class RemovedEdgeSchema(BaseModel):
    source_label: str
    target_label: str


class GraphDeltaSchema(BaseModel):
    person_occluding_board: bool = Field(description="True if a person's body blocks the diagram")
    has_meaningful_change: bool
    added_vertices: List[VertexAddition] = Field(default_factory=list)
    added_edges: List[EdgeAddition] = Field(default_factory=list)
    removed_vertices: List[str] = Field(
        default_factory=list,
        description="Exact labels of existing vertices that were visibly erased from the whiteboard",
    )
    updated_vertices: List[UpdatedVertexSchema] = Field(
        default_factory=list,
        description="Existing vertices whose label or type was modified",
    )
    removed_edges: List[RemovedEdgeSchema] = Field(
        default_factory=list,
        description="Existing edges whose arrow was erased from the whiteboard",
    )
    diff_summary: str = Field(default="", description="Max 60 chars summary of the visual update")


class LayoutEngine:
    """
    Sugiyama Hierarchical DAG Layout Engine wrapper for drawio-mcp.
    """

    def __init__(self, config: Optional[LayoutEngineConfig] = None):
        self.config = config or LayoutEngineConfig()

    def apply_sugiyama(
        self,
        diagram: Diagram,
        layer_distance: float = 70.0,
        node_distance: float = 50.0,
        direction: str = "TB",
    ) -> Dict[str, Tuple[float, float]]:
        """
        Executes hierarchical Sugiyama layout directly in-memory.
        """
        cfg = LayoutEngineConfig(
            rank_spacing=layer_distance,
            node_spacing=node_distance,
            min_node_distance=min(40.0, node_distance),
            route_edges=True,
            compact=True,
        )
        return relayout_diagram(diagram, direction=direction, config=cfg)


class LiveGraphSession:
    """
    In-memory drawio-mcp graph session for real-time meeting diagram synchronization.
    """

    def __init__(self, meeting_id: str, initial_xml: Optional[str] = None):
        self.meeting_id = meeting_id
        self.file = DrawioFile()
        self.diagram = self.file.active_diagram
        self.diagram.name = "ARStream"
        self.layout_engine = LayoutEngine()
        self.node_by_label: Dict[str, str] = {}  # lowercase label -> cell_id (latest node with that label)
        self.label_to_id: Dict[str, str] = self.node_by_label  # alias for label -> cell_id lookup
        self.node_by_key: Dict[Tuple[str, str], str] = {}  # (lowercase label, type) -> cell_id (dedupe key)
        self.node_metadata: Dict[str, Dict[str, str]] = {}  # cell_id -> {label, type}
        self.edge_set: Set[Tuple[str, str]] = set()  # (source_cell_id, target_cell_id)
        self.last_node_reused: bool = False  # True when the last add_node call reused an existing node
        self.last_phash: Optional[imagehash.ImageHash] = None

    def _generate_node_label(self, clean_type: str) -> str:
        """Auto-label for nodes without a label: '<registry prefix> <n>', unique per type."""
        prefix = NODE_REGISTRY[clean_type].label_prefix if clean_type in NODE_REGISTRY else "Node"
        n = sum(1 for m in self.node_metadata.values() if m["type"] == clean_type) + 1
        while (f"{prefix} {n}".lower(), clean_type) in self.node_by_key:
            n += 1
        return f"{prefix} {n}"

    @staticmethod
    def _normalize_node_type(node_type: Optional[str]) -> str:
        clean_type = (node_type or "service").strip().lower()
        if clean_type == "client" and "client" not in STYLE_MAP and "terminal" in STYLE_MAP:
            clean_type = "terminal"
        if clean_type not in STYLE_MAP:
            clean_type = "service"
        return clean_type

    def add_node(self, node_type: str, label: Optional[str]) -> str:
        """
        Inserts a node styled for waveguide display and registers its label.

        A node is reused only when both the label (case-insensitive) and the type match.
        Missing/blank labels get an auto-generated one. Sets `last_node_reused`.
        """
        clean_type = self._normalize_node_type(node_type)

        style = STYLE_MAP[clean_type]
        width, height = DEFAULT_DIMENSIONS.get(clean_type, (120.0, 60.0))

        clean_label = (label or "").strip()
        if not clean_label:
            clean_label = self._generate_node_label(clean_type)
        lower_label = clean_label.lower()

        # Reuse only when label AND type match
        key = (lower_label, clean_type)
        if key in self.node_by_key:
            existing_id = self.node_by_key[key]
            for c in self.diagram.cells:
                if c.id == existing_id:
                    c.value = clean_label
                    c.style = style
                    break
            self.node_metadata[existing_id] = {"label": clean_label, "type": clean_type}
            self.node_by_label[lower_label] = existing_id
            self.last_node_reused = True
            return existing_id

        # Insert new vertex
        cell_id = self.diagram.add_vertex(
            value=clean_label,
            x=50.0,
            y=50.0,
            width=width,
            height=height,
            style=style,
        )
        self.node_by_key[key] = str(cell_id)
        self.node_by_label[lower_label] = str(cell_id)
        self.node_metadata[str(cell_id)] = {"label": clean_label, "type": clean_type}
        self.last_node_reused = False
        return str(cell_id)

    def add_edge(self, source_label_or_id: str, target_label_or_id: str, edge_label: str = "") -> Optional[str]:
        """
        Inserts an orthogonal edge between two vertices.
        """
        s_id = self._resolve_node_id(source_label_or_id)
        t_id = self._resolve_node_id(target_label_or_id)

        if not s_id or not t_id or s_id == t_id:
            logger.warning("Could not resolve source/target for edge: %s -> %s", source_label_or_id, target_label_or_id)
            return None

        # Check if edge already exists between these cells
        for c in self.diagram.cells:
            if c.edge and getattr(c, "source", None) == s_id and getattr(c, "target", None) == t_id:
                if edge_label:
                    c.value = edge_label
                self.edge_set.add((s_id, t_id))
                return c.id

        edge_id = self.diagram.add_edge(
            source=s_id,
            target=t_id,
            style=EDGE_STYLE,
        )
        if edge_label:
            for c in self.diagram.cells:
                if c.id == edge_id:
                    c.value = edge_label
                    break

        self.edge_set.add((str(s_id), str(t_id)))
        return str(edge_id)

    def get_existing_edges_summary(self) -> List[str]:
        """
        Returns existing directed edges formatted as ["Source -> Target", ...].
        """
        summaries: List[str] = []
        for c in self.diagram.cells:
            if c.edge:
                s_id = getattr(c, "source", None)
                t_id = getattr(c, "target", None)
                s_meta = self.node_metadata.get(str(s_id)) if s_id is not None else None
                t_meta = self.node_metadata.get(str(t_id)) if t_id is not None else None
                s_label = s_meta["label"] if s_meta else None
                t_label = t_meta["label"] if t_meta else None
                if not s_label and s_id is not None:
                    for vc in self.diagram.cells:
                        if vc.vertex and vc.id == s_id:
                            s_label = vc.value
                            break
                if not t_label and t_id is not None:
                    for vc in self.diagram.cells:
                        if vc.vertex and vc.id == t_id:
                            t_label = vc.value
                            break
                if s_label and t_label:
                    summaries.append(f"{s_label} -> {t_label}")
        return summaries

    def _resolve_node_id(self, ref: str) -> Optional[str]:
        clean_ref = ref.strip().lower()
        if clean_ref in self.node_by_label:
            return self.node_by_label[clean_ref]
        if ref.strip() in self.node_by_label:
            return self.node_by_label[ref.strip()]
        # Check node_metadata by case-insensitive label
        for cid, meta in self.node_metadata.items():
            if meta.get("label", "").strip().lower() == clean_ref:
                return cid
        # Check by direct ID or cell value
        for c in self.diagram.cells:
            if c.vertex and c.id not in ("0", "1"):
                if c.id == ref or (c.value and c.value.strip().lower() == clean_ref):
                    return c.id
        return None

    def update_node(self, old_label_or_id: str, new_label: str, node_type: Optional[str] = None) -> Optional[str]:
        """
        Renames an existing vertex and optionally updates its node_type / styling,
        re-keying internal lookup maps while preserving its cell_id and incident edges.
        """
        cell_id = self._resolve_node_id(old_label_or_id)
        clean_new_label = (new_label or "").strip()
        if not cell_id or not clean_new_label:
            logger.warning("Could not resolve node to update: %s -> %s", old_label_or_id, new_label)
            return None

        old_meta = self.node_metadata.get(cell_id, {})
        old_label = old_meta.get("label", old_label_or_id)
        old_type = old_meta.get("type", "service")
        clean_new_type = self._normalize_node_type(node_type) if node_type else old_type

        # Remove old lookup keys pointing to this cell_id
        for k in [k for k, v in self.node_by_label.items() if v == cell_id or k == old_label.strip().lower()]:
            if self.node_by_label.get(k) == cell_id:
                self.node_by_label.pop(k, None)
        for k in [k for k, v in self.node_by_key.items() if v == cell_id or k == (old_label.strip().lower(), old_type)]:
            if self.node_by_key.get(k) == cell_id:
                self.node_by_key.pop(k, None)

        # Update cell in diagram
        for c in self.diagram.cells:
            if c.vertex and c.id == cell_id:
                c.value = clean_new_label
                if node_type is not None or clean_new_type != old_type:
                    c.style = STYLE_MAP[clean_new_type]
                    if c.geometry is not None:
                        w, h = DEFAULT_DIMENSIONS.get(clean_new_type, (120.0, 60.0))
                        c.geometry.width = w
                        c.geometry.height = h
                break

        lower_new = clean_new_label.lower()
        self.node_by_label[lower_new] = cell_id
        self.node_by_key[(lower_new, clean_new_type)] = cell_id
        self.node_metadata[cell_id] = {"label": clean_new_label, "type": clean_new_type}
        return cell_id

    def remove_edge(self, source_label_or_id: str, target_label_or_id: str) -> int:
        """
        Removes matching directed edge mxCells between source and target from diagram.cells and edge_set.
        """
        s_id = self._resolve_node_id(source_label_or_id)
        t_id = self._resolve_node_id(target_label_or_id)
        if not s_id or not t_id:
            return 0

        removed_edge_ids: Set[str] = set()
        kept_cells: List[MxCell] = []
        for c in self.diagram.cells:
            if c.edge and getattr(c, "source", None) == s_id and getattr(c, "target", None) == t_id:
                removed_edge_ids.add(c.id)
            else:
                kept_cells.append(c)

        if removed_edge_ids:
            # Also drop any edge child label cells parented to removed edges
            self.diagram.cells = [c for c in kept_cells if getattr(c, "parent", None) not in removed_edge_ids]
            self.edge_set.discard((s_id, t_id))

        return len(removed_edge_ids)

    def remove_node(self, label_or_id: str) -> bool:
        """
        Removes a vertex mxCell and all incident edge mxCells from diagram.cells and internal lookup maps.
        """
        cell_id = self._resolve_node_id(label_or_id)
        if not cell_id:
            return False

        removed_edge_ids: Set[str] = set()
        for c in self.diagram.cells:
            if c.edge and (getattr(c, "source", None) == cell_id or getattr(c, "target", None) == cell_id):
                removed_edge_ids.add(c.id)

        self.diagram.cells = [
            c
            for c in self.diagram.cells
            if c.id != cell_id
            and c.id not in removed_edge_ids
            and getattr(c, "parent", None) != cell_id
            and getattr(c, "parent", None) not in removed_edge_ids
        ]

        meta = self.node_metadata.pop(cell_id, None)
        old_label_lower = meta["label"].strip().lower() if meta and "label" in meta else label_or_id.strip().lower()

        for k in [k for k, v in self.node_by_label.items() if v == cell_id or k == old_label_lower]:
            if self.node_by_label.get(k) == cell_id:
                self.node_by_label.pop(k, None)

        for k in [k for k, v in self.node_by_key.items() if v == cell_id or k[0] == old_label_lower]:
            if self.node_by_key.get(k) == cell_id:
                self.node_by_key.pop(k, None)

        self.edge_set = {pair for pair in self.edge_set if pair[0] != cell_id and pair[1] != cell_id}
        return True

    def apply_delta(self, delta: GraphDeltaSchema) -> int:
        """
        Applies incremental vertex/edge updates, removals, and additions from vision diff extraction.
        Skips all mutations if person_occluding_board is True so occluded shapes are never accidentally deleted.
        """
        if delta.person_occluding_board:
            logger.info("Person occluding whiteboard; skipping apply_delta to protect existing graph.")
            return 0

        mutations = 0

        # a. Process updated_vertices: update mxCell value/style in self.diagram and re-key self.label_to_id
        for u in delta.updated_vertices:
            updated_id = self.update_node(u.old_label, u.new_label, u.node_type)
            if updated_id:
                mutations += 1

        # b. Process removed_edges: remove matching edge mxCells from self.diagram.cells and self.edge_set
        for re_edge in delta.removed_edges:
            removed_count = self.remove_edge(re_edge.source_label, re_edge.target_label)
            mutations += removed_count

        # c. Process removed_vertices: remove vertex mxCell and any incident edge mxCells
        for rv_label in delta.removed_vertices:
            if self.remove_node(rv_label):
                mutations += 1

        # d. Process added_vertices and added_edges, then run relayout_diagram
        for v in delta.added_vertices:
            self.add_node(v.node_type, v.label)
            mutations += 1

        for e in delta.added_edges:
            edge_id = self.add_edge(e.source_label, e.target_label, e.edge_label)
            if edge_id:
                mutations += 1

        if mutations > 0:
            self.layout_engine.apply_sugiyama(self.diagram, layer_distance=70.0, node_distance=50.0)

        return mutations

    def compile_layout_xml(self) -> str:
        """
        Applies Sugiyama hierarchical layout and compiles the Draw.io XML string.
        """
        self.layout_engine.apply_sugiyama(self.diagram, layer_distance=70.0, node_distance=50.0)
        return self.file.to_xml()

    def get_xml(self) -> str:
        return self.file.to_xml()

    def check_image_diff(self, image_bytes: bytes, threshold: int = 6) -> Tuple[bool, int, imagehash.ImageHash]:
        """
        Perceptual hash diff gate (<5ms). Returns (is_meaningful, hamming_distance, current_hash).
        """
        with Image.open(io.BytesIO(image_bytes)) as img:
            current_hash = imagehash.phash(img)

        if self.last_phash is None:
            self.last_phash = current_hash
            return True, 999, current_hash

        hamming = abs(current_hash - self.last_phash)
        if hamming >= threshold:
            self.last_phash = current_hash
            return True, hamming, current_hash

        return False, hamming, current_hash


try:
    from playwright.async_api import Error as PlaywrightError
    from playwright.async_api import TimeoutError as PlaywrightTimeoutError
except ImportError:  # pragma: no cover - keeps the module importable without Playwright
    class PlaywrightError(Exception):
        """Stand-in so renderer error handling still type-checks without Playwright."""

    class PlaywrightTimeoutError(PlaywrightError):
        """Stand-in for playwright.async_api.TimeoutError."""


# Upper bound for one render attempt (evaluate + completion wait + screenshot).
RENDER_TIMEOUT_S = 2.0
# How long to wait for window.__renderDone after window.render() is invoked.
RENDER_DONE_TIMEOUT_MS = 500
# Per-resource bound when closing page/browser/playwright, so teardown can't hang a restart.
TEARDOWN_TIMEOUT_S = 5.0

# export3.html's window.render() exposes no completion promise or callback, so the render is
# considered done once the SVG's element count is stable across consecutive polls. A thenable
# return value is awaited first in case a future page version provides one. __renderSeq stops a
# poller left over from a timed-out render from flagging a newer render as done.
_RENDER_JS = """
(args) => {
    const seq = (window.__renderSeq || 0) + 1;
    window.__renderSeq = seq;
    window.__renderDone = false;
    const result = window.render({
        xml: args.xml,
        format: 'png',
        bg: 'none',
        border: 0,
        scale: args.scale,
        extras: JSON.stringify({ diagrams: [{ dark: true }] })
    });
    const countSvgElements = () => {
        const svg = document.querySelector('svg');
        return svg ? svg.getElementsByTagName('*').length : -1;
    };
    let last = -1, stablePolls = 0, polls = 0;
    const poll = () => {
        if (window.__renderSeq !== seq) return;
        const count = countSvgElements();
        stablePolls = (count >= 0 && count === last) ? stablePolls + 1 : 0;
        last = count;
        if (stablePolls >= 2) {
            window.__renderDone = true;
            return;
        }
        if (++polls < 200) setTimeout(poll, 16);
    };
    Promise.resolve(result).then(poll, () => {});
}
"""

_RENDER_DONE_JS = "() => window.__renderDone === true"


class HeadlessDrawioDaemon:
    """
    Pre-warmed headless Chromium renderer using Playwright and viewer.diagrams.net/export3.html.
    Delivers transparent RGBA PNG renders in <140ms with zero disk I/O.

    Each render waits for a render-complete signal before the screenshot, is bounded by
    RENDER_TIMEOUT_S, and a Playwright failure (e.g. Chromium crash) restarts the browser once.
    """

    def __init__(self):
        self.playwright = None
        self.browser = None
        self.page = None
        self._lock = asyncio.Lock()
        self._is_ready = False
        self._restarting = False  # guard flag: set while restart runs under the render lock
        self._stopped = False  # set by stop(); prevents a restart from reviving a stopped daemon
        self.render_timeout_s = RENDER_TIMEOUT_S
        self.render_done_timeout_ms = RENDER_DONE_TIMEOUT_MS

    def is_ready(self) -> bool:
        """True when the renderer can accept renders (started, has a page, not restarting)."""
        return self._is_ready and self.page is not None and not self._restarting

    async def start(self) -> None:
        """Public start: clears a previous stop() and launches the browser."""
        self._stopped = False
        await self._launch()
        self._is_ready = True
        logger.info("HeadlessDrawioDaemon pre-warmed and ready.")

    async def _launch(self) -> None:
        """Launch Playwright, Chromium and the export page. Never touches _stopped or _is_ready."""
        from playwright.async_api import async_playwright

        logger.info("Initializing Playwright Headless Chromium Daemon...")
        self.playwright = await async_playwright().start()
        self.browser = await self.playwright.chromium.launch(
            headless=True,
            args=[
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-dev-shm-usage",
                "--disable-gpu",
            ],
        )
        self.page = await self.browser.new_page()
        # Navigate to pre-warmed export page
        logger.info("Navigating to https://viewer.diagrams.net/export3.html...")
        await self.page.goto("https://viewer.diagrams.net/export3.html", wait_until="networkidle")

        # Warm up page rendering pipeline so steady-state renders run in <80ms
        try:
            warmup_xml = (
                '<mxfile><diagram><mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>'
                '<mxCell id="w" value="" vertex="1" parent="1"><mxGeometry width="10" height="10" as="geometry"/>'
                "</mxCell></root></mxGraphModel></diagram></mxfile>"
            )
            await asyncio.wait_for(self._render_once(warmup_xml, scale=1.0), timeout=self.render_timeout_s)
        except Exception as e:
            logger.debug("Warmup render initial pass: %s", e)

    async def stop(self) -> None:
        logger.info("Stopping HeadlessDrawioDaemon...")
        self._stopped = True
        self._is_ready = False
        await self._teardown()

    async def _teardown(self) -> None:
        """Close page, browser and playwright independently so one failure can't leak the rest."""
        page, browser, playwright = self.page, self.browser, self.playwright
        self.page = self.browser = self.playwright = None
        closers = (
            ("page", page.close if page else None),
            ("browser", browser.close if browser else None),
            ("playwright", playwright.stop if playwright else None),
        )
        for name, close in closers:
            if close is None:
                continue
            try:
                await asyncio.wait_for(close(), timeout=TEARDOWN_TIMEOUT_S)
            except Exception as e:
                logger.warning("Error closing HeadlessDrawioDaemon %s: %s", name, e)

    async def _restart_locked(self) -> None:
        """stop()+start() the browser. Caller must hold self._lock; never re-acquires it."""
        if self._stopped:
            raise RuntimeError("HeadlessDrawioDaemon was stopped; not restarting")
        self._restarting = True
        try:
            await self._teardown()
            # Uses _launch(), not start(): start() clears _stopped and would undo a stop()
            # that arrived while this restart was in flight.
            if self._stopped:
                raise RuntimeError("HeadlessDrawioDaemon was stopped during restart")
            await self._launch()
            if self._stopped:
                raise RuntimeError("HeadlessDrawioDaemon was stopped during restart")
            self._is_ready = True
        except BaseException:
            # Failed, cancelled or stopped mid-restart: leave no half-started Chromium behind.
            self._is_ready = False
            await self._teardown()
            raise
        finally:
            self._restarting = False
        logger.info("HeadlessDrawioDaemon restarted.")

    async def _render_once(self, drawio_xml: str, scale: float = 1.5) -> bytes:
        """One render: window.render(), wait for the render-complete signal, then screenshot."""
        page = self.page
        await page.evaluate(_RENDER_JS, {"xml": drawio_xml, "scale": scale})
        # Screenshot only after the page reports the new diagram is fully drawn
        await page.wait_for_function(_RENDER_DONE_JS, timeout=self.render_done_timeout_ms)
        # Capture SVG bounding box screenshot with omit_background=True
        svg = page.locator("svg").first
        return await svg.screenshot(omit_background=True)

    async def _render_bounded(self, drawio_xml: str) -> bytes:
        try:
            return await asyncio.wait_for(self._render_once(drawio_xml), timeout=self.render_timeout_s)
        except PlaywrightTimeoutError as e:
            raise TimeoutError(f"Render-complete signal not received: {e}") from e

    async def render_b64_png(self, drawio_xml: str) -> str:
        """
        Renders Draw.io XML into a Base64 transparent PNG via export3.html window.render().

        Raises TimeoutError if the render does not finish within render_timeout_s (the lock is
        released). On a Playwright error (e.g. TargetClosedError after a Chromium crash) the
        browser is restarted once and the render retried once; a failed restart leaves the
        daemon not ready.
        """
        if not self.is_ready():
            raise RuntimeError("HeadlessDrawioDaemon is not initialized or ready")

        async with self._lock:
            # Re-check: a crash, failed restart or stop() may have happened while we waited.
            if not self.is_ready():
                raise RuntimeError("HeadlessDrawioDaemon is not initialized or ready")
            try:
                png_bytes = await self._render_bounded(drawio_xml)
            except PlaywrightError as e:
                logger.error("Renderer Playwright error, restarting Chromium once: %s", e)
                self._is_ready = False
                try:
                    await self._restart_locked()
                except Exception as restart_err:
                    logger.error("HeadlessDrawioDaemon restart failed; renderer not ready: %s", restart_err)
                    raise
                png_bytes = await self._render_bounded(drawio_xml)
            return base64.b64encode(png_bytes).decode("ascii")


async def extract_graph_delta_from_gemini(
    image_bytes: bytes,
    existing_nodes: List[Any],
    existing_edges: Optional[List[str]] = None,
    api_key: Optional[str] = None,
) -> GraphDeltaSchema:
    """
    Asynchronously calls Gemini with structured JSON output schema to detect whiteboard diagram changes.
    Uses client.aio to prevent blocking the asyncio event loop during live AR streaming (Fixes #1).
    Falls back gracefully when API key is omitted or during offline testing.
    """
    key = api_key or os.environ.get("GEMINI_API_KEY")
    if not key:
        logger.info("No GEMINI_API_KEY detected; returning no-change vision delta")
        if os.environ.get("SPECSCRIBE_DEMO_MODE") == "1":
            return GraphDeltaSchema(
                person_occluding_board=False,
                has_meaningful_change=True,
                added_vertices=[
                    VertexAddition(temp_id=str(uuid.uuid4())[:8], label="Whiteboard Node", node_type="service")
                ],
                added_edges=[],
                diff_summary="+ Detected whiteboard stroke additions",
            )
        return GraphDeltaSchema(
            person_occluding_board=False,
            has_meaningful_change=False,
            added_vertices=[],
            added_edges=[],
            diff_summary="",
        )

    node_labels = [
        n.get("label") if isinstance(n, dict) else str(n)
        for n in (existing_nodes or [])
    ]
    edge_summaries = list(existing_edges) if existing_edges else []

    try:
        from google.genai import types

        prompt = (
            "Analyze this whiteboard frame from a software architecture brainstorming session.\n"
            f"Already recognized nodes: {node_labels}\n"
            f"Already recognized edges: {edge_summaries}\n"
            "Identify any newly drawn, modified/renamed (`updated_vertices`), or erased (`removed_vertices`, `removed_edges`) shapes (service, decision, database, terminal) and arrows.\n"
            "CRITICAL OCCLUSION & DELETION RULE: If a person is standing in front of or blocking the diagram view, set `person_occluding_board=True` and leave `removed_vertices` and `removed_edges` completely empty. "
            "Only populate `removed_vertices` or `removed_edges` when `person_occluding_board` is `False` AND the whiteboard surface where the shape or arrow previously sat is clearly visible and blank (visibly erased). Never remove nodes or edges simply because a person is occluding them."
        )

        text = await llm.generate_structured(
            prompt,
            schema=GraphDeltaSchema,
            contents=[types.Part.from_bytes(data=image_bytes, mime_type="image/jpeg")],
            api_key=key,
        )
        if text:
            data = json.loads(text)
            delta = GraphDeltaSchema.model_validate(data)
            if delta.person_occluding_board:
                delta.removed_vertices = []
                delta.removed_edges = []
            return delta
        logger.warning("Gemini vision extraction returned no response text")
    except Exception as e:
        logger.warning("Gemini vision extraction failed: %s", e)

    if os.environ.get("SPECSCRIBE_DEMO_MODE") == "1":
        existing_labels = {
            (n.get("label", "") if isinstance(n, dict) else str(n)).lower()
            for n in (existing_nodes or [])
        }
        if "whiteboard ingress" not in existing_labels:
            return GraphDeltaSchema(
                person_occluding_board=False,
                has_meaningful_change=True,
                added_vertices=[VertexAddition(temp_id="v-auto", label="Whiteboard Ingress", node_type="service")],
                added_edges=[],
                diff_summary="+ Detected Whiteboard Ingress [service]",
            )
        elif "auth gateway" not in existing_labels:
            return GraphDeltaSchema(
                person_occluding_board=False,
                has_meaningful_change=True,
                added_vertices=[VertexAddition(temp_id="v-auth", label="Auth Gateway", node_type="service")],
                added_edges=[EdgeAddition(source_label="Whiteboard Ingress", target_label="Auth Gateway", edge_label="Proxy /api")],
                diff_summary="+ Ingested [service] Auth Gateway",
            )
        elif "primary db" not in existing_labels:
            return GraphDeltaSchema(
                person_occluding_board=False,
                has_meaningful_change=True,
                added_vertices=[VertexAddition(temp_id="v-db", label="Primary DB", node_type="database")],
                added_edges=[EdgeAddition(source_label="Auth Gateway", target_label="Primary DB", edge_label="Read/Write")],
                diff_summary="+ Ingested [database] Primary DB",
            )
        elif "payment terminal" not in existing_labels:
            return GraphDeltaSchema(
                person_occluding_board=False,
                has_meaningful_change=True,
                added_vertices=[VertexAddition(temp_id="v-term", label="Payment Terminal", node_type="terminal")],
                added_edges=[EdgeAddition(source_label="Whiteboard Ingress", target_label="Payment Terminal", edge_label="Stripe /charge")],
                diff_summary="+ Ingested [terminal] Payment Terminal",
            )
        else:
            return GraphDeltaSchema(
                person_occluding_board=False,
                has_meaningful_change=False,
                added_vertices=[],
                added_edges=[],
                diff_summary="Whiteboard state fully synchronized",
            )
    return GraphDeltaSchema(
        person_occluding_board=False,
        has_meaningful_change=False,
        added_vertices=[],
        added_edges=[],
        diff_summary="",
    )


extract_graph_delta_from_gemini_async = extract_graph_delta_from_gemini


