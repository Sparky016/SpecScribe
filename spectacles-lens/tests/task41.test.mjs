import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import {
  setupLensGlobalMocks,
  MockSceneObject,
  MockText,
  MockAudioComponent,
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

// True when the string contains no unpaired UTF-16 surrogate code units.
function hasNoLoneSurrogate(str) {
  return !/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(str);
}

describe('Task 41: raise-hand title formatting and truncation', () => {
  let RaisingHandAgentController;
  let AgentState;

  before(async () => {
    const mod = await import('../dist/Assets/Scripts/RaisingHandAgentController.js');
    RaisingHandAgentController = mod.RaisingHandAgentController;
    AgentState = mod.AgentState;
  });

  function setup() {
    const controller = createComponentInstance(RaisingHandAgentController);
    const pillText = new MockText('');
    let handRaisedCallback = null;
    controller.socketClient = {
      set onHandRaised(cb) { handRaisedCallback = cb; }
    };
    controller.pillTitleText = pillText;
    controller.agentAudioComponent = new MockAudioComponent();
    controller.onAwake();
    controller._testEvents.OnStartEvent.trigger();
    return { controller, pillText, emit: (payload) => handRaisedCallback(payload) };
  }

  test('a leading emoji in the title is replaced by a single category icon', () => {
    const { controller, pillText, emit } = setup();
    emit({ category: 'VULNERABILITY', short_title: '⚠️ Auth Token Leak Risk', detailed_body: 'Body' });
    assert.equal(controller.getState(), AgentState.HAND_RAISED);
    assert.equal(pillText.text, '🚩 Auth Token Leak Risk');
  });

  test('a different leading category icon is stripped before the category icon is added', () => {
    const { pillText, emit } = setup();
    emit({ category: 'ALTERNATIVE_IDEA', short_title: '🚩 Cache sessions', detailed_body: 'Body' });
    assert.equal(pillText.text, '💡 Cache sessions');
  });

  test('onHandRaised delegates to triggerHandRaised with the same result', () => {
    const { controller, pillText, emit } = setup();
    let delegated = null;
    controller.triggerHandRaised = (title, body, category) => { delegated = [title, body, category]; };
    emit({ category: 'LOGIC_FLAW', short_title: 'Race condition', detailed_body: 'Details' });
    assert.deepEqual(delegated, ['Race condition', 'Details', 'LOGIC_FLAW']);
    assert.equal(pillText.text, '', 'delegation stub should not have written the pill');
  });

  test('truncation never splits a surrogate pair when an emoji sits at position 27', () => {
    const { pillText, emit } = setup();
    const title = 'a'.repeat(26) + '🚩' + 'bbb';
    emit({ short_title: title, detailed_body: 'Body' });
    assert.equal(pillText.text, 'a'.repeat(26) + '🚩' + 'b');
    assert.ok(hasNoLoneSurrogate(pillText.text));
    assert.equal(Array.from(pillText.text).length, 28);
  });

  test('truncation counts code points, not UTF-16 units, for category titles', () => {
    const { pillText, emit } = setup();
    emit({ category: 'VULNERABILITY', short_title: 'Unauthenticated Token Endpoint in Auth Gateway', detailed_body: 'Body' });
    assert.ok(pillText.text.startsWith('🚩 '));
    assert.equal(Array.from(pillText.text).length, 28);
    assert.ok(hasNoLoneSurrogate(pillText.text));
  });
});
