# Product Requirements Document (PRD) — SpecScribe AR

- **Version:** `1.1.0`
- **Status:** Locked for Implementation
- **Target IDE & Runtime:** Snap Lens Studio 5.15.x (Spectacles Simulation Profile) + FastAPI (Python 3.11+) + Next.js 15[cite: 1, 2, 3]

---

## 1. Target User Personas

1. **Lead Systems Architect / Forward-Deployed Engineer (Wearer):** Sketches system topologies on a physical whiteboard while debating trade-offs with colleagues. Needs hands-free diagram formalization, instant structural node injection, and real-time architectural sanity checks without looking down at a laptop[cite: 3].
2. **Engineering Team Member / Reviewer (Post-Meeting User):** Reviews the meeting afterward via the web dashboard. Needs to scrub through the meeting timeline to see _why_ the architecture changed at minute 8 and query an AI agent about specific design decisions.

---

## 2. User Stories & Acceptance Criteria

### US-01: Passive Whiteboard-to-Draw.io AR Synchronization

- **As a** Spectacles wearer sketching on a whiteboard,
- **I want** my hand-drawn boxes and arrows to be automatically converted into a clean, auto-layouted Draw.io diagram overlaid in AR next to the board,
- **So that** I get a structured digital diagram in real time without stopping to take manual photos.
- **Acceptance Criteria:**
  - Camera frames are sampled every 3 seconds at `480p` (`imageSmallerDimension = 480`) using `Base64.encodeTextureAsync` without dropping Lens Studio below 60 FPS[cite: 2].
  - Unchanged frames are discarded in <5ms via perceptual hashing.
  - Modified whiteboard states update the in-memory `drawio-mcp` graph, apply Sugiyama hierarchical layout (`apply_sugiyama`), render a transparent `bg=none` PNG in <140ms via Playwright `export3.html`, and update the AR surface texture[cite: 1, 2].

### US-02: SIK Pinch-to-Spawn Architecture Palette

- **As a** Spectacles wearer building a workflow,
- **I want** to pinch spatial buttons (`Decision`, `Service`, `Database`, `Terminal`) floating beside the board and speak a node name,
- **So that** I can inject standardized Draw.io components hands-free[cite: 2, 3].
- **Acceptance Criteria:**
  - Four `PinchButton` components from `SpectaclesInteractionKit.lspkg` are anchored peripherally at 1.15m forward depth[cite: 2].
  - Hovering over a button updates status text via `Interactable.onHoverEnter`; pinching triggers `onButtonPinched` and sends a `pinchCommand` with the latest `AsrModule` transcript token[cite: 2].
  - The new node appears in the AR Draw.io overlay within 200ms[cite: 1].

### US-03: "Raising-Hand" Proactive & Research AI Teammate

- **As a** meeting participant,
- **I want** an ambient AI teammate in my peripheral vision that raises its hand when it spots an architectural flaw—or when it finishes researching a question I pinched it to ask—
- **So that** I can pull critical insights into the meeting only when I choose to pinch its hand.
- **Acceptance Criteria:**
  - The AI orb stays in an unobtrusive peripheral `IDLE` state unless triggered[cite: 3].
  - When a `VULNERABILITY`, `LOGIC_FLAW`, or `ALTERNATIVE_IDEA` is found (or a research query finishes), the orb transitions to `HAND_RAISED` with a high-contrast pill title ($\le 28$ characters).
  - Pinching the raised hand expands a floating 3-bullet summary card and plays optional audio using `Audio.PlaybackMode.LowLatency`[cite: 2].

### US-04: Temporal Decision Scrubber & Post-Meeting RAG

- **As an** engineer reviewing the architecture session,
- **I want** a timeline slider that replays the exact Draw.io diagram state alongside speaker-diarized transcripts and answers natural language "Why" questions,
- **So that** no institutional context or decision rationale is lost.
- **Acceptance Criteria:**
  - Dragging the timeline scrubber updates the rendered Draw.io diagram snapshot and highlights the active speaker turn.
  - Clicking export downloads the valid `.drawio` XML file and auto-generated Markdown Technical Specification.
  - Asking a question in the RAG drawer queries Supabase `pgvector` (`knowledge_chunks`) and returns answers with clickable timestamp citations.

---

## 3. Non-Functional & Optical Ergonomic Requirements

| Requirement ID | Category                 | Specification                                                                                                                                                                    |
| :------------- | :----------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **NFR-01**     | **AR Frame Rate**        | Maintain 60 FPS inside Lens Studio 5.15+ Interactive Preview with zero console warnings[cite: 2, 3].                                                                             |
| **NFR-02**     | **Render Latency**       | Server-side `.drawio` XML-to-transparent PNG conversion must execute in <140ms (60ms–140ms via pre-warmed Playwright `export3.html`)[cite: 1].                                   |
| **NFR-03**     | **Waveguide Contrast**   | All AR diagram textures must use `bg=none` (`opacity=0`), `#00FF66` (phosphor green) or `#00E5FF` (cyan) strokes, and `#FFFFFF` text for additive waveguide legibility[cite: 1]. |
| **NFR-04**     | **Spatial Comfort Zone** | All interactive SIK colliders and UI panels must be placed between 1.0m and 1.3m along the forward Z-axis and kept out of the central field of view[cite: 2, 3]. *Exemption:* the whiteboard interactable overlays a physical board and sits at the board's distance (~2.3 m), outside the 1.0–1.3 m band.                 |
| **NFR-05**     | **Thermal Envelope**     | Camera capture must use `OnStartEvent` initialization, `480p` downsampling, and asynchronous background JPEG encoding at $\le 1$ FPS (default 0.33 FPS)[cite: 2].                |
