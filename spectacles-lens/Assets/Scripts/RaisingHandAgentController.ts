import { Interactable } from 'SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable';
import { PersistentStreamSocketClient } from './PersistentStreamSocketClient';

export enum AgentState {
  IDLE = 'IDLE',
  RESEARCHING = 'RESEARCHING',
  HAND_RAISED = 'HAND_RAISED'
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

  private currentState: AgentState = AgentState.IDLE;
  private readonly researchTimeoutSec: number = 30.0;
  private researchTimeoutEvent: DelayedCallbackEvent | null = null;
  private latestCritiqueBody: string = '';
  private isCardExpanded: boolean = false;
  private animTime: number = 0;
  private initialScale: vec3 = new vec3(1.0, 1.0, 1.0);
  private audioTrack?: AudioTrackAsset;

  private agentRootObject?: SceneObject;
  private cameraObject?: SceneObject;
  // Local offset in camera space: top right of view at 1.15m optical comfort depth
  private readonly cameraAnchorOffset: vec3 = new vec3(26.0, 15.0, -115.0);
  private readonly cameraAnchorRotation: quat = quat.fromEulerVec(new vec3(4 * Math.PI / 180, -10 * Math.PI / 180, 0));

  onAwake(): void {
    try {
      (global as any).SpecScribeRaisingHandAgent = this;
    } catch (e) {}

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
    } catch (e) {
      // Audio optional in mock / headless
    }
  }

  private resolveReferences(): void {
    if (!this.handRaisedPillObject) {
      this.handRaisedPillObject = this.findSceneObject('HandRaisedPillBadge') || undefined;
    }
    if (!this.pillTitleText) {
      const pill = this.handRaisedPillObject || this.findSceneObject('PillTitleText');
      if (pill) {
        this.pillTitleText = pill.getComponent('Component.Text' as any) as any;
      }
    }
    if (!this.expandedCritiqueCard) {
      this.expandedCritiqueCard = this.findSceneObject('ExpandedCritiqueCard') || undefined;
    }
    if (!this.critiqueBodyText) {
      const card = this.expandedCritiqueCard || this.findSceneObject('CritiqueBodyText');
      if (card) {
        this.critiqueBodyText = card.getComponent('Component.Text' as any) as any;
      }
    }
    if (!this.researchingRingObject) {
      this.researchingRingObject = this.findSceneObject('ResearchingRingMesh') || undefined;
    }
    if (!this.agentOrbMeshVisual) {
      const orbObj = this.findSceneObject('AgentOrbMesh');
      if (orbObj) {
        this.agentOrbMeshVisual = orbObj.getComponent('Component.RenderMeshVisual' as any) as any;
      }
    }
    if (!this.agentOrbPinchButton) {
      const orbObj = this.findSceneObject('AgentOrbMesh') || this.findSceneObject('RaisingHandAgentRoot');
      if (orbObj) {
        this.agentOrbPinchButton = this.findInteractableOnObject(orbObj);
      }
    }
    if (!this.agentAudioComponent) {
      const audioObj = this.findSceneObject('AgentVoicePlayer') || this.getSceneObject();
      if (audioObj) {
        this.agentAudioComponent = audioObj.getComponent('Component.AudioComponent' as any) as any;
      }
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

  private findInteractableOnObject(obj: SceneObject): Interactable | undefined {
    try {
      const interactable = obj.getComponent(Interactable.getTypeName()) as Interactable;
      if (interactable) {
        return interactable;
      }
    } catch (e) {
      // Ignored
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
      this.socketClient.onHandRaised = (payload: any) => {
        let title = payload.short_title || 'Agent Insight';
        if (payload.category) {
          const cat = payload.category.toUpperCase();
          if (cat === 'VULNERABILITY' && !title.includes('🚩')) {
            title = `🚩 ${title}`;
          } else if (cat === 'LOGIC_FLAW' && !title.includes('⚠️')) {
            title = `⚠️ ${title}`;
          } else if (cat === 'ALTERNATIVE_IDEA' && !title.includes('💡')) {
            title = `💡 ${title}`;
          }
        }
        title = title.substring(0, 28);
        const body = payload.detailed_body || '';
        this.setVisualState(AgentState.HAND_RAISED, title, body);
        this.playNotificationSound();
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
    if (this.agentAudioComponent) {
      try {
        if (this.audioTrack && !this.agentAudioComponent.audioTrack) {
          this.agentAudioComponent.audioTrack = this.audioTrack;
        }
        this.agentAudioComponent.playbackMode = Audio.PlaybackMode.LowLatency;
        this.agentAudioComponent.play(1);
      } catch (e) {
        // Audio play ignored if unavailable
      }
    }
  }

  private lastPinchTime: number = 0;

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
      this.playNotificationSound();
      if (!this.isCardExpanded) {
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
      } catch (e) {}
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
      } catch (e) {}
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

    // Maintain persistent view anchoring to camera in every frame
    if (this.agentRootObject && this.cameraObject) {
      if (this.agentRootObject.getParent() !== this.cameraObject) {
        this.agentRootObject.setParent(this.cameraObject);
      }
      this.agentRootObject.getTransform().setLocalPosition(this.cameraAnchorOffset);
      this.agentRootObject.getTransform().setLocalRotation(this.cameraAnchorRotation);
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
      this.agentRootObject = this.findSceneObject('RaisingHandAgentRoot') || undefined;
    }
    if (!this.cameraObject) {
      this.cameraObject = this.findCameraObject() || undefined;
    }
    if (this.agentRootObject && this.cameraObject) {
      if (this.agentRootObject.getParent() !== this.cameraObject) {
        this.agentRootObject.setParent(this.cameraObject);
      }
      this.agentRootObject.getTransform().setLocalPosition(this.cameraAnchorOffset);
      this.agentRootObject.getTransform().setLocalRotation(this.cameraAnchorRotation);
      this.agentRootObject.getTransform().setLocalScale(new vec3(2.2, 2.2, 2.2));
      print(`[RaisingHandAgentController] AI Orb anchored to Camera view at optical comfort depth (${this.cameraAnchorOffset.x}, ${this.cameraAnchorOffset.y}, ${this.cameraAnchorOffset.z})`);
    } else if (this.agentRootObject) {
      this.agentRootObject.getTransform().setWorldPosition(new vec3(26.0, 15.0, -115.0));
      this.agentRootObject.getTransform().setWorldScale(new vec3(2.2, 2.2, 2.2));
    }
  }

  private findCameraObject(): SceneObject | null {
    const direct = this.findSceneObject('Camera Object') || this.findSceneObject('Camera') || this.findSceneObject('Main Camera');
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
    } catch (e) {}
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
    const orbObj = this.findSceneObject('AgentOrbMesh');
    if (orbObj) {
      try {
        let col = orbObj.getComponent('Physics.ColliderComponent' as any) || orbObj.getComponent('Component.ColliderComponent' as any);
        if (col && (col as any).shape) {
          const sphere = Shape.createSphereShape();
          sphere.radius = 10.0;
          (col as any).shape = sphere;
        }
      } catch (e) {}
    }
  }

  private bindPreviewInteractions(): void {
    try {
      this.createEvent('TapEvent').bind((eventData: any) => {
        const p = eventData && eventData.getTapPosition ? eventData.getTapPosition() : null;
        if (p) {
          // If tapped in upper right corner of the view (top-right quadrant)
          if (p.x > 0.65 && p.y < 0.38) {
            print(`[RaisingHandAgentController] Preview tap in top-right view (x=${p.x.toFixed(2)}, y=${p.y.toFixed(2)}) -> Toggling AI Orb`);
            this.handleOrbPinched();
          }
        }
      });
    } catch (e) {}

    try {
      this.createEvent('KeyPressEvent').bind((eventData: any) => {
        const key = (eventData as any).key || (eventData as any).char || '';
        if (typeof key === 'string' && (key.toLowerCase() === 'h' || key.toLowerCase() === 'o')) {
          print(`[RaisingHandAgentController] Keyboard '${key}' pressed -> Toggling AI Orb`);
          this.handleOrbPinched();
        }
      });
    } catch (e) {}
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

  public triggerHandRaised(shortTitle: string, detailedBody: string, category?: string): void {
    let title = shortTitle;
    if (category) {
      const cat = category.toUpperCase();
      if (cat === 'VULNERABILITY' && !title.includes('🚩')) {
        title = `🚩 ${title}`;
      } else if (cat === 'LOGIC_FLAW' && !title.includes('⚠️')) {
        title = `⚠️ ${title}`;
      } else if (cat === 'ALTERNATIVE_IDEA' && !title.includes('💡')) {
        title = `💡 ${title}`;
      }
    }
    this.setVisualState(AgentState.HAND_RAISED, title.substring(0, 28), detailedBody);
    this.playNotificationSound();
  }
}
