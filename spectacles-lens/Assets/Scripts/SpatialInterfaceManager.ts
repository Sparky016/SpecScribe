import { Interactable } from 'SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable';
import { PersistentStreamSocketClient } from './PersistentStreamSocketClient';

@component
export class SpatialInterfaceManager extends BaseScriptComponent {
  @input
  @allowUndefined
  private socketClient?: PersistentStreamSocketClient;

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
  private diagramOverlayMesh?: RenderMeshVisual;

  @input
  @allowUndefined
  private diffToastText?: Text;

  onAwake(): void {
    this.createEvent('OnStartEvent').bind(() => {
      this.resolveReferences();
      this.bindPaletteButtons();
      this.bindSocketCallbacks();
    });
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
  }

  private findSceneObject(name: string): SceneObject | null {
    try {
      if (typeof global !== 'undefined' && (global as any).scene && (global as any).scene.findObjectByName) {
        return (global as any).scene.findObjectByName(name);
      }
    } catch (e) {
      // Ignored
    }
    return null;
  }

  private findInteractable(name: string): Interactable | undefined {
    const obj = this.findSceneObject(name);
    if (!obj) {
      return undefined;
    }
    try {
      const comps = obj.getComponents('Component.ScriptComponent' as any);
      for (const c of comps) {
        if ((c as any).onButtonPinched || (c as any).onTriggerEnd || (c as any).isPinch) {
          return c as any;
        }
      }
    } catch (e) {
      // Ignored
    }
    return undefined;
  }

  private bindPaletteButtons(): void {
    this.bindSingleButton(this.btnAddDecision, 'decision');
    this.bindSingleButton(this.btnAddService, 'service');
    this.bindSingleButton(this.btnAddDatabase, 'database');
    this.bindSingleButton(this.btnAddTerminal, 'terminal');
  }

  private bindSingleButton(button: Interactable | any, nodeType: string): void {
    if (!button) {
      return;
    }
    if (button.onButtonPinched) {
      button.onButtonPinched.add(() => {
        this.triggerAddNode(nodeType);
      });
    } else if (button.onTriggerEnd) {
      button.onTriggerEnd.add(() => {
        this.triggerAddNode(nodeType);
      });
    }
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
