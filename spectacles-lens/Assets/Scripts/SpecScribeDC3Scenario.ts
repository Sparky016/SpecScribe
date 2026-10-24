import {Scenario} from 'Leaf.lspkg/Scenarios/scenario/Scenario';
import {expect} from 'Leaf.lspkg/Utils/common/Expect';
import {sleep} from 'Leaf.lspkg/Utils/common/Utils';
import {DefaultLeafInteractor} from 'Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor';
import {findInteractablesByName} from 'Leaf.lspkg/Interactors/InteractableUtils';
import {getSpatialManager} from './SpecScribeTestHelpers';

/**
 * Done Criterion 3:
 * Pinching any button on the 4-button SIK Component Palette (Decision, Service, Database, Terminal) injects a new node into the diagram.
 */
@component
export class SpecScribeDC3Scenario extends Scenario {
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

    const initialNodes = sm.getNodeCount();

    // 1. Pinch Decision button
    const btnDecision = findInteractablesByName('BtnAddDecision')[0];
    expect(btnDecision).toBeTruthy();
    await interactor.trigger(btnDecision);
    await sleep(200);

    expect(sm.getNodeCount()).toBe(initialNodes + 1);
    expect(sm.getDiagramStage()).toBe(1);
    print(`[LEAF DC3] Decision node injected successfully. Total nodes: ${sm.getNodeCount()}`);

    // 2. Pinch Service button
    const btnService = findInteractablesByName('BtnAddService')[0];
    expect(btnService).toBeTruthy();
    await interactor.trigger(btnService);
    await sleep(200);

    expect(sm.getNodeCount()).toBe(initialNodes + 2);
    print(`[LEAF DC3] Service node injected successfully. Total nodes: ${sm.getNodeCount()}`);

    // 3. Pinch Database button
    const btnDatabase = findInteractablesByName('BtnAddDatabase')[0];
    expect(btnDatabase).toBeTruthy();
    await interactor.trigger(btnDatabase);
    await sleep(200);

    expect(sm.getNodeCount()).toBe(initialNodes + 3);
    print(`[LEAF DC3] Database node injected successfully. Total nodes: ${sm.getNodeCount()}`);

    // 4. Pinch Terminal button
    const btnTerminal = findInteractablesByName('BtnAddTerminal')[0];
    expect(btnTerminal).toBeTruthy();
    await interactor.trigger(btnTerminal);
    await sleep(200);

    expect(sm.getNodeCount()).toBe(initialNodes + 4);
    print(`[LEAF DC3] Terminal node injected successfully. Total nodes: ${sm.getNodeCount()}`);
  }
}
