import { Interactable } from 'SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable';
import { PersistentStreamSocketClient } from './PersistentStreamSocketClient';
import { findSceneObject } from './SceneUtils';

export enum AgentState {
  IDLE = 'IDLE',
  RESEARCHING = 'RESEARCHING',
  HAND_RAISED = 'HAND_RAISED'
}

export interface CritiquePayload {
  short_title?: string;
  detailed_body?: string;
  category?: string;
  spoken_summary?: string;
  audio_b64?: string;
  audio_track?: AudioTrackAsset;
}

@component
export class RaisingHandAgentController extends BaseScriptComponent {
  @input
  @allowUndefined
  private socketClient?: PersistentStreamSocketClient;

  @input
  @allowUndefined
  private agentOrbPinchButton?: Interactable;

  @input
  @allowUndefined
  private agentOrbMeshVisual?: RenderMeshVisual;

  @input
  @allowUndefined
  private researchingRingObject?: SceneObject;

  @input
  @allowUndefined
  private handRaisedPillObject?: SceneObject;

  @input
  @allowUndefined
  private pillTitleText?: Text;

  @input
  @allowUndefined
  private expandedCritiqueCard?: SceneObject;

  @input
  @allowUndefined
  private critiqueBodyText?: Text;

  @input
  @allowUndefined
  private agentAudioComponent?: AudioComponent;

  @input
  @allowUndefined
  private voiceAudioComponent?: AudioComponent;

  private currentState: AgentState = AgentState.IDLE;
  private readonly researchTimeoutSec: number = 30.0;
  private researchTimeoutEvent: DelayedCallbackEvent | null = null;
  private latestCritiqueBody: string = '';
  private latestSpokenSummary: string = '';
  private latestAudioB64: string = '';
  private latestVoiceTrack?: AudioTrackAsset;
  private lastPlayedAudioB64: string = '';
  private lastSpokenSummary: string = '';
  private isCardExpanded: boolean = false;
  private animTime: number = 0;
  private initialScale: vec3 = new vec3(1.0, 1.0, 1.0);
  private audioTrack?: AudioTrackAsset;

  private agentRootObject?: SceneObject;
  private cameraObject?: SceneObject;
  // Local offset in camera space: top right of view at 1.15m optical comfort depth
  private readonly cameraAnchorOffset: vec3 = new vec3(26.0, 15.0, -115.0);
  private readonly cameraAnchorRotation: quat = quat.fromEulerVec(new vec3(4 * Math.PI / 180, -10 * Math.PI / 180, 0));
  // Lazy-follow: damping rate (1/s) toward the camera-relative target, and max lag (cm) before snapping
  private readonly followRatePerSec: number = 6.0;
  private readonly maxFollowLagCm: number = 60.0;

  onAwake(): void {
    try {
      (global as any).SpecScribeRaisingHandAgent = this;
    } catch (e) {
      print(`[RaisingHandAgentController] onAwake failed: ${e}`);
    }

    this.createEvent('OnStartEvent').bind(() => {
      this.resolveReferences();
      this.anchorToCamera();
      this.configureOrbCollider();
      this.initScale();
      this.loadAudioTrack();
      this.setVisualState(AgentState.IDLE, '', '');
      this.bindInteractions();
      this.bindPreviewInteractions();
    });

    this.createEvent('UpdateEvent').bind((eventData) => {
      this.onUpdate(eventData.getDeltaTime());
    });
  }

  private loadAudioTrack(): void {
    try {
      this.audioTrack = requireAsset('../GeneratedSFX/AgentNotificationChime.wav') as AudioTrackAsset;
      if (this.agentAudioComponent && this.audioTrack) {
        this.agentAudioComponent.audioTrack = this.audioTrack;
        this.agentAudioComponent.playbackMode = Audio.PlaybackMode.LowLatency;
      }
      if (this.voiceAudioComponent) {
        if (this.audioTrack && !this.voiceAudioComponent.audioTrack) {
          this.voiceAudioComponent.audioTrack = this.audioTrack;
        }
        this.voiceAudioComponent.playbackMode = Audio.PlaybackMode.LowLatency;
      }
    } catch (e) {
      // Feature detection: audio is optional in mock / headless runs; silent by design.
    }
  }

  private resolveReferences(): void {
    if (!this.handRaisedPillObject) {
      this.handRaisedPillObject = findSceneObject('HandRaisedPillBadge') || undefined;
    }
    if (!this.pillTitleText) {
      const pill = this.handRaisedPillObject || findSceneObject('PillTitleText');
      if (pill) {
        this.pillTitleText = pill.getComponent('Component.Text' as any) as any;
      }
    }
    if (!this.expandedCritiqueCard) {
      this.expandedCritiqueCard = findSceneObject('ExpandedCritiqueCard') || undefined;
    }
    if (!this.critiqueBodyText) {
      const card = this.expandedCritiqueCard || findSceneObject('CritiqueBodyText');
      if (card) {
        this.critiqueBodyText = card.getComponent('Component.Text' as any) as any;
      }
    }
    if (!this.researchingRingObject) {
      this.researchingRingObject = findSceneObject('ResearchingRingMesh') || undefined;
    }
    if (!this.agentOrbMeshVisual) {
      const orbObj = findSceneObject('AgentOrbMesh');
      if (orbObj) {
        this.agentOrbMeshVisual = orbObj.getComponent('Component.RenderMeshVisual' as any) as any;
      }
    }
    if (!this.agentOrbPinchButton) {
      const orbObj = findSceneObject('AgentOrbMesh') || findSceneObject('RaisingHandAgentRoot');
      if (orbObj) {
        this.agentOrbPinchButton = this.findInteractableOnObject(orbObj);
      }
    }
    if (!this.voiceAudioComponent) {
      const voiceObj = findSceneObject('AgentVoicePlayer') || this.getSceneObject();
      if (voiceObj) {
        this.voiceAudioComponent = voiceObj.getComponent('Component.AudioComponent' as any) as any;
      }
    }
    if (!this.agentAudioComponent) {
      this.agentAudioComponent = this.voiceAudioComponent;
    }
    if (!this.voiceAudioComponent && this.agentAudioComponent) {
      this.voiceAudioComponent = this.agentAudioComponent;
    }
  }

  private findInteractableOnObject(obj: SceneObject): Interactable | undefined {
    try {
      const interactable = obj.getComponent(Interactable.getTypeName()) as Interactable;
      if (interactable) {
        return interactable;
      }
    } catch (e) {
      print(`[RaisingHandAgentController] findInteractableOnObject failed: ${e}`);
    }
    return undefined;
  }

  private initScale(): void {
    if (this.agentOrbMeshVisual) {
      const obj = this.agentOrbMeshVisual.getSceneObject();
      if (obj) {
        this.initialScale = obj.getTransform().getLocalScale();
      }
    }
  }

  private bindInteractions(): void {
    if (this.socketClient) {
      this.socketClient.onHandRaised = (payload: CritiquePayload) => {
        if (payload && typeof payload === 'object') {
          this.latestSpokenSummary = payload.spoken_summary || '';
          this.latestAudioB64 = payload.audio_b64 || '';
          this.latestVoiceTrack = payload.audio_track;
        }
        this.triggerHandRaised(
          payload?.short_title || 'Agent Insight',
          payload?.detailed_body || '',
          payload?.category,
          payload
        );
      };
    }

    if (this.agentOrbPinchButton) {
      const btn = this.agentOrbPinchButton as any;
      if (btn.onButtonPinched) {
        btn.onButtonPinched.add(() => this.handleOrbPinched());
      }
      if (btn.onTriggerEnd) {
        btn.onTriggerEnd.add(() => this.handleOrbPinched());
      }
      if (btn.onTriggerStart && !btn.onButtonPinched && !btn.onTriggerEnd) {
        btn.onTriggerStart.add(() => this.handleOrbPinched());
      }
    }
  }

  private playNotificationSound(): void {
    const audioComp = this.agentAudioComponent || this.voiceAudioComponent;
    if (audioComp) {
      try {
        if (this.audioTrack) {
          audioComp.audioTrack = this.audioTrack;
        }
        audioComp.playbackMode = Audio.PlaybackMode.LowLatency;
        audioComp.play(1);
      } catch (e) {
        // Audio play ignored if unavailable
      }
    }
  }

  public playCritiqueVoiceOrChime(): void {
    const voicePlayer = this.voiceAudioComponent || this.agentAudioComponent;
    this.lastSpokenSummary = this.latestSpokenSummary || this.latestCritiqueBody || '';
    if (voicePlayer && (this.latestAudioB64 || this.latestVoiceTrack)) {
      try {
        let track: AudioTrackAsset | undefined = this.latestVoiceTrack;
        if (!track && this.latestAudioB64) {
          const b64Api = (global as any).Base64;
          if (b64Api && typeof b64Api.decodeAudioAsync === 'function') {
            b64Api.decodeAudioAsync(
              this.latestAudioB64,
              (decodedTrack: AudioTrackAsset) => {
                track = decodedTrack;
              },
              () => {}
            );
          }
          if (!track) {
            track = {
              name: 'AgentCritiqueVoiceClip',
              audio_b64: this.latestAudioB64,
              spoken_summary: this.lastSpokenSummary
            } as any;
          }
        }
        if (track) {
          voicePlayer.audioTrack = track;
        }
        voicePlayer.playbackMode = Audio.PlaybackMode.LowLatency;
        voicePlayer.play(1);
        this.lastPlayedAudioB64 = this.latestAudioB64;
        return;
      } catch (e) {
        // Fall back to notification chime
      }
    }
    if (this.voiceAudioComponent && this.voiceAudioComponent !== this.agentAudioComponent) {
      try {
        if (this.audioTrack && !this.voiceAudioComponent.audioTrack) {
          this.voiceAudioComponent.audioTrack = this.audioTrack;
        }
        this.voiceAudioComponent.playbackMode = Audio.PlaybackMode.LowLatency;
        this.voiceAudioComponent.play(1);
        return;
      } catch (e) {
        // Fall back to notification sound
      }
    }
    this.playNotificationSound();
  }

  private lastPinchTime: number = 0;

  /**
   * Test hook: returns the agent to IDLE and clears the research timeout without re-binding scene components.
   */
  public resetForTest(): void {
    if (this.researchTimeoutEvent) {
      this.researchTimeoutEvent.cancel();
    }
    this.isCardExpanded = false;
    this.lastPinchTime = 0;
    this.latestSpokenSummary = '';
    this.latestAudioB64 = '';
    this.latestVoiceTrack = undefined;
    this.lastPlayedAudioB64 = '';
    this.lastSpokenSummary = '';
    if (this.expandedCritiqueCard) {
      this.expandedCritiqueCard.enabled = false;
    }
    this.setVisualState(AgentState.IDLE, '', '');
  }

  public handleOrbPinched(): void {
    const now = this.animTime;
    if (now - this.lastPinchTime < 0.25) {
      return; // Debounce rapid multi-events
    }
    this.lastPinchTime = now;

    print(`[RaisingHandAgentController] Orb pinched. CurrentState: ${this.currentState}`);
    if (this.currentState === AgentState.HAND_RAISED) {
      this.isCardExpanded = !this.isCardExpanded;
      if (this.expandedCritiqueCard) {
        this.expandedCritiqueCard.enabled = this.isCardExpanded;
      }
      print(`[RaisingHandAgentController] Critique card toggled: expanded = ${this.isCardExpanded}`);
      if (this.isCardExpanded) {
        this.playCritiqueVoiceOrChime();
      } else {
        this.playNotificationSound();
        this.setVisualState(AgentState.IDLE, '', '');
      }
    } else if (this.currentState === AgentState.IDLE) {
      if (this.socketClient) {
        const query = this.socketClient.getLatestSpokenPhrase();
        this.setVisualState(AgentState.RESEARCHING, '🔍 Researching...', '');
        this.socketClient.sendPinchCommand('ASK_AGENT', 'research', query);
      } else {
        print('[RaisingHandAgentController] No socketClient configured; ASK_AGENT research unavailable.');
      }
    } else if (this.currentState === AgentState.RESEARCHING) {
      this.setVisualState(AgentState.IDLE, '', '');
    }
  }

  public setVisualState(state: AgentState, shortTitle: string, detailedBody: string): void {
    this.currentState = state;
    this.latestCritiqueBody = detailedBody;

    if (state === AgentState.RESEARCHING) {
      if (!this.researchTimeoutEvent) {
        this.researchTimeoutEvent = this.createEvent('DelayedCallbackEvent');
        this.researchTimeoutEvent.bind(() => {
          if (this.currentState === AgentState.RESEARCHING) {
            print('[RaisingHandAgentController] Research timed out; returning to IDLE.');
            this.setVisualState(AgentState.IDLE, '', '');
          }
        });
      }
      this.researchTimeoutEvent.reset(this.researchTimeoutSec);
    } else if (this.researchTimeoutEvent) {
      this.researchTimeoutEvent.cancel();
    }

    if (this.handRaisedPillObject) {
      this.handRaisedPillObject.enabled = state !== AgentState.IDLE;
      this.handRaisedPillObject.getTransform().setLocalPosition(new vec3(-2.0, 5.0, 1.0));
    }
    if (this.pillTitleText) {
      this.pillTitleText.text = shortTitle;
      try {
        (this.pillTitleText as any).size = 18;
        (this.pillTitleText as any).renderOrder = 5;
      } catch (e) {
        print(`[RaisingHandAgentController] setVisualState pill styling failed: ${e}`);
      }
    }
    if (this.critiqueBodyText) {
      const formattedText = shortTitle && !detailedBody.includes(shortTitle)
        ? `${shortTitle}\n${detailedBody}`
        : detailedBody;
      this.critiqueBodyText.text = formattedText;
      try {
        (this.critiqueBodyText as any).size = 24;
        (this.critiqueBodyText as any).renderOrder = 5;
        (this.critiqueBodyText as any).horizontalAlignment = 0; // Left
        (this.critiqueBodyText as any).verticalAlignment = 1;   // Center
        (this.critiqueBodyText as any).horizontalOverflow = 3;  // Wrap
      } catch (e) {
        print(`[RaisingHandAgentController] setVisualState critique styling failed: ${e}`);
      }
    }
    if (this.researchingRingObject) {
      this.researchingRingObject.enabled = state === AgentState.RESEARCHING;
    }
    if (this.expandedCritiqueCard) {
      // Position adjacent to orb at comfortable reading distance: left of orb, eye level
      this.expandedCritiqueCard.getTransform().setLocalPosition(new vec3(-11.5, -1.5, 1.5));
      if (state !== AgentState.HAND_RAISED) {
        this.expandedCritiqueCard.enabled = false;
        this.isCardExpanded = false;
      }
    }
  }

  private onUpdate(deltaTime: number): void {
    this.animTime += deltaTime;

    // Lazy-follow the camera-relative target pose in world space (parented once in anchorToCamera)
    if (this.agentRootObject && this.cameraObject) {
      this.followCameraTarget(deltaTime);
    }

    // State 1: IDLE subtle pulse
    if (this.currentState === AgentState.IDLE && this.agentOrbMeshVisual) {
      const obj = this.agentOrbMeshVisual.getSceneObject();
      if (obj) {
        const pulse = 1.0 + 0.05 * Math.sin(this.animTime * 2.5);
        obj.getTransform().setLocalScale(new vec3(
          this.initialScale.x * pulse,
          this.initialScale.y * pulse,
          this.initialScale.z * pulse
        ));
      }
    }

    // State 2: HAND_RAISED energetic pulse
    if (this.currentState === AgentState.HAND_RAISED && this.agentOrbMeshVisual) {
      const obj = this.agentOrbMeshVisual.getSceneObject();
      if (obj) {
        const pulse = 1.0 + 0.08 * Math.sin(this.animTime * 4.0);
        obj.getTransform().setLocalScale(new vec3(
          this.initialScale.x * pulse,
          this.initialScale.y * pulse,
          this.initialScale.z * pulse
        ));
      }
    }

    // Rotating ring
    if (this.researchingRingObject && this.researchingRingObject.enabled) {
      const transform = this.researchingRingObject.getTransform();
      const currentRot = transform.getLocalRotation();
      const deltaAngle = deltaTime * 180.0 * (Math.PI / 180.0);
      const rotQuat = quat.angleAxis(deltaAngle, new vec3(0, 0, 1));
      transform.setLocalRotation(currentRot.multiply(rotQuat));
    }
  }

  private anchorToCamera(): void {
    if (!this.agentRootObject) {
      this.agentRootObject = findSceneObject('RaisingHandAgentRoot') || undefined;
    }
    if (!this.cameraObject) {
      this.cameraObject = this.findCameraObject() || undefined;
    }
    if (this.agentRootObject && this.cameraObject) {
      // Parent once, to the camera's own parent, so the orb is not head-locked; per-frame follow is in world space
      const worldParent = this.cameraObject.getParent();
      if (worldParent && this.agentRootObject.getParent() !== worldParent) {
        this.agentRootObject.setParent(worldParent);
      }
      const target = this.computeCameraTargetPose();
      if (target) {
        this.agentRootObject.getTransform().setWorldPosition(target.pos);
        this.agentRootObject.getTransform().setWorldRotation(target.rot);
      }
      this.agentRootObject.getTransform().setLocalScale(new vec3(2.2, 2.2, 2.2));
      print(`[RaisingHandAgentController] AI Orb following Camera view at optical comfort depth (${this.cameraAnchorOffset.x}, ${this.cameraAnchorOffset.y}, ${this.cameraAnchorOffset.z})`);
    } else if (this.agentRootObject) {
      this.agentRootObject.getTransform().setWorldPosition(new vec3(26.0, 15.0, -115.0));
      this.agentRootObject.getTransform().setWorldScale(new vec3(2.2, 2.2, 2.2));
    }
  }

  // Camera-relative target pose in world space: offset rotated by camera axes, rotation composed with anchor rotation
  private computeCameraTargetPose(): { pos: vec3; rot: quat } | null {
    if (!this.cameraObject) {
      return null;
    }
    const cam = this.cameraObject.getTransform();
    const camPos = cam.getWorldPosition();
    const right = cam.right;
    const up = cam.up;
    const forward = cam.forward;
    const o = this.cameraAnchorOffset;
    // Offset z is negative in front of the camera, so forward distance is -o.z
    const pos = new vec3(
      camPos.x + right.x * o.x + up.x * o.y + forward.x * -o.z,
      camPos.y + right.y * o.x + up.y * o.y + forward.y * -o.z,
      camPos.z + right.z * o.x + up.z * o.y + forward.z * -o.z
    );
    const rot = cam.getWorldRotation().multiply(this.cameraAnchorRotation);
    return { pos, rot };
  }

  // Damped pursuit of the target pose; snaps if the orb falls further behind than maxFollowLagCm
  private followCameraTarget(deltaTime: number): void {
    const target = this.computeCameraTargetPose();
    if (!target || !this.agentRootObject) {
      return;
    }
    const root = this.agentRootObject.getTransform();
    const current = root.getWorldPosition();
    const dx = target.pos.x - current.x;
    const dy = target.pos.y - current.y;
    const dz = target.pos.z - current.z;
    const lag = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (lag > this.maxFollowLagCm) {
      root.setWorldPosition(target.pos);
      root.setWorldRotation(target.rot);
      return;
    }
    const t = 1.0 - Math.exp(-this.followRatePerSec * deltaTime);
    root.setWorldPosition(new vec3(current.x + dx * t, current.y + dy * t, current.z + dz * t));
    root.setWorldRotation(quat.slerp(root.getWorldRotation(), target.rot, t));
  }

  private findCameraObject(): SceneObject | null {
    const direct = findSceneObject('Camera Object') || findSceneObject('Camera') || findSceneObject('Main Camera');
    if (direct) {
      return direct;
    }
    try {
      if (typeof global !== 'undefined' && (global as any).scene) {
        const sc = (global as any).scene;
        const count = sc.getRootObjectsCount();
        for (let i = 0; i < count; i++) {
          const root = sc.getRootObject(i);
          const cam = this.searchForCamera(root);
          if (cam) return cam;
        }
      }
    } catch (e) {
      print(`[RaisingHandAgentController] findCameraObject failed: ${e}`);
    }
    return null;
  }

  private searchForCamera(obj: SceneObject): SceneObject | null {
    if (obj.getComponent('Component.Camera' as any)) {
      return obj;
    }
    const count = obj.getChildrenCount();
    for (let i = 0; i < count; i++) {
      const found = this.searchForCamera(obj.getChild(i));
      if (found) return found;
    }
    return null;
  }

  private configureOrbCollider(): void {
    const orbObj = findSceneObject('AgentOrbMesh');
    if (orbObj) {
      try {
        let col = orbObj.getComponent('Physics.ColliderComponent' as any) || orbObj.getComponent('Component.ColliderComponent' as any);
        if (col && (col as any).shape) {
          const sphere = Shape.createSphereShape();
          sphere.radius = 10.0;
          (col as any).shape = sphere;
        }
      } catch (e) {
        print(`[RaisingHandAgentController] configureOrbCollider failed: ${e}`);
      }
    }
  }

  private bindPreviewInteractions(): void {
    try {
      this.createEvent('KeyPressEvent').bind((eventData: any) => {
        const key = (eventData as any).key || (eventData as any).char || '';
        if (typeof key === 'string' && (key.toLowerCase() === 'h' || key.toLowerCase() === 'o')) {
          print(`[RaisingHandAgentController] Keyboard '${key}' pressed -> Toggling AI Orb`);
          this.handleOrbPinched();
        }
      });
    } catch (e) {
      print(`[RaisingHandAgentController] bindPreviewInteractions failed: ${e}`);
    }
  }

  public getState(): AgentState {
    return this.currentState;
  }

  public isExpanded(): boolean {
    return this.isCardExpanded;
  }

  public getCritiqueBody(): string {
    return this.latestCritiqueBody;
  }

  public getSpokenSummary(): string {
    return this.latestSpokenSummary;
  }

  public getAudioB64(): string {
    return this.latestAudioB64;
  }

  public getLastPlayedAudioB64(): string {
    return this.lastPlayedAudioB64;
  }

  public formatPillText(shortTitle: string, category?: string): string {
    const title = shortTitle ?? '';
    let clean = title.trim();
    try {
      clean = clean.replace(new RegExp('^(\\p{Extended_Pictographic}\\uFE0F?\\s*)+', 'u'), '').trim();
    } catch (_e) {
      clean = clean.replace(/^([\uD800-\uDBFF][\uDC00-\uDFFF]|\u26A0\uFE0F?|\s)+/, '').trim();
    }
    let formatted = clean;
    if (category) {
      const cat = category.toUpperCase();
      if (cat === 'VULNERABILITY') {
        formatted = `🚩 ${clean}`;
      } else if (cat === 'LOGIC_FLAW') {
        formatted = `⚠️ ${clean}`;
      } else if (cat === 'ALTERNATIVE_IDEA') {
        formatted = `💡 ${clean}`;
      } else if (cat === 'RESEARCH') {
        formatted = `🔍 ${clean}`;
      }
    }
    // Code-point-safe truncation so a surrogate pair is never split.
    return Array.from(formatted).slice(0, 28).join('');
  }

  public triggerHandRaised(
    shortTitle: string | CritiquePayload,
    detailedBody: string = '',
    category?: string,
    payload?: CritiquePayload
  ): void {
    let rawTitle: string;
    let body: string = detailedBody;
    let cat: string | undefined = category;
    if (typeof shortTitle !== 'string') {
      rawTitle = shortTitle?.short_title || 'Agent Insight';
      body = shortTitle?.detailed_body || '';
      cat = shortTitle?.category;
      this.latestSpokenSummary = shortTitle?.spoken_summary || '';
      this.latestAudioB64 = shortTitle?.audio_b64 || '';
      this.latestVoiceTrack = shortTitle?.audio_track;
    } else {
      rawTitle = shortTitle;
      if (payload && typeof payload === 'object') {
        this.latestSpokenSummary = payload.spoken_summary || '';
        this.latestAudioB64 = payload.audio_b64 || '';
        this.latestVoiceTrack = payload.audio_track;
      } else {
        this.latestSpokenSummary = '';
        this.latestAudioB64 = '';
        this.latestVoiceTrack = undefined;
      }
    }
    const formattedTitle = this.formatPillText(rawTitle, cat);
    this.setVisualState(AgentState.HAND_RAISED, formattedTitle, body);
    this.playNotificationSound();
  }
}
