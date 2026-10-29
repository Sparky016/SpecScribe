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

// Records every socket the client creates; new sockets start with the given readyState (0 CONNECTING, 1 OPEN).
function installSocketFactory(readyState) {
  const created = [];
  global._mockSocketFactory = (url) => {
    const socket = new MockWebSocket(url);
    socket.readyState = readyState;
    created.push(socket);
    return socket;
  };
  return created;
}

const isLive = (socket) => socket.readyState === 0 || socket.readyState === 1;

describe('Task 40: no duplicate sockets on URL change or reconnect', () => {
  let PersistentStreamSocketClient;
  before(async () => {
    PersistentStreamSocketClient = (await import('../dist/Assets/Scripts/PersistentStreamSocketClient.js')).PersistentStreamSocketClient;
  });
  afterEach(() => {
    global._mockSocketFactory = null;
  });

  test('AC1: URL change neuters the old socket and leaves exactly one live socket', () => {
    const created = installSocketFactory(1);
    const client = createComponentInstance(PersistentStreamSocketClient);
    client.onAwake();
    client._testEvents.OnStartEvent.trigger();
    const first = created[0];
    first.onopen();

    client.setWebsocketUrl('ws://localhost:8000/ws/meeting/other-session');

    assert.equal(created.length, 2, 'URL change should create exactly one replacement socket');
    assert.equal(first.readyState, 3, 'old socket should be closed');
    assert.equal(first.onopen, null);
    assert.equal(first.onmessage, null);
    assert.equal(first.onerror, null);
    assert.equal(first.onclose, null);
    assert.equal(created.filter(isLive).length, 1, 'exactly one socket should be live');
    assert.equal(created[1].url, 'ws://localhost:8000/ws/meeting/other-session');
    assert.equal(client._testEvents.DelayedCallbackEvent, undefined, 'closing the old socket must not schedule a reconnect');
  });

  test('AC2: reconnect timer does not open a socket while one is CONNECTING', () => {
    const created = installSocketFactory(1);
    const client = createComponentInstance(PersistentStreamSocketClient);
    client.onAwake();
    client._testEvents.OnStartEvent.trigger();
    created[0].onopen();
    created[0].close();
    assert.equal(client._testEvents.DelayedCallbackEvent.enabled, true, 'reconnect should be pending after close');

    // URL change while the reconnect is pending: the replacement socket is still CONNECTING.
    global._mockSocketFactory = (url) => {
      const socket = new MockWebSocket(url);
      socket.readyState = 0;
      created.push(socket);
      return socket;
    };
    client.setWebsocketUrl('ws://localhost:8000/ws/meeting/other-session');
    assert.equal(created.length, 2);

    client._testEvents.DelayedCallbackEvent.trigger();
    assert.equal(created.length, 2, 'reconnect must not open a third socket while CONNECTING');
  });

  test('AC2: scheduleReconnect is a no-op while the active socket is CONNECTING', () => {
    installSocketFactory(0);
    const client = createComponentInstance(PersistentStreamSocketClient);
    client.onAwake();
    client._testEvents.OnStartEvent.trigger();
    assert.equal(client.activeSocket.readyState, 0);

    client.scheduleReconnect();

    assert.equal(client._testEvents.DelayedCallbackEvent, undefined, 'no reconnect should be scheduled while CONNECTING');
  });
});
