import {Scenario} from 'Leaf.lspkg/Scenarios/scenario/Scenario';
import {expect} from 'Leaf.lspkg/Utils/common/Expect';
import {sleep} from 'Leaf.lspkg/Utils/common/Utils';
import {DefaultLeafInteractor} from 'Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor';
import {findInteractablesByName} from 'Leaf.lspkg/Interactors/InteractableUtils';
import {getSpatialManager} from './SpecScribeTestHelpers';

/**
 * Done Criterion 6:
 * Pinching the "Conclude Meeting" button cleanly wraps up the meeting session.
 */
@component
export class SpecScribeDC6Scenario extends Scenario {
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

    const btnConclude = findInteractablesByName('BtnConcludeMeeting')[0];
    expect(btnConclude).toBeTruthy();

    await interactor.trigger(btnConclude);
    await sleep(300);

    expect(sm.isMeetingConcluded()).toBe(true);
    expect(sm.getDiagramStage()).toBe(3);
    expect(sm.getToastText().includes('Concluded')).toBe(true);

    print(`[LEAF DC6] Passed: Meeting concluded cleanly. Toast: "${sm.getToastText()}"`);
  }
}
