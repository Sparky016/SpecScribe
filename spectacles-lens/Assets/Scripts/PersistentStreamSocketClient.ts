import { PeriodicCameraCapturer } from './PeriodicCameraCapturer';

@component
export class PersistentStreamSocketClient extends BaseScriptComponent {
  // Preview default. On device, set to the deployed Cloud Run wss base (no trailing slash) in the Inspector.
  @input
  private backendWsBase: string = 'ws://localhost:8000';

  // Must be a UUID. Default is the backend demo meeting UUID (DEMO_MEETING_UUID in backend/session_manager.py).
  @input
  private meetingId: string = '00000000-0000-4000-8000-000000000d0e';

  // Placeholder only: set the SPECSCRIBE_API_TOKEN value in the Lens Studio Inspector. Never commit a real token here.
  @input
  private apiToken: string = '';

  @input
  @allowUndefined
  private cameraCapturer?: PeriodicCameraCapturer;

  @input
  @allowUndefined
  private simulatedSpeechPhrase?: string;

  private internetModule: InternetModule = require('LensStudio:InternetModule');
  private asrModule: AsrModule = require('LensStudio:AsrModule');
  private activeSocket?: WebSocket;
  private meetingStartEpochMs: number = 0;
  private latestSpokenPhrase: string = 'New Component';
  private pendingFinalPhrase: string | null = null;
  private isDestroyed: boolean = false;
  private reconnectAttempt: number = 0;
  private reconnectEvent: DelayedCallbackEvent | null = null;
  private websocketUrl: string = '';
  private lastSentCommand: Record<string, any> | null = null;

  public onDiagramUpdated: (imageB64: string, diffSummary: string) => void = () => {};
  public onHandRaised: (payload: any) => void = () => {};
  public onDecisionLogged: (payload: any) => void = () => {};
  public onMeetingFinalized: (payload: any) => void = () => {};

  onAwake(): void {
    this.createEvent('OnStartEvent').bind(() => {
      this.websocketUrl = this.buildWebsocketUrl();
      if (!this.websocketUrl) {
        print('[PersistentStreamSocketClient] onStart failed: required inputs backendWsBase or meetingId are empty; socket cannot connect.');
      }
      if (!this.apiToken) {
        print('[PersistentStreamSocketClient] apiToken input is empty; a backend with auth enabled will reject the handshake.');
      }
      this.meetingStartEpochMs = Date.now();
      this.initializeWebSocket();
      this.initializeAsrStream();
      this.bindCameraCapturer();
    });

    this.createEvent('OnDestroyEvent').bind(() => {
      this.cleanup();
    });
  }

  public getLatestSpokenPhrase(): string {
    if (this.latestSpokenPhrase && this.latestSpokenPhrase !== 'New Component') {
      return this.latestSpokenPhrase;
    }
    return this.simulatedSpeechPhrase ?? '';
  }

  /**
   * Returns the latest FINAL ASR phrase spoken since the previous call, then clears it.
   * Returns null when no new final phrase exists, so each pinch consumes at most one phrase.
   */
  public consumeLatestSpokenPhrase(): string | null {
    const phrase = this.pendingFinalPhrase;
    this.pendingFinalPhrase = null;
    return phrase;
  }

  /** Returns the last pinchCommand payload handed to the socket (recorded even when the socket is not open), or null. */
  public getLastSentCommand(): Record<string, any> | null {
    return this.lastSentCommand;
  }

  /** Test hook: forgets the last sent command and any unconsumed final phrase. */
  public clearLastSentCommand(): void {
    this.lastSentCommand = null;
    this.pendingFinalPhrase = null;
  }

  public getElapsedMs(): number {
    return Math.max(0, Date.now() - this.meetingStartEpochMs);
  }

  public isConnected(): boolean {
    return !!this.activeSocket && this.activeSocket.readyState === 1;
  }

  public getWebsocketUrl(): string {
    return this.websocketUrl;
  }

  /**
   * Composes the socket URL from backendWsBase, meetingId and the URI-encoded apiToken. Returns '' when base or meeting ID is empty.
   */
  private buildWebsocketUrl(): string {
    if (!this.backendWsBase || !this.meetingId) {
      return '';
    }
    return `${this.backendWsBase}/ws/meeting/${this.meetingId}?token=${encodeURIComponent(this.apiToken ?? '')}`;
  }

  /**
   * Socket URL without its query string, so the API token never reaches logs.
   */
  private redactedWebsocketUrl(): string {
    return (this.websocketUrl ?? '').split('?')[0];
  }

  /**
   * Masks the API token (raw and URI-encoded) and any token= query value in an error message before it is logged.
   */
  private redactSecrets(text: string): string {
    let out = text;
    for (const secret of [this.apiToken, encodeURIComponent(this.apiToken ?? '')]) {
      if (secret) {
        out = out.split(secret).join('<redacted>');
      }
    }
    return out.replace(/([?&]token=)[^&\s]*/g, '$1<redacted>');
  }

  public setWebsocketUrl(url: string): void {
    this.websocketUrl = url;
    if (this.activeSocket) {
      this.retireActiveSocket();
      this.initializeWebSocket();
    }
  }

  /**
   * Detaches handlers from the current socket before closing it, so its onclose cannot schedule a reconnect.
   */
  private retireActiveSocket(): void {
    const socket = this.activeSocket;
    if (!socket) {
      return;
    }
    socket.onopen = null;
    socket.onmessage = null;
    socket.onerror = null;
    socket.onclose = null;
    socket.close();
  }

  private isSocketOpenOrConnecting(): boolean {
    return !!this.activeSocket && (this.activeSocket.readyState === 0 || this.activeSocket.readyState === 1);
  }

  private initializeWebSocket(): void {
    if (this.isDestroyed) {
      return;
    }

    try {
      this.activeSocket = this.internetModule.createWebSocket(this.websocketUrl);
      this.activeSocket.binaryType = 'blob';

      this.activeSocket.onopen = () => {
        print(`[PersistentStreamSocketClient] Connected to ${this.redactedWebsocketUrl()}`);
        this.reconnectAttempt = 0;
        if (this.reconnectEvent) {
          try {
            this.reconnectEvent.cancel();
          } catch (e) {
            print(`[PersistentStreamSocketClient] onopen reconnect cancel failed: ${this.redactSecrets(String(e))}`);
          }
        }
        this.sendJson({
          eventType: 'handshake',
          device: 'Spectacles-2024',
          protocolVersion: '1.1.0',
          timestamp_ms: 0
        });
      };

      this.activeSocket.onmessage = async (event: WebSocketMessageEvent) => {
        if (typeof event.data === 'string') {
          this.routeInboundJson(event.data);
        }
      };

      this.activeSocket.onerror = () => {
        print('[PersistentStreamSocketClient] WebSocket error encountered.');
      };

      this.activeSocket.onclose = () => {
        print('[PersistentStreamSocketClient] WebSocket closed.');
        this.scheduleReconnect();
      };
    } catch (e) {
      print(`[PersistentStreamSocketClient] initializeWebSocket failed: ${this.redactSecrets(String(e))}`);
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (this.isDestroyed || this.isSocketOpenOrConnecting()) {
      return;
    }
    const delaySec = Math.min(10.0, 2.0 * Math.pow(1.5, this.reconnectAttempt));
    this.reconnectAttempt++;
    print(`[PersistentStreamSocketClient] Scheduling reconnect in ${delaySec.toFixed(1)}s (attempt ${this.reconnectAttempt})...`);

    if (!this.reconnectEvent) {
      this.reconnectEvent = this.createEvent('DelayedCallbackEvent');
      this.reconnectEvent.bind(() => {
        if (!this.isSocketOpenOrConnecting() && !this.isDestroyed) {
          print('[PersistentStreamSocketClient] Attempting WebSocket reconnect via DelayedCallbackEvent...');
          this.initializeWebSocket();
        }
      });
    }
    this.reconnectEvent.reset(delaySec);
  }

  private routeInboundJson(rawJson: string): void {
    try {
      const msg = JSON.parse(rawJson);
      if (msg.event === 'DIAGRAM_UPDATED') {
        this.onDiagramUpdated(msg.image_b64, msg.diff_summary);
      } else if (msg.event === 'HAND_RAISED') {
        this.onHandRaised(msg);
      } else if (msg.event === 'DECISION_LOGGED') {
        this.onDecisionLogged(msg);
      } else if (msg.event === 'MEETING_FINALIZED') {
        this.onMeetingFinalized(msg);
      } else if (msg.event === 'COMMAND_ACK') {
        // Client-only actions are acknowledged by the backend; nothing to do.
      } else if (msg.event === 'COMMAND_ERROR') {
        print(`[PersistentStreamSocketClient] Command error (${msg.action}): ${msg.message}`);
      }
    } catch (e) {
      print(`[PersistentStreamSocketClient] routeInboundJson failed: ${this.redactSecrets(String(e))}`);
    }
  }

  private initializeAsrStream(): void {
    try {
      const asrOptions = AsrModule.AsrTranscriptionOptions.create();
      asrOptions.mode = AsrModule.AsrMode.HighSpeed;
      asrOptions.silenceUntilTerminationMs = 1000;

      asrOptions.onTranscriptionUpdateEvent.add((eventArgs: AsrModule.TranscriptionUpdateEvent) => {
        if (eventArgs.text && eventArgs.text.trim().length > 0) {
          this.latestSpokenPhrase = eventArgs.text.trim();
          if (eventArgs.isFinal) {
            this.pendingFinalPhrase = eventArgs.text.trim();
          }
        }
        if (eventArgs.isFinal) {
          this.sendJson({
            eventType: 'asrTranscription',
            speaker_label: 'Speaker 0 (Wearer)',
            transcript_text: eventArgs.text,
            timestamp_ms: this.getElapsedMs()
          });
        }
      });

      this.asrModule.startTranscribing(asrOptions);
      print('[PersistentStreamSocketClient] ASR transcription stream started in HighSpeed mode.');
    } catch (e) {
      print(`[PersistentStreamSocketClient] initializeAsrStream failed: ${this.redactSecrets(String(e))}`);
    }
  }

  private bindCameraCapturer(): void {
    if (!this.cameraCapturer) {
      try {
        const comps = this.getSceneObject().getComponents('Component.ScriptComponent' as any);
        for (const c of comps) {
          if (c !== this && (c as any).triggerManualCapture) {
            this.cameraCapturer = c as any;
            break;
          }
        }
      } catch (e) {
        print(`[PersistentStreamSocketClient] bindCameraCapturer failed: ${this.redactSecrets(String(e))}`);
      }
    }
    if (!this.cameraCapturer) {
      print('[PersistentStreamSocketClient] Camera capturer not attached; camera streaming disabled.');
      return;
    }
    this.cameraCapturer.onEncodedFrameAvailable = (b64: string) => {
      this.sendCameraFrame(b64);
    };
  }

  public sendCameraFrame(b64: string): void {
    this.sendJson({
      eventType: 'cameraFrame',
      timestamp_ms: this.getElapsedMs(),
      image_b64: b64
    });
  }

  public sendPinchCommand(action: string, nodeType: string, label?: string | null): void {
    const payload: Record<string, any> = {
      eventType: 'pinchCommand',
      timestamp_ms: this.getElapsedMs(),
      action: action,
      node_type: nodeType
    };
    if (label !== null && label !== undefined) {
      payload.label = label;
    }
    this.lastSentCommand = payload;
    this.sendJson(payload);
  }

  public sendJson(payload: Record<string, any>): void {
    if (this.activeSocket && this.activeSocket.readyState === 1) {
      this.activeSocket.send(JSON.stringify(payload));
    }
  }

  private cleanup(): void {
    this.isDestroyed = true;
    if (this.reconnectEvent) {
      try {
        this.reconnectEvent.cancel();
      } catch (e) {
        print(`[PersistentStreamSocketClient] cleanup reconnect cancel failed: ${this.redactSecrets(String(e))}`);
      }
    }
    try {
      this.asrModule.stopTranscribing();
    } catch (e) {
      print(`[PersistentStreamSocketClient] cleanup stopTranscribing failed: ${this.redactSecrets(String(e))}`);
    }
    if (this.activeSocket) {
      this.activeSocket.close();
    }
  }
}
