import {findSceneObjectByName} from 'Leaf.lspkg/Utils/common/Utils';
import {SpatialInterfaceManager} from './SpatialInterfaceManager';
import {RaisingHandAgentController} from './RaisingHandAgentController';

export function getSpatialManager(): SpatialInterfaceManager | null {
  const ctrlObj = findSceneObjectByName('SpecScribeControllers');
  if (!ctrlObj) return null;
  const comps = ctrlObj.getComponents('Component.ScriptComponent' as any);
  for (const c of comps) {
    if ((c as any).getDiagramStage !== undefined) {
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
      return c as any;
    }
  }
  return null;
}
