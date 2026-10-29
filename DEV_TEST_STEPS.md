# SpecScribe AR — Developer Testing Guide (Webcam Rapid Iteration)

This guide walks you through using your **Laptop or USB Webcam** to achieve an immediate, live feedback loop during development. This allows you to draw strokes in real time on a desk pad or whiteboard and verify the entire multimodal vision, Sugiyama auto-layout, and AR overlay pipeline without needing physical Spectacles hardware.

---

## 1. Development Loop Architecture

```text
[ Desk Notepad / Whiteboard / iPad ]
                │
                ▼ (Real-time optical capture)
    [ Laptop / USB Webcam ]
                │
                ▼ (Selected as Preview Media)
[ Lens Studio 5.15+ Preview Panel ]
        │
        ├── PeriodicCameraCapturer (Default_Color -> 480p JPEG Base64)
        │
        ▼ (Full-Duplex WebSocket)
[ FastAPI Async Orchestrator (ws://localhost:8000) ]
        │
        ├── 1. imagehash.phash Diff Gate (Hamming distance ≥ 6)
        ├── 2. Gemini 2.5 Flash Vision (Topological delta extraction)
        ├── 3. drawio-mcp (Sugiyama DAG auto-layout & edge routing)
        └── 4. Headless Playwright (viewer.diagrams.net/export3.html RGBA PNG)
        │
        ▼ (DIAGRAM_UPDATED WebSocket Event)
[ Lens Studio SpatialInterfaceManager ]
        │
        └── Updates diagramOverlayMesh.mainMaterial.mainPass.baseTex
```

---

## 2. Prerequisites & Local Environment Setup

### 1. Backend Environment
Ensure dependencies and environment variables are configured:
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

Start the backend:
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

## 3. Lens Studio 5.15+ Webcam Configuration

1. Launch **Lens Studio 5.15+** and open:
   `c:\Users\ruanc\source\repos\SpecScribe\spectacles-lens\SpecScribe.esproj`
2. In the **Preview Panel** (top-right panel):
   * Confirm the device target is set to **Spectacles (2024)**.
   * Click the **Media Source** icon (the camera dropdown in the panel header).
   * Select your **Integrated Webcam** (e.g., `HD User Facing Webcam` or external USB camera).
3. Point your camera so the whiteboard/notepad occupies the central 60% of the field of view.

### Scene Configuration for Real Passthrough
In the **Objects** hierarchy, click **`SpecScribeControllers`**:
* In the Inspector for [SpatialInterfaceManager.ts](file:///c:/Users/ruanc/source/repos/SpecScribe/spectacles-lens/Assets/Scripts/SpatialInterfaceManager.ts):
  * Check **`Is Physical Hardware` = `true`**. This hides the opaque 3D virtual whiteboard quad so your live webcam feed is completely visible as the real-world background.
* In the Inspector for [PeriodicCameraCapturer.ts](file:///c:/Users/ruanc/source/repos/SpecScribe/spectacles-lens/Assets/Scripts/PeriodicCameraCapturer.ts):
  * `sampleIntervalSeconds`: set to **`2.0`** or **`3.0`** seconds for responsive testing.
  * `frameSmallerDimension`: keep at **`480`**.

---

## 4. Step-by-Step Verification Run

### Test 1: Handshake & Idle Verification
1. Restart the Lens preview (`Reset` button in the Preview Panel).
2. Check the Lens Studio **Logger**:
   ```text
   [PersistentStreamSocketClient] Connected to ws://localhost:8000/ws/meeting/demo-session-01
   [PeriodicCameraCapturer] Camera pipeline initialized at 480p.
   ```
3. Check the FastAPI terminal:
   ```text
   INFO: Handshake received from device Spectacles-2024 (v1.1.0)
   ```
4. Do not draw anything. Verify the backend logs show:
   ```text
   DEBUG: Frame skipped by perceptual hash (hamming distance: 0 < 6)
   ```

---

### Test 2: Live Ingestion of Initial Diagram
1. On your notepad/whiteboard, draw:
   * A box labeled **`Client`**
   * A right-pointing arrow: `───▶`
   * A box labeled **`API Gateway`**
2. **Step your hand/marker out of the camera view.**
3. Watch the backend terminal:
   ```text
   INFO: Frame diff accepted (hamming: 14). Analyzing whiteboard...
   INFO: Gemini Vision extracted 2 nodes and 1 edge.
   INFO: Sugiyama DAG compiled (2 nodes). Playwright rendered PNG in 82ms.
   INFO: Broadcast DIAGRAM_UPDATED to meeting demo-session-01.
   ```
4. In the Lens Studio Preview Panel:
   * The transparent `#00FF66` phosphor green diagram overlay appears directly aligned in front of your camera view!

---

### Test 3: Occlusion Gate Verification
1. Keep your hand and pen resting directly across the drawing.
2. In the backend terminal, verify:
   ```text
   INFO: Person occluding whiteboard; skipping diagram mutation.
   ```
3. Remove your hand. On the next 3-second tick, the frame is processed normally.

---

### Test 4: Incremental Diagram Update
1. Draw an arrow from `API Gateway` to a new cylinder labeled **`Postgres DB`**.
2. Remove your hand.
3. Verify the backend computes a graph delta:
   * Old nodes (`Client`, `API Gateway`) are preserved.
   * New database node (`Postgres DB`) is inserted.
   * Sugiyama layout automatically expands layers horizontally.
4. The Lens Studio overlay updates live to reflect the 3-node graph.

---

### Test 5: Interactive SIK Pinch Affordances
1. In the Lens Studio Preview Panel, press and hold the **Spacebar** (or right-click) to summon the virtual SIK hand controller.
2. Move the hand cursor over the left-hand palette button: **`[◇ Decision]`**.
3. Perform a pinch gesture (left click / pinch control):
   * Lens Logger: `[SpatialInterfaceManager] BtnAddDecision pinched -> injecting node`
   * Backend logs: `Handling pinchCommand: ADD_NODE (decision)`
   * The diagram re-renders with a decision diamond node injected.

---

### Test 6: Proactive AI Teammate Critique
1. Once the diagram contains unauthenticated connections, the backend's `RaisingHandAgent` triggers:
   ```text
   INFO: RaisingHandAgent detected risk: VULNERABILITY (Auth Token Leak Risk)
   INFO: Broadcast HAND_RAISED to meeting demo-session-01
   ```
2. In the Lens Studio Preview Panel:
   * The 3D AI Orb (top-right) pulses cyan and displays the floating badge:
     `"⚠️ Auth Token Leak Risk"`
3. Use the virtual hand to pinch the **Agent Orb**:
   * The badge expands into the full 3-bullet architecture critique card.
   * Low-latency voice feedback or audio chime plays via `AgentVoicePlayer`.

---

## 5. Troubleshooting & Diagnostics

| Symptom | Probable Cause | Quick Fix |
|:---|:---|:---|
| **`Frame skipped by perceptual hash (hamming < 6)`** when drawing | Marker lines too thin or camera too far away. | Use a thicker chisel marker or move the drawing closer to fill more of the webcam frame. |
| **`Person occluding whiteboard; skipping diagram mutation`** | Hand/body remains in camera frame. | Pull hand back completely for 3 seconds so the camera sees a clear shot of the whiteboard. |
| **Video background is blocked by a white quad** | Virtual whiteboard mesh is enabled. | Set `isPhysicalHardware = true` in `SpatialInterfaceManager` Inspector to disable the virtual backplate. |
| **WebSocket disconnects with 1006** | Backend not running or auth required. | Ensure `uvicorn` is running on port 8000 and `SPECSCRIBE_AUTH_DISABLED=1` is set in `backend/.env`. |
| **Gemini Vision returns empty nodes** | High glare or poor lighting. | Adjust desk lighting to eliminate shiny white glare reflecting into the webcam lens. |
| **SIK Hand pinch not registering** | Hand tracking out of bounds. | Move camera view or adjust palette anchor distance in `SpatialHUDRoot` to sit within the $1.0\text{m}\text{--}1.3\text{m}$ comfort zone. |
