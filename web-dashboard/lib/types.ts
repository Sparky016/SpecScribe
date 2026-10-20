export interface Meeting {
  id: string;
  title: string;
  created_at: string;
  latest_drawio_xml?: string;
  generated_spec_md?: string;
}

export interface TranscriptTurn {
  id: string;
  meeting_id: string;
  speaker_label: string;
  transcript_text: string;
  timestamp_ms: number;
  created_at?: string;
}

export type TriggerSource = "VISION_DIFF" | "PINCH_PALETTE" | "AGENT_SUGGESTION" | "MANUAL";

export interface DiagramSnapshot {
  id: string;
  meeting_id: string;
  timestamp_ms: number;
  drawio_xml: string;
  overlay_image_url?: string;
  diff_summary: string;
  decision_rationale?: string;
  triggered_by: TriggerSource;
}

export type InterventionCategory = "VULNERABILITY" | "LOGIC_FLAW" | "ALTERNATIVE_IDEA" | "RESEARCH";

export interface AgentIntervention {
  id: string;
  meeting_id: string;
  timestamp_ms: number;
  category: InterventionCategory;
  short_title: string;
  detailed_body: string;
  was_pinched?: boolean;
}

export interface KnowledgeChunk {
  id: string;
  meeting_id: string;
  chunk_type: "DECISION" | "TRANSCRIPT_WINDOW" | "AGENT_INSIGHT" | "TECH_SPEC";
  timestamp_ms: number;
  content: string;
  similarity?: number;
}

export interface TimelinePaginationMetadata {
  total_turns: number;
  limit: number;
  offset: number;
  has_more: boolean;
}

export interface TimelineData {
  meeting: Meeting;
  transcript_turns: TranscriptTurn[];
  diagram_snapshots: DiagramSnapshot[];
  agent_interventions: AgentIntervention[];
  knowledge_chunks: KnowledgeChunk[];
  pagination?: TimelinePaginationMetadata;
}


export interface CitationItem {
  timestamp_ms: number;
  label: string;
  excerpt: string;
}

export interface RAGResponse {
  meeting_id: string;
  question: string;
  answer: string;
  citations: CitationItem[];
}

export interface ParsedVertex {
  id: string;
  label: string;
  style: string;
  type: "service" | "decision" | "database" | "terminal" | "default";
  x: number;
  y: number;
  width: number;
  height: number;
  fillColor?: string;
  strokeColor?: string;
}

export interface ParsedEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  style: string;
}

export interface ParsedGraph {
  vertices: ParsedVertex[];
  edges: ParsedEdge[];
}
