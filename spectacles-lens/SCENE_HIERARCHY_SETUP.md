# Snap Lens Studio 5.15 Scene Hierarchy Setup Guide — SpecScribe AR

This guide documents the exact SceneObject hierarchy, component configurations, and spatial transforms required to wire SpecScribe AR in Snap Lens Studio 5.15+ for the Snap Spectacles (2024) Interactive Preview Panel.

---

## 1. Ergonomic Comfort Zone (1.0m – 1.3m)

Snap Spectacles optical waveguides project images onto a physical 1.0m focal plane with binocular overlap optimized at 1.1m. 
* All interactive affordances are placed between **-115cm** and **-120cm** along the forward Z-axis (`-Z`).
* Peripheral placements (left/right $\pm 38\text{cm}$) prevent central field-of-view occlusion while keeping raycasts responsive.

---

## 2. Scene Object Hierarchy & Transform Mapping

```text
Scene Root
├── Camera [Component.Camera]
│   ├── Position: (0, 0, 0)
│   └── Settings: Clear Color = True Black (#000000), Alpha = 0.0
│
├── SpatialHUDRoot [SceneObject]
│   │
│   ├── WhiteboardOverlayAnchor [SceneObject]
│   │   ├── Transform: Position: (0.0, 0.0, -120.0 cm) | Rotation: (0, 0, 0) | Scale: (80.0, 45.0, 1.0 cm)
│   │   ├── OverlayMesh [Component.RenderMeshVisual]
│   │   │   ├── Mesh: Screen Mesh / Unlit Quad
│   │   │   └── Material: Unlit (Blend Mode: PremultipliedAlpha, Base Texture: default transparent)
│   │   └── DiffToastText [Component.Text]
│   │       ├── Transform: Position: (0.0, -26.0, 0.0 cm)
│   │       └── Settings: Size: 22, Color: #00E5FF, Alignment: Center
│   │
│   ├── SIKPinchPaletteRoot [SceneObject]
│   │   ├── Transform: Position: (-38.0, 5.0, -115.0 cm) | Rotation: (0, +12, 0 deg)
│   │   │
│   │   ├── BtnAddDecision [SceneObject + SIK PinchButton + Interactable]
│   │   │   └── Text: "◇ Decision" | Color: #00E5FF
│   │   ├── BtnAddService [SceneObject + SIK PinchButton + Interactable]
│   │   │   └── Text: "▭ Service" | Color: #00FF66
│   │   ├── BtnAddDatabase [SceneObject + SIK PinchButton + Interactable]
│   │   │   └── Text: "🛢 Database" | Color: #00E5FF
│   │   └── BtnAddTerminal [SceneObject + SIK PinchButton + Interactable]
│   │       └── Text: "○ Terminal" | Color: #00FF66
│   │
│   └── RaisingHandAgentRoot [SceneObject]
│       ├── Transform: Position: (+38.0, 18.0, -115.0 cm) | Rotation: (0, -12, 0 deg)
│       ├── AgentOrbMesh [Component.RenderMeshVisual + SIK PinchButton + Interactable]
│       │   └── Material: Emissive Pulsing Shader (Cyan / Neon Green)
│       ├── HandRaisedPillBadge [SceneObject]
│       │   ├── Transform: Position: (0.0, 8.0, 0.0 cm) | Default: Disabled
│       │   └── PillTitleText [Component.Text] (Color: #00FF66, Max chars: 28)
│       ├── ExpandedCritiqueCard [SceneObject]
│       │   ├── Transform: Position: (-6.0, -14.0, 0.0 cm) | Default: Disabled
│       │   └── CritiqueBodyText [Component.Text] (Color: #FFFFFF, Size: 18)
│       └── AgentVoicePlayer [Component.AudioComponent]
│           └── Settings: PlaybackMode: Audio.PlaybackMode.LowLatency
│
├── SIK_InteractionManager [Prefab from SpectaclesInteractionKit.lspkg]
│   └── Ensure active in scene to enable hand-tracking raycasters.
│
└── SpecScribeControllers [SceneObject]
    ├── Script: PeriodicCameraCapturer.ts
    ├── Script: PersistentStreamSocketClient.ts
    ├── Script: SpatialInterfaceManager.ts
    └── Script: RaisingHandAgentController.ts
```

---

## 3. Script Input Wiring

1. **`PeriodicCameraCapturer.ts`:**
   * `sampleIntervalSeconds`: `3.0`
   * `frameSmallerDimension`: `480`
2. **`PersistentStreamSocketClient.ts`:**
   * `websocketUrl`: `ws://localhost:8000/ws/meeting/demo-session-01`
   * `cameraCapturer`: Link to `PeriodicCameraCapturer`
3. **`SpatialInterfaceManager.ts`:**
   * `socketClient`: Link to `PersistentStreamSocketClient`
   * `btnAddDecision`: Link to `BtnAddDecision` PinchButton
   * `btnAddService`: Link to `BtnAddService` PinchButton
   * `btnAddDatabase`: Link to `BtnAddDatabase` PinchButton
   * `btnAddTerminal`: Link to `BtnAddTerminal` PinchButton
   * `diagramOverlayMesh`: Link to `OverlayMesh` RenderMeshVisual
   * `diffToastText`: Link to `DiffToastText` Text
4. **`RaisingHandAgentController.ts`:**
   * `socketClient`: Link to `PersistentStreamSocketClient`
   * `agentOrbPinchButton`: Link to `AgentOrbMesh` PinchButton
   * `handRaisedPillObject`: Link to `HandRaisedPillBadge`
   * `pillTitleText`: Link to `PillTitleText`
   * `expandedCritiqueCard`: Link to `ExpandedCritiqueCard`
   * `critiqueBodyText`: Link to `CritiqueBodyText`
   * `agentAudioComponent`: Link to `AgentVoicePlayer`
