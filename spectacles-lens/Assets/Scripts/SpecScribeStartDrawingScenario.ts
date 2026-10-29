import {Scenario} from 'Leaf.lspkg/Scenarios/scenario/Scenario';
import {expect} from 'Leaf.lspkg/Utils/common/Expect';
import {sleep} from 'Leaf.lspkg/Utils/common/Utils';
import {getSpatialManager} from './SpecScribeTestHelpers';
import {WhiteboardState} from './SpatialInterfaceManager';

@component
export class SpecScribeStartDrawingScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(400);
    const sm = getSpatialManager();
    expect(sm).toBeTruthy();
    if (!sm) return;

    sm.startDrawingAndIngestion();
    await sleep(300);
    expect(sm.getWhiteboardState()).toBe(WhiteboardState.DRAWING_ACTIVE);
    print('[LEAF] Advanced to State 3: Drawing & Ingestion Active.');
  }
}
