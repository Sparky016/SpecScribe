# SpecScribe AR — MVP Readiness & Technical Audit Report (`MVP_READY.md`)

**Audit Date:** 2026-10-29  
**Repository:** `SpecScribe` (`spectacles-lens/`, `backend/`, `web-dashboard/`, `supabase/`, `shared/`)  
**Target Hardware:** Snap Spectacles (2024 / SPECS 27 OS, Lens Studio 5.15+, SIK)  

---

## Executive Summary & Verdict

SpecScribe AR has a **strong, well-tested core architecture** (98/98 Spectacles Lens unit tests passing across 21 suites; 123 offline backend `pytest` unit tests passing; clean Next.js 15 TypeScript build). The WebSocket envelope router, `drawio-mcp` Sugiyama layout engine, pre-warmed headless Playwright Draw.io PNG renderer (`<140ms`), optical waveguide palette (`#00FF66` / `#00E5FF` on transparent background), and 3-state Raising-Hand AI Assistant orb are all implemented in code.

However, **against the four promised MVP pillars, the application is currently NOT ready for an unscripted live meeting on physical Spectacles hardware without completing 8 targeted engineering tasks ([DEV_TASK_54.yml](file:///c:/Users/ruanc/source/repos/SpecScribe/DEV_TASK_54.yml)–[DEV_TASK_61.yml](file:///c:/Users/ruanc/source/repos/SpecScribe/DEV_TASK_61.yml)) and resolving the remaining human deployment/scene-wiring steps ([DEV_TASK_06.yml](file:///c:/Users/ruanc/source/repos/SpecScribe/DEV_TASK_06.yml), [DEV_TASK_15.yml](file:///c:/Users/ruanc/source/repos/SpecScribe/DEV_TASK_15.yml), [DEV_TASK_34.yml](file:///c:/Users/ruanc/source/repos/SpecScribe/DEV_TASK_34.yml), [DEV_TASK_37.yml](file:///c:/Users/ruanc/source/repos/SpecScribe/DEV_TASK_37.yml), [DEV_TASK_38.yml](file:///c:/Users/ruanc/source/repos/SpecScribe/DEV_TASK_38.yml), [DEV_TASK_48.yml](file:///c:/Users/ruanc/source/repos/SpecScribe/DEV_TASK_48.yml), [DEV_TASK_53.yml](file:///c:/Users/ruanc/source/repos/SpecScribe/DEV_TASK_53.yml)).**

### MVP Pillar Readiness Matrix

| # | Promised MVP Requirement | Current Status | Summary of Reality in Codebase | Actionable YAML Tasks |
| :- | :--- | :---: | :--- | :--- |
| **1** | **Attend a meeting, listen to each person's conversation, transcribe it, and reason through requirements as they speak** | **PARTIAL (Blocked by 2 High Gaps)** | Live ASR transcription streams via `LensStudio:AsrModule` (`AsrMode.HighSpeed`), and `RaisingHandAgent` polls every 20s for risks. **However:** (a) every speaker is hardcoded to `'Speaker 0 (Wearer)'` (zero speaker diarization despite `deepgram-sdk` being installed), and (b) `AsrHandler` only logs raw text—no requirement reasoning runs as people speak unless a whiteboard frame changes at the same time. | [DEV_TASK_57.yml](file:///c:/Users/ruanc/source/repos/SpecScribe/DEV_TASK_57.yml), [DEV_TASK_58.yml](file:///c:/Users/ruanc/source/repos/SpecScribe/DEV_TASK_58.yml) |
| **2** | **AI Assistant warns user of potential risks via a hand raise; user pinches the orb to learn the concern** | **DELIVERED (With 2 Polish/Safety Gaps)** | `RaisingHandAgent` proactively detects architectural contradictions/risks against RAG + transcript + XML and sends `HAND_RAISED`. The orb pulses at 1.15m optical depth, plays a chime, shows a pill badge ($\le 28$ chars), and pinching `AgentOrbMesh` toggles the 3-bullet `ExpandedCritiqueCard` (or triggers `ASK_AGENT` research in `IDLE`). **Concern:** `AgentVoicePlayer` only plays a static chime (no TTS spoken voice readout), and `\p{Extended_Pictographic}` regex lacks a runtime fallback. | [DEV_TASK_60.yml](file:///c:/Users/ruanc/source/repos/SpecScribe/DEV_TASK_60.yml) |
| **3** | **Whiteboard flow diagrams captured via Vision Model in Frequency mode (every 3s) OR Manual mode (pinch Capture button)** | **BLOCKED IN SCENE (3 Critical/High Gaps)** | `PeriodicCameraCapturer.ts` and `WhiteboardCaptureSwitch.ts` implement `AUTO` (`3.0s`) and `MANUAL` modes in TypeScript. **However:** (a) `BtnCaptureWhiteboard` and `BtnToggleCaptureMode` **do not exist** in [Scene.scene](file:///c:/Users/ruanc/source/repos/SpecScribe/spectacles-lens/Assets/Scene.scene) or [.virtual-scene.json](file:///c:/Users/ruanc/source/repos/SpecScribe/spectacles-lens/.virtual-scene.json), so the wearer cannot switch modes or pinch a Capture button; (b) `PeriodicCameraCapturer` checks `simulatedTexture` (`DemoVideo.mp4`) **before** `CameraModule`, hijacking live hardware capture; and (c) the backend's 5.0s vision cooldown (`_last_vision_time`) resets even on static frames and drops alternate 3.0s ticks and manual captures. | [DEV_TASK_54.yml](file:///c:/Users/ruanc/source/repos/SpecScribe/DEV_TASK_54.yml), [DEV_TASK_55.yml](file:///c:/Users/ruanc/source/repos/SpecScribe/DEV_TASK_55.yml), [DEV_TASK_56.yml](file:///c:/Users/ruanc/source/repos/SpecScribe/DEV_TASK_56.yml) |
| **4** | **Vision $\rightarrow$ Reasoning Model $\rightarrow$ MCP (`drawio-mcp`) $\rightarrow$ AR Glasses Overlay onto physical real-world whiteboard** | **PARTIAL (2 High/Medium Gaps)** | `extract_graph_delta_from_gemini` extracts nodes/edges via Gemini structured outputs, builds the graph via `drawio-mcp` (`relayout_diagram`), renders a transparent waveguide PNG via Playwright, and streams `DIAGRAM_UPDATED` (`image_b64`) to `DiagramOverlayView.ts`. **However:** (a) `GraphDeltaSchema` is strictly additive (`added_vertices`/`added_edges` only)—erased boxes or redrawn arrows on the physical whiteboard can never be deleted or renamed; and (b) [Scene.scene](file:///c:/Users/ruanc/source/repos/SpecScribe/spectacles-lens/Assets/Scene.scene#L267) defaults `isPhysicalHardware: false` (rendering an opaque virtual board blocking the physical board) and `WhiteboardCalibrator` lacks Z-depth and yaw rotation alignment. | [DEV_TASK_59.yml](file:///c:/Users/ruanc/source/repos/SpecScribe/DEV_TASK_59.yml), [DEV_TASK_61.yml](file:///c:/Users/ruanc/source/repos/SpecScribe/DEV_TASK_61.yml) |

---

## 1. Points We Have Hit (Delivered & Verified Capabilities)

### 1.1 Real-Time Speech Capture & Persistent WebSocket Transport
- **High-Speed On-Device ASR Streaming**: [`PersistentStreamSocketClient.initializeAsrStream`](file:///c:/Users/ruanc/source/repos/SpecScribe/spectacles-lens/Assets/Scripts/PersistentStreamSocketClient.ts#L247-L275) configures `LensStudio:AsrModule` with `AsrMode.HighSpeed` and `silenceUntilTerminationMs = 1000`, streaming final transcriptions (`eventType: 'asrTranscription'`) over WebSocket to [`AsrHandler.handle`](file:///c:/Users/ruanc/source/repos/SpecScribe/backend/envelope_router.py#L98-L133).
- **Resilient WebSocket Lifecycle & Redaction**: [`PersistentStreamSocketClient.ts`](file:///c:/Users/ruanc/source/repos/SpecScribe/spectacles-lens/Assets/Scripts/PersistentStreamSocketClient.ts#L118-L216) implements URL assembly from `backendWsBase` + `meetingId` + `?token=`, automatic exponential/fixed reconnect (`reconnectIntervalSeconds = 2.0`), socket retirement guards against duplicate handlers, and [`redactSecrets`](file:///c:/Users/ruanc/source/repos/SpecScribe/spectacles-lens/Assets/Scripts/PersistentStreamSocketClient.ts#L57-L61) so bearer tokens never leak into Lens Studio logs.
- **Last-Utterance Voice Tagging for Manual Nodes**: [`PersistentStreamSocketClient.consumeLatestFinalUtterance`](file:///c:/Users/ruanc/source/repos/SpecScribe/spectacles-lens/Assets/Scripts/PersistentStreamSocketClient.ts#L282-L290) implements a consume-once cache of the wearer's latest final spoken phrase so pinching a node button (`ADD_SERVICE`, `ADD_DATABASE`, `ADD_TERMINAL`, `ADD_DECISION`) automatically labels the node with what the user just said.

### 1.2 Raising-Hand AI Assistant Orb (Proactive Risk Detection & Pinch Interaction)
- **3-State Machine & Lazy-Follow Ergonomics**: [`RaisingHandAgentController.ts`](file:///c:/Users/ruanc/source/repos/SpecScribe/spectacles-lens/Assets/Scripts/RaisingHandAgentController.ts#L156-L246) cleanly manages `AgentState.IDLE`, `AgentState.RESEARCHING` (with a 30-second timeout fallback), and `AgentState.HAND_RAISED`. Its [`updateLazyFollow`](file:///c:/Users/ruanc/source/repos/SpecScribe/spectacles-lens/Assets/Scripts/RaisingHandAgentController.ts#L334-L370) method detaches the orb into world space and smoothly lerps toward the camera target at `cameraAnchorOffset = vec3(26, 15, -115)` (`1.15m` depth, satisfying Spectacles vergence-accommodation comfort rules).
- **Proactive 20-Second Risk Loop + RAG Grounding**: [`RaisingHandAgent.start_proactive_loop`](file:///c:/Users/ruanc/source/repos/SpecScribe/backend/agents/raising_hand_agent.py#L140-L157) runs every 20 seconds per active meeting, combining the last 60 seconds of transcript turns, the current Draw.io XML, and top-3 pgvector RAG chunks (`match_knowledge_chunks` with cosine similarity $\ge 0.72$ and 120s topic cooldown) to evaluate architectural risks via [`RiskCritiqueSchema`](file:///c:/Users/ruanc/source/repos/SpecScribe/backend/agents/raising_hand_agent.py#L28-L41).
- **Pinch-to-Expand & Pinch-to-Ask**: Pinching `AgentOrbMesh` (bound inside `OnStartEvent` with a `400ms` debounce in [`bindSikInteractable`](file:///c:/Users/ruanc/source/repos/SpecScribe/spectacles-lens/Assets/Scripts/RaisingHandAgentController.ts#L186-L216)) expands the 3-bullet `ExpandedCritiqueCard` when `HAND_RAISED`, or sends an `ASK_AGENT` envelope (`pull_research_critique_async`) when `IDLE`.

### 1.3 Vision $\rightarrow$ Gemini Structured Delta $\rightarrow$ `drawio-mcp` $\rightarrow$ Waveguide Overlay
- **Two-Stage Cost Gate (Perceptual Hash)**: [`LiveGraphSession.check_image_diff`](file:///c:/Users/ruanc/source/repos/SpecScribe/backend/graph_engine.py#L312-L343) computes an $8\times 8$ grayscale perceptual hash (`<5ms` CPU) and skips Gemini Vision calls when the whiteboard frame has not changed ($\le 3$ bits difference).
- **Occlusion Guard**: [`GraphDeltaSchema.person_occluding_board`](file:///c:/Users/ruanc/source/repos/SpecScribe/backend/graph_engine.py#L70-L71) and [`CameraFrameHandler.handle`](file:///c:/Users/ruanc/source/repos/SpecScribe/backend/envelope_router.py#L176-L185) detect when a participant is standing in front of the whiteboard, preserving the last clean AR overlay and displaying `"Speaker occluding board — holding last clean overlay"` on the AR HUD.
- **Programmatic `drawio-mcp` Graph Construction & Layout**: [`LiveGraphSession`](file:///c:/Users/ruanc/source/repos/SpecScribe/backend/graph_engine.py#L121-L310) uses `drawio_mcp` (`DrawioFile`, `Diagram`, `relayout_diagram`, `LayoutEngineConfig`) to construct vertices and orthogonal edges styled with the shared [`node_registry.json`](file:///c:/Users/ruanc/source/repos/SpecScribe/shared/node_registry.json) waveguide palette (`#00FF66` neon green, `#00E5FF` electric cyan, `#FFB300` amber, `#EA4335` crimson, `strokeWidth=3`, `fontSize=16`).
- **Pre-Warmed Headless Playwright Renderer**: [`HeadlessDrawioDaemon`](file:///c:/Users/ruanc/source/repos/SpecScribe/backend/graph_engine.py#L346-L473) keeps a local Chromium instance warmed on `viewer.diagrams.net/export3.html` and exports transparent RGBA PNGs (`bg=none`), which are streamed via `DIAGRAM_UPDATED` (`image_b64`) and decoded onto `WhiteboardOverlayAnchor` by [`DiagramOverlayView.applyBase64OverlayTexture`](file:///c:/Users/ruanc/source/repos/SpecScribe/spectacles-lens/Assets/Scripts/DiagramOverlayView.ts#L78-L115).

### 1.4 Modular Codebase & Automated Test Coverage
- **Controller Decomposition**: `SpatialInterfaceManager.ts` was refactored from a 937-line monolith into focused controllers: [`SpatialInterfaceManager.ts`](file:///c:/Users/ruanc/source/repos/SpecScribe/spectacles-lens/Assets/Scripts/SpatialInterfaceManager.ts) (299 lines), [`PaletteController.ts`](file:///c:/Users/ruanc/source/repos/SpecScribe/spectacles-lens/Assets/Scripts/PaletteController.ts) (248 lines), [`DiagramOverlayView.ts`](file:///c:/Users/ruanc/source/repos/SpecScribe/spectacles-lens/Assets/Scripts/DiagramOverlayView.ts) (230 lines), [`WhiteboardCalibrator.ts`](file:///c:/Users/ruanc/source/repos/SpecScribe/spectacles-lens/Assets/Scripts/WhiteboardCalibrator.ts) (163 lines), [`PreviewInputAdapter.ts`](file:///c:/Users/ruanc/source/repos/SpecScribe/spectacles-lens/Assets/Scripts/PreviewInputAdapter.ts) (167 lines), and [`WhiteboardCaptureSwitch.ts`](file:///c:/Users/ruanc/source/repos/SpecScribe/spectacles-lens/Assets/Scripts/WhiteboardCaptureSwitch.ts) (76 lines).
- **Backend Envelope Router Split**: [`backend/envelope_router.py`](file:///c:/Users/ruanc/source/repos/SpecScribe/backend/envelope_router.py) cleanly separates `AsrHandler`, `CameraFrameHandler`, `PinchCommandHandler`, `AskAgentHandler`, and `CalibrationHandler` behind a Pydantic `Envelope` dispatcher.

---

## 2. Critical MVP Gaps & Concerns (Detailed Findings & YAML Remedies)

Each gap below represents a discrepancy between the **Main Requirements for MVP** and the current implementation, paired with a dedicated YAML instruction file in the repository root.

---

### `#GAP-1` (HIGH): No Multi-Speaker Diarization ("listen to each person's conversation")
- **Actionable Task File**: [DEV_TASK_57.yml](file:///c:/Users/ruanc/source/repos/SpecScribe/DEV_TASK_57.yml)
- **Where in Code**:
  - [`PersistentStreamSocketClient.ts:263`](file:///c:/Users/ruanc/source/repos/SpecScribe/spectacles-lens/Assets/Scripts/PersistentStreamSocketClient.ts#L263):
    ```typescript
    this.send({
      eventType: 'asrTranscription',
      payload: {
        text: cleanText,
        speaker_label: 'Speaker 0 (Wearer)',
        timestamp_ms: Date.now()
      }
    });
    ```
  - [`backend/envelope_router.py:100`](file:///c:/Users/ruanc/source/repos/SpecScribe/backend/envelope_router.py#L100): `speaker = payload.get("speaker_label", "Speaker 0")`.
- **Technical Root Cause**:
  - Snap's on-device `LensStudio:AsrModule` emits plain text transcriptions without speaker IDs.
  - Although `deepgram-sdk==7.13.0` is pinned in [`backend/requirements.lock`](file:///c:/Users/ruanc/source/repos/SpecScribe/backend/requirements.lock) and `DEEPGRAM_API_KEY` is provisioned in [`.github/workflows/deploy.yml`](file:///c:/Users/ruanc/source/repos/SpecScribe/.github/workflows/deploy.yml), **no module in `backend/` imports or invokes Deepgram**. During [DEV_TASK_39.yml](file:///c:/Users/ruanc/source/repos/SpecScribe/DEV_TASK_39.yml), the human gate decision on `2026-10-27` was to *"IMPLEMENT diarization as a follow-up task"*, which remained uncreated until now.
- **Impact on MVP**:
  - Every spoken sentence in a live multi-person meeting is attributed to `"Speaker 0 (Wearer)"`. Neither [`DecisionLinkerAgent`](file:///c:/Users/ruanc/source/repos/SpecScribe/backend/agents/decision_linker.py) nor the Web Dashboard (`TopBar` / `TranscriptPanel`) can distinguish which participant proposed a requirement.
- **How to Fix ([DEV_TASK_57.yml](file:///c:/Users/ruanc/source/repos/SpecScribe/DEV_TASK_57.yml))**:
  - Implement `backend/services/diarization.py` supporting both Deepgram Nova-2 (`diarize=True`) for audio chunks and a pause-gap (`silenceGapMs`) + conversational turn-handoff classifier when operating over `AsrModule` text envelopes.

---

### `#GAP-2` (CRITICAL): No Continuous Speech-Driven Requirement Reasoning ("as they speak it should reason through what is being said to try and make sense of the requirements")
- **Actionable Task File**: [DEV_TASK_58.yml](file:///c:/Users/ruanc/source/repos/SpecScribe/DEV_TASK_58.yml)
- **Where in Code**:
  - [`backend/envelope_router.py:95-133`](file:///c:/Users/ruanc/source/repos/SpecScribe/backend/envelope_router.py#L95-L133) (`AsrHandler.handle`)
  - [`backend/agents/decision_linker.py:140-238`](file:///c:/Users/ruanc/source/repos/SpecScribe/backend/agents/decision_linker.py#L140-L238) (`DecisionLinkerAgent.process_snapshot`)
  - [`backend/agents/raising_hand_agent.py:78-86`](file:///c:/Users/ruanc/source/repos/SpecScribe/backend/agents/raising_hand_agent.py#L78-L86) (`RaisingHandAgent._get_recent_context`)
- **Technical Root Cause**:
  - `AsrHandler.handle()` appends the turn to `memory_store["transcript_turns"]`, writes a row to Supabase `transcript_turns`, broadcasts `TRANSCRIPT_LOGGED`, and **immediately returns**.
  - `DecisionLinkerAgent` is **only** invoked inside `CameraFrameHandler` (when a whiteboard visual diff occurs) and `PinchCommandHandler` (when a 3D button is pinched).
  - If meeting participants spend 10 minutes verbally debating functional or non-functional requirements before anyone draws on the whiteboard, **zero requirement synthesis occurs**, zero `DECISION`/`REQUIREMENT` chunks are saved to `knowledge_chunks`, and the wearer's HUD shows nothing.
  - Additionally, `RaisingHandAgent._get_recent_context()` only reads from in-memory `self.memory_store["transcript_turns"]` and lacks the Supabase fallback that `DecisionLinkerAgent._get_recent_transcripts()` has.
- **How to Fix ([DEV_TASK_58.yml](file:///c:/Users/ruanc/source/repos/SpecScribe/DEV_TASK_58.yml))**:
  - Add `DecisionLinkerAgent.process_transcript_window(meeting_id, turns, current_xml)` and trigger it on a debounced sliding window inside `AsrHandler.handle()` (e.g., after $\ge 2$ substantive utterances and $\ge 8\text{s}$ since last synthesis), broadcasting `REQUIREMENT_SYNTHESIZED` / `DECISION_LOGGED` to both the AR glasses HUD (`DiffToastText`) and the Web Dashboard.

---

### `#GAP-3` & `#GAP-4` (MEDIUM): AI Assistant Orb Plays Only a Static Chime (`AgentVoicePlayer`) & Unprotected Unicode Regex
- **Actionable Task File**: [DEV_TASK_60.yml](file:///c:/Users/ruanc/source/repos/SpecScribe/DEV_TASK_60.yml)
- **Where in Code**:
  - [`RaisingHandAgentController.ts:225-234`](file:///c:/Users/ruanc/source/repos/SpecScribe/spectacles-lens/Assets/Scripts/RaisingHandAgentController.ts#L225-L234) (`handleOrbPinched`)
  - [`RaisingHandAgentController.ts:501`](file:///c:/Users/ruanc/source/repos/SpecScribe/spectacles-lens/Assets/Scripts/RaisingHandAgentController.ts#L501) (`formatPillText`)
- **Technical Root Cause**:
  - Although the scene object is named `AgentVoicePlayer` and [`DEV_TEST_STEPS.md:166`](file:///c:/Users/ruanc/source/repos/SpecScribe/DEV_TEST_STEPS.md#L166) states *"Low-latency voice feedback or audio chime plays via AgentVoicePlayer"*, pinching the orb in `HAND_RAISED` state only calls `this.playNotificationSound()`, which replays `AgentNotificationChime.wav` (`Audio.PlaybackMode.LowLatency`) while toggling `ExpandedCritiqueCard`. There is no TTS spoken voice readout of the concern.
  - Line 501 uses a literal regex `/^(\p{Extended_Pictographic}️?\s*)+/u`. As flagged in [`DEV_TASK_LIST.md:243`](file:///c:/Users/ruanc/source/repos/SpecScribe/DEV_TASK_LIST.md#L243), if the Spectacles embedded JS runtime does not support ES2018 Unicode property escapes `\p{Extended_Pictographic}`, parsing or executing `RaisingHandAgentController.ts` will throw a `SyntaxError`.
- **How to Fix ([DEV_TASK_60.yml](file:///c:/Users/ruanc/source/repos/SpecScribe/DEV_TASK_60.yml))**:
  - Wrap `new RegExp('^(\\p{Extended_Pictographic}\\uFE0F?\\s*)+', 'u')` in a `try/catch` with a surrogate-pair fallback `/^([\uD800-\uDBFF][\uDC00-\uDFFF]|\u26A0\uFE0F?|\s)+/`.
  - Add optional TTS voice synthesis playback on `AgentVoicePlayer` when the orb is pinched in `HAND_RAISED` state, with instant fallback to the notification chime.

---

### `#GAP-5` (CRITICAL): `BtnCaptureWhiteboard` and `BtnToggleCaptureMode` Do Not Exist in `Scene.scene` or `.virtual-scene.json`
- **Actionable Task File**: [DEV_TASK_54.yml](file:///c:/Users/ruanc/source/repos/SpecScribe/DEV_TASK_54.yml)
- **Where in Code**:
  - [`PaletteController.ts:34-35`](file:///c:/Users/ruanc/source/repos/SpecScribe/spectacles-lens/Assets/Scripts/PaletteController.ts#L34-L35) & [`PaletteController.ts:181-186`](file:///c:/Users/ruanc/source/repos/SpecScribe/spectacles-lens/Assets/Scripts/PaletteController.ts#L181-L186)
  - [`SpatialInterfaceManager.ts:42-48`](file:///c:/Users/ruanc/source/repos/SpecScribe/spectacles-lens/Assets/Scripts/SpatialInterfaceManager.ts#L42-L48)
  - [`spectacles-lens/Assets/Scene.scene`](file:///c:/Users/ruanc/source/repos/SpecScribe/spectacles-lens/Assets/Scene.scene) & [`spectacles-lens/.virtual-scene.json`](file:///c:/Users/ruanc/source/repos/SpecScribe/spectacles-lens/.virtual-scene.json)
- **Technical Root Cause**:
  - `PaletteController.ts` attempts to bind two SIK buttons for the whiteboard capture modes:
    ```typescript
    const captureWb = this.btnCaptureWhiteboard || this.findInteractable(root, 'BtnCaptureWhiteboard');
    if (captureWb) this.bindSikButton(captureWb, () => this.onCaptureWhiteboard?.());

    const toggleMode = this.btnToggleCaptureMode || this.findInteractable(root, 'BtnToggleCaptureMode');
    if (toggleMode) this.bindSikButton(toggleMode, () => this.onToggleCaptureMode?.());
    ```
  - However, neither `BtnCaptureWhiteboard` nor `BtnToggleCaptureMode` exists anywhere in `Scene.scene` or `.virtual-scene.json` (only the original 6 buttons `BtnAddDecision`, `BtnAddService`, `BtnAddDatabase`, `BtnAddTerminal`, `BtnUpdateSnapshot`, and `BtnConcludeMeeting` exist in the scene).
  - Furthermore, `SpatialInterfaceManager.ts` does not expose `@input btnCaptureWhiteboard` or `@input btnToggleCaptureMode` in `LegacyPaletteInputs`.
- **Impact on MVP**:
  - At runtime in Lens Studio / Spectacles hardware, `findInteractable('BtnCaptureWhiteboard')` and `findInteractable('BtnToggleCaptureMode')` log `"Object not found in scene hierarchy"` and return `undefined`.
  - **The user has no way to toggle between Frequency Mode (`AUTO`, 3s) and Manual Mode (`MANUAL`), and no Capture button to pinch!**
- **How to Fix ([DEV_TASK_54.yml](file:///c:/Users/ruanc/source/repos/SpecScribe/DEV_TASK_54.yml))**:
  - Add `BtnCaptureWhiteboard` and `BtnToggleCaptureMode` SceneObjects with SIK `Interactable` + `ColliderComponent` under `SpatialActionPalette` in `Scene.scene` and `.virtual-scene.json`, wire legacy `@input` fallbacks on `SpatialInterfaceManager.ts`, and display a HUD toast (`"Capture Mode: AUTO (Every 3s)"` / `"Capture Mode: MANUAL (Pinch to Capture)"`) when toggled.

---

### `#GAP-6` (HIGH): `PeriodicCameraCapturer` Prioritizes `simulatedTexture` (`DemoVideo.mp4`) Over Live `CameraModule`
- **Actionable Task File**: [DEV_TASK_55.yml](file:///c:/Users/ruanc/source/repos/SpecScribe/DEV_TASK_55.yml)
- **Where in Code**:
  - [`PeriodicCameraCapturer.ts:54-89`](file:///c:/Users/ruanc/source/repos/SpecScribe/spectacles-lens/Assets/Scripts/PeriodicCameraCapturer.ts#L54-L89)
  - [`spectacles-lens/Assets/Scene.scene:201`](file:///c:/Users/ruanc/source/repos/SpecScribe/spectacles-lens/Assets/Scene.scene#L201) (`simulatedTexture: <reference.Texture> 69b2b12f-15b1-44d5-9ca3-1da4b29caef0`)
  - [`spectacles-lens/Assets/Scene.scene:311`](file:///c:/Users/ruanc/source/repos/SpecScribe/spectacles-lens/Assets/Scene.scene#L311) (`simulatedSpeechPhrase: Payment Gateway Microservice`)
- **Technical Root Cause**:
  - In `PeriodicCameraCapturer.setupCameraPipeline()`, lines 65–68 check `if (this.simulatedTexture)` **before** attempting `require('LensStudio:CameraModule')`, and return early!
  - Because `Scene.scene:201` has `simulatedTexture` bound to `DemoVideo.mp4` (`69b2b12f-15b1-44d5-9ca3-1da4b29caef0`), `PeriodicCameraCapturer` **never requests the hardware camera (`CameraModule`)** even on physical Spectacles glasses—it continuously encodes frames from the pre-recorded `DemoVideo.mp4` instead of the real meeting room whiteboard!
- **How to Fix ([DEV_TASK_55.yml](file:///c:/Users/ruanc/source/repos/SpecScribe/DEV_TASK_55.yml))**:
  - Gate `simulatedTexture` preference behind `@input demoMode: boolean = false`. When `demoMode === false`, always try `LensStudio:CameraModule` first and only fall back to `simulatedTexture` if `CameraModule.requestCamera` throws (e.g. in headless desktop preview). Also clear the stale `simulatedSpeechPhrase: Payment Gateway Microservice` in `Scene.scene`.

---

### `#GAP-7` (HIGH): Backend 5-Second Vision Cooldown (`_last_vision_time < 5.0`) Breaks 3-Second Frequency Mode & Manual Capture
- **Actionable Task File**: [DEV_TASK_56.yml](file:///c:/Users/ruanc/source/repos/SpecScribe/DEV_TASK_56.yml)
- **Where in Code**:
  - [`backend/envelope_router.py:157-170`](file:///c:/Users/ruanc/source/repos/SpecScribe/backend/envelope_router.py#L157-L170):
    ```python
    now = time.time()
    if now - getattr(session, "_last_vision_time", 0) < 5.0:
        logger.debug("Vision analysis cooldown active; skipping frame.")
        return

    raw_bytes = await asyncio.to_thread(base64.b64decode, frame_b64)
    session._last_vision_time = now

    has_diff = await asyncio.to_thread(session.check_image_diff, raw_bytes)
    if not has_diff:
        return
    ```
- **Technical Root Cause**:
  1. `session._last_vision_time = now` is set **before** `session.check_image_diff(raw_bytes)`! Even when a frame is completely static (`has_diff == False`, costing 0 Gemini calls), `_last_vision_time` is still reset to `now`.
  2. The Lens in Frequency Mode (`AUTO`) sends a snapshot every **3.0 seconds** (`sampleIntervalSeconds = 3.0`), while the backend rejects any frame arriving within **5.0 seconds** of `_last_vision_time`.
  3. Consequently:
     - Tick 1 at $t = 0.0\text{s}$ (board unchanged) sets `_last_vision_time = 0.0` and returns on `not has_diff`.
     - Tick 2 at $t = 3.0\text{s}$ (user just drew a diagram or pinched Manual Capture!) is **silently dropped** because $3.0 - 0.0 < 5.0$!
     - In `AUTO` mode, every second 3-second snapshot ($t = 3\text{s}, 9\text{s}, 15\text{s}$) is dropped, degrading the promised 3-second frequency mode into a 6-second mode.
     - In `MANUAL` mode, pinching Capture within 5 seconds of any prior frame is silently ignored.
- **How to Fix ([DEV_TASK_56.yml](file:///c:/Users/ruanc/source/repos/SpecScribe/DEV_TASK_56.yml))**:
  - Move `session._last_vision_time = now` to **after** `check_image_diff(raw_bytes)` returns `True`.
  - Reduce the `AUTO` cooldown from `5.0s` to `2.5s` so a `3.0s` periodic timer is never self-throttled.
  - Include `isManual: true` / `captureMode` in the `cameraFrame` envelope from `PeriodicCameraCapturer.triggerManualCapture()` and bypass the cooldown on manual captures.

---

### `#GAP-8` (HIGH): Vision Pipeline is Additive-Only — Cannot Delete, Rename, or Rewire Erased Whiteboard Diagrams
- **Actionable Task File**: [DEV_TASK_59.yml](file:///c:/Users/ruanc/source/repos/SpecScribe/DEV_TASK_59.yml)
- **Where in Code**:
  - [`backend/graph_engine.py:68-74`](file:///c:/Users/ruanc/source/repos/SpecScribe/backend/graph_engine.py#L68-L74) (`GraphDeltaSchema`)
  - [`backend/graph_engine.py:216-247`](file:///c:/Users/ruanc/source/repos/SpecScribe/backend/graph_engine.py#L216-L247) (`LiveGraphSession.apply_delta`)
  - [`backend/graph_engine.py:510-515`](file:///c:/Users/ruanc/source/repos/SpecScribe/backend/graph_engine.py#L510-L515) (`extract_graph_delta_from_gemini` prompt)
- **Technical Root Cause**:
  - `GraphDeltaSchema` only defines `added_vertices` and `added_edges`.
  - During a real architectural whiteboard session, engineers frequently erase a box, rename a service, or erase an arrow to reroute data flow. Currently, erased shapes remain permanently in `self.diagram` and continue rendering in the AR overlay on top of the erased area of the physical whiteboard.
- **How to Fix ([DEV_TASK_59.yml](file:///c:/Users/ruanc/source/repos/SpecScribe/DEV_TASK_59.yml))**:
  - Extend `GraphDeltaSchema` with `removed_vertices`, `updated_vertices`, and `removed_edges` (guarded by `person_occluding_board == False`), pass existing edges into the Gemini prompt, and mutate `self.diagram.cells`, `self.label_to_id`, and `self.edge_set` in `LiveGraphSession.apply_delta()` before running `relayout_diagram`.

---

### `#GAP-9` (MEDIUM/HIGH): Physical Real-World Whiteboard Registration & Passthrough Defaults
- **Actionable Task File**: [DEV_TASK_61.yml](file:///c:/Users/ruanc/source/repos/SpecScribe/DEV_TASK_61.yml)
- **Where in Code**:
  - [`spectacles-lens/Assets/Scene.scene:267`](file:///c:/Users/ruanc/source/repos/SpecScribe/spectacles-lens/Assets/Scene.scene#L267) (`isPhysicalHardware: false`)
  - [`WhiteboardCalibrator.ts:62-120`](file:///c:/Users/ruanc/source/repos/SpecScribe/spectacles-lens/Assets/Scripts/WhiteboardCalibrator.ts#L62-L120) (`drag`, `setManipulationEnabled`)
- **Technical Root Cause**:
  1. `Scene.scene` serializes `isPhysicalHardware: false` on `SpatialInterfaceManager`. When deployed to Spectacles without toggling this flag, `WhiteboardBackplate` renders an opaque virtual whiteboard texture at `alpha = 1.0`, visually blocking the physical whiteboard in the meeting room.
  2. `WhiteboardCalibrator.drag(deltaY, deltaX)` only adjusts `X` and `Y` at a fixed depth `Z = -230cm` and fixed rotation `(90, 0, 0)`, and line 114 sets `enableRotation = false`. In a real conference room, the user rarely starts at an exact `2.30m` perpendicular normal to the physical whiteboard.
- **How to Fix ([DEV_TASK_61.yml](file:///c:/Users/ruanc/source/repos/SpecScribe/DEV_TASK_61.yml))**:
  - Add Z-depth (`deltaZ`, clamped to $\le -115\text{cm}$ for optical comfort) and Y-axis yaw rotation (`rotateYaw`) to `WhiteboardCalibrator.ts`, and provide a runtime passthrough mode helper so `WhiteboardBackplate` is transparent (`alpha = 0.0`) on physical Spectacles hardware while `WhiteboardOverlayAnchor` stays at `alpha = 0.92`.

---

## 3. Outstanding Changes from Prior Audit (`DEV_TASK_01` – `DEV_TASK_53`)

Of the 54 tasks in [`DEV_TASK_LIST.md`](file:///c:/Users/ruanc/source/repos/SpecScribe/DEV_TASK_LIST.md) (`01`–`53` + `02b`), **45 tasks are `DONE`**. The remaining **9 tasks** are `PENDING` or `BLOCKED` on human credentials, remote database access, or Lens Studio GUI actions:

| Task ID | Status | Severity | Summary & Exact Action Required by Development Team |
| :---: | :---: | :---: | :--- |
| [DEV_TASK_06.yml](file:///c:/Users/ruanc/source/repos/SpecScribe/DEV_TASK_06.yml) | `PENDING` (HUMAN) | Critical | **Provision `SPECSCRIBE_API_TOKEN`**: Generate a 32-byte token (`openssl rand -hex 32`) and set `SPECSCRIBE_API_TOKEN` across Cloud Run, GitHub Actions secrets, Vercel (`SPECSCRIBE_API_TOKEN`, server-only), and local `backend/.env` + `web-dashboard/.env.local`. |
| [DEV_TASK_09.yml](file:///c:/Users/ruanc/source/repos/SpecScribe/DEV_TASK_09.yml) | `PENDING` (HUMAN) | Critical | **Rotate Lens Studio MCP Token**: Regenerate the local MCP token in Lens Studio Preferences and purge the historical `.mcp.json` commit from git history (`git filter-repo`). |
| [DEV_TASK_15.yml](file:///c:/Users/ruanc/source/repos/SpecScribe/DEV_TASK_15.yml) | `PENDING` (HUMAN) | Critical | **Apply Supabase Migrations Remotely**: Run `supabase db push` (or SQL Editor) to drop any permissive anon write policies from `002` and apply [`004_timestamp_bigint.sql`](file:///c:/Users/ruanc/source/repos/SpecScribe/supabase/migrations/004_timestamp_bigint.sql), [`005_embedding_model.sql`](file:///c:/Users/ruanc/source/repos/SpecScribe/supabase/migrations/005_embedding_model.sql), and [`007_public_read.sql`](file:///c:/Users/ruanc/source/repos/SpecScribe/supabase/migrations/007_public_read.sql). |
| [DEV_TASK_34.yml](file:///c:/Users/ruanc/source/repos/SpecScribe/DEV_TASK_34.yml) | `BLOCKED` (HUMAN-STEP) | High | **Verify LEAF Scenarios in Lens Studio Preview**: Open project in Lens Studio, clear `simulatedSpeechPhrase` in `Scene.scene`, and run `SpecScribeDC6Scenario` $\rightarrow$ `SpecScribeDC3Scenario` and `DC3` $\rightarrow$ `DC6`. |
| [DEV_TASK_37.yml](file:///c:/Users/ruanc/source/repos/SpecScribe/DEV_TASK_37.yml) | `BLOCKED` (HUMAN-STEP) | High | **Set `BACKEND_URL` in Vercel**: Configure `BACKEND_URL` in Vercel project settings to point to the deployed Cloud Run backend URL so Next.js `/api/*` proxy routes connect in production. |
| [DEV_TASK_38.yml](file:///c:/Users/ruanc/source/repos/SpecScribe/DEV_TASK_38.yml) | `BLOCKED` (HUMAN-STEP) | High | **Configure Lens Inspector for Hardware Deployment**: Set `backendWsBase` (`wss://<cloud-run-host>/ws`) and `apiToken` on `PersistentStreamSocketClient` in the Lens Studio Inspector without committing the secret token. |
| [DEV_TASK_48.yml](file:///c:/Users/ruanc/source/repos/SpecScribe/DEV_TASK_48.yml) | `BLOCKED` (HUMAN-STEP) | Medium | **Wire Extracted Sub-Controllers in `Scene.scene`**: In [`Scene.scene:278-281`](file:///c:/Users/ruanc/source/repos/SpecScribe/spectacles-lens/Assets/Scene.scene#L278-L281), `calibrator`, `paletteController`, `overlayView`, and `previewInput` are currently `00000000-0000-0000-0000-000000000000` (relying on `SpatialInterfaceManager` runtime fallback). Attach the 4 script components on `SpecScribeControllers` in Lens Studio Inspector. |
| [DEV_TASK_51.yml](file:///c:/Users/ruanc/source/repos/SpecScribe/DEV_TASK_51.yml) | `BLOCKED` (HUMAN-STEP) | Low | **Triage `spectacles-lens/scripts/*` & Clean Working Tree Previews**: Mark KEEP/DELETE in [`spectacles-lens/tools/README.md`](file:///c:/Users/ruanc/source/repos/SpecScribe/spectacles-lens/tools/README.md) and delete the 23 untracked `preview_*.jpg` / `temp_*.jpg` files currently in the repo root. |
| [DEV_TASK_53.yml](file:///c:/Users/ruanc/source/repos/SpecScribe/DEV_TASK_53.yml) | `PENDING` (HUMAN-STEP) | Low | **Add HNSW Index Migration (`006_knowledge_chunks_hnsw.sql`)**: Unblocks once Task 15 applies `005_embedding_model.sql`; creates the pgvector `hnsw (embedding vector_cosine_ops)` index on `knowledge_chunks`. |

---

## 4. Architectural Advice, Optimizations & Risk Register

### 4.1 Advice & Performance Optimizations
1. **Per-Session Lock Around Vision + Layout Mutation (`backend/envelope_router.py`)**:
   - Currently, if a manual capture (`isManual=True`) or `PinchCommandHandler` (`ADD_SERVICE`) fires while `CameraFrameHandler` is mid-await on `extract_graph_delta_from_gemini`, both coroutines can concurrently mutate `session.diagram` and invoke `relayout_diagram`. Add an `asyncio.Lock` per `LiveGraphSession` around `apply_delta` + `render_Session_to_png_b64`.
2. **Playwright Render Concurrency Pool (`HeadlessDrawioDaemon`)**:
   - [`HeadlessDrawioDaemon`](file:///c:/Users/ruanc/source/repos/SpecScribe/backend/graph_engine.py#L346-L473) serializes all renders across all meetings through a single Chromium `Page` protected by `self._lock`. For a single-room MVP demo this is fast (`<140ms`), but for multi-room concurrency on Cloud Run, a 2–4 page tab pool will eliminate head-of-line blocking.
3. **Windows PowerShell Offline Test Gotcha (`backend/conftest.py`)**:
   - In Windows PowerShell, running `$env:GEMINI_API_KEY=""` **removes** the variable from the environment block, causing `load_dotenv()` in [`backend/main.py:25`](file:///c:/Users/ruanc/source/repos/SpecScribe/backend/main.py#L25) to reload real API keys from `backend/.env` and make live network calls during `pytest`.
   - **Recommendation**: In `backend/conftest.py`, set `os.environ["GEMINI_API_KEY"] = ""` (or mock `load_dotenv`) before importing `main` whenever `-m "not integration"` is active.
4. **Waveguide Contrast & Fill Opacity Verification**:
   - Keep all AR overlay fills at `fillColor=#001A0D` / `#001824` and outer background strictly `bg=none` (`alpha = 0.0`). On additive see-through Spectacles waveguides, white or light-gray fills cause severe eye fatigue and wash out the physical whiteboard marker strokes underneath.

### 4.2 Consolidated Risk Register

| Risk ID | Severity | Description | Mitigation |
| :--- | :---: | :--- | :--- |
| **RISK-01** | **Critical** | Physical hardware test uses `DemoVideo.mp4` instead of live camera because `simulatedTexture` is checked before `CameraModule` in [`PeriodicCameraCapturer.ts:65`](file:///c:/Users/ruanc/source/repos/SpecScribe/spectacles-lens/Assets/Scripts/PeriodicCameraCapturer.ts#L65). | Execute [DEV_TASK_55.yml](file:///c:/Users/ruanc/source/repos/SpecScribe/DEV_TASK_55.yml) before building the `.lens` package for Spectacles hardware. |
| **RISK-02** | **Critical** | Wearer cannot switch to Manual capture mode or pinch a Capture button because `BtnCaptureWhiteboard` and `BtnToggleCaptureMode` are missing from `Scene.scene`. | Execute [DEV_TASK_54.yml](file:///c:/Users/ruanc/source/repos/SpecScribe/DEV_TASK_54.yml) and verify button colliders in Lens Studio Preview. |
| **RISK-03** | **High** | Static camera frames reset `_last_vision_time`, causing the 5.0s cooldown in [`CameraFrameHandler`](file:///c:/Users/ruanc/source/repos/SpecScribe/backend/envelope_router.py#L159) to drop alternate 3.0s snapshots and manual captures. | Execute [DEV_TASK_56.yml](file:///c:/Users/ruanc/source/repos/SpecScribe/DEV_TASK_56.yml). |
| **RISK-04** | **High** | Verbal requirements discussed without simultaneous whiteboard drawing are never reasoned over or extracted into `knowledge_chunks`. | Execute [DEV_TASK_58.yml](file:///c:/Users/ruanc/source/repos/SpecScribe/DEV_TASK_58.yml). |
| **RISK-05** | **High** | All speakers are labeled `'Speaker 0 (Wearer)'`, preventing multi-person attribution in requirements and transcripts. | Execute [DEV_TASK_57.yml](file:///c:/Users/ruanc/source/repos/SpecScribe/DEV_TASK_57.yml). |
| **RISK-06** | **High** | Erased or redrawn shapes on the physical whiteboard remain stuck in the AR overlay because `GraphDeltaSchema` is additive-only. | Execute [DEV_TASK_59.yml](file:///c:/Users/ruanc/source/repos/SpecScribe/DEV_TASK_59.yml). |
| **RISK-07** | **Medium** | `\p{Extended_Pictographic}` regex in [`RaisingHandAgentController.ts:501`](file:///c:/Users/ruanc/source/repos/SpecScribe/spectacles-lens/Assets/Scripts/RaisingHandAgentController.ts#L501) may throw a `SyntaxError` on embedded Spectacles JS runtime. | Execute [DEV_TASK_60.yml](file:///c:/Users/ruanc/source/repos/SpecScribe/DEV_TASK_60.yml). |

---

## 5. Recommended Execution Order for the Development Team

### Wave 1 — Unblock Core Camera, Capture Mode & Vision Pipeline (1–2 Days)
1. **[DEV_TASK_55.yml](file:///c:/Users/ruanc/source/repos/SpecScribe/DEV_TASK_55.yml)**: Gate `simulatedTexture` behind `demoMode` in [`PeriodicCameraCapturer.ts`](file:///c:/Users/ruanc/source/repos/SpecScribe/spectacles-lens/Assets/Scripts/PeriodicCameraCapturer.ts) and clear `simulatedSpeechPhrase` in [`Scene.scene`](file:///c:/Users/ruanc/source/repos/SpecScribe/spectacles-lens/Assets/Scene.scene).
2. **[DEV_TASK_56.yml](file:///c:/Users/ruanc/source/repos/SpecScribe/DEV_TASK_56.yml)**: Fix `_last_vision_time` cooldown placement in [`backend/envelope_router.py`](file:///c:/Users/ruanc/source/repos/SpecScribe/backend/envelope_router.py) (`5.0s` $\rightarrow$ `2.5s`, updated only after `check_image_diff` passes, bypassed on `isManual=True`).
3. **[DEV_TASK_54.yml](file:///c:/Users/ruanc/source/repos/SpecScribe/DEV_TASK_54.yml)** + **[DEV_TASK_48.yml](file:///c:/Users/ruanc/source/repos/SpecScribe/DEV_TASK_48.yml)**: Wire the 4 extracted controllers plus `BtnCaptureWhiteboard` and `BtnToggleCaptureMode` in [`Scene.scene`](file:///c:/Users/ruanc/source/repos/SpecScribe/spectacles-lens/Assets/Scene.scene) and [`SpatialInterfaceManager.ts`](file:///c:/Users/ruanc/source/repos/SpecScribe/spectacles-lens/Assets/Scripts/SpatialInterfaceManager.ts).

### Wave 2 — Complete Meeting Intelligence (Diarization, Live Requirement Reasoning & Full Graph Deltas) (2–3 Days)
4. **[DEV_TASK_57.yml](file:///c:/Users/ruanc/source/repos/SpecScribe/DEV_TASK_57.yml)**: Implement `backend/services/diarization.py` and multi-speaker attribution in `AsrHandler` + `PersistentStreamSocketClient.ts`.
5. **[DEV_TASK_58.yml](file:///c:/Users/ruanc/source/repos/SpecScribe/DEV_TASK_58.yml)**: Add sliding-window continuous requirement reasoning (`DecisionLinkerAgent.process_transcript_window`) in `AsrHandler` with `REQUIREMENT_SYNTHESIZED` HUD toasts and Supabase fallback in `RaisingHandAgent`.
6. **[DEV_TASK_59.yml](file:///c:/Users/ruanc/source/repos/SpecScribe/DEV_TASK_59.yml)**: Add `removed_vertices`, `updated_vertices`, and `removed_edges` to [`GraphDeltaSchema`](file:///c:/Users/ruanc/source/repos/SpecScribe/backend/graph_engine.py#L68-L74) and [`LiveGraphSession.apply_delta`](file:///c:/Users/ruanc/source/repos/SpecScribe/backend/graph_engine.py#L216-L247).

### Wave 3 — AR Hardware Polish, Voice Readout & Cloud/DB Deployment (1 Day)
7. **[DEV_TASK_60.yml](file:///c:/Users/ruanc/source/repos/SpecScribe/DEV_TASK_60.yml)**: Guard `\p{Extended_Pictographic}` regex and add optional TTS spoken concern playback to `AgentVoicePlayer` in [`RaisingHandAgentController.ts`](file:///c:/Users/ruanc/source/repos/SpecScribe/spectacles-lens/Assets/Scripts/RaisingHandAgentController.ts).
8. **[DEV_TASK_61.yml](file:///c:/Users/ruanc/source/repos/SpecScribe/DEV_TASK_61.yml)**: Add Z-depth and yaw rotation alignment to [`WhiteboardCalibrator.ts`](file:///c:/Users/ruanc/source/repos/SpecScribe/spectacles-lens/Assets/Scripts/WhiteboardCalibrator.ts) and hardware passthrough toggle.
9. **Complete Human Ops Tasks**: [DEV_TASK_06.yml](file:///c:/Users/ruanc/source/repos/SpecScribe/DEV_TASK_06.yml) (API tokens), [DEV_TASK_09.yml](file:///c:/Users/ruanc/source/repos/SpecScribe/DEV_TASK_09.yml) (MCP token rotation), [DEV_TASK_15.yml](file:///c:/Users/ruanc/source/repos/SpecScribe/DEV_TASK_15.yml) + [DEV_TASK_53.yml](file:///c:/Users/ruanc/source/repos/SpecScribe/DEV_TASK_53.yml) (Supabase migrations `004`–`007`), [DEV_TASK_37.yml](file:///c:/Users/ruanc/source/repos/SpecScribe/DEV_TASK_37.yml) (Vercel `BACKEND_URL`), [DEV_TASK_38.yml](file:///c:/Users/ruanc/source/repos/SpecScribe/DEV_TASK_38.yml) (Lens `backendWsBase`), and [DEV_TASK_34.yml](file:///c:/Users/ruanc/source/repos/SpecScribe/DEV_TASK_34.yml) (final LEAF Preview run).

