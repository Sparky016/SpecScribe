import { test, describe, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  setupLensGlobalMocks,
  MockSceneObject,
  MockScriptEvent,
  MockTexture,
  MockBaseScriptComponent
} from './lens_mock_environment.mjs';

setupLensGlobalMocks();
global.BaseScriptComponent = MockBaseScriptComponent;
global.allowUndefined = () => {};

function createComponentInstance(Cls, sceneObject = new MockSceneObject('TestComponentObj')) {
  const events = {
    OnStartEvent: new MockScriptEvent(),
    UpdateEvent: new MockScriptEvent(),
    OnDestroyEvent: new MockScriptEvent()
  };

  const instance = new Cls();
  instance.createEvent = (eventType) => {
    if (!events[eventType]) {
      events[eventType] = new MockScriptEvent();
    }
    return events[eventType];
  };
  instance.getSceneObject = () => sceneObject;
  instance.getTransform = () => sceneObject.getTransform();
  instance._testEvents = events;
  return instance;
}

function installEncoder() {
  let count = 0;
  global.Base64.encodeTextureAsync = (tex, onSuccess) => {
    count++;
    onSuccess(`b64-frame-${count}`);
  };
}

describe('Task 56: Fix Backend Vision Cooldown Gate & Support Immediate Manual Capture', () => {
  let PeriodicCameraCapturer, CaptureMode;

  before(async () => {
    const mod = await import('../dist/Assets/Scripts/PeriodicCameraCapturer.js');
    PeriodicCameraCapturer = mod.PeriodicCameraCapturer;
    CaptureMode = mod.CaptureMode;
  });

  beforeEach(() => {
    installEncoder();
  });

  function startCapturer(mode = 'auto') {
    const capturer = createComponentInstance(PeriodicCameraCapturer);
    capturer.cameraModule = { requestCamera: () => new MockTexture(480, 360) };
    capturer.captureMode = mode;
    capturer.onAwake();
    capturer._testEvents.OnStartEvent.trigger();
    return capturer;
  }

  test('AC1 & AC2: AUTO capture sends payload with captureMode="AUTO" and isManual=false', () => {
    const capturer = startCapturer('auto');
    const sent = [];
    capturer.socketClient = {
      send: (payload) => sent.push(payload)
    };

    let callbackArgs = null;
    capturer.onEncodedFrameAvailable = (b64, timestamp, isManual, mode) => {
      callbackArgs = { b64, timestamp, isManual, mode };
    };

    const triggered = capturer.captureAndEncodeFrame(false);
    assert.equal(triggered, true);

    // Verify socketClient.send payload
    assert.equal(sent.length, 1);
    const p = sent[0];
    assert.equal(p.eventType, 'cameraFrame');
    assert.equal(p.captureMode, 'AUTO');
    assert.equal(p.isManual, false);
    assert.equal(p.isManualTrigger, false);
    assert.equal(p.image_b64, 'b64-frame-1');
    assert.ok(typeof p.timestamp_ms === 'number');

    // Verify onEncodedFrameAvailable signature
    assert.ok(callbackArgs);
    assert.equal(callbackArgs.b64, 'b64-frame-1');
    assert.equal(callbackArgs.isManual, false);
    assert.equal(callbackArgs.mode, 'AUTO');
  });

  test('AC3: MANUAL capture sends payload with captureMode="MANUAL" and isManual=true', () => {
    const capturer = startCapturer('manual');
    const sent = [];
    capturer.socketClient = {
      sendJson: (payload) => sent.push(payload)
    };

    let callbackArgs = null;
    capturer.onEncodedFrameAvailable = (b64, timestamp, isManual, mode) => {
      callbackArgs = { b64, timestamp, isManual, mode };
    };

    const triggered = capturer.triggerManualCapture();
    assert.equal(triggered, true);

    // Verify socketClient.sendJson payload
    assert.equal(sent.length, 1);
    const p = sent[0];
    assert.equal(p.eventType, 'cameraFrame');
    assert.equal(p.captureMode, 'MANUAL');
    assert.equal(p.isManual, true);
    assert.equal(p.isManualTrigger, true);
    assert.equal(p.image_b64, 'b64-frame-1');

    // Verify callback
    assert.ok(callbackArgs);
    assert.equal(callbackArgs.isManual, true);
    assert.equal(callbackArgs.mode, 'MANUAL');
  });

  test('onUpdate accumulates time and triggers periodic AUTO capture with isManual=false', () => {
    const capturer = startCapturer('auto');
    const sent = [];
    capturer.socketClient = {
      send: (payload) => sent.push(payload)
    };

    capturer.onUpdate(1.0);
    assert.equal(sent.length, 0);

    capturer.onUpdate(2.0); // Total 3.0s -> triggers cadence
    assert.equal(sent.length, 1);
    assert.equal(sent[0].captureMode, 'AUTO');
    assert.equal(sent[0].isManual, false);
  });
});
