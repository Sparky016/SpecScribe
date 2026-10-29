import {Scenario} from 'Leaf.lspkg/Scenarios/scenario/Scenario';
import {expect} from 'Leaf.lspkg/Utils/common/Expect';
import {sleep} from 'Leaf.lspkg/Utils/common/Utils';
import {DefaultLeafInteractor} from 'Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor';
import {findInteractablesByName} from 'Leaf.lspkg/Interactors/InteractableUtils';
import {getSpatialManager, getAgentController} from './SpecScribeTestHelpers';
import {WhiteboardState} from './SpatialInterfaceManager';
import {AgentState} from './RaisingHandAgentController';

/**
 * Full End-to-End Stakeholder Demo Scenario:
 * Steps through all 8 stages of the SpecScribe experience with timing
 * suitable for live preview demonstration and video capture.
 */
@component
export class SpecScribeFullDemoScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(400);
    const sm = getSpatialManager();
    const agent = getAgentController();
    const interactor = new DefaultLeafInteractor();
    expect(sm).toBeTruthy();
    expect(agent).toBeTruthy();
    if (!sm || !agent) return;

    // Stage 1: Initial Selection Mode (board high on wall)
    print('[DEMO JOURNEY] Stage 1: Room Calibration & Whiteboard Area Selection');
    await sleep(3500);

    // Stage 2: Drag lower to eye level, resize, and pinch center to lock
    print('[DEMO JOURNEY] Stage 2: Whiteboard Lowered, Resized & Locked to Clean Surface');
    sm.dragWhiteboard(-30);
    await sleep(400);
    sm.resizeWhiteboard(120, 76);
    await sleep(400);
    sm.pinchCenterToSet();
    await sleep(3500);

    // Stage 3: Ingest live marker sketch & initial Sugiyama DAG
    print('[DEMO JOURNEY] Stage 3: Ingested Whiteboard Sketch & Sugiyama DAG Active');
    sm.startDrawingAndIngestion();
    await sleep(4000);

    // Stage 4: Palette Decision node injection
    print('[DEMO JOURNEY] Stage 4: Injected Decision Node (Verify JWT HMAC)');
    const btnDecision = findInteractablesByName('BtnAddDecision')[0];
    if (btnDecision) {
      await interactor.trigger(btnDecision);
    } else {
      sm.triggerAddNode('decision');
    }
    await sleep(4000);

    // Stage 5: AI Teammate raises hand
    print('[DEMO JOURNEY] Stage 5: Proactive AI Agent Raises Hand');
    agent.triggerHandRaised(
      '⚠️ Auth Token Leak Risk',
      '• Vulnerability: Unsigned JWT tokens can be forged\n• Fix: Require HMAC-SHA256 signature verification\n• Alternative: Move session state to Redis Token Cache',
      'VULNERABILITY'
    );
    await sleep(4000);

    // Stage 6: Pinch AI Orb -> Expand Critique Card
    print('[DEMO JOURNEY] Stage 6: Pinch AI Orb -> Expanded Critique Card');
    const orbInteractables = findInteractablesByName('AgentOrbMesh');
    if (orbInteractables && orbInteractables.length > 0) {
      await interactor.trigger(orbInteractables[0]);
    } else {
      agent.handleOrbPinched();
    }
    await sleep(4500);

    // Stage 7: Update Architecture Snapshot
    print('[DEMO JOURNEY] Stage 7: Update Architecture Snapshot Multi-Tier DAG');
    const btnSnapshot = findInteractablesByName('BtnUpdateSnapshot')[0];
    if (btnSnapshot) {
      await interactor.trigger(btnSnapshot);
    } else {
      sm.triggerUpdateSnapshot();
    }
    await sleep(4000);

    // Stage 8: Conclude Meeting
    print('[DEMO JOURNEY] Stage 8: Conclude Meeting & Generate Technical Spec');
    const btnConclude = findInteractablesByName('BtnConcludeMeeting')[0];
    if (btnConclude) {
      await interactor.trigger(btnConclude);
    } else {
      sm.triggerConcludeMeeting();
    }
    await sleep(4500);

    print('[DEMO JOURNEY] Demo Walkthrough Completed Successfully!');
  }
}
