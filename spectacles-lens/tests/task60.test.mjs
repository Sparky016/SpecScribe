import { test, describe, before, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  setupLensGlobalMocks,
  MockSceneObject,
  MockText,
  MockAudioComponent,
  MockPinchButton,
  MockScriptEvent,
  MockBaseScriptComponent
} from './lens_mock_environment.mjs';

setupLensGlobalMocks();
global.BaseScriptComponent = MockBaseScriptComponent;
global.allowUndefined = () => {};

const CONTROLLER_SOURCE = new URL('../Assets/Scripts/RaisingHandAgentController.ts', import.meta.url);

function createComponentInstance(Cls) {
  const events = {
    OnStartEvent: new MockScriptEvent(),
    UpdateEvent: new MockScriptEvent(),
    OnDestroyEvent: new MockScriptEvent(),
    DelayedCallbackEvent: new MockScriptEvent()
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

describe('Task 60: Spoken Audio / TTS Readout for Raising-Hand AI Assistant Orb & Unicode Regex Fallback', () => {
  let RaisingHandAgentController;
  let AgentState;
  const OriginalRegExp = global.RegExp;

  before(async () => {
    const mod = await import('../dist/Assets/Scripts/RaisingHandAgentController.js');
    RaisingHandAgentController = mod.RaisingHandAgentController;
    AgentState = mod.AgentState;
  });

  afterEach(() => {
    global.RegExp = OriginalRegExp;
    delete global.Base64.decodeAudioAsync;
  });

  describe('AC1: Runtime-guarded RegExp for emoji stripping in formatPillText()', () => {
    test('source file uses runtime new RegExp inside try/catch with surrogate-pair fallback (no literal \\p{Extended_Pictographic})', () => {
      const src = fs.readFileSync(CONTROLLER_SOURCE, 'utf8');
      assert.equal(
        /\/\^\(\\p\{Extended_Pictographic\}/.test(src),
        false,
        'Literal /\\p{Extended_Pictographic}/u regex must not exist in source'
      );
      assert.match(
        src,
        /new RegExp\('\^\(\\\\p\{Extended_Pictographic\}\\\\uFE0F\?\\\\s\*\)\+',\s*'u'\)/,
        'Must construct Unicode property escape regex at runtime via new RegExp'
      );
      assert.match(
        src,
        /\[\^?\\uD800-\\uDBFF\]\[\\uDC00-\\uDFFF\]\|\\u26A0\\uFE0F\?\|\\s/,
        'Must include surrogate-pair and warning-sign fallback regex'
      );
    });

    test('formatPillText() strips leading emojis and applies category icon on engines supporting \\p{Extended_Pictographic}', () => {
      const controller = createComponentInstance(RaisingHandAgentController);
      assert.equal(
        controller.formatPillText('⚠️ Auth Token Leak Risk', 'VULNERABILITY'),
        '🚩 Auth Token Leak Risk'
      );
      assert.equal(
        controller.formatPillText('🚩 Single DB SPOF', 'LOGIC_FLAW'),
        '⚠️ Single DB SPOF'
      );
      assert.equal(
        controller.formatPillText('💡 Use Event Sourcing'),
        'Use Event Sourcing'
      );
    });

    test('formatPillText() and triggerHandRaised() fall back cleanly when RegExp throws SyntaxError on \\p{Extended_Pictographic}', () => {
      // Simulate an embedded JS engine that throws SyntaxError on \p{Extended_Pictographic}
      function LegacyRegExp(pattern, flags) {
        if (typeof pattern === 'string' && pattern.includes('\\p{Extended_Pictographic}')) {
          throw new SyntaxError('Invalid regular expression: unicode property escapes not supported');
        }
        return new OriginalRegExp(pattern, flags);
      }
      LegacyRegExp.prototype = OriginalRegExp.prototype;
      global.RegExp = LegacyRegExp;

      const controller = createComponentInstance(RaisingHandAgentController);
      const pillText = new MockText('');
      controller.pillTitleText = pillText;
      controller.agentAudioComponent = new MockAudioComponent();
      controller.onAwake();
      controller._testEvents.OnStartEvent.trigger();

      // 1. Surrogate pair emoji (🚩 = \uD83D\uDEA9) stripped via fallback
      assert.equal(
        controller.formatPillText('🚩 Cache Stampede Risk', 'VULNERABILITY'),
        '🚩 Cache Stampede Risk'
      );

      // 2. Warning sign (\u26A0\uFE0F) stripped and replaced with category icon
      assert.equal(
        controller.formatPillText('⚠️ Missing Rate Limiter', 'VULNERABILITY'),
        '🚩 Missing Rate Limiter'
      );

      // 3. Direct strip without category
      assert.equal(
        controller.formatPillText('💡 Consider Read Replicas'),
        'Consider Read Replicas'
      );

      // 4. End-to-end triggerHandRaised under legacy JS engine never throws
      assert.doesNotThrow(() => {
        controller.triggerHandRaised('⚠️ Token Replay Vulnerability', '• Add nonce validation', 'VULNERABILITY');
      });
      assert.equal(pillText.text, '🚩 Token Replay Vulnerability');
    });
  });

  describe('AC2: Pinching orb in HAND_RAISED state expands critique card and triggers voice/audio playback via AgentVoicePlayer', () => {
    test('pinching orb in HAND_RAISED plays decoded audio_b64 clip on voiceAudioComponent and expands critique card', () => {
      const controller = createComponentInstance(RaisingHandAgentController);
      const orbButton = new MockPinchButton();
      const pillObj = new MockSceneObject('HandRaisedPill');
      const cardObj = new MockSceneObject('ExpandedCritiqueCard');
      cardObj.enabled = false;
      const pillText = new MockText('');
      const bodyText = new MockText('');
      const chimeAudio = new MockAudioComponent();
      const voiceAudio = new MockAudioComponent();

      let handRaisedCallback = null;
      controller.socketClient = {
        set onHandRaised(cb) {
          handRaisedCallback = cb;
        }
      };
      controller.agentOrbPinchButton = orbButton;
      controller.handRaisedPillObject = pillObj;
      controller.expandedCritiqueCard = cardObj;
      controller.pillTitleText = pillText;
      controller.critiqueBodyText = bodyText;
      controller.agentAudioComponent = chimeAudio;
      controller.voiceAudioComponent = voiceAudio;

      controller.onAwake();
      controller._testEvents.OnStartEvent.trigger();

      // 1. Receive HAND_RAISED with spoken_summary and audio_b64
      handRaisedCallback({
        category: 'VULNERABILITY',
        short_title: '🚩 Cache Stampede Risk',
        detailed_body: '• High-concurrency cache misses overload PostgreSQL.\n• Add mutex lock on cache miss.',
        spoken_summary: 'Cache Stampede Risk: Add mutex lock on Redis cache miss to protect PostgreSQL.',
        audio_b64: 'UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA='
      });

      assert.equal(controller.getState(), AgentState.HAND_RAISED);
      assert.equal(controller.getSpokenSummary(), 'Cache Stampede Risk: Add mutex lock on Redis cache miss to protect PostgreSQL.');
      assert.equal(controller.getAudioB64(), 'UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=');
      assert.equal(chimeAudio.playCount, 1, 'Initial hand raise plays notification chime');
      assert.equal(voiceAudio.playCount, 0, 'Voice readout has not played before orb pinch');
      assert.equal(cardObj.enabled, false);

      // 2. Pinch orb in HAND_RAISED state -> expands card and plays voice clip on voiceAudioComponent
      controller._testEvents.UpdateEvent.trigger({ getDeltaTime: () => 0.5 });
      orbButton.simulatePinch();

      assert.equal(controller.isExpanded(), true);
      assert.equal(cardObj.enabled, true);
      assert.equal(voiceAudio.playCount, 1, 'AgentVoicePlayer should play synthesized voice audio on pinch');
      assert.ok(voiceAudio.audioTrack, 'Decoded voice audio track should be assigned to voiceAudioComponent');
      assert.equal(
        voiceAudio.audioTrack.audio_b64,
        'UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA='
      );
      assert.equal(controller.getLastPlayedAudioB64(), 'UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=');

      // 3. Second pinch collapses critique card and returns to IDLE
      controller._testEvents.UpdateEvent.trigger({ getDeltaTime: () => 0.5 });
      orbButton.simulatePinch();
      assert.equal(controller.isExpanded(), false);
      assert.equal(cardObj.enabled, false);
      assert.equal(controller.getState(), AgentState.IDLE);
    });

    test('pinching orb in HAND_RAISED without audio_b64 falls back cleanly to notification chime on AgentVoicePlayer', () => {
      const controller = createComponentInstance(RaisingHandAgentController);
      const orbButton = new MockPinchButton();
      const cardObj = new MockSceneObject('ExpandedCritiqueCard');
      cardObj.enabled = false;
      const voiceAudio = new MockAudioComponent();

      controller.agentOrbPinchButton = orbButton;
      controller.expandedCritiqueCard = cardObj;
      controller.voiceAudioComponent = voiceAudio;

      controller.onAwake();
      controller._testEvents.OnStartEvent.trigger();

      controller.triggerHandRaised('⚡ Single Point of Failure', '• Add read replica.', 'LOGIC_FLAW');
      assert.equal(controller.getState(), AgentState.HAND_RAISED);
      assert.equal(voiceAudio.playCount, 1);

      // Pinch orb to expand critique card -> fallback chime plays on voiceAudioComponent
      controller._testEvents.UpdateEvent.trigger({ getDeltaTime: () => 0.5 });
      orbButton.simulatePinch();

      assert.equal(controller.isExpanded(), true);
      assert.equal(cardObj.enabled, true);
      assert.equal(voiceAudio.playCount, 2, 'Fallback chime should play when expanding critique card without audio_b64');
    });
  });
});
