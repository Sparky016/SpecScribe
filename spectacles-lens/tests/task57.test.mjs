import { test, describe, before, beforeEach } from 'node:test';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {
  setupLensGlobalMocks,
  MockSceneObject,
  MockScriptEvent,
  MockWebSocket,
  MockBaseScriptComponent
} from './lens_mock_environment.mjs';

setupLensGlobalMocks();
global.BaseScriptComponent = MockBaseScriptComponent;
global.allowUndefined = () => {};

function createComponentInstance(Cls) {
  const events = {
    OnStartEvent: new MockScriptEvent(),
    UpdateEvent: new MockScriptEvent(),
    OnDestroyEvent: new MockScriptEvent()
  };
  const sceneObject = new MockSceneObject('TestComponentObj');
  const instance = new Cls();
  instance.createEvent = (eventType) => {
    if (!events[eventType]) events[eventType] = new MockScriptEvent();
    return events[eventType];
  };
  instance.getSceneObject = () => sceneObject;
  instance.getTransform = () => sceneObject.getTransform();
  instance._testEvents = events;
  return instance;
}

const clientPath = new URL('../Assets/Scripts/PersistentStreamSocketClient.ts', import.meta.url);

describe('Task 57: Multi-Speaker Diarization & Utterance Gap Metadata in PersistentStreamSocketClient', () => {
  let PersistentStreamSocketClient;
  let mockSocket;
  let asrOptions;

  before(async () => {
    ({ PersistentStreamSocketClient } = await import('../dist/Assets/Scripts/PersistentStreamSocketClient.js'));
  });

  beforeEach(() => {
    mockSocket = new MockWebSocket('ws://localhost:8000/ws/meeting/00000000-0000-4000-8000-000000000d0e');
    asrOptions = null;
    global._mockSocket = mockSocket;
    global._mockAsrHandler = (opts) => { asrOptions = opts; };
  });

  function startClient() {
    const client = createComponentInstance(PersistentStreamSocketClient);
    client.onAwake();
    client._testEvents.OnStartEvent.trigger();
    mockSocket.onopen();
    return client;
  }

  function asrMessages() {
    return mockSocket.sentMessages
      .map((m) => JSON.parse(m))
      .filter((m) => m.eventType === 'asrTranscription');
  }

  test('AC2: ASR final turns emit speaker_label="auto", silenceGapMs, silenceDurationMs, and turnIndex instead of hardcoded Speaker 0 (Wearer)', () => {
    startClient();
    const realDateNow = Date.now;
    let fakeNow = 100000;
    Date.now = () => fakeNow;

    try {
      // First final utterance at t=100000
      for (const cb of asrOptions._callbacks) {
        cb({ text: 'What database should we use for session state?', isFinal: true });
      }

      // Second final utterance 3400ms later at t=103400
      fakeNow = 103400;
      for (const cb of asrOptions._callbacks) {
        cb({ text: 'Let us use Redis Cluster with read replicas.', isFinal: true });
      }

      const sent = asrMessages();
      assert.equal(sent.length, 2);

      assert.equal(sent[0].speaker_label, 'auto');
      assert.equal(sent[0].silenceGapMs, 0);
      assert.equal(sent[0].silenceDurationMs, 0);
      assert.equal(sent[0].turnIndex, 0);
      assert.equal(sent[0].transcript_text, 'What database should we use for session state?');

      assert.equal(sent[1].speaker_label, 'auto');
      assert.equal(sent[1].silenceGapMs, 3400);
      assert.equal(sent[1].silenceDurationMs, 3400);
      assert.equal(sent[1].turnIndex, 1);
      assert.equal(sent[1].transcript_text, 'Let us use Redis Cluster with read replicas.');
    } finally {
      Date.now = realDateNow;
    }
  });

  test('AC3: Explicit speaker labels passed via sendSimulatedVoiceNote or ASR eventArgs are preserved unchanged', () => {
    const client = startClient();

    client.sendSimulatedVoiceNote('We need mutual TLS between services.', 'Speaker 1 (Architect)');
    client.sendSimulatedVoiceNote('Adding Auth Gateway node.', 'Speaker 0 (Wearer)');
    client.sendSimulatedVoiceNote('What about rate limiting?'); // no speaker -> defaults to 'auto'

    // Also verify eventArgs with explicit speaker property
    for (const cb of asrOptions._callbacks) {
      cb({ text: 'Calibrated voice turn', isFinal: true, speaker: 'Speaker 2 (Security)' });
    }

    const sent = asrMessages();
    assert.equal(sent.length, 4);
    assert.equal(sent[0].speaker_label, 'Speaker 1 (Architect)');
    assert.equal(sent[0].transcript_text, 'We need mutual TLS between services.');
    assert.equal(sent[1].speaker_label, 'Speaker 0 (Wearer)');
    assert.equal(sent[1].transcript_text, 'Adding Auth Gateway node.');
    assert.equal(sent[2].speaker_label, 'auto');
    assert.equal(sent[2].transcript_text, 'What about rate limiting?');
    assert.equal(sent[3].speaker_label, 'Speaker 2 (Security)');
    assert.equal(sent[3].transcript_text, 'Calibrated voice turn');
  });

  test('PersistentStreamSocketClient.ts does not hardcode speaker_label to Speaker 0 (Wearer)', () => {
    const src = fs.readFileSync(clientPath, 'utf-8');
    assert.doesNotMatch(src, /speaker_label:\s*['"]Speaker 0 \(Wearer\)['"]/);
  });
});
