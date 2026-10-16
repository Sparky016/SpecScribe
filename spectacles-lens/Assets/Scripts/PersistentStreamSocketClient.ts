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

  public onDiagramUpdated: (imageB64: string, diffSummary: string) => void = () => {};
  public onHandRaised: (payload: any) => void = () => {};

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

  private initializeWebSocket(): void {
    this.activeSocket = this.internetModule.createWebSocket(this.websocketUrl);
    this.activeSocket.binaryType = 'blob';

    this.activeSocket.onopen = () => {
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
  }

  private routeInboundJson(rawJson: string): void {
    try {
      const msg = JSON.parse(rawJson);
      if (msg.event === 'DIAGRAM_UPDATED') {
        this.onDiagramUpdated(msg.image_b64, msg.diff_summary);
      } else if (msg.event === 'HAND_RAISED') {
        this.onHandRaised(msg);
      }
    } catch (e) {
      print('[PersistentStreamSocketClient] Failed to parse inbound JSON.');
    }
  }

  private initializeAsrStream(): void {
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
  }

  private bindCameraCapturer(): void {
    if (!this.cameraCapturer) {
      return;
    }
    this.cameraCapturer.onEncodedFrameAvailable = (b64: string) => {
      this.sendJson({
        eventType: 'cameraFrame',
        timestamp_ms: this.getElapsedMs(),
        image_b64: b64
      });
    };
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
    this.asrModule.stopTranscribing();
    if (this.activeSocket) {
      this.activeSocket.close();
    }
  }
}
