import {Scenario} from 'Leaf.lspkg/Scenarios/scenario/Scenario';
import {expect} from 'Leaf.lspkg/Utils/common/Expect';
import {sleep} from 'Leaf.lspkg/Utils/common/Utils';
import {getSpatialManager} from './SpecScribeTestHelpers';
import {WhiteboardState} from './SpatialInterfaceManager';

@component
export class SpecScribeSelectAreaScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(400);
    const sm = getSpatialManager();
    expect(sm).toBeTruthy();
    if (!sm) return;

    // Drag lower to eye level and resize
    sm.dragWhiteboard(-30);
    await sleep(200);
    sm.resizeWhiteboard(120, 76);
    await sleep(200);

    // Pinch in the middle to set
    sm.pinchCenterToSet();
    await sleep(300);
    expect(sm.getWhiteboardState()).toBe(WhiteboardState.CLEAN_BOARD);
    print('[LEAF] Advanced to State 2: Clean Whiteboard (Lowered & Resized).');
  }
}
