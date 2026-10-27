import { test, describe, before, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  setupLensGlobalMocks,
  MockSceneObject,
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

// Records every socket the client creates.
function installSocketFactory() {
  const created = [];
  global._mockSocketFactory = (url) => {
    const socket = new MockWebSocket(url);
    socket.readyState = 0;
    created.push(socket);
    return socket;
  };
  return created;
}

const DEMO_UUID = '00000000-0000-4000-8000-000000000d0e';

describe('Task 38: Lens connection composed from base, UUID meeting ID and token', () => {
  let PersistentStreamSocketClient;
  before(async () => {
    PersistentStreamSocketClient = (await import('../dist/Assets/Scripts/PersistentStreamSocketClient.js')).PersistentStreamSocketClient;
  });
  afterEach(() => {
    global._mockSocketFactory = null;
  });

  test('AC1: socket URL is base + /ws/meeting/ + UUID + ?token= (token URI-encoded)', () => {
    const created = installSocketFactory();
    const client = createComponentInstance(PersistentStreamSocketClient);
    client.backendWsBase = 'wss://specscribe-backend.example.run.app';
    client.meetingId = '5f1c2b7e-9a3d-4c8e-b1f0-2d6e7a8b9c0d';
    client.apiToken = 'abc+def/ghi=';
    client.onAwake();
    client._testEvents.OnStartEvent.trigger();

    assert.equal(created.length, 1);
    assert.equal(
      created[0].url,
      'wss://specscribe-backend.example.run.app/ws/meeting/5f1c2b7e-9a3d-4c8e-b1f0-2d6e7a8b9c0d?token=abc%2Bdef%2Fghi%3D'
    );
  });

  test('AC1: defaults target the Preview backend with the demo UUID and an empty token placeholder', () => {
    const created = installSocketFactory();
    const client = createComponentInstance(PersistentStreamSocketClient);
    client.onAwake();
    client._testEvents.OnStartEvent.trigger();

    assert.equal(created[0].url, `ws://localhost:8000/ws/meeting/${DEMO_UUID}?token=`);
    assert.equal(client.getWebsocketUrl(), `ws://localhost:8000/ws/meeting/${DEMO_UUID}?token=`);
  });

  test('AC1: empty backend base yields no composed URL', () => {
    const created = installSocketFactory();
    const client = createComponentInstance(PersistentStreamSocketClient);
    client.backendWsBase = '';
    client.onAwake();
    client._testEvents.OnStartEvent.trigger();

    assert.equal(client.getWebsocketUrl(), '');
    assert.equal(created[0].url, '');
  });
});
