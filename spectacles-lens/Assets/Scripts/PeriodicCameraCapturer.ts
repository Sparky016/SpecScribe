import { BaseScriptComponent } from 'Component/ScriptComponent';

export enum CompressionQuality {
  Low = 0,
  Medium = 1,
  High = 2
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
    const request = CameraModule.createCameraRequest();
    request.cameraId = CameraModule.CameraId.Default_Color;
    request.imageSmallerDimension = this.frameSmallerDimension;
    this.cameraTexture = this.cameraModule.requestCamera(request);
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
