
@component
export class PeriodicCameraCapturer extends BaseScriptComponent {
  @input
  private sampleIntervalSeconds: number = 3.0;

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

    if (this.simulatedTexture) {
      this.cameraTexture = this.simulatedTexture;
      print('[PeriodicCameraCapturer] Fallback simulated texture active.');
    } else {
      print('[PeriodicCameraCapturer] Running in simulation without camera input; periodic capture idle.');
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
      CompressionQuality.LowQuality,
      EncodingType.Jpg
    );
  }
}
