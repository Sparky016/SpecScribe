import {scenariosIndex} from 'Leaf.lspkg/Scenarios/decorator/ScenarioIndexDecorator';
import {ScenarioMetadata} from 'Leaf.lspkg/Scenarios/scenario/ScenarioMetadata';
import {SpecScribeDC0WhiteboardSelectionScenario} from './SpecScribeDC0WhiteboardSelectionScenario';
import {SpecScribeDC1Scenario} from './SpecScribeDC1Scenario';
import {SpecScribeDC2Scenario} from './SpecScribeDC2Scenario';
import {SpecScribeDC3Scenario} from './SpecScribeDC3Scenario';
import {SpecScribeDC4Scenario} from './SpecScribeDC4Scenario';
import {SpecScribeDC5Scenario} from './SpecScribeDC5Scenario';
import {SpecScribeDC6Scenario} from './SpecScribeDC6Scenario';
import {SpecScribeSelectAreaScenario, SpecScribeStartDrawingScenario} from './SpecScribeDemoStateRunner';

@component
export class LeafIndex extends BaseScriptComponent {
  @scenariosIndex
  static scenariosIndex: ScenarioMetadata[] = [
    {
      id: 'dc0-whiteboard-selection',
      typename: SpecScribeDC0WhiteboardSelectionScenario.getTypeName(),
    },
    {
      id: 'demo-select-whiteboard',
      typename: SpecScribeSelectAreaScenario.getTypeName(),
    },
    {
      id: 'demo-start-drawing',
      typename: SpecScribeStartDrawingScenario.getTypeName(),
    },
    {
      id: 'dc1-whiteboard-anchor',
      typename: SpecScribeDC1Scenario.getTypeName(),
    },
    {
      id: 'dc2-world-anchor-mobility',
      typename: SpecScribeDC2Scenario.getTypeName(),
    },
    {
      id: 'dc3-palette-node-injection',
      typename: SpecScribeDC3Scenario.getTypeName(),
    },
    {
      id: 'dc4-update-snapshot',
      typename: SpecScribeDC4Scenario.getTypeName(),
    },
    {
      id: 'dc5-ai-orb-hand-raised',
      typename: SpecScribeDC5Scenario.getTypeName(),
    },
    {
      id: 'dc6-conclude-meeting',
      typename: SpecScribeDC6Scenario.getTypeName(),
    },
  ];
}
