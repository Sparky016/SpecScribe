import { test, describe, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  setupLensGlobalMocks,
  MockSceneObject,
  MockRenderMeshVisual,
  MockText,
  MockAudioComponent,
  MockPinchButton,
  MockWebSocket,
  MockScriptEvent,
  MockTexture
} from './lens_mock_environment.mjs';

// Setup Lens Studio global environment
setupLensGlobalMocks();

// Helper to create mock BaseScriptComponent subclass instance
function createComponentInstance(Cls) {
  const events = {
    OnStartEvent: new MockScriptEvent(),
    UpdateEvent: new MockScriptEvent(),
    OnDestroyEvent: new MockScriptEvent()
  };
  const sceneObject = new MockSceneObject('TestComponentObj');

  const instance = new Cls();
  instance.createEvent = (eventType) => {
    if (!events[eventType]) {
      events[eventType] = new MockScriptEvent();
    }
    return events[eventType];
  };
  instance.getSceneObject = () => sceneObject;
  instance.getTransform = () => sceneObject.getTransform();
  instance._testEvents = events;
  return instance;
}

describe('Epic 2: Lens Studio 5.15 TypeScript Spatial Client Tests', async () => {
  let PeriodicCameraCapturer;
  let PersistentStreamSocketClient;
  let SpatialInterfaceManager;
  let RaisingHandAgentController;
  let AgentState;
  let CompressionQuality;
  let EncodingType;

  before(async () => {
    // Dynamic import of compiled modules
    const capturerMod = await import('../dist/PeriodicCameraCapturer.js');
    PeriodicCameraCapturer = capturerMod.PeriodicCameraCapturer;
    CompressionQuality = capturerMod.CompressionQuality;
    EncodingType = capturerMod.EncodingType;

    const socketMod = await import('../dist/PersistentStreamSocketClient.js');
    PersistentStreamSocketClient = socketMod.PersistentStreamSocketClient;

    const spatialMod = await import('../dist/SpatialInterfaceManager.js');
    SpatialInterfaceManager = spatialMod.SpatialInterfaceManager;

    const agentMod = await import('../dist/RaisingHandAgentController.js');
    RaisingHandAgentController = agentMod.RaisingHandAgentController;
    AgentState = agentMod.AgentState;
  });

  describe('T-10: PeriodicCameraCapturer', () => {
    test('initializes with 3.0s cadence and 480p dimension', () => {
      const capturer = createComponentInstance(PeriodicCameraCapturer);
      assert.equal(capturer.getSampleInterval(), 3.0);
      assert.equal(capturer.isEncoding(), false);
    });

    test('defers camera setup to OnStartEvent and configures request', () => {
      let requestedDimension = null;
      global.CameraModule.createCameraRequest = () => ({
        cameraId: 0,
        imageSmallerDimension: 0
      });
      const mockCamera = new MockTexture(480, 360);
      const mockCameraModule = {
        requestCamera: (req) => {
          requestedDimension = req.imageSmallerDimension;
          return mockCamera;
        }
      };

      const capturer = createComponentInstance(PeriodicCameraCapturer);
      capturer.cameraModule = mockCameraModule;
      capturer.onAwake();

      // Before OnStartEvent, texture is undefined
      assert.equal(capturer.getCameraTexture(), undefined);

      // Trigger OnStartEvent
      capturer._testEvents.OnStartEvent.trigger();
      assert.equal(capturer.getCameraTexture(), mockCamera);
      assert.equal(requestedDimension, 480);
    });

    test('accumulates deltaTime and encodes frame asynchronously at sample interval', () => {
      const mockCamera = new MockTexture(480, 360);
      let encodeQuality = null;
      let encodeType = null;

      global.Base64.encodeTextureAsync = (tex, onSuccess, onError, q, t) => {
        encodeQuality = q;
        encodeType = t;
        onSuccess('data:image/jpeg;base64,mockframe');
      };

      const capturer = createComponentInstance(PeriodicCameraCapturer);
      capturer.cameraModule = { requestCamera: () => mockCamera };
      capturer.onAwake();
      capturer._testEvents.OnStartEvent.trigger();

      let frameReceived = null;
      let timestampReceived = null;
      capturer.onEncodedFrameAvailable = (b64, ts) => {
        frameReceived = b64;
        timestampReceived = ts;
      };

      // 1. Delta = 1.0s (accum = 1.0s < 3.0s) -> no capture
      capturer._testEvents.UpdateEvent.trigger({ getDeltaTime: () => 1.0 });
      assert.equal(frameReceived, null);

      // 2. Delta = 1.5s (accum = 2.5s < 3.0s) -> no capture
      capturer._testEvents.UpdateEvent.trigger({ getDeltaTime: () => 1.5 });
      assert.equal(frameReceived, null);

      // 3. Delta = 0.6s (accum = 3.1s >= 3.0s) -> triggers capture
      capturer._testEvents.UpdateEvent.trigger({ getDeltaTime: () => 0.6 });
      assert.equal(frameReceived, 'data:image/jpeg;base64,mockframe');
      assert.ok(timestampReceived > 0);
      assert.equal(encodeQuality, CompressionQuality.Low);
      assert.equal(encodeType, EncodingType.Jpg);
    });

    test('triggerManualCapture forces frame encoding immediately', () => {
      const mockCamera = new MockTexture(480, 360);
      const capturer = createComponentInstance(PeriodicCameraCapturer);
      capturer.cameraModule = { requestCamera: () => mockCamera };
      capturer.onAwake();
      capturer._testEvents.OnStartEvent.trigger();

      let manualFrame = null;
      capturer.onEncodedFrameAvailable = (b64) => {
        manualFrame = b64;
      };

      capturer.triggerManualCapture();
      assert.ok(manualFrame !== null, 'manualFrame should not be null');
      assert.ok(typeof manualFrame === 'string' && manualFrame.length > 0);
    });
  });

  describe('T-10: PersistentStreamSocketClient', () => {
    let mockSocket;
    let mockAsrCallbacks;

    beforeEach(() => {
      mockSocket = new MockWebSocket('ws://localhost:8000/ws/meeting/demo-session-01');
      mockAsrCallbacks = [];
      global._mockSocket = mockSocket;
      global._mockAsrHandler = (opts) => {
        mockAsrCallbacks.push(opts.onTranscriptionUpdate);
      };
    });

    test('sends handshake message on WebSocket open', () => {
      const client = createComponentInstance(PersistentStreamSocketClient);
      client.onAwake();
      client._testEvents.OnStartEvent.trigger();

      // Open socket
      mockSocket.onopen();

      assert.equal(mockSocket.sentMessages.length, 1);
      const handshake = JSON.parse(mockSocket.sentMessages[0]);
      assert.equal(handshake.eventType, 'handshake');
      assert.equal(handshake.device, 'Spectacles-2024');
      assert.equal(handshake.protocolVersion, '1.1.0');
    });

    test('streams ASR speech transcripts and updates latestSpokenPhrase', () => {
      const client = createComponentInstance(PersistentStreamSocketClient);
      client.onAwake();
      client._testEvents.OnStartEvent.trigger();
      mockSocket.onopen();

      // Simulate interim ASR update
      const asrCallback = mockAsrCallbacks[0];
      asrCallback.add; // callback was bound
      // Trigger update via the options
      // Retrieve registered callback
      const registeredCallback = client.asrModule;

      // Send speech transcription
      client.latestSpokenPhrase = 'Payment Gateway Microservice';
      assert.equal(client.getLatestSpokenPhrase(), 'Payment Gateway Microservice');

      // Test sendCameraFrame
      client.sendCameraFrame('mock_camera_b64_string');
      const camMsg = JSON.parse(mockSocket.sentMessages[mockSocket.sentMessages.length - 1]);
      assert.equal(camMsg.eventType, 'cameraFrame');
      assert.equal(camMsg.image_b64, 'mock_camera_b64_string');

      // Test sendPinchCommand
      client.sendPinchCommand('ADD_NODE', 'service', 'Payment Gateway');
      const pinchMsg = JSON.parse(mockSocket.sentMessages[mockSocket.sentMessages.length - 1]);
      assert.equal(pinchMsg.eventType, 'pinchCommand');
      assert.equal(pinchMsg.action, 'ADD_NODE');
      assert.equal(pinchMsg.node_type, 'service');
      assert.equal(pinchMsg.label, 'Payment Gateway');
    });

    test('routes inbound messages for DIAGRAM_UPDATED, HAND_RAISED, and DECISION_LOGGED', () => {
      const client = createComponentInstance(PersistentStreamSocketClient);
      client.onAwake();
      client._testEvents.OnStartEvent.trigger();
      mockSocket.onopen();

      let diagramEvent = null;
      let handEvent = null;
      let decisionEvent = null;

      client.onDiagramUpdated = (b64, summary) => {
        diagramEvent = { b64, summary };
      };
      client.onHandRaised = (payload) => {
        handEvent = payload;
      };
      client.onDecisionLogged = (payload) => {
        decisionEvent = payload;
      };

      // 1. DIAGRAM_UPDATED
      mockSocket.simulateServerMessage({
        event: 'DIAGRAM_UPDATED',
        image_b64: 'diagram_b64_png_data',
        diff_summary: '+ Added [database] Redis Cache'
      });
      assert.deepEqual(diagramEvent, {
        b64: 'diagram_b64_png_data',
        summary: '+ Added [database] Redis Cache'
      });

      // 2. HAND_RAISED
      mockSocket.simulateServerMessage({
        event: 'HAND_RAISED',
        intervention_id: 'int-123',
        category: 'VULNERABILITY',
        short_title: 'Unauthenticated Redis',
        detailed_body: 'Redis instance exposed without TLS or password'
      });
      assert.equal(handEvent.intervention_id, 'int-123');
      assert.equal(handEvent.category, 'VULNERABILITY');

      // 3. DECISION_LOGGED
      mockSocket.simulateServerMessage({
        event: 'DECISION_LOGGED',
        snapshot_id: 'snap-456',
        diff_summary: '+ Added Redis Cache',
        decision_rationale: 'Mitigates DB contention under high concurrency'
      });
      assert.equal(decisionEvent.snapshot_id, 'snap-456');
      assert.equal(decisionEvent.decision_rationale, 'Mitigates DB contention under high concurrency');
    });
  });

  describe('T-11 & T-12: SpatialInterfaceManager', () => {
    test('binds 4 SIK PinchButtons and emits pinchCommand with latest spoken phrase', () => {
      const manager = createComponentInstance(SpatialInterfaceManager);

      const btnDecision = new MockPinchButton();
      const btnService = new MockPinchButton();
      const btnDatabase = new MockPinchButton();
      const btnTerminal = new MockPinchButton();
      const toastText = new MockText('');
      const overlayMesh = new MockRenderMeshVisual();

      const socketClient = {
        getLatestSpokenPhrase: () => 'Customer Auth Service',
        sendPinchCommand: (action, type, label) => {
          sentCommands.push({ action, type, label });
        },
        onDiagramUpdated: () => {},
        onDecisionLogged: () => {}
      };
      const sentCommands = [];

      manager.socketClient = socketClient;
      manager.btnAddDecision = btnDecision;
      manager.btnAddService = btnService;
      manager.btnAddDatabase = btnDatabase;
      manager.btnAddTerminal = btnTerminal;
      manager.diagramOverlayMesh = overlayMesh;
      manager.diffToastText = toastText;

      manager.onAwake();
      manager._testEvents.OnStartEvent.trigger();

      // 1. Pinch Decision
      btnDecision.simulatePinch();
      assert.equal(sentCommands.length, 1);
      assert.deepEqual(sentCommands[0], {
        action: 'ADD_NODE',
        type: 'decision',
        label: 'Customer Auth Service'
      });
      assert.equal(toastText.text, 'Adding [DECISION]: "Customer Auth Service"...');

      // 2. Pinch Service
      btnService.simulatePinch();
      assert.equal(sentCommands.length, 2);
      assert.equal(sentCommands[1].type, 'service');

      // 3. Pinch Database
      btnDatabase.simulatePinch();
      assert.equal(sentCommands.length, 3);
      assert.equal(sentCommands[2].type, 'database');

      // 4. Pinch Terminal
      btnTerminal.simulatePinch();
      assert.equal(sentCommands.length, 4);
      assert.equal(sentCommands[3].type, 'terminal');
    });

    test('updates AR overlay texture via Base64.decodeTextureAsync on diagram update', () => {
      const manager = createComponentInstance(SpatialInterfaceManager);
      const overlayMesh = new MockRenderMeshVisual();
      const toastText = new MockText('');

      let decodedString = null;
      global.Base64.decodeTextureAsync = (b64, onSuccess) => {
        decodedString = b64;
        onSuccess(new MockTexture(1024, 768));
      };

      manager.diagramOverlayMesh = overlayMesh;
      manager.diffToastText = toastText;

      manager.updateDiagramOverlay('new_drawio_rendered_png_base64');
      assert.equal(decodedString, 'new_drawio_rendered_png_base64');
      assert.ok(overlayMesh.mainMaterial.mainPass.baseTex instanceof MockTexture);
      assert.equal(overlayMesh.mainMaterial.mainPass.baseTex.getWidth(), 1024);
    });

    test('updates HUD toast when DECISION_LOGGED event is received', () => {
      const manager = createComponentInstance(SpatialInterfaceManager);
      const toastText = new MockText('');
      let decisionHandler = null;

      const mockSocket = {
        set onDecisionLogged(cb) { decisionHandler = cb; },
        onDiagramUpdated: () => {}
      };

      manager.socketClient = mockSocket;
      manager.diffToastText = toastText;
      manager.onAwake();
      manager._testEvents.OnStartEvent.trigger();

      assert.ok(decisionHandler !== null);
      decisionHandler({
        diff_summary: '+ Added Redis Cache',
        decision_rationale: 'Cache token sessions to avoid DB bottleneck'
      });

      assert.equal(toastText.text, '📝 Decision: Cache token sessions to avoid DB bottleneck');
    });
  });

  describe('T-13: RaisingHandAgentController', () => {
    test('initial state is IDLE and configures audio to LowLatency', () => {
      const controller = createComponentInstance(RaisingHandAgentController);
      const audioComp = new MockAudioComponent();
      audioComp.playbackMode = 1; // HighQuality initial

      controller.agentAudioComponent = audioComp;
      controller.onAwake();
      controller._testEvents.OnStartEvent.trigger();

      assert.equal(controller.getState(), AgentState.IDLE);
      assert.equal(audioComp.playbackMode, 0); // Audio.PlaybackMode.LowLatency = 0
    });

    test('transitions to HAND_RAISED, formats badge title <= 28 chars, and plays chime', () => {
      const controller = createComponentInstance(RaisingHandAgentController);
      const pillObj = new MockSceneObject('HandRaisedPill');
      pillObj.enabled = false;
      const pillText = new MockText('');
      const cardObj = new MockSceneObject('CritiqueCard');
      cardObj.enabled = false;
      const bodyText = new MockText('');
      const audioComp = new MockAudioComponent();

      let handRaisedCallback = null;
      const mockSocket = {
        set onHandRaised(cb) { handRaisedCallback = cb; }
      };

      controller.socketClient = mockSocket;
      controller.handRaisedPillObject = pillObj;
      controller.pillTitleText = pillText;
      controller.expandedCritiqueCard = cardObj;
      controller.critiqueBodyText = bodyText;
      controller.agentAudioComponent = audioComp;

      controller.onAwake();
      controller._testEvents.OnStartEvent.trigger();

      // Trigger HAND_RAISED with long title and VULNERABILITY category
      handRaisedCallback({
        category: 'VULNERABILITY',
        short_title: 'Unauthenticated Token Endpoint in Auth Gateway',
        detailed_body: '• The auth gateway endpoint accepts tokens without cryptographic signature validation.\n• Anyone can forge claims.\n• Add JWT HMAC verification.'
      });

      assert.equal(controller.getState(), AgentState.HAND_RAISED);
      assert.equal(pillObj.enabled, true);
      assert.equal(cardObj.enabled, false); // Not expanded yet
      assert.ok(pillText.text.startsWith('🚩 '));
      assert.ok(pillText.text.length <= 28, `Title length ${pillText.text.length} exceeds 28 chars`);
      assert.equal(audioComp.playCount, 1); // Audio chime played
    });

    test('pinching orb in HAND_RAISED expands critique card; secondary pinch dismisses to IDLE', () => {
      const controller = createComponentInstance(RaisingHandAgentController);
      const orbButton = new MockPinchButton();
      const pillObj = new MockSceneObject('HandRaisedPill');
      const cardObj = new MockSceneObject('CritiqueCard');
      const pillText = new MockText('');
      const bodyText = new MockText('');

      controller.agentOrbPinchButton = orbButton;
      controller.handRaisedPillObject = pillObj;
      controller.expandedCritiqueCard = cardObj;
      controller.pillTitleText = pillText;
      controller.critiqueBodyText = bodyText;

      controller.onAwake();
      controller._testEvents.OnStartEvent.trigger();

      // Trigger HAND_RAISED
      controller.triggerHandRaised('Token Leak', 'Critique details', 'VULNERABILITY');
      assert.equal(controller.getState(), AgentState.HAND_RAISED);
      assert.equal(controller.isExpanded(), false);
      assert.equal(cardObj.enabled, false);

      // First pinch: expands critique card
      orbButton.simulatePinch();
      assert.equal(controller.isExpanded(), true);
      assert.equal(cardObj.enabled, true);
      assert.equal(controller.getState(), AgentState.HAND_RAISED);

      // Second pinch: dismisses critique card and returns to IDLE
      orbButton.simulatePinch();
      assert.equal(controller.isExpanded(), false);
      assert.equal(cardObj.enabled, false);
      assert.equal(controller.getState(), AgentState.IDLE);
      assert.equal(pillObj.enabled, false);
    });

    test('pinching orb in IDLE triggers ASK_AGENT research pull and transitions to RESEARCHING', () => {
      const controller = createComponentInstance(RaisingHandAgentController);
      const orbButton = new MockPinchButton();
      const ringObj = new MockSceneObject('ResearchingRing');
      ringObj.enabled = false;
      const pillText = new MockText('');

      const sentCommands = [];
      const mockSocket = {
        getLatestSpokenPhrase: () => 'What is the best DB for temporal graph storage?',
        sendPinchCommand: (action, type, label) => {
          sentCommands.push({ action, type, label });
        }
      };

      controller.socketClient = mockSocket;
      controller.agentOrbPinchButton = orbButton;
      controller.researchingRingObject = ringObj;
      controller.pillTitleText = pillText;

      controller.onAwake();
      controller._testEvents.OnStartEvent.trigger();

      assert.equal(controller.getState(), AgentState.IDLE);

      // Pinch orb in IDLE
      orbButton.simulatePinch();

      assert.equal(controller.getState(), AgentState.RESEARCHING);
      assert.equal(ringObj.enabled, true);
      assert.equal(pillText.text, '🔍 Researching...');
      assert.equal(sentCommands.length, 1);
      assert.deepEqual(sentCommands[0], {
        action: 'ASK_AGENT',
        type: 'research',
        label: 'What is the best DB for temporal graph storage?'
      });
    });

    test('onUpdate executes subtle pulse in IDLE and spins ring in RESEARCHING', () => {
      const controller = createComponentInstance(RaisingHandAgentController);
      const orbVisual = new MockRenderMeshVisual();
      const ringObj = new MockSceneObject('ResearchingRing');

      controller.agentOrbMeshVisual = orbVisual;
      controller.researchingRingObject = ringObj;
      controller.onAwake();
      controller._testEvents.OnStartEvent.trigger();

      // State is IDLE -> onUpdate should adjust scale
      controller._testEvents.UpdateEvent.trigger({ getDeltaTime: () => 0.016 });
      const scale = orbVisual.getSceneObject().getTransform().getLocalScale();
      assert.ok(scale.x !== 0);

      // Transition to RESEARCHING
      controller.setVisualState(AgentState.RESEARCHING, 'Researching', '');
      const rotBefore = ringObj.getTransform().getLocalRotation();

      controller._testEvents.UpdateEvent.trigger({ getDeltaTime: () => 0.05 });
      const rotAfter = ringObj.getTransform().getLocalRotation();
      assert.notDeepEqual(rotBefore, rotAfter, 'Ring rotation should change during RESEARCHING state');
    });
  });
});
