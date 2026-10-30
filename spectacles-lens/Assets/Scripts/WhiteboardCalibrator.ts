import { findSceneObject } from './SceneUtils';

/**
 * Whiteboard calibration: places, moves, resizes and locks the whiteboard backplate, and sizes its collider.
 *
 * Moved out of SpatialInterfaceManager (task 48) without behaviour change. The manager owns the
 * calibration state (SELECT_AREA -> CLEAN_BOARD) and calls in here; drag/resize feedback text is
 * reported through `onStatus`, which the manager routes to the HUD toast.
 */
@component
export class WhiteboardCalibrator extends BaseScriptComponent {
  public static readonly MIN_DEPTH_Z: number = -400;
  public static readonly MAX_DEPTH_Z: number = -115;

  /** The WhiteboardBackplate RenderMeshVisual. Falls back to the manager's input, then a scene search by name. */
  @input
  @allowUndefined
  public boardMesh?: RenderMeshVisual;

  /** Receives the "Moving/Resizing Whiteboard" feedback lines. */
  public onStatus?: (message: string) => void;

  private resizePresetIndex: number = 0;
  private yawDegrees: number = 0;

  /** Fills the board mesh from the coordinator's legacy input when this component's own input is unset. */
  public adopt(boardMesh?: RenderMeshVisual): void {
    if (!this.boardMesh && boardMesh) {
      this.boardMesh = boardMesh;
    }
  }

  public resolveReferences(): void {
    if (!this.boardMesh) {
      const obj = findSceneObject('WhiteboardBackplate') || findSceneObject('WhiteboardBoard');
      if (obj) {
        this.boardMesh = obj.getComponent('Component.RenderMeshVisual' as any) as any;
      }
    }
  }

  /** Puts the board at its calibration start pose (up high on the wall) with manipulation enabled. */
  public placeForCalibration(): void {
    this.yawDegrees = 0;
    if (this.boardMesh) {
      const obj = this.boardMesh.getSceneObject();
      obj.getTransform().setWorldPosition(new vec3(50, 185, -230));
      obj.getTransform().setWorldScale(new vec3(140, 1, 90));
      this.enableManipulation();
    }
  }

  public getPosition(): vec3 {
    if (this.boardMesh) {
      return this.boardMesh.getSceneObject().getTransform().getWorldPosition();
    }
    return new vec3(50, 185, -230);
  }

  public getScale(): vec3 {
    if (this.boardMesh) {
      return this.boardMesh.getSceneObject().getTransform().getWorldScale();
    }
    return new vec3(140, 1, 90);
  }

  public getYaw(): number {
    return this.yawDegrees;
  }

  public getRotation(): quat {
    if (this.boardMesh) {
      const tr = this.boardMesh.getSceneObject().getTransform() as any;
      if (typeof tr.getWorldRotation === 'function') return tr.getWorldRotation();
      if (typeof tr.getLocalRotation === 'function') return tr.getLocalRotation();
    }
    return quat.angleAxis(0, new vec3(0, 1, 0));
  }

  public setPosition(x: number, y: number, z: number): void {
    if (this.boardMesh) {
      const clampedZ = Math.max(
        WhiteboardCalibrator.MIN_DEPTH_Z,
        Math.min(WhiteboardCalibrator.MAX_DEPTH_Z, z)
      );
      this.boardMesh.getSceneObject().getTransform().setWorldPosition(new vec3(x, y, clampedZ));
    }
  }

  public setScale(x: number, y: number, z: number): void {
    if (this.boardMesh) {
      this.boardMesh.getSceneObject().getTransform().setWorldScale(new vec3(x, y, z));
    }
  }

  public drag(deltaY: number, deltaX: number = 0, deltaZ: number = 0): void {
    if (this.boardMesh) {
      const tr = this.boardMesh.getSceneObject().getTransform();
      const currentPos = tr.getWorldPosition();
      const clampedZ = Math.max(
        WhiteboardCalibrator.MIN_DEPTH_Z,
        Math.min(WhiteboardCalibrator.MAX_DEPTH_Z, currentPos.z + deltaZ)
      );
      const newPos = new vec3(currentPos.x + deltaX, currentPos.y + deltaY, clampedZ);
      tr.setWorldPosition(newPos);
      this.report(`Moving Whiteboard: Y = ${newPos.y.toFixed(1)} cm, Z = ${newPos.z.toFixed(1)} cm (Pinch middle to set)`);
    }
  }

  public adjustDepth(deltaZ: number): vec3 {
    this.drag(0, 0, deltaZ);
    return this.getPosition();
  }

  public rotateYaw(deltaDegrees: number): quat {
    this.yawDegrees += deltaDegrees;
    const rad = (deltaDegrees * Math.PI) / 180.0;
    const yawDelta = quat.angleAxis(rad, new vec3(0, 1, 0));
    if (this.boardMesh) {
      const tr = this.boardMesh.getSceneObject().getTransform() as any;
      const currentRot: quat =
        typeof tr.getWorldRotation === 'function'
          ? tr.getWorldRotation()
          : typeof tr.getLocalRotation === 'function'
            ? tr.getLocalRotation()
            : quat.angleAxis(0, new vec3(0, 1, 0));
      const newRot = yawDelta.multiply(currentRot);
      if (typeof tr.setWorldRotation === 'function') {
        tr.setWorldRotation(newRot);
      }
      if (typeof tr.setLocalRotation === 'function') {
        tr.setLocalRotation(newRot);
      }
      this.report(`Rotating Whiteboard Yaw: ${this.yawDegrees.toFixed(1)} deg (Pinch middle to set)`);
      return newRot;
    }
    return yawDelta;
  }

  public adjustYaw(deltaYawDeg: number): quat {
    return this.rotateYaw(deltaYawDeg);
  }

  public resize(newWidth: number, newHeight: number): void {
    if (this.boardMesh) {
      const tr = this.boardMesh.getSceneObject().getTransform();
      const newScale = new vec3(newWidth, 1, newHeight);
      tr.setWorldScale(newScale);
      this.report(`Resizing Whiteboard: ${newWidth.toFixed(0)}x${newHeight.toFixed(0)} cm (Pinch middle to set)`);
    }
  }

  public toggleResizePreset(): void {
    const presets = [
      { w: 120, h: 76 },
      { w: 100, h: 64 },
      { w: 140, h: 90 },
    ];
    this.resizePresetIndex = (this.resizePresetIndex + 1) % presets.length;
    const p = presets[this.resizePresetIndex];
    print(`[WhiteboardCalibrator] Toggling Whiteboard Size to ${p.w}x${p.h} cm`);
    this.resize(p.w, p.h);
  }

  public setManipulationEnabled(enabled: boolean): void {
    try {
      if (this.boardMesh) {
        const obj = this.boardMesh.getSceneObject();
        const comps = obj.getComponents('Component.ScriptComponent' as any);
        for (const c of comps) {
          const manip = c as any;
          if (c !== this && (manip.enableTranslation !== undefined || typeof manip.setCanTranslate === 'function')) {
            manip.enableTranslation = enabled;
            manip.enableScale = enabled;
            manip.enableRotation = enabled;
            manip.enableXTranslation = enabled;
            manip.enableYTranslation = enabled;
            manip.enableZTranslation = enabled;
            manip.enableYRotation = enabled;
            if (enabled) {
              manip.rotationAxis = 'Y';
              manip._rotationAxis = 'Y';
            }
            if (typeof manip.setCanTranslate === 'function') manip.setCanTranslate(enabled);
            if (typeof manip.setCanRotate === 'function') manip.setCanRotate(enabled);
            if (typeof manip.setCanScale === 'function') manip.setCanScale(enabled);
          }
        }
      }
    } catch (e) {
      print(`[WhiteboardCalibrator] setManipulationEnabled failed: ${e}`);
    }
  }

  public enableManipulation(): void {
    try {
      if (this.boardMesh) {
        const obj = this.boardMesh.getSceneObject();
        const comps = obj.getComponents('Component.ScriptComponent' as any);
        for (const c of comps) {
          const manip = c as any;
          if (c !== this && (manip.enableTranslation !== undefined || typeof manip.setCanTranslate === 'function')) {
            const supportsSikYaw =
              manip.rotationAxis !== undefined ||
              manip._rotationAxis !== undefined ||
              manip.enableZTranslation !== undefined ||
              manip._enableZTranslation !== undefined ||
              manip.enableYRotation !== undefined ||
              typeof manip.setCanRotate === 'function' ||
              manip.enableRotation === false;
            manip.enableTranslation = true;
            manip.enableScale = true;
            manip.enableRotation = supportsSikYaw;
            manip.enableXTranslation = true;
            manip.enableYTranslation = true;
            manip.enableZTranslation = true;
            manip.enableYRotation = true;
            manip.rotationAxis = 'Y';
            if (typeof manip.setCanTranslate === 'function') manip.setCanTranslate(true);
            if (typeof manip.setCanRotate === 'function') manip.setCanRotate(true);
            if (typeof manip.setCanScale === 'function') manip.setCanScale(true);
          }
        }
      }
    } catch (e) {
      print(`[WhiteboardCalibrator] enableManipulation failed: ${e}`);
    }
  }

  public disableManipulation(): void {
    this.setManipulationEnabled(false);
  }

  public setHardwarePassthrough(enabled: boolean, overlayMesh?: RenderMeshVisual): void {
    const Vec4Ctor = (global as any).vec4;
    const makeColor = (x: number, y: number, z: number, w: number) =>
      typeof Vec4Ctor === 'function' ? new Vec4Ctor(x, y, z, w) : { x, y, z, w };
    if (this.boardMesh) {
      this.boardMesh.enabled = !enabled;
      const boardObj = this.boardMesh.getSceneObject?.();
      if (boardObj) {
        boardObj.enabled = true;
        const col =
          boardObj.getComponent?.('Physics.ColliderComponent' as any) ||
          boardObj.getComponent?.('ColliderComponent' as any);
        if (col) col.enabled = true;
      }
      if (this.boardMesh.mainMaterial && this.boardMesh.mainMaterial.mainPass) {
        const pass = this.boardMesh.mainMaterial.mainPass as any;
        const bc = pass.baseColor || { x: 1, y: 1, z: 1, w: 1 };
        pass.baseColor = makeColor(bc.x ?? 1, bc.y ?? 1, bc.z ?? 1, enabled ? 0.0 : 1.0);
      }
    }
    if (overlayMesh) {
      overlayMesh.enabled = true;
      const overlayObj = overlayMesh.getSceneObject?.();
      if (overlayObj) overlayObj.enabled = true;
      if (overlayMesh.mainMaterial && overlayMesh.mainMaterial.mainPass) {
        const pass = overlayMesh.mainMaterial.mainPass as any;
        const bc = pass.baseColor || { x: 1, y: 1, z: 1, w: 0.92 };
        pass.baseColor = makeColor(bc.x ?? 1, bc.y ?? 1, bc.z ?? 1, 0.92);
      }
    }
  }

  public configureCollider(): void {
    try {
      if (this.boardMesh) {
        const obj = this.boardMesh.getSceneObject();
        const col = obj.getComponent('Physics.ColliderComponent') as any;
        if (col) {
          const box = Shape.createBoxShape();
          box.size = new vec3(140, 10, 90);
          col.shape = box;
          col.fitVisual = false;
          print('[WhiteboardCalibrator] Configured 140x90cm BoxShape collider on WhiteboardBackplate');
        }
      }
    } catch (e) {
      print(`[WhiteboardCalibrator] configureCollider failed: ${e}`);
    }
  }

  private report(message: string): void {
    if (this.onStatus) {
      this.onStatus(message);
    }
  }
}
