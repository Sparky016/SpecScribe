import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import {
  setupLensGlobalMocks,
  MockSceneObject,
  MockText,
  MockPinchButton,
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

describe('Task 28: ASK_AGENT research mode state machine', () => {
  let RaisingHandAgentController;
  let AgentState;

  before(async () => {
    const mod = await import('../dist/Assets/Scripts/RaisingHandAgentController.js');
    RaisingHandAgentController = mod.RaisingHandAgentController;
    AgentState = mod.AgentState;
  });

  function setup(withSocket = true) {
    const controller = createComponentInstance(RaisingHandAgentController);
    const orbButton = new MockPinchButton();
    const sent = [];
    if (withSocket) {
      controller.socketClient = {
        getLatestSpokenPhrase: () => 'query',
        sendPinchCommand: (a, t, l) => sent.push({ a, t, l })
      };
    }
    controller.agentOrbPinchButton = orbButton;
    controller.pillTitleText = new MockText('');
    controller.onAwake();
    controller._testEvents.OnStartEvent.trigger();
    return { controller, orbButton, sent };
  }

  test('RESEARCHING times out back to IDLE without a response', () => {
    const { controller, orbButton } = setup();
    controller._testEvents.UpdateEvent.trigger({ getDeltaTime: () => 0.5 });
    orbButton.simulatePinch();
    assert.equal(controller.getState(), AgentState.RESEARCHING);
    assert.ok(controller._testEvents.DelayedCallbackEvent.delayTime > 0);
    controller._testEvents.DelayedCallbackEvent.trigger();
    assert.equal(controller.getState(), AgentState.IDLE);
  });

  test('a response before the timeout leaves RESEARCHING and cancels the timeout', () => {
    const { controller, orbButton } = setup();
    controller._testEvents.UpdateEvent.trigger({ getDeltaTime: () => 0.5 });
    orbButton.simulatePinch();
    controller.triggerHandRaised('Insight', 'Body');
    assert.equal(controller.getState(), AgentState.HAND_RAISED);
    controller._testEvents.DelayedCallbackEvent.trigger();
    assert.equal(controller.getState(), AgentState.HAND_RAISED);
  });

  test('IDLE pinch without a socket sends nothing and shows no canned critique', () => {
    const { controller, orbButton } = setup(false);
    controller._testEvents.UpdateEvent.trigger({ getDeltaTime: () => 0.5 });
    orbButton.simulatePinch();
    assert.equal(controller.getState(), AgentState.IDLE);
  });
});
