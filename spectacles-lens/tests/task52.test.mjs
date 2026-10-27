import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  setupLensGlobalMocks,
  MockSceneObject,
  MockVec3,
  MockQuat,
  MockScriptEvent,
  MockBaseScriptComponent
} from './lens_mock_environment.mjs';

setupLensGlobalMocks();
global.BaseScriptComponent = MockBaseScriptComponent;
global.allowUndefined = () => {};
// Static quat.slerp is not in the shared mock; a step stub is enough for these assertions
MockQuat.slerp = (a, b, t) => (t >= 0.5 ? b : a);

const CONTROLLER_SOURCE = new URL('../Assets/Scripts/RaisingHandAgentController.ts', import.meta.url);

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

// Scene node with parent tracking and world rotation / camera axes on its transform
function makeNode(name, parent = null) {
  const node = new MockSceneObject(name);
  node.parent = parent;
  node.setParentCalls = 0;
  node.getParent = () => node.parent;
  node.setParent = (p) => {
    node.parent = p;
    node.setParentCalls++;
  };
  const t = node.getTransform();
  t.worldRotation = new MockQuat(0, 0, 0, 1);
  t.getWorldRotation = () => t.worldRotation;
  t.setWorldRotation = (r) => {
    t.worldRotation = r;
  };
  t.forward = new MockVec3(0, 0, -1);
  t.right = new MockVec3(1, 0, 0);
  t.up = new MockVec3(0, 1, 0);
  return node;
}

describe('Task 52: lazy-follow the agent orb instead of head-locking', () => {
  let RaisingHandAgentController;

  before(async () => {
    const mod = await import('../dist/Assets/Scripts/RaisingHandAgentController.js');
    RaisingHandAgentController = mod.RaisingHandAgentController;
  });

  function setup() {
    const world = makeNode('World');
    const camera = makeNode('Camera', world);
    const orb = makeNode('RaisingHandAgentRoot', camera);
    const controller = createComponentInstance(RaisingHandAgentController);
    controller.agentRootObject = orb;
    controller.cameraObject = camera;
    controller.onAwake();
    controller._testEvents.OnStartEvent.trigger();
    return { controller, world, camera, orb };
  }

  function tick(controller, dt = 1 / 60, frames = 1) {
    for (let i = 0; i < frames; i++) {
      controller._testEvents.UpdateEvent.trigger({ getDeltaTime: () => dt });
    }
  }

  test('onUpdate and follow helpers never call setParent (AC1)', () => {
    const src = readFileSync(CONTROLLER_SOURCE, 'utf8');
    const start = src.indexOf('  private onUpdate(');
    const end = src.indexOf('  private anchorToCamera(');
    const helpersStart = src.indexOf('  private computeCameraTargetPose(');
    const helpersEnd = src.indexOf('  private findCameraObject(');
    assert.ok(start > 0 && end > start, 'onUpdate block located');
    assert.ok(helpersStart > 0 && helpersEnd > helpersStart, 'follow helpers located');
    assert.ok(!src.slice(start, end).includes('setParent('), 'onUpdate must not reparent');
    assert.ok(!src.slice(helpersStart, helpersEnd).includes('setParent('), 'follow helpers must not reparent');
  });

  test('orb is parented once at start and never reparented per frame', () => {
    const { controller, world, orb } = setup();
    assert.equal(orb.getParent(), world, 'orb moves off the camera to the camera\'s parent');
    assert.equal(orb.setParentCalls, 1, 'one setParent at start');
    tick(controller, 1 / 60, 120);
    assert.equal(orb.setParentCalls, 1, 'no setParent during updates');
  });

  test('orb starts at the camera-relative target pose', () => {
    const { orb } = setup();
    const p = orb.getTransform().getWorldPosition();
    assert.equal(p.x, 26);
    assert.equal(p.y, 15);
    assert.equal(p.z, -115);
  });

  test('orb lags a small camera move and converges with damping', () => {
    const { controller, camera, orb } = setup();
    camera.getTransform().setWorldPosition(new MockVec3(30, 0, 0));

    tick(controller, 0.1, 1);
    const afterOne = orb.getTransform().getWorldPosition().x;
    assert.ok(afterOne > 26 && afterOne < 56, `x=${afterOne} should lag target 56 but move toward it`);

    tick(controller, 1 / 60, 300);
    const converged = orb.getTransform().getWorldPosition().x;
    assert.ok(Math.abs(converged - 56) < 0.01, `x=${converged} should converge to target 56`);
  });

  test('orb snaps to target when lag exceeds the clamp', () => {
    const { controller, camera, orb } = setup();
    camera.getTransform().setWorldPosition(new MockVec3(200, 0, 0));

    tick(controller, 1 / 60, 1);
    const p = orb.getTransform().getWorldPosition();
    assert.equal(p.x, 226, 'target x = camera x + 26');
    assert.equal(p.y, 15);
    assert.equal(p.z, -115);
  });
});
