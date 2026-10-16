import { BaseScriptComponent } from 'Component/ScriptComponent';
import { PinchButton } from 'SpectaclesInteractionKit.lspkg/Components/UI/PinchButton/PinchButton';
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

  onAwake(): void {
    this.createEvent('OnStartEvent').bind(() => {
      this.configureAudioLowLatency();
      this.setVisualState(AgentState.IDLE, '', '');
      this.bindInteractions();
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
        const title = (payload.short_title || '🚩 Agent Insight').substring(0, 28);
        const body = payload.detailed_body || '';
        this.setVisualState(AgentState.HAND_RAISED, title, body);
      };
    }

    if (this.agentOrbPinchButton) {
      this.agentOrbPinchButton.onButtonPinched.add(() => {
        this.handleOrbPinched();
      });
    }
  }

  private handleOrbPinched(): void {
    if (this.currentState === AgentState.HAND_RAISED) {
      this.isCardExpanded = !this.isCardExpanded;
      if (this.expandedCritiqueCard) {
        this.expandedCritiqueCard.enabled = this.isCardExpanded;
      }
      if (!this.isCardExpanded) {
        this.setVisualState(AgentState.IDLE, '', '');
      }
    } else if (this.currentState === AgentState.IDLE && this.socketClient) {
      const query = this.socketClient.getLatestSpokenPhrase();
      this.setVisualState(AgentState.RESEARCHING, '🔍 Researching...', '');
      this.socketClient.sendPinchCommand('ASK_AGENT', 'research', query);
    }
  }

  private setVisualState(state: AgentState, shortTitle: string, detailedBody: string): void {
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
    if (this.expandedCritiqueCard && state !== AgentState.HAND_RAISED) {
      this.expandedCritiqueCard.enabled = false;
      this.isCardExpanded = false;
    }
  }
}
