import { test, describe, before, beforeEach } from 'node:test';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {
  setupLensGlobalMocks,
  MockSceneObject,
  MockRenderMeshVisual,
  MockText,
  MockScriptEvent,
  MockTexture,
  MockPinchButton,
  MockAudioComponent,
  MockBaseScriptComponent,
  MockTransform
} from './lens_mock_environment.mjs';

setupLensGlobalMocks();
global.BaseScriptComponent = MockBaseScriptComponent;
global.allowUndefined = () => {};
// The shared mock transform has no world scale; the calibrator uses it.
MockTransform.prototype.getWorldScale = function () { return this.scale; };
MockTransform.prototype.setWorldScale = function (s) { this.scale = s; };
global.vec2 = class { constructor(x = 0, y = 0) { this.x = x; this.y = y; } };
let now = 100;
global.getTime = () => now;

const scriptsDir = new URL('../Assets/Scripts/', import.meta.url);
const read = (f) => fs.readFileSync(new URL(f, scriptsDir), 'utf8');
const COMPONENT_FILES = ['WhiteboardCalibrator.ts', 'PaletteController.ts', 'DiagramOverlayView.ts', 'PreviewInputAdapter.ts'];

function createComponentInstance(Cls, sceneObject = new MockSceneObject('TestComponentObj')) {
  const events = {
    OnStartEvent: new MockScriptEvent(),
    UpdateEvent: new MockScriptEvent(),
    OnDestroyEvent: new MockScriptEvent()
  };
  const requested = [];
  const instance = new Cls();
  instance.createEvent = (eventType) => {
    requested.push(eventType);
    if (!events[eventType]) events[eventType] = new MockScriptEvent();
    return events[eventType];
  };
  instance.getSceneObject = () => sceneObject;
  instance.getTransform = () => sceneObject.getTransform();
  instance._testEvents = events;
  instance._requested = requested;
  return instance;
}

function socketStub() {
  const sent = [];
  return {
    sent,
    consumeLatestSpokenPhrase: () => null,
    sendPinchCommand: (action, type, label) => sent.push({ action, type, label }),
    clearLastSentCommand: () => { sent.length = 0; },
    onDiagramUpdated: () => {},
    onDecisionLogged: () => {}
  };
}

function boardWithManipulator() {
  const board = new MockRenderMeshVisual();
  const manipulator = { enableTranslation: false, enableScale: false, enableRotation: true };
  board.sceneObject.getComponents = () => [manipulator];
  return { board, manipulator };
}

describe('Task 48: SpatialInterfaceManager split into focused components', () => {
  let SpatialInterfaceManager, WhiteboardState, WhiteboardCalibrator, PaletteController, DiagramOverlayView, PreviewInputAdapter;
  before(async () => {
    ({ SpatialInterfaceManager, WhiteboardState } = await import('../dist/Assets/Scripts/SpatialInterfaceManager.js'));
    ({ WhiteboardCalibrator } = await import('../dist/Assets/Scripts/WhiteboardCalibrator.js'));
    ({ PaletteController } = await import('../dist/Assets/Scripts/PaletteController.js'));
    ({ DiagramOverlayView } = await import('../dist/Assets/Scripts/DiagramOverlayView.js'));
    ({ PreviewInputAdapter } = await import('../dist/Assets/Scripts/PreviewInputAdapter.js'));
  });
  beforeEach(() => { now = 100; });

  test('AC1: SpatialInterfaceManager.ts is under 300 lines', () => {
    const lines = read('SpatialInterfaceManager.ts').split('\n').length - 1;
    assert.ok(lines < 300, `${lines} lines`);
  });

  test('each new component is a @component with @inputs, and none binds a global TapEvent', () => {
    for (const f of COMPONENT_FILES) {
      const src = read(f);
      assert.match(src, /@component\s+export class \w+ extends BaseScriptComponent/, f);
      assert.match(src, /@input\b/, f);
    }
    for (const f of [...COMPONENT_FILES, 'SpatialInterfaceManager.ts']) {
      assert.equal(/createEvent\(\s*['"]TapEvent['"]/.test(read(f)), false, f);
    }
  });

  test('manager keeps the public API used by tests and LEAF scenarios', () => {
    const api = [
      'pinchCenterToSet', 'selectWhiteboardArea', 'startDrawingAndIngestion', 'triggerAddNode', 'triggerUpdateSnapshot',
      'triggerConcludeMeeting', 'updateDiagramOverlay', 'getWhiteboardState', 'isAreaSelected', 'isCleanBoard',
      'getDiagramStage', 'resetForTest', 'getNodeCount', 'isMeetingConcluded', 'getToastText', 'setToastText',
      'getWhiteboardPosition', 'getWhiteboardScale', 'setWhiteboardPosition', 'setWhiteboardScale', 'dragWhiteboard',
      'resizeWhiteboard', 'enableWhiteboardManipulation', 'disableWhiteboardManipulation', 'configureWhiteboardCollider',
      'toggleWhiteboardResize'
    ];
    for (const name of api) assert.equal(typeof SpatialInterfaceManager.prototype[name], 'function', name);
    assert.equal(new SpatialInterfaceManager().demoMode, false);
    assert.equal(WhiteboardState.SELECT_AREA, 0);
    assert.equal(WhiteboardState.CONCLUDED, 5);
  });

  test('legacy inputs only: OnStart binds snapshot, conclude and whiteboard Interactables through PaletteController', () => {
    const m = createComponentInstance(SpatialInterfaceManager);
    const socket = socketStub();
    const btnSnapshot = new MockPinchButton();
    const btnConclude = new MockPinchButton();
    const board = new MockPinchButton();
    m.socketClient = socket;
    m.diffToastText = new MockText('');
    m.btnUpdateSnapshot = btnSnapshot;
    m.btnConcludeMeeting = btnConclude;
    m.whiteboardInteractable = board;
    m.onAwake();
    m._testEvents.OnStartEvent.trigger();

    board.simulatePinch(); // SELECT_AREA -> lock
    assert.equal(m.getWhiteboardState(), WhiteboardState.CLEAN_BOARD);
    board.simulatePinch(); // CLEAN_BOARD -> drawing
    assert.equal(m.getWhiteboardState(), WhiteboardState.DRAWING_ACTIVE);
    board.simulatePinch(); // drawing -> service node
    btnSnapshot.simulatePinch();
    btnConclude.simulatePinch();
    assert.deepEqual(socket.sent.map((s) => s.action),
      ['CALIBRATE_AREA', 'INGEST_DRAWING', 'ADD_NODE', 'UPDATE_SNAPSHOT', 'CONCLUDE_MEETING']);
    assert.equal(socket.sent[2].type, 'service');
    assert.match(m.diffToastText.text, /Generating spec/);
  });

  test('wired components: their own inputs win over the manager legacy inputs', () => {
    const m = createComponentInstance(SpatialInterfaceManager);
    const view = new DiagramOverlayView();
    const ownToast = new MockText('');
    const legacyToast = new MockText('legacy');
    const ownOverlay = new MockRenderMeshVisual();
    view.toastText = ownToast;
    view.overlayMesh = ownOverlay;
    m.diagramOverlayView = view;
    m.diffToastText = legacyToast;
    m.diagramOverlayMesh = new MockRenderMeshVisual();
    m.demoMode = true;
    m.socketClient = socketStub();
    m.texNodeAdded = new MockTexture(2, 2);

    m.triggerAddNode('decision');
    assert.match(ownToast.text, /Injected \[DECISION\]: "Enforce JWT HMAC Verification"/);
    assert.equal(legacyToast.text, 'legacy');
    assert.equal(ownOverlay.mainMaterial.mainPass.baseTex, view.texNodeAdded);
    assert.equal(m.texNodeAdded, view.texNodeAdded);
    assert.equal(m.getToastText(), ownToast.text);
  });

  test('wired palette: buttons on the component are bound, not duplicated on rebind', () => {
    const m = createComponentInstance(SpatialInterfaceManager);
    const palette = new PaletteController();
    const btn = new MockPinchButton();
    palette.btnAddDatabase = btn;
    m.paletteController = palette;
    m.socketClient = socketStub();
    m.onAwake();
    m._testEvents.OnStartEvent.trigger();
    palette.bind(m); // a second bind must not double-fire
    btn.simulatePinch();
    const adds = m.socketClient.sent.filter((s) => s.action === 'ADD_NODE');
    assert.equal(adds.length, 1);
    assert.equal(adds[0].type, 'database');
  });

  test('Lens path: an unwired component is reused from, else created on, the manager SceneObject', () => {
    const so = new MockSceneObject('SpecScribeControllers');
    const existing = new WhiteboardCalibrator();
    const created = [];
    so.getComponent = (type) => (type === 'WhiteboardCalibrator' ? existing : null);
    so.createComponent = (type) => {
      created.push(type);
      return new ({ DiagramOverlayView, PaletteController, PreviewInputAdapter })[type]();
    };
    const classes = { WhiteboardCalibrator, PaletteController, DiagramOverlayView, PreviewInputAdapter };
    for (const [name, Cls] of Object.entries(classes)) Cls.getTypeName = () => name;
    try {
      const m = createComponentInstance(SpatialInterfaceManager, so);
      m.onAwake();
      m._testEvents.OnStartEvent.trigger();
      assert.equal(m.whiteboardCalibrator, existing);
      assert.deepEqual(created.sort(), ['DiagramOverlayView', 'PaletteController', 'PreviewInputAdapter']);
      assert.ok(m.diagramOverlayView instanceof DiagramOverlayView);
      m.getToastText();
      assert.equal(created.length, 3, 'components are created once');
    } finally {
      for (const Cls of Object.values(classes)) delete Cls.getTypeName;
    }
  });

  test('calibration delegates: drag, resize, presets and lock drive the board via WhiteboardCalibrator', () => {
    const m = createComponentInstance(SpatialInterfaceManager);
    const { board, manipulator } = boardWithManipulator();
    m.whiteboardBoardMesh = board;
    m.diffToastText = new MockText('');
    m.onAwake();
    m._testEvents.OnStartEvent.trigger();

    const start = m.getWhiteboardPosition();
    assert.deepEqual([start.x, start.y, start.z], [50, 185, -230]);
    assert.equal(manipulator.enableTranslation, true);
    assert.equal(manipulator.enableRotation, false);

    m.dragWhiteboard(-20, 5);
    assert.deepEqual([m.getWhiteboardPosition().x, m.getWhiteboardPosition().y], [55, 165]);
    assert.match(m.getToastText(), /Moving Whiteboard: Y = 165.0 cm/);
    m.resizeWhiteboard(120, 80);
    assert.match(m.getToastText(), /Resizing Whiteboard: 120x80 cm/);
    m.toggleWhiteboardResize();
    assert.equal(m.getWhiteboardScale().x, 100); // first toggle goes to the second preset
    assert.equal(m.getWhiteboardScale().z, 64);

    m.pinchCenterToSet();
    assert.equal(m.isAreaSelected(), true);
    assert.equal(manipulator.enableTranslation, false);
    assert.equal(manipulator.enableScale, false);
    assert.match(m.getToastText(), /Whiteboard Area Locked at Y: 165.0cm \(100x64cm\)/);
  });

  test('PreviewInputAdapter: keyboard moves/resizes/locks only while selecting the area', () => {
    const m = createComponentInstance(SpatialInterfaceManager);
    const adapter = createComponentInstance(PreviewInputAdapter);
    m.previewInputAdapter = adapter;
    m.whiteboardBoardMesh = new MockRenderMeshVisual();
    m.diffToastText = new MockText('');
    m.onAwake();
    m._testEvents.OnStartEvent.trigger();
    assert.equal(adapter._requested.includes('TapEvent'), false);
    const key = (k) => adapter._testEvents.KeyPressEvent.trigger({ key: k });

    key('s');
    assert.equal(m.getWhiteboardPosition().y, 179);
    key('d');
    assert.equal(m.getWhiteboardPosition().x, 56);
    key('-');
    assert.deepEqual([m.getWhiteboardScale().x, m.getWhiteboardScale().z], [130, 84]);
    key('Enter');
    assert.equal(m.getWhiteboardState(), WhiteboardState.CLEAN_BOARD);
    key('w');
    assert.equal(m.getWhiteboardPosition().y, 179, 'keyboard ignored once the area is locked');
  });

  test('PreviewInputAdapter: a drag suppresses the next whiteboard pinch; resetForTest clears the guard', () => {
    const m = createComponentInstance(SpatialInterfaceManager);
    const adapter = createComponentInstance(PreviewInputAdapter);
    const board = new MockPinchButton();
    m.previewInputAdapter = adapter;
    m.whiteboardInteractable = board;
    m.whiteboardBoardMesh = new MockRenderMeshVisual();
    m.diffToastText = new MockText('');
    m.onAwake();
    m._testEvents.OnStartEvent.trigger();
    const at = (x, y) => ({ getTouchPosition: () => ({ x, y }) });

    adapter._testEvents.TouchStartEvent.trigger(at(0.5, 0.5));
    adapter._testEvents.TouchMoveEvent.trigger(at(0.5, 0.6));
    assert.equal(m.getWhiteboardPosition().y, 185 - 0.1 * 160);
    adapter._testEvents.TouchEndEvent.trigger(at(0.5, 0.6));
    assert.match(m.getToastText(), /Whiteboard at Y: 169.0 cm/);
    board.simulatePinch(); // release right after the drag
    assert.equal(m.getWhiteboardState(), WhiteboardState.SELECT_AREA);

    now += 1;
    board.simulatePinch();
    assert.equal(m.getWhiteboardState(), WhiteboardState.CLEAN_BOARD);

    m.resetForTest();
    assert.equal(m.getWhiteboardState(), WhiteboardState.SELECT_AREA);
    adapter._testEvents.TouchStartEvent.trigger(at(0.5, 0.5));
    adapter._testEvents.TouchEndEvent.trigger(at(0.5, 0.5)); // centre tap without drag locks the area
    assert.equal(m.getWhiteboardState(), WhiteboardState.CLEAN_BOARD);
  });

  test('DiagramOverlayView: physical hardware hides the board quad; conclude sound plays on the manager object', () => {
    const so = new MockSceneObject('SpecScribeControllers');
    const audio = new MockAudioComponent();
    so.getComponent = (type) => (type === 'Component.AudioComponent' ? audio : null);
    const m = createComponentInstance(SpatialInterfaceManager, so);
    const board = new MockRenderMeshVisual();
    const overlay = new MockRenderMeshVisual();
    m.isPhysicalHardware = true;
    m.demoMode = true;
    m.whiteboardBoardMesh = board;
    m.diagramOverlayMesh = overlay;
    m.diffToastText = new MockText('');
    m.texWhiteboardDrawn = new MockTexture(3, 3);
    m.texConcluded = new MockTexture(4, 4);

    m.triggerConcludeMeeting();
    assert.equal(board.enabled, false);
    assert.equal(board.mainMaterial.mainPass.baseTex, null);
    assert.equal(overlay.mainMaterial.mainPass.baseTex, m.texConcluded);
    assert.equal(audio.playCount, 1);
    assert.equal(m.getDiagramStage(), 3);
    assert.equal(m.getToastText(), 'Meeting Concluded: Technical Spec Generated');
  });

  test('PaletteController label helpers keep the demo/live label contract', async () => {
    const { nodeLabels, fallbackNodeLabel, demoNodeCritique } = await import('../dist/Assets/Scripts/PaletteController.js');
    assert.deepEqual(nodeLabels('service', false, null), { shown: 'Svc Component', sent: null });
    assert.deepEqual(nodeLabels('service', true, null), { shown: 'Auth Gateway Service', sent: 'Auth Gateway Service' });
    assert.deepEqual(nodeLabels('service', false, 'Billing API'), { shown: 'Billing API', sent: 'Billing API' });
    assert.equal(fallbackNodeLabel('Service', true), 'Svc Component', 'demo labels match the exact node type only');
    assert.equal(fallbackNodeLabel('widget', false), 'New widget');
    assert.equal(demoNodeCritique('anything-else').category, 'VULNERABILITY');
    assert.equal(demoNodeCritique('service').category, 'LOGIC_FLAW');
  });
});
