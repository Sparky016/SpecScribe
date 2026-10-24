import {Scenario} from 'Leaf.lspkg/Scenarios/scenario/Scenario';
import {expect} from 'Leaf.lspkg/Utils/common/Expect';
import {sleep} from 'Leaf.lspkg/Utils/common/Utils';
import {getSpatialManager} from './SpecScribeTestHelpers';
import {WhiteboardState} from './SpatialInterfaceManager';

/**
 * Done Criterion 0 (Whiteboard Area Selection & Clean Whiteboard Start):
 * The app begins with whiteboard area selection mode (no drawings).
 * The user selects the whiteboard area, leaving a clean whiteboard.
 * Drawings/nodes only appear once drawing is started or components are injected.
 */
@component
export class SpecScribeDC0WhiteboardSelectionScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(400);

    const sm = getSpatialManager();
    expect(sm).toBeTruthy();
    if (!sm) return;

    // 1. Initial State: Area selection mode with zero drawings
    expect(sm.getWhiteboardState()).toBe(WhiteboardState.SELECT_AREA);
    expect(sm.getNodeCount()).toBe(0);
    expect(sm.isCleanBoard()).toBe(false);
    expect(sm.getToastText().includes('Whiteboard Calibration')).toBe(true);
    print('[LEAF DC0] Verified initial state: Whiteboard Area Selection active, zero drawings on board.');

    // 2. Select Whiteboard Area -> Transitions to Clean Whiteboard
    sm.selectWhiteboardArea();
    await sleep(200);

    expect(sm.getWhiteboardState()).toBe(WhiteboardState.CLEAN_BOARD);
    expect(sm.isCleanBoard()).toBe(true);
    expect(sm.getNodeCount()).toBe(0); // Demo starts with a 100% clean whiteboard!
    expect(sm.getToastText().includes('Clean Whiteboard Ready')).toBe(true);
    print('[LEAF DC0] Verified clean whiteboard: Area locked on wall, board surface pristine with 0 drawings.');

    // 3. Start Drawing & Ingestion -> Drawings appear on whiteboard and DAG overlay activates
    sm.startDrawingAndIngestion();
    await sleep(200);

    expect(sm.getWhiteboardState()).toBe(WhiteboardState.DRAWING_ACTIVE);
    expect(sm.getNodeCount()).toBe(4);
    expect(sm.getToastText().includes('Sugiyama DAG Active')).toBe(true);
    print('[LEAF DC0] Passed: Whiteboard area selection and clean whiteboard startup verified.');
  }
}
