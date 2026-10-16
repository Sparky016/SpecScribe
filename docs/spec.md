# Technical Specification (`spec.md`) — *SpecScribe AR*

* **Project:** SpecScribe AR — Spatial Architecture & Decision Intelligence for Snap Spectacles
* **Hackathon:** Learn AR with SPECS (`https://learn-specs.devpost.com/` — Challenge ID `31659`)
* **Document Path:** `/docs/spec.md` (Mandatory Spec-Driven Methodology Deliverable — $25\%$ Rubric Weight)
* **Version:** `v1.1.0`
* **Last Updated:** Friday, October 16, 2026
* **Target Runtime:** Snap Lens Studio `5.15.x+` (Spectacles 2024 Simulation Profile + Interactive Preview Panel), Python `3.11+` (FastAPI), Supabase (`PostgreSQL 16` + `pgvector`), Next.js `15` (App Router)

---

## 1. System Architecture & Runtime Topology

SpecScribe AR operates as a decoupled, full-duplex spatial computing system split across four runtime tiers:

1. **Tier 1: Snap Spectacles Spatial Client (`/spectacles-lens`)**
   * Executes inside Snap Lens Studio `5.15+` (Interactive Preview Panel and Spectacles OS).
   * Captures downsampled $480\text{p}$ RGB frames off the main thread every $3.0\text{ s}$ (`0.33 FPS`) via `LensStudio:CameraModule` and `Base64.encodeTextureAsync`.
   * Streams low-latency localized speech-to-text phrases via `LensStudio:AsrModule` (`AsrMode.HighSpeed`).
   * Renders a peripheral 4-button Spectacles Interaction Kit (`SIK`) `PinchButton` component palette, a proactive "Raising-Hand" 3D AI Teammate Orb, and an unlit world-anchored AR Diagram Overlay mesh at an optical comfort zone of $1.0\text{ m}\text{--}1.3\text{ m}$ along the forward $Z$-axis.
2. **Tier 2: Asynchronous FastAPI & In-Memory Graph Orchestrator (`/backend`)**
   * Maintains a persistent bidirectional WebSocket connection (`/ws/meeting/{meeting_id}`).
   * Filters redundant camera frames in $<5\text{ ms}$ using perceptual hashing (`imagehash.phash` with Hamming distance threshold $\ge 6$).
   * Invokes `gemini-2.5-flash` with structured JSON outputs to extract incremental vertex/edge mutations from whiteboard strokes and link speaker transcript windows to architectural rationale.
   * Mutates an in-memory `drawio-mcp` graph (`DrawioFile`, `Diagram`, `MxCell`) and executes the Sugiyama hierarchical DAG auto-layout algorithm (`LayoutEngine().apply_sugiyama`) in $<35\text{ ms}$ with zero inter-process communication (IPC) overhead.
3. **Tier 3: Pre-Warmed Headless Export Daemon (`Playwright Chromium`)**
   * Managed via FastAPI's `asynccontextmanager` lifespan.
   * Keeps `https://viewer.diagrams.net/export3.html` warm in memory and executes `window.render({ format: 'png', bg: 'none', scale: 1.5 })` over the Chrome DevTools Protocol (CDP), returning a transparent RGBA PNG buffer in $60\text{ ms}\text{--}140\text{ ms}$.
4. **Tier 4: Unified Persistence & Temporal Review Hub (`/supabase` & `/web-dashboard`)**
   * Stores meetings, speaker-diarized transcript turns, timestamped `.drawio` XML snapshots, Raising-Hand agent interventions, and $1536\text{-dimensional}$ `pgvector` embeddings inside a single Supabase project.
   * Serves a Next.js 15 Temporal Decision Scrubber and RAG Q&A web interface.

---

## 2. Snap Lens Studio 5.15+ Client Specification (`/spectacles-lens`)

### 2.1 Required Engine Modules & `.lspkg` Dependencies

| Identifier | Type | Import / Require Path | Purpose |
| :--- | :--- | :--- | :--- |
| `SpectaclesInteractionKit.lspkg` | Asset Package | `SpectaclesInteractionKit.lspkg/Components/...` | Provides `PinchButton`, `Interactable`, hand-tracking raycasters, and hover/pinch signifiers. |
| `RemoteServiceGateway.lspkg` | Asset Package | `RemoteServiceGateway.lspkg/...` | Optional audio/token utilities and microphone stream helpers. |
| `LensStudio:CameraModule` | Built-in Module | `require('LensStudio:CameraModule')` | Hardware RGB camera stream provisioning with driver-level downscaling (`imageSmallerDimension = 480`). |
| `LensStudio:InternetModule` | Built-in Module | `require('LensStudio:InternetModule')` | Persistent `WebSocket` transport (`wss://` in production, `ws://` in local preview). |
| `LensStudio:AsrModule` | Built-in Module | `require('LensStudio:AsrModule')` | Hardware-accelerated automated speech recognition (`AsrMode.HighSpeed`). |

---

### 2.2 Spatial Scene Hierarchy & Waveguide Optical Ergonomics

Snap Spectacles use binocular additive optical waveguides with a fixed focal plane at $1.0\text{ m}$ and optimal stereo overlap at $1.1\text{ m}$. True black pixels (`#000000`) emit zero light and appear fully transparent. All interactive colliders and visual surfaces are anchored between $1.0\text{ m}$ and $1.3\text{ m}$ from the camera origin:

~~~text
Scene Root
├── Camera [Component.Camera] (Transform: 0, 0, 0)
│   └── SpatialHUDRoot [SceneObject]
│       ├── WhiteboardOverlayAnchor [SceneObject] (Pos: X=0.0cm, Y=0.0cm, Z=-120.0cm | Scale: 80cm x 45cm)
│       │   ├── OverlayMesh [Component.RenderMeshVisual] (Material: Unlit, BlendMode: PremultipliedAlpha)
│       │   └── DiffToastText [Component.Text] (Pos: X=0.0cm, Y=-26.0cm, Z=0.0cm | Color: #00E5FF)
│       │
│       ├── SIKPinchPaletteRoot [SceneObject] (Pos: X=-38.0cm, Y=5.0cm, Z=-115.0cm | Rot: Y=+12 deg)
│       │   ├── BtnAddDecision [SceneObject + SIK PinchButton + Interactable] (Label: "◇ Decision")
│       │   ├── BtnAddService  [SceneObject + SIK PinchButton + Interactable] (Label: "▭ Service")
│       │   ├── BtnAddDatabase [SceneObject + SIK PinchButton + Interactable] (Label: "🛢 Database")
│       │   └── BtnAddTerminal [SceneObject + SIK PinchButton + Interactable] (Label: "○ Terminal")
│       │
│       └── RaisingHandAgentRoot [SceneObject] (Pos: X=+38.0cm, Y=+18.0cm, Z=-115.0cm | Rot: Y=-12 deg)
│           ├── AgentOrbMesh [Component.RenderMeshVisual + SIK PinchButton + Interactable]
│           ├── HandRaisedPillBadge [SceneObject] (Pos: X=0.0cm, Y=+8.0cm, Z=0.0cm)
│           │   └── PillTitleText [Component.Text] (Max 28 chars | Color: #00FF66 / #FFCC00)
│           ├── ExpandedCritiqueCard [SceneObject] (Pos: X=-6.0cm, Y=-14.0cm, Z=0.0cm | Default: Disabled)
│           │   └── CritiqueBodyText [Component.Text]
│           └── AgentVoicePlayer [Component.AudioComponent] (PlaybackMode: Audio.PlaybackMode.LowLatency)
│
├── SIK_InteractionManager [Prefab from SpectaclesInteractionKit.lspkg]
└── SpecScribeControllers [SceneObject]
    ├── Script: PeriodicCameraCapturer.ts
    ├── Script: PersistentStreamSocketClient.ts
    ├── Script: SpatialInterfaceManager.ts
    └── Script: RaisingHandAgentController.ts
~~~

---

### 2.3 TypeScript Component Specifications

#### 2.3.1 `PeriodicCameraCapturer.ts`
Captures downsampled camera frames off the main thread without dropping simulation frame rates below $60\text{ FPS}$.

~~~typescript
import { BaseScriptComponent } from 'Component/ScriptComponent';

export enum CompressionQuality {
  Low = 0,
  Medium = 1,
  High = 2
}

@component
export class PeriodicCameraCapturer extends BaseScriptComponent {
  @input
  private sampleIntervalSeconds: number = 3.0;

  @input
  private frameSmallerDimension: number = 480;

  private cameraModule: CameraModule = require('LensStudio:CameraModule');
  private cameraTexture?: Texture;
  private isEncodingActive: boolean = false;
  private timeAccumulator: number = 0;

  public onEncodedFrameAvailable: (encodedBase64: string, timestampMs: number) => void = () => {};

  onAwake(): void {
    this.createEvent('OnStartEvent').bind(() => {
      this.setupCameraPipeline();
    });

    this.createEvent('UpdateEvent').bind((eventData) => {
      this.evaluateCaptureCadence(eventData.getDeltaTime());
    });
  }

  private setupCameraPipeline(): void {
    const request = CameraModule.createCameraRequest();
    request.cameraId = CameraModule.CameraId.Default_Color;
    request.imageSmallerDimension = this.frameSmallerDimension;
    this.cameraTexture = this.cameraModule.requestCamera(request);
  }

  private evaluateCaptureCadence(deltaTime: number): void {
    if (!this.cameraTexture || this.isEncodingActive) {
      return;
    }

    this.timeAccumulator += deltaTime;
    if (this.timeAccumulator >= this.sampleIntervalSeconds) {
      this.timeAccumulator = 0;
      this.encodeFrameAsync();
    }
  }

  private encodeFrameAsync(): void {
    if (!this.cameraTexture) {
      return;
    }

    this.isEncodingActive = true;
    const captureTimestamp = Date.now();

    Base64.encodeTextureAsync(
      this.cameraTexture,
      (encodedString: string) => {
        this.isEncodingActive = false;
        this.onEncodedFrameAvailable(encodedString, captureTimestamp);
      },
      () => {
        this.isEncodingActive = false;
        print('[PeriodicCameraCapturer] Async frame encoding failed.');
      },
      CompressionQuality.Low,
      EncodingType.Jpg
    );
  }
}
~~~

#### 2.3.2 `PersistentStreamSocketClient.ts`
Manages the full-duplex WebSocket connection, streams `AsrModule` speech segments, and dispatches server events to spatial controllers.

~~~typescript
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
~~~

#### 2.3.3 `SpatialInterfaceManager.ts`
Binds the 4 SIK `PinchButton` component palette buttons and updates the transparent AR diagram overlay texture via `Base64.decodeTextureAsync`.

~~~typescript
import { BaseScriptComponent } from 'Component/ScriptComponent';
import { PinchButton } from 'SpectaclesInteractionKit.lspkg/Components/UI/PinchButton/PinchButton';
import { PersistentStreamSocketClient } from './PersistentStreamSocketClient';

@component
export class SpatialInterfaceManager extends BaseScriptComponent {
  @input
  private socketClient!: PersistentStreamSocketClient;

  @input
  private btnAddDecision!: PinchButton;

  @input
  private btnAddService!: PinchButton;

  @input
  private btnAddDatabase!: PinchButton;

  @input
  private btnAddTerminal!: PinchButton;

  @input
  private diagramOverlayMesh!: RenderMeshVisual;

  @input
  private diffToastText!: Text;

  onAwake(): void {
    this.createEvent('OnStartEvent').bind(() => {
      this.bindPaletteButtons();
      this.bindSocketCallbacks();
    });
  }

  private bindPaletteButtons(): void {
    this.bindSingleButton(this.btnAddDecision, 'decision');
    this.bindSingleButton(this.btnAddService, 'service');
    this.bindSingleButton(this.btnAddDatabase, 'database');
    this.bindSingleButton(this.btnAddTerminal, 'terminal');
  }

  private bindSingleButton(button: PinchButton, nodeType: string): void {
    if (!button) {
      return;
    }
    button.onButtonPinched.add(() => {
      const spokenLabel = this.socketClient
        ? this.socketClient.getLatestSpokenPhrase()
        : `New ${nodeType}`;
      if (this.diffToastText) {
        this.diffToastText.text = `Adding [${nodeType.toUpperCase()}]: "${spokenLabel}"...`;
      }
      this.socketClient.sendPinchCommand('ADD_NODE', nodeType, spokenLabel);
    });
  }

  private bindSocketCallbacks(): void {
    if (!this.socketClient) {
      return;
    }
    this.socketClient.onDiagramUpdated = (imageB64: string, diffSummary: string) => {
      this.updateDiagramOverlay(imageB64);
      if (this.diffToastText) {
        this.diffToastText.text = diffSummary;
      }
    };
  }

  public updateDiagramOverlay(base64Png: string): void {
    Base64.decodeTextureAsync(
      base64Png,
      (decodedTexture: Texture) => {
        if (this.diagramOverlayMesh && this.diagramOverlayMesh.mainMaterial) {
          this.diagramOverlayMesh.mainMaterial.mainPass.baseTex = decodedTexture;
        }
      },
      () => {
        print('[SpatialInterfaceManager] Failed to decode overlay PNG texture.');
      }
    );
  }
}
~~~

#### 2.3.4 `RaisingHandAgentController.ts`
Controls the peripheral 3D AI Teammate Orb anchored at $1.15\text{ m}$ depth (`IDLE` $\rightarrow$ `RESEARCHING` $\rightarrow$ `HAND_RAISED`).

~~~typescript
import { BaseScriptComponent } from 'Component/ScriptComponent';
import { PinchButton } from 'SpectaclesInteractionKit.lspkg/Components/UI/PinchButton/PinchButton';
import { PersistentStreamSocketClient } from './PersistentStreamSocketClient';

export enum AgentState {
  IDLE = 'IDLE',
  RESEARCHING = 'RESEARCHING',
  HAND_RAISED = 'HAND_RAISED'
}

@component
export class RaisingHandAgentController extends BaseScriptComponent {
  @input
  private socketClient!: PersistentStreamSocketClient;

  @input
  private agentOrbPinchButton!: PinchButton;

  @input
  private handRaisedPillObject!: SceneObject;

  @input
  private pillTitleText!: Text;

  @input
  private expandedCritiqueCard!: SceneObject;

  @input
  private critiqueBodyText!: Text;

  @input
  private agentAudioComponent?: AudioComponent;

  private currentState: AgentState = AgentState.IDLE;
  private latestCritiqueBody: string = '';
  private isCardExpanded: boolean = false;

  onAwake(): void {
    this.createEvent('OnStartEvent').bind(() => {
      this.configureAudioLowLatency();
      this.setVisualState(AgentState.IDLE, '', '');
      this.bindInteractions();
    });
  }

  private configureAudioLowLatency(): void {
    if (this.agentAudioComponent) {
      this.agentAudioComponent.playbackMode = Audio.PlaybackMode.LowLatency;
    }
  }

  private bindInteractions(): void {
    if (this.socketClient) {
      this.socketClient.onHandRaised = (payload: any) => {
        const title = (payload.short_title || '💡 Agent Insight').substring(0, 28);
        const body = payload.detailed_body || '';
        this.setVisualState(AgentState.HAND_RAISED, title, body);
      };
    }

    if (this.agentOrbPinchButton) {
      this.agentOrbPinchButton.onButtonPinched.add(() => {
        this.handleOrbPinched();
      });
    }
  }

  private handleOrbPinched(): void {
    if (this.currentState === AgentState.HAND_RAISED) {
      this.isCardExpanded = !this.isCardExpanded;
      if (this.expandedCritiqueCard) {
        this.expandedCritiqueCard.enabled = this.isCardExpanded;
      }
      if (!this.isCardExpanded) {
        this.setVisualState(AgentState.IDLE, '', '');
      }
    } else if (this.currentState === AgentState.IDLE && this.socketClient) {
      const query = this.socketClient.getLatestSpokenPhrase();
      this.setVisualState(AgentState.RESEARCHING, '🔍 Researching...', '');
      this.socketClient.sendPinchCommand('ASK_AGENT', 'research', query);
    }
  }

  private setVisualState(state: AgentState, shortTitle: string, detailedBody: string): void {
    this.currentState = state;
    this.latestCritiqueBody = detailedBody;

    if (this.handRaisedPillObject) {
      this.handRaisedPillObject.enabled = state !== AgentState.IDLE;
    }
    if (this.pillTitleText) {
      this.pillTitleText.text = shortTitle;
    }
    if (this.critiqueBodyText) {
      this.critiqueBodyText.text = detailedBody;
    }
    if (this.expandedCritiqueCard && state !== AgentState.HAND_RAISED) {
      this.expandedCritiqueCard.enabled = false;
      this.isCardExpanded = false;
    }
  }
}
~~~

---

## 3. Full-Duplex WebSocket Wire Protocol (`/ws/meeting/{meeting_id}`)

### 3.1 Upstream Messages (Spectacles Client $\rightarrow$ FastAPI Server)

#### A. `handshake`
~~~json
{
  "eventType": "handshake",
  "device": "Spectacles-2024",
  "protocolVersion": "1.1.0",
  "timestamp_ms": 0
}
~~~

#### B. `asrTranscription`
~~~json
{
  "eventType": "asrTranscription",
  "speaker_label": "Speaker 0 (Ruan)",
  "transcript_text": "Let's place a Redis cache between the API Gateway and PostgreSQL.",
  "timestamp_ms": 42150
}
~~~

#### C. `cameraFrame`
~~~json
{
  "eventType": "cameraFrame",
  "timestamp_ms": 45000,
  "image_b64": "/9j/4AAQSkZJRgABAQAAAQABAAD..."
}
~~~

#### D. `pinchCommand`
~~~json
{
  "eventType": "pinchCommand",
  "timestamp_ms": 48200,
  "action": "ADD_NODE",
  "node_type": "database",
  "label": "Redis Session Cache"
}
~~~
*(Supported `action` values: `"ADD_NODE"`, `"CONNECT_NODES"`, `"ASK_AGENT"`)*

---

### 3.2 Downstream Messages (FastAPI Server $\rightarrow$ Spectacles Client)

#### A. `DIAGRAM_UPDATED`
~~~json
{
  "event": "DIAGRAM_UPDATED",
  "snapshot_id": "c8f9e112-4a2b-4c5d-9e6f-123456789abc",
  "timestamp_ms": 48310,
  "diff_summary": "+ Added [database] Redis Session Cache",
  "decision_rationale": "Speaker 0 added Redis cache to reduce read latency on PostgreSQL.",
  "image_b64": "iVBORw0KGgoAAAANSUhEUgAA..."
}
~~~

#### B. `HAND_RAISED`
~~~json
{
  "event": "HAND_RAISED",
  "intervention_id": "a1b2c3d4-9988-7766-5544-33221100ffaa",
  "timestamp_ms": 60120,
  "category": "VULNERABILITY",
  "short_title": "🚩 Cache Stampede Risk",
  "detailed_body": "• High-concurrency cache misses on Redis will overload PostgreSQL.\n• Add mutex lock / request coalescing on cache miss.\n• Configure jittered TTLs (300s ± 30s)."
}
~~~

---

## 4. FastAPI Orchestrator, `drawio-mcp` & Sub-$140\text{ ms}$ Rendering Engine (`/backend`)

### 4.1 Waveguide-Optimized `drawio-mcp` Styling Matrix

Because Snap Spectacles use additive optical waveguides, all cells generated via `drawio_mcp.models.MxCell` enforce high-luminance neon strokes and dark/translucent fills over `bg=none` (`opacity=0`):

| Node / Cell Type | `drawio-mcp` Style String |
| :--- | :--- |
| `service` | `rounded=1;whiteSpace=wrap;html=1;fillColor=#107C41;strokeColor=#00FF66;fontColor=#FFFFFF;strokeWidth=2;` |
| `decision` | `rhombus;whiteSpace=wrap;html=1;fillColor=#004D40;strokeColor=#00E5FF;fontColor=#FFFFFF;strokeWidth=2;` |
| `database` | `shape=cylinder3;whiteSpace=wrap;html=1;boundedLbl=1;backgroundOutline=1;size=15;fillColor=#0D47A1;strokeColor=#00E5FF;fontColor=#FFFFFF;strokeWidth=2;` |
| `terminal` | `ellipse;whiteSpace=wrap;html=1;fillColor=#311B92;strokeColor=#00FF66;fontColor=#FFFFFF;strokeWidth=2;` |
| `edge` | `edgeStyle=orthogonalEdgeStyle;rounded=1;html=1;strokeColor=#00E5FF;strokeWidth=3;fontColor=#00E5FF;` |

### 4.2 Vision Diff Gate & Gemini 2.5 Flash Structured Output Schema
1. **Perceptual Hash Filter (`imagehash.phash`):**
   * Each incoming `cameraFrame` Base64 JPEG is decoded into a `PIL.Image` and hashed via `imagehash.phash(img)`.
   * If `abs(current_hash - last_accepted_hash) < 6`, the frame is discarded in $<5\text{ ms}$.
2. **Incremental Graph Delta Extraction (`gemini-2.5-flash`):**
   * When the Hamming distance is $\ge 6$, the backend passes the image + current node list to `gemini-2.5-flash` with `response_schema=GraphDeltaSchema`:

~~~python
from pydantic import BaseModel, Field
from typing import List, Literal

class VertexAddition(BaseModel):
    temp_id: str = Field(description="Unique identifier or existing vertex ID")
    label: str = Field(description="Concise label written inside the whiteboard shape")
    node_type: Literal["service", "decision", "database", "terminal"]

class EdgeAddition(BaseModel):
    source_label: str
    target_label: str
    edge_label: str = ""

class GraphDeltaSchema(BaseModel):
    person_occluding_board: bool = Field(description="True if a person's body blocks the diagram")
    has_meaningful_change: bool
    added_vertices: List[VertexAddition]
    added_edges: List[EdgeAddition]
    diff_summary: str = Field(description="Max 60 chars summary of the visual update")
~~~

### 4.3 REST API Specification (`/backend/main.py`)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/meetings` | Creates a new meeting record and initializes an in-memory `LiveGraphSession`. |
| `GET` | `/api/meetings/{id}/timeline` | Returns full meeting metadata, ordered `transcript_turns`, `diagram_snapshots`, and `agent_interventions` for the Next.js Temporal Scrubber. |
| `POST` | `/api/meetings/{id}/finalize` | Compiles the complete meeting into `generated_spec_md` and chunks/embeds all decisions and transcripts into `knowledge_chunks` (`vector(1536)`). |
| `POST` | `/api/meetings/{id}/ask` | Embeds the user's question, calls Supabase RPC `match_knowledge_chunks`, and returns a grounded answer with clickable `[MM:SS]` timestamp citations. |

---

## 5. Unified Database Schema (`Supabase PostgreSQL` + `pgvector`)

File location: `/supabase/migrations/001_initial_schema.sql`

~~~sql
-- Enable pgvector extension
create extension if not exists vector;

-- 1. Meetings Table
create table if not exists meetings (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  created_at timestamptz default now(),
  latest_drawio_xml text,
  generated_spec_md text
);

-- 2. Speaker-Diarized Transcript Turns
create table if not exists transcript_turns (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid references meetings(id) on delete cascade,
  speaker_label text not null,
  transcript_text text not null,
  timestamp_ms integer not null,
  created_at timestamptz default now()
);

create index if not exists idx_transcript_meeting_time
  on transcript_turns (meeting_id, timestamp_ms);

-- 3. Timestamped Diagram Snapshots & Decision Logs
create table if not exists diagram_snapshots (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid references meetings(id) on delete cascade,
  timestamp_ms integer not null,
  drawio_xml text not null,
  overlay_image_url text,
  diff_summary text not null,
  decision_rationale text,
  triggered_by text not null -- 'VISION_DIFF' | 'PINCH_PALETTE' | 'AGENT_SUGGESTION'
);

create index if not exists idx_snapshots_meeting_time
  on diagram_snapshots (meeting_id, timestamp_ms);

-- 4. Raising-Hand Agent Interventions
create table if not exists agent_interventions (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid references meetings(id) on delete cascade,
  timestamp_ms integer not null,
  category text not null, -- 'VULNERABILITY' | 'LOGIC_FLAW' | 'ALTERNATIVE_IDEA' | 'RESEARCH'
  short_title text not null,
  detailed_body text not null,
  was_pinched boolean default false
);

-- 5. Unified Vector Store for Post-Meeting RAG Agent
create table if not exists knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid references meetings(id) on delete cascade,
  chunk_type text not null, -- 'DECISION' | 'TRANSCRIPT_WINDOW' | 'AGENT_INSIGHT' | 'TECH_SPEC'
  timestamp_ms integer,
  content text not null,
  embedding vector(1536)
);

-- Vector Similarity Search RPC
create or replace function match_knowledge_chunks (
  query_embedding vector(1536),
  match_meeting_id uuid,
  match_threshold float,
  match_count int
)
returns table (
  id uuid,
  chunk_type text,
  timestamp_ms integer,
  content text,
  similarity float
)
language sql stable
as $$
  select
    kc.id,
    kc.chunk_type,
    kc.timestamp_ms,
    kc.content,
    1 - (kc.embedding <=> query_embedding) as similarity
  from knowledge_chunks kc
  where kc.meeting_id = match_meeting_id
    and 1 - (kc.embedding <=> query_embedding) > match_threshold
  order by kc.embedding <=> query_embedding
  limit match_count;
$$;
~~~

---

## 6. Next.js 15 Temporal Decision Scrubber & RAG Hub (`/web-dashboard`)

### 6.1 Component Architecture
* `/app/meetings/[id]/page.tsx`: Server/Client hybrid container fetching `/api/meetings/{id}/timeline`.
* `components/TemporalScrubberBar.tsx`: Interactive range slider (`0` to `maxTimestampMs`) rendering cyan diamond markers for `diagram_snapshots` and amber hand markers for `agent_interventions`.
* `components/DiagramSnapshotCanvas.tsx`: Renders the active snapshot (`overlay_image_url` or live SVG/Draw.io XML) at the scrubbed timestamp `currentTimeMs`, overlaid with the `diff_summary` and `decision_rationale` badge.
* `components/DiarizedTranscriptFeed.tsx`: Auto-scrolls to the active `transcript_turn` matching `currentTimeMs` and highlights inline Raising-Hand agent interventions.
* `components/AskMeetingRagDrawer.tsx`: Queries `/api/meetings/{id}/ask` and renders clickable `[MM:SS]` timestamp badges that seek `currentTimeMs` on click.

---

## 7. Non-Functional Performance Budgets & Verification Matrix

| Metric / Subsystem | Target Budget | Verification Method |
| :--- | :--- | :--- |
| **Lens Studio Simulation Frame Rate** | $60\text{ FPS}$ sustained | Verified in Lens Studio 5.15+ Profiler with `Base64.encodeTextureAsync` off-thread encoding. |
| **Perceptual Frame Diff Gate** | $<5\text{ ms}$ per frame | Benchmarked via `imagehash.phash` on $480\text{p}$ JPEG buffers. |
| **Sugiyama DAG Layout Calculation** | $15\text{ ms}\text{--}35\text{ ms}$ | Direct in-memory Python call to `LayoutEngine().apply_sugiyama()`. |
| **Headless Transparent PNG Render** | $60\text{ ms}\text{--}140\text{ ms}$ | Pre-warmed Playwright Chromium executing `export3.html` `window.render()`. |
| **Spatial UI Focal Depth** | $1.0\text{ m}\text{--}1.3\text{ m}$ ($Z$-axis) | Verified in `SCENE_HIERARCHY_SETUP.md` (`-115cm` to `-120cm`). |
| **AR Pill Title Length** | $\le 28\text{ characters}$ | Enforced via Pydantic schema validation and TypeScript `.substring(0, 28)`. |