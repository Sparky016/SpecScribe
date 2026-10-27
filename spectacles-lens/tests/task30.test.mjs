import { test, describe, before } from 'node:test';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {
  setupLensGlobalMocks,
  MockSceneObject,
  MockRenderMeshVisual,
  MockText,
  MockScriptEvent,
  MockTexture,
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

const scriptsDir = new URL('../Assets/Scripts/', import.meta.url);
const specPath = new URL('../../docs/spec.md', import.meta.url);

describe('Task 30: pinch action contract', () => {
  let SpatialInterfaceManager, PersistentStreamSocketClient, PinchAction;
  before(async () => {
    SpatialInterfaceManager = (await import('../dist/Assets/Scripts/SpatialInterfaceManager.js')).SpatialInterfaceManager;
    PersistentStreamSocketClient = (await import('../dist/Assets/Scripts/PersistentStreamSocketClient.js')).PersistentStreamSocketClient;
    PinchAction = (await import('../dist/Assets/Scripts/PinchActions.js')).PinchAction;
  });

  function setup(demoMode) {
    const m = createComponentInstance(SpatialInterfaceManager);
    const sent = [];
    m.demoMode = demoMode;
    m.diffToastText = new MockText('');
    m.socketClient = {
      getLatestSpokenPhrase: () => undefined,
      sendPinchCommand: (a, t, l) => sent.push(a),
      onDiagramUpdated: () => {},
      onDecisionLogged: () => {}
    };
    m.onAwake();
    m._testEvents.OnStartEvent.trigger();
    return { m, sent };
  }

  test('AC1: every action the Lens sends is documented in docs/spec.md', () => {
    const spec = fs.readFileSync(specPath, 'utf-8');
    const documented = new Set([...spec.matchAll(/^\| `([A-Z_]+)` \|/gm)].map((x) => x[1]));
    const used = new Set();
    for (const f of fs.readdirSync(scriptsDir).filter((n) => n.endsWith('.ts'))) {
      const src = fs.readFileSync(new URL(f, scriptsDir), 'utf-8');
      for (const x of src.matchAll(/sendPinchCommand\(\s*'([A-Z_]+)'/g)) used.add(x[1]);
      for (const x of src.matchAll(/sendPinchCommand\(\s*PinchAction\.([A-Z_]+)/g)) used.add(x[1]);
    }
    assert.ok(used.has('CONCLUDE_MEETING'));
    for (const a of used) assert.ok(documented.has(a), `${a} missing from docs/spec.md`);
    for (const a of Object.values(PinchAction)) assert.ok(documented.has(a), `${a} missing from docs/spec.md`);
  });

  test('conclude sends CONCLUDE_MEETING and shows pending, not success, until MEETING_FINALIZED', () => {
    const { m, sent } = setup(false);
    m.triggerConcludeMeeting();
    assert.deepEqual(sent, ['CONCLUDE_MEETING']);
    assert.match(m.diffToastText.text, /Generating spec/);
    assert.doesNotMatch(m.diffToastText.text, /Spec Generated/);
    m.socketClient.onMeetingFinalized({ event: 'MEETING_FINALIZED' });
    assert.match(m.diffToastText.text, /Spec Generated/);
  });

  test('conclude times out to an error toast and allows retry', () => {
    const { m } = setup(false);
    m.triggerConcludeMeeting();
    m._testEvents.DelayedCallbackEvent.trigger();
    assert.match(m.diffToastText.text, /failed/);
    assert.equal(m.isMeetingConcluded ? m.isMeetingConcluded() : false, false);
  });

  test('MEETING_FINALIZED after success cancels the timeout', () => {
    const { m } = setup(false);
    m.triggerConcludeMeeting();
    m.socketClient.onMeetingFinalized({});
    m._testEvents.DelayedCallbackEvent.trigger();
    assert.match(m.diffToastText.text, /Spec Generated/);
  });

  test('demoMode: conclude shows success immediately', () => {
    const { m, sent } = setup(true);
    m.triggerConcludeMeeting();
    assert.deepEqual(sent, ['CONCLUDE_MEETING']);
    assert.match(m.diffToastText.text, /Spec Generated/);
  });

  test('socket client dispatches MEETING_FINALIZED and tolerates COMMAND_ACK', () => {
    const client = createComponentInstance(PersistentStreamSocketClient);
    let got = null;
    client.onMeetingFinalized = (p) => { got = p; };
    client.routeInboundJson(JSON.stringify({ event: 'COMMAND_ACK', action: 'CALIBRATE_AREA' }));
    assert.equal(got, null);
    client.routeInboundJson(JSON.stringify({ event: 'MEETING_FINALIZED', meeting_id: 'm1', chunks_created: 3 }));
    assert.equal(got.meeting_id, 'm1');
  });
});
