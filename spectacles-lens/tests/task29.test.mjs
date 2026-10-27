import { test, describe, before } from 'node:test';
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

describe('Task 29: demoMode gating', () => {
  let SpatialInterfaceManager;
  before(async () => {
    SpatialInterfaceManager = (await import('../dist/Assets/Scripts/SpatialInterfaceManager.js')).SpatialInterfaceManager;
  });

  function setup(demoMode) {
    const m = createComponentInstance(SpatialInterfaceManager);
    const overlay = new MockRenderMeshVisual();
    const board = new MockRenderMeshVisual();
    const sent = [];
    const raised = [];
    m.demoMode = demoMode;
    m.diagramOverlayMesh = overlay;
    m.diffToastText = new MockText('');
    m.socketClient = {
      getLatestSpokenPhrase: () => undefined,
      sendPinchCommand: (a, t, l) => { if (a === 'ADD_NODE') sent.push({ a, t, l }); },
      onDiagramUpdated: () => {},
      onDecisionLogged: () => {}
    };
    m.raisingHandAgent = { triggerHandRaised: (...args) => raised.push(args) };
    m.texNodeAdded = new MockTexture(1, 1);
    m.texSnapshotUpdated = new MockTexture(1, 1);
    m.texConcluded = new MockTexture(1, 1);
    m.texWhiteboardDrawn = new MockTexture(1, 1);
    return { m, overlay, board, sent, raised };
  }

  test('demoMode defaults to false', () => {
    assert.equal(new SpatialInterfaceManager().demoMode, false);
  });

  test('demoMode=false: triggerAddNode sends ADD_NODE, no texture, no hand raise, pending toast', () => {
    const { m, overlay, sent, raised } = setup(false);
    m.triggerAddNode('decision');
    assert.equal(sent.length, 1);
    assert.equal(sent[0].a, 'ADD_NODE');
    assert.equal(raised.length, 0);
    assert.notEqual(overlay.mainMaterial.mainPass.baseTex, m.texNodeAdded);
    assert.match(m.diffToastText.text, /pending/);
    assert.notEqual(sent[0].l, 'Enforce JWT HMAC Verification');
  });

  test('demoMode=false: snapshot and conclude leave overlay untouched, no hand raise', () => {
    const { m, overlay, raised } = setup(false);
    m.triggerAddNode('service');
    m.triggerUpdateSnapshot();
    m.triggerConcludeMeeting();
    assert.equal(raised.length, 0);
    assert.notEqual(overlay.mainMaterial.mainPass.baseTex, m.texSnapshotUpdated);
    assert.notEqual(overlay.mainMaterial.mainPass.baseTex, m.texConcluded);
  });

  test('demoMode=false: overlay texture changes only in onDiagramUpdated', () => {
    const { m, overlay } = setup(false);
    global.Base64.decodeTextureAsync = (b64, ok) => ok(new MockTexture(1024, 768));
    m.onAwake();
    m._testEvents.OnStartEvent.trigger();
    const before = overlay.mainMaterial.mainPass.baseTex;
    m.triggerAddNode('service');
    assert.equal(overlay.mainMaterial.mainPass.baseTex, before);
    m.socketClient.onDiagramUpdated('abc', 'diff');
    assert.equal(overlay.mainMaterial.mainPass.baseTex.getWidth(), 1024);
  });

  test('demoMode=true: canned textures, labels and hand raise still run', () => {
    const { m, overlay, sent, raised } = setup(true);
    m.triggerAddNode('decision');
    assert.equal(sent[0].l, 'Enforce JWT HMAC Verification');
    assert.equal(raised.length, 1);
    assert.equal(overlay.mainMaterial.mainPass.baseTex, m.texNodeAdded);
    m.triggerUpdateSnapshot();
    assert.equal(raised.length, 2);
    assert.equal(overlay.mainMaterial.mainPass.baseTex, m.texSnapshotUpdated);
  });
});
