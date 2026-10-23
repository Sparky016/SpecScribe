// Lens Studio 5.15 and Spectacles Interaction Kit (SIK) Global Typings

declare function component(target: any): any;
declare function input(target: any, propertyKey: string): void;

declare function print(message: any): void;

declare function setTimeout(callback: (...args: any[]) => void, ms?: number): any;
declare function clearTimeout(timeoutId: any): void;

declare class vec3 {
  x: number;
  y: number;
  z: number;
  constructor(x?: number, y?: number, z?: number);
}

declare class quat {
  x: number;
  y: number;
  z: number;
  w: number;
  static angleAxis(angleRad: number, axis: vec3): quat;
  multiply(other: quat): quat;
}

declare class Transform {
  getLocalPosition(): vec3;
  setLocalPosition(pos: vec3): void;
  getWorldPosition(): vec3;
  setWorldPosition(pos: vec3): void;
  getLocalRotation(): quat;
  setLocalRotation(rot: quat): void;
  getLocalScale(): vec3;
  setLocalScale(scale: vec3): void;
}

declare class SceneObject {
  name: string;
  enabled: boolean;
  getTransform(): Transform;
  createComponent(componentType: string): any;
  getComponent(componentType: string): any;
}

declare class Texture {
  getWidth(): number;
  getHeight(): number;
}

declare namespace CameraModule {
  enum CameraId {
    Default_Color = 0,
    Left_Color = 1,
    Right_Color = 2
  }

  interface CameraRequest {
    cameraId: CameraId;
    imageSmallerDimension: number;
  }

  function createCameraRequest(): CameraRequest;
}

declare interface CameraModule {
  requestCamera(request: CameraModule.CameraRequest): Texture;
}

declare namespace Base64 {
  function encodeTextureAsync(
    texture: Texture,
    onSuccess: (encodedString: string) => void,
    onError: () => void,
    quality: any,
    encoding: any
  ): void;

  function decodeTextureAsync(
    encodedString: string,
    onSuccess: (texture: Texture) => void,
    onError: () => void
  ): void;
}

declare namespace AsrModule {
  enum AsrMode {
    HighSpeed = 0,
    HighAccuracy = 1
  }

  interface TranscriptionUpdateEvent {
    text: string;
    isFinal: boolean;
  }

  interface EventCallback<T> {
    add(callback: (arg: T) => void): void;
    remove(callback: (arg: T) => void): void;
  }

  interface AsrTranscriptionOptions {
    mode: AsrMode;
    silenceUntilTerminationMs: number;
    onTranscriptionUpdateEvent: EventCallback<TranscriptionUpdateEvent>;
  }

  namespace AsrTranscriptionOptions {
    function create(): AsrTranscriptionOptions;
  }
}

declare interface AsrModule {
  startTranscribing(options: AsrModule.AsrTranscriptionOptions): void;
  stopTranscribing(): void;
}

declare interface WebSocketMessageEvent {
  data: string | ArrayBuffer | Blob;
}

declare interface WebSocket {
  binaryType: string;
  readyState: number;
  onopen: (() => void) | null;
  onclose: (() => void) | null;
  onerror: ((error: any) => void) | null;
  onmessage: ((event: WebSocketMessageEvent) => void) | null;
  send(data: string | ArrayBuffer | Blob): void;
  close(code?: number, reason?: string): void;
}

declare interface InternetModule {
  createWebSocket(url: string): WebSocket;
}

declare class Pass {
  baseTex: Texture;
}

declare class Material {
  mainPass: Pass;
}

declare class RenderMeshVisual {
  enabled: boolean;
  mainMaterial: Material;
  getSceneObject(): SceneObject;
}

declare class Text {
  text: string;
  size: number;
}

declare namespace Audio {
  enum PlaybackMode {
    LowLatency = 0,
    HighQuality = 1
  }
}

declare class AudioComponent {
  playbackMode: Audio.PlaybackMode;
  play(loops: number): void;
  stop(fadeTime?: number): void;
}

declare interface ScriptEvent {
  bind(callback: (eventData?: any) => void): void;
  enabled?: boolean;
}

declare interface DelayedCallbackEvent extends ScriptEvent {
  reset(time: number): void;
  cancel(): void;
  getTimeLeft?(): number;
  getDelayTime?(): number;
}

declare module 'Component/ScriptComponent' {
  export class BaseScriptComponent {
    createEvent(eventType: 'DelayedCallbackEvent'): DelayedCallbackEvent;
    createEvent(eventType: 'OnStartEvent' | 'UpdateEvent' | 'OnDestroyEvent' | string): ScriptEvent;
    getSceneObject(): SceneObject;
    getTransform(): Transform;
  }
}

declare module 'SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable' {
  export class Interactable {
    enabled: boolean;
  }
}

declare module 'SpectaclesInteractionKit.lspkg/Components/UI/PinchButton/PinchButton' {
  import { Interactable } from 'SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable';
  export class PinchButton {
    interactable: Interactable;
    onButtonPinched: {
      add(callback: () => void): void;
      remove(callback: () => void): void;
    };
  }
}

declare function require(moduleName: 'LensStudio:CameraModule'): CameraModule;
declare function require(moduleName: 'LensStudio:InternetModule'): InternetModule;
declare function require(moduleName: 'LensStudio:AsrModule'): AsrModule;
declare function require(moduleName: string): any;
