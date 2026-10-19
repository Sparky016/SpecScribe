// Mock environment for Snap Lens Studio 5.15 and Spectacles Interaction Kit
import Module from 'node:module';

export class MockTransform {
  constructor() {
    this.position = new MockVec3(0, 0, 0);
    this.rotation = new MockQuat(0, 0, 0, 1);
    this.scale = new MockVec3(1, 1, 1);
  }
  getLocalPosition() { return this.position; }
  setLocalPosition(p) { this.position = p; }
  getWorldPosition() { return this.position; }
  setWorldPosition(p) { this.position = p; }
  getLocalRotation() { return this.rotation; }
  setLocalRotation(r) { this.rotation = r; }
  getLocalScale() { return this.scale; }
  setLocalScale(s) { this.scale = s; }
}

export class MockVec3 {
  constructor(x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
  }
}

export class MockQuat {
  constructor(x = 0, y = 0, z = 0, w = 1) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.w = w;
  }
  static angleAxis(angleRad, axis) {
    const half = angleRad / 2;
    const s = Math.sin(half);
    return new MockQuat(axis.x * s, axis.y * s, axis.z * s, Math.cos(half));
  }
  multiply(other) {
    return new MockQuat(
      this.w * other.x + this.x * other.w + this.y * other.z - this.z * other.y,
      this.w * other.y - this.x * other.z + this.y * other.w + this.z * other.x,
      this.w * other.z + this.x * other.y - this.y * other.x + this.z * other.w,
      this.w * other.w - this.x * other.x - this.y * other.y - this.z * other.z
    );
  }
}

export class MockSceneObject {
  constructor(name = 'MockObject') {
    this.name = name;
    this.enabled = true;
    this.transform = new MockTransform();
  }
  getTransform() { return this.transform; }
}

export class MockTexture {
  constructor(w = 480, h = 360) {
    this.width = w;
    this.height = h;
  }
  getWidth() { return this.width; }
  getHeight() { return this.height; }
}

export class MockPass {
  constructor() {
    this.baseTex = null;
  }
}

export class MockMaterial {
  constructor() {
    this.mainPass = new MockPass();
  }
}

export class MockRenderMeshVisual {
  constructor() {
    this.enabled = true;
    this.mainMaterial = new MockMaterial();
    this.sceneObject = new MockSceneObject('MeshObject');
  }
  getSceneObject() { return this.sceneObject; }
}

export class MockText {
  constructor(initial = '') {
    this.text = initial;
    this.size = 20;
  }
}

export class MockAudioComponent {
  constructor() {
    this.playbackMode = 0; // LowLatency = 0
    this.playCount = 0;
  }
  play(loops = 1) {
    this.playCount += loops;
  }
  stop() {}
}

export class MockPinchButton {
  constructor() {
    this.callbacks = [];
    this.onButtonPinched = {
      add: (cb) => this.callbacks.push(cb),
      remove: (cb) => {
        this.callbacks = this.callbacks.filter(c => c !== cb);
      }
    };
  }
  simulatePinch() {
    for (const cb of this.callbacks) {
      cb();
    }
  }
}

export class MockWebSocket {
  constructor(url) {
    this.url = url;
    this.binaryType = 'blob';
    this.readyState = 1; // OPEN
    this.sentMessages = [];
    this.onopen = null;
    this.onclose = null;
    this.onerror = null;
    this.onmessage = null;
  }
  send(data) {
    this.sentMessages.push(data);
  }
  close() {
    this.readyState = 3; // CLOSED
    if (this.onclose) this.onclose();
  }
  simulateServerMessage(msgObj) {
    if (this.onmessage) {
      this.onmessage({ data: JSON.stringify(msgObj) });
    }
  }
}

export class MockScriptEvent {
  constructor() {
    this.callbacks = [];
    this.delayTime = 0;
    this.enabled = true;
  }
  bind(cb) {
    this.callbacks.push(cb);
  }
  reset(seconds) {
    this.delayTime = seconds;
    this.enabled = true;
  }
  cancel() {
    this.enabled = false;
  }
  trigger(eventData) {
    if (!this.enabled) return;
    for (const cb of this.callbacks) {
      cb(eventData);
    }
  }
}

export class MockBaseScriptComponent {
  constructor() {
    this._events = {};
    this._sceneObject = new MockSceneObject('MockBaseScript');
  }
  createEvent(eventType) {
    if (!this._events[eventType]) {
      this._events[eventType] = new MockScriptEvent();
    }
    return this._events[eventType];
  }
  getSceneObject() {
    return this._sceneObject;
  }
  getTransform() {
    return this._sceneObject.getTransform();
  }
}

export function setupLensGlobalMocks() {
  global.component = (target) => target;
  global.input = () => {};
  global.print = () => {};
  global.vec3 = MockVec3;
  global.quat = MockQuat;
  global.Audio = { PlaybackMode: { LowLatency: 0, HighQuality: 1 } };
  global.RenderMeshVisual = MockRenderMeshVisual;
  global.Text = MockText;
  global.SceneObject = MockSceneObject;
  global.AudioComponent = MockAudioComponent;
  global.Texture = MockTexture;
  global.Transform = MockTransform;

  global.Base64 = {
    encodeTextureAsync: (texture, onSuccess, onError, quality, encoding) => {
      onSuccess('mock_base64_encoded_frame_jpg');
    },
    decodeTextureAsync: (encodedString, onSuccess, onError) => {
      onSuccess(new MockTexture());
    }
  };

  global.CameraModule = {
    CameraId: { Default_Color: 0, Left_Color: 1, Right_Color: 2 },
    createCameraRequest: () => ({
      cameraId: 0,
      imageSmallerDimension: 480
    }),
    requestCamera: (req) => new MockTexture(req?.imageSmallerDimension || 480, 360)
  };

  global.AsrModule = {
    AsrMode: { HighSpeed: 0, HighAccuracy: 1 },
    AsrTranscriptionOptions: {
      create: () => {
        const cbs = [];
        return {
          mode: 0,
          silenceUntilTerminationMs: 1000,
          onTranscriptionUpdate: {
            add: (cb) => cbs.push(cb),
            remove: (cb) => {
              const idx = cbs.indexOf(cb);
              if (idx >= 0) cbs.splice(idx, 1);
            }
          },
          _callbacks: cbs
        };
      }
    }
  };

  // Intercept Node CJS module resolution for Lens Studio internal modules
  const originalLoad = Module._load;
  Module._load = function (request, parent, isMain) {
    if (request === 'LensStudio:CameraModule') {
      return global.CameraModule;
    }
    if (request === 'LensStudio:InternetModule') {
      return {
        createWebSocket: (url) => {
          if (global._mockSocketFactory) return global._mockSocketFactory(url);
          return global._mockSocket || new MockWebSocket(url);
        }
      };
    }
    if (request === 'LensStudio:AsrModule') {
      return {
        startTranscribing: (opts) => {
          if (global._mockAsrHandler) global._mockAsrHandler(opts);
        },
        stopTranscribing: () => {}
      };
    }
    if (request === 'Component/ScriptComponent') {
      return { BaseScriptComponent: MockBaseScriptComponent };
    }
    if (request.includes('PinchButton')) {
      return { PinchButton: MockPinchButton };
    }
    if (request.includes('Interactable')) {
      return { Interactable: class Interactable { constructor() { this.enabled = true; } } };
    }
    return originalLoad.apply(this, arguments);
  };
}
