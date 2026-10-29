# Reverse Engineering Log — SpecScribe AR

This document tracks all architectural analysis, audit of existing codebase components, decisions regarding reusing, modifying, or replacing code, and LEAF automated verification to fully satisfy `devpost/design-brief.md` for SPECS within the CLAD process.

---

## 1. Executive Summary & Assessment

An initial codebase existed in `spectacles-lens/Assets/Scripts/` and `spectacles-lens/SCENE_HIERARCHY_SETUP.md`. While the high-level intent aligned with SpecScribe AR, a deep structural and runtime inspection revealed critical blockers preventing the Lens from functioning in Lens Studio Preview and satisfying the design brief:

1. **Scene Graph Misplacement (Glued-to-Head Bug):**
   - In the live scene, `SpatialHUDRoot` was parented under `Camera Object`.
   - **Impact:** Any camera movement (WASD or mouse look) rotated and translated the whiteboard, palette, and AI orb along with the user's head.
   - **Requirement (Done Criterion 2):** "The diagram overlay sticks solidly to the whiteboard surface as the user moves and looks around with WASD and mouse." Content must exist in World space at 1.15 m, completely unparented from the Camera.

2. **Empty SceneObject Affordances (Ghost UI):**
   - The scene objects `BtnAddDecision`, `BtnAddService`, `BtnAddDatabase`, `BtnAddTerminal`, `AgentOrbMesh`, `ResearchingRingMesh`, `HandRaisedPillBadge`, and `ExpandedCritiqueCard` had **zero components attached** (`components: []`).
   - `WhiteboardOverlayAnchor` had a `RenderMeshVisual` with `mesh: null` and `mainMaterial: null`.
   - None of the buttons had `ColliderComponent`, `Interactable`, mesh visuals, or labels. They could not be hovered, pinched, or seen in preview or by LEAF.

3. **External Backend Dependency & Lack of Stand-in Simulation:**
   - `SpatialInterfaceManager.ts` and `RaisingHandAgentController.ts` relied entirely on callbacks from `PersistentStreamSocketClient.ts` connected to `ws://localhost:8000/ws/meeting/demo-session-01`.
   - In preview, without a local backend server running on port 8000, no initial diagram was displayed, pinch interactions did not update any overlay, and the AI agent never raised its hand.
   - **Requirement:** Design brief explicitly calls for a self-contained preview stand-in where the initial diagram renders at 1.15 m, palette pinches add nodes, the Update button refreshes the multi-node diagram, and the AI agent raises its hand with an alert badge and expandable critique card.

4. **Missing Done Criteria Controls:**
   - No "Update / Snapshot" button existed in the scene or scripts (Done Criterion 4).
   - No "Conclude Meeting" button existed in the scene or scripts (Done Criterion 6).

5. **Runtime API Assumptions & Lookups:**
   - Code assumed `global.scene.findObjectByName(name)` existed. In Lens Studio runtime `ScriptScene`, there is no `findObjectByName`. Scene traversal must recursively inspect root objects via `global.scene.getRootObjectsCount()` and `global.scene.getRootObject(i)`.
   - SIK `Interactable` script instances must be accessed via `obj.getComponent(Interactable.getTypeName())`, rather than iterating generic `ScriptComponent` references.

---

## 2. Component-by-Component Decision Matrix

| File / Component | Previous State | Decision | Technical Rationale |
|---|---|---|---|
| **Scene Graph Hierarchy** (`SpatialHUDRoot`) | Parented under `Camera Object`; empty children | **Restructure & Rebuild** | Moved `SpatialHUDRoot` to Scene Root (`parentId: null`), placing content in 3D World space at $Z = -115\text{cm}$ / $-116\text{cm}$. Populated actual visual meshes (`BoxMeshPreset`, `SphereMeshPreset`, `PlaneMeshPreset`), `ColliderComponent`, and SIK `Interactable` components. |
| **Camera Tracking Mode** | Set to `Surface` | **Modify** | Switched `DeviceTracking` mode on `Camera Object` to `"World"`, ensuring full 6-DOF world stability. |
| **`WhiteboardOverlayAnchor`** | Unlit mesh visual with `mesh: null`, `mainMaterial: null` | **Modify & Author** | Created `WhiteboardBackplate` (physical whiteboard stand-in) and `WhiteboardOverlayAnchor` with plane mesh presets, rotated $90^\circ$ around X to face camera, with textures converted from generated SVGs via `ConvertSvgToTexture`. Set `twoSided: true` and enabled `ENABLE_BASE_TEX` define. |
| **`SpatialInterfaceManager.ts`** | Handled 4 palette buttons with external websocket dependency; missing Update and Conclude controls; broken scene lookup | **Enhance & Refactor** | Retained public API and SIK event contracts; added recursive scene tree traversal (`global.scene.getRootObject`); added SIK pinch handlers for `BtnUpdateSnapshot` and `BtnConcludeMeeting`; implemented reactive 4-stage Sugiyama DAG state machine with high-contrast textures; wired audio feedback chime. |
| **`RaisingHandAgentController.ts`** | Had state machine (`IDLE`, `RESEARCHING`, `HAND_RAISED`), pulse animations, but required websocket trigger and lacked SIK interactable binding | **Enhance & Align** | Retained state machine and pulse animations; wired SIK `Interactable` on `AgentOrbMesh`; added proactive hand-raising trigger when nodes are added; wired expandable `ExpandedCritiqueCard` and `HandRaisedPillBadge`; integrated low-latency `AudioComponent` playing `AgentNotificationChime.wav`. |
| **`PersistentStreamSocketClient.ts`** | Live WebSocket client with reconnect loop | **Retained as Optional Bridge** | Preserved for hardware/remote backend streaming while ensuring graceful offline fallback in preview. |
| **`PeriodicCameraCapturer.ts`** | Captures camera frames every 3s via CameraModule | **Retained as Subsystem** | Useful for real hardware camera capture; non-interfering in preview. |
| **`NodeRegistry.ts`** | Color definitions for nodes | **Retained & Extended** | Defines Sugiyama DAG color schemes (#00FF66 phosphor green, #00E5FF cyan, #FFB020 amber). |
| **SFX Assets** | No sound assets existed | **Created Fresh** | Algorithmic sound synthesis via `build-sfx` generating clean 44.1 kHz WAVs in `Assets/GeneratedSFX/`: `AgentNotificationChime.wav`, `ButtonClick.wav`, `MeetingConcludeSuccess.wav`. |
| **LEAF Test Scenarios** | Did not exist (`scenarios: []`) | **Created Fresh** | Authored modular `@component` test scenarios in `Assets/Scripts/` (`SpecScribeDC1Scenario.ts` through `SpecScribeDC6Scenario.ts`) registered in `LeafIndex.ts`, directly testing all 6 Done Criteria. |

---

## 3. Implementation Details & Technical Fixes

1. **Lens Studio Plane Mesh Orientation & Dimensions:**
   - In Lens Studio, `PlaneMeshPreset` vertices lie horizontally on the X-Z plane (`aabbSize: {x: 1, y: 0, z: 1}`).
   - To mount the whiteboard vertically facing the user, transforms require `rotation: { x: 90, y: 0, z: 0 }`, `scale: { x: 100, y: 1, z: 68 }` for backplate and `scale: { x: 96, y: 1, z: 64 }` for overlay.
   - Material defines: `UnlitMaterialPreset` requires boolean define `passInfos.0.ENABLE_BASE_TEX: true` before `baseTex` can be assigned, and `twoSided: true` to prevent backface culling.

2. **GraphQL Subfield Selection Requirement:**
   - In Lens Studio MCP `scene-graphql`, mutation `setLocalTransform` returns composite type `MutationResult!`. Calls without `{ id name }` selection failed silently in editor. Added selection fields across all script mutations.

3. **One Component Class Per Source File:**
   - Lens Studio TypeScript compiler enforces `error TS12345: Only one component class per source file is allowed.`
   - Refactored LEAF scenarios into single-class files (`SpecScribeDC1Scenario.ts` through `SpecScribeDC6Scenario.ts`) with shared utilities in `SpecScribeTestHelpers.ts`.

4. **Scene Hierarchy Traversal:**
   - Replaced non-existent `global.scene.findObjectByName` with recursive traversal of `global.scene.getRootObject(i)` for $0 \le i < \text{getRootObjectsCount()}$.

5. **SIK Interactable Resolution:**
   - Replaced generic `ScriptComponent` inspections with `obj.getComponent(Interactable.getTypeName())` and subscribed to `onTriggerEnd.add(...)` inside `OnStartEvent`.

---

## 4. LEAF Automated Verification & Results Matrix

All 6 Done Criteria specified in `devpost/design-brief.md` were authored as automated LEAF scenarios, registered in `LeafIndex.ts`, and executed in the live Lens Studio Preview panel via the Lens Studio MCP (`run_leaf_scenario`):

| Done Criterion | LEAF Scenario Class / ID | Description | Automated Actions & Assertions | Status |
|---|---|---|---|---|
| **DC 1** | `SpecScribeDC1Scenario`<br>`id: "dc1-whiteboard-anchor"` | Standing in front of the virtual whiteboard in interactive preview shows the initial drawn diagram at 1.15 m. | • Verifies `WhiteboardBackplate` and `WhiteboardOverlayAnchor` are enabled.<br>• Asserts world depth $-135\text{cm} \le Z \le -95\text{cm}$ (at 1.15 m).<br>• Asserts initial diagram stage is 0 (Sugiyama DAG loaded). | ✅ **PASSED** |
| **DC 2** | `SpecScribeDC2Scenario`<br>`id: "dc2-world-anchor-mobility"` | The diagram overlay sticks solidly to the whiteboard surface as user moves and looks around with WASD and mouse. | • Asserts `SpatialHUDRoot` is NOT parented to Camera (no glued-to-head bug).<br>• Verifies `DeviceTracking` mode is `"World"`.<br>• Asserts overlay and backplate world XY alignment delta $< 5\text{cm}$. | ✅ **PASSED** |
| **DC 3** | `SpecScribeDC3Scenario`<br>`id: "dc3-palette-node-injection"` | Pinching any button on the 4-button SIK Component Palette (`Decision`, `Service`, `Database`, `Terminal`) injects a new node into the diagram. | • Uses `DefaultLeafInteractor` to pinch `BtnAddDecision`, `BtnAddService`, `BtnAddDatabase`, and `BtnAddTerminal`.<br>• Asserts node count increments per pinch ($4 \to 5 \to 6 \to 7 \to 8$).<br>• Asserts diagram stage updates to 1. | ✅ **PASSED** |
| **DC 4** | `SpecScribeDC4Scenario`<br>`id: "dc4-update-snapshot"` | Pinching the "Update / Snapshot" button refreshes the overlay with an updated multi-node diagram. | • Triggers `BtnUpdateSnapshot` via SIK interactable.<br>• Asserts diagram stage updates to 2.<br>• Asserts HUD toast contains "Snapshot Synced". | ✅ **PASSED** |
| **DC 5** | `SpecScribeDC5Scenario`<br>`id: "dc5-ai-orb-hand-raised"` | The 3D AI Orb displays in peripheral view, transitions to `HAND_RAISED` state with visible title badge, and pinching the orb expands the critique card. | • Asserts AI Orb world position is in peripheral upper-right ($X > 25\text{cm}$, $Y > 5\text{cm}$, $Z \le -90\text{cm}$).<br>• Triggers proactive hand-raising with `VULNERABILITY` critique.<br>• Asserts `AgentState.HAND_RAISED` and `HandRaisedPillBadge` is enabled.<br>• Pinches `AgentOrbMesh` and asserts `ExpandedCritiqueCard` is enabled. | ✅ **PASSED** |
| **DC 6** | `SpecScribeDC6Scenario`<br>`id: "dc6-conclude-meeting"` | Pinching the "Conclude Meeting" button cleanly wraps up the meeting session. | • Triggers `BtnConcludeMeeting` via SIK interactable.<br>• Asserts `isMeetingConcluded() === true`.<br>• Asserts diagram stage is 3 (concluded spec overview).<br>• Asserts HUD toast contains "Meeting Concluded". | ✅ **PASSED** |

### Overall Verdict:
**6 of 6 Done Criteria automated and 100% PASSING in Lens Studio Preview.**
No criteria left untested.
