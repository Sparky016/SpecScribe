import {Scenario} from 'Leaf.lspkg/Scenarios/scenario/Scenario';
import {expect} from 'Leaf.lspkg/Utils/common/Expect';
import {sleep} from 'Leaf.lspkg/Utils/common/Utils';
import {getSpatialManager} from './SpecScribeTestHelpers';
import {WhiteboardState} from './SpatialInterfaceManager';

/**
 * Done Criterion 0 (Interactive Whiteboard Positioning, Sizing & Clean Start):
 * The app begins with whiteboard area selection mode up high on the room wall.
 * The user drags the whiteboard to come lower to eye level and resizes it.
 * The user pinches in the middle to set it, locking the area onto the wall.
 * The demo starts with a 100% clean whiteboard (zero marker drawings, zero DAG nodes).
 * Drawings and Sugiyama DAG overlay only appear once drawing ingestion is triggered.
 */
@component
export class SpecScribeDC0WhiteboardSelectionScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(400);

    const sm = getSpatialManager();
    expect(sm).toBeTruthy();
    if (!sm) return;

    // 1. Initial State: Area selection mode with whiteboard starting up high
    expect(sm.getWhiteboardState()).toBe(WhiteboardState.SELECT_AREA);
    expect(sm.getNodeCount()).toBe(0);
    expect(sm.isCleanBoard()).toBe(false);
    expect(sm.getToastText().includes('Whiteboard Calibration')).toBe(true);

    const initialPos = sm.getWhiteboardPosition();
    const initialScale = sm.getWhiteboardScale();
    print(`[LEAF DC0] Initial Whiteboard Position: x=${initialPos.x.toFixed(1)}, y=${initialPos.y.toFixed(1)}, z=${initialPos.z.toFixed(1)} (too high on wall: y=${initialPos.y.toFixed(1)})`);
    expect(initialPos.y).toBeGreaterThan(35); // Verified starting up high!

    // 2. Drag the whiteboard to come lower (by 30cm to eye level)
    print(`[LEAF DC0] Dragging whiteboard lower (from y=${initialPos.y.toFixed(1)} to eye level)...`);
    sm.dragWhiteboard(-30);
    await sleep(200);

    // 3. Resize the whiteboard dimensions (to 120x76 cm)
    print('[LEAF DC0] Resizing whiteboard dimensions to 120x76 cm...');
    sm.resizeWhiteboard(120, 76);
    await sleep(200);

    const adjustedPos = sm.getWhiteboardPosition();
    const adjustedScale = sm.getWhiteboardScale();
    print(`[LEAF DC0] Adjusted Whiteboard Position: y=${adjustedPos.y.toFixed(1)}, Scale: width=${adjustedScale.x.toFixed(0)}cm, height=${adjustedScale.z.toFixed(0)}cm`);
    expect(adjustedPos.y).toBeLessThan(initialPos.y - 20); // Lowered successfully!
    expect(adjustedPos.y).toBeLessThan(initialPos.y - 15);
    expect(adjustedScale.x).toBeLessThan(initialScale.x); // Resized successfully!

    // 4. Pinch in the middle to set it -> Locks area and transitions to Clean Whiteboard
    print('[LEAF DC0] Pinching in the middle to set and lock the whiteboard area...');
    sm.pinchCenterToSet();
    await sleep(200);

    expect(sm.getWhiteboardState()).toBe(WhiteboardState.CLEAN_BOARD);
    expect(sm.isCleanBoard()).toBe(true);
    expect(sm.getNodeCount()).toBe(0); // Starts with a 100% clean whiteboard!
    expect(sm.getToastText().includes('Clean Whiteboard Ready')).toBe(true);
    print(`[LEAF DC0] Clean whiteboard locked at lowered position (y=${adjustedPos.y.toFixed(1)}) with 0 drawings.`);

    // 5. Start Drawing & Ingestion -> Drawings appear on whiteboard and DAG overlay activates
    sm.startDrawingAndIngestion();
    await sleep(200);

    expect(sm.getWhiteboardState()).toBe(WhiteboardState.DRAWING_ACTIVE);
    expect(sm.getNodeCount()).toBe(4);
    expect(sm.getToastText().includes('Sugiyama DAG Active')).toBe(true);
    print('[LEAF DC0] Passed: Start high, drag lower, resize, center-pinch lock, clean board start, and drawing ingestion verified.');
  }
}
