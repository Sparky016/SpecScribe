import { findSceneObject } from './SceneUtils';

/**
 * How whiteboard frames are ingested. Exactly one path is live at a time:
 * AUTO samples every `sampleIntervalSeconds`; MANUAL captures only on an explicit pinch.
 */
export const CaptureMode = {
  AUTO: 'auto',
  MANUAL: 'manual'
} as const;

export type CaptureModeName = typeof CaptureMode[keyof typeof CaptureMode];

/** Anything other than 'manual' (case-insensitive) is AUTO, so an unset Inspector value keeps periodic capture. */
export function normalizeCaptureMode(mode: string | undefined | null): CaptureModeName {
  return typeof mode === 'string' && mode.trim().toLowerCase() === CaptureMode.MANUAL ? CaptureMode.MANUAL : CaptureMode.AUTO;
}

@component
export class PeriodicCameraCapturer extends BaseScriptComponent {
  @input
  private sampleIntervalSeconds: number = 3.0;

  // 'auto' (periodic capture) or 'manual' (pinch to capture).
  @input
  private captureMode: string = CaptureMode.AUTO;

  @input
  private frameSmallerDimension: number = 480;

  @input
  @allowUndefined
  private simulatedTexture?: Texture;

  private cameraModule: CameraModule = require('LensStudio:CameraModule');
  private cameraTexture?: Texture;
  private isEncodingActive: boolean = false;
  private timeAccumulator: number = 0;

  public onEncodedFrameAvailable: (encodedBase64: string, timestampMs: number) => void = () => {};
  public onCaptureModeChanged: (mode: CaptureModeName) => void = () => {};

  onAwake(): void {
    this.createEvent('OnStartEvent').bind(() => {
      this.setupCameraPipeline();
    });

    this.createEvent('UpdateEvent').bind((eventData) => {
      this.evaluateCaptureCadence(eventData.getDeltaTime());
    });
  }

  private setupCameraPipeline(): void {
    // 1. If simulatedTexture is assigned (e.g. DemoVideo VideoTexture in Inspector), prioritize it
    if (this.simulatedTexture) {
      this.cameraTexture = this.simulatedTexture;
      // Start playback if this texture is driven by a VideoTextureProvider
      try {
        const ctrl = (this.simulatedTexture as any).control;
        if (ctrl && typeof ctrl.play === 'function') {
          ctrl.play(-1);
          print('[PeriodicCameraCapturer] Video playback started on simulatedTexture (loop).');
        }
      } catch (e) {
        // Ignored
      }
      print('[PeriodicCameraCapturer] Simulated texture active (assigned input).');
      return;
    }

    // 1b. Auto-bind fallback: if WhiteboardBackplate has a VideoTexture (e.g. DemoVideo), use it
    try {
      const wb = findSceneObject('WhiteboardBackplate');
      if (wb && typeof wb.getComponent === 'function') {
        const rmv = wb.getComponent('Component.RenderMeshVisual' as any) as any;
        if (rmv && rmv.mainMaterial && rmv.mainMaterial.mainPass && rmv.mainMaterial.mainPass.baseTex) {
          const tex = rmv.mainMaterial.mainPass.baseTex;
          if (tex && (tex as any).control && typeof (tex as any).control.play === 'function') {
            this.simulatedTexture = tex;
            this.cameraTexture = tex;
            (tex as any).control.play(-1);
            print('[PeriodicCameraCapturer] Video playback started on WhiteboardBackplate texture (loop).');
            return;
          }
        }
      }
    } catch (e) {
      print(`[PeriodicCameraCapturer] Auto-bind fallback error: ${e}`);
    }

    // 2. Fallback to CameraModule live feed (Webcam in Preview / Spectacles hardware)
    try {
      if (typeof CameraModule !== 'undefined' && CameraModule.createCameraRequest) {
        const request = CameraModule.createCameraRequest();
        request.cameraId = CameraModule.CameraId.Default_Color;
        request.imageSmallerDimension = this.frameSmallerDimension;
        this.cameraTexture = this.cameraModule.requestCamera(request);
        print(`[PeriodicCameraCapturer] Camera pipeline initialized at ${this.frameSmallerDimension}p.`);
        return;
      }
    } catch (e) {
      print(`[PeriodicCameraCapturer] Camera pipeline unavailable (simulated runtime): ${e}`);
    }

    print('[PeriodicCameraCapturer] Running in simulation without camera input; periodic capture idle.');
  }

  private evaluateCaptureCadence(deltaTime: number): void {
    if (this.getCaptureMode() !== CaptureMode.AUTO || !this.cameraTexture || this.isEncodingActive) {
      return;
    }

    this.timeAccumulator += deltaTime;
    if (this.timeAccumulator >= this.sampleIntervalSeconds) {
      this.timeAccumulator = 0;
      this.encodeFrameAsync();
    }
  }

  /** Pinch-driven capture. Ignored in AUTO mode so periodic and manual capture never both run; returns true when encoding started. */
  public triggerManualCapture(): boolean {
    if (this.getCaptureMode() !== CaptureMode.MANUAL) {
      print('[PeriodicCameraCapturer] Manual capture ignored: capture mode is AUTO.');
      return false;
    }
    if (this.isEncodingActive || !this.cameraTexture) {
      return false;
    }
    return this.encodeFrameAsync();
  }

  public getCaptureMode(): CaptureModeName {
    return normalizeCaptureMode(this.captureMode);
  }

  /** Switches capture path. The periodic timer restarts so AUTO waits a full interval before its first frame. */
  public setCaptureMode(mode: string): CaptureModeName {
    const next = normalizeCaptureMode(mode);
    const changed = next !== this.getCaptureMode();
    this.captureMode = next;
    this.timeAccumulator = 0;
    if (changed) {
      print(`[PeriodicCameraCapturer] Capture mode set to ${next.toUpperCase()}.`);
      this.onCaptureModeChanged(next);
    }
    return next;
  }

  public toggleCaptureMode(): CaptureModeName {
    return this.setCaptureMode(this.getCaptureMode() === CaptureMode.AUTO ? CaptureMode.MANUAL : CaptureMode.AUTO);
  }

  public getSampleInterval(): number {
    return this.sampleIntervalSeconds;
  }

  public setSampleInterval(seconds: number): void {
    this.sampleIntervalSeconds = Math.max(0.1, seconds);
  }

  public isEncoding(): boolean {
    return this.isEncodingActive;
  }

  public getCameraTexture(): Texture | undefined {
    return this.cameraTexture;
  }

  public getSimulatedTexture(): Texture | undefined {
    return this.simulatedTexture;
  }

  public setSimulatedTexture(texture: Texture): void {
    this.simulatedTexture = texture;
    this.cameraTexture = texture;
    try {
      const ctrl = (texture as any).control;
      if (ctrl && typeof ctrl.play === 'function') {
        ctrl.play(-1);
      }
    } catch (e) {
      // Ignored
    }
    print('[PeriodicCameraCapturer] Simulated texture updated dynamically.');
  }

  private encodeFrameAsync(): boolean {
    if (!this.cameraTexture) {
      return false;
    }

    // Guard against uninitialized / unverified texture frames
    try {
      if (typeof this.cameraTexture.getWidth === 'function') {
        const w = this.cameraTexture.getWidth();
        const h = this.cameraTexture.getHeight();
        if (w <= 0 || h <= 0) {
          // Wait for texture to finish decoding first frame
          return false;
        }
      }
    } catch (e) {
      // Ignored
    }

    this.isEncodingActive = true;
    const captureTimestamp = Date.now();

    Base64.encodeTextureAsync(
      this.cameraTexture,
      (encodedString: string) => {
        this.isEncodingActive = false;
        this.onEncodedFrameAvailable(encodedString, captureTimestamp);
      },
      () => {
        this.isEncodingActive = false;
        print('[PeriodicCameraCapturer] Async frame encoding failed.');
      },
      CompressionQuality.LowQuality,
      EncodingType.Jpg
    );
    return true;
  }
}
