---
status: approved
---

# Design brief: SpecScribe AR

<!-- Filled in by plan-lens from the learner's interview. Use the learner's words. Mark any value they didn't choose as (default). -->

## The one spatial moment
A developer leading a technical planning session, writing on a whiteboard with a black marker in hand, seeing their hand-drawn architecture boxes and arrows overlaid and updated with clean Draw.io digital diagrams, while an ambient 3D AI teammate raises its hand with proactive architectural critiques and suggestions during the meeting.

## Why it belongs on glasses
- Uses: shares your view, draws in the world, leaves your body free
- Why it's better than the phone or laptop version: Leaves hands completely free to hold markers and sketch naturally at the whiteboard, keeping eyes up where digital architecture diagrams, component palettes, and AI critiques overlay directly in physical space without breaking flow to look at a laptop or hold a mobile device.

## Product or overlay
- Type: overlay: it responds to something real (the physical whiteboard and hand-drawn marker lines)
- What the real version would sense: Hand-drawn lines, boxes, and arrows on the whiteboard from periodic camera frames, coupled with verbal planning discussion
- Stand-in for the preview: A virtual whiteboard panel at arm's length displaying the initial whiteboard drawing; a floating 4-button SIK component palette and an "Update" snapshot button simulate node injection and real-time diagram refresh, rendering high-contrast transparent Sugiyama DAG overlays.

## Where things live
- Where the user is looking during the main task: Standing in a meeting room, looking directly at the whiteboard at arm's length (~1.0 m to 1.2 m).
- Whiteboard & Diagram Overlay (`WhiteboardOverlayAnchor`): Anchored at 1.15 m distance (default), ~80 cm x 120 cm (default), at chest to eye level. High-contrast luminous lines (#00FF66 phosphor green, #00E5FF cyan) with transparent background (`bg=none`) overlay the drawing and stick solidly to the board for the duration of the meeting.
- SIK Component Palette (`BtnAddDecision`, `BtnAddService`, `BtnAddDatabase`, `BtnAddTerminal`): Anchored peripherally at 1.15 m focal depth, within comfortable arm reach, to the side of the whiteboard so as not to occlude the central diagram.
- Floating Meeting Controls ("Update / Snapshot" & "Conclude Meeting"): Anchored at ~1.0 m to 1.15 m distance near the palette.
- AI Teammate Orb (`RaisingHandAgentController`): Anchored in the upper-right peripheral field of view at 1.15 m depth. Displays an ambient glowing 3D orb with a floating pill badge (`< 28 chars`, e.g. "Auth Token Leak Risk") when raising its hand.

## Hands and input
- SIK Component Palette: Floating pinch on `[Decision]`, `[Service]`, `[Database]`, or `[Terminal]` to inject an architecture node directly into the live graph.
- Floating pinch on "Update / Snapshot": Simulates camera capture and syncs the updated diagram overlay onto the whiteboard.
- Floating pinch on AI Orb: Expands the floating critique card with 3-bullet analysis and triggers low-latency voice feedback.
- Floating pinch on "Conclude Meeting": Finalizes the active session and triggers technical spec generation.
- Targets are big and highlight when aimed at.
- Voice (if any) and the button that does the same job: All actions are fully driven by SIK pinch buttons for complete reliability in the preview.

## When things show
- Diagram overlay: Sticks to the whiteboard for the duration of the meeting, updating dynamically as nodes are added or when the Update button is pinched.
- SIK Component Palette & Meeting Controls: Visible during the meeting within arm reach; disappear or reset when the meeting is concluded.
- AI Teammate Orb: Stays quietly in `IDLE` or `RESEARCHING` state in the peripheral view; elevates to `HAND_RAISED` with an alert badge only when a potential logic flaw, security vulnerability, or suggestion is detected; expands full critique card only when pinched.
- If something needs attention out of view: Soft low-latency audio chime when the AI raises its hand.

## Done criteria
Each one can be checked in Lens Studio's preview.
1. Standing in front of the virtual whiteboard in the interactive preview shows the initial drawn diagram at 1.15 m.
2. The diagram overlay sticks solidly to the whiteboard surface as the user moves and looks around with WASD and mouse.
3. Pinching any button on the 4-button SIK Component Palette (`Decision`, `Service`, `Database`, `Terminal`) injects a new node into the diagram.
4. Pinching the "Update / Snapshot" button refreshes the overlay with an updated multi-node diagram.
5. The 3D AI Orb displays in the peripheral view, transitions to the `HAND_RAISED` state with a visible title badge, and pinching the orb expands the critique card.
6. Pinching the "Conclude Meeting" button cleanly wraps up the meeting session.

## Out of scope
- Live on-device OCR / computer vision parsing arbitrary physical marker ink directly from a laptop webcam (faked via the preview simulation).
- Custom continuous two-hand gestures; fully driven by standard SIK pinch buttons.
- Multi-user colocation / connected lenses.

## Risks and open questions
- Optical stroke extraction accuracy under varying whiteboard glare and room lighting (feel unproven).
- Visual alignment drift over long sessions without persistent spatial anchors (feel unproven).

## Build notes for CLAD
- Build for SPECS so it runs and can be demonstrated in Lens Studio's preview. No SPECS device is available.
- Use Spectacles Interaction Kit (SIK) and UI Kit for all interactions, so they work with the mouse in Interactive Preview and with LEAF.
- Build any stand-in exactly as described above, and keep it obvious in the scene.
- Use real-world scale in centimeters. Keep content inside the user's view during the main task.
- The display is additive: black renders as transparent. Don't rely on black or very dark content to be seen; keep text light and readable from where the user stands.
- Get the basic flow working first, then add detail.
- Write LEAF scenarios for each done criterion, run them in preview, and report which pass. Say which criteria have no test.
- Don't record, identify, or follow people.

## After the build: judge it
This part is for you, after CLAD finishes.

1. **Does it work?** Ask your agent which LEAF tests passed and which done criteria have no test.
2. **Walk around it.** Open the preview in Interactive Preview. Use WASD to move, Q and E to go down and up, and right-drag (or hold Shift) to look around. Clicking acts as a pinch. Stand where a user would and look at the task.
3. **Ask the three questions.**
   - Does it use what I'm looking at?
   - Does it put something in my space, where it belongs?
   - Does it free my hands or let me keep my eyes up?
   - Would it be just as good on a phone? If so, what would make it need the glasses?
4. **Check comfort.**
   - Everything I need is in view while I do the task. Nothing sits at the edges, behind me, or stuck to my face.
   - Every control is within reach of someone standing there.
   - Text reads easily from where I stand. No dark UI disappearing.
   - Things show when needed and get out of the way.
5. **Label what you know.** Write "logic proven" next to anything the tests and preview show working, and "feel unproven" next to anything only real glasses could tell you (comfort over time, real hand tracking, real recognition).
6. **Fix with design notes, not code.** Tell your agent what to change in design terms, for example: "Move the step card 15 cm lower and next to the pan. Make the Next button twice as big. Re-run the tests." If a fix takes under a minute, like nudging a panel, do it yourself in the scene.
7. **Submit.** Record a video under 3 minutes of your Lens in the preview, public on YouTube. Make your repo public with your Lens Studio project and this `devpost/` folder. Details are on the hackathon site: https://learn-specs.devpost.com/resources
