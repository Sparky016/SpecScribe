import {Scenario} from 'Leaf.lspkg/Scenarios/scenario/Scenario';
import {expect} from 'Leaf.lspkg/Utils/common/Expect';
import {sleep} from 'Leaf.lspkg/Utils/common/Utils';
import {DefaultLeafInteractor} from 'Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor';
import {findInteractablesByName} from 'Leaf.lspkg/Interactors/InteractableUtils';
import {getSpatialManager} from './SpecScribeTestHelpers';

/**
 * Done Criterion 4:
 * Pinching the "Update / Snapshot" button refreshes the overlay with an updated multi-node diagram.
 */
@component
export class SpecScribeDC4Scenario extends Scenario {
  async run(): Promise<void> {
    await sleep(400);

    const interactor = new DefaultLeafInteractor();
    const sm = getSpatialManager();
    expect(sm).toBeTruthy();
    if (!sm) return;

    if (sm.getWhiteboardState && sm.getWhiteboardState() !== 2) {
      sm.startDrawingAndIngestion();
      await sleep(200);
    }

    const btnSnapshot = findInteractablesByName('BtnUpdateSnapshot')[0];
    expect(btnSnapshot).toBeTruthy();

    await interactor.trigger(btnSnapshot);
    await sleep(300);

    // Diagram stage 2 = snapshot updated multi-node DAG
    expect(sm.getDiagramStage()).toBe(2);
    expect(sm.getToastText().includes('Snapshot')).toBe(true);

    print(`[LEAF DC4] Passed: Update Snapshot refreshed overlay to stage 2. Toast: "${sm.getToastText()}"`);
  }
}
