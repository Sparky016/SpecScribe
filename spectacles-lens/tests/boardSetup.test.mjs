import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import {
  setupLensGlobalMocks,
  MockSceneObject,
  MockRenderMeshVisual,
  MockText,
  MockScriptEvent,
  MockBaseScriptComponent,
  MockTransform,
  MockVec3
} from './lens_mock_environment.mjs';

setupLensGlobalMocks();
global.BaseScriptComponent = MockBaseScriptComponent;
global.allowUndefined = () => {};
MockTransform.prototype.getWorldScale = function () { return this.scale; };
MockTransform.prototype.setWorldScale = function (s) { this.scale = s; };
MockTransform.prototype.getWorldRotation = function () { return this.rotation; };
MockTransform.prototype.setWorldRotation = function (r) { this.rotation = r; };
global.vec2 = class { constructor(x = 0, y = 0) { this.x = x; this.y = y; } };
global.Shape = { createBoxShape: () => ({ size: null }) };
global.getTime = () => 100;

function createComponentInstance(Cls, sceneObject = new MockSceneObject('TestComponentObj')) {
  const events = { OnStartEvent: new MockScriptEvent(), UpdateEvent: new MockScriptEvent(), OnDestroyEvent: new MockScriptEvent() };
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

/** A WhiteboardBackplate stand-in: unit-plane mesh scaled to board size, with a collider and SIK manipulation. */
function backplate({ position = new MockVec3(-21.1, 0, -190), scale = new MockVec3(105.6, 1, 63.4) } = {}) {
  const board = new MockRenderMeshVisual();
  const obj = board.getSceneObject();
  obj.transform.position = position;
  obj.transform.scale = scale;
  const collider = { shape: null, fitVisual: true };
  const manipulation = { enableTranslation: true, enableRotation: true, enableScale: true };
  obj.getComponent = (type) => (String(type).includes('Collider') ? collider : null);
  obj.getComponents = () => [manipulation];
  return { board, obj, collider, manipulation };
}

describe('Whiteboard backplate setup for the video-input preview', () => {
  let WhiteboardCalibrator, SpatialInterfaceManager, WhiteboardState;

  before(async () => {
    ({ WhiteboardCalibrator } = await import('../dist/Assets/Scripts/WhiteboardCalibrator.js'));
    ({ SpatialInterfaceManager, WhiteboardState } = await import('../dist/Assets/Scripts/SpatialInterfaceManager.js'));
  });

  describe('configureCollider', () => {
    test('sizes the box in local units so it covers exactly the scaled board, 10 cm deep', () => {
      const { board, collider } = backplate({ scale: new MockVec3(140, 1, 90) });
      const cal = createComponentInstance(WhiteboardCalibrator);
      cal.boardMesh = board;
      cal.configureCollider();
      const s = collider.shape.size;
      assert.deepEqual([s.x, s.y, s.z], [1, 10, 1], 'world size = (1*140, 10*1, 1*90) = the board');
      assert.equal(collider.fitVisual, false);
    });

    test('keeps the 10 cm depth when the board has a non-unit Y scale', () => {
      const { board, collider } = backplate({ scale: new MockVec3(100, 2, 60) });
      const cal = createComponentInstance(WhiteboardCalibrator);
      cal.boardMesh = board;
      cal.configureCollider();
      assert.equal(collider.shape.size.y * 2, 10);
    });
  });

  describe('SpatialInterfaceManager.useAuthoredBoardPose', () => {
    function start(useAuthoredBoardPose) {
      const parts = backplate();
      const m = createComponentInstance(SpatialInterfaceManager);
      m.useAuthoredBoardPose = useAuthoredBoardPose;
      m.whiteboardBoardMesh = parts.board;
      m.diffToastText = new MockText('');
      m.onAwake();
      m._testEvents.OnStartEvent.trigger();
      return { m, ...parts };
    }

    test('on: keeps the authored pose, locks manipulation and starts in drawing mode', () => {
      const { m, obj, manipulation } = start(true);
      const p = obj.transform.position;
      assert.deepEqual([p.x, p.y, p.z], [-21.1, 0, -190], 'authored pose is not overwritten');
      assert.equal(manipulation.enableTranslation, false, 'a stray pinch can no longer drag the board');
      assert.equal(m.getWhiteboardState(), WhiteboardState.DRAWING_ACTIVE, 'every board pinch captures from the start');
    });

    test('off: moves the board to the calibration pose and leaves it manipulable until locked', () => {
      const { m, obj, manipulation } = start(false);
      const p = obj.transform.position;
      assert.deepEqual([p.x, p.y, p.z], [50, 185, -230]);
      assert.equal(manipulation.enableTranslation, true);
      assert.equal(m.getWhiteboardState(), WhiteboardState.SELECT_AREA);
    });
  });
});
