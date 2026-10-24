import {Scenario} from 'Leaf.lspkg/Scenarios/scenario/Scenario';
import {expect} from 'Leaf.lspkg/Utils/common/Expect';
import {findSceneObjectByName, sleep} from 'Leaf.lspkg/Utils/common/Utils';
import {getSpatialManager} from './SpecScribeTestHelpers';

/**
 * Done Criterion 1:
 * Standing in front of the virtual whiteboard in interactive preview shows the initial drawn diagram at 1.15 m.
 */
@component
export class SpecScribeDC1Scenario extends Scenario {
  async run(): Promise<void> {
    await sleep(500);

    const whiteboardBackplate = findSceneObjectByName('WhiteboardBackplate');
    expect(whiteboardBackplate).toBeTruthy();
    expect(whiteboardBackplate.enabled).toBe(true);

    const overlayAnchor = findSceneObjectByName('WhiteboardOverlayAnchor');
    expect(overlayAnchor).toBeTruthy();
    expect(overlayAnchor.enabled).toBe(true);

    // Verify distance from origin in world coordinates (~1.15m focal depth, z <= -100 cm)
    const pos = overlayAnchor.getTransform().getWorldPosition();
    print(`[LEAF DC1] Overlay world position: x=${pos.x}, y=${pos.y}, z=${pos.z}`);
    expect(pos.z).toBeLessThan(-95);
    expect(pos.z).toBeGreaterThan(-135);

    // Verify initial diagram stage is 0 (initial drawn Sugiyama DAG)
    const sm = getSpatialManager();
    expect(sm).toBeTruthy();
    if (sm) {
      expect(sm.getDiagramStage()).toBe(0);
    }
    print('[LEAF DC1] Passed: Whiteboard and initial diagram overlay confirmed at arm-length depth (~1.15m).');
  }
}
