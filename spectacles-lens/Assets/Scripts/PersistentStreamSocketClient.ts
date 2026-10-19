import { BaseScriptComponent } from 'Component/ScriptComponent';
import { PeriodicCameraCapturer } from './PeriodicCameraCapturer';

@component
export class PersistentStreamSocketClient extends BaseScriptComponent {
  @input
  private websocketUrl: string = 'ws://localhost:8000/ws/meeting/demo-session-01';

  @input
  private cameraCapturer!: PeriodicCameraCapturer;

  private internetModule: InternetModule = require('LensStudio:InternetModule');
  private asrModule: AsrModule = require('LensStudio:AsrModule');
  private activeSocket?: WebSocket;
  private meetingStartEpochMs: number = 0;
  private latestSpokenPhrase: string = 'New Component';
  private isDestroyed: boolean = false;
  private reconnectAttempt: number = 0;
  private reconnectEvent: DelayedCallbackEvent | null = null;

  public onDiagramUpdated: (imageB64: string, diffSummary: string) => void = () => {};
  public onHandRaised: (payload: any) => void = () => {};
  public onDecisionLogged: (payload: any) => void = () => {};

  onAwake(): void {
    this.createEvent('OnStartEvent').bind(() => {
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
    return this.latestSpokenPhrase;
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

  public setWebsocketUrl(url: string): void {
    this.websocketUrl = url;
    if (this.activeSocket) {
      this.activeSocket.close();
      this.initializeWebSocket();
    }
  }

  private initializeWebSocket(): void {
    if (this.isDestroyed) {
      return;
    }

    try {
      this.activeSocket = this.internetModule.createWebSocket(this.websocketUrl);
      this.activeSocket.binaryType = 'blob';

      this.activeSocket.onopen = () => {
        print(`[PersistentStreamSocketClient] Connected to ${this.websocketUrl}`);
        this.reconnectAttempt = 0;
        if (this.reconnectEvent) {
          try {
            this.reconnectEvent.cancel();
          } catch (e) {
            // Ignored
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
      print(`[PersistentStreamSocketClient] Exception creating WebSocket: ${e}`);
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (this.isDestroyed) {
      return;
    }
    const delaySec = Math.min(10.0, 2.0 * Math.pow(1.5, this.reconnectAttempt));
    this.reconnectAttempt++;
    print(`[PersistentStreamSocketClient] Scheduling reconnect in ${delaySec.toFixed(1)}s (attempt ${this.reconnectAttempt})...`);

    if (!this.reconnectEvent) {
      this.reconnectEvent = this.createEvent('DelayedCallbackEvent');
      this.reconnectEvent.bind(() => {
        if (!this.isConnected() && !this.isDestroyed) {
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
      } else if (msg.event === 'COMMAND_ERROR') {
        print(`[PersistentStreamSocketClient] Command error (${msg.action}): ${msg.message}`);
      }
    } catch (e) {
      print('[PersistentStreamSocketClient] Failed to parse inbound JSON.');
    }
  }

  private initializeAsrStream(): void {
    try {
      const asrOptions = AsrModule.AsrTranscriptionOptions.create();
      asrOptions.mode = AsrModule.AsrMode.HighSpeed;
      asrOptions.silenceUntilTerminationMs = 1000;

      asrOptions.onTranscriptionUpdate.add((eventArgs: AsrModule.TranscriptionUpdateEvent) => {
        if (eventArgs.text && eventArgs.text.trim().length > 0) {
          this.latestSpokenPhrase = eventArgs.text.trim();
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
      print(`[PersistentStreamSocketClient] ASR setup failed: ${e}`);
    }
  }

  private bindCameraCapturer(): void {
    if (!this.cameraCapturer) {
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

  public sendPinchCommand(action: string, nodeType: string, label: string): void {
    this.sendJson({
      eventType: 'pinchCommand',
      timestamp_ms: this.getElapsedMs(),
      action: action,
      node_type: nodeType,
      label: label
    });
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
        // Ignored
      }
    }
    try {
      this.asrModule.stopTranscribing();
    } catch (e) {
      // Ignored
    }
    if (this.activeSocket) {
      this.activeSocket.close();
    }
  }
}
