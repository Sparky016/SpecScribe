# SpecScribe AR — Live Demo & Submission Video Guide

This guide details how to produce the **50-second scripted whiteboard demonstration video**, import it into Snap Lens Studio 5.15+, and capture the complete end-to-end multimodal AR workflow for the **Learn AR with SPECS** Devpost submission.

---

## 1. Executive Summary & Demo Objectives

The Devpost competition requires a **60-to-180 second demonstration video** showcasing:
1. **Interactive Preview Panel** in Lens Studio 5.15+ with active Spectacles Interaction Kit (SIK) tracking.
2. **Hands-free Whiteboard-to-Diagram Ingestion**: Capturing drawn marker sketches and projecting a transparent Sugiyama DAG overlay.
3. **Spatial SIK Affordances**: Pinching palette buttons at 1.15m focal depth to inject nodes.
4. **Proactive Raising-Hand AI Teammate**: Ambient 3D orb detecting architectural risks and expanding critique cards.
5. **Split-Screen Parity**: Showing the Lens Studio Preview side-by-side with the live Web Dashboard / Draw.io temporal replay.

Using a pre-recorded, scripted 50-second video ensures **100% repeatable, deterministic testing and crisp visual pacing** for video recording without live drawing mistakes.

---

## 2. The 50-Second Whiteboard Video Script

### Recording Setup
* **Canvas**: Physical wall-mounted whiteboard, desktop whiteboard, or high-contrast drawing tablet (iPad running a full-screen white canvas).
* **Marker**: High-contrast, thick chisel-tip black dry-erase marker (optional: blue for databases, red for notes).
* **Camera**: Smartphone or camera mounted on a tripod at eye level (~1.2m–1.5m back), matching the forward-facing field of view of Spectacles (1080p, 30fps, 16:9 landscape, `.mp4`).
* **Lighting**: Even, diffuse lighting without heavy specular glare on the board.

### Choreography Timeline

| Timestamp | Action by Presenter | Visual Content on Whiteboard | Expected Backend / Lens Behavior |
|:---|:---|:---|:---|
| **00:00 – 00:08** | Step back, clear frame | Pristine clean whiteboard surface. | `PeriodicCameraCapturer` initializes. Lens is in `CLEAN_BOARD` mode with transparent overlay. pHash diff is 0. |
| **00:08 – 00:20** | Draw box 1, label it, draw arrow, draw box 2 | `[Client Web/App]` ───▶ `[API Gateway]` | Presenter is drawing. Occlusion gate detects person/hand on board (`person_occluding_board = True`). |
| **00:20 – 00:24** | **Step completely out of frame** | Clean view of `[Client]` ───▶ `[API Gateway]`. | Diff accepted (Hamming distance $\ge 6$). Gemini Vision extracts 2 nodes + 1 edge. Backend returns initial Sugiyama DAG. Neon green `#00FF66` overlay appears over the boxes. |
| **00:24 – 00:36** | Step in, draw arrow, draw box 3, draw cylinder | ───▶ `[Core Service]` ───▶ `[(Postgres DB)]` | Presenter draws second half of the microservice pipeline. |
| **00:36 – 00:40** | **Step completely out of frame** | Full 4-node architecture diagram visible. | Vision extracts updated graph. Sugiyama layout compiles. Lens updates overlay with full multi-tier topology. |
| **00:40 – 00:46** | Hand enters near side frame pointing | Presenter gestures to Gateway node. | Simulated SIK Pinch: `BtnAddDecision` triggers node injection (`Verify JWT HMAC`). |
| **00:46 – 00:50** | Clear frame | Full final architecture. | AI Orb raises hand: `"⚠️ Auth Token Leak Risk"`. Pinching orb reveals critique card. |

> [!IMPORTANT]
> **The Step-Aside Rule**: Gemini Vision and `envelope_router.py` check `if delta.person_occluding_board: return`. You **must** step clear of the whiteboard for 3–4 seconds after drawing each stage so the camera gets an unblocked frame.

---

## 3. Lens Studio 5.15+ Preview Configuration

### Step 1: Place the Video in the Project
Save your recorded clip to:
```text
spectacles-lens/Assets/Textures/demo_whiteboard_drawing_50s.mp4
```

### Step 2: Configure the Lens Studio Preview Panel
1. Open the project in **Lens Studio 5.15+**:
   `c:\Users\ruanc\source\repos\SpecScribe\spectacles-lens\SpecScribe.esproj`
2. In the **Preview Panel** (top-right of Lens Studio):
   * Set device target to **Spectacles (2024)**.
   * Click the **Media Source** icon (webcam/video dropdown in panel header).
   * Click **`+ From File...`** (or `Add Media`).
   * Select your `demo_whiteboard_drawing_50s.mp4` file.
3. The video will now play on loop as the simulated camera feed.

### Step 3: Configure Virtual Whiteboard Passthrough
On Spectacles, the optical waveguide is transparent see-through glass. To let the video show through without an opaque virtual 3D quad blocking it:
1. In the **Objects** hierarchy, select **`SpecScribeControllers`**.
2. In the **Inspector** panel for [SpatialInterfaceManager.ts](file:///c:/Users/ruanc/source/repos/SpecScribe/spectacles-lens/Assets/Scripts/SpatialInterfaceManager.ts):
   * Set **`Is Physical Hardware`** to **`true`** (this automatically disables `whiteboardBoardMesh` so the background video is 100% visible).
   * Ensure `diagramOverlayMesh` remains linked to `OverlayMesh` with its unlit additive material.

---

## 4. Launching the Backend Services

Open a terminal and start the FastAPI orchestrator with Playwright daemon:

```powershell
cd c:\Users\ruanc\source\repos\SpecScribe\backend
.\.venv\Scripts\Activate.ps1
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

Verify backend readiness:
* Health check: `http://localhost:8000/health` (returns `{"status": "ok", "playwright_daemon": true}`)
* WebSocket endpoint: `ws://localhost:8000/ws/meeting/demo-session-01`

---

## 5. Capturing the Submission Demo Video

### Screen Layout (1920×1080 Split-Screen)
Use OBS Studio or any screen recorder to capture side-by-side:
* **Left Side (60% width)**: Lens Studio Interactive Preview Panel with the video playing and SIK hand tracking active.
* **Right Side (40% width)**: Web Dashboard (`http://localhost:3000/meetings/demo-session-01`) showing:
  * Top: Live Draw.io SVG canvas mirroring the diagram deltas.
  * Bottom: Temporal decision timeline scrubber, transcript logs, and AI critique feed.

### Demonstration Checklist
- [ ] Lens Studio connects cleanly to `ws://localhost:8000` with zero console errors.
- [ ] Video plays in the Preview Panel; `PeriodicCameraCapturer` transmits frames every 3 seconds.
- [ ] At 00:22, backend accepts diff; initial 2-node Sugiyama DAG renders over the video in `#00FF66`.
- [ ] At 00:38, second diff is processed; full 4-node graph updates smoothly.
- [ ] SIK hand tracking pinches the `[◇ Decision]` button; `"Verify JWT"` appears.
- [ ] Raising-Hand AI Orb displays the alert badge; SIK pinch expands the critique card.
- [ ] Meeting is concluded via `BtnConcludeMeeting`; dashboard shows auto-generated Markdown technical spec.

---

## 6. Video Post-Production & Submission Links
* Export final video as 1080p MP4 ($60\text{--}150\text{ seconds}$).
* Upload unlisted to **YouTube**, **Vimeo**, or **Loom**.
* Link video in `devpost/submission.md` and repository `README.md`.
