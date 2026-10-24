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
  private latestCritiqueBody: string = '';
  private isCardExpanded: boolean = false;
  private animTime: number = 0;
  private initialScale: vec3 = new vec3(1.0, 1.0, 1.0);
  private audioTrack?: AudioTrackAsset;

  onAwake(): void {
    this.createEvent('OnStartEvent').bind(() => {
      this.resolveReferences();
      this.initScale();
      this.loadAudioTrack();
      this.setVisualState(AgentState.IDLE, '', '');
      this.bindInteractions();
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
      } else if (btn.onTriggerEnd) {
        btn.onTriggerEnd.add(() => this.handleOrbPinched());
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

  public handleOrbPinched(): void {
    print(`[RaisingHandAgentController] Orb pinched. CurrentState: ${this.currentState}`);
    if (this.currentState === AgentState.HAND_RAISED) {
      this.isCardExpanded = !this.isCardExpanded;
      if (this.expandedCritiqueCard) {
        this.expandedCritiqueCard.enabled = this.isCardExpanded;
      }
      print(`[RaisingHandAgentController] Critique card toggled: expanded = ${this.isCardExpanded}`);
      this.playNotificationSound();
    } else if (this.currentState === AgentState.IDLE) {
      // Simulate proactive insight trigger in preview
      this.setVisualState(
        AgentState.HAND_RAISED,
        '⚠️ Auth Token Leak Risk',
        '• Risk: Unsigned JWT tokens can be forged\n• Fix: Require HMAC-SHA256 signature verification\n• Alternative: Move session state to Redis Token Cache'
      );
      this.playNotificationSound();
    }
  }

  public setVisualState(state: AgentState, shortTitle: string, detailedBody: string): void {
    this.currentState = state;
    this.latestCritiqueBody = detailedBody;

    if (this.handRaisedPillObject) {
      this.handRaisedPillObject.enabled = state === AgentState.HAND_RAISED;
    }
    if (this.pillTitleText) {
      this.pillTitleText.text = shortTitle;
    }
    if (this.critiqueBodyText) {
      this.critiqueBodyText.text = detailedBody;
    }
    if (this.researchingRingObject) {
      this.researchingRingObject.enabled = state === AgentState.RESEARCHING;
    }
    if (this.expandedCritiqueCard && state !== AgentState.HAND_RAISED) {
      this.expandedCritiqueCard.enabled = false;
      this.isCardExpanded = false;
    }
  }

  private onUpdate(deltaTime: number): void {
    this.animTime += deltaTime;

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
