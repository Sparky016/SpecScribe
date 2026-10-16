# Master Product Requirement Document (PRD) — *SpecScribe AR*

* **Document Version:** `v1.1.0` (Research-Locked Architecture & Rubric Alignment)
* **Last Updated:** Friday, October 16, 2026
* **Project Codename:** **SpecScribe AR** (Spatial Architecture & Decision Intelligence for Snap Spectacles)
* **Official Hackathon:** Learn AR with SPECS (`https://learn-specs.devpost.com/` — Challenge ID `31659`)
* **Hard Submission Deadline:** **Monday, November 9, 2026 at 2:00 PM PST** (**Midnight 00:00 SAST on November 10, 2026** in Pretoria)
* **Total Engineering Budget:** $37.5\text{ Hours}$ (AI-Agent Executed; Human Role = Orchestrator, Reviewer & Tester)

---

## Document Changelog

| Version | Date | Author | Summary of Changes |
| :--- | :--- | :--- | :--- |
| `v1.0.0` | 2026-10-16 | Gemini + Ruan | Initial architecture, Trap 1–3 solutions, calendar mapping, and stateful agent task board. |
| `v1.1.0` | 2026-10-16 | Gemini + Ruan | Integrated `RES-01` ($25\%$ `/docs/` spec mandate, Nov 9 2:00 PM PST deadline, Lens Studio Preview rules), `RES-02` (Lens Studio 5.15 TypeScript pipeline, $1.0\text{ m}\text{--}1.3\text{ m}$ focal ergonomics, `Base64.encodeTextureAsync`), and `RES-03` (in-memory `drawio-mcp` Sugiyama engine + $60\text{ ms}$ Playwright `export3.html` daemon). Unblocked `T-10`–`T-13`. |

---

## 1. Executive Summary & Strategic Framing

### 1.1 Problem Statement
Technical brainstorming and system architecture sessions revolve around physical whiteboards and fast-paced multi-speaker discussions. Traditional meeting recorders only summarize audio transcripts, losing three essential dimensions of engineering context:
1. **Visual Evolution:** How the whiteboard architecture diagram evolved incrementally over time.
2. **Temporal Decision Lineage:** *Why* a specific service, queue, or database node was added, modified, or rejected at timestamp $T$, and *which speaker* advocated for that trade-off.
3. **Real-Time Architectural Critique:** Teams miss logic flaws, single points of failure, or security vulnerabilities in the middle of whiteboarding when changing direction is cheapest.

### 1.2 The Solution (*SpecScribe AR*)
**SpecScribe AR** is a multimodal spatial engineering companion built in **Snap Lens Studio 5.15+** using the **Spectacles Interaction Kit (SIK)** and a **FastAPI + `drawio-mcp` + Supabase** backend:
1. **Hands-Free Whiteboard-to-Draw.io Spatial Overlay:** Periodically samples camera frames off the main thread, detects stroke changes via perceptual hashing, extracts graph topology deltas with Gemini 2.5 Flash Vision, auto-layouts clean `.drawio` diagrams using the Sugiyama hierarchical DAG algorithm (`drawio-mcp`), and streams a transparent, waveguide-optimized RGBA overlay ($60\text{ ms}\text{--}140\text{ ms}$ render latency) back into the user's AR view.
2. **SIK Pinch Component Palette (Spatial Interactivity):** Anchors a peripheral 4-button SIK `PinchButton` palette (`[◇ Decision]`, `[▭ Service]`, `[🛢 Database]`, `[○ Terminal]`) at $1.15\text{ m}$ focal depth. Pinching a component and speaking its label immediately injects the node into the live Draw.io graph via `drawio-mcp`.
3. **The "Raising-Hand" Spatial AI Teammate:** An ambient 3D AI orb anchored in the top-right peripheral field of view ($1.15\text{ m}$ depth):
   * **Proactive Critique Mode (Push):** Continuously audits the live speaker-diarized transcript + Draw.io graph state on the server. When it detects a flaw, it visually **raises its hand** with a concise floating badge (`"🚩 Auth Token Leak Risk"`, `"💡 Use Pub/Sub Queue"`). Pinching the orb expands a 3-bullet critique card and plays low-latency voice feedback.
   * **On-Demand Research Mode (Pull):** The wearer pinches the orb and speaks a technical question. The orb enters a `RESEARCHING` state and **raises its hand** as soon as the synthesized answer card is ready.
4. **Post-Meeting Temporal Decision Scrubber & RAG Hub:** A unified **Supabase (`PostgreSQL` + `pgvector` + `Storage`)** backend and **Next.js 15** web dashboard. Dragging a timeline scrubber from `00:00` to `End` dynamically replays the exact Draw.io diagram state alongside speaker-diarized transcripts, decision rationales, auto-generated Markdown technical specs, and a `pgvector` RAG Q&A agent.

---

## 2. Hackathon Compliance & Rubric Mapping ($100\text{ Points}$)

Research report `RES-01` confirmed that **Learn AR with SPECS** (`learn-specs.devpost.com`) is a Devpost Learn competition focused on **Spec-Driven Development** using AI coding agents. Physical Spectacles hardware is **not required**; the **Lens Studio 5.15.x Interactive Preview Panel** with active `SIK` hand tracking is the mandatory simulation target.

| Judging Domain | Weight | Official Requirement (`RES-01`) | Our Winning Implementation |
| :--- | :--- | :--- | :--- |
| **1. Spec-Driven Methodology & Rigor** | **$25\%$** | Completeness and fidelity of `/docs/scope.md`, `/docs/prd.md`, and `/docs/spec.md` generated via the coding agent skill pack before the build phase; public GitHub repo initialized during the hackathon window. | Dedicated Task `T-03B` in Weekend 1 generates and commits comprehensive `/docs/scope.md`, `/docs/prd.md`, and `/docs/spec.md` files before writing application code. |
| **2. Technical Implementation & Stability** | **$25\%$** | Robust TypeScript in Lens Studio 5.15+, effective `SIK` integration, $60\text{ FPS}$ simulation, and clean error handling without console warnings. | Camera initialization deferred to `OnStartEvent`, downsampled to `480p` via `imageSmallerDimension`, encoded off-thread via `Base64.encodeTextureAsync`, and paired with persistent `InternetModule` WebSockets. |
| **3. Spatial UX & AR Ergonomics** | **$20\%$** | Optimized for see-through optical waveguides: $1\text{ m}\text{--}2\text{ m}$ comfort zone, minimal center-field occlusion, peripheral anchoring, and reliable SIK gestures. | All SIK `PinchButton` palettes and the Raising-Hand Agent Orb are anchored peripherally at $1.0\text{ m}\text{--}1.3\text{ m}$ depth. Diagrams render with `bg=none` (`opacity=0`) and high-contrast `#00FF66` / `#00E5FF` strokes so true black (`#000000`) remains transparent. |
| **4. Utility, Originality & Impact** | **$20\%$** | Creative problem-solving leveraging hands-free spatial computing compared to mobile/desktop modalities. | Combines hands-free whiteboard-to-Draw.io spatial overlay, pinch-to-spawn architecture nodes, a proactive Raising-Hand AI teammate, and a temporal decision scrubber. |
| **5. Demonstration & Pitch Quality** | **$10\%$** | $60\text{ s}\text{--}180\text{ s}$ HD walkthrough showing live SIK hand tracking inside the Lens Studio Interactive Preview Panel + structured 5-part Devpost writeup. | Split-screen $150\text{-second}$ video: Left = Lens Studio Interactive Preview Panel with live SIK hand-pinch gestures; Right = Live Draw.io diagram + Temporal Decision Scrubber. |

---

## 3. Research Log & Architectural Decisions (`RES-01` – `RES-03`)

### `RES-01` Summary: Hackathon Rules & Deadlines
* **Hard Deadline:** Monday, November 9, 2026 at 2:00 PM PST ($22:00\text{ UTC}$ / **Midnight $00:00\text{ SAST}$ on November 10, 2026**).
* **Mandatory Repo Artifacts:** Public GitHub repository containing `/docs/scope.md`, `/docs/prd.md`, and `/docs/spec.md`.
* **Mandatory Video Format:** $60\text{ to }180\text{ seconds}$ hosted on YouTube, Vimeo, or Loom demonstrating the Lens inside the Lens Studio Interactive Preview Panel with active SIK hand tracking.

### `RES-02` Summary: Lens Studio 5.15+ Sensor & SIK Architecture
* **Required Packages/Modules:** `SpectaclesInteractionKit.lspkg`, `RemoteServiceGateway.lspkg`, `LensStudio:CameraModule`, `LensStudio:InternetModule`, `LensStudio:AsrModule`.
* **Non-Blocking Camera Pipeline:** Defer camera setup to `OnStartEvent`. Downscale frames at the driver level (`request.imageSmallerDimension = 480`) and encode asynchronously via `Base64.encodeTextureAsync(..., CompressionQuality.Low, EncodingType.Jpg)` to maintain $60\text{ FPS}$ and prevent thermal throttling.
* **Optical Ergonomics:** Spectacles waveguides have a fixed focal plane at $1.0\text{ m}$ with full binocular overlap at $1.1\text{ m}$. All interactive SIK colliders must sit between $1.0\text{ m}$ and $1.3\text{ m}$ along the forward $Z$-axis.
* **Audio Echo & Latency Prevention:** Set `AudioComponent.playbackMode = Audio.PlaybackMode.LowLatency`.

### `RES-03` Summary: `drawio-mcp` & Sub-$500\text{ ms}$ Headless Rendering
* **MCP Server Selection:** Use the Python-native `drawio-mcp` package (`yohasacura/drawio-mcp`) imported directly into the FastAPI process (`drawio_mcp.models` and `drawio_mcp.layout_engine`) rather than the Deno-based `simonkurtz-MSFT/drawio-mcp-server`. This eliminates IPC overhead and provides native **Sugiyama hierarchical DAG auto-layout** (`apply_sugiyama`) and orthogonal edge routing.
* **Sub-$140\text{ ms}$ Transparent AR Overlay Renderer:** Standard `drawio -x` desktop CLI takes $1,800\text{ ms}\text{--}3,500\text{ ms}$. Instead, maintain a pre-warmed headless Chromium instance via Playwright running `https://viewer.diagrams.net/export3.html` in FastAPI's `lifespan` (or `@markdown-viewer/drawio2svg` + `cairosvg`). Calling `window.render({ format: 'png', bg: 'none', scale: 1.5 })` over CDP produces an in-memory RGBA PNG buffer in **$60\text{ ms}\text{--}140\text{ ms}$**.

---

## 4. End-to-End System Architecture (`v1.1.0`)

```
+---------------------------------------------------------------------------------------+
|              SNAP LENS STUDIO 5.15+ INTERACTIVE PREVIEW / SPECTACLES OS               |
|                     (Spatial UI Anchored at 1.0m - 1.3m Focal Depth)                  |
|                                                                                       |
|  1. PeriodicCameraCapturer.ts (OnStartEvent -> 480p -> Base64.encodeTextureAsync)     |
|  2. PersistentStreamSocketClient.ts (AsrModule HighSpeed / PCM16 + wss:// / ws://)    |
|  3. SpatialInterfaceManager.ts (SIK PinchButton Palette + Raising-Hand Orb)           |
|  4. AR Diagram Surface (Base64.decodeTextureAsync -> mainMaterial.mainPass.baseTex)   |
+-------------------------------------------|-------------------------------------------+
                                            |
                          Full-Duplex WebSocket (JSON + Binary Blob)
                                            |
+-------------------------------------------v-------------------------------------------+
|                         FASTAPI ASYNC ORCHESTRATOR (Python 3.11+)                     |
|                                                                                       |
|  A. Ingestion & Diff Gate:                                                            |
|     - `imagehash.phash` filters unchanged frames (<5ms)                               |
|     - Gemini 2.5 Flash Vision extracts incremental vertex/edge additions              |
|     - Deepgram / AsrModule logs timestamped speaker turns                             |
|                                                                                       |
|  B. In-Memory `drawio-mcp` Engine (Direct Python Import - 0ms IPC overhead):          |
|     - `DrawioFile`, `Diagram`, `MxCell` (Phosphor Green #00FF66 & Cyan #00E5FF)       |
|     - `LayoutEngine().apply_sugiyama(diagram, layer_distance=70, node_distance=50)`   |
|                                                                                       |
|  C. Pre-Warmed Headless Playwright Daemon (`viewer.diagrams.net/export3.html`):       |
|     - Executes `window.render({ format: 'png', bg: 'none', scale: 1.5 })` via CDP     |
|     - Emits transparent RGBA PNG buffer in 60ms - 140ms                               |
|                                                                                       |
|  D. "Raising-Hand" Proactive Critique Agent:                                          |
|     - Audits transcript + graph every 20s for `VULNERABILITY` | `LOGIC_FLAW` | `IDEA` |
|     - Pushes `HAND_RAISED` pill badge (<28 chars) to Spectacles peripheral orb        |
+-------------------------------------------|-------------------------------------------+
                                            |
                                            v
+---------------------------------------------------------------------------------------+
|             UNIFIED SUPABASE BACKEND (PostgreSQL + pgvector + Storage)                |
|  - Tables: `meetings`, `transcript_turns`, `diagram_snapshots`, `agent_interventions` |
|  - Vector RAG: `knowledge_chunks` (1536-dim embeddings)                               |
|  - Next.js 15 Temporal Review Dashboard: Timeline Scrubber + Draw.io Export + RAG     |
+---------------------------------------------------------------------------------------+
```

---

## 5. Unified Database Schema (Supabase PostgreSQL + `pgvector`)

File target: `/supabase/migrations/001_initial_schema.sql`

```sql
-- Enable pgvector extension
create extension if not exists vector;

-- 1. Meetings Table
create table meetings (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  created_at timestamptz default now(),
  latest_drawio_xml text,
  generated_spec_md text
);

-- 2. Speaker-Diarized Transcript Turns
create table transcript_turns (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid references meetings(id) on delete cascade,
  speaker_label text not null, -- e.g., "Speaker 0 (Ruan)", "Speaker 1"
  transcript_text text not null,
  timestamp_ms integer not null, -- Offset from meeting start
  created_at timestamptz default now()
);

-- 3. Timestamped Diagram Snapshots & Decision Logs
create table diagram_snapshots (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid references meetings(id) on delete cascade,
  timestamp_ms integer not null,
  drawio_xml text not null,
  overlay_image_url text,
  diff_summary text not null, -- e.g., "Added Redis Cache node between API and DB"
  decision_rationale text,    -- Synthesized "Why" from surrounding transcript_turns
  triggered_by text           -- 'VISION_DIFF' | 'PINCH_PALETTE' | 'AGENT_SUGGESTION'
);

-- 4. Raising-Hand Agent Interventions
create table agent_interventions (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid references meetings(id) on delete cascade,
  timestamp_ms integer not null,
  category text not null,     -- 'VULNERABILITY' | 'LOGIC_FLAW' | 'ALTERNATIVE_IDEA' | 'RESEARCH'
  short_title text not null,  -- Max 28 chars for AR pill: e.g., "🚩 Auth Token Leak Risk"
  detailed_body text not null,
  was_pinched boolean default false
);

-- 5. Unified Vector Store for Post-Meeting RAG Agent
create table knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid references meetings(id) on delete cascade,
  chunk_type text not null,   -- 'DECISION' | 'TRANSCRIPT_WINDOW' | 'AGENT_INSIGHT' | 'TECH_SPEC'
  timestamp_ms integer,
  content text not null,
  embedding vector(1536)
);

-- Vector Similarity Search RPC
create or replace function match_knowledge_chunks (
  query_embedding vector(1536),
  match_meeting_id uuid,
  match_threshold float,
  match_count int
)
returns table (
  id uuid,
  chunk_type text,
  timestamp_ms integer,
  content text,
  similarity float
)
language sql stable
as $$
  select
    kc.id,
    kc.chunk_type,
    kc.timestamp_ms,
    kc.content,
    1 - (kc.embedding <=> query_embedding) as similarity
  from knowledge_chunks kc
  where kc.meeting_id = match_meeting_id
    and 1 - (kc.embedding <=> query_embedding) > match_threshold
  order by kc.embedding <=> query_embedding
  limit match_count;
$$;
```

---

## 6. Reference Blueprints (Verified in `RES-02` & `RES-03`)

### 6.1 FastAPI In-Memory `drawio-mcp` + Sub-$100\text{ ms}$ Playwright Daemon
```python
import asyncio
import base64
from contextlib import asynccontextmanager
from typing import Dict, Any

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from playwright.async_api import async_playwright, Playwright, Browser, Page

from drawio_mcp.models import DrawioFile, Diagram, MxCell
from drawio_mcp.layout_engine import LayoutEngine


class HeadlessDrawioDaemon:
    """Maintains a persistent, pre-warmed browser context executing export3.html
    to ensure sub-100ms in-memory rendering without disk I/O.
    """

    def __init__(self):
        self.playwright: Playwright | None = None
        self.browser: Browser | None = None
        self.page: Page | None = None

    async def initialize(self) -> None:
        self.playwright = await async_playwright().start()
        self.browser = await self.playwright.chromium.launch(
            headless=True,
            args=[
                "--disable-gpu",
                "--no-sandbox",
                "--disable-dev-shm-usage",
                "--disable-extensions",
                "--mute-audio",
            ],
        )
        self.page = await self.browser.new_page()
        await self.page.goto(
            "https://viewer.diagrams.net/export3.html", wait_until="networkidle"
        )

    async def render_b64_png(self, drawio_xml: str) -> str:
        """Evaluates draw.io XML against the mxGraph export runtime and returns
        a Base64 RGBA PNG string with transparent background for waveguide optics.
        """
        js_invocation = """
        (xmlPayload) => {
            return new Promise((resolve, reject) => {
                try {
                    window.render({
                        xml: xmlPayload,
                        format: 'png',
                        bg: 'none',
                        border: 0,
                        scale: 1.5,
                        extras: JSON.stringify({
                            diagrams: [{ dark: true }]
                        })
                    });

                    const checkRender = setInterval(() => {
                        const img = document.querySelector('img');
                        if (img && img.src && img.src.startsWith('data:image/png;base64,')) {
                            clearInterval(checkRender);
                            resolve(img.src.split(',')[1]);
                        }
                    }, 4);

                    setTimeout(() => {
                        clearInterval(checkRender);
                        reject(new Error("Headless export render deadline exceeded"));
                    }, 350);
                } catch (err) {
                    reject(err);
                }
            });
        }
        """
        return await self.page.evaluate(js_invocation, drawio_xml)

    async def shutdown(self) -> None:
        if self.page:
            await self.page.close()
        if self.browser:
            await self.browser.close()
        if self.playwright:
            await self.playwright.stop()


class LiveGraphSession:
    """Manages diagram mutations and Sugiyama hierarchical DAG layouts."""

    STYLE_MAP = {
        "service": "rounded=1;whiteSpace=wrap;html=1;fillColor=#107C41;strokeColor=#00FF66;fontColor=#FFFFFF;strokeWidth=2;",
        "decision": "rhombus;whiteSpace=wrap;html=1;fillColor=#004D40;strokeColor=#00E5FF;fontColor=#FFFFFF;strokeWidth=2;",
        "database": "shape=cylinder3;whiteSpace=wrap;html=1;boundedLbl=1;backgroundOutline=1;size=15;fillColor=#0D47A1;strokeColor=#00E5FF;fontColor=#FFFFFF;strokeWidth=2;",
        "terminal": "ellipse;whiteSpace=wrap;html=1;fillColor=#311B92;strokeColor=#00FF66;fontColor=#FFFFFF;strokeWidth=2;",
    }

    def __init__(self):
        self.file = DrawioFile()
        self.diagram = Diagram(name="ARStream")
        self.file.add_diagram(self.diagram)
        self.layout_engine = LayoutEngine()
        self.node_sequence = 0

    def insert_vertex(self, label: str, node_type: str = "service") -> str:
        self.node_sequence += 1
        node_id = f"v_{self.node_sequence}"
        style = self.STYLE_MAP.get(node_type, self.STYLE_MAP["service"])
        cell = MxCell(id=node_id, value=label, vertex="1", parent="1", style=style)
        self.diagram.add_cell(cell)
        return node_id

    def insert_edge(self, source_id: str, target_id: str, label: str = "") -> str:
        edge_id = f"e_{source_id}_{target_id}"
        style = "edgeStyle=orthogonalEdgeStyle;rounded=1;html=1;strokeColor=#00E5FF;strokeWidth=3;fontColor=#00E5FF;"
        edge = MxCell(
            id=edge_id, value=label, edge="1", parent="1",
            source=source_id, target=target_id, style=style
        )
        self.diagram.add_cell(edge)
        return edge_id

    def compile_layout_xml(self) -> str:
        self.layout_engine.apply_sugiyama(
            self.diagram, layer_distance=70, node_distance=50
        )
        return self.file.to_xml()
```

---

## 7. Realistic 25-Day Calendar & Time Allocation ($37.5\text{ Hours}$ Total)

* **Schedule Constraints:**
  * **Weeknights:** 3 evenings/week (Tue, Thu, Fri) @ $1.5\text{ hrs}$ = **$4.5\text{ hrs/week}$**
  * **Weekends:** Sat ($4\text{ hrs}$) + Sun ($3.5\text{ hrs}$) = **$7.5\text{ hrs/weekend}$**
  * **Holiday Blackout:** **Oct 30 – Nov 2 ($0\text{ hours}$)**
  * **Hard Submission Lock:** **Monday, November 9, 2026 at 2:00 PM PST** (**Midnight $00:00\text{ SAST}$ on November 10**)

| Window | Dates | Available Hours | Sprint Focus |
| :--- | :--- | :--- | :--- |
| **Weekend 1** | Oct 17 – Oct 18 | **$7.5\text{ hrs}$** | **Spec Docs ($25\%$ Score!) + Backend Spine:** Generate `/docs/scope.md`, `/docs/prd.md`, `/docs/spec.md` (`T-03B`); stand up Supabase (`T-04`), FastAPI WebSocket hub (`T-05`), and in-memory `drawio-mcp` + Playwright `export3.html` pipeline (`T-06`). |
| **Week 1** | Oct 19 – Oct 23 | **$4.5\text{ hrs}$** | **Diarization & Raising-Hand Brain:** Implement transcript ingestion + decision linker (`T-07`), proactive Raising-Hand agent (`T-08`), and `pgvector` spec generator (`T-09`). |
| **Weekend 2** | Oct 24 – Oct 25 | **$7.5\text{ hrs}$** | **Lens Studio 5.15 Core:** Set up Lens Studio project with `SIK`, `PeriodicCameraCapturer.ts`, `PersistentStreamSocketClient.ts` (`T-10`), and transparent AR Whiteboard Overlay mesh (`T-11`). |
| **Week 2** | Oct 26 – Oct 29 | **$4.5\text{ hrs}$** | **SIK Pinch Interactions:** Wire the 4-button SIK Pinch Component Palette (`T-12`) and the Raising-Hand 3D Orb + Pinch Readout Card at $1.0\text{ m}\text{--}1.3\text{ m}$ focal distance (`T-13`). |
| **HOLIDAY** | **Oct 30 – Nov 2** | **$0.0\text{ hrs}$** | **🏝️ AWAY ON HOLIDAY — ZERO WORK SCHEDULED** |
| **Week 3** | Nov 3 – Nov 6 | **$4.5\text{ hrs}$** | **Temporal Web Dashboard & RAG:** Build the Next.js 15 Timeline Scrubber (`T-14`), `pgvector` RAG Q&A drawer (`T-15`), and `.drawio` / `.md` export buttons (`T-16`). |
| **Weekend 3** | Nov 7 – Nov 8 | **$7.5\text{ hrs}$** | **End-to-End Integration & Video Shoot:** Record the $150\text{-second}$ demo video showing live SIK hand tracking inside the Lens Studio Interactive Preview Panel (`T-17`, `T-18`). |
| **Submission Day** | **Mon, Nov 9** | **$2.5\text{ hrs}$** | **Final Polish & Early Submit:** Complete the 5-section Devpost writeup (`T-19`) and submit by **9:00 PM SAST on Nov 9** ($3\text{ hours}$ before the $00:00\text{ SAST}$ hard lock). |

---

## 8. Master Stateful Task Board & Copy-Paste Agent Prompts

### Status Legend
* `[DONE]` — Completed and verified.
* `[READY_FOR_AGENT]` — Unblocked; copy-paste the prompt below into Claude Code / Cursor.
* `[IN_PROGRESS]` — Currently being executed or tested.
* `[TODO]` — Scheduled for a future sprint window.

---

### Epic 0: Discovery, Mandatory Spec Docs & Repo Setup (Weekend 1 — Oct 17)

| ID | Task Name | Est. Time | Status | Assigned To |
| :--- | :--- | :--- | :--- | :--- |
| `T-01` | Execute `RES-01` (Devpost Rules, Rubric & Deadlines) | 15m | `[DONE]` | Research Agent |
| `T-02` | Execute `RES-02` (Lens Studio 5.15 SIK & Sensor Streaming) | 15m | `[DONE]` | Research Agent |
| `T-03` | Execute `RES-03` (`drawio-mcp` & Sub-$500\text{ ms}$ AR Renderer) | 15m | `[DONE]` | Research Agent |
| `T-03B` | **CRITICAL ($25\%$ of Score):** Generate `/docs/scope.md`, `/docs/prd.md`, and `/docs/spec.md` via Devpost Learn Skill Pack | 45m | `[READY_FOR_AGENT]` | Coding Agent |
| `T-04` | Initialize Public GitHub Monorepo & Supabase `pgvector` Schema | 30m | `[READY_FOR_AGENT]` | Coding Agent |

#### 🤖 Copy-Paste Coding Agent Prompt for `T-03B` (Secures $25\%$ of Judging Rubric):
```text
We are competing in the "Learn AR with SPECS" hackathon (https://learn-specs.devpost.com/), where 25% of the judging score evaluates Spec-Driven Methodology & Rigor based on three mandatory files in the `/docs` directory: `docs/scope.md`, `docs/prd.md`, and `docs/spec.md`.

If the Devpost Learn skill pack is installed in this environment, execute its workflow now using our project context below. Otherwise, generate comprehensive, production-grade versions of all three files in `/docs/`:

1. `docs/scope.md`: Define problem statement, spatial computing justification for Snap Spectacles (optical see-through waveguides, 1.0m-1.3m focal comfort zone, peripheral UI anchoring), in-scope MVP deliverables (Lens Studio 5.15 TypeScript app, SIK Pinch Component Palette, Raising-Hand AI Teammate Orb, FastAPI + `drawio-mcp` Sugiyama layout engine, Pre-warmed Playwright `export3.html` RGBA streamer, Next.js Temporal Decision Scrubber + Supabase `pgvector` RAG), and out-of-scope boundaries.
2. `docs/prd.md`: Full Product Requirements Document including user personas, user stories, functional requirements, non-functional requirements (<140ms diagram render latency, 60 FPS Lens Studio simulation, zero console warnings), and evaluation metrics.
3. `docs/spec.md`: Complete Technical Specification including component hierarchy in Lens Studio 5.15, TypeScript class interfaces (`PeriodicCameraCapturer`, `PersistentStreamSocketClient`, `SpatialInterfaceManager`, `RaisingHandAgentController`), WebSocket JSON/Binary wire protocol, FastAPI endpoints, `drawio-mcp` cell styling rules (`bg=none`, `#00FF66` phosphor green and `#00E5FF` cyan strokes for waveguide transparency), and the 5-table Supabase PostgreSQL + `pgvector` schema.
```

#### 🤖 Copy-Paste Coding Agent Prompt for `T-04`:
```text
Create a monorepo structure for "specscribe-ar" with four directories:
1. `/docs` (Contains `scope.md`, `prd.md`, `spec.md`)
2. `/backend` (Python 3.11+, FastAPI, uv, websockets, supabase, google-genai, deepgram-sdk, drawio-mcp, playwright, imagehash, Pillow)
3. `/web-dashboard` (Next.js 15 App Router, TailwindCSS, Shadcn UI, Supabase client, lucide-react)
4. `/spectacles-lens` (TypeScript scripts and SceneObject hierarchy docs for Lens Studio 5.15)
Also create `/supabase/migrations/001_initial_schema.sql` using the exact 5-table schema (`meetings`, `transcript_turns`, `diagram_snapshots`, `agent_interventions`, `knowledge_chunks` with `pgvector` and `match_knowledge_chunks` RPC) from the PRD, plus a seed script `/backend/seed_demo_meeting.py` to test inserting and querying a meeting timeline.
```

---

### Epic 1: FastAPI Orchestrator, In-Memory `drawio-mcp` & Raising-Hand Agent (Oct 17 – Oct 23)

| ID | Task Name | Est. Time | Status | Assigned To |
| :--- | :--- | :--- | :--- | :--- |
| `T-05` | Build FastAPI Full-Duplex WebSocket Hub (`/ws/meeting/{id}`) | 1.0h | `[READY_FOR_AGENT]` | Coding Agent |
| `T-06` | Build In-Memory `drawio-mcp` Sugiyama Engine + Playwright `export3.html` Daemon | 1.5h | `[READY_FOR_AGENT]` | Coding Agent |
| `T-07` | Build Live Speaker Transcript Ingestion & Temporal Decision Linker | 1.5h | `[READY_FOR_AGENT]` | Coding Agent |
| `T-08` | Build "Raising-Hand" Proactive Critique & Research Sub-Agent | 1.5h | `[READY_FOR_AGENT]` | Coding Agent |
| `T-09` | Build Post-Meeting Tech Spec & `pgvector` Embedding Pipeline | 1.0h | `[READY_FOR_AGENT]` | Coding Agent |

#### 🤖 Copy-Paste Coding Agent Prompt for `T-05` & `T-06`:
```text
In `/backend`, implement the FastAPI orchestrator (`main.py` and `graph_engine.py`) using Python 3.11+, `drawio-mcp` (yohasacura PyPI package), `playwright`, `imagehash`, and `google-genai`:

1. Pre-Warmed Headless Renderer (`HeadlessDrawioDaemon`):
   - Using `asynccontextmanager` in FastAPI's `lifespan`, launch a persistent headless Chromium instance via Playwright and navigate to `https://viewer.diagrams.net/export3.html` (`wait_until="networkidle"`).
   - Implement `async def render_b64_png(self, drawio_xml: str) -> str` that invokes `window.render({ xml: xmlPayload, format: 'png', bg: 'none', border: 0, scale: 1.5, extras: JSON.stringify({ diagrams: [{ dark: true }] }) })` and extracts the Base64 RGBA PNG in <140ms without disk I/O.

2. In-Memory `drawio-mcp` Graph Session (`LiveGraphSession`):
   - Import `DrawioFile`, `Diagram`, `MxCell` from `drawio_mcp.models` and `LayoutEngine` from `drawio_mcp.layout_engine`.
   - Enforce Snap Spectacles waveguide additive display styling:
     - Service / Process vertices: `rounded=1;whiteSpace=wrap;html=1;fillColor=#107C41;strokeColor=#00FF66;fontColor=#FFFFFF;strokeWidth=2;`
     - Decision vertices: `rhombus;whiteSpace=wrap;html=1;fillColor=#004D40;strokeColor=#00E5FF;fontColor=#FFFFFF;strokeWidth=2;`
     - Database vertices: `shape=cylinder3;whiteSpace=wrap;html=1;boundedLbl=1;backgroundOutline=1;size=15;fillColor=#0D47A1;strokeColor=#00E5FF;fontColor=#FFFFFF;strokeWidth=2;`
     - Terminal vertices: `ellipse;whiteSpace=wrap;html=1;fillColor=#311B92;strokeColor=#00FF66;fontColor=#FFFFFF;strokeWidth=2;`
     - Edges: `edgeStyle=orthogonalEdgeStyle;rounded=1;html=1;strokeColor=#00E5FF;strokeWidth=3;fontColor=#00E5FF;`
   - Implement `compile_layout_xml()` using `self.layout_engine.apply_sugiyama(self.diagram, layer_distance=70, node_distance=50)`.

3. WebSocket Endpoint (`/ws/meeting/{meeting_id}`):
   - Handle incoming JSON envelopes from Lens Studio:
     - `asrTranscription`: Log speaker turn to Supabase `transcript_turns`.
     - `cameraFrame`: Run `imagehash.phash` diff gate. If hamming distance > threshold, call Gemini 2.5 Flash to extract added/updated vertices & edges, mutate `LiveGraphSession`, re-render via `HeadlessDrawioDaemon`, save snapshot to Supabase `diagram_snapshots`, and send `{ "event": "DIAGRAM_UPDATED", "image_b64": "...", "diff_summary": "..." }` back to Spectacles.
     - `pinchCommand`: Immediately insert the pinched node type (`decision`, `service`, `database`, `terminal`), re-layout via Sugiyama, and push the updated texture within 150ms.
```

#### 🤖 Copy-Paste Coding Agent Prompt for `T-07`, `T-08`, and `T-09`:
```text
In `/backend/agents/`, implement three asynchronous intelligence modules:

1. `decision_linker.py` (`T-07`):
   - Whenever a new `diagram_snapshot` is created at `timestamp_ms`, fetch the last 45 seconds of `transcript_turns` for the meeting.
   - Use Gemini 2.5 Flash to synthesize a 1-2 sentence `decision_rationale` explaining *why* that architectural change was made and *who* proposed it. Update `diagram_snapshots.decision_rationale` and embed it into `knowledge_chunks`.

2. `raising_hand_agent.py` (`T-08`):
   - Mode A (Proactive Push): Every 20 seconds (or on diagram change), evaluate the recent transcript + current `.drawio` XML using structured output (`trigger: bool`, `category: Literal["VULNERABILITY", "LOGIC_FLAW", "ALTERNATIVE_IDEA"]`, `short_title: str` [max 28 chars], `detailed_body: str`).
   - Mode B (On-Demand Research Pull): Trigger immediately when the WebSocket receives `pinchCommand` with `action == "ASK_AGENT"`.
   - When triggered, insert into `agent_interventions` and broadcast `{ "event": "HAND_RAISED", "intervention_id": "...", "category": "...", "short_title": "...", "detailed_body": "..." }` to the Spectacles WebSocket.

3. `spec_generator.py` (`T-09`):
   - Expose `POST /api/meetings/{meeting_id}/finalize` which compiles the final Draw.io XML, all timestamped decision logs, and agent interventions into a comprehensive Markdown Technical Specification (`meetings.generated_spec_md`) and chunks/embeds all records into `knowledge_chunks` (1536-dim embeddings) for post-meeting RAG.
```

---

### Epic 2: Lens Studio 5.15 TypeScript & SIK Spatial Client (Oct 24 – Oct 29)

| ID | Task Name | Est. Time | Status | Assigned To |
| :--- | :--- | :--- | :--- | :--- |
| `T-10` | Implement `PeriodicCameraCapturer.ts` & `PersistentStreamSocketClient.ts` | 2.0h | `[READY_FOR_AGENT]` | Coding Agent |
| `T-11` | Implement AR Whiteboard Overlay Plane (`Base64.decodeTextureAsync`) | 2.0h | `[READY_FOR_AGENT]` | Coding Agent |
| `T-12` | Implement SIK Pinch Component Palette (`Decision`, `Service`, `DB`, `Terminal`) | 2.5h | `[READY_FOR_AGENT]` | Coding Agent |
| `T-13` | Implement "Raising-Hand" 3D Agent Orb & Pinch-to-Read Card (at $1.15\text{ m}$ depth) | 2.5h | `[READY_FOR_AGENT]` | Coding Agent |

#### 🤖 Copy-Paste Coding Agent Prompt for `T-10`, `T-11`, `T-12`, and `T-13`:
```text
In `/spectacles-lens/Assets/Scripts/`, generate four modular, zero-warning TypeScript components for Snap Lens Studio 5.15+ targeting Spectacles (2024) and the Lens Studio Interactive Preview Panel:

1. `PeriodicCameraCapturer.ts`:
   - Require `LensStudio:CameraModule`.
   - Defer `setupCameraPipeline()` to `OnStartEvent` (never `onAwake`).
   - Configure `CameraModule.createCameraRequest()` with `CameraModule.CameraId.Default_Color` and `imageSmallerDimension = 480`.
   - Use an `UpdateEvent` deltaTime accumulator (default `0.33` FPS / every 3 seconds) and an `isEncodingActive` lock to encode frames off the main thread via `Base64.encodeTextureAsync(this.cameraTexture, onSuccess, onError, CompressionQuality.Low, EncodingType.Jpg)`.

2. `PersistentStreamSocketClient.ts`:
   - Require `LensStudio:InternetModule` and `LensStudio:AsrModule`.
   - Connect via `this.internetModule.createWebSocket(this.websocketUrl)` with `binaryType = 'blob'`.
   - Start `AsrModule` transcription (`AsrModule.AsrMode.HighSpeed`, `silenceUntilTerminationMs = 1000`) and stream `asrTranscription` JSON events over the socket.
   - Expose `sendPinchCommand(action: string, nodeType: string, label: string)` and `sendCameraFrame(b64: string)`.
   - Parse inbound JSON messages (`DIAGRAM_UPDATED`, `HAND_RAISED`, `DECISION_LOGGED`) and route them to `SpatialInterfaceManager` and `RaisingHandAgentController`.

3. `SpatialInterfaceManager.ts`:
   - Import `PinchButton` from `SpectaclesInteractionKit.lspkg/Components/UI/PinchButton/PinchButton` and `Interactable` from `SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable`.
   - Bind 4 palette `PinchButton` inputs (`btnAddDecision`, `btnAddService`, `btnAddDatabase`, `btnAddTerminal`) to emit `pinchCommand` payloads using the latest spoken ASR phrase as the node label.
   - Implement `updateDiagramOverlay(base64Png: string)` using `Base64.decodeTextureAsync` to assign the decoded texture to `this.diagramOverlayMesh.mainMaterial.mainPass.baseTex`.

4. `RaisingHandAgentController.ts`:
   - Manage the peripheral AI Teammate Orb anchored at 1.15m forward depth (top-right periphery to avoid center-field occlusion).
   - State machine: `IDLE` (subtle pulse), `RESEARCHING` (rotating ring), `HAND_RAISED` (high-contrast floating badge showing `short_title` up to 28 chars, e.g., "🚩 Auth Token Leak Risk").
   - Bind `agentOrbPinchButton.onButtonPinched`: if `HAND_RAISED`, expand the floating 3-bullet critique card and set `Audio.PlaybackMode.LowLatency`; if `IDLE`, capture the user's spoken research query and send `action: "ASK_AGENT"` to the backend.
   - Also generate `/spectacles-lens/SCENE_HIERARCHY_SETUP.md` detailing exact SceneObject transforms (anchored between 1.0m and 1.3m along Z-axis) so the developer can wire inputs in Lens Studio 5.15 in under 15 minutes.
```

---

### Epic 3: Next.js 15 Temporal Scrubber & RAG Hub (Nov 3 – Nov 6)

| ID | Task Name | Est. Time | Status | Assigned To |
| :--- | :--- | :--- | :--- | :--- |
| `T-14` | Build Temporal Scrubber Dashboard (Diagram + Diarized Transcript Sync) | 2.5h | `[READY_FOR_AGENT]` | Coding Agent |
| `T-15` | Build RAG Q&A Sidebar (`pgvector` + Clickable Timestamp Citations) | 1.5h | `[READY_FOR_AGENT]` | Coding Agent |
| `T-16` | Add 1-Click Export (Download `.drawio`, Markdown Spec, Decision Log) | 0.5h | `[READY_FOR_AGENT]` | Coding Agent |

#### 🤖 Copy-Paste Coding Agent Prompt for `T-14`, `T-15`, and `T-16`:
```text
In `/web-dashboard`, build a dark-mode Next.js 15 App Router engineering review interface for `/meetings/[id]`:
1. Top Bar: Meeting title, duration, speaker badges, and 1-click export buttons ("Download .drawio XML", "Export Tech Spec .md", "Export Decision Log JSON").
2. Center Split-Pane:
   - Left Pane (60% width): High-contrast Draw.io Diagram Canvas showing the exact diagram snapshot active at the selected scrubber timestamp, plus a floating diff pill ("03:42 — Speaker 1 added Redis Cache: Reduce DB read contention").
   - Right Pane (40% width): Synchronized Speaker-Diarized Transcript & Decision Log, plus inline cards where the "Raising-Hand AI Agent" intervened (`VULNERABILITY`, `LOGIC_FLAW`, `ALTERNATIVE_IDEA`).
3. Bottom Temporal Scrubber Bar: A timeline slider from `00:00` to `End` with interactive markers for every `diagram_snapshot` (cyan nodes) and `agent_intervention` (amber hand icons). Dragging the slider updates both the rendered diagram and highlights the active transcript turn in real time.
4. Slide-Out Drawer: "Ask the Meeting" RAG Agent powered by Supabase `pgvector` (`match_knowledge_chunks` RPC) that answers questions about *why* architectural decisions were made and renders clickable timestamp pills (`[04:15]`) that jump the timeline scrubber to that exact moment.
```

---

### Epic 4: Demo Video & Devpost Submission Compliance (Nov 7 – Nov 9)

| ID | Task Name | Est. Time | Status | Assigned To |
| :--- | :--- | :--- | :--- | :--- |
| `T-17` | Script & Rehearse the $150\text{-Second}$ Demo Scenario in Lens Studio Preview | 2.0h | `[TODO]` | Ruan + Gemini |
| `T-18` | Record Split-Screen Video ($60\text{ s}\text{--}180\text{ s}$ HD: Lens Studio Preview + Dashboard) | 3.5h | `[TODO]` | Ruan |
| `T-19` | Generate Standardized Devpost Writeup (Inspiration, What It Does, How We Built It, Challenges, Future Potential) | 1.0h | `[READY_FOR_AGENT]` | Gemini |
| `T-20` | Verify Public GitHub Repo (`/docs/scope.md`, `prd.md`, `spec.md`) & Submit Before Nov 9, 2:00 PM PST ($00:00\text{ SAST}$) | 1.0h | `[TODO]` | Ruan |