<div align="center">

# 👓 SpecScribe AR
### Spatial Architecture & Decision Intelligence for Snap Spectacles

[![Snap Lens Studio](https://img.shields.io/badge/Lens%20Studio-5.15%2B-FFFC00?style=for-the-badge&logo=snapchat&logoColor=black)](https://lensstudio.snapchat.com/)
[![Target Hardware](https://img.shields.io/badge/Target-Snap%20Spectacles%20(2024)-00E5FF?style=for-the-badge)](https://www.spectacles.com/)
[![FastAPI](https://img.shields.io/badge/Backend-FastAPI%20Async-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![Next.js](https://img.shields.io/badge/Dashboard-Next.js%2015-black?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org/)
[![Supabase](https://img.shields.io/badge/Database-Supabase%20pgvector-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com/)
[![Python](https://img.shields.io/badge/Python-3.12%2B-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://python.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tests](https://img.shields.io/badge/Tests-37%2F37%20Passing-brightgreen?style=for-the-badge&logo=pytest&logoColor=white)](#testing--verification)

<p align="center">
  <b>A real-time, multimodal spatial engineering companion for whiteboarding sessions.</b><br/>
  Hands-free Draw.io digital twin overlays, SIK pinch-to-spawn architecture nodes, an ambient "Raising-Hand" proactive AI critic, and a post-meeting temporal decision scrubber.
</p>

[Key Features](#-key-features) •
[System Architecture](#-system-architecture) •
[Prerequisites](#-prerequisites) •
[Required Tokens & Secrets](#-required-tokens--secrets) •
[Quickstart Guide](#-quickstart-guide) •
[Testing & Verification](#-testing--verification) •
[Hackathon Compliance](#-hackathon-compliance--rubric-alignment)

</div>

---

## 💡 The Problem & The SpecScribe Solution

Technical system design sessions live and die on physical whiteboards. Engineers debate trade-offs, sketch microservices, and mutate databases at high velocity. Traditional meeting recorders and AI transcription bots capture *what was spoken*, but discard **three critical dimensions**:

1. **Visual State Evolution:** How the whiteboard topology evolved across iterations.
2. **Temporal Decision Lineage:** *Why* a queue, cache, or replica was added or rejected at timestamp $T$, and *which speaker* advocated for that trade-off.
3. **In-Flight Architectural Critique:** Single points of failure, unauthenticated endpoints, or missing rate limiters are caught days later instead of live during whiteboarding when changes are trivial.

### How SpecScribe AR Solves This

```
                      PHYSICAL WORLD                          SPATIAL COMPUTING (SPECTACLES AR)
               ┌──────────────────────────┐                    ┌───────────────────────────────┐
               │  Physical Whiteboard     │   Periodic 480p    │  Neon Waveguide Overlay       │
               │  Marker Diagram Strokes  │ ─────────────────> │  Auto-Routed Draw.io DAG      │
               └──────────────────────────┘   Camera Capture   │  (Transparent #000000 bg)     │
                            ▲                                  └───────────────────────────────┘
                            │                                                  ▲
                   Natural Discussion                               Live Push / Pull Critique
                            │                                                  ▼
               ┌──────────────────────────┐   SIK Pinch Voice  ┌───────────────────────────────┐
               │  Engineering Team        │ ─────────────────> │  "Raising-Hand" AI Teammate   │
               │  Verbal Trade-offs & ASR │    Component Spawn │  Proactive Security & Arch Orb│
               └──────────────────────────┘                    └───────────────────────────────┘
```

* **Hands-Free Whiteboard-to-Draw.io Digital Twin:** Periodically samples camera frames, filters static frames via perceptual hashing ($<5\text{ms}$), extracts graph deltas via Gemini 2.5 Flash Vision, recalculates a Sugiyama hierarchical DAG layout with `drawio-mcp`, and renders a transparent AR overlay via a pre-warmed headless Chromium daemon in $60\text{ms}\text{--}140\text{ms}$.
* **SIK Pinch Component Palette:** Four spatial `PinchButton` controls (`[◇ Decision]`, `[▭ Service]`, `[🛢 Database]`, `[○ Terminal]`) anchored at $1.15\text{m}$ focal depth. Pinch any button and speak a title to inject nodes directly into the live graph.
* **The "Raising-Hand" Ambient AI Teammate:** An ambient 3D orb floating in the peripheral FOV that visually **raises its hand** with a concise floating pill badge (`"🚩 Auth Token Leak Risk"`, `"💡 Use Pub/Sub Queue"`) when it detects flaws, or provides on-demand research on pinch.
* **Post-Meeting Temporal Decision Scrubber & RAG Hub:** A Next.js 15 dashboard backed by Supabase `pgvector` that replays the exact diagram evolution alongside speaker turns, decision rationales, auto-generated Markdown technical specs, and RAG Q&A.

---

## ⚡ Key Features

| Feature | Description | Technology Stack |
| :--- | :--- | :--- |
| **Whiteboard Vision Sync** | Non-blocking $480\text{p}$ camera capture every $3\text{s}$, perceptual hash gate (`imagehash.phash`), and incremental graph delta extraction. | `CameraModule`, `imagehash`, Gemini 2.5 Flash Vision |
| **Sub-140ms Draw.io Overlay** | In-process Sugiyama hierarchical DAG layout with pre-warmed headless Chromium transparent overlay rendering. | `drawio-mcp`, Playwright Chromium, CDP |
| **SIK Pinch Palette** | Spatial component palette anchored at $1.15\text{m}$ forward $Z$-axis. Pinch to spawn nodes with localized speech-to-text labels. | `SpectaclesInteractionKit`, `AsrModule` |
| **"Raising-Hand" AI Critic** | Non-intrusive floating AI orb that audits architectural changes in real-time, raising a hand badge ($\le 28$ chars) upon detecting anti-patterns. | Fast heuristic rule engine + Gemini 2.5 Flash |
| **On-Demand AR Research** | Pinch the idle orb, speak a technical query, watch the orb enter a glowing `RESEARCHING` state, and receive synthesized bullet cards. | WebSockets, Gemini 2.5 Flash, 3D AR tweening |
| **Temporal Decision Scrubber** | Replay meeting history from `00:00` to `End`, watching the Draw.io diagram mutate in sync with speaker-diarized audio transcripts. | Next.js 15, React 19, Tailwind CSS, Supabase |
| **Spec Generator & RAG Hub** | 1-click Markdown Technical Spec compiler and semantic Q&A drawer querying $1536$-dimensional `pgvector` embeddings. | PostgreSQL 16, `pgvector`, Gemini Embeddings |

---

## 👓 Waveguide Optical Ergonomics

Snap Spectacles use **binocular additive optical waveguides**. SpecScribe AR was specifically designed around these physical optics:

* **True Black Transparency:** Additive displays cannot project dark pixels; true black (`#000000`) emits zero light and is $100\%$ transparent. All overlays are generated with `bg=none` (`opacity=0`) so the real-world room and whiteboard remain visible.
* **High-Contrast Neon Vector Strokes:** Nodes render in phosphor green (`#00FF66`), cyan (`#00E5FF`), amber (`#FFB300`), and magenta (`#E040FB`) for maximum legibility against varied physical backgrounds.
* **1.0m – 1.3m Optical Comfort Zone:** Spectacles have a fixed focal plane at $1.0\text{m}$ with full binocular overlap at $1.1\text{m}$. All SIK colliders and HUD elements are placed strictly between $1.0\text{m}$ and $1.3\text{m}$ along the negative $Z$-axis to prevent vergence-accommodation conflict and eye fatigue.
* **Thermal & Battery Discipline:** Frames are downsampled to $480\text{p}$ and encoded off-thread via `Base64.encodeTextureAsync`, avoiding the severe thermal throttling caused by continuous uncompressed 60 FPS streaming.

---

## 🏗️ System Architecture

```mermaid
flowchart TB
    subgraph LensStudio ["Snap Lens Studio 5.15+ / Spectacles 2024"]
        Cam["PeriodicCameraCapturer.ts<br/>(480p @ 0.33 FPS)"]
        ASR["LensStudio:AsrModule<br/>(Speech-to-Text)"]
        SIK["SpatialInterfaceManager.ts<br/>(SIK Pinch Palette)"]
        Orb["RaisingHandAgentController.ts<br/>(Ambient 3D AI Orb)"]
        Overlay["AR Diagram Surface<br/>(Unlit Mesh / #000000 Transparent)"]
    end

    subgraph Backend ["FastAPI Async Orchestrator (Port 8000)"]
        WS["WebSocket Hub<br/>/ws/meeting/{id}"]
        PHash{"imagehash.phash<br/>Diff Gate (Hamming >= 6)"}
        GemVision["Gemini 2.5 Flash<br/>Vision Graph Delta Extractor"]
        DrawioEng["In-Memory drawio-mcp<br/>Sugiyama DAG Auto-Layout"]
        PlaywrightDaemon["Pre-Warmed Headless Chromium<br/>export3.html (60-140ms PNG)"]
        AgentCritic["Raising-Hand Agent Loop<br/>(Heuristics + Proactive Critic)"]
        SpecGen["Spec Generator & RAG Hub<br/>(Markdown Compiler + Embeddings)"]
    end

    subgraph Persistence ["Supabase PostgreSQL + pgvector"]
        DB_Meetings[("meetings")]
        DB_Turns[("transcript_turns")]
        DB_Snapshots[("diagram_snapshots")]
        DB_Interventions[("agent_interventions")]
        DB_Vectors[("knowledge_chunks (pgvector)")]
    end

    subgraph WebDashboard ["Next.js 15 Web Dashboard (Port 3000)"]
        Scrubber["Temporal Timeline Scrubber<br/>(00:00 to End Replay)"]
        DrawioViewer["Draw.io XML Live Viewer"]
        TranscriptReplay["Speaker-Diarized Turns View"]
        RAGDrawer["Semantic RAG Q&A Drawer"]
        SpecExport["1-Click Markdown Spec & .drawio Export"]
    end

    Cam -->|Base64 JPEG| WS
    ASR -->|Spoken Text| WS
    SIK -->|pinchCommand| WS
    Orb <-->|HAND_RAISED / ASK_AGENT| WS
    WS -->|Decoded Texture Base64| Overlay

    WS --> PHash
    PHash -->|Changed Frame| GemVision
    GemVision --> DrawioEng
    SIK -.->|Inject Vertex| DrawioEng
    DrawioEng --> PlaywrightDaemon
    PlaywrightDaemon -->|RGBA PNG Buffer| WS

    WS <--> AgentCritic
    WS --> DB_Meetings & DB_Turns & DB_Snapshots & DB_Interventions & DB_Vectors

    WebDashboard <-->|REST & JSON API| Backend
    WebDashboard -.->|Direct Query / Vector Read| Persistence
```

---

## 📁 Repository Structure

```text
SpecScribe/
├── backend/                       # Python 3.12+ FastAPI Async Orchestrator
│   ├── agents/
│   │   ├── decision_linker.py     # Links spoken debate to diagram mutations
│   │   ├── raising_hand_agent.py  # Proactive anti-pattern critic & on-demand researcher
│   │   └── spec_generator.py      # Compiles technical Markdown specs & pgvector RAG
│   ├── graph_engine.py            # In-memory drawio-mcp Sugiyama DAG layout & Playwright daemon
│   ├── main.py                    # FastAPI application, WebSocket hub & REST routes
│   ├── pyproject.toml             # Pytest and build metadata
│   ├── requirements.txt           # Python dependencies (FastAPI, Google GenAI, Playwright, etc.)
│   ├── seed_demo_meeting.py       # Seed realistic architectural brainstorming meeting
│   ├── test_agents.py             # Unit tests for AI agents (8 tests)
│   ├── test_orchestrator.py       # Unit tests for graph engine & WebSocket (7 tests)
│   └── test_spec_generator.py     # Unit tests for spec compiler & RAG (7 tests)
│
├── spectacles-lens/               # Snap Lens Studio 5.15+ Spatial Client
│   ├── Assets/
│   │   └── Scripts/
│   │       ├── PeriodicCameraCapturer.ts      # 480p off-thread camera sampling
│   │       ├── PersistentStreamSocketClient.ts# Full-duplex WebSocket client
│   │       ├── SpatialInterfaceManager.ts     # SIK PinchButton palette & AR texture decode
│   │       └── RaisingHandAgentController.ts  # Ambient 3D AI Teammate Orb controller
│   ├── SCENE_HIERARCHY_SETUP.md   # Step-by-step 1.0m-1.3m transform & material setup
│   ├── tests/
│   │   └── components.test.mjs    # Mock-verified TypeScript tests (15 tests)
│   ├── package.json               # Lens Studio TypeScript build & test scripts
│   └── tsconfig.json              # Strict TypeScript configuration
│
├── web-dashboard/                 # Next.js 15 Post-Meeting Temporal Scrubber
│   ├── app/
│   │   ├── api/meetings/          # Edge & server routes for timeline and RAG
│   │   ├── meetings/[id]/page.tsx # Interactive scrubber, Draw.io viewer & audio replay
│   │   └── page.tsx               # Session picker / meeting list
│   ├── components/
│   │   ├── DrawioViewer.tsx       # Live rendering of diagram XML states
│   │   ├── RAGDrawer.tsx          # Post-meeting AI Q&A with source attribution
│   │   └── SpecExportModal.tsx    # Technical specification preview and export
│   └── lib/api.ts                 # Backend API client
│
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql # PostgreSQL schema, pgvector extension & indexes
│
├── docs/                          # Spec-Driven Development Artifacts (25% Rubric)
│   ├── scope.md                   # In-scope MVP and out-of-scope boundaries
│   ├── prd.md                     # Product Requirement Document
│   ├── spec.md                    # Detailed Technical Specification
│   └── reviews/                   # Architectural audits and reviews
│
├── CODE_AUDIT.md                  # Comprehensive code audit and verification report
└── PRD.md                         # Master Hackathon PRD
```

---

## 📋 Prerequisites

Before setting up the project, ensure you have the following installed:

| Tool | Recommended Version | Purpose |
| :--- | :--- | :--- |
| **Python** | `3.12` | Runs the FastAPI orchestrator and AI agents |
| **Node.js** | `v20.x LTS` (or `v18.x+`) | Runs Next.js 15 dashboard & Lens Studio TS build |
| **Snap Lens Studio** | `5.15.x+` | Lens editing, simulation & Interactive Preview |
| **Spectacles Interaction Kit** | Built-in / `v0.12+` | Hand tracking & `PinchButton` components |
| **Google Gemini API Key** | `gemini-2.5-flash` access | Vision diffing, critique agent & embeddings |
| **Supabase Account** | Cloud or Local CLI | PostgreSQL 16 + `pgvector` store |

---

## 🔐 Required Tokens & Secrets

SpecScribe AR uses environment variables for secure credential management. Create the respective `.env` files in `/backend` and `/web-dashboard`:

### 1. Backend Configuration (`backend/.env`)

Copy `backend/.env.example` to `backend/.env`:

```bash
cp backend/.env.example backend/.env
```

| Variable | Required? | Description | Where to Get |
| :--- | :---: | :--- | :--- |
| `GEMINI_API_KEY` | **Yes** | API key for Gemini 2.5 Flash Vision, Proactive Critic, and Embeddings. | [Google AI Studio](https://aistudio.google.com/) |
| `SUPABASE_URL` | **Yes** | Your Supabase project URL (`https://<project-id>.supabase.co`). | Supabase Dashboard → Settings → API |
| `SUPABASE_SERVICE_KEY` | **Yes** | Supabase `service_role` secret key (for backend database writes & bypass of RLS). | Supabase Dashboard → Settings → API → `service_role` |
| `DEEPGRAM_API_KEY` | *Optional* | Fallback cloud speech transcription if not using Lens Studio's built-in `AsrModule`. | [Deepgram Console](https://console.deepgram.com/) |
| `PORT` | *Optional* | Server listening port (default: `8000`). | Set to custom port if required |
| `HOST` | *Optional* | Server host binding (default: `0.0.0.0`). | Set to `127.0.0.1` if local-only |

### 2. Web Dashboard Configuration (`web-dashboard/.env.local`)

Copy `web-dashboard/.env.example` to `web-dashboard/.env.local`:

```bash
cp web-dashboard/.env.example web-dashboard/.env.local
```

| Variable | Required? | Description | Default Value |
| :--- | :---: | :--- | :--- |
| `NEXT_PUBLIC_API_URL` | **Yes** | Base URL pointing to the FastAPI backend orchestrator. | `http://localhost:8000` |

---

## 🚀 Quickstart Guide

Follow these steps to run the complete end-to-end system locally.

### Step 1: Clone the Repository

```bash
git clone https://github.com/your-username/SpecScribe.git
cd SpecScribe
```

### Step 2: Set Up Supabase Database

1. Create a project in [Supabase](https://supabase.com).
2. Go to the **SQL Editor** in the Supabase Dashboard.
3. Open `supabase/migrations/001_initial_schema.sql`, paste its contents, and click **Run**.
   *(This enables `vector`, sets up `meetings`, `transcript_turns`, `diagram_snapshots`, `agent_interventions`, and `knowledge_chunks` with high-performance indexes).*

### Step 3: Set Up & Run the FastAPI Backend

```bash
cd backend

# 1. Create and activate a Python virtual environment
python -m venv .venv
# On Windows (PowerShell):
.\.venv\Scripts\Activate.ps1
# On macOS / Linux:
# source .venv/bin/activate

# 2. Install dependencies
pip install -r requirements.txt

# 3. Install Playwright's headless Chromium daemon
playwright install chromium

# 4. Populate your .env file
cp .env.example .env
# Open .env and add your GEMINI_API_KEY, SUPABASE_URL, and SUPABASE_SERVICE_KEY

# 5. Seed a demo meeting (supports dry-run without credentials or live Supabase insertion)
python seed_demo_meeting.py

# 6. Start the FastAPI server
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Verify the backend is running:
* **Health Check:** [http://localhost:8000/health](http://localhost:8000/health)
* **Interactive OpenAPI Docs:** [http://localhost:8000/docs](http://localhost:8000/docs)
* **WebSocket Endpoint:** `ws://localhost:8000/ws/meeting/{meeting_id}`

### Step 4: Set Up & Run the Web Dashboard

In a new terminal window:

```bash
cd web-dashboard

# 1. Install Node.js dependencies
npm install

# 2. Configure environment
cp .env.example .env.local

# 3. Start the Next.js development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser:
* Access the seeded session: [http://localhost:3000/meetings/demo-session-01](http://localhost:3000/meetings/demo-session-01) (or use the ID generated by `seed_demo_meeting.py`).
* Drag the **Timeline Scrubber** from `00:00` to `End` to watch the Draw.io diagram update dynamically with speaker turns.
* Open the **Semantic Q&A Drawer** to query the meeting knowledge base.
* Click **Export Spec** to preview or download the generated Markdown technical spec.

### Step 5: Run the Snap Lens Studio 5.15 Client

1. Open **Snap Lens Studio 5.15+**.
2. Open or import the project located in `spectacles-lens/`.
3. Ensure the scene hierarchy matches the optical ergonomics detailed in [`spectacles-lens/SCENE_HIERARCHY_SETUP.md`](file:///c:/Users/ruanc/source/repos/SpecScribe/spectacles-lens/SCENE_HIERARCHY_SETUP.md).
4. In the Lens Studio **Inspector**, select the `PersistentStreamSocketClient` component:
   * Set `websocketUrl` to: `ws://localhost:8000/ws/meeting/demo-session-01`
5. Switch the **Preview Panel** simulation target to **Spectacles (2024)** and enable **Interactive Preview** with Hand Tracking.
6. **Interact in AR:**
   * Pinch the `[▭ Service]` button on the component palette: notice the node spawn into the live diagram with voice labeling.
   * Speak an architecture decision: notice the transcript turn logged and linked to the snapshot.
   * Watch the ambient **Raising-Hand AI Orb** detect issues and raise a floating pill badge (`"🚩 Auth Token Leak Risk"`).
   * Pinch the orb to expand the 3-bullet critique card or trigger on-demand research.

---

## 🧪 Testing & Verification

The project includes automated verification across all tiers, with **37 total unit tests**:

### 1. Backend Test Suite (Pytest)

Covers the in-memory `drawio-mcp` Sugiyama layout engine, Playwright headless daemon, WebSocket diff gate, proactive critique agent, spec compiler, and `pgvector` similarity math:

```bash
cd backend
.\.venv\Scripts\pytest -v
```

```text
============================= test session starts =============================
test_agents.py::test_generate_text_embedding_dimensions PASSED           [  4%]
test_agents.py::test_transcript_window_filtering PASSED                  [  9%]
test_agents.py::test_decision_linker_process_snapshot PASSED             [ 13%]
test_agents.py::test_raising_hand_short_title_constraint PASSED          [ 18%]
test_agents.py::test_raising_hand_heuristic_anti_pattern_detection PASSED [ 22%]
test_agents.py::test_raising_hand_deduplication PASSED                   [ 27%]
test_agents.py::test_raising_hand_mode_b_on_demand_research_pull PASSED  [ 31%]
test_agents.py::test_api_meeting_interventions_and_knowledge PASSED      [ 36%]
test_agents.py::test_websocket_ask_agent_research_pull PASSED            [ 40%]
test_orchestrator.py::test_waveguide_styles_and_node_addition PASSED     [ 45%]
test_orchestrator.py::test_sugiyama_layout_calculation PASSED            [ 50%]
test_orchestrator.py::test_perceptual_hash_diff_gate PASSED              [ 54%]
test_orchestrator.py::test_headless_daemon_rendering_latency PASSED      [ 59%]
test_orchestrator.py::test_rest_api_lifecycle PASSED                     [ 63%]
test_orchestrator.py::test_websocket_pinch_command_and_transcription PASSED [ 68%]
test_orchestrator.py::test_websocket_camera_frame_diff_gate PASSED       [ 72%]
test_spec_generator.py::test_timestamp_formatting_and_parsing PASSED     [ 77%]
test_spec_generator.py::test_cosine_similarity_math PASSED               [ 81%]
test_spec_generator.py::test_compile_markdown_spec_structure PASSED      [ 86%]
test_spec_generator.py::test_chunk_meeting_artifacts_types PASSED        [ 90%]
test_spec_generator.py::test_finalize_meeting_pipeline PASSED            [ 95%]
test_spec_generator.py::test_rest_api_finalize_and_ask_flow PASSED       [100%]
============================= 22 passed in 18.05s =============================
```

### 2. Lens Studio Client Test Suite (TypeScript & Node.js)

Verifies non-blocking camera frame sampling, WebSocket reconnection and packet serialization, SIK button binding, and Raising-Hand orb states:

```bash
cd spectacles-lens
npm test
```

```text
> specscribe-spectacles-lens@1.1.0 test
> npm run build && node --test tests/*.test.mjs

✔ T-10: PeriodicCameraCapturer (4 tests)
✔ T-10: PersistentStreamSocketClient (3 tests)
✔ T-11 & T-12: SpatialInterfaceManager (3 tests)
✔ T-13: RaisingHandAgentController (5 tests)
ℹ tests 15 | suites 5 | pass 15 | fail 0
```

### 3. Web Dashboard Production Build (Next.js)

Verifies TypeScript compilation, React 19 component typing, and static page generation:

```bash
cd web-dashboard
npm run build
```

```text
✓ Compiled successfully
✓ Linting and checking validity of types
✓ Generating static pages (4/4)
✓ Finalizing page optimization
```

---

## 🏆 Hackathon Compliance & Rubric Alignment

SpecScribe AR is developed for the **Learn AR with SPECS** hackathon ([Devpost Challenge ID `31659`](https://learn-specs.devpost.com/)):

| Rubric Domain | Weight | Official Requirement | SpecScribe AR Implementation |
| :--- | :---: | :--- | :--- |
| **1. Spec-Driven Methodology & Rigor** | **25%** | High-fidelity `/docs/scope.md`, `/docs/prd.md`, and `/docs/spec.md` generated prior to implementation; public GitHub repo. | **Complete.** Full technical specification and requirements published in `/docs/` and tracked throughout implementation. |
| **2. Technical Implementation & Stability** | **25%** | Robust TypeScript in Lens Studio 5.15+, effective SIK integration, $60\text{ FPS}$ simulation, zero console warnings. | **Verified.** Off-thread camera downsampling to $480\text{p}$, persistent WebSocket transport, 37 passing unit tests, and $60\text{ FPS}$ simulation stability. |
| **3. Spatial UX & AR Ergonomics** | **20%** | See-through waveguide optimization: $1.0\text{m}\text{--}1.3\text{m}$ comfort zone, minimal center-field occlusion, transparent backgrounds. | **Optimized.** Pure black (`#000000`) transparency with neon high-contrast strokes (`#00FF66`, `#00E5FF`). All interactive colliders sit in the $1.0\text{m}\text{--}1.3\text{m}$ optical comfort zone. |
| **4. Utility, Originality & Impact** | **20%** | Creative hands-free spatial computing utility compared to flat screen recording. | **High Impact.** Live whiteboard-to-Draw.io twin, pinch-to-spawn component palette, Raising-Hand proactive critic, and temporal decision scrubber. |
| **5. Demonstration & Pitch Quality** | **10%** | $60\text{s}\text{--}180\text{s}$ HD walkthrough in Lens Studio Interactive Preview Panel + structured Devpost writeup. | **Production-Ready.** Walkthrough demonstrates live SIK hand tracking side-by-side with the web dashboard temporal scrubber. |

---

## 📖 Key Documentation Links

* **[Master Product Requirement Document (PRD)](PRD.md)**: Product goals, user stories, and architecture blueprints.
* **[Technical Specification (`/docs/spec.md`)](docs/spec.md)**: Deep dive into wire protocols, data models, and Sugiyama algorithms.
* **[Project Scope Document (`/docs/scope.md`)](docs/scope.md)**: In-scope MVP and out-of-scope boundaries.
* **[Scene Hierarchy Setup Guide](spectacles-lens/SCENE_HIERARCHY_SETUP.md)**: Guide for setting up transforms, materials, and colliders in Lens Studio 5.15+.
* **[Comprehensive Code Audit (`CODE_AUDIT.md`)](CODE_AUDIT.md)**: Full codebase audit, architectural review, and test results.

---

## 🛠️ Troubleshooting & FAQ

<details>
<summary><b>Q: Why do I see a blank black box instead of a transparent diagram in AR?</b></summary>
Snap Spectacles use additive optical waveguides where true black (<code>#000000</code>) emits zero light and is completely transparent. Ensure the <code>RenderMeshVisual</code> material is set to <code>Unlit</code> with <code>BlendMode: PremultipliedAlpha</code>, and verify the backend is rendering with <code>bg=none</code>.
</details>

<details>
<summary><b>Q: Can I run and test the project without physical Snap Spectacles hardware?</b></summary>
<b>Yes!</b> The hackathon rules explicitly specify that physical hardware is not required. The project is verified to run inside the <b>Snap Lens Studio 5.15+ Interactive Preview Panel</b> with active SIK hand tracking simulation.
</details>

<details>
<summary><b>Q: What happens if I run the backend without Supabase credentials?</b></summary>
The backend and seed script include graceful fallback dry-run modes. In dry-run mode, <code>seed_demo_meeting.py</code> prints sample payloads to the console and tests run against mock fixtures, allowing offline development.
</details>

<details>
<summary><b>Q: How fast is the Draw.io overlay rendering?</b></summary>
By maintaining a pre-warmed headless Chromium instance via Playwright running <code>viewer.diagrams.net/export3.html</code> and communicating over CDP, render latency is between <b>60ms and 140ms</b>, compared to 1,800ms–3,500ms for traditional CLI exporters.
</details>

---

## 📄 License

This project is open-source software licensed under the [MIT License](LICENSE).

<div align="center">
  <sub>Built with ❤️ for <b>Learn AR with SPECS</b> • Powered by Snap Spectacles, FastAPI, Next.js, and Google Gemini</sub>
</div>
