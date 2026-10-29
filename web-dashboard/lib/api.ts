import { DEMO_TIMELINE, DEMO_MEETING_ID } from "./demoData";
import { backendFetch } from "./backend";
import { RAGResponse, TimelineData, TranscriptTurn } from "./types";

// Browser calls go to the same-origin /api route handlers, which attach the backend token.
// Server-side calls go straight to the backend through backendFetch.
function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const cleanPath = path.startsWith("/") ? path.slice(1) : path;
  if (typeof window !== "undefined") {
    return fetch(`/${cleanPath}`, init);
  }
  return backendFetch(cleanPath, init);
}

import { formatTimestamp, parseTimestamp } from "./formatters";
export { formatTimestamp, parseTimestamp };

export interface TimelinePaginationOptions {
  limit?: number;
  offset?: number;
  from_ms?: number;
  to_ms?: number;
}

// Safety cap on transcript pages fetched per timeline load.
const MAX_TIMELINE_PAGES = 50;

export async function getMeetingTimeline(
  meetingId: string,
  options?: TimelinePaginationOptions
): Promise<TimelineData> {
  // If demo session requested, return verified rich demo dataset immediately
  if (meetingId === DEMO_MEETING_ID || meetingId === "demo" || !meetingId) {
    return DEMO_TIMELINE;
  }

  // Attempt to fetch from FastAPI backend
  try {
    // Transcript turns are paged by the backend; keep requesting pages while has_more is set.
    const pageLimit = options?.limit ?? 100;
    let offset = options?.offset ?? 0;
    let data: any = null;
    const transcriptTurns: TranscriptTurn[] = [];

    for (let page = 0; page < MAX_TIMELINE_PAGES; page++) {
      const queryParams = new URLSearchParams();
      queryParams.set("limit", pageLimit.toString());
      queryParams.set("offset", offset.toString());
      if (options?.from_ms !== undefined) queryParams.set("from_ms", options.from_ms.toString());
      if (options?.to_ms !== undefined) queryParams.set("to_ms", options.to_ms.toString());

      const endpoint = `api/meetings/${encodeURIComponent(meetingId)}/timeline?${queryParams.toString()}`;
      const res = await apiFetch(endpoint, {
        cache: "no-store",
      });
      if (!res.ok) {
        throw new Error(`Timeline request failed with status ${res.status}`);
      }
      const pageData = await res.json();
      if (data === null) data = pageData;

      const turns: TranscriptTurn[] = pageData.transcript_turns || [];
      transcriptTurns.push(...turns);
      if (!pageData.pagination?.has_more || turns.length === 0) break;
      offset += turns.length;
    }

    return {
      meeting: data.meeting || { id: meetingId, title: `Meeting ${meetingId.slice(0, 8)}`, created_at: new Date().toISOString() },
      transcript_turns: transcriptTurns,
      diagram_snapshots: data.diagram_snapshots || [],
      agent_interventions: data.agent_interventions || [],
      knowledge_chunks: data.knowledge_chunks || [],
      pagination: data.pagination,
    };
  } catch (err) {
    console.warn("Backend timeline fetch failed:", err);
    throw err instanceof Error ? err : new Error("Timeline request failed");
  }
}

export const fetchMeetingTimeline = getMeetingTimeline;


export async function askMeetingRAG(meetingId: string, question: string, timeline: TimelineData): Promise<RAGResponse> {
  // Canned grounded answers exist only for the offline demo meeting.
  if (meetingId === DEMO_MEETING_ID) {
    return demoRAGAnswer(meetingId, question, timeline);
  }

  const res = await apiFetch(`api/meetings/${encodeURIComponent(meetingId)}/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question }),
  });
  if (!res.ok) {
    throw new Error(`Ask request failed with status ${res.status}`);
  }
  const data = await res.json();
  if (!data.answer) {
    throw new Error("Ask response contained no answer");
  }
  return data as RAGResponse;
}

// Keyword-matched canned answers with citations into DEMO_TIMELINE; demo meeting only.
function demoRAGAnswer(meetingId: string, question: string, timeline: TimelineData): RAGResponse {
  const qLower = question.toLowerCase();
  const chunks = timeline.knowledge_chunks || [];

  // Question matching heuristics
  if (qLower.includes("redis") || qLower.includes("cache") || qLower.includes("stampede")) {
    return {
      meeting_id: meetingId,
      question,
      answer:
        "Redis was placed between the API Gateway and PostgreSQL at [00:36] to prevent token validation storms during peak authentication spikes. However, at [00:55] the Raising-Hand AI Agent flagged a critical **Cache Stampede Risk**, noting that concurrent cache misses could overwhelm PostgreSQL. The team resolved this at [01:14] by adding request coalescing (singleflight) in the gateway and provisioning a read-replica database cluster.",
      citations: [
        { timestamp_ms: 36000, label: "00:36", excerpt: "Added Redis Cache to prevent token validation storms on auth endpoints." },
        { timestamp_ms: 54000, label: "00:54", excerpt: "AI Intervention: Cache Stampede Risk flagged on Redis misses." },
        { timestamp_ms: 74000, label: "01:14", excerpt: "Added Postgres Auth DB read-replica cluster with request coalescing." },
      ],
    };
  }

  if (qLower.includes("vulnerab") || qLower.includes("agent") || qLower.includes("risk") || qLower.includes("critique") || qLower.includes("flag")) {
    return {
      meeting_id: meetingId,
      question,
      answer:
        "The Raising-Hand AI Agent intervened three times during the session:\n\n1. **[00:55] Cache Stampede Risk (Vulnerability):** Warned that sudden spikes of invalid tokens would hammer PostgreSQL. Recommended request coalescing and jittered TTLs.\n2. **[01:38] Event Broker Decoupling (Alternative Idea):** Suggested routing high-rate binary sensor streams to Kafka rather than the HTTP REST gateway to avoid thread pool exhaustion.\n3. **[02:08] Backpressure & Dead Letter Queue (Logic Flaw):** Recommended setting up a Dead Letter Queue (DLQ) for unparseable camera frames.",
      citations: [
        { timestamp_ms: 54000, label: "00:54", excerpt: "Cache Stampede Risk: Request coalescing required for Redis misses." },
        { timestamp_ms: 98000, label: "01:38", excerpt: "Event Broker Decoupling: Route high-throughput binary sensor streams directly to Kafka." },
        { timestamp_ms: 128000, label: "02:08", excerpt: "Backpressure: Telemetry Worker DLQ and retry configuration." },
      ],
    };
  }

  if (qLower.includes("kafka") || qLower.includes("telemetry") || qLower.includes("sensor") || qLower.includes("event") || qLower.includes("stream")) {
    return {
      meeting_id: meetingId,
      question,
      answer:
        "At [01:38], the team discussed handling real-time sensor streams from Snap Spectacles. Following the AI Agent's recommendation, at [02:00] they added a dedicated **Kafka Event Broker** and a **Telemetry Worker** service. This decouples asynchronous binary sensor ingestion from the main HTTP API Gateway, preventing connection pool exhaustion and allowing horizontal scaling for spatial frames.",
      citations: [
        { timestamp_ms: 98000, label: "01:38", excerpt: "AI Intervention: Decouple binary sensor streams from HTTP gateway into Kafka." },
        { timestamp_ms: 120000, label: "02:00", excerpt: "Added Kafka Event Broker and Telemetry Worker service." },
        { timestamp_ms: 138000, label: "02:18", excerpt: "Connected Alert Dispatcher for anomalous sensor detections." },
      ],
    };
  }

  // General grounded synthesis from top matching chunks
  const matched = chunks.filter((c) => {
    const words = qLower.split(/\s+/).filter((w) => w.length > 3);
    return words.some((w) => c.content.toLowerCase().includes(w));
  });

  const topChunk = matched[0] || chunks[0];
  const ts = topChunk ? topChunk.timestamp_ms : 15000;
  const label = formatTimestamp(ts);

  return {
    meeting_id: meetingId,
    question,
    answer: `Based on the architectural decision timeline at [${label}], the engineering team aligned on the following decision: ${topChunk?.content || "System topology and service boundaries were agreed upon."} This ensures robust failure boundaries and high availability under load.`,
    citations: [
      {
        timestamp_ms: ts,
        label,
        excerpt: topChunk?.content?.slice(0, 110) || "Meeting discussion on architectural topology",
      },
    ],
  };
}

// 1-Click Export Utilities
export function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportDrawioXml(timeline: TimelineData, currentSnapshotXml?: string) {
  const xml = currentSnapshotXml || timeline.meeting.latest_drawio_xml;
  if (!xml) return;
  downloadFile(xml, `${timeline.meeting.id}-architecture.drawio`, "application/xml");
}

export function exportTechSpecMd(timeline: TimelineData) {
  const spec = timeline.meeting.generated_spec_md;
  if (!spec) return;
  downloadFile(spec, `${timeline.meeting.id}-tech-spec.md`, "text/markdown");
}

export function exportDecisionLogJson(timeline: TimelineData) {
  const exportData = {
    meeting_id: timeline.meeting.id,
    title: timeline.meeting.title,
    created_at: timeline.meeting.created_at,
    exported_at: new Date().toISOString(),
    decision_snapshots: timeline.diagram_snapshots.map((s) => ({
      timestamp_ms: s.timestamp_ms,
      timestamp_label: formatTimestamp(s.timestamp_ms),
      diff_summary: s.diff_summary,
      decision_rationale: s.decision_rationale,
      triggered_by: s.triggered_by,
    })),
    agent_interventions: timeline.agent_interventions.map((i) => ({
      timestamp_ms: i.timestamp_ms,
      timestamp_label: formatTimestamp(i.timestamp_ms),
      category: i.category,
      short_title: i.short_title,
      detailed_body: i.detailed_body,
      was_pinched: i.was_pinched,
    })),
    transcript_turns_count: timeline.transcript_turns.length,
    knowledge_chunks_count: timeline.knowledge_chunks.length,
  };

  downloadFile(JSON.stringify(exportData, null, 2), `${timeline.meeting.id}-decision-log.json`, "application/json");
}
