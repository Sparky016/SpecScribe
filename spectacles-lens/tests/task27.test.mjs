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
  const sceneObject = new MockSceneObject('TestComponentObj');
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

const clientPath = new URL('../Assets/Scripts/PersistentStreamSocketClient.ts', import.meta.url);

describe('Task 27: spoken phrase consumed once per pinch', () => {
  let SpatialInterfaceManager, PersistentStreamSocketClient;
  before(async () => {
    SpatialInterfaceManager = (await import('../dist/Assets/Scripts/SpatialInterfaceManager.js')).SpatialInterfaceManager;
    PersistentStreamSocketClient = (await import('../dist/Assets/Scripts/PersistentStreamSocketClient.js')).PersistentStreamSocketClient;
  });

  // Real socket client wired to a mock WebSocket, so assertions read the payloads that would go on the wire.
  function setup(demoMode) {
    const socket = new MockWebSocket('ws://localhost:8000/ws/meeting/demo-session-01');
    let asrOptions = null;
    global._mockSocket = socket;
    global._mockAsrHandler = (opts) => { asrOptions = opts; };

    const client = createComponentInstance(PersistentStreamSocketClient);
    client.onAwake();
    client._testEvents.OnStartEvent.trigger();
    socket.onopen();

    const hear = (text, isFinal) => {
      for (const cb of asrOptions._callbacks) cb({ text, isFinal });
    };

    const manager = createComponentInstance(SpatialInterfaceManager);
    manager.demoMode = demoMode;
    manager.diffToastText = new MockText('');
    manager.socketClient = client;

    const addNodePayloads = () => socket.sentMessages
      .map((m) => JSON.parse(m))
      .filter((m) => m.eventType === 'pinchCommand' && m.action === 'ADD_NODE');

    return { client, manager, hear, addNodePayloads };
  }

  test('AC1: two pinches without speech send ADD_NODE without a label', () => {
    const { manager, addNodePayloads } = setup(false);
    manager.triggerAddNode('service');
    manager.triggerAddNode('service');
    const sent = addNodePayloads();
    assert.equal(sent.length, 2);
    for (const payload of sent) {
      assert.equal(payload.node_type, 'service');
      assert.equal('label' in payload, false);
    }
  });

  test('AC1: pinches with distinct spoken phrases send distinct labels', () => {
    const { manager, hear, addNodePayloads } = setup(false);
    hear('Payment Gateway', true);
    manager.triggerAddNode('service');
    hear('Customer Auth', true);
    manager.triggerAddNode('service');
    const sent = addNodePayloads();
    assert.equal(sent[0].label, 'Payment Gateway');
    assert.equal(sent[1].label, 'Customer Auth');
  });

  test('AC2: a final phrase is consumed by one pinch and not reused by the next', () => {
    const { client, manager, hear, addNodePayloads } = setup(false);
    hear('Payment Gateway', true);
    manager.triggerAddNode('service');
    manager.triggerAddNode('service');
    const sent = addNodePayloads();
    assert.equal(sent[0].label, 'Payment Gateway');
    assert.equal('label' in sent[1], false);
    assert.equal(client.consumeLatestSpokenPhrase(), null);
  });

  test('AC2: consumeLatestSpokenPhrase returns the final phrase once, then null', () => {
    const { client, hear } = setup(false);
    hear('Redis Cache', true);
    assert.equal(client.consumeLatestSpokenPhrase(), 'Redis Cache');
    assert.equal(client.consumeLatestSpokenPhrase(), null);
  });

  test('partial ASR updates never become the consumed label', () => {
    const { client, hear } = setup(false);
    hear('Pay', false);
    hear('Payment Gate', false);
    assert.equal(client.consumeLatestSpokenPhrase(), null);
    hear('Payment Gateway', true);
    hear('Payment Gate', false);
    assert.equal(client.consumeLatestSpokenPhrase(), 'Payment Gateway');
  });

  test('empty final phrases are ignored and do not clear a pending phrase', () => {
    const { client, hear } = setup(false);
    hear('Message Broker', true);
    hear('   ', true);
    assert.equal(client.consumeLatestSpokenPhrase(), 'Message Broker');
  });

  test('getLatestSpokenPhrase has no hardcoded default phrase', () => {
    const { client } = setup(false);
    assert.equal(client.getLatestSpokenPhrase(), '');
  });

  test('AC3: Payment Gateway Microservice is not hardcoded in PersistentStreamSocketClient.ts', () => {
    const src = fs.readFileSync(clientPath, 'utf-8');
    assert.doesNotMatch(src, /Payment Gateway Microservice/);
  });

  test('demoMode=true: canned label still sent when no speech is present', () => {
    const { manager, addNodePayloads } = setup(true);
    manager.triggerAddNode('decision');
    assert.equal(addNodePayloads()[0].label, 'Enforce JWT HMAC Verification');
  });

  test('demoMode=true: spoken phrase still takes precedence over the canned label', () => {
    const { manager, hear, addNodePayloads } = setup(true);
    hear('Session Store', true);
    manager.triggerAddNode('database');
    assert.equal(addNodePayloads()[0].label, 'Session Store');
  });
});
