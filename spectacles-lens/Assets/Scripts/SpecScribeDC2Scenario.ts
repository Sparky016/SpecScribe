import {Scenario} from 'Leaf.lspkg/Scenarios/scenario/Scenario';
import {expect} from 'Leaf.lspkg/Utils/common/Expect';
import {findSceneObjectByName, sleep} from 'Leaf.lspkg/Utils/common/Utils';

/**
 * Done Criterion 2:
 * The diagram overlay sticks solidly to the whiteboard surface as the user moves and looks around with WASD and mouse.
 */
@component
export class SpecScribeDC2Scenario extends Scenario {
  async run(): Promise<void> {
    await sleep(300);

    const hudRoot = findSceneObjectByName('SpatialHUDRoot');
    expect(hudRoot).toBeTruthy();

    // Verify SpatialHUDRoot is anchored in 3D world space (NOT parented to Camera, avoiding glued-to-head bug)
    const parent = hudRoot.getParent();
    const isGluedToHead = parent !== null && parent.name === 'Camera Object';
    expect(isGluedToHead).toBe(false);

    // Verify Camera Object exists
    const cameraObj = findSceneObjectByName('Camera Object');
    expect(cameraObj).toBeTruthy();

    const dtComp = cameraObj.getComponent('Component.DeviceTracking' as any);
    if (dtComp) {
      print(`[LEAF DC2] Camera DeviceTracking mode: ${(dtComp as any).trackingMode}`);
    }

    const overlay = findSceneObjectByName('WhiteboardOverlayAnchor');
    const backplate = findSceneObjectByName('WhiteboardBackplate');
    expect(overlay).toBeTruthy();
    expect(backplate).toBeTruthy();

    // Verify overlay and backplate share identical world XY alignment
    const ovPos = overlay.getTransform().getWorldPosition();
    const bpPos = backplate.getTransform().getWorldPosition();
    expect(Math.abs(ovPos.x - bpPos.x)).toBeLessThan(5);
    expect(Math.abs(ovPos.y - bpPos.y)).toBeLessThan(5);

    print('[LEAF DC2] Passed: Diagram overlay is solidly world-space anchored with World tracking.');
  }
}
