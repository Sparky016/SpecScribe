import { test, describe, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  setupLensGlobalMocks,
  MockSceneObject,
  MockScriptEvent,
  MockWebSocket,
  MockText,
  MockBaseScriptComponent
} from './lens_mock_environment.mjs';

setupLensGlobalMocks();
global.BaseScriptComponent = MockBaseScriptComponent;
global.allowUndefined = () => {};

function createComponentInstance(Cls) {
  const events = {
    OnStartEvent: new MockScriptEvent(),
    UpdateEvent: new MockScriptEvent(),
    OnDestroyEvent: new MockScriptEvent(),
    DelayedCallbackEvent: new MockScriptEvent()
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

describe('Task 58: Continuous Requirement Synthesis WebSocket Routing & AR HUD Toast (AC2)', () => {
  let PersistentStreamSocketClient;
  let SpatialInterfaceManager;
  let mockSocket;

  before(async () => {
    ({ PersistentStreamSocketClient } = await import('../dist/Assets/Scripts/PersistentStreamSocketClient.js'));
    ({ SpatialInterfaceManager } = await import('../dist/Assets/Scripts/SpatialInterfaceManager.js'));
  });

  beforeEach(() => {
    mockSocket = new MockWebSocket('ws://localhost:8000/ws/meeting/00000000-0000-4000-8000-000000000d0e');
    global._mockSocket = mockSocket;
    global._mockAsrHandler = () => {};
  });

  test('AC2: PersistentStreamSocketClient routes REQUIREMENT_SYNTHESIZED (via event or type) to onRequirementSynthesized', () => {
    const client = createComponentInstance(PersistentStreamSocketClient);
    client.onAwake();
    client._testEvents.OnStartEvent.trigger();
    mockSocket.onopen();

    const received = [];
    client.onRequirementSynthesized = (payload) => {
      received.push(payload);
    };

    mockSocket.simulateServerMessage({
      event: 'REQUIREMENT_SYNTHESIZED',
      chunk_type: 'REQUIREMENT',
      summary: 'Auth service must validate JWT tokens in under 50ms.',
      speaker: 'Speaker 1 (Architect)'
    });

    mockSocket.simulateServerMessage({
      type: 'REQUIREMENT_SYNTHESIZED',
      chunk_type: 'DECISION',
      summary: 'Use Redis cluster for token session caching.',
      speaker: 'Speaker 0 (Wearer)'
    });

    assert.equal(received.length, 2);
    assert.equal(received[0].summary, 'Auth service must validate JWT tokens in under 50ms.');
    assert.equal(received[0].speaker, 'Speaker 1 (Architect)');
    assert.equal(received[1].summary, 'Use Redis cluster for token session caching.');
  });

  test('AC2: SpatialInterfaceManager wires onRequirementSynthesized and onDecisionLogged to HUD showToast', () => {
    const client = createComponentInstance(PersistentStreamSocketClient);
    const manager = createComponentInstance(SpatialInterfaceManager);
    const toastText = new MockText('');

    manager.socketClient = client;
    manager.diffToastText = toastText;

    client.onAwake();
    client._testEvents.OnStartEvent.trigger();
    mockSocket.onopen();

    manager.onAwake();
    manager._testEvents.OnStartEvent.trigger();

    // 1. Inbound REQUIREMENT_SYNTHESIZED updates HUD toast with "Req: <summary>"
    mockSocket.simulateServerMessage({
      event: 'REQUIREMENT_SYNTHESIZED',
      summary: 'PostgreSQL primary database with read replicas'
    });
    assert.equal(toastText.text, 'Req: PostgreSQL primary database with read replicas');

    // 2. Inbound DECISION_LOGGED updates HUD toast with decision rationale/summary
    mockSocket.simulateServerMessage({
      event: 'DECISION_LOGGED',
      decision_rationale: 'Redis selected for sub-millisecond session lookups'
    });
    assert.equal(toastText.text, '📝 Decision: Redis selected for sub-millisecond session lookups');
  });
});
