# Spectacles Lens Studio 5.15 Client — SpecScribe AR

This directory contains the Snap Lens Studio 5.15+ project assets, TypeScript scripts, and scene hierarchy configurations for SpecScribe AR, targeting Snap Spectacles (2024) and the Lens Studio Interactive Preview Panel.

## Directory Structure
* `SCENE_HIERARCHY_SETUP.md`: Step-by-step transform guide to place objects in the 1.0m–1.3m optical comfort zone.
* `Assets/Scripts/PeriodicCameraCapturer.ts`: Samples frames at 480p and encodes off-thread via `Base64.encodeTextureAsync`.
* `Assets/Scripts/PersistentStreamSocketClient.ts`: Full-duplex WebSocket client streaming `AsrModule` speech and camera frames.
* `Assets/Scripts/SpatialInterfaceManager.ts`: SIK `PinchButton` component palette and transparent AR texture decoder.
* `Assets/Scripts/RaisingHandAgentController.ts`: Ambient 3D AI Teammate Orb with proactive hand-raising and research capabilities.
