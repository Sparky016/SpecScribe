# SpecScribe AR — Live Demo & Submission Walkthrough Guide

This guide details how to demonstrate the complete, end-to-end multimodal AR workflow for the **Learn AR with SPECS** Devpost submission—both using the **Lens Studio 5.15+ Interactive Preview Panel** and live on **physical Snap Spectacles hardware**.

---

## 1. Executive Summary & Demo Objectives

The Devpost competition requires a **60-to-180 second demonstration video** showcasing:
1. **Interactive Preview Panel** in Lens Studio 5.15+ with active Spectacles Interaction Kit (SIK) tracking (or live recording on physical Spectacles).
2. **Multi-Speaker Meeting Listening & Real-Time Requirement Reasoning**: Participants speak naturally, transcript turns stream over WebSocket, `SpeakerDiarizationService` distinguishes speakers, and `DecisionLinkerAgent` synthesizes requirements into real-time AR HUD toasts (`"Req: ..."`).
3. **Dual-Mode Whiteboard Vision Capture**:
   - **Frequency Mode (`AUTO`)**: Camera captures snapshots every 3 seconds off-thread.
   - **Manual Mode (`MANUAL`)**: Periodic capture is idle; pinching `BtnCaptureWhiteboard` in the SIK spatial palette triggers immediate ingestion. Toggling modes via `BtnToggleCaptureMode` displays instant optical HUD toasts.
4. **Reasoning Model $\rightarrow$ MCP (`drawio-mcp`) $\rightarrow$ Real-World Overlay**: Whiteboard sketches are parsed by Gemini Vision (supporting additions, erasures, and renames), compiled into Sugiyama hierarchical DAGs with orthogonal routing by `drawio-mcp`, rendered by Playwright in $<140\text{ms}$, and projected directly onto the physical whiteboard in phosphor green (`#00FF66`).
5. **6-DOF Calibration & Hardware Passthrough**: Aligning the overlay plane with real room walls (Z-depth clamped to $-115\text{cm}$ optical comfort minimum + Y-axis yaw rotation) with automatic 100% see-through passthrough (`alpha = 0.0` on virtual backplate).
6. **Proactive "Raising-Hand" AI Assistant Orb**: The 3D orb floats at 1.15m optical depth with lazy-follow physics. Upon detecting architectural risks or security flaws, it raises its hand with a floating alert badge ($\le 28$ chars) and plays a chime. Pinching the orb expands the 3-bullet `ExpandedCritiqueCard` AND triggers low-latency spoken audio playback on `AgentVoicePlayer`.
7. **Split-Screen Parity**: Showing the AR glasses view side-by-side with the live Next.js 15 Web Dashboard (`/meetings/<id>`) featuring the temporal decision scrubber, transcript logs, and auto-generated Markdown technical spec.

---

## 2. Demonstration Video Choreography

### Recording Setup
* **Canvas**: Physical wall-mounted whiteboard, desktop whiteboard, or high-contrast drawing tablet (iPad running a full-screen white canvas).
* **Marker**: High-contrast, thick chisel-tip black dry-erase marker (optional: blue for databases, red for notes).
* **Camera**: Smartphone or camera mounted on a tripod at eye level (~1.2m–1.5m back), matching the forward-facing field of view of Spectacles (1080p, 30fps, 16:9 landscape, `.mp4`) OR direct capture from Spectacles via the Spectacles Developer Companion App.
* **Lighting**: Even, diffuse lighting without heavy specular glare on the board.

### 50–90 Second Choreography Timeline

| Timestamp | Presenter / Speaker Action | Visual & Spoken Content | Expected Backend / Lens AR Behavior |
|:---|:---|:---|:---|
| **00:00 – 00:08** | Step back, clear frame | Pristine clean whiteboard surface. | `PeriodicCameraCapturer` initializes. Lens is in `CLEAN_BOARD` mode with transparent overlay. pHash diff is 0. |
| **00:08 – 00:18** | Participant 1 speaks requirement; Presenter draws | *"We need a public client connecting to an API Gateway with HMAC verification."*<br/>Draws: `[Client]` ───▶ `[API Gateway]` | `AsrHandler` logs speech. Diarization attributes to Speaker 1. `DecisionLinkerAgent` synthesizes requirement: **AR HUD displays toast `Req: API Gateway with HMAC verification`**. Occlusion gate detects drawing (`person_occluding_board = True`). |
| **00:18 – 00:24** | **Step completely out of frame** | Clean view of `[Client]` ───▶ `[API Gateway]`. | Diff accepted (Hamming distance $\ge 6$). Gemini Vision extracts 2 nodes + 1 edge. `drawio-mcp` auto-layouts Sugiyama DAG. Playwright renders in 85ms. **Neon green `#00FF66` vector overlay appears precisely over the drawn boxes.** |
| **00:24 – 00:36** | Presenter draws second tier; Participant 2 debates storage | *"Let's route traffic from Gateway to Core Service and persist in PostgreSQL."*<br/>Draws: ───▶ `[Core Service]` ───▶ `[(Postgres DB)]` | AsrHandler attributes to Speaker 2. Requirement synthesized on HUD. Occlusion gate holds previous clean overlay while presenter draws. |
| **00:36 – 00:40** | **Step completely out of frame** | Full 4-node architecture diagram visible. | Vision extracts updated graph. `drawio-mcp` compiles 4-node Sugiyama DAG. AR overlay updates live with full multi-tier topology. |
| **00:40 – 00:48** | Presenter pinches mode toggle and manual capture | Presenter pinches `BtnToggleCaptureMode` then `BtnCaptureWhiteboard`. | HUD displays toast: `"Capture Mode: MANUAL (Pinch to Capture)"`. Pinching capture button forces immediate snapshot, bypassing cooldown (`isManual=True`). |
| **00:48 – 00:54** | SIK Pinch: Insert Decision Node | Presenter pinches `[◇ Decision]` button on spatial palette. | Injects `Verify JWT HMAC` decision diamond into live graph. Sugiyama engine dynamically re-routes orthogonal edges. |
| **00:54 – 01:04** | AI Assistant Orb Alerts Risk | Presenter gestures to unauthenticated DB link. | `RaisingHandAgent` detects architectural vulnerability: Orb transitions to `HAND_RAISED`, pulses cyan, plays chime, and displays floating badge: `"⚠️ Auth Token Leak Risk"`. |
| **01:04 – 01:14** | Pinch Orb to Reveal Concern & Hear Spoken Voice | Presenter pinches the **AI Assistant Orb**. | Orb expands into 3-bullet `ExpandedCritiqueCard` and `AgentVoicePlayer` plays low-latency spoken voice critique of the token leak risk. |
| **01:14 – 01:20** | Conclude Meeting | Presenter pinches `BtnConcludeMeeting`. | Meeting finalizes. Next.js dashboard renders full temporal timeline, auto-generated Markdown technical spec, and pgvector RAG Q&A hub. |

> [!IMPORTANT]
> **The Step-Aside Rule**: Gemini Vision and `envelope_router.py` check `if delta.person_occluding_board: return`. You **must** step clear of the whiteboard for 3–4 seconds after drawing each stage so the camera captures an unblocked frame.

---

## 3. Lens Studio 5.15+ Configuration

### Mode 1: Interactive Desktop Preview (Webcam or Pre-Recorded Video)
1. Open the project in **Lens Studio 5.15+**:
   `c:\Users\ruanc\source\repos\SpecScribe\spectacles-lens\SpecScribe.esproj`
2. In the **Preview Panel** (top-right of Lens Studio):
   * Set device target to **Spectacles (2024)**.
   * Click the **Media Source** icon (webcam/video dropdown in panel header).
   * Either select your **Integrated Webcam** to draw live, or click **`+ From File...`** to loop your recorded `demo_whiteboard_drawing_50s.mp4`.
3. In the **Objects** hierarchy, select **`SpecScribeControllers`**:
   * If using webcam or pre-recorded video, verify `PeriodicCameraCapturer` has `demoMode` set appropriately (`demoMode: true` forces simulated texture; `demoMode: false` requests webcam/hardware camera).
   * Ensure `SpatialInterfaceManager` has `isPhysicalHardware` set to `true` (or use the automatic passthrough mode) so the opaque 3D virtual whiteboard quad is hidden, allowing your video or webcam to show through 100% transparently.

### Mode 2: Live Deployment to Physical Spectacles Hardware
1. Connect physical Spectacles (2024) to the same Wi-Fi network as your workstation.
2. In the **Objects** hierarchy, select **`SpecScribeControllers`**:
   * Ensure `isPhysicalHardware` is `true` (whiteboard backplate alpha = 0.0; collider and overlay preserved).
   * Ensure `demoMode` on `PeriodicCameraCapturer` is `false` (forces live `LensStudio:CameraModule` hardware capture).
   * Set `backendWsBase` to your Cloud Run or local network IP (`wss://<host>/ws` or `ws://192.168.x.x:8000/ws`).
   * Enter your `apiToken` (`SPECSCRIBE_API_TOKEN`).
3. Click **Send Lens to Device** in Lens Studio to push the project to your Spectacles.
4. Perform the 30-second physical whiteboard calibration (`SELECT_AREA` mode):
   * Use SIK hand pinch to align the four corners with your physical whiteboard frame.
   * Adjust depth translation (clamped to $-115\text{cm}$ optical minimum) and Y-axis yaw rotation so the plane sits flush against the room wall.

---

## 4. Launching Backend & Dashboard Services

### 1. Start the FastAPI Async Orchestrator (with Playwright Daemon)
```powershell
cd c:\Users\ruanc\source\repos\SpecScribe\backend
.\.venv\Scripts\Activate.ps1
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```
* Confirm console outputs:
  - `Playwright headless renderer daemon pre-warmed`
  - `Application startup complete`

### 2. Start the Next.js 15 Web Dashboard
```powershell
cd c:\Users\ruanc\source\repos\SpecScribe\web-dashboard
npm run dev
```
* Access the dashboard at: `http://localhost:3000/meetings/demo-session-01`

---

## 5. Capturing the Submission Video

### Split-Screen OBS Studio Setup (1920×1080)
* **Left Panel (60% width)**: Lens Studio Interactive Preview Panel with SIK hand tracking active (or direct Spectacles hardware recording).
* **Right Panel (40% width)**: Web Dashboard (`http://localhost:3000/meetings/demo-session-01`) showing:
  - Top: Live Draw.io SVG canvas updating dynamically with graph deltas.
  - Bottom: Speaker-attributed transcript turns, requirement synthesis cards, and proactive AI critique feed.

### Comprehensive Demonstration Checklist
- [ ] WebSocket handshake succeeds cleanly (`Spectacles-2024` client logged).
- [ ] Participant speaks: `SpeakerDiarizationService` attributes turn; `DecisionLinkerAgent` displays real-time requirement toast on AR HUD (`"Req: ..."`).
- [ ] Whiteboard drawing begins; occlusion gate detects presenter and holds clean view.
- [ ] Presenter steps aside; within 3 seconds, `drawio-mcp` compiles Sugiyama DAG and renders `#00FF66` vector overlay precisely over marker lines.
- [ ] Presenter toggles capture mode via `BtnToggleCaptureMode`; HUD displays `"Capture Mode: MANUAL (Pinch to Capture)"`.
- [ ] Presenter pinches `BtnCaptureWhiteboard`; immediate snapshot ingests.
- [ ] SIK pinch on `[◇ Decision]` injects decision diamond into the diagram.
- [ ] Proactive AI Orb detects risk: pulses cyan, shows floating badge (`"⚠️ Auth Token Leak Risk"`), and chimes.
- [ ] Presenter pinches the Orb: 3-bullet critique card expands and `AgentVoicePlayer` plays spoken audio critique.
- [ ] Presenter pinches `BtnConcludeMeeting`: Web dashboard displays finalized technical specification, temporal replay scrubber, and pgvector RAG drawer.

---

## 6. Post-Production & Submission Links
* Export final video as 1080p MP4 ($60\text{--}180\text{ seconds}$).
* Upload unlisted to **YouTube**, **Vimeo**, or **Loom**.
* Link video in `devpost/submission.md` and repository `README.md`.
