import { test, describe, before, beforeEach, afterEach } from 'node:test';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {
  setupLensGlobalMocks,
  MockSceneObject,
  MockRenderMeshVisual,
  MockText,
  MockScriptEvent,
  MockTexture,
  MockPinchButton,
  MockWebSocket,
  MockBaseScriptComponent,
  MockTransform
} from './lens_mock_environment.mjs';

setupLensGlobalMocks();
global.BaseScriptComponent = MockBaseScriptComponent;
global.allowUndefined = () => {};
MockTransform.prototype.getWorldScale = function () { return this.scale; };
MockTransform.prototype.setWorldScale = function (s) { this.scale = s; };
global.vec2 = class { constructor(x = 0, y = 0) { this.x = x; this.y = y; } };
global.getTime = () => 100;

function createComponentInstance(Cls, sceneObject = new MockSceneObject('TestComponentObj')) {
  const events = {
    OnStartEvent: new MockScriptEvent(),
    UpdateEvent: new MockScriptEvent(),
    OnDestroyEvent: new MockScriptEvent()
  };
  const instance = new Cls();
  instance.createEvent = (eventType) => {
    if (!events[eventType]) events[eventType] = new MockScriptEvent();
    return events[eventType];
  };
  instance.getSceneObject = () => sceneObject;
  instance.getTransform = () => sceneObject.getTransform();
  instance._testEvents = events;
  return instance;
}

function installEncoder() {
  const enc = { count: 0 };
  global.Base64.encodeTextureAsync = (tex, onSuccess) => {
    enc.count++;
    onSuccess(`encoded-frame-${enc.count}`);
  };
  return enc;
}

describe('Task 54: Wire 3D Capture & Mode-Toggle SIK Buttons in Scene and SpatialInterfaceManager', () => {
  let PeriodicCameraCapturer, CaptureMode;
  let SpatialInterfaceManager, PaletteController, WhiteboardCaptureSwitch, formatModeBadge, PersistentStreamSocketClient;
  const originalScene = global.scene;
  const originalPrint = global.print;

  before(async () => {
    ({ PeriodicCameraCapturer, CaptureMode } = await import('../dist/Assets/Scripts/PeriodicCameraCapturer.js'));
    ({ SpatialInterfaceManager } = await import('../dist/Assets/Scripts/SpatialInterfaceManager.js'));
    ({ PaletteController } = await import('../dist/Assets/Scripts/PaletteController.js'));
    ({ WhiteboardCaptureSwitch, formatModeBadge } = await import('../dist/Assets/Scripts/WhiteboardCaptureSwitch.js'));
    ({ PersistentStreamSocketClient } = await import('../dist/Assets/Scripts/PersistentStreamSocketClient.js'));
  });

  beforeEach(() => {
    installEncoder();
  });

  afterEach(() => {
    global.scene = originalScene;
    global.print = originalPrint;
    global._mockSocket = undefined;
  });

  function startedCapturer(mode) {
    const capturer = createComponentInstance(PeriodicCameraCapturer);
    capturer.cameraModule = { requestCamera: () => new MockTexture(480, 360) };
    if (mode !== undefined) capturer.captureMode = mode;
    capturer.onAwake();
    capturer._testEvents.OnStartEvent.trigger();
    const frames = [];
    capturer.onEncodedFrameAvailable = (b64) => frames.push(b64);
    return { capturer, frames };
  }

  describe('AC1: Scene.scene and .virtual-scene.json include BtnCaptureWhiteboard and BtnToggleCaptureMode', () => {
    test('Scene.scene defines SpatialActionPalette, BtnCaptureWhiteboard, and BtnToggleCaptureMode with SIK Interactable', () => {
      const scenePath = new URL('../Assets/Scene.scene', import.meta.url);
      const sceneContent = fs.readFileSync(scenePath, 'utf8');

      assert.ok(sceneContent.includes('Name: SpatialActionPalette'), 'SpatialActionPalette missing in Scene.scene');
      assert.ok(sceneContent.includes('Name: BtnCaptureWhiteboard'), 'BtnCaptureWhiteboard missing in Scene.scene');
      assert.ok(sceneContent.includes('Name: BtnToggleCaptureMode'), 'BtnToggleCaptureMode missing in Scene.scene');
      assert.ok(sceneContent.includes('btnCaptureWhiteboard:'), 'btnCaptureWhiteboard input missing in Scene.scene');
      assert.ok(sceneContent.includes('btnToggleCaptureMode:'), 'btnToggleCaptureMode input missing in Scene.scene');
    });

    test('.virtual-scene.json defines SpatialActionPalette, BtnCaptureWhiteboard, and BtnToggleCaptureMode with Interactable components', () => {
      const vScenePath = new URL('../.virtual-scene.json', import.meta.url);
      const vScene = JSON.parse(fs.readFileSync(vScenePath, 'utf8'));

      const palette = vScene.sceneObjects.find((o) => o.name === 'SpatialActionPalette');
      const btnCapture = vScene.sceneObjects.find((o) => o.name === 'BtnCaptureWhiteboard');
      const btnToggle = vScene.sceneObjects.find((o) => o.name === 'BtnToggleCaptureMode');

      assert.ok(palette, 'SpatialActionPalette missing in .virtual-scene.json');
      assert.ok(btnCapture, 'BtnCaptureWhiteboard missing in .virtual-scene.json');
      assert.ok(btnToggle, 'BtnToggleCaptureMode missing in .virtual-scene.json');
      assert.equal(btnCapture.parentId, palette.id);
      assert.equal(btnToggle.parentId, palette.id);

      const captureInteractable = btnCapture.components.find((c) => c.name === 'Interactable');
      const toggleInteractable = btnToggle.components.find((c) => c.name === 'Interactable');
      assert.ok(captureInteractable, 'BtnCaptureWhiteboard missing Interactable component');
      assert.ok(toggleInteractable, 'BtnToggleCaptureMode missing Interactable component');
    });

    test('PaletteController.resolveReferences() resolves BtnCaptureWhiteboard and BtnToggleCaptureMode from scene hierarchy without warnings', () => {
      const vScenePath = new URL('../.virtual-scene.json', import.meta.url);
      const vScene = JSON.parse(fs.readFileSync(vScenePath, 'utf8'));

      const byId = new Map();
      for (const o of vScene.sceneObjects) {
        const interactableComp = (o.components || []).find((c) => c.name === 'Interactable');
        const interactableInstance = interactableComp ? new MockPinchButton() : null;
        byId.set(o.id, {
          name: o.name,
          parentId: o.parentId,
          children: [],
          getChildrenCount() { return this.children.length; },
          getChild(i) { return this.children[i]; },
          getComponent() { return interactableInstance; }
        });
      }
      const roots = [];
      for (const node of byId.values()) {
        if (node.parentId && byId.has(node.parentId)) {
          byId.get(node.parentId).children.push(node);
        } else {
          roots.push(node);
        }
      }
      global.scene = {
        getRootObjectsCount: () => roots.length,
        getRootObject: (i) => roots[i]
      };

      const logs = [];
      global.print = (msg) => logs.push(String(msg));

      const palette = new PaletteController();
      palette.resolveReferences();

      assert.ok(palette.btnCaptureWhiteboard, 'btnCaptureWhiteboard should resolve from scene');
      assert.ok(palette.btnToggleCaptureMode, 'btnToggleCaptureMode should resolve from scene');
      const notFoundLogs = logs.filter((l) => l.includes('Object "BtnCaptureWhiteboard" not found') || l.includes('Object "BtnToggleCaptureMode" not found'));
      assert.equal(notFoundLogs.length, 0, `Expected no not-found warnings, got: ${notFoundLogs.join('; ')}`);
    });
  });

  describe('AC2: Legacy @input fallback wiring, mode switching, HUD toast, and mode badge', () => {
    test('formatModeBadge formats AUTO (3s) and MANUAL badges', () => {
      assert.equal(formatModeBadge(CaptureMode.AUTO, 3), 'CAPTURE: AUTO (3s)');
      assert.equal(formatModeBadge(CaptureMode.MANUAL, 3), 'CAPTURE: MANUAL');
    });

    test('SpatialInterfaceManager legacy @inputs (btnCaptureWhiteboard, btnToggleCaptureMode, captureModeStatusText) wire into PaletteController and toggle mode with HUD toast and badge', () => {
      const so = new MockSceneObject('SpecScribeControllers');
      const { capturer } = startedCapturer(CaptureMode.AUTO);
      const m = createComponentInstance(SpatialInterfaceManager, so);
      so.getComponents = () => [m, capturer];

      const btnCapture = new MockPinchButton();
      const btnToggle = new MockPinchButton();
      const toastText = new MockText('');
      const badgeText = new MockText('');

      m.btnCaptureWhiteboard = btnCapture;
      m.btnToggleCaptureMode = btnToggle;
      m.diffToastText = toastText;
      m.captureModeStatusText = badgeText;
      m.whiteboardBoardMesh = new MockRenderMeshVisual();

      const modeChanges = [];
      const palette = new PaletteController();
      palette.onModeChanged = (mode) => modeChanges.push(mode);
      m.paletteController = palette;

      m.onAwake();
      m._testEvents.OnStartEvent.trigger();

      assert.equal(palette.btnCaptureWhiteboard, btnCapture, 'PaletteController adopted legacy btnCaptureWhiteboard');
      assert.equal(palette.btnToggleCaptureMode, btnToggle, 'PaletteController adopted legacy btnToggleCaptureMode');
      assert.equal(badgeText.text, 'CAPTURE: AUTO (3s)');

      // Pinch BtnToggleCaptureMode: AUTO -> MANUAL
      btnToggle.simulatePinch();
      assert.equal(m.capture.getMode(), CaptureMode.MANUAL);
      assert.equal(capturer.getCaptureMode(), CaptureMode.MANUAL);
      assert.match(m.getToastText(), /Capture: MANUAL/);
      assert.equal(badgeText.text, 'CAPTURE: MANUAL');
      assert.deepEqual(modeChanges, ['manual']);

      // Pinch BtnToggleCaptureMode: MANUAL -> AUTO (3s)
      btnToggle.simulatePinch();
      assert.equal(m.capture.getMode(), CaptureMode.AUTO);
      assert.equal(capturer.getCaptureMode(), CaptureMode.AUTO);
      assert.match(m.getToastText(), /Capture: AUTO • every 3s/);
      assert.equal(badgeText.text, 'CAPTURE: AUTO (3s)');
      assert.deepEqual(modeChanges, ['manual', 'auto']);
    });

    test('PaletteController.attach() adopts LegacyPaletteInputs and binds target', () => {
      const so = new MockSceneObject('SpecScribeControllers');
      const { capturer } = startedCapturer(CaptureMode.AUTO);
      const m = createComponentInstance(SpatialInterfaceManager, so);
      so.getComponents = () => [m, capturer];
      m.diffToastText = new MockText('');

      const btnCapture = new MockPinchButton();
      const btnToggle = new MockPinchButton();
      const palette = new PaletteController();
      palette.attach(so, { btnCaptureWhiteboard: btnCapture, btnToggleCaptureMode: btnToggle }, m);

      assert.equal(palette.btnCaptureWhiteboard, btnCapture);
      assert.equal(palette.btnToggleCaptureMode, btnToggle);
      btnToggle.simulatePinch();
      assert.equal(m.capture.getMode(), CaptureMode.MANUAL);
    });
  });

  describe('AC3: Pinching BtnCaptureWhiteboard triggers captureNow() -> triggerManualCapture() -> cameraFrame WebSocket message', () => {
    test('end-to-end: pinching legacy btnCaptureWhiteboard emits a manual cameraFrame over WebSocket in AUTO and MANUAL', () => {
      const ws = new MockWebSocket('ws://localhost:8000/ws/meeting/task54');
      global._mockSocket = ws;
      global._mockAsrHandler = () => {};

      const so = new MockSceneObject('SpecScribeControllers');
      const { capturer } = startedCapturer(CaptureMode.AUTO);
      const client = createComponentInstance(PersistentStreamSocketClient, so);
      client.cameraCapturer = capturer;
      client.onAwake();
      client._testEvents.OnStartEvent.trigger();

      const m = createComponentInstance(SpatialInterfaceManager, so);
      so.getComponents = () => [m, capturer, client];

      const btnCapture = new MockPinchButton();
      const btnToggle = new MockPinchButton();
      m.btnCaptureWhiteboard = btnCapture;
      m.btnToggleCaptureMode = btnToggle;
      m.socketClient = client;
      m.diffToastText = new MockText('');
      m.whiteboardBoardMesh = new MockRenderMeshVisual();

      m.onAwake();
      m._testEvents.OnStartEvent.trigger();

      const cameraFrames = () =>
        ws.sentMessages.map((s) => JSON.parse(s)).filter((p) => p.eventType === 'cameraFrame');

      // In AUTO mode, pinching BtnCaptureWhiteboard still captures, flagged as manual for the backend
      btnCapture.simulatePinch();
      assert.equal(cameraFrames().length, 1);
      assert.equal(cameraFrames()[0].isManual, true);
      assert.equal(cameraFrames()[0].captureMode, 'AUTO');
      assert.match(m.getToastText(), /Whiteboard captured/);

      // Toggle to MANUAL mode via BtnToggleCaptureMode, then pinch BtnCaptureWhiteboard
      btnToggle.simulatePinch();
      assert.equal(m.capture.getMode(), CaptureMode.MANUAL);

      btnCapture.simulatePinch();
      const emitted = cameraFrames();
      assert.equal(emitted.length, 2);
      assert.equal(emitted[1].image_b64, 'encoded-frame-2');
      assert.equal(emitted[1].captureMode, 'MANUAL');
      assert.match(m.getToastText(), /Whiteboard captured/);
    });
  });
});
