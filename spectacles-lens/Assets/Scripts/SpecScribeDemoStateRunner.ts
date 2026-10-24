import {Scenario} from 'Leaf.lspkg/Scenarios/scenario/Scenario';
import {sleep} from 'Leaf.lspkg/Utils/common/Utils';
import {getSpatialManager} from './SpecScribeTestHelpers';

@component
export class SpecScribeSelectAreaScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(200);
    const sm = getSpatialManager();
    if (sm) {
      sm.selectWhiteboardArea();
    }
    await sleep(300);
  }
}

@component
export class SpecScribeStartDrawingScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(200);
    const sm = getSpatialManager();
    if (sm) {
      sm.startDrawingAndIngestion();
    }
    await sleep(300);
  }
}
