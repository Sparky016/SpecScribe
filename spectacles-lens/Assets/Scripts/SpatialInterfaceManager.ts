import { BaseScriptComponent } from 'Component/ScriptComponent';
import { PinchButton } from 'SpectaclesInteractionKit.lspkg/Components/UI/PinchButton/PinchButton';
import { Interactable } from 'SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable';
import { PersistentStreamSocketClient } from './PersistentStreamSocketClient';

@component
export class SpatialInterfaceManager extends BaseScriptComponent {
  @input
  private socketClient!: PersistentStreamSocketClient;

  @input
  private btnAddDecision!: PinchButton;

  @input
  private btnAddService!: PinchButton;

  @input
  private btnAddDatabase!: PinchButton;

  @input
  private btnAddTerminal!: PinchButton;

  @input
  private diagramOverlayMesh!: RenderMeshVisual;

  @input
  private diffToastText!: Text;

  onAwake(): void {
    this.createEvent('OnStartEvent').bind(() => {
      this.bindPaletteButtons();
      this.bindSocketCallbacks();
    });
  }

  private bindPaletteButtons(): void {
    this.bindSingleButton(this.btnAddDecision, 'decision');
    this.bindSingleButton(this.btnAddService, 'service');
    this.bindSingleButton(this.btnAddDatabase, 'database');
    this.bindSingleButton(this.btnAddTerminal, 'terminal');
  }

  private bindSingleButton(button: PinchButton, nodeType: string): void {
    if (!button) {
      return;
    }
    button.onButtonPinched.add(() => {
      this.triggerAddNode(nodeType);
    });
  }

  public triggerAddNode(nodeType: string): void {
    const spokenLabel = this.socketClient
      ? this.socketClient.getLatestSpokenPhrase()
      : `New ${nodeType}`;
    if (this.diffToastText) {
      this.diffToastText.text = `Adding [${nodeType.toUpperCase()}]: "${spokenLabel}"...`;
    }
    if (this.socketClient) {
      this.socketClient.sendPinchCommand('ADD_NODE', nodeType, spokenLabel);
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

  public getToastText(): string {
    return this.diffToastText ? this.diffToastText.text : '';
  }

  public setToastText(text: string): void {
    if (this.diffToastText) {
      this.diffToastText.text = text;
    }
  }
}
