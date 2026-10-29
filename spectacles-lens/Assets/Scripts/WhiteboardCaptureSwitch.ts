import { PeriodicCameraCapturer, CaptureMode, CaptureModeName } from './PeriodicCameraCapturer';

/**
 * Selects which whiteboard ingestion path is live: AUTO (PeriodicCameraCapturer samples every few seconds while the
 * user draws) or MANUAL (a pinch on the whiteboard or the capture button ingests one frame). Only one path runs at a
 * time. Kept out of SpatialInterfaceManager so the composition root stays small; the capturer is found on the host
 * SceneObject unless assigned.
 */
export class WhiteboardCaptureSwitch {
  public capturer?: PeriodicCameraCapturer;

  constructor(
    private readonly host: () => SceneObject,
    private readonly toast: (text: string) => void,
    private readonly isLocked: () => boolean = () => false
  ) {}

  /** Current capture path; AUTO when no capturer is attached (the capturer's own default). */
  public getMode(): CaptureModeName {
    const c = this.resolve();
    return c ? c.getCaptureMode() : CaptureMode.AUTO;
  }

  public setMode(mode: string): CaptureModeName {
    const c = this.resolve();
    if (!c) {
      print('[WhiteboardCaptureSwitch] No camera capturer attached; capture mode unchanged.');
      return CaptureMode.AUTO;
    }
    const next = c.setCaptureMode(mode);
    this.toast(next === CaptureMode.AUTO
      ? `Capture: AUTO • every ${c.getSampleInterval().toFixed(0)}s`
      : 'Capture: MANUAL • Pinch capture to ingest the whiteboard');
    return next;
  }

  public toggleMode(): CaptureModeName {
    return this.setMode(this.getMode() === CaptureMode.AUTO ? CaptureMode.MANUAL : CaptureMode.AUTO);
  }

  /** Manual capture pinch: ingests one whiteboard frame in MANUAL mode. Returns true when a capture started. */
  public captureNow(): boolean {
    if (this.isLocked()) {
      print('[WhiteboardCaptureSwitch] Meeting is concluded; ignoring whiteboard capture.');
      return false;
    }
    const c = this.resolve();
    if (!c) {
      print('[WhiteboardCaptureSwitch] No camera capturer attached; whiteboard capture unavailable.');
      return false;
    }
    if (c.getCaptureMode() !== CaptureMode.MANUAL) {
      print('[WhiteboardCaptureSwitch] Pinch capture ignored: capture mode is AUTO.');
      this.toast('Auto capture is on • Switch to MANUAL to pinch-capture');
      return false;
    }
    const started = c.triggerManualCapture();
    print(`[WhiteboardCaptureSwitch] Pinch capture ${started ? 'started' : 'skipped (busy or camera not ready)'}.`);
    this.toast(started ? 'Whiteboard captured • Ingesting...' : 'Capture busy or camera not ready • Try again');
    return started;
  }

  private resolve(): PeriodicCameraCapturer | undefined {
    if (this.capturer) return this.capturer;
    try {
      for (const c of this.host().getComponents('Component.ScriptComponent' as any) as any[]) {
        if (c && typeof c.setCaptureMode === 'function' && typeof c.triggerManualCapture === 'function') {
          return (this.capturer = c as PeriodicCameraCapturer);
        }
      }
    } catch (e) {
      print(`[WhiteboardCaptureSwitch] capturer lookup failed: ${e}`);
    }
    return undefined;
  }
}
