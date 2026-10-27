/**
 * What the adapter drives. SpatialInterfaceManager satisfies it with its existing public API.
 */
export interface PreviewInputTarget {
  isAreaSelected(): boolean;
  dragWhiteboard(deltaY: number, deltaX?: number): void;
  resizeWhiteboard(newWidth: number, newHeight: number): void;
  getWhiteboardPosition(): vec3;
  getWhiteboardScale(): vec3;
  setToastText(text: string): void;
  pinchCenterToSet(): void;
}

/**
 * Lens Studio Preview input for whiteboard calibration: mouse/touch drag (TouchStart/Move/End) and keyboard
 * (KeyPressEvent) move and resize the board and lock it while the area is still being selected.
 *
 * Moved out of SpatialInterfaceManager (task 48) without behaviour change. It deliberately binds no global
 * TapEvent (task 32): the SIK Interactables in PaletteController stay the single pinch path, and a centre tap
 * is detected from TouchEnd exactly as before.
 */
@component
export class PreviewInputAdapter extends BaseScriptComponent {
  /** Turns off mouse/touch dragging. Unset/false keeps the original behaviour. */
  @input
  public disableTouchDrag: boolean = false;

  /** Turns off keyboard calibration controls. Unset/false keeps the original behaviour. */
  @input
  public disableKeyboard: boolean = false;

  private target?: PreviewInputTarget;
  private bound: boolean = false;
  private touchStartPos?: vec2;
  private lastTouchPos?: vec2;
  private isTouchDragging: boolean = false;
  private lastDragEndTime: number = 0;

  /** Binds the preview input events once, driving `target`. */
  public bind(target: PreviewInputTarget): void {
    this.target = target;
    if (this.bound) {
      return;
    }
    this.bound = true;
    if (!this.disableTouchDrag) {
      this.bindTouchDragging();
    }
    if (!this.disableKeyboard) {
      this.bindKeyboardControls();
    }
  }

  /** True while a drag is in progress or just ended, so the pinch release that ends a drag does not lock the board. */
  public suppressesPinch(): boolean {
    return getTime() - this.lastDragEndTime < 0.35 || this.isTouchDragging;
  }

  /** Test hook: clears the drag guard. */
  public reset(): void {
    this.isTouchDragging = false;
    this.lastDragEndTime = 0;
  }

  private isCalibrating(): boolean {
    return !!this.target && !this.target.isAreaSelected();
  }

  private bindTouchDragging(): void {
    try {
      this.createEvent('TouchStartEvent').bind((event: TouchStartEvent) => {
        if (!this.isCalibrating()) {
          return;
        }
        const p = event.getTouchPosition();
        this.touchStartPos = new vec2(p.x, p.y);
        this.lastTouchPos = new vec2(p.x, p.y);
        this.isTouchDragging = false;
      });

      this.createEvent('TouchMoveEvent').bind((event: TouchMoveEvent) => {
        if (!this.isCalibrating() || !this.lastTouchPos || !this.touchStartPos) {
          return;
        }
        const current = event.getTouchPosition();
        const dx = current.x - this.lastTouchPos.x;
        const dy = current.y - this.lastTouchPos.y;

        const totalDist = Math.sqrt(
          (current.x - this.touchStartPos.x) * (current.x - this.touchStartPos.x) +
          (current.y - this.touchStartPos.y) * (current.y - this.touchStartPos.y)
        );

        if (totalDist > 0.01) {
          this.isTouchDragging = true;
          // In Lens Studio screen coords: +Y is down, so moving down on screen gives positive dy.
          // In world coords: moving down means decreasing Y (negative deltaY).
          const worldDeltaX = dx * 160.0;
          const worldDeltaY = -dy * 160.0;
          this.target!.dragWhiteboard(worldDeltaY, worldDeltaX);
        }

        this.lastTouchPos = new vec2(current.x, current.y);
      });

      this.createEvent('TouchEndEvent').bind((event: TouchEndEvent) => {
        if (!this.isCalibrating()) {
          return;
        }
        const target = this.target!;
        const p = event.getTouchPosition();
        const wasDragging = this.isTouchDragging;
        this.isTouchDragging = false;
        this.lastTouchPos = undefined;

        if (wasDragging) {
          this.lastDragEndTime = getTime();
          const pos = target.getWhiteboardPosition();
          print(`[PreviewInputAdapter] Mouse/Touch drag finished. Whiteboard now at y=${pos.y.toFixed(1)} cm.`);
          target.setToastText(`Whiteboard at Y: ${pos.y.toFixed(1)} cm • Pinch center [ ⊙ ] to set`);
          return;
        }

        // Tap without drag: check if tap was near the center of the whiteboard
        if (this.touchStartPos && Math.abs(p.x - 0.5) < 0.22 && Math.abs(p.y - 0.5) < 0.28) {
          print('[PreviewInputAdapter] Tap on center target detected -> Locking whiteboard area!');
          target.pinchCenterToSet();
        }
      });
    } catch (e) {
      print(`[PreviewInputAdapter] bindTouchDragging failed: ${e}`);
    }
  }

  private bindKeyboardControls(): void {
    try {
      this.createEvent('KeyPressEvent').bind((event: KeyPressEvent) => {
        if (!this.isCalibrating()) {
          return;
        }
        const target = this.target!;
        const evAny = event as any;
        const rawKey = evAny.key || evAny.char || (typeof evAny.getKey === 'function' ? evAny.getKey() : '');
        const key = typeof rawKey === 'string' ? rawKey.toLowerCase() : '';
        if (key === 's' || key === 'down') {
          target.dragWhiteboard(-6, 0);
        } else if (key === 'w' || key === 'up') {
          target.dragWhiteboard(6, 0);
        } else if (key === 'a' || key === 'left') {
          target.dragWhiteboard(0, -6);
        } else if (key === 'd' || key === 'right') {
          target.dragWhiteboard(0, 6);
        } else if (key === '-' || key === '[') {
          const sc = target.getWhiteboardScale();
          target.resizeWhiteboard(Math.max(80, sc.x - 10), Math.max(50, sc.z - 6));
        } else if (key === '+' || key === '=' || key === ']') {
          const sc = target.getWhiteboardScale();
          target.resizeWhiteboard(Math.min(160, sc.x + 10), Math.min(105, sc.z + 6));
        } else if (key === 'enter' || key === 'space') {
          target.pinchCenterToSet();
        }
      });
    } catch (e) {
      // Feature detection: KeyPressEvent may be absent on device; keyboard controls are optional.
    }
  }
}
