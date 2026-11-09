import { test, describe, before, beforeEach } from 'node:test';
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

// Counts encodes; `deferred` holds the success callback so a test can keep the encoder busy.
function installEncoder({ deferred = false } = {}) {
  const enc = { count: 0, pending: [] };
  global.Base64.encodeTextureAsync = (tex, onSuccess) => {
    enc.count++;
    const done = () => onSuccess(`frame-${enc.count}`);
    if (deferred) enc.pending.push(done);
    else done();
  };
  return enc;
}

function socketStub() {
  const sent = [];
  return {
    sent,
    consumeLatestSpokenPhrase: () => null,
    sendPinchCommand: (action, type, label) => sent.push({ action, type, label }),
    clearLastSentCommand: () => { sent.length = 0; },
    onDiagramUpdated: () => {},
    onDecisionLogged: () => {}
  };
}

const tick = (component, seconds) => component._testEvents.UpdateEvent.trigger({ getDeltaTime: () => seconds });

describe('Whiteboard capture: every pinch captures; AUTO adds periodic frames, MANUAL is pinch-only', () => {
  let PeriodicCameraCapturer, CaptureMode, normalizeCaptureMode;
  let SpatialInterfaceManager, WhiteboardState, PaletteController, PersistentStreamSocketClient;

  before(async () => {
    ({ PeriodicCameraCapturer, CaptureMode, normalizeCaptureMode } = await import('../dist/Assets/Scripts/PeriodicCameraCapturer.js'));
    ({ SpatialInterfaceManager, WhiteboardState } = await import('../dist/Assets/Scripts/SpatialInterfaceManager.js'));
    ({ PaletteController } = await import('../dist/Assets/Scripts/PaletteController.js'));
    ({ PersistentStreamSocketClient } = await import('../dist/Assets/Scripts/PersistentStreamSocketClient.js'));
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

  describe('PeriodicCameraCapturer', () => {
    let enc;
    beforeEach(() => { enc = installEncoder(); });

    test('defaults to AUTO; only "manual" (any case/whitespace) selects MANUAL', () => {
      assert.equal(startedCapturer().capturer.getCaptureMode(), CaptureMode.AUTO);
      assert.equal(normalizeCaptureMode('manual'), 'manual');
      assert.equal(normalizeCaptureMode(' MANUAL '), 'manual');
      for (const v of ['auto', 'AUTO', '', 'bogus', undefined, null, 3]) {
        assert.equal(normalizeCaptureMode(v), 'auto', String(v));
      }
      assert.equal(startedCapturer('Manual').capturer.getCaptureMode(), CaptureMode.MANUAL, 'Inspector value is honoured');
    });

    test('AUTO: captures every 3s without pinches', () => {
      const { capturer, frames } = startedCapturer();
      tick(capturer, 2.9);
      assert.equal(frames.length, 0);
      tick(capturer, 0.2);
      assert.equal(frames.length, 1);
      for (let i = 0; i < 6; i++) tick(capturer, 1.0);
      assert.equal(frames.length, 3, 'one frame per 3s interval');
    });

    test('AUTO: a pinch captures immediately and restarts the 3s timer', () => {
      const { capturer, frames } = startedCapturer();
      tick(capturer, 2.5);
      assert.equal(capturer.triggerManualCapture(), true);
      assert.equal(frames.length, 1, 'pinch encodes in AUTO too');
      tick(capturer, 1.0);
      assert.equal(frames.length, 1, 'the stale 2.5s must not fire a periodic frame right behind the pinch');
      tick(capturer, 2.0);
      assert.equal(frames.length, 2);
    });

    test('MANUAL: periodic cadence is idle; each pinch captures exactly one frame', () => {
      const { capturer, frames } = startedCapturer('manual');
      for (let i = 0; i < 30; i++) tick(capturer, 1.0);
      assert.equal(enc.count, 0, '30s of updates must not capture in MANUAL');
      assert.equal(capturer.triggerManualCapture(), true);
      assert.deepEqual(frames, ['frame-1']);
      assert.equal(capturer.triggerManualCapture(), true);
      assert.equal(frames.length, 2);
    });

    test('MANUAL: a pinch while an encode is in flight is rejected, then accepted once it completes', () => {
      enc = installEncoder({ deferred: true });
      const { capturer, frames } = startedCapturer('manual');
      assert.equal(capturer.triggerManualCapture(), true);
      assert.equal(capturer.triggerManualCapture(), false);
      assert.equal(enc.count, 1);
      enc.pending.shift()();
      assert.equal(frames.length, 1);
      assert.equal(capturer.triggerManualCapture(), true);
    });

    test('MANUAL: returns false when the camera texture is not ready', () => {
      const capturer = createComponentInstance(PeriodicCameraCapturer);
      capturer.cameraModule = { requestCamera: () => new MockTexture(0, 0) };
      capturer.captureMode = 'manual';
      capturer.onAwake();
      capturer._testEvents.OnStartEvent.trigger();
      assert.equal(capturer.triggerManualCapture(), false);
      assert.equal(enc.count, 0);
    });

    test('switching modes swaps which path is live and restarts the 3s timer', () => {
      const { capturer, frames } = startedCapturer();
      tick(capturer, 2.5);
      assert.equal(capturer.toggleCaptureMode(), CaptureMode.MANUAL);
      tick(capturer, 5);
      assert.equal(frames.length, 0, 'no periodic frame after switching to MANUAL');
      assert.equal(capturer.triggerManualCapture(), true);
      assert.equal(frames.length, 1);

      assert.equal(capturer.toggleCaptureMode(), CaptureMode.AUTO);
      tick(capturer, 2.0);
      assert.equal(frames.length, 1, 'switching back to AUTO restarts the timer');
      tick(capturer, 1.0);
      assert.equal(frames.length, 2);
      assert.equal(capturer.triggerManualCapture(), true, 'pinch still captures in AUTO');
      assert.equal(frames.length, 3);
    });

    test('onCaptureModeChanged fires only on an actual change', () => {
      const { capturer } = startedCapturer();
      const changes = [];
      capturer.onCaptureModeChanged = (m) => changes.push(m);
      capturer.setCaptureMode('auto');
      capturer.setCaptureMode('manual');
      capturer.setCaptureMode('MANUAL');
      capturer.toggleCaptureMode();
      assert.deepEqual(changes, ['manual', 'auto']);
    });

    test('mixed timeline: pinches capture in both modes; the timer only in AUTO', () => {
      const { capturer, frames } = startedCapturer();
      const sources = [];
      const pinch = () => { const before = frames.length; capturer.triggerManualCapture(); if (frames.length > before) sources.push(`pinch:${capturer.getCaptureMode()}`); };
      const advance = (s) => { const before = frames.length; tick(capturer, s); if (frames.length > before) sources.push(`timer:${capturer.getCaptureMode()}`); };
      advance(3); pinch(); pinch();
      capturer.setCaptureMode('manual');
      advance(3); advance(3); pinch(); advance(3); pinch();
      capturer.setCaptureMode('auto');
      pinch(); advance(3);
      assert.deepEqual(sources, ['timer:auto', 'pinch:auto', 'pinch:auto', 'pinch:manual', 'pinch:manual', 'pinch:auto', 'timer:auto']);
    });
  });

  describe('SpatialInterfaceManager + PaletteController', () => {
    let enc;
    beforeEach(() => { enc = installEncoder(); });

    // Manager, capturer and socket share one SceneObject, as on SpecScribeControllers.
    function setup(mode) {
      const so = new MockSceneObject('SpecScribeControllers');
      const { capturer, frames } = startedCapturer(mode);
      const m = createComponentInstance(SpatialInterfaceManager, so);
      so.getComponents = () => [m, capturer];
      const palette = new PaletteController();
      const board = new MockPinchButton();
      const captureBtn = new MockPinchButton();
      const modeBtn = new MockPinchButton();
      palette.whiteboardInteractable = board;
      palette.btnCaptureWhiteboard = captureBtn;
      palette.btnToggleCaptureMode = modeBtn;
      m.paletteController = palette;
      m.socketClient = socketStub();
      m.diffToastText = new MockText('');
      m.whiteboardBoardMesh = new MockRenderMeshVisual();
      m.onAwake();
      m._testEvents.OnStartEvent.trigger();
      return { m, capturer, frames, board, captureBtn, modeBtn, socket: m.socketClient };
    }

    test('resolves the capturer from its SceneObject and reports its mode', () => {
      assert.equal(setup().m.capture.getMode(), CaptureMode.AUTO);
      assert.equal(setup('manual').m.capture.getMode(), CaptureMode.MANUAL);
    });

    test('calibration pinches never capture, even in MANUAL', () => {
      const { m, board } = setup('manual');
      board.simulatePinch();
      assert.equal(m.getWhiteboardState(), WhiteboardState.CLEAN_BOARD);
      board.simulatePinch();
      assert.equal(m.getWhiteboardState(), WhiteboardState.DRAWING_ACTIVE);
      assert.equal(enc.count, 0);
    });

    test('AUTO: whiteboard pinch while drawing ingests one frame; periodic capture keeps running', () => {
      const { m, capturer, frames, board, socket } = setup();
      board.simulatePinch();
      board.simulatePinch();
      board.simulatePinch();
      assert.equal(frames.length, 1);
      assert.match(m.getToastText(), /Whiteboard captured/);
      assert.equal(socket.sent.filter((s) => s.action === 'ADD_NODE').length, 0, 'pinch no longer injects a node');
      tick(capturer, 3.0);
      assert.equal(frames.length, 2);
    });

    test('MANUAL: whiteboard pinch while drawing ingests one frame; periodic capture stays idle', () => {
      const { m, capturer, frames, board, socket } = setup('manual');
      board.simulatePinch();
      board.simulatePinch();
      board.simulatePinch();
      assert.equal(frames.length, 1);
      assert.match(m.getToastText(), /Whiteboard captured/);
      assert.equal(socket.sent.filter((s) => s.action === 'ADD_NODE').length, 0);
      tick(capturer, 10);
      assert.equal(frames.length, 1);
    });

    test('capture button captures in both modes; mode button toggles AUTO <-> MANUAL with a toast', () => {
      const { m, capturer, frames, captureBtn, modeBtn } = setup();
      captureBtn.simulatePinch();
      assert.equal(frames.length, 1, 'capture button captures in AUTO');

      modeBtn.simulatePinch();
      assert.equal(m.capture.getMode(), CaptureMode.MANUAL);
      assert.equal(capturer.getCaptureMode(), CaptureMode.MANUAL);
      assert.match(m.getToastText(), /Capture: MANUAL/);
      captureBtn.simulatePinch();
      assert.equal(frames.length, 2);
      tick(capturer, 6);
      assert.equal(frames.length, 2, 'no periodic frames in MANUAL');

      modeBtn.simulatePinch();
      assert.equal(m.capture.getMode(), CaptureMode.AUTO);
      assert.match(m.getToastText(), /Capture: AUTO • every 3s/);
      captureBtn.simulatePinch();
      assert.equal(frames.length, 3);
      tick(capturer, 3);
      assert.equal(frames.length, 4);
    });

    test('capture is ignored once the meeting is concluded', () => {
      const { m, frames } = setup('manual');
      m.triggerConcludeMeeting();
      assert.equal(m.capture.captureNow(), false);
      assert.equal(frames.length, 0);
    });

    test('without a capturer, mode stays AUTO and capture is a safe no-op', () => {
      const m = createComponentInstance(SpatialInterfaceManager);
      m.diffToastText = new MockText('');
      m.onAwake();
      m._testEvents.OnStartEvent.trigger();
      assert.equal(m.capture.getMode(), CaptureMode.AUTO);
      assert.equal(m.capture.setMode('manual'), CaptureMode.AUTO);
      assert.equal(m.capture.captureNow(), false);
    });
  });

  test('end to end: a pinch reaches the backend socket as a manual cameraFrame in both modes', () => {
    installEncoder();
    const ws = new MockWebSocket('ws://localhost:8000/ws/meeting/x');
    global._mockSocket = ws;
    global._mockAsrHandler = () => {};
    const { capturer } = startedCapturer();
    const client = createComponentInstance(PersistentStreamSocketClient);
    client.cameraCapturer = capturer;
    client.onAwake();
    client._testEvents.OnStartEvent.trigger();
    const frames = () => ws.sentMessages.map((s) => JSON.parse(s)).filter((p) => p.eventType === 'cameraFrame');

    capturer.triggerManualCapture();
    assert.equal(frames().length, 1);
    assert.equal(frames()[0].image_b64, 'frame-1');
    assert.equal(frames()[0].isManual, true);
    assert.equal(frames()[0].captureMode, 'AUTO');
    capturer.setCaptureMode('manual');
    capturer.triggerManualCapture();
    assert.equal(frames().length, 2);
    assert.equal(frames()[1].captureMode, 'MANUAL');
    global._mockSocket = undefined;
  });
});
