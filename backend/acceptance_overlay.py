"""Overlay acceptance check: does a whiteboard capture come back as the right diagram?

Drives the *running* backend exactly like the Lens does (WebSocket pinch captures of the demo whiteboard keyframes,
downscaled to the Lens's 480p), waits for DIAGRAM_UPDATED, then reads the stored draw.io XML back through the
timeline API and checks it against what is drawn on the board. Uses real Gemini calls (~6 vision calls per run).

Acceptance criteria
  AC1  Empty board (K0): the diagram has no nodes.
  AC2  Two-node board (K1): nodes are exactly {Client, API Gateway}; edges exactly {Client -> API Gateway}, and that
       edge is labelled "HMAC".
  AC3  Four-node board (K2): nodes are exactly {Client, API Gateway, Core Service, Postgres DB}; edges exactly
       {Client -> API Gateway, API Gateway -> Core Service, Core Service -> Postgres DB}; Postgres DB is a database.
  AC4  Re-capturing an unchanged board leaves the diagram unchanged (no duplicates, no removals).
  AC5  Every update broadcasts DIAGRAM_UPDATED with a decodable PNG overlay, and the stored XML parses.
  AC6  The layout follows the board: Client, API Gateway and Core Service run left to right, and Postgres DB sits
       below Core Service.
  AC7  A capture corrects stale state: a meeting whose diagram already holds a node that is not on the board ("S")
       converges to exactly the board's diagram after one capture of K2.
  AC8  The overlay lands on the drawing: the overlay PNG has the board's 5:3 aspect (so the Lens maps it 1:1 onto the
       board quad), and each node's centre is within 0.05 (fraction of the board) of where it is drawn on K2.
  AC9  A capture corrects an earlier partial read: after a centre-cropped capture (the glasses camera's narrow view,
       which cuts labels off), one full capture of K2 yields exactly the board's diagram, with every node within 0.10
       of where it is drawn.

Labels compare case- and whitespace-insensitively ("CLIENT" == "Client").

Usage (backend running on :8000 with SPECSCRIBE_AUTH_DISABLED=1):
    .venv/Scripts/python.exe acceptance_overlay.py            # exit 0 when every criterion passes
"""
from __future__ import annotations

import asyncio
import base64
import io
import json
import os
import sys
import time
import uuid
import xml.etree.ElementTree as ET
from dataclasses import dataclass, field
from urllib.request import urlopen

import websockets
from PIL import Image

BASE_HTTP = os.environ.get("SPECSCRIBE_HTTP", "http://localhost:8000")
BASE_WS = BASE_HTTP.replace("http", "ws", 1)
FOOTAGE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "devpost", "footage")
UPDATE_TIMEOUT_S = 45

TWO_NODES = {"client", "api gateway"}
FOUR_NODES = TWO_NODES | {"core service", "postgres db"}
TWO_EDGES = {("client", "api gateway")}
PAGE_W, PAGE_H = 1000.0, 600.0  # backend overlay page (graph_engine.BOARD_W x BOARD_H)
# Centres of the drawn shapes on K2, as fractions of the whiteboard surface (measured from the frame).
K2_DRAWN = {"client": (0.16, 0.47), "api gateway": (0.57, 0.47), "core service": (0.88, 0.47), "postgres db": (0.88, 0.83)}
FOUR_EDGES = TWO_EDGES | {("api gateway", "core service"), ("core service", "postgres db")}


def norm(label: str) -> str:
    return " ".join((label or "").replace("<br>", " ").split()).lower()


@dataclass
class Diagram:
    nodes: dict = field(default_factory=dict)  # label -> {"style": str, "x": float, "y": float}
    edges: dict = field(default_factory=dict)  # (src label, dst label) -> edge label

    @classmethod
    def parse(cls, xml: str) -> "Diagram":
        d = cls()
        if not xml:
            return d
        root = ET.fromstring(xml)
        cells = list(root.iter("mxCell"))
        by_id = {}
        for c in cells:
            if c.get("vertex") == "1" and not str(c.get("id", "")).startswith("board_anchor_"):
                g = c.find("mxGeometry")
                x = float(g.get("x", 0)) + float(g.get("width", 0)) / 2 if g is not None else 0.0
                y = float(g.get("y", 0)) + float(g.get("height", 0)) / 2 if g is not None else 0.0
                by_id[c.get("id")] = norm(c.get("value", ""))
                d.nodes[norm(c.get("value", ""))] = {"style": c.get("style", ""), "x": x, "y": y}
        for c in cells:
            if c.get("edge") == "1" and c.get("source") in by_id and c.get("target") in by_id:
                d.edges[(by_id[c.get("source")], by_id[c.get("target")])] = norm(c.get("value", ""))
        return d

    def signature(self):
        return (frozenset(self.nodes), frozenset(self.edges.items()))


def frame_b64(name: str, centre_crop: bool = False) -> str:
    with Image.open(os.path.join(FOOTAGE, name)) as img:
        img = img.convert("RGB")
        if centre_crop:  # like the simulated glasses camera: middle ~half of the width, 0.88 aspect
            w, h = img.size
            cw = int(h * 0.88)
            img = img.crop(((w - cw) // 2, 0, (w + cw) // 2, h))
        img.thumbnail((854, 480))
        buf = io.BytesIO()
        img.save(buf, "JPEG", quality=80)
    return base64.b64encode(buf.getvalue()).decode()


def latest_xml(meeting_id: str) -> str:
    with urlopen(f"{BASE_HTTP}/api/meetings/{meeting_id}/timeline", timeout=30) as r:
        data = json.load(r)
    snaps = sorted(data.get("diagram_snapshots", []), key=lambda s: (s.get("timestamp_ms") or 0, s.get("created_at") or ""))
    return snaps[-1]["drawio_xml"] if snaps else ""


class Meeting:
    def __init__(self):
        self.id = str(uuid.uuid4())
        self.ws = None
        self.updates = []

    async def __aenter__(self):
        self.ws = await websockets.connect(f"{BASE_WS}/ws/meeting/{self.id}", max_size=None)
        await self.ws.send(json.dumps({"eventType": "handshake", "client": "overlay-acceptance", "protocolVersion": "1.1.0"}))
        return self

    async def __aexit__(self, *exc):
        await self.ws.close()

    async def capture(self, keyframe: str, centre_crop: bool = False) -> dict | None:
        """Sends one pinch capture; returns the DIAGRAM_UPDATED event, or None if none arrives in time."""
        await self.ws.send(json.dumps({
            "eventType": "cameraFrame", "timestamp_ms": int(time.time() * 1000) % 10_000_000,
            "image_b64": frame_b64(keyframe, centre_crop), "isManual": True, "isManualTrigger": True, "captureMode": "MANUAL",
        }))
        end = time.monotonic() + UPDATE_TIMEOUT_S
        while time.monotonic() < end:
            try:
                raw = await asyncio.wait_for(self.ws.recv(), timeout=max(0.1, end - time.monotonic()))
            except asyncio.TimeoutError:
                break
            msg = json.loads(raw) if isinstance(raw, str) else {}
            if msg.get("event") == "DIAGRAM_UPDATED":
                self.updates.append(msg)
                await asyncio.sleep(1.5)  # the snapshot row is written before the broadcast; give Supabase a beat
                return msg
        return None

    async def pinch_add_node(self, node_type: str, label: str) -> None:
        await self.ws.send(json.dumps({"eventType": "pinchCommand", "action": "ADD_NODE", "node_type": node_type, "label": label}))
        end = time.monotonic() + 20
        while time.monotonic() < end:
            msg = json.loads(await asyncio.wait_for(self.ws.recv(), timeout=20))
            if msg.get("event") == "DIAGRAM_UPDATED":
                return

    def diagram(self) -> Diagram:
        return Diagram.parse(latest_xml(self.id))


RESULTS: list[tuple[str, bool, str]] = []


def check(ac: str, ok: bool, detail: str) -> None:
    RESULTS.append((ac, ok, detail))
    print(f"  {'PASS' if ok else 'FAIL'}  {ac}: {detail}", flush=True)


def png_aspect(event: dict | None) -> float:
    try:
        with Image.open(io.BytesIO(base64.b64decode((event or {}).get("image_b64", "")))) as img:
            return img.width / img.height
    except Exception:
        return 0.0


def png_ok(event: dict | None) -> bool:
    try:
        data = base64.b64decode((event or {}).get("image_b64", ""))
        with Image.open(io.BytesIO(data)) as img:
            return img.format == "PNG" and img.width > 50 and img.height > 50
    except Exception:
        return False


def describe(d: Diagram) -> str:
    edges = ", ".join(f"{s}->{t}" + (f" [{l}]" if l else "") for (s, t), l in sorted(d.edges.items()))
    return f"nodes={sorted(d.nodes)} edges=[{edges}]"


async def main() -> int:
    print(f"Overlay acceptance against {BASE_HTTP}")
    async with Meeting() as m:
        print(f"meeting {m.id}: K0 -> K1 -> K1 -> K2")
        await m.capture("K0.jpg")
        d0 = m.diagram()
        check("AC1 empty board", not d0.nodes, describe(d0))

        ev1 = await m.capture("K1.jpg")
        d1 = m.diagram()
        check("AC2 two-node board", set(d1.nodes) == TWO_NODES and set(d1.edges) == TWO_EDGES
              and "hmac" in d1.edges.get(("client", "api gateway"), ""), describe(d1))
        check("AC5 overlay PNG (K1)", png_ok(ev1), "DIAGRAM_UPDATED with PNG" if ev1 else "no DIAGRAM_UPDATED")

        await m.capture("K1.jpg")
        d1b = m.diagram()
        check("AC4 recapture unchanged", d1b.signature() == d1.signature(), describe(d1b))

        ev2 = await m.capture("K2.jpg")
        d2 = m.diagram()
        db_style = d2.nodes.get("postgres db", {}).get("style", "")
        check("AC3 four-node board", set(d2.nodes) == FOUR_NODES and set(d2.edges) == FOUR_EDGES
              and ("cylinder" in db_style or "datastore" in db_style), describe(d2) + f" db_style={db_style[:40]!r}")
        check("AC5 overlay PNG (K2)", png_ok(ev2), "DIAGRAM_UPDATED with PNG" if ev2 else "no DIAGRAM_UPDATED")
        n = d2.nodes
        if FOUR_NODES <= set(n):
            lr = n["client"]["x"] < n["api gateway"]["x"] < n["core service"]["x"]
            below = n["postgres db"]["y"] > n["core service"]["y"] and abs(n["postgres db"]["x"] - n["core service"]["x"]) < 120
            check("AC6 layout follows board", lr and below,
                  ", ".join(f"{k}=({v['x']:.0f},{v['y']:.0f})" for k, v in n.items()))
            off = {k: max(abs(n[k]["x"] / PAGE_W - dx), abs(n[k]["y"] / PAGE_H - dy)) for k, (dx, dy) in K2_DRAWN.items()}
            aspect = png_aspect(ev2)
            check("AC8 overlay lands on the drawing", abs(aspect - PAGE_W / PAGE_H) < 0.08 and max(off.values()) <= 0.05,
                  f"png aspect={aspect:.2f} (want {PAGE_W / PAGE_H:.2f}); worst offset={max(off.values()):.2f} "
                  + ", ".join(f"{k}={v:.2f}" for k, v in off.items()))
        else:
            check("AC6 layout follows board", False, "nodes missing; cannot judge layout")
            check("AC8 overlay lands on the drawing", False, "nodes missing; cannot judge placement")

    async with Meeting() as m:
        print(f"meeting {m.id}: stale 'S' node, then K2")
        await m.pinch_add_node("service", "S")
        await m.capture("K2.jpg")
        d = m.diagram()
        check("AC7 capture corrects stale state", set(d.nodes) == FOUR_NODES and set(d.edges) == FOUR_EDGES, describe(d))

    async with Meeting() as m:
        print(f"meeting {m.id}: centre-cropped K2, then full K2")
        await m.capture("K2.jpg", centre_crop=True)
        print(f"  (after cropped capture: {describe(m.diagram())})")
        await m.capture("K2.jpg")
        d = m.diagram()
        off = {k: max(abs(d.nodes[k]["x"] / PAGE_W - dx), abs(d.nodes[k]["y"] / PAGE_H - dy))
               for k, (dx, dy) in K2_DRAWN.items() if k in d.nodes}
        check("AC9 full capture corrects a partial read",
              set(d.nodes) == FOUR_NODES and set(d.edges) == FOUR_EDGES and off and max(off.values()) <= 0.10,
              describe(d) + (f"; worst offset={max(off.values()):.2f}" if off else ""))

    failed = [ac for ac, ok, _ in RESULTS if not ok]
    print(f"\n{len(RESULTS) - len(failed)}/{len(RESULTS)} passed" + (f"; failing: {', '.join(failed)}" if failed else ""))
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
