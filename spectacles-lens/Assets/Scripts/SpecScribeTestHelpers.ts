import {findSceneObjectByName} from 'Leaf.lspkg/Utils/common/Utils';
import {SpatialInterfaceManager} from './SpatialInterfaceManager';
import {RaisingHandAgentController} from './RaisingHandAgentController';
import {PersistentStreamSocketClient} from './PersistentStreamSocketClient';

/**
 * Each LEAF scenario obtains its manager/controller through the getters below, which reset that
 * component's per-scenario state first so a prior scenario (e.g. DC6 concluding the meeting) cannot leak.
 */
export function getSpatialManager(): SpatialInterfaceManager | null {
  const ctrlObj = findSceneObjectByName('SpecScribeControllers');
  if (!ctrlObj) return null;
  const comps = ctrlObj.getComponents('Component.ScriptComponent' as any);
  for (const c of comps) {
    if ((c as any).getDiagramStage !== undefined) {
      (c as any).resetForTest();
      return c as any;
    }
  }
  return null;
}

export function getAgentController(): RaisingHandAgentController | null {
  const ctrlObj = findSceneObjectByName('SpecScribeControllers');
  if (!ctrlObj) return null;
  const comps = ctrlObj.getComponents('Component.ScriptComponent' as any);
  for (const c of comps) {
    if ((c as any).triggerHandRaised !== undefined) {
      (c as any).resetForTest();
      return c as any;
    }
  }
  return null;
}

export function getSocketClient(): PersistentStreamSocketClient | null {
  const ctrlObj = findSceneObjectByName('SpecScribeControllers');
  if (!ctrlObj) return null;
  const comps = ctrlObj.getComponents('Component.ScriptComponent' as any);
  for (const c of comps) {
    if ((c as any).getLastSentCommand !== undefined) {
      return c as any;
    }
  }
  return null;
}
