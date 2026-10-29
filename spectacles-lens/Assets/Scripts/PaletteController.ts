import { Interactable } from 'SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable';
import { LENS_NODE_REGISTRY } from './NodeRegistry';
import { findSceneObject } from './SceneUtils';
import { WhiteboardCaptureSwitch } from './WhiteboardCaptureSwitch';

/** What the palette Interactables drive. SpatialInterfaceManager satisfies it with its public API. */
export interface PaletteTarget {
  triggerAddNode(nodeType: string): void;
  triggerUpdateSnapshot(): void;
  triggerConcludeMeeting(): void;
  handleWhiteboardPinch(): void;
  readonly capture: Pick<WhiteboardCaptureSwitch, 'captureNow' | 'toggleMode'>;
}

/** Interactable slots, named exactly as SpatialInterfaceManager's legacy inputs. */
export const PALETTE_SLOTS = [
  'btnAddDecision',
  'btnAddService',
  'btnAddDatabase',
  'btnAddTerminal',
  'btnUpdateSnapshot',
  'btnConcludeMeeting',
  'whiteboardInteractable',
  'btnCaptureWhiteboard',
  'btnToggleCaptureMode'
] as const;
export type PaletteSlot = typeof PALETTE_SLOTS[number];
export type PaletteRefs = Partial<Record<PaletteSlot, Interactable>>;

export interface DemoCritique {
  title: string;
  body: string;
  category: string;
}

const DEMO_NODE_LABELS: Record<string, string> = {
  service: 'Auth Gateway Service',
  database: 'Redis Token Cache',
  decision: 'Enforce JWT HMAC Verification',
  terminal: 'Client HTTPS Entrypoint'
};

/**
 * Label used when no fresh spoken phrase is available: the canned demo label in demo mode,
 * otherwise a registry-derived label.
 */
export function fallbackNodeLabel(nodeType: string, demoMode: boolean): string {
  if (demoMode && Object.prototype.hasOwnProperty.call(DEMO_NODE_LABELS, nodeType)) {
    return DEMO_NODE_LABELS[nodeType];
  }
  const def = LENS_NODE_REGISTRY[nodeType.toLowerCase()];
  if (def) return `${def.labelPrefix} Component`;
  return `New ${nodeType}`;
}

/**
 * Labels for an ADD_NODE: `shown` goes in the toast, `sent` on the wire. Only demo mode sends canned labels;
 * otherwise a pinch without fresh speech sends no label so successive pinches never share an identical
 * registry-derived label.
 */
export function nodeLabels(nodeType: string, demoMode: boolean, spokenPhrase: string | null): { shown: string; sent: string | null } {
  const fallback = fallbackNodeLabel(nodeType, demoMode);
  return { shown: spokenPhrase ?? fallback, sent: spokenPhrase ?? (demoMode ? fallback : null) };
}

/** Canned AI-teammate critique raised for a palette node in demo mode. */
export function demoNodeCritique(nodeType: string): DemoCritique {
  if (nodeType === 'decision') {
    return {
      title: '⚠️ Auth Token Leak Risk',
      body: '• Vulnerability: Unsigned JWT tokens can be forged\n• Fix: Require HMAC-SHA256 signature verification\n• Alternative: Move session state to Redis Token Cache',
      category: 'VULNERABILITY'
    };
  } else if (nodeType === 'service') {
    return {
      title: '⚠️ Rate Limit Bottleneck',
      body: '• Issue: Auth Gateway lacks token-bucket rate limiter\n• Risk: Susceptible to DDoS amplification\n• Fix: Deploy Envoy ingress rate limiting',
      category: 'LOGIC_FLAW'
    };
  } else if (nodeType === 'database') {
    return {
      title: '💡 Cache Invalidation Alert',
      body: '• Suggestion: Cache-aside pattern introduces stale reads\n• Fix: Implement write-through or pub/sub invalidation\n• Security: Enforce strict 60s TTL on session tokens',
      category: 'ALTERNATIVE_IDEA'
    };
  }
  return {
    title: '🚩 Insecure Transport Warning',
    body: '• Risk: Cleartext HTTP permitted on fallback\n• Fix: Enforce strict HSTS policy and TLS 1.3\n• Architecture: Terminate TLS at API Gateway',
    category: 'VULNERABILITY'
  };
}

/** Canned AI-teammate feedback raised on a snapshot update in demo mode. */
export const DEMO_SNAPSHOT_CRITIQUE: DemoCritique = {
  title: '💡 Architecture Optimized',
  body: '• Layout: Sugiyama hierarchical routing stabilized\n• Performance: Redis cache reduces DB load by 42%\n• Security: JWT verification enforced at API Gateway',
  category: 'ALTERNATIVE_IDEA'
};

/**
 * Palette and meeting-control Interactables (SIK pinch input) plus the palette's node labels/critiques.
 *
 * Moved out of SpatialInterfaceManager (task 48) without behaviour change. Each Interactable is bound to a
 * handler supplied by the manager, which owns the demo state machine.
 */
@component
export class PaletteController extends BaseScriptComponent {
  @input
  @allowUndefined
  public btnAddDecision?: Interactable;

  @input
  @allowUndefined
  public btnAddService?: Interactable;

  @input
  @allowUndefined
  public btnAddDatabase?: Interactable;

  @input
  @allowUndefined
  public btnAddTerminal?: Interactable;

  @input
  @allowUndefined
  public btnUpdateSnapshot?: Interactable;

  @input
  @allowUndefined
  public btnConcludeMeeting?: Interactable;

  /** Interactable on the WhiteboardBackplate; pinching it advances the whiteboard state. */
  @input
  @allowUndefined
  public whiteboardInteractable?: Interactable;

  /** Manual-mode capture button: pinching it ingests the whiteboard once. */
  @input
  @allowUndefined
  public btnCaptureWhiteboard?: Interactable;

  /** Switches between AUTO (periodic) and MANUAL (pinch) whiteboard capture. */
  @input
  @allowUndefined
  public btnToggleCaptureMode?: Interactable;

  private bound: boolean = false;

  /** Fills each slot from the coordinator's legacy inputs when this component's own input is unset. */
  public adopt(refs: PaletteRefs): void {
    for (const slot of PALETTE_SLOTS) {
      if (!this[slot] && refs[slot]) {
        this[slot] = refs[slot];
      }
    }
  }

  public resolveReferences(): void {
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
    if (!this.btnCaptureWhiteboard) {
      this.btnCaptureWhiteboard = this.findInteractable('BtnCaptureWhiteboard');
    }
    if (!this.btnToggleCaptureMode) {
      this.btnToggleCaptureMode = this.findInteractable('BtnToggleCaptureMode');
    }
  }

  /** Binds every Interactable to `target`. Binding twice would double-fire actions, so later calls are ignored. */
  public bind(target: PaletteTarget): void {
    if (this.bound) {
      return;
    }
    this.bound = true;
    this.bindSingleButton(this.btnAddDecision, () => target.triggerAddNode('decision'));
    this.bindSingleButton(this.btnAddService, () => target.triggerAddNode('service'));
    this.bindSingleButton(this.btnAddDatabase, () => target.triggerAddNode('database'));
    this.bindSingleButton(this.btnAddTerminal, () => target.triggerAddNode('terminal'));
    this.bindSingleButton(this.btnUpdateSnapshot, () => target.triggerUpdateSnapshot());
    this.bindSingleButton(this.btnConcludeMeeting, () => target.triggerConcludeMeeting());
    if (this.btnCaptureWhiteboard) {
      this.bindSingleButton(this.btnCaptureWhiteboard, () => target.capture.captureNow());
    }
    if (this.btnToggleCaptureMode) {
      this.bindSingleButton(this.btnToggleCaptureMode, () => target.capture.toggleMode());
    }
    if (this.whiteboardInteractable) {
      this.bindSingleButton(this.whiteboardInteractable, () => target.handleWhiteboardPinch());
      print('[PaletteController] Bound Interactable on WhiteboardBackplate');
    }
  }

  private findInteractable(name: string): Interactable | undefined {
    const obj = findSceneObject(name);
    if (!obj) {
      print(`[PaletteController] Object "${name}" not found in scene hierarchy`);
      return undefined;
    }
    try {
      const interactable = obj.getComponent(Interactable.getTypeName()) as Interactable;
      if (interactable) {
        print(`[PaletteController] Successfully resolved Interactable on "${name}"`);
        return interactable;
      }
    } catch (e) {
      print(`[PaletteController] findInteractable failed: ${e}`);
    }
    return undefined;
  }

  private bindSingleButton(button: Interactable | any, action: () => void): void {
    if (!button) {
      print('[PaletteController] Warning: attempted to bind null button');
      return;
    }
    try {
      if (button.onTriggerEnd && button.onTriggerEnd.add) {
        button.onTriggerEnd.add(() => action());
        print('[PaletteController] Bound onTriggerEnd to button');
      } else if (button.onButtonPinched && button.onButtonPinched.add) {
        button.onButtonPinched.add(() => action());
        print('[PaletteController] Bound onButtonPinched to button');
      }
    } catch (e) {
      print(`[PaletteController] bindSingleButton failed: ${e}`);
    }
  }
}
