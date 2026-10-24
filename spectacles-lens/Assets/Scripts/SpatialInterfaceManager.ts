import { Interactable } from 'SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable';
import { PersistentStreamSocketClient } from './PersistentStreamSocketClient';
import { RaisingHandAgentController } from './RaisingHandAgentController';

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

  private tapCycleIndex: number = 0;
  private readonly tapNodeTypes: string[] = ['decision', 'service', 'database', 'terminal'];

  private whiteboardState: WhiteboardState = WhiteboardState.SELECT_AREA;
  private diagramStage: number = 0; // 0: initial/clean/select, 1: node added, 2: snapshot updated, 3: concluded
  private nodeCount: number = 0;
  private meetingConcluded: boolean = false;

  private texSelectArea?: Texture;
  private texWhiteboardClean?: Texture;
  private texWhiteboardDrawn?: Texture;
  private texEmpty?: Texture;
  private texInitial?: Texture;
  private texNodeAdded?: Texture;
  private texSnapshotUpdated?: Texture;
  private texConcluded?: Texture;

  onAwake(): void {
    this.createEvent('OnStartEvent').bind(() => {
      this.loadTextures();
      this.resolveReferences();
      this.applyInitialVisuals();
      this.bindPaletteButtons();
      this.bindMeetingControls();
      this.bindWhiteboardInteraction();
      this.bindSocketCallbacks();
      this.bindTapGesture();
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
      print(`[SpatialInterfaceManager] Note: requireAsset unavailable or error: ${e}`);
    }
  }

  private applyInitialVisuals(): void {
    this.whiteboardState = WhiteboardState.SELECT_AREA;
    this.diagramStage = 0;
    this.nodeCount = 0;

    // Whiteboard starts in selection/calibration mode on wall
    if (this.whiteboardBoardMesh && this.texSelectArea) {
      this.setMeshTexture(this.whiteboardBoardMesh, this.texSelectArea);
    }
    // Overlay starts 100% clean and transparent (zero drawings)
    if (this.diagramOverlayMesh && this.texEmpty) {
      this.setMeshTexture(this.diagramOverlayMesh, this.texEmpty);
    }
    if (this.diffToastText) {
      this.diffToastText.text = 'Whiteboard Calibration: Pinch board or [ Lock Whiteboard ] to select area on wall';
    }
  }

  public selectWhiteboardArea(): void {
    if (this.whiteboardState !== WhiteboardState.SELECT_AREA) {
      return;
    }
    this.whiteboardState = WhiteboardState.CLEAN_BOARD;
    this.diagramStage = 0;
    this.nodeCount = 0;

    print('[SpatialInterfaceManager] Whiteboard area calibrated and locked onto wall.');

    // Switch board to pristine clean whiteboard surface (NO drawings)
    if (this.whiteboardBoardMesh && this.texWhiteboardClean) {
      this.setMeshTexture(this.whiteboardBoardMesh, this.texWhiteboardClean);
    }
    // Overlay remains completely empty/clean
    if (this.diagramOverlayMesh && this.texEmpty) {
      this.setMeshTexture(this.diagramOverlayMesh, this.texEmpty);
    }
    if (this.diffToastText) {
      this.diffToastText.text = 'Whiteboard Area Selected (120x80cm) • Clean Whiteboard Ready';
    }

    if (this.socketClient) {
      this.socketClient.sendPinchCommand('CALIBRATE_AREA', 'whiteboard', 'Area locked on wall');
    }
  }

  public startDrawingAndIngestion(): void {
    if (this.whiteboardState === WhiteboardState.SELECT_AREA) {
      this.selectWhiteboardArea();
    }
    this.whiteboardState = WhiteboardState.DRAWING_ACTIVE;
    this.diagramStage = 0;
    this.nodeCount = 4;

    print('[SpatialInterfaceManager] Drawing active: marker sketches and Sugiyama DAG ingested.');

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

    if (this.socketClient) {
      this.socketClient.sendPinchCommand('INGEST_DRAWING', 'diagram', 'Initial Sugiyama DAG loaded');
    }
  }

  private handleWhiteboardPinch(): void {
    if (this.whiteboardState === WhiteboardState.SELECT_AREA) {
      print('[SpatialInterfaceManager] Whiteboard pinched in SELECT_AREA mode -> Locking area');
      this.selectWhiteboardArea();
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
        rmv.mainMaterial.mainPass.baseTex = tex;
      }
    } catch (e) {
      // Ignored
    }
  }

  private bindTapGesture(): void {
    try {
      this.createEvent('TapEvent').bind(() => {
        if (this.whiteboardState === WhiteboardState.SELECT_AREA) {
          print('[SpatialInterfaceManager] Tap detected -> Selecting Whiteboard Area');
          this.selectWhiteboardArea();
        } else if (this.whiteboardState === WhiteboardState.CLEAN_BOARD) {
          print('[SpatialInterfaceManager] Tap detected on clean board -> Starting drawing & ingestion');
          this.startDrawingAndIngestion();
        } else {
          const nextType = this.tapNodeTypes[this.tapCycleIndex % this.tapNodeTypes.length];
          this.tapCycleIndex++;
          print(`[SpatialInterfaceManager] Preview Tap detected -> Adding node [${nextType.toUpperCase()}]`);
          this.triggerAddNode(nextType);
        }
      });
    } catch (e) {
      // Ignored if TapEvent is unavailable
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
        // Ignored
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
        // Ignored
      }
      if (!this.raisingHandAgent) {
        const agentObj = this.findSceneObject('RaisingHandAgentRoot') || this.findSceneObject('SpecScribeControllers');
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
      const obj = this.findSceneObject('DiffToastText');
      if (obj) {
        this.diffToastText = obj.getComponent('Component.Text' as any) as any;
      }
    }

    if (!this.diagramOverlayMesh) {
      const obj = this.findSceneObject('WhiteboardOverlayAnchor') || this.findSceneObject('WhiteboardOverlay');
      if (obj) {
        this.diagramOverlayMesh = obj.getComponent('Component.RenderMeshVisual' as any) as any;
      }
    }

    if (!this.whiteboardBoardMesh) {
      const obj = this.findSceneObject('WhiteboardBackplate') || this.findSceneObject('WhiteboardBoard');
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

  private findSceneObject(name: string): SceneObject | null {
    try {
      if (typeof global !== 'undefined' && (global as any).scene) {
        const sc = (global as any).scene;
        const count = sc.getRootObjectsCount();
        for (let i = 0; i < count; i++) {
          const found = this.searchHierarchy(sc.getRootObject(i), name);
          if (found) return found;
        }
      }
    } catch (e) {
      // Ignored
    }
    return null;
  }

  private searchHierarchy(obj: SceneObject, name: string): SceneObject | null {
    if (obj.name === name) {
      return obj;
    }
    const count = obj.getChildrenCount();
    for (let i = 0; i < count; i++) {
      const found = this.searchHierarchy(obj.getChild(i), name);
      if (found) return found;
    }
    return null;
  }

  private findInteractable(name: string): Interactable | undefined {
    const obj = this.findSceneObject(name);
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
      // Ignored
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
    this.bindSingleButton(this.btnAddDecision, () => this.triggerAddNode('decision'));
    this.bindSingleButton(this.btnAddService, () => this.triggerAddNode('service'));
    this.bindSingleButton(this.btnAddDatabase, () => this.triggerAddNode('database'));
    this.bindSingleButton(this.btnAddTerminal, () => this.triggerAddNode('terminal'));
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
      print(`[SpatialInterfaceManager] Error binding button: ${e}`);
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
    if (this.whiteboardState === WhiteboardState.CLEAN_BOARD) {
      this.nodeCount = 4;
      if (this.whiteboardBoardMesh && this.texWhiteboardDrawn) {
        this.setMeshTexture(this.whiteboardBoardMesh, this.texWhiteboardDrawn);
      }
    }

    this.whiteboardState = WhiteboardState.NODE_ADDED;
    this.nodeCount++;
    this.diagramStage = 1;

    let spokenLabel = this.socketClient
      ? this.socketClient.getLatestSpokenPhrase()
      : `New ${nodeType}`;
    if (!spokenLabel || spokenLabel === 'New Component') {
      if (nodeType === 'service') spokenLabel = 'Auth Gateway Service';
      else if (nodeType === 'database') spokenLabel = 'Redis Token Cache';
      else if (nodeType === 'decision') spokenLabel = 'Enforce JWT HMAC Verification';
      else if (nodeType === 'terminal') spokenLabel = 'Client HTTPS Entrypoint';
      else spokenLabel = `New ${nodeType}`;
    }

    const toastMsg = `Injected [${nodeType.toUpperCase()}]: "${spokenLabel}" (Nodes: ${this.nodeCount})`;
    print(`[SpatialInterfaceManager] ${toastMsg}`);
    if (this.diffToastText) {
      this.diffToastText.text = toastMsg;
    }

    // Switch overlay texture to node-added stage
    if (this.diagramOverlayMesh && this.texNodeAdded) {
      this.setMeshTexture(this.diagramOverlayMesh, this.texNodeAdded);
    }
    // Ensure whiteboard backdrop shows marker drawings
    if (this.whiteboardBoardMesh && this.texWhiteboardDrawn) {
      this.setMeshTexture(this.whiteboardBoardMesh, this.texWhiteboardDrawn);
    }

    // Trigger AI teammate hand-raise with architectural critique
    if (this.raisingHandAgent) {
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
      this.socketClient.sendPinchCommand('ADD_NODE', nodeType, spokenLabel);
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
    this.nodeCount = 6;
    this.diagramStage = 2;

    const toastMsg = 'Snapshot Synced: Multi-tier DAG optimized (6 nodes, 7 edges)';
    print(`[SpatialInterfaceManager] ${toastMsg}`);
    if (this.diffToastText) {
      this.diffToastText.text = toastMsg;
    }

    // Ensure whiteboard backdrop shows marker drawings
    if (this.whiteboardBoardMesh && this.texWhiteboardDrawn) {
      this.setMeshTexture(this.whiteboardBoardMesh, this.texWhiteboardDrawn);
    }

    // Switch overlay texture to snapshot-updated stage
    if (this.diagramOverlayMesh && this.texSnapshotUpdated) {
      this.setMeshTexture(this.diagramOverlayMesh, this.texSnapshotUpdated);
    }

    // Proactive AI Teammate feedback on updated diagram
    if (this.raisingHandAgent) {
      this.raisingHandAgent.triggerHandRaised(
        '💡 Architecture Optimized',
        '• Layout: Sugiyama hierarchical routing stabilized\n• Performance: Redis cache reduces DB load by 42%\n• Security: JWT verification enforced at API Gateway',
        'ALTERNATIVE_IDEA'
      );
    }

    if (this.socketClient) {
      this.socketClient.sendPinchCommand('UPDATE_SNAPSHOT', 'diagram', 'Snapshot refresh');
    }
  }

  public triggerConcludeMeeting(): void {
    this.meetingConcluded = true;
    this.whiteboardState = WhiteboardState.CONCLUDED;
    this.diagramStage = 3;

    const toastMsg = 'Meeting Concluded: Technical Spec Generated';
    print(`[SpatialInterfaceManager] ${toastMsg}`);
    if (this.diffToastText) {
      this.diffToastText.text = toastMsg;
    }

    // Switch overlay texture to concluded stage
    if (this.diagramOverlayMesh && this.texConcluded) {
      this.setMeshTexture(this.diagramOverlayMesh, this.texConcluded);
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
      // Ignored
    }

    if (this.socketClient) {
      this.socketClient.sendPinchCommand('CONCLUDE_MEETING', 'session', 'Finalized spec');
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
}
