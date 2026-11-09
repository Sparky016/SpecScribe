# SpecScribe AR — Demo Video Production Script

Two kinds of footage go into the submission:

| Footage | Source | Purpose |
|:---|:---|:---|
| **Whiteboard input clip** (`demo_whiteboard_drawing_50s.mp4`) | Gemini (Nano Banana keyframes + Veo clips) | Looped as the **Media Source** in the Lens Studio Preview Panel. The real Lens + backend process it live. |
| **Final submission video** (90–120 s) | OBS screen capture of Lens Studio Preview + Next.js dashboard | What judges see. Every AR overlay, toast, orb, and card in it comes from the real running system. |
| *(Optional)* **Intro B-roll** (≤ 8 s) | Veo | Cinematic "meeting room" opener, marked as illustrative. |

> **Rule:** never generate the AR overlay, HUD toasts, or orb with Veo. Devpost judges need to see the working Lens. Generated footage is only used as **camera input** and as a short intro.

---

## Part A — Whiteboard Input Clip (Gemini)

Veo is weak at legible handwriting, and Gemini Vision needs to read the labels. So we first make **keyframe stills** with Nano Banana (Gemini image generation, which renders text well). Then we use Veo **first-frame → last-frame** generation for the drawing motion between them. The "step-aside" holds are plain still frames that ffmpeg extends. They need no generation and give the pHash/occlusion gate a perfectly stable clean frame.

### A1. Keyframe stills (Nano Banana / Gemini image) — 16:9, 1920×1080

Generate **K0** first. Then make **K1** and **K2** by *editing K0* (upload K0 and say "edit this image"), so the camera, board, and lighting stay identical.

**K0 — Empty board**
```
Photorealistic photo, 16:9, shot from a locked tripod at standing eye level (1.4 m high), 1.3 m back, lens pointing straight at a wall-mounted white dry-erase whiteboard, perfectly frontal with no perspective tilt. The whiteboard fills about 80% of the frame, with a thin aluminium frame and a marker tray along the bottom edge holding a black, a blue, and a red marker. Light grey office wall around it. Soft, even, diffuse overhead office lighting, no glare or specular hotspots on the board. The board surface is completely clean, matte white, with faint ghosting at most. No people, no text, no logos. Sharp focus, neutral colour, realistic.
```

**K1 — Two nodes (edit of K0)**
```
Edit this image. Keep the camera, framing, board, wall, lighting and markers exactly identical. On the left third of the whiteboard, hand-drawn in thick black chisel-tip dry-erase marker: a rectangle containing the word "Client" in clear, large, neat block capitals. In the centre of the board, a second rectangle containing "API Gateway" in the same neat block capitals. A single straight horizontal arrow drawn from the right edge of "Client" to the left edge of "API Gateway", with a clear arrowhead. Above the arrow, small text "HMAC". Strokes are bold, high-contrast, slightly imperfect like real marker, letters about 8 cm tall. The rest of the board stays empty. No people.
```

**K2 — Four nodes (edit of K1)**
```
Edit this image. Keep everything already drawn exactly as it is, and keep the camera and lighting identical. Add, in the same thick black marker and neat block capitals: a rectangle on the right side labelled "Core Service", with a horizontal arrow from "API Gateway" to "Core Service". Below "Core Service", in blue marker, a database cylinder shape labelled "Postgres DB", with a vertical arrow from "Core Service" down to it. The arrow into the database has no label. All four shapes are fully inside the board and do not overlap. No people.
```

**Quality gate before moving on:** each label must be spelled correctly and readable at a glance. Regenerate any frame that has a misspelling. Gemini Vision will read whatever the frame shows.

### A2. Motion clips (Veo, first + last frame, 8 s, 16:9, 1080p, no audio)

**Clip V1 — first frame K0 → last frame K1**
```
Static locked-off tripod shot, absolutely no camera movement, zoom, or reframing. A software engineer in a plain navy crew-neck t-shirt walks in from the left edge of frame, picks up the black marker from the tray, and draws on the whiteboard: first a rectangle with "Client" on the left, then "API Gateway" in the centre, then an arrow between them labelled "HMAC". Natural, efficient drawing motion, partly blocking the board with their body while drawing. In the final 1.5 seconds they cap the marker and step briskly out of frame to the right, leaving a completely unobstructed view of the board. Even diffuse office lighting, realistic, documentary style, no text overlays, no music.
```

**Clip V2 — first frame K1 → last frame K2**
```
Static locked-off tripod shot, absolutely no camera movement, zoom, or reframing. The same engineer in a plain navy crew-neck t-shirt walks in from the right edge of frame and draws on the whiteboard: a rectangle labelled "Core Service" on the right with an arrow from "API Gateway", then switches to the blue marker and draws a database cylinder labelled "Postgres DB" below it with a downward arrow. Existing drawings stay unchanged. In the final 1.5 seconds they step out of frame to the right, leaving a completely unobstructed view of the board. Even diffuse office lighting, realistic, documentary style, no text overlays, no music.
```

*Negative prompt (if the UI has one):* `camera shake, pan, zoom, dolly, handheld, glare, lens flare, text overlay, subtitles, watermark, extra people, changing lighting, cartoon`

### A3. Assembled input timeline (2:02, 0.5 s crossfades)

| Time | Content | Why |
|:---|:---|:---|
| 00:00–00:08 | K0 still | Clean board baseline, pHash diff = 0 |
| 00:08–00:17.5 | Clip V1 | Drawing in progress → occlusion gate holds |
| 00:17.5–00:23 | K1 still | Step-aside: clean frame → 2-node overlay |
| 00:23–00:32.5 | Clip V2 | Second tier being drawn |
| 00:32.5–02:02 | K2 still | Full 4-node overlay. Background for the pinch interactions (mode toggle, manual capture, decision node, orb, conclude). Long on purpose: if the clip loops back to the empty board mid-take, vision may erase the nodes. |

Built by `devpost/build_input_clip.sh` → `devpost/footage/demo_whiteboard_drawing_50s.mp4` (1080p30, H.264 yuv420p, no audio).

---

## Part B — Spoken Lines (recorded live, not generated)

The Lens Studio preview's ASR listens to your **microphone**, not to the video's audio. Two people say these lines live during the OBS take. One person can do both by switching voices, but two real voices show off diarization much better.

| Cue (input clip time) | Speaker | Line |
|:---|:---|:---|
| ~00:08 | **Speaker 1** | "We need a public client connecting to an API Gateway, and every request has to carry HMAC verification." |
| ~00:23 | **Speaker 2** | "Let's route traffic from the Gateway to a Core Service and persist everything in PostgreSQL." |
| ~00:31 | **Speaker 1** | "Do we need auth between the Core Service and the database, or is the network enough?" |

The third line sets up the orb's "Auth Token Leak Risk" critique.

---

## Part C — Final Submission Video (target 1:45)

**Layout:** OBS 1920×1080. Left 60% is the Lens Studio Preview (Spectacles 2024, SIK hands visible). Right 40% is the dashboard at `http://localhost:3000/meetings/demo-session-01`. Voice-over is recorded afterwards over the edited capture.

| Time | Screen | Voice-over |
|:---|:---|:---|
| 0:00–0:08 | *(Optional Veo B-roll, see below)* or a title card: **SpecScribe AR** | "Every design meeting ends the same way: a whiteboard photo nobody reads, and requirements lost in conversation." |
| 0:08–0:15 | Full-screen Preview, clean board, palette visible | "SpecScribe is a Spectacles Lens that listens to the meeting and watches the whiteboard, live." |
| 0:15–0:30 | Speaker 1 talks → `Req:` toast in HUD. Dashboard transcript shows the Speaker 1 turn | "Speech streams to our backend, speakers are diarized, and a reasoning agent turns talk into requirements, right in your field of view." |
| 0:30–0:45 | V1 plays, presenter steps aside → green `#00FF66` overlay snaps onto the boxes. Dashboard draw.io canvas updates | "When the board is clear, Gemini Vision reads the sketch, a draw.io MCP server lays it out, and the clean diagram is projected back onto the real board." |
| 0:45–0:58 | V2 → 4-node overlay. Speaker 2 toast | "As the design grows, the overlay grows with it: additions, erasures, renames." |
| 0:58–1:08 | Pinch `BtnToggleCaptureMode` → "Capture Mode: MANUAL" toast. Pinch `BtnCaptureWhiteboard` | "Capture runs automatically, or switch to manual and pinch to capture on demand." |
| 1:08–1:15 | Pinch `[◇ Decision]` → diamond inserted, edges reroute | "You can edit the diagram in space with a pinch." |
| 1:15–1:32 | Orb raises hand, badge "⚠️ Auth Token Leak Risk", chime. Pinch orb → 3-bullet card + spoken critique (let the audio play) | "And when the AI spots a risk, it doesn't interrupt. It raises its hand." |
| 1:32–1:45 | Pinch `BtnConcludeMeeting` → dashboard full-width: timeline scrubber, Markdown spec, RAG Q&A | "Conclude the meeting and you walk out with a spec, a decision timeline, and a searchable record. SpecScribe: the meeting writes its own spec." |

**Optional intro B-roll (Veo, 8 s, with audio)**
```
Cinematic shot, shallow depth of field, modern glass-walled startup meeting room in warm afternoon light. Three engineers stand around a whiteboard covered in boxes and arrows, one wearing sleek black augmented-reality glasses, gesturing and debating. Slow push-in dolly toward the person wearing the glasses. Subtle ambient office murmur, no dialogue, no music, no visible logos or brand names, no text.
```
Caption it on screen as *"Illustrative footage"* so nobody mistakes it for a product capture.
