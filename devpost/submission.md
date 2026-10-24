# SpecScribe AR — Devpost Submission Portfolio

> **Learn AR with SPECS Hackathon (Devpost Challenge ID: 31659)**  
> **Project URL:** https://github.com/Sparky016/SpecScribe  
> **Track:** Learn AR with SPECS  

---

## Inspiration

Technical architecture and system design sessions live and die on physical whiteboards. Engineers debate trade-offs, sketch microservices, and mutate databases at high velocity. However, traditional meeting recorders and AI transcription bots capture only *what was spoken*, while discarding three critical dimensions of technical brainstorming:

1. **Loss of Visual State Evolution:** Whiteboards are fluid and iterative, but photos taken at the end of a session only preserve a single flattened artifact, discarding how the architecture evolved across iterations.
2. **Loss of Temporal Decision Lineage:** Teams lose the vital causal link between a diagram mutation at timestamp $T$ and the spoken rationale—*who* proposed adding a Redis cache or Kafka topic, and *why* specific trade-offs were accepted or rejected.
3. **Lack of In-Flight Architectural Verification:** Single points of failure, missing authentication boundaries, and unmitigated cache stampedes are discovered days later during code review instead of live during whiteboarding when architectural changes are trivial.

### Why Snap Spectacles?

We realized that laptops, tablets, and phones are fundamentally the wrong form factor for whiteboard brainstorming. Holding a smartphone or typing on a laptop breaks flow, forces engineers to look down, and disconnects them from their teammates. 

Snap Spectacles (2024) provide the only computing medium capable of solving this problem: **hands-free, optical see-through spatial computing**. By combining binocular additive optical waveguides with natural hand tracking via the Spectacles Interaction Kit (SIK), an engineer can hold a physical dry-erase marker with both hands, maintain eye contact with colleagues, and see clean, auto-routed digital twin architecture diagrams and proactive AI critiques floating directly in physical space beside the board.

---

## What It Does

**SpecScribe AR** is a multimodal spatial engineering companion for whiteboarding sessions, bridging physical drawing, real-time spatial interaction, and post-meeting decision intelligence across four core capabilities:

### 1. Hands-Free Whiteboard-to-Draw.io Spatial Overlay
As engineers sketch with physical dry-erase markers on the whiteboard, SpecScribe AR periodically samples camera frames off the main thread at $480\text{p}$, filters static frames in $<5\text{ms}$ using perceptual hashing (`imagehash.phash`), extracts incremental topology changes via Gemini 2.5 Flash Vision, and recalculates an optimal hierarchical directed acyclic graph (DAG) using the Sugiyama layout algorithm in `drawio-mcp`. The resulting diagram is rasterized into a transparent RGBA PNG via a pre-warmed headless Chromium daemon in $60\text{ms}\text{--}140\text{ms}$ and projected onto the physical board in world space using high-contrast phosphor green (`#00FF66`) and cyan (`#00E5FF`) vectors.

### 2. Peripheral 4-Button SIK Pinch Component Palette
Anchored at the ergonomic $1.15\text{m}$ focal depth in the wearer's left periphery, a 4-button Spectacles Interaction Kit (`PinchButton`) palette allows the engineer to inject standardized architecture nodes hands-free:
* `[◇ Decision]` (Cyan, Decision Branch)
* `[▭ Service]` (Phosphor Green, Microservice/Worker)
* `[🛢 Database]` (Cyan, Relational/Key-Value Store)
* `[○ Terminal]` (Phosphor Green, Event Ingress/Egress)

Pinching any button and speaking a name uses `LensStudio:AsrModule` speech recognition to instantiate the node directly into the live Draw.io diagram.

### 3. The "Raising-Hand" Ambient 3D AI Teammate
Floating quietly in the upper-right periphery ($X = +38\text{cm}, Y = +18\text{cm}, Z = -115\text{cm}$) is an ambient glowing AI orb that operates in two complementary modes:
* **Proactive Critique Mode (Push):** Continuously cross-references spoken debate with diagram topology. When it detects an architectural risk (e.g., a Redis cache added without stampede protection, or an unauthenticated public ingress), the orb visually **raises its hand** with an ultra-concise floating pill badge ($\le 28\text{ characters}$, e.g. `"🚩 Cache Stampede Risk"`). Pinching the raised hand expands a floating 3-bullet critique card with concrete mitigations and plays low-latency audio feedback.
* **On-Demand Research Mode (Pull):** The wearer pinches the idle orb and speaks a technical question (e.g., *"What eviction policy should we use for Redis session storage?"*). The orb enters a glowing `RESEARCHING` state with a rotating neon ring, querying Gemini and raising its hand once the synthesized recommendation card is ready.

### 4. Post-Meeting Temporal Decision Scrubber & RAG Review Hub
After the session concludes, all artifacts are unified in a **Next.js 15** web dashboard backed by **Supabase PostgreSQL 16 + `pgvector`**:
* **Temporal Scrubber Bar:** An interactive timeline slider from `00:00` to `End` with interactive cyan markers for diagram snapshots and amber markers for AI interventions. Scrubbing updates the rendered Draw.io diagram in sync with speaker-diarized transcript turns.
* **1-Click Engineering Export:** Instant download of valid `.drawio` XML models, auto-generated Markdown Technical Specifications, and structured decision logs.
* **"Ask the Meeting" Semantic RAG Drawer:** Queries $1536$-dimensional vector embeddings (`knowledge_chunks`) to answer natural language questions (e.g., *"Why did we choose PostgreSQL over DynamoDB?"*) with clickable `[MM:SS]` timestamp citations that jump the scrubber to that exact moment.

---

## How We Built It

SpecScribe AR was engineered from the ground up following a rigorous **Spec-Driven Methodology** (`docs/scope.md` → `docs/prd.md` → `docs/spec.md`) across four tightly integrated tiers:

### 1. Spatial Client (Snap Lens Studio 5.15+ & TypeScript)
* **Runtime & SDKs:** Lens Studio 5.15.x targeting Snap Spectacles (2024 / Snap OS) and the Interactive Preview Panel.
* **Spectacles Interaction Kit (SIK):** Utilizes `SpectaclesInteractionKit.lspkg` (`PinchButton`, `Interactable`, hand tracking raycasters) for spatial input.
* **Optical Ergonomics:** Calibrated strictly for the $1.0\text{m}\text{--}1.3\text{m}$ focal depth ($Z = -1.15\text{m}$ to $-1.20\text{m}$) with peripheral UI placements to keep the center field of view ($0^\circ \pm 10^\circ$) completely unobstructed.
* **Thermal & Memory Discipline:** Hardware camera requests downscaled to $480\text{p}$ (`imageSmallerDimension = 480`) and initialized inside `OnStartEvent` (never `onAwake`). Frame encoding runs off-thread via `Base64.encodeTextureAsync` at $0.33\text{ FPS}$, preserving a sustained $60\text{ FPS}$ simulation budget.
* **Audio Optimization:** `AudioComponent.playbackMode` explicitly configured to `Audio.PlaybackMode.LowLatency` for instant chime playback.
* **Testing:** 16 hermetic TypeScript unit tests (`npm test`) and 6 automated LEAF integration test scenarios (`SpecScribeDC1Scenario.ts` through `DC6`).

### 2. Async Orchestrator (FastAPI & In-Memory `drawio-mcp`)
* **In-Process Python Engine:** Rather than invoking external Deno daemons or CLI tools with multi-second cold starts, we directly embedded `drawio-mcp` (`drawio_mcp.models` and `drawio_mcp.layout_engine`) inside the FastAPI application process.
* **Sugiyama Hierarchical DAG Layout:** All diagram mutations execute in $<35\text{ms}$ with zero IPC overhead (`layer_distance=70`, `node_distance=50`).
* **Vision Diffing:** Camera frames pass through an `imagehash.phash` gate ($<5\text{ms}$) before triggering structured Gemini 2.5 Flash topology extraction.
* **Networking:** Bidirectional WebSocket connection (`/ws/meeting/{id}`) handling client handshakes, camera frames, ASR transcripts, pinch commands, diagram updates, and AI interventions.

### 3. Pre-Warmed Headless Export Daemon (Playwright Chromium)
* Managed through FastAPI's `asynccontextmanager` lifespan, launching Chromium once on server boot and keeping `https://viewer.diagrams.net/export3.html` warm in memory.
* Evaluates `window.render({ format: 'png', bg: 'none', scale: 1.5, border: 0 })` over Chrome DevTools Protocol (CDP), outputting transparent RGBA PNG overlays in $60\text{ms}\text{--}140\text{ms}$.

### 4. Persistence & Review Hub (Supabase `pgvector` & Next.js 15)
* **Single Database Principle:** PostgreSQL 16 hosted on Supabase storing `meetings`, `transcript_turns`, `diagram_snapshots`, `agent_interventions`, and `knowledge_chunks`.
* **Vector Search:** $1536$-dimensional embeddings generated via `gemini-embedding-001` / deterministic fallback, queried through the `match_knowledge_chunks` RPC function.
* **Web Dashboard:** Built with Next.js 15 (App Router), React 19, and Tailwind CSS, featuring SVG rendering, responsive audio synchronization, and RAG Q&A.

---

## Challenges Encountered

1. **Additive Waveguide Optics & Transparent Backgrounds:**  
   Snap Spectacles use additive optical waveguides where true black (`#000000`) emits zero light and is completely transparent, while standard desktop diagram tools default to solid white or opaque canvas backgrounds. We re-engineered the Playwright export pipeline to enforce `bg: 'none'` (`alpha=0`) and developed a high-contrast waveguide styling palette (phosphor green `#00FF66`, cyan `#00E5FF`, white `#FFFFFF`) so lines pop brightly against varied physical whiteboard backgrounds without obscuring the room.

2. **Eliminating IPC Latency for Live Interactivity:**  
   Initial prototypes that relied on spawning CLI processes or external Deno/Docker servers introduced $1.8\text{s}\text{--}3.5\text{s}$ of latency per diagram change, making real-time spatial interaction sluggish. By embedding `drawio-mcp` directly in the FastAPI process and keeping a single headless Chromium browser instance warm in memory, we crushed end-to-end pinch-to-overlay latency down to $<250\text{ms}$.

3. **Sustaining 60 FPS under Hardware Thermal Constraints:**  
   Streaming uncompressed camera frames or compressing images synchronously on the main thread caused severe frame drops and thermal throttling inside Lens Studio. We decoupled the pipeline by deferring camera requests to `OnStartEvent`, locking resolution to $480\text{p}$, throttling capture to a $3.0\text{s}$ delta-time accumulator, and utilizing asynchronous worker thread encoding (`Base64.encodeTextureAsync`).

4. **Vergence-Accommodation Conflict Prevention:**  
   Placing spatial UI too close ($<0.8\text{m}$) causes severe visual fatigue and eye strain on Spectacles, while placing it too far ($>1.5\text{m}$) degrades hand-tracking raycast accuracy. We enforced a strict $1.0\text{m}\text{--}1.3\text{m}$ depth budget across all scene objects and placed interactive affordances in the left and right peripheral zones to keep the user's primary line of sight unobstructed.

---

## Future Potential

1. **Multi-User Colocated Spatial Whiteboarding (SpectaclesSyncKit):**  
   Extending SpecScribe AR to multi-spectacles colocation so multiple distributed or in-room engineers wearing Spectacles share the identical spatial Draw.io overlay, seeing each other's pinch cursors and hearing spatialized audio discussions.

2. **Automated Architecture Decision Record (ADR) Export to GitHub/Jira:**  
   Integrating directly with engineering issue trackers to turn meeting decision lineage into automated GitHub pull requests, creating formatted `docs/adr/XXXX-title.md` records with embedded Draw.io XML diagrams.

3. **Live Cloud Infrastructure Provisioning (Terraform / Pulumi):**  
   Translating the validated whiteboard topology directly into declarative Infrastructure as Code (Terraform / OpenTofu), allowing teams to move from physical whiteboard brainstorm directly to staging cloud deployment in a single meeting.

4. **Bi-Directional Physical-to-Digital Stroke Interaction:**  
   Leveraging spatial world-mesh depth testing to allow the user to erase physical marker strokes with their finger, automatically reflecting deletions in the synchronized digital twin.
