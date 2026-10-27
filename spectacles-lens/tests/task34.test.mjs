import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import {
  setupLensGlobalMocks,
  MockSceneObject,
  MockScriptEvent,
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
  return instance;
}

describe('Task 34: last sent command and reset hooks', () => {
  let PersistentStreamSocketClient;
  before(async () => {
    PersistentStreamSocketClient = (await import('../dist/Assets/Scripts/PersistentStreamSocketClient.js')).PersistentStreamSocketClient;
  });

  test('getLastSentCommand records the pinchCommand payload even with no open socket', () => {
    const client = createComponentInstance(PersistentStreamSocketClient);
    assert.equal(client.getLastSentCommand(), null);
    client.sendPinchCommand('ADD_NODE', 'service', 'Auth Gateway Service');
    const cmd = client.getLastSentCommand();
    assert.equal(cmd.eventType, 'pinchCommand');
    assert.equal(cmd.action, 'ADD_NODE');
    assert.equal(cmd.node_type, 'service');
    assert.equal(cmd.label, 'Auth Gateway Service');
  });

  test('label is omitted when null, and clearLastSentCommand resets', () => {
    const client = createComponentInstance(PersistentStreamSocketClient);
    client.sendPinchCommand('ADD_NODE', 'database', null);
    assert.equal('label' in client.getLastSentCommand(), false);
    client.clearLastSentCommand();
    assert.equal(client.getLastSentCommand(), null);
  });
});
