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
  /** The WhiteboardBackplate RenderMeshVisual. Falls back to the manager's input, then a scene search by name. */
  @input
  @allowUndefined
  public boardMesh?: RenderMeshVisual;

  /** Receives the "Moving/Resizing Whiteboard" feedback lines. */
  public onStatus?: (message: string) => void;

  private resizePresetIndex: number = 0;

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

  public setPosition(x: number, y: number, z: number): void {
    if (this.boardMesh) {
      this.boardMesh.getSceneObject().getTransform().setWorldPosition(new vec3(x, y, z));
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
      const newPos = new vec3(currentPos.x + deltaX, currentPos.y + deltaY, currentPos.z + deltaZ);
      tr.setWorldPosition(newPos);
      this.report(`Moving Whiteboard: Y = ${newPos.y.toFixed(1)} cm (Pinch middle to set)`);
    }
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

  public enableManipulation(): void {
    try {
      if (this.boardMesh) {
        const obj = this.boardMesh.getSceneObject();
        const comps = obj.getComponents('Component.ScriptComponent' as any);
        for (const c of comps) {
          if (c !== this && (c as any).enableTranslation !== undefined) {
            (c as any).enableTranslation = true;
            (c as any).enableScale = true;
            (c as any).enableRotation = false;
          }
        }
      }
    } catch (e) {
      print(`[WhiteboardCalibrator] enableManipulation failed: ${e}`);
    }
  }

  public disableManipulation(): void {
    try {
      if (this.boardMesh) {
        const obj = this.boardMesh.getSceneObject();
        const comps = obj.getComponents('Component.ScriptComponent' as any);
        for (const c of comps) {
          if (c !== this && (c as any).enableTranslation !== undefined) {
            (c as any).enableTranslation = false;
            (c as any).enableScale = false;
          }
        }
      }
    } catch (e) {
      print(`[WhiteboardCalibrator] disableManipulation failed: ${e}`);
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
