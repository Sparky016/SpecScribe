import { Interactable } from 'SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable';
import { PersistentStreamSocketClient } from './PersistentStreamSocketClient';
import { RaisingHandAgentController } from './RaisingHandAgentController';
import { LENS_NODE_REGISTRY } from './NodeRegistry';
import { PinchAction } from './PinchActions';
import { findSceneObject } from './SceneUtils';

export enum WhiteboardState {
  SELECT_AREA = 0,    // Area selection mode: Reticle overlay, no drawings
  CLEAN_BOARD = 1,    // Area confirmed: Pristine clean whiteboard, zero drawings
  DRAWING_ACTIVE = 2, // Drawing mode: Ingested marker sketch + Sugiyama DAG overlay
  NODE_ADDED = 3,     // Injected node (Verify JWT)
  SNAPSHOT_UPDATED = 4, // Multi-tier architecture snapshot
  CONCLUDED = 5       // Technical spec concluded
}

@component
export class SpatialInterfaceManager extends BaseScriptComponent {
  @input
  public isPhysicalHardware: boolean = false;

  // When true, runs the canned recorded-demo flow (pre-baked textures, hardcoded critiques).
  // When false (default), the overlay changes only on DIAGRAM_UPDATED and hand raises only on HAND_RAISED.
  @input
  public demoMode: boolean = false;

  @input
  @allowUndefined
  private socketClient?: PersistentStreamSocketClient;

  @input
  @allowUndefined
  private raisingHandAgent?: RaisingHandAgentController;

  @input
  @allowUndefined
  private btnAddDecision?: Interactable;

  @input
  @allowUndefined
  private btnAddService?: Interactable;

  @input
  @allowUndefined
  private btnAddDatabase?: Interactable;

  @input
  @allowUndefined
  private btnAddTerminal?: Interactable;

  @input
  @allowUndefined
  private btnUpdateSnapshot?: Interactable;

  @input
  @allowUndefined
  private btnConcludeMeeting?: Interactable;

  @input
  @allowUndefined
  private whiteboardInteractable?: Interactable;

  @input
  @allowUndefined
  private diagramOverlayMesh?: RenderMeshVisual;

  @input
  @allowUndefined
  private whiteboardBoardMesh?: RenderMeshVisual;

  @input
  @allowUndefined
  private diffToastText?: Text;

  private whiteboardState: WhiteboardState = WhiteboardState.SELECT_AREA;
  private diagramStage: number = 0; // 0: initial/clean/select, 1: node added, 2: snapshot updated, 3: concluded
  private nodeCount: number = 0;
  private meetingConcluded: boolean = false;
  private concludeTimeoutEvent: DelayedCallbackEvent | null = null;
  private readonly concludeTimeoutSec: number = 30;

  private texSelectArea?: Texture;
  private texWhiteboardClean?: Texture;
  private texWhiteboardDrawn?: Texture;
  private texEmpty?: Texture;
  private texInitial?: Texture;
  private texNodeAdded?: Texture;
  private texSnapshotUpdated?: Texture;
  private texConcluded?: Texture;

  private touchStartPos?: vec2;
  private lastTouchPos?: vec2;
  private isTouchDragging: boolean = false;
  private lastDragEndTime: number = 0;
  private resizePresetIndex: number = 0;

  onAwake(): void {
    try {
      (global as any).SpecScribeSpatialInterfaceManager = this;
    } catch (e) {
      print(`[SpatialInterfaceManager] onAwake failed: ${e}`);
    }

    this.createEvent('OnStartEvent').bind(() => {
      this.loadTextures();
      this.resolveReferences();
      this.configureWhiteboardCollider();
      this.applyInitialVisuals();
      this.bindPaletteButtons();
      this.bindMeetingControls();
      this.bindWhiteboardInteraction();
      this.bindSocketCallbacks();
      this.bindTouchDragging();
      this.bindKeyboardControls();
    });
  }

  private loadTextures(): void {
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
      print(`[SpatialInterfaceManager] loadTextures failed: ${e}`);
    }
  }

  private applyInitialVisuals(): void {
    this.whiteboardState = WhiteboardState.SELECT_AREA;
    this.diagramStage = 0;
    this.nodeCount = 0;

    // Whiteboard starts in selection/calibration mode up high on the wall
    if (this.whiteboardBoardMesh) {
      const obj = this.whiteboardBoardMesh.getSceneObject();
      obj.getTransform().setWorldPosition(new vec3(50, 185, -230));
      obj.getTransform().setWorldScale(new vec3(140, 1, 90));
      this.enableWhiteboardManipulation();

      if (this.texSelectArea) {
        this.setMeshTexture(this.whiteboardBoardMesh, this.texSelectArea);
      }
    }
    // Overlay starts 100% clean and transparent (zero drawings)
    if (this.diagramOverlayMesh && this.texEmpty) {
      this.setMeshTexture(this.diagramOverlayMesh, this.texEmpty);
    }
    if (this.diffToastText) {
      this.diffToastText.text = 'Whiteboard Calibration: Drag board lower to eye level, resize, then pinch middle to set';
    }
  }

  public pinchCenterToSet(): void {
    this.selectWhiteboardArea();
  }

  public selectWhiteboardArea(): void {
    if (this.whiteboardState !== WhiteboardState.SELECT_AREA) {
      return;
    }
    this.whiteboardState = WhiteboardState.CLEAN_BOARD;
    this.diagramStage = 0;
    this.nodeCount = 0;

    // Lock whiteboard manipulation rigidly in place
    this.disableWhiteboardManipulation();

    const pos = this.getWhiteboardPosition();
    const sc = this.getWhiteboardScale();
    print(`[SpatialInterfaceManager] Whiteboard area calibrated and locked at y=${pos.y.toFixed(1)}, size=${sc.x.toFixed(0)}x${sc.z.toFixed(0)}cm.`);

    // Switch board to pristine clean whiteboard surface (NO drawings)
    if (this.whiteboardBoardMesh && this.texWhiteboardClean) {
      this.setMeshTexture(this.whiteboardBoardMesh, this.texWhiteboardClean);
    }
    // Overlay remains completely empty/clean
    if (this.diagramOverlayMesh && this.texEmpty) {
      this.setMeshTexture(this.diagramOverlayMesh, this.texEmpty);
    }
    if (this.diffToastText) {
      this.diffToastText.text = `Whiteboard Area Locked at Y: ${pos.y.toFixed(1)}cm (${sc.x.toFixed(0)}x${sc.z.toFixed(0)}cm) • Clean Whiteboard Ready`;
    }

    if (this.socketClient) {
      this.socketClient.sendPinchCommand(PinchAction.CALIBRATE_AREA, 'whiteboard', `Area locked at y=${pos.y.toFixed(1)}`);
    }
  }

  public startDrawingAndIngestion(): void {
    if (this.whiteboardState === WhiteboardState.SELECT_AREA) {
      this.selectWhiteboardArea();
    }
    this.whiteboardState = WhiteboardState.DRAWING_ACTIVE;
    this.diagramStage = 0;

    print('[SpatialInterfaceManager] Drawing active.');

    if (this.demoMode) {
      this.nodeCount = 4;
      // Switch whiteboard to drawn state (marker sketches appear)
      if (this.whiteboardBoardMesh && this.texWhiteboardDrawn) {
        this.setMeshTexture(this.whiteboardBoardMesh, this.texWhiteboardDrawn);
      }
      // Switch overlay to initial Sugiyama DAG
      if (this.diagramOverlayMesh && this.texInitial) {
        this.setMeshTexture(this.diagramOverlayMesh, this.texInitial);
      }
      if (this.diffToastText) {
        this.diffToastText.text = 'Ingested Live Whiteboard Sketch: Sugiyama DAG Active (4 nodes, 3 edges)';
      }
    } else if (this.diffToastText) {
      this.diffToastText.text = 'Drawing active: waiting for diagram...';
    }

    if (this.socketClient) {
      this.socketClient.sendPinchCommand(PinchAction.INGEST_DRAWING, 'diagram', 'Initial Sugiyama DAG loaded');
    }
  }

  private handleWhiteboardPinch(): void {
    if (this.whiteboardState === WhiteboardState.SELECT_AREA) {
      if (getTime() - this.lastDragEndTime < 0.35 || this.isTouchDragging) {
        print('[SpatialInterfaceManager] Ignoring pinch release right after dragging');
        return;
      }
      print('[SpatialInterfaceManager] Center Whiteboard pinched in SELECT_AREA mode -> Locking area');
      this.pinchCenterToSet();
    } else if (this.whiteboardState === WhiteboardState.CLEAN_BOARD) {
      print('[SpatialInterfaceManager] Whiteboard pinched in CLEAN_BOARD mode -> Starting drawing & ingestion');
      this.startDrawingAndIngestion();
    } else {
      print('[SpatialInterfaceManager] Whiteboard pinched in DRAWING mode -> Ingesting next service node');
      this.triggerAddNode('service');
    }
  }

  private setMeshTexture(rmv: RenderMeshVisual, tex: Texture): void {
    try {
      if (rmv && rmv.mainMaterial && rmv.mainMaterial.mainPass) {
        if (this.isPhysicalHardware && rmv === this.whiteboardBoardMesh) {
          // On physical Spectacles in front of a real whiteboard, disable virtual quad to prevent waveguide glare
          rmv.enabled = false;
        } else {
          rmv.enabled = true;
          rmv.mainMaterial.mainPass.baseTex = tex;
        }
      }
    } catch (e) {
      print(`[SpatialInterfaceManager] setMeshTexture failed: ${e}`);
    }
  }

  private bindTouchDragging(): void {
    try {
      this.createEvent('TouchStartEvent').bind((event: TouchStartEvent) => {
        if (this.whiteboardState !== WhiteboardState.SELECT_AREA) {
          return;
        }
        const p = event.getTouchPosition();
        this.touchStartPos = new vec2(p.x, p.y);
        this.lastTouchPos = new vec2(p.x, p.y);
        this.isTouchDragging = false;
      });

      this.createEvent('TouchMoveEvent').bind((event: TouchMoveEvent) => {
        if (this.whiteboardState !== WhiteboardState.SELECT_AREA || !this.lastTouchPos || !this.touchStartPos) {
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
          this.dragWhiteboard(worldDeltaY, worldDeltaX);
        }

        this.lastTouchPos = new vec2(current.x, current.y);
      });

      this.createEvent('TouchEndEvent').bind((event: TouchEndEvent) => {
        if (this.whiteboardState !== WhiteboardState.SELECT_AREA) {
          return;
        }
        const p = event.getTouchPosition();
        const wasDragging = this.isTouchDragging;
        this.isTouchDragging = false;
        this.lastTouchPos = undefined;

        if (wasDragging) {
          this.lastDragEndTime = getTime();
          const pos = this.getWhiteboardPosition();
          print(`[SpatialInterfaceManager] Mouse/Touch drag finished. Whiteboard now at y=${pos.y.toFixed(1)} cm.`);
          if (this.diffToastText) {
            this.diffToastText.text = `Whiteboard at Y: ${pos.y.toFixed(1)} cm • Pinch center [ ⊙ ] to set`;
          }
          return;
        }

        // Tap without drag: check if tap was near the center of the whiteboard
        if (this.touchStartPos && Math.abs(p.x - 0.5) < 0.22 && Math.abs(p.y - 0.5) < 0.28) {
          print('[SpatialInterfaceManager] Tap on center target detected -> Locking whiteboard area!');
          this.pinchCenterToSet();
        }
      });
    } catch (e) {
      print(`[SpatialInterfaceManager] bindTouchDragging failed: ${e}`);
    }
  }

  private bindKeyboardControls(): void {
    try {
      this.createEvent('KeyPressEvent').bind((event: KeyPressEvent) => {
        if (this.whiteboardState !== WhiteboardState.SELECT_AREA) {
          return;
        }
        const evAny = event as any;
        const rawKey = evAny.key || evAny.char || (typeof evAny.getKey === 'function' ? evAny.getKey() : '');
        const key = typeof rawKey === 'string' ? rawKey.toLowerCase() : '';
        if (key === 's' || key === 'down') {
          this.dragWhiteboard(-6, 0);
        } else if (key === 'w' || key === 'up') {
          this.dragWhiteboard(6, 0);
        } else if (key === 'a' || key === 'left') {
          this.dragWhiteboard(0, -6);
        } else if (key === 'd' || key === 'right') {
          this.dragWhiteboard(0, 6);
        } else if (key === '-' || key === '[') {
          const sc = this.getWhiteboardScale();
          this.resizeWhiteboard(Math.max(80, sc.x - 10), Math.max(50, sc.z - 6));
        } else if (key === '+' || key === '=' || key === ']') {
          const sc = this.getWhiteboardScale();
          this.resizeWhiteboard(Math.min(160, sc.x + 10), Math.min(105, sc.z + 6));
        } else if (key === 'enter' || key === 'space') {
          this.pinchCenterToSet();
        }
      });
    } catch (e) {
      // Feature detection: KeyPressEvent may be absent on device; keyboard controls are optional.
    }
  }

  private resolveReferences(): void {
    if (!this.socketClient) {
      try {
        const comps = this.getSceneObject().getComponents('Component.ScriptComponent' as any);
        for (const c of comps) {
          if (c !== this && (c as any).sendPinchCommand) {
            this.socketClient = c as any;
            break;
          }
        }
      } catch (e) {
        print(`[SpatialInterfaceManager] resolveReferences socket lookup failed: ${e}`);
      }
    }

    if (!this.raisingHandAgent) {
      try {
        const comps = this.getSceneObject().getComponents('Component.ScriptComponent' as any);
        for (const c of comps) {
          if (c !== this && (c as any).triggerHandRaised) {
            this.raisingHandAgent = c as any;
            break;
          }
        }
      } catch (e) {
        print(`[SpatialInterfaceManager] resolveReferences agent lookup failed: ${e}`);
      }
      if (!this.raisingHandAgent) {
        const agentObj = findSceneObject('RaisingHandAgentRoot') || findSceneObject('SpecScribeControllers');
        if (agentObj) {
          const comps = agentObj.getComponents('Component.ScriptComponent' as any);
          for (const c of comps) {
            if ((c as any).triggerHandRaised) {
              this.raisingHandAgent = c as any;
              break;
            }
          }
        }
      }
    }

    if (!this.diffToastText) {
      const obj = findSceneObject('DiffToastText');
      if (obj) {
        this.diffToastText = obj.getComponent('Component.Text' as any) as any;
      }
    }

    if (!this.diagramOverlayMesh) {
      const obj = findSceneObject('WhiteboardOverlayAnchor') || findSceneObject('WhiteboardOverlay');
      if (obj) {
        this.diagramOverlayMesh = obj.getComponent('Component.RenderMeshVisual' as any) as any;
      }
    }

    if (!this.whiteboardBoardMesh) {
      const obj = findSceneObject('WhiteboardBackplate') || findSceneObject('WhiteboardBoard');
      if (obj) {
        this.whiteboardBoardMesh = obj.getComponent('Component.RenderMeshVisual' as any) as any;
      }
    }

    if (!this.whiteboardInteractable) {
      this.whiteboardInteractable = this.findInteractable('WhiteboardBackplate') || this.findInteractable('WhiteboardOverlayAnchor');
    }

    if (!this.btnAddDecision) {
      this.btnAddDecision = this.findInteractable('BtnAddDecision');
    }
    if (!this.btnAddService) {
      this.btnAddService = this.findInteractable('BtnAddService');
    }
    if (!this.btnAddDatabase) {
      this.btnAddDatabase = this.findInteractable('BtnAddDatabase');
    }
    if (!this.btnAddTerminal) {
      this.btnAddTerminal = this.findInteractable('BtnAddTerminal');
    }
    if (!this.btnUpdateSnapshot) {
      this.btnUpdateSnapshot = this.findInteractable('BtnUpdateSnapshot');
    }
    if (!this.btnConcludeMeeting) {
      this.btnConcludeMeeting = this.findInteractable('BtnConcludeMeeting');
    }
  }

  private findInteractable(name: string): Interactable | undefined {
    const obj = findSceneObject(name);
    if (!obj) {
      print(`[SpatialInterfaceManager] Object "${name}" not found in scene hierarchy`);
      return undefined;
    }
    try {
      const interactable = obj.getComponent(Interactable.getTypeName()) as Interactable;
      if (interactable) {
        print(`[SpatialInterfaceManager] Successfully resolved Interactable on "${name}"`);
        return interactable;
      }
    } catch (e) {
      print(`[SpatialInterfaceManager] findInteractable failed: ${e}`);
    }
    return undefined;
  }

  private bindWhiteboardInteraction(): void {
    if (this.whiteboardInteractable) {
      this.bindSingleButton(this.whiteboardInteractable, () => this.handleWhiteboardPinch());
      print('[SpatialInterfaceManager] Bound Interactable on WhiteboardBackplate');
    }
  }

  private bindPaletteButtons(): void {
    this.bindSingleButton(this.btnAddDecision, () => this.handleBtnAddDecision());
    this.bindSingleButton(this.btnAddService, () => this.handleBtnAddService());
    this.bindSingleButton(this.btnAddDatabase, () => this.handleBtnAddDatabase());
    this.bindSingleButton(this.btnAddTerminal, () => this.handleBtnAddTerminal());
  }

  private handleBtnAddDecision(): void {
    this.triggerAddNode('decision');
  }

  private handleBtnAddService(): void {
    this.triggerAddNode('service');
  }

  private handleBtnAddDatabase(): void {
    this.triggerAddNode('database');
  }

  private handleBtnAddTerminal(): void {
    this.triggerAddNode('terminal');
  }

  private bindMeetingControls(): void {
    this.bindSingleButton(this.btnUpdateSnapshot, () => this.triggerUpdateSnapshot());
    this.bindSingleButton(this.btnConcludeMeeting, () => this.triggerConcludeMeeting());
  }

  private bindSingleButton(button: Interactable | any, action: () => void): void {
    if (!button) {
      print('[SpatialInterfaceManager] Warning: attempted to bind null button');
      return;
    }
    try {
      if (button.onTriggerEnd && button.onTriggerEnd.add) {
        button.onTriggerEnd.add(() => action());
        print('[SpatialInterfaceManager] Bound onTriggerEnd to button');
      } else if (button.onButtonPinched && button.onButtonPinched.add) {
        button.onButtonPinched.add(() => action());
        print('[SpatialInterfaceManager] Bound onButtonPinched to button');
      }
    } catch (e) {
      print(`[SpatialInterfaceManager] bindSingleButton failed: ${e}`);
    }
  }

  public triggerAddNode(nodeType: string): void {
    if (this.meetingConcluded) {
      print('[SpatialInterfaceManager] Meeting is concluded; ignoring node addition.');
      return;
    }

    // Auto-advance through selection and clean board if user directly adds a node
    if (this.whiteboardState === WhiteboardState.SELECT_AREA) {
      this.selectWhiteboardArea();
    }
    if (this.demoMode && this.whiteboardState === WhiteboardState.CLEAN_BOARD) {
      this.nodeCount = 4;
      if (this.whiteboardBoardMesh && this.texWhiteboardDrawn) {
        this.setMeshTexture(this.whiteboardBoardMesh, this.texWhiteboardDrawn);
      }
    }

    this.whiteboardState = WhiteboardState.NODE_ADDED;
    this.nodeCount++;
    this.diagramStage = 1;

    const spokenPhrase = this.socketClient
      ? this.socketClient.consumeLatestSpokenPhrase()
      : null;
    const def = LENS_NODE_REGISTRY[nodeType.toLowerCase()];
    let fallbackLabel: string;
    if (this.demoMode && nodeType === 'service') fallbackLabel = 'Auth Gateway Service';
    else if (this.demoMode && nodeType === 'database') fallbackLabel = 'Redis Token Cache';
    else if (this.demoMode && nodeType === 'decision') fallbackLabel = 'Enforce JWT HMAC Verification';
    else if (this.demoMode && nodeType === 'terminal') fallbackLabel = 'Client HTTPS Entrypoint';
    else if (def) fallbackLabel = `${def.labelPrefix} Component`;
    else fallbackLabel = `New ${nodeType}`;
    const spokenLabel = spokenPhrase ?? fallbackLabel;
    // Only demo mode sends canned labels; otherwise a pinch without fresh speech sends no label
    // so successive pinches never share an identical registry-derived label.
    const sentLabel = spokenPhrase ?? (this.demoMode ? fallbackLabel : null);

    const toastMsg = this.demoMode
      ? `Injected [${nodeType.toUpperCase()}]: "${spokenLabel}" (Nodes: ${this.nodeCount})`
      : `Adding [${nodeType.toUpperCase()}]: "${spokenLabel}"... (pending)`;
    print(`[SpatialInterfaceManager] ${toastMsg}`);
    if (this.diffToastText) {
      this.diffToastText.text = toastMsg;
    }

    if (this.demoMode) {
      // Switch overlay texture to node-added stage
      if (this.diagramOverlayMesh && this.texNodeAdded) {
        this.setMeshTexture(this.diagramOverlayMesh, this.texNodeAdded);
      }
      // Ensure whiteboard backdrop shows marker drawings
      if (this.whiteboardBoardMesh && this.texWhiteboardDrawn) {
        this.setMeshTexture(this.whiteboardBoardMesh, this.texWhiteboardDrawn);
      }
    }

    // Trigger AI teammate hand-raise with architectural critique (demo only)
    if (this.demoMode && this.raisingHandAgent) {
      if (nodeType === 'decision') {
        this.raisingHandAgent.triggerHandRaised(
          '⚠️ Auth Token Leak Risk',
          '• Vulnerability: Unsigned JWT tokens can be forged\n• Fix: Require HMAC-SHA256 signature verification\n• Alternative: Move session state to Redis Token Cache',
          'VULNERABILITY'
        );
      } else if (nodeType === 'service') {
        this.raisingHandAgent.triggerHandRaised(
          '⚠️ Rate Limit Bottleneck',
          '• Issue: Auth Gateway lacks token-bucket rate limiter\n• Risk: Susceptible to DDoS amplification\n• Fix: Deploy Envoy ingress rate limiting',
          'LOGIC_FLAW'
        );
      } else if (nodeType === 'database') {
        this.raisingHandAgent.triggerHandRaised(
          '💡 Cache Invalidation Alert',
          '• Suggestion: Cache-aside pattern introduces stale reads\n• Fix: Implement write-through or pub/sub invalidation\n• Security: Enforce strict 60s TTL on session tokens',
          'ALTERNATIVE_IDEA'
        );
      } else {
        this.raisingHandAgent.triggerHandRaised(
          '🚩 Insecure Transport Warning',
          '• Risk: Cleartext HTTP permitted on fallback\n• Fix: Enforce strict HSTS policy and TLS 1.3\n• Architecture: Terminate TLS at API Gateway',
          'VULNERABILITY'
        );
      }
    }

    if (this.socketClient) {
      this.socketClient.sendPinchCommand(PinchAction.ADD_NODE, nodeType, sentLabel);
    }
  }

  public triggerUpdateSnapshot(): void {
    if (this.meetingConcluded) {
      return;
    }

    if (this.whiteboardState === WhiteboardState.SELECT_AREA) {
      this.selectWhiteboardArea();
      return;
    }

    this.whiteboardState = WhiteboardState.SNAPSHOT_UPDATED;
    this.diagramStage = 2;
    if (this.demoMode) {
      this.nodeCount = 6;
    }

    const toastMsg = this.demoMode
      ? 'Snapshot Synced: Multi-tier DAG optimized (6 nodes, 7 edges)'
      : 'Snapshot update requested... (pending)';
    print(`[SpatialInterfaceManager] ${toastMsg}`);
    if (this.diffToastText) {
      this.diffToastText.text = toastMsg;
    }

    if (this.demoMode) {
      // Ensure whiteboard backdrop shows marker drawings
      if (this.whiteboardBoardMesh && this.texWhiteboardDrawn) {
        this.setMeshTexture(this.whiteboardBoardMesh, this.texWhiteboardDrawn);
      }

      // Switch overlay texture to snapshot-updated stage
      if (this.diagramOverlayMesh && this.texSnapshotUpdated) {
        this.setMeshTexture(this.diagramOverlayMesh, this.texSnapshotUpdated);
      }
    }

    // Proactive AI Teammate feedback on updated diagram (demo only)
    if (this.demoMode && this.raisingHandAgent) {
      this.raisingHandAgent.triggerHandRaised(
        '💡 Architecture Optimized',
        '• Layout: Sugiyama hierarchical routing stabilized\n• Performance: Redis cache reduces DB load by 42%\n• Security: JWT verification enforced at API Gateway',
        'ALTERNATIVE_IDEA'
      );
    }

    if (this.socketClient) {
      this.socketClient.sendPinchCommand(PinchAction.UPDATE_SNAPSHOT, 'diagram', 'Snapshot refresh');
    }
  }

  public triggerConcludeMeeting(): void {
    this.meetingConcluded = true;
    this.whiteboardState = WhiteboardState.CONCLUDED;

    if (this.socketClient) {
      this.socketClient.sendPinchCommand(PinchAction.CONCLUDE_MEETING, 'session', 'Finalized spec');
    }

    if (this.demoMode) {
      // Demo has no backend to wait on; show the canned success immediately.
      this.showSpecGenerated();
      return;
    }

    // Live mode: success UI waits for MEETING_FINALIZED; fall back to an error toast on timeout.
    const pendingMsg = 'Generating spec...';
    print(`[SpatialInterfaceManager] ${pendingMsg}`);
    if (this.diffToastText) {
      this.diffToastText.text = pendingMsg;
    }
    if (!this.concludeTimeoutEvent) {
      this.concludeTimeoutEvent = this.createEvent('DelayedCallbackEvent');
      this.concludeTimeoutEvent.bind(() => this.onConcludeTimeout());
    }
    this.concludeTimeoutEvent.reset(this.concludeTimeoutSec);
  }

  private onMeetingFinalized(): void {
    if (this.concludeTimeoutEvent) {
      this.concludeTimeoutEvent.enabled = false;
    }
    this.showSpecGenerated();
  }

  private onConcludeTimeout(): void {
    // Allow the user to retry; the meeting was not confirmed as finalized.
    this.meetingConcluded = false;
    const errMsg = 'Spec generation failed: no response from server. Please try again.';
    print(`[SpatialInterfaceManager] ${errMsg}`);
    if (this.diffToastText) {
      this.diffToastText.text = errMsg;
    }
  }

  private showSpecGenerated(): void {
    this.diagramStage = 3;

    const toastMsg = 'Meeting Concluded: Technical Spec Generated';
    print(`[SpatialInterfaceManager] ${toastMsg}`);
    if (this.diffToastText) {
      this.diffToastText.text = toastMsg;
    }

    // Switch overlay texture to concluded stage (demo only; live mode waits for DIAGRAM_UPDATED)
    if (this.demoMode && this.diagramOverlayMesh && this.texConcluded) {
      this.setMeshTexture(this.diagramOverlayMesh, this.texConcluded);
    }
    // Ensure whiteboard shows drawn whiteboard rather than calibration reticle
    if (this.whiteboardBoardMesh && this.texWhiteboardDrawn) {
      this.setMeshTexture(this.whiteboardBoardMesh, this.texWhiteboardDrawn);
    }

    // Play conclude sound if audio component exists
    try {
      const successSfx = requireAsset('../GeneratedSFX/MeetingConcludeSuccess.wav') as AudioTrackAsset;
      const audioComp = this.getSceneObject().getComponent('Component.AudioComponent' as any) as any;
      if (audioComp && successSfx) {
        audioComp.audioTrack = successSfx;
        audioComp.playbackMode = Audio.PlaybackMode.LowLatency;
        audioComp.play(1);
      }
    } catch (e) {
      print(`[SpatialInterfaceManager] showSpecGenerated conclude sound failed: ${e}`);
    }
  }

  private bindSocketCallbacks(): void {
    if (!this.socketClient) {
      return;
    }
    this.socketClient.onDiagramUpdated = (imageB64: string, diffSummary: string) => {
      this.updateDiagramOverlay(imageB64);
      if (this.diffToastText) {
        this.diffToastText.text = diffSummary;
      }
    };

    this.socketClient.onMeetingFinalized = () => {
      this.onMeetingFinalized();
    };

    this.socketClient.onDecisionLogged = (payload: any) => {
      if (this.diffToastText && payload) {
        const rationale = payload.decision_rationale || payload.diff_summary || 'Decision logged';
        this.diffToastText.text = `📝 Decision: ${rationale}`;
      }
    };
  }

  public updateDiagramOverlay(base64Png: string): void {
    if (!base64Png) {
      return;
    }
    Base64.decodeTextureAsync(
      base64Png,
      (decodedTexture: Texture) => {
        if (
          this.diagramOverlayMesh &&
          this.diagramOverlayMesh.mainMaterial &&
          this.diagramOverlayMesh.mainMaterial.mainPass
        ) {
          this.diagramOverlayMesh.mainMaterial.mainPass.baseTex = decodedTexture;
        }
      },
      () => {
        print('[SpatialInterfaceManager] Failed to decode overlay PNG texture.');
      }
    );
  }

  public getWhiteboardState(): WhiteboardState {
    return this.whiteboardState;
  }

  public isAreaSelected(): boolean {
    return this.whiteboardState !== WhiteboardState.SELECT_AREA;
  }

  public isCleanBoard(): boolean {
    return this.whiteboardState === WhiteboardState.CLEAN_BOARD;
  }

  public getDiagramStage(): number {
    return this.diagramStage;
  }

  /**
   * Test hook: returns per-scenario state to its initial values without re-binding scene components.
   */
  public resetForTest(): void {
    if (this.concludeTimeoutEvent) {
      this.concludeTimeoutEvent.cancel();
    }
    this.meetingConcluded = false;
    this.isTouchDragging = false;
    this.lastDragEndTime = 0;
    this.applyInitialVisuals();
    if (this.socketClient) {
      this.socketClient.clearLastSentCommand();
    }
  }

  public getNodeCount(): number {
    return this.nodeCount;
  }

  public isMeetingConcluded(): boolean {
    return this.meetingConcluded;
  }

  public getToastText(): string {
    return this.diffToastText ? this.diffToastText.text : '';
  }

  public setToastText(text: string): void {
    if (this.diffToastText) {
      this.diffToastText.text = text;
    }
  }

  public getWhiteboardPosition(): vec3 {
    if (this.whiteboardBoardMesh) {
      return this.whiteboardBoardMesh.getSceneObject().getTransform().getWorldPosition();
    }
    return new vec3(50, 185, -230);
  }

  public getWhiteboardScale(): vec3 {
    if (this.whiteboardBoardMesh) {
      return this.whiteboardBoardMesh.getSceneObject().getTransform().getWorldScale();
    }
    return new vec3(140, 1, 90);
  }

  public setWhiteboardPosition(x: number, y: number, z: number): void {
    if (this.whiteboardBoardMesh) {
      this.whiteboardBoardMesh.getSceneObject().getTransform().setWorldPosition(new vec3(x, y, z));
    }
  }

  public setWhiteboardScale(x: number, y: number, z: number): void {
    if (this.whiteboardBoardMesh) {
      this.whiteboardBoardMesh.getSceneObject().getTransform().setWorldScale(new vec3(x, y, z));
    }
  }

  public dragWhiteboard(deltaY: number, deltaX: number = 0, deltaZ: number = 0): void {
    if (this.whiteboardBoardMesh) {
      const tr = this.whiteboardBoardMesh.getSceneObject().getTransform();
      const currentPos = tr.getWorldPosition();
      const newPos = new vec3(currentPos.x + deltaX, currentPos.y + deltaY, currentPos.z + deltaZ);
      tr.setWorldPosition(newPos);
      if (this.diffToastText) {
        this.diffToastText.text = `Moving Whiteboard: Y = ${newPos.y.toFixed(1)} cm (Pinch middle to set)`;
      }
    }
  }

  public resizeWhiteboard(newWidth: number, newHeight: number): void {
    if (this.whiteboardBoardMesh) {
      const tr = this.whiteboardBoardMesh.getSceneObject().getTransform();
      const newScale = new vec3(newWidth, 1, newHeight);
      tr.setWorldScale(newScale);
      if (this.diffToastText) {
        this.diffToastText.text = `Resizing Whiteboard: ${newWidth.toFixed(0)}x${newHeight.toFixed(0)} cm (Pinch middle to set)`;
      }
    }
  }

  public enableWhiteboardManipulation(): void {
    try {
      if (this.whiteboardBoardMesh) {
        const obj = this.whiteboardBoardMesh.getSceneObject();
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
      print(`[SpatialInterfaceManager] enableWhiteboardManipulation failed: ${e}`);
    }
  }

  public disableWhiteboardManipulation(): void {
    try {
      if (this.whiteboardBoardMesh) {
        const obj = this.whiteboardBoardMesh.getSceneObject();
        const comps = obj.getComponents('Component.ScriptComponent' as any);
        for (const c of comps) {
          if (c !== this && (c as any).enableTranslation !== undefined) {
            (c as any).enableTranslation = false;
            (c as any).enableScale = false;
          }
        }
      }
    } catch (e) {
      print(`[SpatialInterfaceManager] disableWhiteboardManipulation failed: ${e}`);
    }
  }

  public configureWhiteboardCollider(): void {
    try {
      if (this.whiteboardBoardMesh) {
        const obj = this.whiteboardBoardMesh.getSceneObject();
        const col = obj.getComponent('Physics.ColliderComponent') as any;
        if (col) {
          const box = Shape.createBoxShape();
          box.size = new vec3(140, 10, 90);
          col.shape = box;
          col.fitVisual = false;
          print('[SpatialInterfaceManager] Configured 140x90cm BoxShape collider on WhiteboardBackplate');
        }
      }
    } catch (e) {
      print(`[SpatialInterfaceManager] configureWhiteboardCollider failed: ${e}`);
    }
  }

  public toggleWhiteboardResize(): void {
    const presets = [
      { w: 120, h: 76 },
      { w: 100, h: 64 },
      { w: 140, h: 90 },
    ];
    this.resizePresetIndex = (this.resizePresetIndex + 1) % presets.length;
    const p = presets[this.resizePresetIndex];
    print(`[SpatialInterfaceManager] Toggling Whiteboard Size to ${p.w}x${p.h} cm`);
    this.resizeWhiteboard(p.w, p.h);
  }
}
