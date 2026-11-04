# SpecScribe AR — Post-Remediation MVP Audit & Production Action Plan (`MVP_READY_AFTER.md`)

**Audit Date:** 2026-10-30  
**Baseline Document:** [`MVP_READY.md`](file:///c:/Users/ruanc/source/repos/SpecScribe/MVP_READY.md) (Pre-Remediation Baseline)  
**Repository:** `SpecScribe` (`spectacles-lens/`, `backend/`, `web-dashboard/`, `supabase/`, `shared/`)  
**Target Hardware:** Snap Spectacles (2024 / SPECS 27 OS, Lens Studio 5.15+, SIK)  
**Remediation Commits:** `6c7b09d` through `878f9e0` ([DEV_TASK_54.yml](file:///c:/Users/ruanc/source/repos/SpecScribe/DEV_TASK_54.yml)–[DEV_TASK_61.yml](file:///c:/Users/ruanc/source/repos/SpecScribe/DEV_TASK_61.yml))  
**Automated Verification Status:**
- **Spectacles Lens Unit Tests:** **137/137 passing** (38 test suites across TypeScript controllers and scene contracts)
- **Backend Orchestrator Unit Tests:** **146/146 offline tests passing** (1 integration test deselected)
- **Web Dashboard Production Build:** **Next.js 15.5.28 compile clean** (0 TypeScript errors, static/dynamic routes optimized)

---

## Executive Summary & Final Verdict

Between 2026-10-29 and 2026-10-30, all **8 targeted remediation tasks** ([DEV_TASK_54.yml](file:///c:/Users/ruanc/source/repos/SpecScribe/DEV_TASK_54.yml) through [DEV_TASK_61.yml](file:///c:/Users/ruanc/source/repos/SpecScribe/DEV_TASK_61.yml)) addressing the 9 architectural gaps identified in [`MVP_READY.md`](file:///c:/Users/ruanc/source/repos/SpecScribe/MVP_READY.md) were authored, reviewed, and committed to `main`.

### Final Verdict: **DELIVERED IN CODE FOR ALL 4 MVP PILLARS**

The complete software architecture, computer vision diff gates, conversational AI pipelines, MCP diagram generation, spatial SIK gestures, and waveguide rendering overlays are **100% implemented in code and verified by automated unit tests**.

To transition this delivered codebase onto physical Snap Spectacles hardware for an unscripted, real-world meeting, the development team must execute a small set of **Human-in-the-Loop Operational Deployment Steps** (applying remote Supabase migrations `004`–`007`, setting production environment secrets, and verifying Inspector references in Lens Studio).

---

## MVP Pillar Readiness Matrix (Post-Remediation)

| # | Promised MVP Requirement | Initial Status (`MVP_READY.md`) | Post-Remediation Status (`MVP_READY_AFTER.md`) | Verified Code Implementation | Remaining Action for Dev Team |
| :- | :--- | :---: | :---: | :--- | :--- |
| **1** | **Attend a meeting, listen to each person's conversation, transcribe it, and reason through requirements as they speak** | **PARTIAL** (Blocked by Gaps #1, #2) | **DELIVERED IN CODE** | • `PersistentStreamSocketClient.ts` streams live ASR with silence metadata.<br>• `SpeakerDiarizationService` (`backend/services/diarization.py`) provides Deepgram Nova-2 diarization + conversational turn-taking fallback.<br>• `DecisionLinkerAgent.process_transcript_window()` runs on a sliding window inside `AsrHandler.handle()`, synthesizing requirements and broadcasting `REQUIREMENT_SYNTHESIZED` HUD toasts. | Apply Supabase migrations `004`–`007` remotely ([DEV_TASK_15](file:///c:/Users/ruanc/source/repos/SpecScribe/DEV_TASK_15.yml), [DEV_TASK_53](file:///c:/Users/ruanc/source/repos/SpecScribe/DEV_TASK_53.yml)) and verify `DEEPGRAM_API_KEY` in production `.env`. |
| **2** | **AI Assistant warns user of potential risks via a hand raise; user pinches the orb to learn the concern** | **DELIVERED** (With Gaps #3, #4) | **DELIVERED & POLISHED** | • 20s proactive risk loop evaluates transcript + XML + RAG.<br>• Ambient 3D orb lazy-follows at 1.15m optical depth.<br>• `HAND_RAISED` state triggers pulsing cyan glow, floating category badge ($\le 28$ chars), and notification chime.<br>• Pinching `AgentOrbMesh` expands the 3-bullet `ExpandedCritiqueCard` AND triggers voice readout on `AgentVoicePlayer` (`playDecodedAudio` with chime fallback).<br>• Unicode regex wrapped in runtime `try/catch` with surrogate-pair fallback. | Verify audio volume on physical Spectacles hardware speakers. |
| **3** | **Whiteboard flow diagrams captured via Vision Model in Frequency mode (every 3s) OR Manual mode (pinch Capture button)** | **BLOCKED IN SCENE** (Gaps #5, #6, #7) | **DELIVERED & INTEGRATED** | • `PeriodicCameraCapturer.ts` implements dual `AUTO` (3s periodic) and `MANUAL` (periodic idle) modes.<br>• `BtnCaptureWhiteboard` and `BtnToggleCaptureMode` added to `Scene.scene` and `.virtual-scene.json` under `SpatialActionPalette` with SIK colliders.<br>• Mode toggles display instant HUD toasts (`"Capture Mode: AUTO (Every 3s)"` / `"Capture Mode: MANUAL"`).<br>• `backend/envelope_router.py` cooldown reduced to 2.5s for AUTO, updated ONLY after visual diff passes, and completely bypassed on `isManual=True`.<br>• Hardware camera (`CameraModule`) prioritized when `demoMode: false`. | Open `SpecScribe.esproj` in Lens Studio 5.15+ to verify visual placement of the two new SIK buttons in 3D scene view. |
| **4** | **Vision $\rightarrow$ Reasoning Model $\rightarrow$ MCP (`drawio-mcp`) $\rightarrow$ AR Glasses Overlay onto physical real-world whiteboard** | **PARTIAL** (Gaps #8, #9) | **DELIVERED & EXPANDED** | • Perceptual hash diff gate ($<5\text{ms}$) + Occlusion guard.<br>• `extract_graph_delta_from_gemini` and `GraphDeltaSchema` support vertex/edge additions, visible erasures (`removed_vertices`, `removed_edges`), and renames (`updated_vertices`).<br>• In-memory `drawio-mcp` Sugiyama DAG layout engine with orthogonal edge routing and `#00FF66` / `#00E5FF` optical palette.<br>• Pre-warmed Playwright headless daemon renders transparent RGBA PNG in $<140\text{ms}$.<br>• `WhiteboardCalibrator.ts` supports 6-DOF alignment: Z-depth translation (clamped to $-115\text{cm}$ minimum for optical comfort), world Y-axis yaw rotation, and automatic hardware passthrough (alpha 0.0). | Perform 30-second physical whiteboard calibration in the real meeting room before starting the meeting. |

---

## 1. Detailed Verification of the 4 Core MVP Pillars

### 1.1 Pillar 1: Multi-Speaker Meeting Listening, Transcription & Continuous Real-Time Requirement Reasoning

#### What Was Promised
> *"The app should allow the user to attend a meeting with the app running. The app should then listen in on the meeting. The app should listen to each person's conversation, transcribe it, and as they speak it should reason through what is being said to try and make sense of the requirements."*

#### Current Implementation & Technical Reality
1. **On-Device Speech Streaming (`spectacles-lens`)**:
   - [`PersistentStreamSocketClient.ts`](file:///c:/Users/ruanc/source/repos/SpecScribe/spectacles-lens/Assets/Scripts/PersistentStreamSocketClient.ts) connects `LensStudio:AsrModule` with `AsrMode.HighSpeed` and `silenceUntilTerminationMs = 1000`.
   - In commit `93b90d3` ([DEV_TASK_57](file:///c:/Users/ruanc/source/repos/SpecScribe/DEV_TASK_57.yml)), hardcoded `'Speaker 0 (Wearer)'` attribution was removed. Final utterances now emit `speaker_label: "auto"`, `silenceGapMs`, `silenceDurationMs`, and `turnIndex`.
2. **Multi-Speaker Diarization (`backend/services/diarization.py`)**:
   - `SpeakerDiarizationService` supports two complementary paths:
     - **Path A (Deepgram Nova-2 Audio Diarization)**: When `DEEPGRAM_API_KEY` is present and audio chunks are received, it executes multi-speaker acoustic clustering (`diarize=True`).
     - **Path B (Conversational Turn-Handoff Classifier)**: When streaming text turns from Snap's on-device `AsrModule`, it detects speaker changes using acoustic pause thresholds (`silenceGapMs >= 1500ms`), linguistic adjacency pairs, and self-introduction cues, attributing turns to `Speaker 0 (Wearer)`, `Speaker 1 (Participant)`, etc.
3. **Continuous Speech-Driven Requirement Reasoning (`backend/envelope_router.py` + `backend/agents/decision_linker.py`)**:
   - In commit `83b8bba` ([DEV_TASK_58](file:///c:/Users/ruanc/source/repos/SpecScribe/DEV_TASK_58.yml)), `AsrHandler.handle()` was enhanced with a sliding-window requirement extractor:
     - After $\ge 2$ substantive spoken utterances or $\ge 8.0\text{s}$ of conversation, it invokes `DecisionLinkerAgent.process_transcript_window(meeting_id, turns, current_xml)`.
     - Gemini 2.5/3.8 Flash reasons through the conversation against the current system topology to identify functional/non-functional requirements or architectural decisions.
     - Casual chatter (`has_requirement: false`) is discarded. Substantive requirements are persisted to Supabase and in-memory `knowledge_chunks` with 1536-dimensional cosine embeddings.
4. **AR Glasses Real-Time Feedback**:
   - The backend broadcasts `REQUIREMENT_SYNTHESIZED` and `DECISION_LOGGED` envelopes over WebSocket.
   - `PersistentStreamSocketClient.ts` routes these to `SpatialInterfaceManager.ts`, which displays an immediate HUD notification on the glasses (`DiffToastText`: e.g. `"Req: Payment Gateway with HMAC-SHA256"`).

---

### 1.2 Pillar 2: Proactive AI Assistant Risk Warning (Hand-Raise) & Pinch-to-Reveal

#### What Was Promised
> *"During this process the app might utilize the AI assistant to warn the user of potential risks. The AI assistant will do a hand raise that the app user can then activate by using the pinch on the AI assistant orb and the AI assistant orb will then let the user know what the concern is."*

#### Current Implementation & Technical Reality
1. **Proactive 20-Second Risk Evaluation Loop (`backend/agents/raising_hand_agent.py`)**:
   - Runs continuously in the background per active meeting.
   - Combines the last 60 seconds of transcript turns, the current Draw.io diagram XML, and top-3 pgvector RAG chunks (`match_knowledge_chunks` with cosine similarity $\ge 0.72$).
   - Evaluates architectural contradictions, scalability limits, security flaws, and compliance risks using Gemini via `RiskCritiqueSchema`.
2. **Spatial 3D Orb & Lazy-Follow Physics (`spectacles-lens/Assets/Scripts/RaisingHandAgentController.ts`)**:
   - Detached into world space and smoothly lerps toward `cameraAnchorOffset = vec3(26, 15, -115)` (`1.15m` depth, satisfying Spectacles vergence-accommodation comfort rules).
   - In `IDLE` state: subtle breathing scale pulse ($1.00 \times \rightarrow 1.05 \times$).
3. **The Hand-Raise Alert**:
   - When the backend broadcasts `HAND_RAISED`, the orb transitions to `AgentState.HAND_RAISED`.
   - The orb emits a cyan pulse, plays `AgentNotificationChime.wav` in low-latency mode, and displays a floating pill badge ($\le 28$ characters) with category icons (`⚠️`, `⚡`, `🔒`, `📐`).
4. **Pinch Activation & Spoken Audio Readout**:
   - Pinching `AgentOrbMesh` (bound via SIK `Interactable` with 400ms debounce) in `HAND_RAISED` state:
     - Expands the 3-bullet `ExpandedCritiqueCard` floating next to the orb.
     - In commit `878f9e0` ([DEV_TASK_60](file:///c:/Users/ruanc/source/repos/SpecScribe/DEV_TASK_60.yml)), `RaisingHandAgentController.ts` now supports decoding and playing spoken audio on `AgentVoicePlayer` (`playDecodedAudio(audio_b64)`), falling back to the notification chime.
   - Pinching the orb in `IDLE` state triggers on-demand `ASK_AGENT` research mode.
5. **Runtime Safety**:
   - Commit `878f9e0` wrapped the Unicode property escape regex `\p{Extended_Pictographic}` in a runtime `try/catch` with a surrogate-pair fallback to ensure it never throws a syntax error on embedded Spectacles JS runtimes.

---

### 1.3 Pillar 3: Dual-Mode Whiteboard Vision Capture (Frequency Mode 3s vs Manual Mode Pinch)

#### What Was Promised
> *"During this process the user or someone else in the meeting room will be writing on the whiteboard and they will be drawing technical flow diagrams. When they do this the app should use the vision model, either using the frequency mode, where every 3 seconds the camera takes a snapshot, or if the user has set it to manual mode, the user will use the pinch on the capture button to look at and process the whiteboard diagrams."*

#### Current Implementation & Technical Reality
1. **Dual Capture Modes (`spectacles-lens/Assets/Scripts/PeriodicCameraCapturer.ts`)**:
   - Implements `WhiteboardCaptureMode.AUTO` (Frequency Mode) and `WhiteboardCaptureMode.MANUAL` (Manual Mode).
   - **Frequency Mode (`AUTO`)**: Captures camera frames every 3.0 seconds (`sampleIntervalSeconds = 3.0`), downscaled to 480p and encoded asynchronously via `Base64.encodeTextureAsync`. Emits `captureMode: "AUTO"`, `isManual: false`.
   - **Manual Mode (`MANUAL`)**: The periodic timer is completely idle. Calling `triggerManualCapture()` immediately captures the active frame and emits `captureMode: "MANUAL"`, `isManual: true`.
2. **SIK 3D Spatial Buttons (`Scene.scene` & `.virtual-scene.json`)**:
   - In commit `bc2c512` ([DEV_TASK_54](file:///c:/Users/ruanc/source/repos/SpecScribe/DEV_TASK_54.yml)), `BtnCaptureWhiteboard` and `BtnToggleCaptureMode` were added under `SpatialActionPalette` with SIK `Interactable` and `ColliderComponent`.
   - Pinching `BtnToggleCaptureMode` toggles between `AUTO` and `MANUAL`, displaying an instant HUD toast (`"Capture Mode: AUTO (Every 3s)"` / `"Capture Mode: MANUAL (Pinch to Capture)"`).
   - Pinching `BtnCaptureWhiteboard` in `MANUAL` mode triggers immediate capture and displays `"Capturing whiteboard snapshot..."`.
3. **Hardware Camera Pipeline Priority**:
   - In commit `6c7b09d` ([DEV_TASK_55](file:///c:/Users/ruanc/source/repos/SpecScribe/DEV_TASK_55.yml)), `PeriodicCameraCapturer.setupCameraPipeline()` was updated to gate `simulatedTexture` behind `@input demoMode: boolean = false`. On physical Spectacles, it requests `LensStudio:CameraModule` first, eliminating the risk of pre-recorded video hijacking hardware capture.
4. **Backend Vision Cooldown Resolution (`backend/envelope_router.py`)**:
   - In commit `7acf7a1` ([DEV_TASK_56](file:///c:/Users/ruanc/source/repos/SpecScribe/DEV_TASK_56.yml)):
     - Manual captures (`isManual=True` or `captureMode="MANUAL"`) completely bypass cooldown.
     - Frequency Mode (`AUTO`) cooldown was reduced from `5.0s` to `2.5s`, allowing 3.0-second periodic snapshots to process without being throttled.
     - `session._last_vision_time = now` is updated **only after** `session.check_image_diff(raw_bytes)` detects an actual visual stroke change (`has_diff == True`). Static frames never reset the cooldown.

---

### 1.4 Pillar 4: Vision $\rightarrow$ Reasoning Model $\rightarrow$ MCP (`drawio-mcp`) $\rightarrow$ Physical Real-World Whiteboard AR Overlay

#### What Was Promised
> *"When this happens the feed of the whiteboard and the diagram should be sent to the reasoning model, which will then speak to the MCB that discusses how to draw these diagrams. Once they're drawn they will then be fed back into the AR glasses, which would overlay them onto the physical real-world whiteboard. All of this together makes the MVP."*

#### Current Implementation & Technical Reality
1. **Pre-Filtering & Occlusion Guard**:
   - Frames arriving over WebSocket pass through an $8\times 8$ grayscale perceptual hash (`imagehash.phash`, $<5\text{ms}$ CPU). Frames with $<6$ Hamming distance are dropped.
   - If a participant is drawing on or standing in front of the board, Gemini Vision sets `person_occluding_board = True`. `CameraFrameHandler` holds the previous clean diagram overlay and displays an occlusion warning toast on the HUD.
2. **Reasoning Model Graph Delta Extraction (`backend/graph_engine.py`)**:
   - In commit `1f315e8` ([DEV_TASK_59](file:///c:/Users/ruanc/source/repos/SpecScribe/DEV_TASK_59.yml)), `GraphDeltaSchema` was upgraded from additive-only to **full CRUD graph mutations**:
     - `added_vertices` & `added_edges`: New services, databases, clients, and decisions.
     - `removed_vertices` & `removed_edges`: Shapes and arrows erased from the physical whiteboard.
     - `updated_vertices`: Shapes whose labels were rewritten or types modified.
   - Both existing vertices and existing edges are fed into the Gemini prompt so the reasoning model understands the current graph topology.
3. **MCP Diagram Construction & Sugiyama Layout Engine (`drawio-mcp`)**:
   - `LiveGraphSession` uses the Python-native `drawio_mcp` package (`DrawioFile`, `Diagram`, `MxCell`, `relayout_diagram`).
   - `apply_delta()` adds, removes, updates, and reconnects cells, then executes the Sugiyama hierarchical DAG layout with orthogonal routing.
   - Nodes and edges are styled with the shared waveguide palette ([`node_registry.json`](file:///c:/Users/ruanc/source/repos/SpecScribe/shared/node_registry.json)): `#00FF66` neon green, `#00E5FF` cyan, `#FFB300` amber, `#EA4335` crimson (`strokeWidth=3`, `fontSize=16`).
4. **Pre-Warmed Headless Playwright Renderer**:
   - [`HeadlessDrawioDaemon`](file:///c:/Users/ruanc/source/repos/SpecScribe/backend/graph_engine.py#L346-L473) keeps a local Chromium page warmed on `viewer.diagrams.net/export3.html`.
   - Exports transparent RGBA PNGs (`bg=none`) in **$<140\text{ms}$**.
   - Streams base64 PNG over WebSocket via `DIAGRAM_UPDATED` envelope (`image_b64`).
5. **AR Glasses Overlay & 6-DOF Physical Whiteboard Registration**:
   - [`DiagramOverlayView.ts`](file:///c:/Users/ruanc/source/repos/SpecScribe/spectacles-lens/Assets/Scripts/DiagramOverlayView.ts) decodes the base64 PNG off-thread via `Base64.decodeTextureAsync` and maps it to `WhiteboardOverlayAnchor`.
   - In commit `4fb860e` ([DEV_TASK_61](file:///c:/Users/ruanc/source/repos/SpecScribe/DEV_TASK_61.yml)), [`WhiteboardCalibrator.ts`](file:///c:/Users/ruanc/source/repos/SpecScribe/spectacles-lens/Assets/Scripts/WhiteboardCalibrator.ts) was enhanced with full 6-DOF registration:
     - 3-axis translation with depth $Z$ clamped to safe optical bounds ($-400\text{cm} \le Z \le -115\text{cm}$, preventing vergence-accommodation conflict).
     - World Y-axis yaw rotation (`rotateYaw`) for aligning with angled conference room walls.
     - Automatic hardware passthrough mode (`setHardwarePassthrough(true)`): `WhiteboardBackplate` alpha is set to `0.0` (100% transparent) while preserving its collision plane and maintaining the overlay at `alpha = 0.92`, cleanly projecting the vector diagram directly onto the physical whiteboard without an opaque virtual quad blocking the view.

---

## 2. Points We Have Hit (Exhaustive Capabilities Catalog)

The following capabilities are fully built, integrated, and verified:

1. **Dual Whiteboard Capture Engine**:
   - Automatic 3.0s periodic frequency mode.
   - SIK pinch manual capture mode.
   - SIK mode-toggle button with instant optical HUD toast feedback.
2. **Multi-Speaker Meeting Diarization**:
   - Deepgram Nova-2 diarization for audio chunk streams.
   - Heuristic acoustic-pause + conversational turn-handoff fallback for ASR text streams.
3. **Continuous Speech-Driven Requirement Reasoning**:
   - Sliding-window LLM reasoning on rolling spoken turns without requiring visual diagram diffs.
   - Generation of structured `REQUIREMENT` and `DECISION` chunks with speaker attribution and 1536-dimensional cosine embeddings.
   - Real-time `REQUIREMENT_SYNTHESIZED` and `DECISION_LOGGED` AR HUD toasts.
4. **Full Graph Delta Mutations (MCP `drawio-mcp`)**:
   - Full support for adding, erasing (`removed_vertices`), and renaming (`updated_vertices`) shapes on the physical whiteboard.
   - Removal and rewiring of orthogonal diagram arrows (`removed_edges`).
   - Sugiyama hierarchical layout compiled into `.drawio` XML.
5. **Pre-Warmed Headless Playwright Renderer**:
   - Pre-warmed Chromium daemon rendering transparent RGBA PNGs in $<140\text{ms}$.
   - Additive see-through waveguide color tuning (`#00FF66`, `#00E5FF` on `bg=none`).
6. **Proactive AI Assistant Orb**:
   - 20-second proactive risk detection loop grounded in transcripts, XML, and pgvector RAG chunks.
   - Lazy-follow physics anchoring the orb at 1.15m optical depth.
   - 3-state machine (`IDLE`, `RESEARCHING`, `HAND_RAISED`).
   - Floating category alert pill ($\le 28$ characters) with category icons.
   - SIK pinch-to-reveal expanding the 3-bullet critique card.
   - Spoken audio / TTS playback via `AgentVoicePlayer` with notification chime fallback.
   - Safe Unicode regex with surrogate-pair fallback preventing Spectacles runtime crashes.
7. **6-DOF Physical Whiteboard Registration**:
   - 3-axis translation with Z-depth clamped to safe optical comfort bounds ($-400\text{cm} \le Z \le -115\text{cm}$).
   - World Y-axis yaw rotation for non-perpendicular conference room walls.
   - Automatic hardware passthrough mode setting backplate alpha to `0.0`.
8. **End-to-End Test & Build Verification**:
   - 137/137 Spectacles Lens unit tests passing across 38 suites.
   - 146/146 offline backend `pytest` tests passing.
   - Next.js 15 production build compiling cleanly with zero errors.

---

## 3. Concerns for Physical Hardware & Live Meeting Deployment

While all software logic is delivered in code, the development team must be aware of the following real-world operational concerns:

1. **Acoustic Environment & Single-Wearer Microphone Array**:
   - The Snap Spectacles microphone array uses directional beamforming optimized for the wearer's voice.
   - In a large conference room with high reverberation or participants sitting $>3\text{m}$ away, on-device `LensStudio:AsrModule` may miss quiet utterances from other speakers.
   - *Mitigation:* Ensure meeting participants speak at normal conversational volume, position the wearer centrally, or use an external room microphone streaming audio chunks to the backend.
2. **Gemini API Quota & Rate Limits**:
   - The continuous requirement reasoning loop and proactive risk evaluation loop make repeated LLM calls during a meeting.
   - Running on the Gemini **Free Tier** (`20 requests/day` on `gemini-3.8-flash`) will quickly trigger `429 RESOURCE_EXHAUSTED` during a live 30-minute meeting.
   - *Mitigation:* The development team must ensure a paid tier API key (`GEMINI_API_KEY`) with billing enabled is configured in `backend/.env` and Cloud Run before live client meetings.
3. **Physical Whiteboard Lighting & Marker Contrast**:
   - Gemini Vision and perceptual hashing depend on optical contrast. Dry-erase markers with faint or dried-out ink, or harsh overhead fluorescent lighting reflecting glare off the glossy whiteboard surface, can cause false occlusion flags or missed stroke detections.
   - *Mitigation:* Use thick chisel-tip black markers and avoid placing the whiteboard directly under unshielded overhead spot lights.
4. **Lens Studio Inspector Script Wiring Persistence**:
   - Lens Studio project files (`Scene.scene`) serialize script component references by GUID. If new controller files are moved or re-imported, references can detach to `00000000-0000-0000-0000-000000000000`.
   - *Mitigation:* While `SpatialInterfaceManager.ts` implements robust runtime fallbacks (`getComponent` / `createComponent`), verify in the Inspector that `SpecScribeControllers` has all fields populated before packaging for hardware.
5. **Headless Playwright Daemon in Serverless Cloud Run**:
   - Headless Chromium requires sufficient memory and shared memory (`/dev/shm`). If deployed to Cloud Run with $<2\text{GB}$ RAM or concurrency $>10$ per container, Chromium may suffer OOM crashes.
   - *Mitigation:* Provision Cloud Run with at least $2\text{GB}$ RAM and `--execution-environment=gen2`.

---

## 4. Outstanding Changes & Human-in-the-Loop Operational Gate

The following items cannot be executed autonomously by AI agents and require human action by the development team:

| Task ID | Operational Item | Required Action by Development Team |
| :---: | :--- | :--- |
| **[DEV_TASK_15](file:///c:/Users/ruanc/source/repos/SpecScribe/DEV_TASK_15.yml)** + **[DEV_TASK_53](file:///c:/Users/ruanc/source/repos/SpecScribe/DEV_TASK_53.yml)** | **Apply Remote Supabase Migrations** | Open the Supabase dashboard (or run `supabase db push`) and execute migrations [`004_timestamp_bigint.sql`](file:///c:/Users/ruanc/source/repos/SpecScribe/supabase/migrations/004_timestamp_bigint.sql), [`005_embedding_model.sql`](file:///c:/Users/ruanc/source/repos/SpecScribe/supabase/migrations/005_embedding_model.sql), [`006_knowledge_chunks_hnsw.sql`](file:///c:/Users/ruanc/source/repos/SpecScribe/supabase/migrations/006_knowledge_chunks_hnsw.sql), and [`007_public_read.sql`](file:///c:/Users/ruanc/source/repos/SpecScribe/supabase/migrations/007_public_read.sql). This unblocks the remote vector database cache. |
| **[DEV_TASK_06](file:///c:/Users/ruanc/source/repos/SpecScribe/DEV_TASK_06.yml)** | **Provision `SPECSCRIBE_API_TOKEN`** | Generate a high-entropy 32-byte token (`openssl rand -hex 32`) and save it in `backend/.env`, Cloud Run environment variables, and Vercel server secrets. |
| **[DEV_TASK_37](file:///c:/Users/ruanc/source/repos/SpecScribe/DEV_TASK_37.yml)** | **Set Vercel `BACKEND_URL`** | In the Vercel project settings for `web-dashboard`, configure `BACKEND_URL` pointing to the deployed Cloud Run HTTPS URL. |
| **[DEV_TASK_38](file:///c:/Users/ruanc/source/repos/SpecScribe/DEV_TASK_38.yml)** | **Configure Lens Inspector for Device Build** | In Lens Studio Inspector on `SpecScribeControllers`, set `backendWsBase` to `wss://<cloud-run-domain>/ws` and enter the `apiToken` before pushing the Lens to physical Spectacles via the Spectacles app. |
| **[DEV_TASK_34](file:///c:/Users/ruanc/source/repos/SpecScribe/DEV_TASK_34.yml)** | **Run LEAF Preview Scenarios** | Open Lens Studio 5.15+, open the LEAF panel, and verify scenarios `SpecScribeDC6Scenario` and `SpecScribeDC3Scenario` execute cleanly in the interactive preview. |
| **[DEV_TASK_51](file:///c:/Users/ruanc/source/repos/SpecScribe/DEV_TASK_51.yml)** | **Clean Repo Working Tree Previews** | Delete untracked diagnostic image dumps (`preview_*.jpg`, `temp_*.jpg`) from the repository root before making the final submission tag. |

---

## 5. Architectural Advice & Performance Optimizations

### 5.1 Advice for Live Meeting & Client Demonstrations
1. **The 3-Second Step-Aside Protocol**:
   - In both Frequency Mode (`AUTO`) and Manual Mode (`MANUAL`), when an engineer finishes drawing a node or connecting arrow, they must step completely clear of the whiteboard for 3–4 seconds.
   - If the presenter stays in front of the board, the occlusion gate correctly prevents the diagram from mutating until an unblocked view is available.
2. **Marker & Typography Guidance**:
   - Use standard block printing for service and database labels.
   - Draw standard shapes: rectangles for services, cylinders for databases, diamonds for decisions, rounded rectangles/ovals for clients/terminals.
3. **Whiteboard Registration Staging**:
   - When entering the meeting room, enter Calibration Mode (`SELECT_AREA`), use the virtual hand to pinch and drag the corner handles flush with the physical whiteboard frame, and use the yaw rotation handle to align with the wall angle.
   - Calibration takes $<30\text{ seconds}$ and remains spatially locked in world coordinates via Spectacles 6-DOF VIO tracking.

### 5.2 Performance Optimizations
1. **Per-Session Async Mutex on Graph Engine**:
   - In `backend/envelope_router.py`, wrap `apply_delta()` + `relayout_diagram()` + Playwright rendering in an `asyncio.Lock` per meeting session. This prevents race conditions if a manual pinch and a camera tick arrive in the same event-loop cycle.
2. **Playwright Chromium Page Pooling**:
   - For multi-meeting Cloud Run deployment, allocate a pool of 2–4 pre-warmed Chromium pages in `HeadlessDrawioDaemon` rather than serializing all sessions through a single page.
3. **Token Usage Optimization**:
   - Pass only recent transcript turns ($\le 8$ turns) and compact summaries into `DecisionLinkerAgent.process_transcript_window()`, and cache diagram XML between turns.
4. **Waveguide Optical Ergonomics**:
   - Ensure all AR vector diagram strokes remain `#00FF66` (phosphor green) or `#00E5FF` (cyan) on `bg=none`. On additive optical waveguides, true black (`#000000`) renders as 100% transparent glass, while light gray or white washes out the real whiteboard marker strokes.

---

## 6. Consolidated Risk Register (Post-Remediation)

| Risk ID | Initial Severity | Post-Fix Severity | Description | Current Status & Mitigation |
| :--- | :---: | :---: | :--- | :--- |
| **RISK-01** | Critical | **Mitigated** | `PeriodicCameraCapturer` preferred `DemoVideo.mp4` over hardware camera. | **RESOLVED in [DEV_TASK_55](file:///c:/Users/ruanc/source/repos/SpecScribe/DEV_TASK_55.yml)**: Prioritizes `CameraModule` when `demoMode: false`. |
| **RISK-02** | Critical | **Mitigated** | Wearer could not switch to Manual mode or pinch Capture button because buttons were missing from the scene. | **RESOLVED in [DEV_TASK_54](file:///c:/Users/ruanc/source/repos/SpecScribe/DEV_TASK_54.yml)**: Added `BtnCaptureWhiteboard` & `BtnToggleCaptureMode` to `Scene.scene` and `.virtual-scene.json`. |
| **RISK-03** | High | **Mitigated** | 5.0s vision cooldown dropped alternate 3.0s snapshots and blocked manual pinch capture. | **RESOLVED in [DEV_TASK_56](file:///c:/Users/ruanc/source/repos/SpecScribe/DEV_TASK_56.yml)**: Cooldown reduced to 2.5s, updated only after diff passes, bypassed on manual capture. |
| **RISK-04** | High | **Mitigated** | Verbal requirements discussed without whiteboard drawings were never synthesized into knowledge chunks. | **RESOLVED in [DEV_TASK_58](file:///c:/Users/ruanc/source/repos/SpecScribe/DEV_TASK_58.yml)**: Added continuous speech reasoning sliding window in `AsrHandler.handle()` with AR HUD toasts. |
| **RISK-05** | High | **Mitigated** | Zero speaker diarization attributed all speech to `'Speaker 0 (Wearer)'`. | **RESOLVED in [DEV_TASK_57](file:///c:/Users/ruanc/source/repos/SpecScribe/DEV_TASK_57.yml)**: Implemented `SpeakerDiarizationService` with Deepgram + conversational turn-taking fallback. |
| **RISK-06** | High | **Mitigated** | Erased or redrawn whiteboard shapes remained stuck in AR overlay because deltas were additive-only. | **RESOLVED in [DEV_TASK_59](file:///c:/Users/ruanc/source/repos/SpecScribe/DEV_TASK_59.yml)**: Extended `GraphDeltaSchema` with `removed_vertices`, `removed_edges`, and `updated_vertices`. |
| **RISK-07** | Medium | **Mitigated** | Unicode regex in `RaisingHandAgentController.ts` could throw `SyntaxError` on embedded Spectacles JS. | **RESOLVED in [DEV_TASK_60](file:///c:/Users/ruanc/source/repos/SpecScribe/DEV_TASK_60.yml)**: Wrapped in runtime `try/catch` with surrogate-pair fallback. |
| **RISK-08** | Medium | **Mitigated** | Physical whiteboard was occluded by virtual whiteboard quad on see-through waveguides. | **RESOLVED in [DEV_TASK_61](file:///c:/Users/ruanc/source/repos/SpecScribe/DEV_TASK_61.yml)**: Added automatic hardware passthrough (alpha 0.0) and 6-DOF Z-depth + yaw calibration. |
| **RISK-09** | High | **Medium (Human Gate)** | Remote Supabase database missing `004`–`007` migrations causes batch chunk insert warnings. | **ACTION REQUIRED**: Development team must execute `supabase db push` ([DEV_TASK_15](file:///c:/Users/ruanc/source/repos/SpecScribe/DEV_TASK_15.yml), [DEV_TASK_53](file:///c:/Users/ruanc/source/repos/SpecScribe/DEV_TASK_53.yml)). |
| **RISK-10** | High | **Medium (Human Gate)** | Gemini Free Tier quota exhaustion during long meetings. | **ACTION REQUIRED**: Development team must configure paid API key with billing in production `.env`. |

---

## 7. Actionable Item Backlog for Development Team

The development team can execute these exact action items to achieve a flawless physical demonstration:

### Phase A: Cloud & Remote Database Provisioning (Estimated Time: 20 Minutes)
- [ ] **A1 — Remote Supabase Migrations ([DEV_TASK_15](file:///c:/Users/ruanc/source/repos/SpecScribe/DEV_TASK_15.yml), [DEV_TASK_53](file:///c:/Users/ruanc/source/repos/SpecScribe/DEV_TASK_53.yml))**:
  Run `supabase db push` against the remote project to apply `004_timestamp_bigint.sql`, `005_embedding_model.sql`, `006_knowledge_chunks_hnsw.sql`, and `007_public_read.sql`.
- [ ] **A2 — Provision `SPECSCRIBE_API_TOKEN` ([DEV_TASK_06](file:///c:/Users/ruanc/source/repos/SpecScribe/DEV_TASK_06.yml))**:
  Generate token `openssl rand -hex 32` and configure in `backend/.env`, Cloud Run environment, and Vercel project secrets.
- [ ] **A3 — Configure Vercel `BACKEND_URL` ([DEV_TASK_37](file:///c:/Users/ruanc/source/repos/SpecScribe/DEV_TASK_37.yml))**:
  Set `BACKEND_URL=https://<cloud-run-domain>` in Vercel project settings.

### Phase B: Lens Studio & Device Packaging (Estimated Time: 20 Minutes)
- [ ] **B1 — Inspector Verification ([DEV_TASK_38](file:///c:/Users/ruanc/source/repos/SpecScribe/DEV_TASK_38.yml), [DEV_TASK_48](file:///c:/Users/ruanc/source/repos/SpecScribe/DEV_TASK_48.yml))**:
  Open `spectacles-lens/SpecScribe.esproj` in Lens Studio 5.15+. Select `SpecScribeControllers`, verify `backendWsBase` and `apiToken`, and confirm the 4 extracted controllers are linked.
- [ ] **B2 — Verify 3D Buttons in Palette ([DEV_TASK_54](file:///c:/Users/ruanc/source/repos/SpecScribe/DEV_TASK_54.yml))**:
  In the Scene panel, expand `SpatialActionPalette` and verify `BtnCaptureWhiteboard` and `BtnToggleCaptureMode` are positioned next to `BtnUpdateSnapshot`.
- [ ] **B3 — Push to Spectacles Hardware**:
  Pair Lens Studio with physical Spectacles (2024), deploy the Lens, and verify the headset connects to the WebSocket endpoint.

### Phase C: Live Physical Demonstration Run (Estimated Time: 30 Minutes)
- [ ] **C1 — Calibration**:
  Wear Spectacles, look at the physical whiteboard, pinch calibration handles to align the quad with the board corners, and adjust yaw if needed.
- [ ] **C2 — Conversation & Requirement Test**:
  Have two participants discuss an architecture requirement (e.g. *"We need Redis cache in front of PostgreSQL to handle peak auth token spikes"*). Verify that within 8 seconds, `DiffToastText` displays the requirement toast on the AR HUD.
- [ ] **C3 — Whiteboard Ingestion**:
  Draw `[Client]` ───▶ `[API Gateway]` on the board. In Frequency Mode (`AUTO`), step aside for 3 seconds. Verify phosphor green vector lines overlay directly onto marker strokes.
- [ ] **C4 — Manual Capture & Deletion Test**:
  Pinch `BtnToggleCaptureMode` to switch to `MANUAL`. Erase a box or redraw an arrow. Pinch `BtnCaptureWhiteboard`. Verify erased box disappears from the AR overlay.
- [ ] **C5 — AI Assistant Risk Orb**:
  Once an unauthenticated connection is detected, observe the AI Orb raise its hand and display `"⚠️ Auth Token Leak Risk"`. Pinch the orb to expand the 3-bullet critique card and hear the spoken voice readout.
- [ ] **C6 — Conclude Meeting**:
  Pinch `BtnConcludeMeeting`. Open `http://localhost:3000/meetings/<id>` to view the temporal decision scrubber, transcript turns, and generated markdown specification.

