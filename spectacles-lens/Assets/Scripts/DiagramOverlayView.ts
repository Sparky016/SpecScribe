import { findSceneObject } from './SceneUtils';

/**
 * Visual output of the whiteboard: overlay and backplate textures, the HUD toast, decoded live diagrams
 * and the conclude sound.
 *
 * Moved out of SpatialInterfaceManager (task 48) without behaviour change. The manager decides *what*
 * to show (demo state machine); this component only applies it.
 */
@component
export class DiagramOverlayView extends BaseScriptComponent {
  /** WhiteboardOverlayAnchor RenderMeshVisual (the diagram overlay). */
  @input
  @allowUndefined
  public overlayMesh?: RenderMeshVisual;

  /** WhiteboardBackplate RenderMeshVisual (the board surface). */
  @input
  @allowUndefined
  public boardMesh?: RenderMeshVisual;

  /** DiffToastText HUD text. */
  @input
  @allowUndefined
  public toastText?: Text;

  /**
   * Set by SpatialInterfaceManager from its own isPhysicalHardware input. When true, the virtual board quad
   * is hidden instead of textured so it does not glare in front of a real whiteboard.
   */
  public isPhysicalHardware: boolean = false;

  public texSelectArea?: Texture;
  public texWhiteboardClean?: Texture;
  public texWhiteboardDrawn?: Texture;
  public texEmpty?: Texture;
  public texInitial?: Texture;
  public texNodeAdded?: Texture;
  public texSnapshotUpdated?: Texture;
  public texConcluded?: Texture;

  /**
   * Fills each reference from the coordinator's legacy inputs when this component's own input is unset, and
   * takes the coordinator's isPhysicalHardware flag (the manager stays its single source).
   */
  public adopt(overlayMesh?: RenderMeshVisual, boardMesh?: RenderMeshVisual, toastText?: Text, isPhysicalHardware: boolean = false): void {
    if (!this.overlayMesh && overlayMesh) this.overlayMesh = overlayMesh;
    if (!this.boardMesh && boardMesh) this.boardMesh = boardMesh;
    if (!this.toastText && toastText) this.toastText = toastText;
    this.isPhysicalHardware = !!isPhysicalHardware;
  }

  public loadTextures(): void {
    try {
      this.texSelectArea = requireAsset('../Textures/Whiteboard_SelectArea_1024x683.png') as Texture;
      this.texWhiteboardClean = requireAsset('../Textures/Whiteboard_Backdrop_1024x683.png') as Texture;
      this.texWhiteboardDrawn = requireAsset('../Textures/Whiteboard_Drawn_1024x683.png') as Texture;
      this.texEmpty = requireAsset('../Textures/Diagram_Empty_1024x683.png') as Texture;
      this.texInitial = requireAsset('../Textures/Diagram_Initial_1024x683.png') as Texture;
      this.texNodeAdded = requireAsset('../Textures/Diagram_NodeAdded_1024x683.png') as Texture;
      this.texSnapshotUpdated = requireAsset('../Textures/Diagram_SnapshotUpdated_1024x683.png') as Texture;
      this.texConcluded = requireAsset('../Textures/Diagram_Concluded_1024x683.png') as Texture;
    } catch (e) {
      print(`[DiagramOverlayView] loadTextures failed: ${e}`);
    }
  }

  public resolveReferences(): void {
    if (!this.toastText) {
      const obj = findSceneObject('DiffToastText');
      if (obj) {
        this.toastText = obj.getComponent('Component.Text' as any) as any;
      }
    }

    if (!this.overlayMesh) {
      const obj = findSceneObject('WhiteboardOverlayAnchor') || findSceneObject('WhiteboardOverlay');
      if (obj) {
        this.overlayMesh = obj.getComponent('Component.RenderMeshVisual' as any) as any;
      }
    }

    if (!this.boardMesh) {
      const obj = findSceneObject('WhiteboardBackplate') || findSceneObject('WhiteboardBoard');
      if (obj) {
        this.boardMesh = obj.getComponent('Component.RenderMeshVisual' as any) as any;
      }
    }
  }

  /** SELECT_AREA: selection reticle on the board, 100% clean overlay, calibration hint. */
  public presentCalibration(): void {
    this.showBoard(this.texSelectArea);
    this.showOverlay(this.texEmpty);
    this.setToast('Whiteboard Calibration: Drag board lower to eye level, resize, then pinch middle to set');
  }

  /** CLEAN_BOARD: pristine clean whiteboard surface (no drawings); overlay stays empty. */
  public presentAreaLocked(pos: vec3, sc: vec3): void {
    this.showBoard(this.texWhiteboardClean);
    this.showOverlay(this.texEmpty);
    this.setToast(`Whiteboard Area Locked at Y: ${pos.y.toFixed(1)}cm (${sc.x.toFixed(0)}x${sc.z.toFixed(0)}cm) • Clean Whiteboard Ready`);
  }

  /** DRAWING_ACTIVE: demo shows the marker sketch and the initial Sugiyama DAG; live waits for DIAGRAM_UPDATED. */
  public presentDrawingStarted(demoMode: boolean): void {
    if (demoMode) {
      this.showBoard(this.texWhiteboardDrawn);
      this.showOverlay(this.texInitial);
      this.setToast('Ingested Live Whiteboard Sketch: Sugiyama DAG Active (4 nodes, 3 edges)');
    } else {
      this.setToast('Drawing active: waiting for diagram...');
    }
  }

  /** NODE_ADDED: toast, plus (demo only) the node-added overlay over the drawn whiteboard. */
  public presentNodeAdded(toast: string, demoMode: boolean): void {
    this.setToast(toast);
    if (demoMode) {
      this.showOverlay(this.texNodeAdded);
      this.showBoard(this.texWhiteboardDrawn);
    }
  }

  /** SNAPSHOT_UPDATED: toast, plus (demo only) the snapshot overlay over the drawn whiteboard. */
  public presentSnapshot(toast: string, demoMode: boolean): void {
    this.setToast(toast);
    if (demoMode) {
      this.showBoard(this.texWhiteboardDrawn);
      this.showOverlay(this.texSnapshotUpdated);
    }
  }

  /**
   * Spec generated: toast, concluded overlay (demo only; live mode waits for DIAGRAM_UPDATED), drawn whiteboard
   * rather than the calibration reticle, and the conclude sound on `host`.
   */
  public presentSpecGenerated(toast: string, demoMode: boolean, host: SceneObject): void {
    this.setToast(toast);
    if (demoMode) {
      this.showOverlay(this.texConcluded);
    }
    this.showBoard(this.texWhiteboardDrawn);
    this.playConcludeSound(host);
  }

  /** Applies `tex` to the board surface; no-op when the board or texture is missing. */
  public showBoard(tex?: Texture): void {
    if (this.boardMesh && tex) {
      // If the board is playing a video texture (e.g. DemoVideo), keep playing the video!
      const currentTex = this.boardMesh.mainMaterial && this.boardMesh.mainMaterial.mainPass ? this.boardMesh.mainMaterial.mainPass.baseTex : null;
      if (currentTex && (currentTex as any).control && typeof (currentTex as any).control.play === 'function') {
        return;
      }
      this.setMeshTexture(this.boardMesh, tex);
    }
  }

  /** Applies `tex` to the diagram overlay; no-op when the overlay or texture is missing. */
  public showOverlay(tex?: Texture): void {
    if (this.overlayMesh && tex) {
      this.setMeshTexture(this.overlayMesh, tex);
    }
  }

  public getToast(): string {
    return this.toastText ? this.toastText.text : '';
  }

  public setToast(text: string): void {
    if (this.toastText) {
      this.toastText.text = text;
    }
  }

  /** Decodes a server-rendered diagram PNG and puts it on the overlay. */
  public updateDiagramOverlay(base64Png: string): void {
    if (!base64Png) {
      return;
    }
    Base64.decodeTextureAsync(
      base64Png,
      (decodedTexture: Texture) => {
        if (
          this.overlayMesh &&
          this.overlayMesh.mainMaterial &&
          this.overlayMesh.mainMaterial.mainPass
        ) {
          this.overlayMesh.enabled = true;
          this.overlayMesh.mainMaterial.mainPass.baseTex = decodedTexture;
          print('[DiagramOverlayView] Decoded and applied server diagram overlay.');
        }
      },
      () => {
        print('[DiagramOverlayView] Failed to decode overlay PNG texture.');
      }
    );
  }

  /** Plays the conclude sound on the AudioComponent of `host` (the manager's SceneObject), if present. */
  public playConcludeSound(host: SceneObject): void {
    try {
      const successSfx = requireAsset('../GeneratedSFX/MeetingConcludeSuccess.wav') as AudioTrackAsset;
      const audioComp = host.getComponent('Component.AudioComponent' as any) as any;
      if (audioComp && successSfx) {
        audioComp.audioTrack = successSfx;
        audioComp.playbackMode = Audio.PlaybackMode.LowLatency;
        audioComp.play(1);
      }
    } catch (e) {
      print(`[DiagramOverlayView] playConcludeSound failed: ${e}`);
    }
  }

  private setMeshTexture(rmv: RenderMeshVisual, tex: Texture): void {
    try {
      if (rmv && rmv.mainMaterial && rmv.mainMaterial.mainPass) {
        if (this.isPhysicalHardware && rmv === this.boardMesh) {
          // On physical Spectacles in front of a real whiteboard, disable virtual quad to prevent waveguide glare
          rmv.enabled = false;
        } else {
          rmv.enabled = true;
          rmv.mainMaterial.mainPass.baseTex = tex;
        }
      }
    } catch (e) {
      print(`[DiagramOverlayView] setMeshTexture failed: ${e}`);
    }
  }
}
