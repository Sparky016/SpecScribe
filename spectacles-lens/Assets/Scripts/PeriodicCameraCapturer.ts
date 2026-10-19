import { BaseScriptComponent } from 'Component/ScriptComponent';

export enum CompressionQuality {
  Low = 0,
  Medium = 1,
  High = 2
}

export enum EncodingType {
  Png = 0,
  Jpg = 1
}

@component
export class PeriodicCameraCapturer extends BaseScriptComponent {
  @input
  private sampleIntervalSeconds: number = 3.0;

  @input
  private frameSmallerDimension: number = 480;

  private cameraModule: CameraModule = require('LensStudio:CameraModule');
  private cameraTexture?: Texture;
  private isEncodingActive: boolean = false;
  private timeAccumulator: number = 0;

  public onEncodedFrameAvailable: (encodedBase64: string, timestampMs: number) => void = () => {};

  onAwake(): void {
    this.createEvent('OnStartEvent').bind(() => {
      this.setupCameraPipeline();
    });

    this.createEvent('UpdateEvent').bind((eventData) => {
      this.evaluateCaptureCadence(eventData.getDeltaTime());
    });
  }

  private setupCameraPipeline(): void {
    try {
      const request = CameraModule.createCameraRequest();
      request.cameraId = CameraModule.CameraId.Default_Color;
      request.imageSmallerDimension = this.frameSmallerDimension;
      this.cameraTexture = this.cameraModule.requestCamera(request);
      print(`[PeriodicCameraCapturer] Camera pipeline initialized at ${this.frameSmallerDimension}p.`);
    } catch (e) {
      print(`[PeriodicCameraCapturer] Failed to initialize camera pipeline: ${e}`);
    }
  }

  private evaluateCaptureCadence(deltaTime: number): void {
    if (!this.cameraTexture || this.isEncodingActive) {
      return;
    }

    this.timeAccumulator += deltaTime;
    if (this.timeAccumulator >= this.sampleIntervalSeconds) {
      this.timeAccumulator = 0;
      this.encodeFrameAsync();
    }
  }

  public triggerManualCapture(): void {
    if (!this.isEncodingActive && this.cameraTexture) {
      this.encodeFrameAsync();
    }
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

  private encodeFrameAsync(): void {
    if (!this.cameraTexture) {
      return;
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
      CompressionQuality.Low,
      EncodingType.Jpg
    );
  }
}
