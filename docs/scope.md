# Project Scope Document — SpecScribe AR

- **Project Name:** SpecScribe AR
- **Target Platform:** Snap Spectacles (2024 / Snap OS) & Snap Lens Studio 5.15+ Interactive Preview[cite: 2, 3]
- **Hackathon Track:** Learn AR with SPECS (`https://learn-specs.devpost.com/` — Challenge ID `31659`)[cite: 3]
- **Methodology:** Spec-Driven Agentic Development (`scope.md` -> `prd.md` -> `spec.md`)[cite: 3]

---

## 1. Problem Statement

Engineering architecture and system design sessions rely heavily on physical whiteboards and rapid multi-speaker debate. Existing AI meeting assistants only summarize audio transcripts, resulting in three critical losses:

1. **Loss of Visual State Evolution:** Static end-of-meeting whiteboard photos discard the intermediate iterations of how the system diagram evolved.
2. **Loss of Temporal Decision Lineage:** Teams lose the mapping between a specific diagram modification at timestamp $T$ and the verbal rationale of _who_ proposed it and _why_.
3. **Lack of Real-Time Architectural Verification:** During live brainstorming, engineers miss logical flaws, single points of failure, or security vulnerabilities until post-meeting reviews.

---

## 2. Why Snap Spectacles & Optical See-Through Spatial Computing?

SpecScribe AR is purpose-built for the optical and ergonomic characteristics of Snap Spectacles rather than smartphones or enclosed VR headsets[cite: 2, 3]:

- **Hands-Free Whiteboard Co-Presence:** Engineers can hold physical whiteboard markers and sketch naturally while viewing a synchronized, auto-routed Draw.io digital twin anchored beside the physical board[cite: 1, 3].
- **Additive Waveguide Transparency:** Spectacles use binocular stereoscopic waveguide displays where true black (`#000000`) emits zero light and remains completely transparent[cite: 1]. SpecScribe AR renders diagrams with `bg=none` (`opacity=0`) and high-contrast phosphor green (`#00FF66`) and cyan (`#00E5FF`) vector strokes so the physical room is never occluded[cite: 1].
- **Ergonomic Focal Placement (1.0m – 1.3m):** Because Spectacles project onto a 1.0m optical focal plane with full binocular overlap at 1.1m, all interactive Spectacles Interaction Kit (`SIK`) affordances are anchored between 1.0m and 1.3m in the wearer's periphery to avoid vergence-accommodation conflict and preserve hand-tracking raycast accuracy[cite: 2].

---

## 3. In-Scope MVP Deliverables

1. **Lens Studio 5.15+ Spatial Client (`/spectacles-lens`):**
   - Non-blocking periodic camera frame capture (`PeriodicCameraCapturer.ts`) initialized on `OnStartEvent` at `480p` (`imageSmallerDimension = 480`) using asynchronous background thread encoding (`Base64.encodeTextureAsync`)[cite: 2].
   - Persistent full-duplex WebSocket client (`PersistentStreamSocketClient.ts`) using `LensStudio:InternetModule` and localized speech transcription via `LensStudio:AsrModule` (`HighSpeed` mode)[cite: 2].
   - **SIK Pinch Component Palette:** Four spatial `PinchButton` controls (`[◇ Decision]`, `[▭ Service]`, `[🛢 Database]`, `[○ Terminal]`) allowing the wearer to pinch-spawn architecture nodes directly into the live Draw.io graph using voice labels[cite: 2].
   - **AR Diagram Overlay Surface:** Dynamic `RenderMeshVisual` plane updated via `Base64.decodeTextureAsync` (`mainMaterial.mainPass.baseTex`) within 200ms of backend graph mutations[cite: 1, 2].
   - **"Raising-Hand" Peripheral AI Teammate (`RaisingHandAgentController.ts`):** A peripheral 3D orb that visually raises its hand with a concise badge (`"🚩 Auth Rate Limit"`, `"💡 Use Pub/Sub"`) when the backend detects a flaw or completes a pinched research query.

2. **FastAPI + In-Memory `drawio-mcp` Orchestrator (`/backend`):**
   - Perceptual hash gate (`imagehash.phash`) filtering redundant camera frames before invoking Gemini 2.5 Flash vision diffing.
   - Direct in-process Python integration of `drawio-mcp` (`drawio_mcp.models` and `drawio_mcp.layout_engine`) executing automatic Sugiyama hierarchical DAG layouts (`apply_sugiyama`)[cite: 1].
   - Pre-warmed headless Chromium Playwright daemon running `viewer.diagrams.net/export3.html` (`window.render`) to rasterize transparent RGBA PNG overlays in 60ms–140ms[cite: 1].
   - Proactive Raising-Hand critique loop and on-demand research agent.

3. **Unified Supabase Store & Next.js 15 Temporal Dashboard (`/web-dashboard`):**
   - Single PostgreSQL + `pgvector` schema storing meetings, speaker-diarized transcript turns, timestamped `.drawio` XML snapshots, agent interventions, and vector embeddings.
   - Interactive Timeline Scrubber (`00:00` to `End`) synchronizing diagram evolution with speaker decisions, plus a `pgvector` RAG Q&A drawer and 1-click `.drawio` / Markdown spec export.

---

## 4. Out-of-Scope Boundaries (Strict MVP Discipline)

- **No Custom 3D CAD Node Mesh Engine in Lens Studio:** Individual Draw.io shapes are rendered via the 60ms–140ms server-side transparent PNG texture pipeline rather than instantiating hundreds of separate 3D meshes on the mobile Snapdragon processor[cite: 1, 2].
- **No Uncompressed 60 FPS Video Streaming:** Continuous raw 60 FPS video streaming causes thermal throttling on Spectacles within minutes[cite: 2]; capture is strictly throttled to periodic 480p snapshots[cite: 2].
- **No External Multi-Container MCP Daemons:** We explicitly exclude the Deno-based `simonkurtz-MSFT/drawio-mcp-server` and Electron CLI exporters (`drawio -x`) due to their lack of automated Sugiyama layout and 1,800ms–3,500ms cold-start latency[cite: 1].
- **No Physical Spectacles Hardware Dependency:** The project is engineered and verified to run at 60 FPS inside the mandatory Snap Lens Studio Interactive Preview Panel with simulated SIK hand tracking[cite: 3].
