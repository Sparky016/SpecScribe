import { test, describe, before } from 'node:test';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {
  setupLensGlobalMocks,
  MockSceneObject,
  MockText,
  MockScriptEvent,
  MockWebSocket,
  MockBaseScriptComponent
} from './lens_mock_environment.mjs';

setupLensGlobalMocks();
global.BaseScriptComponent = MockBaseScriptComponent;
global.allowUndefined = () => {};

function createComponentInstance(Cls) {
  const events = {
    OnStartEvent: new MockScriptEvent(),
    UpdateEvent: new MockScriptEvent(),
    OnDestroyEvent: new MockScriptEvent()
  };
  const requested = [];
  const sceneObject = new MockSceneObject('TestComponentObj');
  const instance = new Cls();
  instance.createEvent = (eventType) => {
    requested.push(eventType);
    if (!events[eventType]) events[eventType] = new MockScriptEvent();
    return events[eventType];
  };
  instance.getSceneObject = () => sceneObject;
  instance.getTransform = () => sceneObject.getTransform();
  instance._testEvents = events;
  instance._requested = requested;
  return instance;
}

describe('Task 32: single input path (no global TapEvent)', () => {
  let SpatialInterfaceManager, PersistentStreamSocketClient;
  before(async () => {
    SpatialInterfaceManager = (await import('../dist/Assets/Scripts/SpatialInterfaceManager.js')).SpatialInterfaceManager;
    PersistentStreamSocketClient = (await import('../dist/Assets/Scripts/PersistentStreamSocketClient.js')).PersistentStreamSocketClient;
  });

  test('AC1: no TapEvent is created by either controller', () => {
    for (const f of ['SpatialInterfaceManager.ts', 'RaisingHandAgentController.ts']) {
      const src = fs.readFileSync(new URL(`../Assets/Scripts/${f}`, import.meta.url), 'utf8');
      assert.equal(/createEvent\(\s*['"]TapEvent['"]/.test(src), false, f);
    }
  });

  test('AC2: starting the manager binds no TapEvent; one palette action sends one ADD_NODE', () => {
    const socket = new MockWebSocket('ws://localhost:8000/ws/meeting/demo-session-01');
    global._mockSocket = socket;
    global._mockAsrHandler = () => {};
    const client = createComponentInstance(PersistentStreamSocketClient);
    client.onAwake();
    client._testEvents.OnStartEvent.trigger();
    socket.onopen();

    const manager = createComponentInstance(SpatialInterfaceManager);
    manager.demoMode = false;
    manager.diffToastText = new MockText('');
    manager.socketClient = client;
    try { manager.onAwake(); manager._testEvents.OnStartEvent.trigger(); } catch (e) {}
    assert.equal(manager._requested.includes('TapEvent'), false);

    // A simulated tap now has no global handler to fire; the single palette path sends exactly one action.
    if (manager._testEvents.TapEvent) manager._testEvents.TapEvent.trigger({});
    manager.triggerAddNode('service');
    const adds = socket.sentMessages
      .map((m) => JSON.parse(m))
      .filter((m) => m.eventType === 'pinchCommand' && m.action === 'ADD_NODE');
    assert.equal(adds.length, 1);
  });
});
