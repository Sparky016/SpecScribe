import { PeriodicCameraCapturer, CaptureMode, CaptureModeName } from './PeriodicCameraCapturer';

/** Formats the HUD mode badge string ("CAPTURE: AUTO (3s)" or "CAPTURE: MANUAL"). */
export function formatModeBadge(mode: CaptureModeName, intervalSec: number = 3): string {
  return mode === CaptureMode.MANUAL ? 'CAPTURE: MANUAL' : `CAPTURE: AUTO (${intervalSec.toFixed(0)}s)`;
}

/**
 * Whiteboard ingestion: a pinch on the whiteboard or the capture button always ingests one frame. The mode only
 * decides what happens between pinches: AUTO (PeriodicCameraCapturer also samples every few seconds) or MANUAL
 * (pinches only). Kept out of SpatialInterfaceManager so the composition root stays small; the capturer is found on
 * the host SceneObject unless assigned.
 */
export class WhiteboardCaptureSwitch {
  public capturer?: PeriodicCameraCapturer;
  public onModeChanged?: (mode: CaptureModeName) => void;

  constructor(
    private readonly host: () => SceneObject,
    private readonly toast: (text: string) => void,
    private readonly isLocked: () => boolean = () => false,
    onModeChanged?: (mode: CaptureModeName) => void
  ) {
    this.onModeChanged = onModeChanged;
  }

  /** Current capture path; AUTO when no capturer is attached (the capturer's own default). */
  public getMode(): CaptureModeName {
    const c = this.resolve();
    return c ? c.getCaptureMode() : CaptureMode.AUTO;
  }

  /** Returns the formatted badge text ("CAPTURE: AUTO (3s)" or "CAPTURE: MANUAL") for the active or supplied mode. */
  public formatModeBadge(mode: CaptureModeName = this.getMode()): string {
    const c = this.resolve();
    return formatModeBadge(mode, c ? c.getSampleInterval() : 3);
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
      : 'Capture: MANUAL • Pinch to capture the whiteboard');
    this.onModeChanged?.(next);
    return next;
  }

  public toggleMode(): CaptureModeName {
    return this.setMode(this.getMode() === CaptureMode.AUTO ? CaptureMode.MANUAL : CaptureMode.AUTO);
  }

  /** Capture pinch: ingests one whiteboard frame, in either mode. Returns true when a capture started. */
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
