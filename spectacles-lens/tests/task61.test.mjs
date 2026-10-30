import { test, describe, before, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  setupLensGlobalMocks,
  MockSceneObject,
  MockRenderMeshVisual,
  MockText,
  MockScriptEvent,
  MockTexture,
  MockBaseScriptComponent,
  MockTransform
} from './lens_mock_environment.mjs';

setupLensGlobalMocks();
global.BaseScriptComponent = MockBaseScriptComponent;
global.allowUndefined = () => {};
MockTransform.prototype.getWorldScale = function () { return this.scale; };
MockTransform.prototype.setWorldScale = function (s) { this.scale = s; };
MockTransform.prototype.getWorldRotation = function () { return this.rotation; };
MockTransform.prototype.setWorldRotation = function (r) { this.rotation = r; };
global.vec2 = class { constructor(x = 0, y = 0) { this.x = x; this.y = y; } };
global.vec4 = class { constructor(x = 0, y = 0, z = 0, w = 1) { this.x = x; this.y = y; this.z = z; this.w = w; } };
global.Shape = { createBoxShape: () => ({ size: null }) };
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

describe('Task 61: Physical Whiteboard 6-DOF Alignment (Depth & Yaw Calibration) and Hardware Passthrough Mode Toggle', () => {
  let WhiteboardCalibrator;
  let SpatialInterfaceManager;
  let DiagramOverlayView;

  before(async () => {
    ({ WhiteboardCalibrator } = await import('../dist/Assets/Scripts/WhiteboardCalibrator.js'));
    ({ SpatialInterfaceManager } = await import('../dist/Assets/Scripts/SpatialInterfaceManager.js'));
    ({ DiagramOverlayView } = await import('../dist/Assets/Scripts/DiagramOverlayView.js'));
  });

  afterEach(() => {
    delete global.deviceInfoSystem;
  });

  describe('AC1: WhiteboardCalibrator X, Y, Z translation (clamped to -400 <= Z <= -115cm) and yaw rotation', () => {
    test('drag(deltaY, deltaX, deltaZ) translates across X, Y, and Z within [-400, -115] bounds', () => {
      const cal = createComponentInstance(WhiteboardCalibrator);
      const board = new MockRenderMeshVisual();
      const statuses = [];
      cal.boardMesh = board;
      cal.onStatus = (msg) => statuses.push(msg);

      cal.placeForCalibration();
      assert.deepEqual([cal.getPosition().x, cal.getPosition().y, cal.getPosition().z], [50, 185, -230]);

      // Move X +10, Y -15, Z +30 (closer: -230 -> -200)
      cal.drag(-15, 10, 30);
      const pos = cal.getPosition();
      assert.equal(pos.x, 60);
      assert.equal(pos.y, 170);
      assert.equal(pos.z, -200);
      assert.match(statuses[statuses.length - 1], /Moving Whiteboard: Y = 170\.0 cm, Z = -200\.0 cm/);
    });

    test('clamps Z depth so whiteboard never comes closer than -115cm (1.15m optical comfort minimum) or farther than -400cm', () => {
      const cal = createComponentInstance(WhiteboardCalibrator);
      cal.boardMesh = new MockRenderMeshVisual();
      cal.placeForCalibration(); // Z = -230

      // Attempt to pull closer than -115cm (e.g. +200cm from -230cm -> -30cm)
      const nearPos = cal.adjustDepth(200);
      assert.equal(nearPos.z, -115);
      assert.equal(cal.getPosition().z, -115);

      // Attempt to push farther than -400cm (e.g. -350cm from -115cm -> -465cm)
      const farPos = cal.adjustDepth(-350);
      assert.equal(farPos.z, -400);
      assert.equal(cal.getPosition().z, -400);

      // Direct setPosition also enforces optical depth clamp
      cal.setPosition(10, 150, -50);
      assert.equal(cal.getPosition().z, -115);
      cal.setPosition(10, 150, -500);
      assert.equal(cal.getPosition().z, -400);
    });

    test('rotateYaw(deltaDegrees) and adjustYaw(deltaYawDeg) rotate whiteboard transform around world Y-axis', () => {
      const cal = createComponentInstance(WhiteboardCalibrator);
      const board = new MockRenderMeshVisual();
      const statuses = [];
      cal.boardMesh = board;
      cal.onStatus = (msg) => statuses.push(msg);
      cal.placeForCalibration();

      const rot1 = cal.rotateYaw(30);
      assert.equal(cal.getYaw(), 30);
      // 30 deg around Y-axis (0, 1, 0): sin(15 deg) ~= 0.258819, cos(15 deg) ~= 0.9659258
      assert.ok(Math.abs(rot1.y - Math.sin((15 * Math.PI) / 180)) < 1e-5);
      assert.ok(Math.abs(rot1.w - Math.cos((15 * Math.PI) / 180)) < 1e-5);
      assert.equal(rot1.x, 0);
      assert.equal(rot1.z, 0);
      assert.match(statuses[statuses.length - 1], /Rotating Whiteboard Yaw: 30\.0 deg/);

      // Additional -10 deg via adjustYaw -> net 20 deg around Y-axis
      const rot2 = cal.adjustYaw(-10);
      assert.equal(cal.getYaw(), 20);
      assert.ok(Math.abs(rot2.y - Math.sin((10 * Math.PI) / 180)) < 1e-5);
      assert.ok(Math.abs(rot2.w - Math.cos((10 * Math.PI) / 180)) < 1e-5);
    });

    test('setManipulationEnabled(true) enables 3-axis translation and Y-axis yaw rotation on SIK ManipulateComponent', () => {
      const cal = createComponentInstance(WhiteboardCalibrator);
      const board = new MockRenderMeshVisual();
      const sikManipulator = {
        enableTranslation: false,
        enableScale: false,
        enableRotation: false,
        enableXTranslation: false,
        enableYTranslation: false,
        enableZTranslation: false,
        rotationAxis: 'All'
      };
      board.sceneObject.getComponents = () => [sikManipulator];
      cal.boardMesh = board;

      cal.setManipulationEnabled(true);
      assert.equal(sikManipulator.enableTranslation, true);
      assert.equal(sikManipulator.enableScale, true);
      assert.equal(sikManipulator.enableRotation, true);
      assert.equal(sikManipulator.enableXTranslation, true);
      assert.equal(sikManipulator.enableYTranslation, true);
      assert.equal(sikManipulator.enableZTranslation, true);
      assert.equal(sikManipulator.enableYRotation, true);
      assert.equal(sikManipulator.rotationAxis, 'Y');

      cal.setManipulationEnabled(false);
      assert.equal(sikManipulator.enableTranslation, false);
      assert.equal(sikManipulator.enableScale, false);
      assert.equal(sikManipulator.enableRotation, false);
      assert.equal(sikManipulator.enableZTranslation, false);
      assert.equal(sikManipulator.enableYRotation, false);
    });

    test('SpatialInterfaceManager delegates adjustDepth and rotateYaw/adjustYaw to WhiteboardCalibrator', () => {
      const m = createComponentInstance(SpatialInterfaceManager);
      m.whiteboardBoardMesh = new MockRenderMeshVisual();
      m.diffToastText = new MockText('');
      m.onAwake();
      m._testEvents.OnStartEvent.trigger();

      m.adjustDepth(50); // -230 + 50 = -180
      assert.equal(m.getWhiteboardPosition().z, -180);

      m.adjustDepth(100); // clamped to -115
      assert.equal(m.getWhiteboardPosition().z, -115);

      m.adjustYaw(25);
      assert.equal(m.getWhiteboardYaw(), 25);
      m.rotateYaw(-5);
      assert.equal(m.getWhiteboardYaw(), 20);
    });
  });

  describe('AC2: Hardware passthrough mode makes WhiteboardBackplate transparent (alpha = 0.0) while preserving ColliderComponent and WhiteboardOverlayAnchor (alpha = 0.92)', () => {
    test('setHardwarePassthrough(true) sets backplate baseColor.w = 0.0, preserves ColliderComponent, and keeps overlay baseColor.w = 0.92', () => {
      const m = createComponentInstance(SpatialInterfaceManager);
      const board = new MockRenderMeshVisual();
      const overlay = new MockRenderMeshVisual();
      const collider = { enabled: true, shape: null, fitVisual: false };
      board.sceneObject.getComponent = (type) =>
        type === 'Physics.ColliderComponent' || type === 'ColliderComponent' ? collider : null;

      m.whiteboardBoardMesh = board;
      m.diagramOverlayMesh = overlay;
      m.diffToastText = new MockText('');
      m.onAwake();
      m._testEvents.OnStartEvent.trigger();

      // Enable hardware passthrough at runtime even though isPhysicalHardware started false
      assert.equal(m.isPhysicalHardware, false);
      m.setHardwarePassthrough(true);

      assert.equal(m.isPhysicalHardware, true);
      assert.equal(board.mainMaterial.mainPass.baseColor.w, 0.0);
      assert.equal(board.enabled, false);
      // SceneObject and ColliderComponent remain enabled for SIK raycast hit-testing
      assert.equal(board.getSceneObject().enabled, true);
      assert.equal(collider.enabled, true);

      // WhiteboardOverlayAnchor stays enabled with alpha = 0.92
      assert.equal(overlay.enabled, true);
      assert.equal(overlay.getSceneObject().enabled, true);
      assert.equal(overlay.mainMaterial.mainPass.baseColor.w, 0.92);

      // Toggling passthrough off restores opaque virtual whiteboard (alpha = 1.0)
      const afterToggle = m.toggleHardwarePassthrough();
      assert.equal(afterToggle, false);
      assert.equal(board.enabled, true);
      assert.equal(board.mainMaterial.mainPass.baseColor.w, 1.0);
      assert.equal(overlay.mainMaterial.mainPass.baseColor.w, 0.92);
    });

    test('auto-detects physical Spectacles device via deviceInfoSystem.isSpectacles() when isPhysicalHardware is left false in Scene.scene', () => {
      global.deviceInfoSystem = {
        isSpectacles: () => true,
        isEditor: () => false
      };

      const m = createComponentInstance(SpatialInterfaceManager);
      const board = new MockRenderMeshVisual();
      const overlay = new MockRenderMeshVisual();
      const collider = { enabled: true, shape: null, fitVisual: false };
      board.sceneObject.getComponent = (type) =>
        type === 'Physics.ColliderComponent' ? collider : null;

      m.isPhysicalHardware = false; // Left false in Scene.scene
      m.whiteboardBoardMesh = board;
      m.diagramOverlayMesh = overlay;
      m.diffToastText = new MockText('');
      m.texSelectArea = new MockTexture(10, 10);
      m.texEmpty = new MockTexture(10, 10);

      m.onAwake();
      m._testEvents.OnStartEvent.trigger();

      assert.equal(m.isPhysicalHardware, true);
      assert.equal(board.mainMaterial.mainPass.baseColor.w, 0.0);
      assert.equal(board.enabled, false);
      assert.equal(collider.enabled, true);
      assert.equal(overlay.enabled, true);
      assert.equal(overlay.mainMaterial.mainPass.baseColor.w, 0.92);
    });
  });
});
