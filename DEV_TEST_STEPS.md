# SpecScribe AR — Developer Testing Guide (Rapid Iteration & Multi-Modal Verification)

This guide walks you through using your **Laptop or USB Webcam** (or desktop test pad / drawing tablet) to rapidly verify the complete multimodal pipeline—real-time speech reasoning, dual-mode whiteboard capture, Sugiyama DAG auto-layout with deletions/renames, 6-DOF optical calibration, and proactive AI critique with spoken audio readout—without requiring physical Spectacles hardware.

---

## 1. Development Loop Architecture

```text
[ Desk Notepad / Whiteboard / iPad ]       [ Multi-Speaker Conversation / Voice ]
                │                                             │
                ▼ (Real-time optical capture)                 ▼ (AsrModule / AudioChunk)
    [ Laptop / USB Webcam ]                     [ PersistentStreamSocketClient.ts ]
                │                                             │
                ▼ (Selected as Preview Media)                 ▼
[ Lens Studio 5.15+ Preview Panel ]                           │
        │                                                     │
        ├── PeriodicCameraCapturer (AUTO 3s / MANUAL pinch)   │
        ├── WhiteboardCalibrator (6-DOF Depth & Yaw)          │
        ├── RaisingHandAgentController (Orb + Voice Player)   │
        │                                                     │
        ▼ (Full-Duplex WebSocket: JSON + Binary Blobs)        │
[ FastAPI Async Orchestrator (ws://localhost:8000) ] <────────┘
        │
        ├── 1. SpeakerDiarizationService (Deepgram + Turn Handoff Classifier)
        ├── 2. DecisionLinkerAgent (Sliding-window continuous requirement reasoning)
        ├── 3. imagehash.phash Diff Gate (Hamming distance ≥ 6)
        ├── 4. Gemini Vision (Full Graph CRUD: additions, erasures, renames)
        ├── 5. drawio-mcp (Sugiyama DAG auto-layout & orthogonal routing)
        ├── 6. Headless Playwright (viewer.diagrams.net/export3.html RGBA PNG <140ms)
        └── 7. RaisingHandAgent (20s proactive risk detection + RAG + Spoken Audio)
        │
        ▼ (DIAGRAM_UPDATED / HAND_RAISED / REQUIREMENT_SYNTHESIZED Events)
[ Lens Studio Spatial Interface & Waveguide AR Overlay ]
        │
        ├── Updates diagramOverlayMesh.mainMaterial.mainPass.baseTex
        ├── Displays HUD toasts (Req / Decision notifications)
        └── AI Orb pulses, expands 3-bullet card, and plays spoken voice critique
```

---

## 2. Prerequisites & Local Environment Setup

### 1. Backend Environment
```powershell
cd c:\Users\ruanc\source\repos\SpecScribe\backend
.\.venv\Scripts\Activate.ps1
```

Verify your `backend/.env` file contains:
```env
GEMINI_API_KEY=your_gemini_api_key_here
PLAYWRIGHT_HEADLESS=true
SPECSCRIBE_AUTH_DISABLED=1   # Set to 1 for local development
```

Start the orchestrator:
```powershell
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```
* Confirm console outputs: `Playwright headless renderer daemon pre-warmed` and `Application startup complete`.

### 2. Physical Setup
Position a drawing surface in view of your laptop webcam:
* **Option A**: A small desktop dry-erase whiteboard.
* **Option B**: A white notepad or blank paper with a dark marker.
* **Option C**: An iPad or tablet screen with a white drawing canvas (Apple Notes, Excalidraw, or Procreate).

---

## 3. Lens Studio 5.15+ Configuration

1. Launch **Lens Studio 5.15+** and open:
   `c:\Users\ruanc\source\repos\SpecScribe\spectacles-lens\SpecScribe.esproj`
2. In the **Preview Panel** (top-right panel):
   * Confirm the device target is set to **Spectacles (2024)**.
   * Click the **Media Source** icon (camera dropdown in header) and select your **Integrated Webcam** (or USB camera).
3. In the **Objects** hierarchy, select **`SpecScribeControllers`**:
   * In the Inspector for `SpatialInterfaceManager`:
     - Check **`Is Physical Hardware` = `true`** (this makes the opaque virtual whiteboard quad transparent so your webcam feed shows through).
   * In the Inspector for `PeriodicCameraCapturer`:
     - Set **`demoMode` = `false`** (ensures live webcam feed is prioritized over simulated video).
     - Set **`sampleIntervalSeconds` = `3.0`**.

---

## 4. Step-by-Step Multi-Modal Verification

### Test 1: Handshake & Connection Verification
1. Click the **Reset** button in the Lens Studio Preview Panel.
2. Check the Lens Studio **Logger**:
   ```text
   [PersistentStreamSocketClient] Connected to ws://localhost:8000/ws/meeting/demo-session-01
   [PeriodicCameraCapturer] Camera pipeline initialized at 480p (Mode: AUTO).
   ```
3. Check the FastAPI terminal:
   ```text
   INFO: Handshake received from device Spectacles-2024 (v1.1.0)
   ```

---

### Test 2: Multi-Speaker Conversation & Live Requirement Synthesis
1. In the Lens Studio Logger / Preview, simulate spoken utterances from two participants (or use microphone input):
   - Participant 1: *"We must enforce sub-50ms token authentication latency using Redis."*
   - Participant 2: *"Agreed, Redis will prevent PostgreSQL connection exhaustion during morning peak hours."*
2. Watch the backend terminal:
   ```text
   INFO: Diarization attributed turn to Speaker 1 (Participant).
   INFO: DecisionLinkerAgent evaluated transcript window: REQUIREMENT detected.
   INFO: Broadcast REQUIREMENT_SYNTHESIZED: "Auth service must enforce sub-50ms token authentication latency using Redis."
   ```
3. In the Lens Studio Preview Panel:
   - The AR HUD immediately displays `DiffToastText`:
     `"Req: Auth service must enforce sub-50ms token latency using Redis"`

---

### Test 3: Frequency Mode Whiteboard Ingestion (3s AUTO)
1. On your notepad/whiteboard, draw:
   * A box labeled **`Client`**
   * A right-pointing arrow: `───▶`
   * A box labeled **`API Gateway`**
2. **Step your hand/marker out of camera view.**
3. Watch the backend terminal:
   ```text
   INFO: Frame diff accepted (hamming: 14). Analyzing whiteboard...
   INFO: Gemini Vision extracted 2 nodes and 1 edge.
   INFO: Sugiyama DAG compiled (2 nodes). Playwright rendered PNG in 82ms.
   INFO: Broadcast DIAGRAM_UPDATED to meeting demo-session-01.
   ```
4. In the Lens Studio Preview Panel:
   - The transparent `#00FF66` phosphor green diagram overlay appears directly registered over your drawn boxes!

---

### Test 4: Occlusion Gate Verification
1. Rest your hand and pen across the drawing.
2. Verify the backend logs:
   ```text
   INFO: Person occluding whiteboard (person_occluding_board = True); skipping diagram mutation.
   ```
3. Pull your hand back completely. On the next 3-second tick, the frame is processed normally.

---

### Test 5: Whiteboard Erasures & Rewiring (Full Graph Mutations)
1. On your notepad, erase or cross out `API Gateway` and replace it with **`Auth Gateway`**, and add an arrow to **`Postgres DB`**.
2. Step away. Watch the backend terminal:
   ```text
   INFO: Gemini Vision extracted delta: updated_vertices=['API Gateway' -> 'Auth Gateway'], added_vertices=['Postgres DB'].
   INFO: LiveGraphSession applied mutations: 0 removed, 1 renamed, 1 added.
   INFO: Sugiyama DAG re-routed. New overlay streamed.
   ```
3. In the Lens Studio Preview Panel:
   - The overlay updates smoothly without leaving the old `API Gateway` box behind.

---

### Test 6: Dual-Mode Whiteboard Capture (Mode Toggle & Manual Pinch)
1. Hold **Spacebar** in the Preview Panel to summon the virtual SIK hand.
2. Pinch the **`[Mode: Auto/Manual]`** button (`BtnToggleCaptureMode`):
   - AR HUD displays toast: `"Capture Mode: MANUAL (Pinch to Capture)"`.
   - The periodic 3-second timer stops transmitting.
3. Draw an additional box: **`Redis Cache`**.
4. Pinch the **`[Capture Board]`** button (`BtnCaptureWhiteboard`):
   - AR HUD displays: `"Capturing whiteboard snapshot..."`.
   - Frame transmits with `captureMode: "MANUAL"`, `isManual: true`.
   - Backend processes the frame immediately, bypassing all cooldown timers.
5. Pinch `BtnToggleCaptureMode` again to return to Frequency Mode:
   - AR HUD displays: `"Capture Mode: AUTO (Every 3s)"`.

---

### Test 7: Interactive SIK Component Injection
1. Move the virtual hand over the left-hand palette button: **`[◇ Decision]`**.
2. Perform a pinch gesture:
   - Lens Logger: `[SpatialInterfaceManager] BtnAddDecision pinched -> injecting node`
   - Backend terminal: `Handling pinchCommand: ADD_NODE (decision)`
   - Diagram re-renders with a decision diamond node auto-positioned in the hierarchy.

---

### Test 8: Proactive AI Assistant Risk Warning & Spoken Audio Critique
1. With unauthenticated links present, the backend's `RaisingHandAgent` detects an architectural flaw:
   ```text
   INFO: RaisingHandAgent detected risk: VULNERABILITY (Auth Token Leak Risk)
   INFO: Broadcast HAND_RAISED to meeting demo-session-01 with audio_b64
   ```
2. In the Lens Studio Preview Panel:
   - The 3D AI Orb (top-right) pulses cyan and displays floating badge: `"⚠️ Auth Token Leak Risk"`.
   - Chime plays via `AgentVoicePlayer`.
3. Use the virtual hand to pinch the **Agent Orb**:
   - The badge expands into the full 3-bullet architecture critique card.
   - `AgentVoicePlayer` plays the decoded spoken audio critique (or chime fallback).

---

### Test 9: 6-DOF Whiteboard Calibration & Passthrough Alignment
1. In the Preview Panel, click `BtnSelectArea` to enter Calibration Mode.
2. Verify the 4 corner handles appear around the whiteboard quad.
3. Drag handles along X and Y axes; verify translation adjusts smoothly.
4. Drag in depth (Z-axis); verify Z is clamped between $-115\text{cm}$ and $-400\text{cm}$ to maintain optical comfort.
5. Adjust yaw rotation; verify the quad rotates around the world Y-axis to sit flush against angled walls.
6. Click `BtnConfirmArea` to lock calibration in world space.

---

### Test 10: Meeting Finalization & Dashboard Verification
1. Pinch **`BtnConcludeMeeting`** in the spatial palette.
2. Open your web browser to:
   `http://localhost:3000/meetings/demo-session-01`
3. Verify:
   - **Temporal Decision Scrubber**: Dragging the slider from `00:00` to `End` replays each diagram step.
   - **Speaker Diarized Transcripts**: Dialogue is cleanly attributed to distinct speakers.
   - **Auto-Generated Tech Spec**: Complete Markdown technical specification is rendered with architectural decisions, requirements, and ASCII/Mermaid flowcharts.
   - **RAG Q&A Drawer**: Asking *"Why was Redis Cache added?"* returns grounded answers citing exact meeting timestamps (`[00:36]`).

---

## 5. Troubleshooting & Diagnostics

| Symptom | Probable Cause | Quick Fix |
|:---|:---|:---|
| **`Frame skipped by perceptual hash (hamming < 6)`** | Marker lines too thin or camera too far away. | Use a thicker chisel marker or move drawing closer to fill the webcam FOV. |
| **`Person occluding whiteboard; skipping diagram mutation`** | Hand/marker remains in camera shot. | Step hand completely clear of the board for 3 seconds. |
| **Video/Webcam blocked by opaque white quad** | Virtual whiteboard quad is active. | Set `isPhysicalHardware = true` in `SpatialInterfaceManager` Inspector to activate 100% passthrough. |
| **Manual pinch capture does not ingest** | Mode is in AUTO or button collider detached. | Pinch `BtnToggleCaptureMode` to enter MANUAL mode, or verify collider on `BtnCaptureWhiteboard`. |
| **No requirement toasts appear during speech** | Spoken phrases too short or casual banter. | Speak substantive sentences with architecture keywords (e.g. *"latency"*, *"cache"*, *"database"*). |
| **Gemini Vision returns empty deltas** | High glare or dried marker ink. | Adjust room lighting to remove white reflections off the glossy board surface. |
