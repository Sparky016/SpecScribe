# SpecScribe AR — Rules, Regulations & Alignment Checklist

* **Project:** SpecScribe AR (Spatial Architecture & Decision Intelligence for Snap Spectacles)
* **Hackathon:** Learn AR with SPECS (`https://learn-specs.devpost.com/` — Devpost Challenge ID `31659`)
* **Document Version:** `v1.0.0`
* **Target Audience:** Core Development Team, AI Coding Agents (Claude Code, Cursor), QA Reviewers
* **Enforcement Level:** **MANDATORY GATE** — No feature or pull request may be merged without satisfying all Tier-1 invariants in this document.

---

## 1. Hard Deadlines & Submission Constraints

### 1.1 Timezone Synchronization & Freeze Windows

The Devpost submission engine enforces an absolute timestamp lock. Draft forms cannot be submitted, edited, or appended after the exact deadline second.

| Milestone | Date | Time | Timezone | South Africa Standard Time (SAST) |
| :--- | :--- | :--- | :--- | :--- |
| **Official Hackathon Launch** | October 15, 2026 | 09:00 AM | PDT (UTC-7) | 18:00 SAST |
| **Team Holiday Blackout** | Oct 30 – Nov 2, 2026 | — | — | **0 Hours Dev Budget** |
| **Code Freeze & Video Cut** | November 8, 2026 | 06:00 PM | SAST | 06:00 PM SAST |
| **Pre-Flight Submission Gate** | November 9, 2026 | 09:00 PM | SAST | **Target Submission Time (3h Buffer)** |
| **Hard Platform Deadline** | **November 9, 2026** | **2:00:00 PM** | **PST (UTC-8)** | **Midnight 00:00:00 SAST (Nov 10)** |

* **Invariant 1.1.1 (Submission Buffer):** All code, documentation, and video uploads must be finalized and submitted by **9:00 PM SAST on Monday, November 9, 2026** ($3\text{ hours}$ prior to the platform lockout).
* **Invariant 1.1.2 (Repository Provenance):** The GitHub repository must be public and initialized within the official hackathon window (after October 15, 2026). Do not fork or push pre-existing application codebases.

---

### 1.2 Mandatory Deliverables Matrix

To pass administrative screening and qualify for judging, the project must include every artifact listed below. Missing any single deliverable results in immediate disqualification.

| Deliverable | Location / Format | Mandatory Requirements | Verification Tool |
| :--- | :--- | :--- | :--- |
| **Public GitHub Monorepo** | Public GitHub URL | Must be public, contain commit history, and house the entire codebase (`/backend`, `/spectacles-lens`, `/web-dashboard`, `/supabase`, `/docs`). | GitHub Web GUI / Incognito check |
| **Spec Documentation** | `/docs/` directory | Must contain three complete, untruncated files: `scope.md`, `prd.md`, and `spec.md`. | Automated CI / File presence check |
| **Demonstration Video** | Public YouTube, Vimeo, or Loom URL | **Minimum $60\text{ seconds}$, Maximum $180\text{ seconds}$ ($3\text{ minutes}$)**. Must showcase live SIK hand tracking inside the Lens Studio Interactive Preview Panel. | Video player runtime audit |
| **Devpost Portfolio Writeup** | Devpost Project Page | Must use the exact 5-section narrative structure (Inspiration, What It Does, How We Built It, Challenges, Future Potential). | Devpost Markdown Preview |
| **Lens ID / Package Export** | Devpost Submission Field | Lens ID string (if published) or an exported `.lspkg` Lens Studio package attached in repo releases. | Devpost Project Editor |

---

## 2. Official Judging Rubric & Alignment Strategy ($100\text{ Points}$)

Every architectural choice in *SpecScribe AR* directly maps to maximizing points across the official five evaluation domains.

```
+---------------------------------------------------------------------------------------------------------+
|                                    100-POINT JUDGING RUBRIC BREAKDOWN                                   |
+---------------------------------------------------------------------------------------------------------+
| [25%] Spec-Driven Methodology   | [25%] Technical Implementation | [20%] Spatial UX & AR Ergonomics     |
| - /docs/scope.md                | - Lens Studio 5.15 TypeScript  | - 1.0m-1.3m Optical Comfort Zone     |
| - /docs/prd.md                  | - SIK Pinch Integration        | - Zero Center-Field Occlusion        |
| - /docs/spec.md                 | - 60 FPS Sustained Simulation  | - Additive Light Mechanics (bg=none) |
| - Agent-Assisted Rigor          | - Zero Console Warnings/Errors | - Phosphor High-Luminance Palette    |
+---------------------------------+--------------------------------+--------------------------------------+
| [20%] Utility, Impact & Value   | [10%] Pitch & Demo Quality     | TOTAL: 100 POINTS                    |
| - Hands-Free Spatial Whiteboard | - 60s - 180s HD Video Length   | Minimum Viable Target: 92+           |
| - Temporal Decision Lineage     | - Live SIK Preview Proof       | Stretch Target: 97+                  |
| - Proactive Raising-Hand AI     | - 5-Section Devpost Story      |                                      |
+---------------------------------+--------------------------------+--------------------------------------+
```

### 2.1 Domain 1: Spec-Driven Methodology & Rigor ($25\%$)
* **Requirement:** Thorough, high-fidelity planning documents produced before and during the build phase using agentic coding skill packs.
* **Team Alignment Rules:**
  1. The `/docs/` directory must contain:
     * `docs/scope.md`: Boundary analysis, hardware justification, in-scope MVP targets, out-of-scope declarations.
     * `docs/prd.md`: Comprehensive PRD including personas, user journeys, functional and non-functional requirements.
     * `docs/spec.md`: Complete technical specification, component hierarchies, WebSocket wire schemas, and database DDL.
  2. **Rule of Change Management:** No developer or AI coding agent may introduce a new endpoint, database column, or spatial component without first updating `docs/spec.md` or `docs/prd.md`.
  3. Every pull request or commit message should cite the corresponding spec requirement or task ID (e.g., `feat(lens): implement PeriodicCameraCapturer per spec.md#2.3.1 [T-10]`).

### 2.2 Domain 2: Technical Implementation & Stability ($25\%$)
* **Requirement:** Robust TypeScript code in Lens Studio 5.15+, reliable full-duplex networking, clean error recovery, and sustained $60\text{ FPS}$ performance.
* **Team Alignment Rules:**
  1. **Zero Console Warnings:** The Lens Studio project must run cleanly in the Interactive Preview Panel without throwing red errors or continuous yellow warning loops.
  2. **Non-Blocking Architecture:** All heavy I/O operations (camera capture, Base64 compression, network serialization) must run asynchronously off the main thread.
  3. **Graceful Network Degradation:** If the FastAPI backend drops the WebSocket connection, the client must display an AR reconnection banner rather than crashing the Lens execution runtime.

### 2.3 Domain 3: Spatial UX & AR Ergonomics ($20\%$)
* **Requirement:** Experience calibrated specifically for optical see-through smart glasses rather than mobile or VR ports.
* **Team Alignment Rules:**
  1. **Optical Comfort Zone ($1.0\text{ m}\text{--}1.3\text{ m}$):** All interactable colliders (`PinchButton`), text panels, and diagram planes must be positioned between $Z = -1.0\text{ m}$ and $Z = -1.3\text{ m}$ relative to the camera origin. Never place colliders closer than $0.8\text{ m}$ (causes vergence-accommodation breakdown) or further than $1.5\text{ m}$ (causes raycast jitter).
  2. **Peripheral Anchoring (Unobstructed Center View):** The center field of view ($0^\circ \pm 10^\circ$) must remain clear so the wearer can see the physical whiteboard and colleagues. All UI controls (SIK palette on the left, Raising-Hand Orb on the right) must live in the peripheral display zone.
  3. **Additive Optical Transparency:** Spectacles waveguides cannot project black light. All UI assets and diagram exports must enforce `bg=none` (`alpha=0`). Black (`#000000`) is transparent. Diagram edges and text must use bright, saturated neon tones (`#00FF66` phosphor green, `#00E5FF` cyan, `#FFFFFF` crisp white).

### 2.4 Domain 4: Utility, Originality & Impact ($20\%$)
* **Requirement:** Compelling real-world utility that proves why smart glasses are fundamentally superior to a laptop or phone for this use case.
* **Team Alignment Rules:**
  1. Demonstrate the three core differentiators:
     * **Hands-free flow:** The engineer can hold a dry-erase marker with both hands while the diagram digitizes in the background.
     * **Proactive "Raising-Hand" teammate:** The AI participates naturally without requiring the user to look away at a laptop screen.
     * **Temporal decision lineage:** Connects whiteboard strokes directly to spoken rationales and speaker identities.

### 2.5 Domain 5: Demonstration & Pitch Quality ($10\%$)
* **Requirement:** A concise, polished video demonstration ($60\text{ s}\text{--}180\text{ s}$) showcasing live SIK hand tracking in the Interactive Preview Panel alongside an articulate Devpost project description.
* **Team Alignment Rules:**
  1. The video must not exceed $180\text{ seconds}$ under any circumstance ($181\text{ s}$ violates the platform threshold).
  2. Active hand interaction (SIK cursor, pinch gestures, button highlights) must be clearly visible on screen.

---

## 3. Lens Studio 5.15+ Technical Regulations

All client-side code targeting `/spectacles-lens` must comply with these technical restrictions.

### 3.1 Camera & Frame Sampling Constraints

```
[CameraModule] 
      │ 
      ├─► request.imageSmallerDimension = 480 (Driver-Level Downsampling)
      │ 
      ├─► Triggered on UpdateEvent via 3.0s DeltaTime Accumulator (0.33 FPS)
      │ 
      └─► Base64.encodeTextureAsync(..., CompressionQuality.Low, EncodingType.Jpg)
            │
            └─► Non-blocking background worker thread (Zero Main-Thread Drop)
```

1. **Initialization Rule:** Camera requests must **NEVER** be issued inside `onAwake()`. All `CameraModule.requestCamera()` invocations must be bound to `OnStartEvent`.
2. **Resolution & Thermal Rule:** The hardware camera stream must be downscaled at the hardware driver gate via `request.imageSmallerDimension = 480`. Streaming full $1080\text{p}$ or $4\text{K}$ buffers is strictly prohibited due to thermal throttling limits on the Qualcomm Snapdragon platform.
3. **Encoding Rule:** Synchronous image compression is forbidden. All frames must be encoded via `Base64.encodeTextureAsync(..., CompressionQuality.Low, EncodingType.Jpg)` on a worker thread.

---

### 3.2 Spectacles Interaction Kit (SIK) Constraints

1. **SIK Package Dependency:** All interactive scene objects must import and inherit from `SpectaclesInteractionKit.lspkg` components (`PinchButton`, `Interactable`).
2. **Audio Mode Constraint:** Audio feedback associated with SIK buttons and AI voice playback must explicitly configure:
   ```typescript
   audioComponent.playbackMode = Audio.PlaybackMode.LowLatency;
   ```
   Do not leave audio on `Audio.PlaybackMode.LowPower`, which introduces a perceptible $300\text{ ms}\text{--}500\text{ ms}$ playback delay.
3. **Pill Title Length Boundary:** To prevent text clipping or word-wrap artifacts on the Spectacles waveguide, all floating AR badge titles (`HandRaisedPillBadge`) must be strictly truncated to $\le 28\text{ characters}$.

---

### 3.3 Hardware Simulation Compliance (No Physical Glasses Required)

Per official hackathon rule `RES-01`, physical Spectacles (2024) are **not required**. The project will be evaluated inside the **Lens Studio Interactive Preview Panel**.

* **Mandatory Testing Profile:** In Lens Studio, set the Preview Device Profile to **Spectacles (2024)**.
* **Hand Simulation Configuration:** Enable the Interactive Hand Simulator (keyboard/mouse mapping: spacebar to activate hands, right-click to pinch).
* **Console Health Check:** Open the Lens Studio Logger window (`Window -> Panels -> Logger`). Run the full 3-minute demo flow. The log must be free of red exceptions and memory leak warnings.

---

## 4. Backend & Microservice Architecture Regulations

### 4.1 In-Process `drawio-mcp` Engine Rules

1. **No External Deno/Docker Daemons:** To avoid inter-process communication (IPC) latency, the backend must import the Python-native `drawio-mcp` library directly into the FastAPI application process:
   ```python
   from drawio_mcp.models import DrawioFile, Diagram, MxCell
   from drawio_mcp.layout_engine import LayoutEngine
   ```
2. **Sugiyama Hierarchical DAG Rule:** All diagram additions must be routed through `LayoutEngine().apply_sugiyama(diagram, layer_distance=70, node_distance=50)`. Never assign static coordinate points $(x=0, y=0)$ to nodes.
3. **Additive Style Palette Constraint:** All cells added to the graph must strictly adhere to the high-contrast waveguide styling matrix:
   * **Service/Process:** `fillColor=#107C41;strokeColor=#00FF66;fontColor=#FFFFFF;strokeWidth=2;`
   * **Decision:** `fillColor=#004D40;strokeColor=#00E5FF;fontColor=#FFFFFF;strokeWidth=2;`
   * **Database:** `fillColor=#0D47A1;strokeColor=#00E5FF;fontColor=#FFFFFF;strokeWidth=2;`
   * **Terminal:** `fillColor=#311B92;strokeColor=#00FF66;fontColor=#FFFFFF;strokeWidth=2;`
   * **Connectors:** `strokeColor=#00E5FF;strokeWidth=3;fontColor=#00E5FF;`

---

### 4.2 Headless Playwright Export Daemon Rules

1. **Lifespan Management:** Playwright must be managed inside FastAPI's `asynccontextmanager` lifespan. Launch Chromium once on server boot and keep `https://viewer.diagrams.net/export3.html` warm in memory. Do not spawn browser processes per request.
2. **Export Parameters:** Invocations of `window.render()` over the Chrome DevTools Protocol (CDP) must enforce:
   * `format: 'png'`
   * `bg: 'none'` (Enforces transparent alpha channel)
   * `scale: 1.5`
   * `border: 0`
3. **Execution Budget:** The complete pipeline (`drawio_xml` $\rightarrow$ CDP evaluation $\rightarrow$ Base64 PNG extraction) must complete in $\le 140\text{ ms}$.

---

### 4.3 Unified Persistence (Supabase + `pgvector`) Rules

1. **Single Backend Principle:** Do not introduce separate vector databases (Pinecone, Qdrant) or separate document stores (MongoDB). Everything must reside within the single Supabase PostgreSQL instance:
   * `meetings`: Meeting metadata and serialized specs.
   * `transcript_turns`: Speaker-diarized phrases and millisecond offsets.
   * `diagram_snapshots`: `.drawio` XML snapshots, diff summaries, and decision rationales.
   * `agent_interventions`: Raising-Hand critique logs and interaction flags.
   * `knowledge_chunks`: Text chunks paired with $1536\text{-dimensional}$ embeddings (`vector(1536)`).
2. **RPC Indexing:** All vector queries must execute through the stored procedure `match_knowledge_chunks(query_embedding, match_meeting_id, match_threshold, match_count)`.

---

## 5. Non-Functional Latency & Performance Budgets

Every subsystem must operate within its designated performance budget:

| Pipeline Segment | Budget Ceiling | Target Optimal | Fallback / Mitigation |
| :--- | :--- | :--- | :--- |
| **Lens Studio Frame Rate** | $\ge 60\text{ FPS}$ | $60\text{ FPS}$ sustained | Reduce `imageSmallerDimension` from $480$ to $360$. |
| **Frame Diff Gate (`phash`)** | $< 10\text{ ms}$ | $< 5\text{ ms}$ | Skip VLM call entirely if Hamming distance $< 6$. |
| **VLM Topology Extraction** | $< 1800\text{ ms}$ | $900\text{ ms}\text{--}1200\text{ ms}$ | Utilize `gemini-2.5-flash` with structured Pydantic schema. |
| **Sugiyama DAG Auto-Layout** | $< 50\text{ ms}$ | $15\text{ ms}\text{--}35\text{ ms}$ | Cache node positions and apply localized sub-tree layout. |
| **Headless Diagram Rasterization** | $< 150\text{ ms}$ | $60\text{ ms}\text{--}100\text{ ms}$ | Fallback to standalone `@markdown-viewer/drawio2svg` + `cairosvg`. |
| **AR Texture Decode & Apply** | $< 60\text{ ms}$ | $20\text{ ms}\text{--}35\text{ ms}$ | Use `Base64.decodeTextureAsync` to prevent main-thread freezing. |
| **End-to-End Pinch-to-Render** | $< 350\text{ ms}$ | $180\text{ ms}\text{--}250\text{ ms}$ | Pre-generate common node XML templates in memory. |

---

## 6. Video Demonstration Production Requirements

The demonstration video accounts for **$10\%$ of the official score** and is the primary evaluation asset seen by the judges.

```
+---------------------------------------------------------------------------------------------------------+
|                                    SPLIT-SCREEN VIDEO COMPOSITION (150s)                                |
+---------------------------------------------------------------------------------------------------------+
|                                                    |                                                    |
|                   LEFT PANE (50%)                  |                  RIGHT PANE (50%)                  |
|                                                    |                                                    |
|           Lens Studio 5.15 Interactive             |              Next.js Web Dashboard &               |
|                   Preview Panel                    |                Live Draw.io Canvas                 |
|                                                    |                                                    |
|       - Spectacles 2024 Simulation Profile         |       - Real-time node generation                  |
|       - Live SIK hand tracking and pinch rays      |       - Synchronized transcript turn feed          |
|       - Neon AR diagram overlay on whiteboard      |       - Temporal scrubber bar movement             |
|       - Raising-Hand AI teammate orb animation     |       - Clickable timestamp citations              |
|                                                    |                                                    |
+----------------------------------------------------+----------------------------------------------------+
| AUDIO: Clear, noise-free narration walking through the 4-act scenario (Problem, In-Lens UX, AI, Review) |
+---------------------------------------------------------------------------------------------------------+
```

### 6.1 Duration & Content Rules
1. **Strict Duration Gate:** The video runtime must be between **$60\text{ seconds}$ and $180\text{ seconds}$**. A video of $59\text{ seconds}$ or $181\text{ seconds}$ will receive scoring deductions or disqualification.
2. **Visual Proof Mandate:** The video **must clearly display the Lens Studio Interactive Preview Panel** with active SIK hand gestures (virtual hands with pinch rays). Simulated camera feeds or external animations without the preview environment violate competition rules.
3. **Format & Hosting:** Recorded in $1080\text{p}$ HD ($1920\times 1080$), hosted as a public or unlisted video on **YouTube, Vimeo, or Loom**. Ensure audio is balanced and speech is clearly audible.

### 6.2 Recommended 150-Second Script Structure
* **Act 1: The Problem (0:00 – 0:25):** The chaos of whiteboard meetings and lost architectural rationale.
* **Act 2: The AR Solution (0:25 – 1:00):** Putting on the Spectacles simulation. Live drawing on the board, automated `drawio-mcp` Sugiyama layout, and the neon AR overlay appearing in world space.
* **Act 3: SIK Pinch & Raising-Hand Teammate (1:00 – 1:45):** Pinching the SIK palette to inject a `[🛢 Database]` node; the AI Orb raising its hand with `"🚩 Cache Stampede Risk"`, expanding the critique card with low-latency audio.
* **Act 4: Temporal Scrubber & RAG Review (1:45 – 2:20):** Scrubbing through the Next.js timeline, watching the diagram evolve chronologically, and querying the RAG drawer with clickable timestamp citations.
* **Act 5: Summary & Spec-Driven Close (2:20 – 2:30):** Closing title card showing the GitHub repo with `/docs/scope.md`, `prd.md`, and `spec.md`.

---

## 7. Devpost Written Pitch Regulations

The Devpost written narrative must strictly adhere to the five mandatory platform headers:

### Header 1: Inspiration
* Address the cognitive dissonance of technical brainstorms: whiteboards are fluid, but documentation is static and disconnected from the verbal debate.
* Justify the choice of Snap Spectacles: hands-free spatial computing is the only medium that allows an engineer to write with a physical marker while augmenting their visual reality.

### Header 2: What It Does
* Describe the 4 core capabilities:
  1. Automated hands-free whiteboard-to-Draw.io spatial overlay.
  2. Peripheral 4-button SIK Pinch Palette for instant architectural node injection.
  3. Proactive "Raising-Hand" 3D AI Teammate that spots vulnerabilities in real time.
  4. Post-meeting Temporal Decision Scrubber and RAG review hub.

### Header 3: How We Built It
* Detail the technology stack transparently:
  * **Spatial Client:** Snap Lens Studio 5.15+, Spectacles Interaction Kit (SIK), `CameraModule`, `InternetModule`, `AsrModule`.
  * **Backend Engine:** FastAPI (Python 3.11), in-memory `drawio-mcp` (Sugiyama DAG engine), `imagehash`, Gemini 2.5 Flash.
  * **Render Daemon:** Pre-warmed Playwright Chromium running `viewer.diagrams.net/export3.html`.
  * **Persistence & Review:** Supabase (`PostgreSQL 16` + `pgvector`), Next.js 15 App Router.
  * **Methodology:** Spec-Driven Development via Devpost Learn skill packs.

### Header 4: Challenges Encountered
* Detail concrete technical hurdles overcome:
  1. Additive waveguide optical limitations (rendering transparent backgrounds and high-contrast lines).
  2. Eliminating IPC latency by embedding `drawio-mcp` directly in Python.
  3. Ensuring sustained $60\text{ FPS}$ in Lens Studio by moving frame encoding off the main thread.

### Header 5: Future Potential
* Outline commercial and enterprise roadmap: multi-user shared AR colocation, JIRA/GitHub Architecture Decision Record (ADR) export integrations, and live cloud infrastructure provisioning directly from the whiteboard diagram.

---

## 8. Pre-Flight Verification & Alignment Gate Checklist

Before marking any milestone complete or submitting the project, verify every item on this checklist:

```markdown
### Pre-Flight Verification Gate

#### 1. Repository & Documentation Compliance (25% Weight)
- [ ] Public GitHub repository initialized after October 15, 2026.
- [ ] `/docs/scope.md` exists, is untruncated, and contains spatial computing justifications.
- [ ] `/docs/prd.md` exists, is untruncated, and contains user stories and non-functional requirements.
- [ ] `/docs/spec.md` exists, is untruncated, and contains TypeScript interfaces, WebSocket schemas, and Supabase DDL.
- [ ] Root `README.md` includes clear setup instructions for both Lens Studio 5.15 and the FastAPI backend.

#### 2. Lens Studio Simulation & Spatial UX (45% Weight)
- [ ] Project opens in Lens Studio 5.15.x with Spectacles (2024) simulation profile.
- [ ] Simulation runs at sustained 60 FPS without frame drops.
- [ ] Lens Studio Logger window displays ZERO red errors and zero continuous yellow warning loops.
- [ ] SIK hand tracking and PinchButton interactions respond cleanly to mouse/keyboard simulation.
- [ ] All spatial UI elements are anchored between 1.0m and 1.3m along the forward Z-axis.
- [ ] Center field of view is completely clear; UI palette and AI orb sit in the periphery.
- [ ] Diagram overlay uses transparent background (`bg=none`) and high-contrast neon strokes (`#00FF66`, `#00E5FF`).
- [ ] AI badge short title is strictly clamped to <= 28 characters.

#### 3. Backend, Diagram & Persistence Stability (20% Weight)
- [ ] FastAPI WebSocket hub cleanly connects and handles `handshake`, `cameraFrame`, `asrTranscription`, and `pinchCommand`.
- [ ] `imagehash.phash` diff gate drops unchanged frames in <5ms.
- [ ] In-memory `drawio-mcp` executes Sugiyama layout in <35ms.
- [ ] Pre-warmed Playwright daemon exports transparent RGBA PNG in <140ms.
- [ ] Supabase schema (`001_initial_schema.sql`) executes cleanly with `vector(1536)` extension.
- [ ] Next.js Temporal Scrubber successfully replays diagram snapshots and transcript turns.

#### 4. Media & Submission Deliverables (10% Weight)
- [ ] Demonstration video runtime is between 60s and 180s (e.g., 2m 30s = 150s).
- [ ] Video clearly demonstrates the Lens Studio Interactive Preview Panel with live SIK hand tracking.
- [ ] Video hosted on YouTube, Vimeo, or Loom with public/unlisted permissions verified in an incognito window.
- [ ] Devpost submission text completed under the 5 mandatory headings.
- [ ] Final submission pressed before 9:00 PM SAST on November 9, 2026 (3-hour buffer before hard lock).
```