import { test, describe, before, beforeEach, afterEach } from 'node:test';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {
  setupLensGlobalMocks,
  MockSceneObject,
  MockRenderMeshVisual,
  MockScriptEvent,
  MockTexture,
  MockBaseScriptComponent
} from './lens_mock_environment.mjs';

setupLensGlobalMocks();
global.BaseScriptComponent = MockBaseScriptComponent;
global.allowUndefined = () => {};

function createComponentInstance(Cls, sceneObject = new MockSceneObject('TestComponentObj')) {
  const events = {
    OnStartEvent: new MockScriptEvent(),
    UpdateEvent: new MockScriptEvent(),
    OnDestroyEvent: new MockScriptEvent()
  };

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

function makeSceneNode(name, component = null) {
  return {
    name,
    getChildrenCount: () => 0,
    getChild: () => null,
    getComponent: () => component
  };
}

describe('Task 55: gate simulatedTexture & video auto-bind behind demoMode and clear scene defaults', async () => {
  let PeriodicCameraCapturer;
  const originalScene = global.scene;

  before(async () => {
    const capturerMod = await import('../dist/Assets/Scripts/PeriodicCameraCapturer.js');
    PeriodicCameraCapturer = capturerMod.PeriodicCameraCapturer;
  });

  beforeEach(() => {
    global.scene = undefined;
  });

  afterEach(() => {
    global.scene = originalScene;
  });

  describe('AC1: live CameraModule preferred when demoMode is false', () => {
    test('demoMode defaults to false', () => {
      const capturer = createComponentInstance(PeriodicCameraCapturer);
      assert.equal(capturer.demoMode, false);
      assert.equal(capturer.getDemoMode(), false);
    });

    test('binds live CameraModule texture when demoMode is false even if simulatedTexture is assigned', () => {
      const mockLiveCamera = new MockTexture(480, 360);
      const mockSimulated = new MockTexture(1920, 1080);
      let requestedDimension = null;

      const capturer = createComponentInstance(PeriodicCameraCapturer);
      capturer.cameraModule = {
        requestCamera: (req) => {
          requestedDimension = req.imageSmallerDimension;
          return mockLiveCamera;
        }
      };
      capturer.simulatedTexture = mockSimulated;
      assert.equal(capturer.demoMode, false);

      capturer.onAwake();
      capturer._testEvents.OnStartEvent.trigger();

      assert.equal(capturer.getCameraTexture(), mockLiveCamera);
      assert.equal(requestedDimension, 480);
    });

    test('binds live CameraModule texture when demoMode is false even if WhiteboardBackplate has texture', () => {
      const mockLiveCamera = new MockTexture(480, 360);
      const wbTexture = new MockTexture(1280, 720);
      let playCalled = false;
      wbTexture.control = { play: () => { playCalled = true; } };

      const rmv = new MockRenderMeshVisual();
      rmv.mainMaterial = { mainPass: { baseTex: wbTexture } };
      const wbNode = makeSceneNode('WhiteboardBackplate', rmv);
      global.scene = {
        getRootObjectsCount: () => 1,
        getRootObject: () => wbNode
      };

      const capturer = createComponentInstance(PeriodicCameraCapturer);
      capturer.cameraModule = {
        requestCamera: () => mockLiveCamera
      };
      capturer.demoMode = false;

      capturer.onAwake();
      capturer._testEvents.OnStartEvent.trigger();

      assert.equal(capturer.getCameraTexture(), mockLiveCamera);
      assert.equal(playCalled, false, 'WhiteboardBackplate video should not play when camera is live');
    });
  });

  describe('AC2: simulatedTexture & WhiteboardBackplate used when demoMode is true or CameraModule fails', () => {
    test('when demoMode is true, binds simulatedTexture even if CameraModule is available', () => {
      const mockLiveCamera = new MockTexture(480, 360);
      const mockSimulated = new MockTexture(1920, 1080);
      let simulatedPlayLoops = null;
      mockSimulated.control = {
        play: (loops) => { simulatedPlayLoops = loops; }
      };

      const capturer = createComponentInstance(PeriodicCameraCapturer);
      let cameraRequested = false;
      capturer.cameraModule = {
        requestCamera: () => {
          cameraRequested = true;
          return mockLiveCamera;
        }
      };
      capturer.simulatedTexture = mockSimulated;
      capturer.demoMode = true;

      capturer.onAwake();
      capturer._testEvents.OnStartEvent.trigger();

      assert.equal(capturer.getCameraTexture(), mockSimulated);
      assert.equal(simulatedPlayLoops, -1, 'looping playback started on simulatedTexture');
      assert.equal(cameraRequested, false, 'CameraModule should not be invoked when demoMode is true');
    });

    test('when demoMode is true and simulatedTexture is unset, auto-binds WhiteboardBackplate video texture', () => {
      const wbTexture = new MockTexture(1280, 720);
      let wbPlayLoops = null;
      wbTexture.control = { play: (loops) => { wbPlayLoops = loops; } };

      const rmv = new MockRenderMeshVisual();
      rmv.mainMaterial = { mainPass: { baseTex: wbTexture } };
      const wbNode = makeSceneNode('WhiteboardBackplate', rmv);
      global.scene = {
        getRootObjectsCount: () => 1,
        getRootObject: () => wbNode
      };

      const capturer = createComponentInstance(PeriodicCameraCapturer);
      capturer.demoMode = true;

      capturer.onAwake();
      capturer._testEvents.OnStartEvent.trigger();

      assert.equal(capturer.getCameraTexture(), wbTexture);
      assert.equal(wbPlayLoops, -1, 'looping playback started on WhiteboardBackplate texture');
    });

    test('when demoMode is false but CameraModule throws, falls back to simulatedTexture', () => {
      const mockSimulated = new MockTexture(1920, 1080);
      let playCalled = false;
      mockSimulated.control = { play: () => { playCalled = true; } };

      const capturer = createComponentInstance(PeriodicCameraCapturer);
      capturer.cameraModule = {
        requestCamera: () => {
          throw new Error('Hardware camera disconnected');
        }
      };
      capturer.simulatedTexture = mockSimulated;
      capturer.demoMode = false;

      capturer.onAwake();
      capturer._testEvents.OnStartEvent.trigger();

      assert.equal(capturer.getCameraTexture(), mockSimulated);
      assert.equal(playCalled, true);
    });

    test('when demoMode is false and CameraModule throws and simulatedTexture is unset, falls back to WhiteboardBackplate', () => {
      const wbTexture = new MockTexture(1280, 720);
      let wbPlayCalled = false;
      wbTexture.control = { play: () => { wbPlayCalled = true; } };

      const rmv = new MockRenderMeshVisual();
      rmv.mainMaterial = { mainPass: { baseTex: wbTexture } };
      const wbNode = makeSceneNode('WhiteboardBackplate', rmv);
      global.scene = {
        getRootObjectsCount: () => 1,
        getRootObject: () => wbNode
      };

      const capturer = createComponentInstance(PeriodicCameraCapturer);
      capturer.cameraModule = {
        requestCamera: () => {
          throw new Error('Camera device unavailable');
        }
      };
      capturer.demoMode = false;

      capturer.onAwake();
      capturer._testEvents.OnStartEvent.trigger();

      assert.equal(capturer.getCameraTexture(), wbTexture);
      assert.equal(wbPlayCalled, true);
    });

    test('when CameraModule throws and neither simulatedTexture nor WhiteboardBackplate exists, stays undefined without crashing', () => {
      global.scene = {
        getRootObjectsCount: () => 0,
        getRootObject: () => null
      };
      const capturer = createComponentInstance(PeriodicCameraCapturer);
      capturer.cameraModule = {
        requestCamera: () => {
          throw new Error('Camera device unavailable');
        }
      };
      capturer.demoMode = false;

      capturer.onAwake();
      capturer._testEvents.OnStartEvent.trigger();

      assert.equal(capturer.getCameraTexture(), undefined);
    });
  });

  describe('AC3: Scene.scene contains no hardcoded simulatedSpeechPhrase', () => {
    test('Scene.scene has 0 matches for Payment Gateway Microservice', () => {
      const scenePath = new URL('../Assets/Scene.scene', import.meta.url);
      const sceneContent = fs.readFileSync(scenePath, 'utf8');
      assert.equal(
        sceneContent.includes('Payment Gateway Microservice'),
        false,
        'Scene.scene must not contain hardcoded Payment Gateway Microservice'
      );
    });

    test('Scene.scene specifies demoMode: false for PeriodicCameraCapturer', () => {
      const scenePath = new URL('../Assets/Scene.scene', import.meta.url);
      const sceneContent = fs.readFileSync(scenePath, 'utf8');
      assert.equal(
        sceneContent.includes('demoMode: false'),
        true,
        'Scene.scene should have demoMode: false'
      );
    });

    test('.virtual-scene.json has 0 matches for Payment Gateway Microservice', () => {
      const vScenePath = new URL('../.virtual-scene.json', import.meta.url);
      const vSceneContent = fs.readFileSync(vScenePath, 'utf8');
      assert.equal(
        vSceneContent.includes('Payment Gateway Microservice'),
        false,
        '.virtual-scene.json must not contain hardcoded Payment Gateway Microservice'
      );
    });
  });
});
