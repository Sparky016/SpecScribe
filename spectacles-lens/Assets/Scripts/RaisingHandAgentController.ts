import { BaseScriptComponent } from 'Component/ScriptComponent';
import { PinchButton } from 'SpectaclesInteractionKit.lspkg/Components/UI/PinchButton/PinchButton';
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
  private socketClient!: PersistentStreamSocketClient;

  @input
  private agentOrbPinchButton!: PinchButton;

  @input
  private agentOrbMeshVisual?: RenderMeshVisual;

  @input
  private researchingRingObject?: SceneObject;

  @input
  private handRaisedPillObject!: SceneObject;

  @input
  private pillTitleText!: Text;

  @input
  private expandedCritiqueCard!: SceneObject;

  @input
  private critiqueBodyText!: Text;

  @input
  private agentAudioComponent?: AudioComponent;

  private currentState: AgentState = AgentState.IDLE;
  private latestCritiqueBody: string = '';
  private isCardExpanded: boolean = false;
  private animTime: number = 0;

  onAwake(): void {
    this.createEvent('OnStartEvent').bind(() => {
      this.configureAudioLowLatency();
      this.setVisualState(AgentState.IDLE, '', '');
      this.bindInteractions();
    });

    this.createEvent('UpdateEvent').bind((eventData) => {
      this.onUpdate(eventData.getDeltaTime());
    });
  }

  private configureAudioLowLatency(): void {
    if (this.agentAudioComponent) {
      this.agentAudioComponent.playbackMode = Audio.PlaybackMode.LowLatency;
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

        // Audio notification alert in low-latency mode
        if (this.agentAudioComponent) {
          try {
            this.agentAudioComponent.play(1);
          } catch (e) {
            // Audio play ignored if clip not set
          }
        }
      };
    }

    if (this.agentOrbPinchButton) {
      this.agentOrbPinchButton.onButtonPinched.add(() => {
        this.handleOrbPinched();
      });
    }
  }

  public handleOrbPinched(): void {
    if (this.currentState === AgentState.HAND_RAISED) {
      this.isCardExpanded = !this.isCardExpanded;
      if (this.expandedCritiqueCard) {
        this.expandedCritiqueCard.enabled = this.isCardExpanded;
      }
      this.configureAudioLowLatency();
      if (!this.isCardExpanded) {
        this.setVisualState(AgentState.IDLE, '', '');
      }
    } else if (this.currentState === AgentState.IDLE && this.socketClient) {
      const query = this.socketClient.getLatestSpokenPhrase();
      this.setVisualState(AgentState.RESEARCHING, '🔍 Researching...', '');
      this.socketClient.sendPinchCommand('ASK_AGENT', 'research', query);
    }
  }

  public setVisualState(state: AgentState, shortTitle: string, detailedBody: string): void {
    this.currentState = state;
    this.latestCritiqueBody = detailedBody;

    if (this.handRaisedPillObject) {
      this.handRaisedPillObject.enabled = state !== AgentState.IDLE;
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
        const baseScale = 1.0;
        const pulse = 1.0 + 0.05 * Math.sin(this.animTime * 2.5);
        obj.getTransform().setLocalScale(new vec3(pulse, pulse, pulse));
      }
    }

    // State 2: RESEARCHING rotating ring
    if (this.currentState === AgentState.RESEARCHING && this.researchingRingObject) {
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
  }
}
