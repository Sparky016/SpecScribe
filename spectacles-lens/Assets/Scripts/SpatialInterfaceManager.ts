import { Interactable } from 'SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable';
import { PersistentStreamSocketClient } from './PersistentStreamSocketClient';
import { RaisingHandAgentController } from './RaisingHandAgentController';
import { PinchAction } from './PinchActions';
import { findSceneObject } from './SceneUtils';
import { WhiteboardCalibrator } from './WhiteboardCalibrator';
import { PaletteController, PaletteRefs, DemoCritique, nodeLabels, demoNodeCritique, DEMO_SNAPSHOT_CRITIQUE } from './PaletteController';
import { DiagramOverlayView } from './DiagramOverlayView';
import { PreviewInputAdapter } from './PreviewInputAdapter';
import { WhiteboardCaptureSwitch } from './WhiteboardCaptureSwitch';

export enum WhiteboardState {
  SELECT_AREA = 0,    // Area selection mode: Reticle overlay, no drawings
  CLEAN_BOARD = 1,    // Area confirmed: Pristine clean whiteboard, zero drawings
  DRAWING_ACTIVE = 2, // Drawing mode: Ingested marker sketch + Sugiyama DAG overlay
  NODE_ADDED = 3,     // Injected node (Verify JWT)
  SNAPSHOT_UPDATED = 4, // Multi-tier architecture snapshot
  CONCLUDED = 5       // Technical spec concluded
}

/**
 * Composition root: owns the whiteboard/demo state machine and socket wiring; delegates calibration, SIK palette input,
 * visuals/audio and Preview input. An unwired component is found or created on this SceneObject and fed from the
 * legacy inputs below, so the Lens behaves the same before and after the scene is wired.
 */
@component
export class SpatialInterfaceManager extends BaseScriptComponent {
  @input public isPhysicalHardware: boolean = false;

  // When true, runs the canned recorded-demo flow (pre-baked textures, hardcoded critiques).
  // When false (default), the overlay changes only on DIAGRAM_UPDATED and hand raises only on HAND_RAISED.
  @input public demoMode: boolean = false;

  @input @allowUndefined private socketClient?: PersistentStreamSocketClient;
  @input @allowUndefined private raisingHandAgent?: RaisingHandAgentController;
  @input @allowUndefined private whiteboardCalibrator?: WhiteboardCalibrator;
  @input @allowUndefined private paletteController?: PaletteController;
  @input @allowUndefined private diagramOverlayView?: DiagramOverlayView;
  @input @allowUndefined private previewInputAdapter?: PreviewInputAdapter;

  // Legacy inputs (task 48): kept until the components above are wired; a component's own input wins.
  @input @allowUndefined private btnAddDecision?: Interactable;
  @input @allowUndefined private btnAddService?: Interactable;
  @input @allowUndefined private btnAddDatabase?: Interactable;
  @input @allowUndefined private btnAddTerminal?: Interactable;
  @input @allowUndefined private btnUpdateSnapshot?: Interactable;
  @input @allowUndefined private btnConcludeMeeting?: Interactable;
  @input @allowUndefined private whiteboardInteractable?: Interactable;
  @input @allowUndefined private btnCaptureWhiteboard?: Interactable;
  @input @allowUndefined private btnToggleCaptureMode?: Interactable;
  @input @allowUndefined private diagramOverlayMesh?: RenderMeshVisual;
  @input @allowUndefined private whiteboardBoardMesh?: RenderMeshVisual;
  @input @allowUndefined private diffToastText?: Text;
  @input @allowUndefined private captureModeStatusText?: Text;

  private whiteboardState: WhiteboardState = WhiteboardState.SELECT_AREA;
  private diagramStage: number = 0; // 0: initial/clean/select, 1: node added, 2: snapshot updated, 3: concluded
  private nodeCount: number = 0;
  private meetingConcluded: boolean = false;
  private concludeTimeoutEvent: DelayedCallbackEvent | null = null;
  private readonly concludeTimeoutSec: number = 30;
  public readonly capture = new WhiteboardCaptureSwitch(() => this.getSceneObject(), (t: string) => this.setToastText(t), () => this.meetingConcluded, (m) => { if (this.captureModeStatusText) this.captureModeStatusText.text = this.capture.formatModeBadge(m); });

  // Textures now live on DiagramOverlayView; these keep the manager's former texture fields addressable.
  private get texSelectArea() { return this.view().texSelectArea; } private set texSelectArea(t: Texture | undefined) { this.view().texSelectArea = t; }
  private get texWhiteboardClean() { return this.view().texWhiteboardClean; } private set texWhiteboardClean(t: Texture | undefined) { this.view().texWhiteboardClean = t; }
  private get texWhiteboardDrawn() { return this.view().texWhiteboardDrawn; } private set texWhiteboardDrawn(t: Texture | undefined) { this.view().texWhiteboardDrawn = t; }
  private get texEmpty() { return this.view().texEmpty; } private set texEmpty(t: Texture | undefined) { this.view().texEmpty = t; }
  private get texInitial() { return this.view().texInitial; } private set texInitial(t: Texture | undefined) { this.view().texInitial = t; }
  private get texNodeAdded() { return this.view().texNodeAdded; } private set texNodeAdded(t: Texture | undefined) { this.view().texNodeAdded = t; }
  private get texSnapshotUpdated() { return this.view().texSnapshotUpdated; } private set texSnapshotUpdated(t: Texture | undefined) { this.view().texSnapshotUpdated = t; }
  private get texConcluded() { return this.view().texConcluded; } private set texConcluded(t: Texture | undefined) { this.view().texConcluded = t; }

  onAwake(): void {
    try { (global as any).SpecScribeSpatialInterfaceManager = this; } catch (e) { print(`[SpatialInterfaceManager] onAwake failed: ${e}`); }
    this.createEvent('OnStartEvent').bind(() => {
      this.view().loadTextures();
      this.resolvePeers();
      this.view().resolveReferences();
      this.cal().resolveReferences();
      this.palette().resolveReferences();
      this.cal().configureCollider();
      this.applyInitialVisuals();
      this.palette().bind(this);
      this.bindSocketCallbacks();
      this.input().bind(this);
    });
  }

  private applyInitialVisuals(): void {
    this.whiteboardState = WhiteboardState.SELECT_AREA;
    this.diagramStage = 0;
    this.nodeCount = 0;
    if (this.detectPhysicalHardware()) this.setHardwarePassthrough(true);
    this.cal().placeForCalibration(); // Whiteboard starts in selection/calibration mode up high on the wall
    this.view().presentCalibration();
    if (this.captureModeStatusText) this.captureModeStatusText.text = this.capture.formatModeBadge();
  }

  public pinchCenterToSet(): void { this.selectWhiteboardArea(); }

  public selectWhiteboardArea(): void {
    if (this.whiteboardState !== WhiteboardState.SELECT_AREA) return;
    this.whiteboardState = WhiteboardState.CLEAN_BOARD;
    this.diagramStage = 0;
    this.nodeCount = 0;
    this.cal().disableManipulation(); // Lock whiteboard manipulation rigidly in place
    const pos = this.getWhiteboardPosition();
    const sc = this.getWhiteboardScale();
    print(`[SpatialInterfaceManager] Whiteboard area calibrated and locked at y=${pos.y.toFixed(1)}, size=${sc.x.toFixed(0)}x${sc.z.toFixed(0)}cm.`);
    this.view().presentAreaLocked(pos, sc);
    this.socketClient?.sendPinchCommand(PinchAction.CALIBRATE_AREA, 'whiteboard', `Area locked at y=${pos.y.toFixed(1)}`);
  }

  public startDrawingAndIngestion(): void {
    if (this.whiteboardState === WhiteboardState.SELECT_AREA) this.selectWhiteboardArea();
    this.whiteboardState = WhiteboardState.DRAWING_ACTIVE;
    this.diagramStage = 0;
    print('[SpatialInterfaceManager] Drawing active.');
    if (this.demoMode) this.nodeCount = 4;
    this.view().presentDrawingStarted(this.demoMode);
    this.socketClient?.sendPinchCommand(PinchAction.INGEST_DRAWING, 'diagram', 'Initial Sugiyama DAG loaded');
  }

  /** Whiteboard Interactable pinch: lock the area, then start drawing, then capture the board (MANUAL capture mode only). */
  public handleWhiteboardPinch(): void {
    if (this.whiteboardState === WhiteboardState.SELECT_AREA) {
      if (this.input().suppressesPinch()) return print('[SpatialInterfaceManager] Ignoring pinch release right after dragging');
      print('[SpatialInterfaceManager] Center Whiteboard pinched in SELECT_AREA mode -> Locking area');
      this.pinchCenterToSet();
    } else if (this.whiteboardState === WhiteboardState.CLEAN_BOARD) {
      print('[SpatialInterfaceManager] Whiteboard pinched in CLEAN_BOARD mode -> Starting drawing & ingestion');
      this.startDrawingAndIngestion();
    } else {
      this.capture.captureNow();
    }
  }

  public triggerAddNode(nodeType: string): void {
    if (this.meetingConcluded) return print('[SpatialInterfaceManager] Meeting is concluded; ignoring node addition.');
    // Auto-advance through selection and clean board if user directly adds a node
    if (this.whiteboardState === WhiteboardState.SELECT_AREA) this.selectWhiteboardArea();
    if (this.demoMode && this.whiteboardState === WhiteboardState.CLEAN_BOARD) { this.nodeCount = 4; this.view().showBoard(this.texWhiteboardDrawn); }
    this.whiteboardState = WhiteboardState.NODE_ADDED;
    this.nodeCount++;
    this.diagramStage = 1;
    const labels = nodeLabels(nodeType, this.demoMode, this.socketClient ? this.socketClient.consumeLatestSpokenPhrase() : null);
    const toastMsg = this.demoMode ? `Injected [${nodeType.toUpperCase()}]: "${labels.shown}" (Nodes: ${this.nodeCount})` : `Adding [${nodeType.toUpperCase()}]: "${labels.shown}"... (pending)`;
    print(`[SpatialInterfaceManager] ${toastMsg}`);
    this.view().presentNodeAdded(toastMsg, this.demoMode);
    if (this.demoMode) this.raiseHand(demoNodeCritique(nodeType)); // AI teammate critique (demo only)
    this.socketClient?.sendPinchCommand(PinchAction.ADD_NODE, nodeType, labels.sent);
  }

  public triggerUpdateSnapshot(): void {
    if (this.meetingConcluded) return;
    if (this.whiteboardState === WhiteboardState.SELECT_AREA) return this.selectWhiteboardArea();
    this.whiteboardState = WhiteboardState.SNAPSHOT_UPDATED;
    this.diagramStage = 2;
    if (this.demoMode) this.nodeCount = 6;
    const toastMsg = this.demoMode ? 'Snapshot Synced: Multi-tier DAG optimized (6 nodes, 7 edges)' : 'Snapshot update requested... (pending)';
    print(`[SpatialInterfaceManager] ${toastMsg}`);
    this.view().presentSnapshot(toastMsg, this.demoMode);
    if (this.demoMode) this.raiseHand(DEMO_SNAPSHOT_CRITIQUE); // Proactive AI teammate feedback (demo only)
    this.socketClient?.sendPinchCommand(PinchAction.UPDATE_SNAPSHOT, 'diagram', 'Snapshot refresh');
  }

  public triggerConcludeMeeting(): void {
    this.meetingConcluded = true;
    this.whiteboardState = WhiteboardState.CONCLUDED;
    this.socketClient?.sendPinchCommand(PinchAction.CONCLUDE_MEETING, 'session', 'Finalized spec');
    if (this.demoMode) return this.showSpecGenerated(); // Demo has no backend to wait on; show success immediately.
    // Live mode: success UI waits for MEETING_FINALIZED; fall back to an error toast on timeout.
    print('[SpatialInterfaceManager] Generating spec...');
    this.setToastText('Generating spec...');
    if (!this.concludeTimeoutEvent) {
      this.concludeTimeoutEvent = this.createEvent('DelayedCallbackEvent');
      this.concludeTimeoutEvent.bind(() => this.onConcludeTimeout());
    }
    this.concludeTimeoutEvent.reset(this.concludeTimeoutSec);
  }

  private onMeetingFinalized(): void {
    if (this.concludeTimeoutEvent) this.concludeTimeoutEvent.enabled = false;
    this.showSpecGenerated();
  }

  private onConcludeTimeout(): void {
    this.meetingConcluded = false; // Allow the user to retry; the meeting was not confirmed as finalized.
    const errMsg = 'Spec generation failed: no response from server. Please try again.';
    print(`[SpatialInterfaceManager] ${errMsg}`);
    this.setToastText(errMsg);
  }

  private showSpecGenerated(): void {
    this.diagramStage = 3;
    const toastMsg = 'Meeting Concluded: Technical Spec Generated';
    print(`[SpatialInterfaceManager] ${toastMsg}`);
    this.view().presentSpecGenerated(toastMsg, this.demoMode, this.getSceneObject());
  }

  private raiseHand(c: DemoCritique): void { this.raisingHandAgent?.triggerHandRaised(c.title, c.body, c.category); }
  private bindSocketCallbacks(): void {
    if (!this.socketClient) return;
    this.socketClient.onDiagramUpdated = (b64: string, diffSummary: string) => { this.updateDiagramOverlay(b64); this.setToastText(diffSummary); };
    this.socketClient.onMeetingFinalized = () => this.onMeetingFinalized();
    this.socketClient.onDecisionLogged = (p: any) => { if (p) this.showToast(`📝 Decision: ${p.decision_rationale || p.summary || p.rationale || p.diff_summary || 'Decision logged'}`); };
    this.socketClient.onRequirementSynthesized = (p: any) => { if (p) this.showToast(`Req: ${typeof p === 'string' ? p : (p.summary || p.rationale || p.decision_rationale || p.diff_summary || 'Requirement logged')}`); };
  }

  /** Finds the socket client and agent on this SceneObject, then the agent on its known root objects. */
  private resolvePeers(): void {
    if (!this.socketClient) this.socketClient = this.findPeer(this.getSceneObject(), 'sendPinchCommand', 'socket');
    if (!this.raisingHandAgent) this.raisingHandAgent = this.findPeer(this.getSceneObject(), 'triggerHandRaised', 'agent');
    const agentObj = !this.raisingHandAgent ? (findSceneObject('RaisingHandAgentRoot') || findSceneObject('SpecScribeControllers')) : null;
    if (agentObj) this.raisingHandAgent = this.findPeer(agentObj, 'triggerHandRaised', 'agent');
  }

  /** First script component on `obj`, other than this one, that exposes `key`. */
  private findPeer(obj: SceneObject, key: string, label: string): any {
    try { for (const c of obj.getComponents('Component.ScriptComponent' as any)) if (c !== this && (c as any)[key]) return c; } catch (e) { print(`[SpatialInterfaceManager] resolveReferences ${label} lookup failed: ${e}`); }
    return undefined;
  }

  /** An unwired component: reuse one already on this SceneObject, else create it here. */
  private attach<T>(Cls: any): T {
    const so = this.getSceneObject() as any;
    if (!Cls.getTypeName || !so || !so.createComponent) return new Cls(); // node test harness: no engine to host it
    return so.getComponent(Cls.getTypeName()) || so.createComponent(Cls.getTypeName());
  }

  private view(): DiagramOverlayView {
    const v = (this.diagramOverlayView = this.diagramOverlayView || this.attach<DiagramOverlayView>(DiagramOverlayView));
    v.adopt(this.diagramOverlayMesh, this.whiteboardBoardMesh, this.diffToastText, this.isPhysicalHardware);
    return v;
  }

  private cal(): WhiteboardCalibrator {
    const c = (this.whiteboardCalibrator = this.whiteboardCalibrator || this.attach<WhiteboardCalibrator>(WhiteboardCalibrator));
    c.adopt(this.whiteboardBoardMesh);
    c.onStatus = c.onStatus || ((msg: string) => this.setToastText(msg));
    return c;
  }

  private palette(): PaletteController {
    const p = (this.paletteController = this.paletteController || this.attach<PaletteController>(PaletteController));
    p.adopt(this as unknown as PaletteRefs); // the legacy inputs carry the palette slot names
    return p;
  }

  private input(): PreviewInputAdapter { return (this.previewInputAdapter = this.previewInputAdapter || this.attach<PreviewInputAdapter>(PreviewInputAdapter)); }

  /** Auto-detects physical Spectacles runtime when `deviceInfoSystem.isSpectacles()` is true and not running in editor. */
  public detectPhysicalHardware(): boolean {
    try { const dis = (global as any).deviceInfoSystem; if (dis && typeof dis.isSpectacles === 'function' && dis.isSpectacles() && !(typeof dis.isEditor === 'function' && dis.isEditor())) return true; } catch (_) {}
    return this.isPhysicalHardware;
  }
  public setHardwarePassthrough(enabled: boolean): void {
    this.isPhysicalHardware = !!enabled;
    this.view().setHardwarePassthrough(this.isPhysicalHardware);
    this.cal().setHardwarePassthrough(this.isPhysicalHardware, this.view().overlayMesh);
  }
  public toggleHardwarePassthrough(): boolean { this.setHardwarePassthrough(!this.isPhysicalHardware); return this.isPhysicalHardware; }

  /** Test hook: returns per-scenario state to its initial values without re-binding scene components. */
  public resetForTest(): void {
    this.concludeTimeoutEvent?.cancel();
    this.meetingConcluded = false;
    this.input().reset();
    this.applyInitialVisuals();
    this.socketClient?.clearLastSentCommand();
  }

  public updateDiagramOverlay(base64Png: string): void { this.view().updateDiagramOverlay(base64Png); }
  public getWhiteboardState(): WhiteboardState { return this.whiteboardState; }
  public isAreaSelected(): boolean { return this.whiteboardState !== WhiteboardState.SELECT_AREA; }
  public isCleanBoard(): boolean { return this.whiteboardState === WhiteboardState.CLEAN_BOARD; }
  public getDiagramStage(): number { return this.diagramStage; }
  public getNodeCount(): number { return this.nodeCount; }
  public isMeetingConcluded(): boolean { return this.meetingConcluded; }
  public getToastText(): string { return this.view().getToast(); }
  public setToastText(text: string): void { this.view().setToast(text); } public showToast(text: string): void { this.view().setToast(text); }
  public getWhiteboardPosition(): vec3 { return this.cal().getPosition(); }
  public getWhiteboardScale(): vec3 { return this.cal().getScale(); }
  public getWhiteboardYaw(): number { return this.cal().getYaw(); }
  public setWhiteboardPosition(x: number, y: number, z: number): void { this.cal().setPosition(x, y, z); }
  public setWhiteboardScale(x: number, y: number, z: number): void { this.cal().setScale(x, y, z); }
  public dragWhiteboard(deltaY: number, deltaX: number = 0, deltaZ: number = 0): void { this.cal().drag(deltaY, deltaX, deltaZ); }
  public adjustDepth(deltaZ: number): vec3 { return this.cal().adjustDepth(deltaZ); }
  public adjustWhiteboardDepth(deltaZ: number): vec3 { return this.cal().adjustDepth(deltaZ); }
  public rotateYaw(deltaDegrees: number): quat { return this.cal().rotateYaw(deltaDegrees); }
  public adjustYaw(deltaYawDeg: number): quat { return this.cal().adjustYaw(deltaYawDeg); }
  public rotateWhiteboardYaw(deltaDegrees: number): quat { return this.cal().rotateYaw(deltaDegrees); }
  public resizeWhiteboard(newWidth: number, newHeight: number): void { this.cal().resize(newWidth, newHeight); }
  public enableWhiteboardManipulation(): void { this.cal().enableManipulation(); }
  public disableWhiteboardManipulation(): void { this.cal().disableManipulation(); }
  public configureWhiteboardCollider(): void { this.cal().configureCollider(); }
  public toggleWhiteboardResize(): void { this.cal().toggleResizePreset(); }
}
