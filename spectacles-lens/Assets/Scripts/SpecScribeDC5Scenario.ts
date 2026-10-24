import {Scenario} from 'Leaf.lspkg/Scenarios/scenario/Scenario';
import {expect} from 'Leaf.lspkg/Utils/common/Expect';
import {findSceneObjectByName, sleep} from 'Leaf.lspkg/Utils/common/Utils';
import {DefaultLeafInteractor} from 'Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor';
import {findInteractablesByName} from 'Leaf.lspkg/Interactors/InteractableUtils';
import {getAgentController} from './SpecScribeTestHelpers';
import {AgentState} from './RaisingHandAgentController';

/**
 * Done Criterion 5:
 * The 3D AI Orb displays in peripheral view, transitions to HAND_RAISED state with visible title badge, and pinching the orb expands the critique card.
 */
@component
export class SpecScribeDC5Scenario extends Scenario {
  async run(): Promise<void> {
    await sleep(400);

    const interactor = new DefaultLeafInteractor();
    const agent = getAgentController();
    expect(agent).toBeTruthy();
    if (!agent) return;

    // Verify peripheral position
    const orbObj = findSceneObjectByName('AgentOrbMesh');
    expect(orbObj).toBeTruthy();
    const orbPos = orbObj.getTransform().getWorldPosition();
    print(`[LEAF DC5] AI Orb position: x=${orbPos.x}, y=${orbPos.y}, z=${orbPos.z}`);
    // Should be in upper-right peripheral view (x > 25, y > 5, z <= -90)
    expect(orbPos.x).toBeGreaterThan(25);
    expect(orbPos.y).toBeGreaterThan(5);

    // Trigger proactive hand raise
    agent.triggerHandRaised(
      '⚠️ Auth Token Leak Risk',
      '• Vulnerability: Unsigned JWT tokens can be forged\n• Fix: Require HMAC-SHA256 signature verification\n• Alternative: Move session state to Redis Token Cache',
      'VULNERABILITY'
    );
    await sleep(200);

    expect(agent.getState()).toBe(AgentState.HAND_RAISED);

    // Check title badge
    const pill = findSceneObjectByName('HandRaisedPillBadge');
    expect(pill).toBeTruthy();
    expect(pill.enabled).toBe(true);
    print('[LEAF DC5] AI Teammate in HAND_RAISED state with pill badge visible.');

    // Pinch the orb to expand critique card
    const orbInteractables = findInteractablesByName('AgentOrbMesh');
    expect(orbInteractables.length).toBeGreaterThan(0);
    await interactor.trigger(orbInteractables[0]);
    await sleep(300);

    expect(agent.isExpanded()).toBe(true);
    const critiqueCard = findSceneObjectByName('ExpandedCritiqueCard');
    expect(critiqueCard).toBeTruthy();
    expect(critiqueCard.enabled).toBe(true);
    print('[LEAF DC5] Passed: Critique card expanded upon pinching AI orb.');
  }
}
