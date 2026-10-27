import {Scenario} from 'Leaf.lspkg/Scenarios/scenario/Scenario';
import {expect} from 'Leaf.lspkg/Utils/common/Expect';
import {sleep} from 'Leaf.lspkg/Utils/common/Utils';
import {DefaultLeafInteractor} from 'Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor';
import {findInteractablesByName} from 'Leaf.lspkg/Interactors/InteractableUtils';
import {getSpatialManager, getSocketClient} from './SpecScribeTestHelpers';

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

    const socket = getSocketClient();
    expect(socket).toBeTruthy();
    if (!socket) return;

    const btnConclude = findInteractablesByName('BtnConcludeMeeting')[0];
    expect(btnConclude).toBeTruthy();

    await interactor.trigger(btnConclude);
    await sleep(300);

    const cmd = socket.getLastSentCommand();
    expect(cmd).toBeTruthy();
    if (cmd) {
      expect(cmd.eventType).toBe('pinchCommand');
      expect(cmd.action).toBe('CONCLUDE_MEETING');
    }

    expect(sm.isMeetingConcluded()).toBe(true);
    if (sm.demoMode) {
      expect(sm.getDiagramStage()).toBe(3);
      expect(sm.getToastText().includes('Concluded')).toBe(true);
    } else {
      // Live mode: stage 3 / 'Concluded' only follow MEETING_FINALIZED from the backend.
      expect(sm.getToastText().includes('Generating spec')).toBe(true);
      expect(sm.getDiagramStage() !== 3).toBe(true);
    }

    print(`[LEAF DC6] Passed: Meeting concluded cleanly. Toast: "${sm.getToastText()}"`);
  }
}
