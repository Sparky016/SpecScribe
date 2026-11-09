import { DEMO_TIMELINE, DEMO_MEETING_ID } from "./demoData";
import { backendFetch } from "./backend";
import { ChatTurn, MeetingListResponse, RAGResponse, TimelineData, TranscriptTurn } from "./types";

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


export async function listMeetings(): Promise<MeetingListResponse> {
  const res = await apiFetch("api/meetings", { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Meeting list request failed with status ${res.status}`);
  }
  return res.json();
}

export async function finalizeMeeting(meetingId: string): Promise<void> {
  const res = await apiFetch(`api/meetings/${encodeURIComponent(meetingId)}/finalize`, { method: "POST" });
  if (!res.ok) {
    throw new Error(`Finalize request failed with status ${res.status}`);
  }
}

// Chat turns sent with each question, so follow-ups ("why was that added?") keep their context.
export const MAX_CHAT_HISTORY_TURNS = 10;
export const MAX_CHAT_TURN_CHARS = 4000;

export async function askMeetingRAG(
  meetingId: string,
  question: string,
  timeline: TimelineData,
  history: ChatTurn[] = []
): Promise<RAGResponse> {
  // Canned grounded answers exist only for the offline demo meeting.
  if (meetingId === DEMO_MEETING_ID) {
    return demoRAGAnswer(meetingId, question, timeline);
  }

  const trimmedHistory = history
    .slice(-MAX_CHAT_HISTORY_TURNS)
    .map((t) => ({ role: t.role, content: t.content.slice(0, MAX_CHAT_TURN_CHARS) }));
  const res = await apiFetch(`api/meetings/${encodeURIComponent(meetingId)}/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, history: trimmedHistory }),
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
  if (qLower.includes("hmac") || qLower.includes("jwt") || qLower.includes("database") || qLower.includes("network") || qLower.includes("postgres")) {
    return {
      meeting_id: meetingId,
      question,
      answer:
        "At [00:29] Speaker 1 asked whether the Core Service needs auth to reach the database, or whether the network is enough. At [00:49] the team answered with a pinched **Enforce JWT HMAC Verification** decision between the Core Service and the Postgres DB: network position alone is not trusted. The AI teammate backed this at [00:53] with an **Auth Token Leak Risk** flag, since unsigned JWT tokens can be forged.",
      citations: [
        { timestamp_ms: 29000, label: "00:29", excerpt: "Do we need auth between the Core Service and the database, or is the network enough?" },
        { timestamp_ms: 49000, label: "00:49", excerpt: "Added decision: Enforce JWT HMAC Verification (Core Service → Postgres DB)." },
        { timestamp_ms: 53000, label: "00:53", excerpt: "AI Intervention: Auth Token Leak Risk — unsigned JWT tokens can be forged." },
      ],
    };
  }

  if (qLower.includes("vulnerab") || qLower.includes("agent") || qLower.includes("risk") || qLower.includes("critique") || qLower.includes("flag") || qLower.includes("leak")) {
    return {
      meeting_id: meetingId,
      question,
      answer:
        "The Raising-Hand AI teammate raised one concern:\n\n**[00:53] Auth Token Leak Risk (Vulnerability)**\n• Unsigned JWT tokens can be forged\n• Fix: require HMAC-SHA256 signature verification\n• Alternative: move session state to a Redis token cache\n\nIt was pinched open during the meeting, and the team's HMAC verification decision at [00:49] addresses it.",
      citations: [
        { timestamp_ms: 53000, label: "00:53", excerpt: "Auth Token Leak Risk: require HMAC-SHA256 signature verification." },
        { timestamp_ms: 49000, label: "00:49", excerpt: "Enforce JWT HMAC Verification between Core Service and Postgres DB." },
      ],
    };
  }

  if (qLower.includes("gateway") || qLower.includes("client") || qLower.includes("ingress") || qLower.includes("request")) {
    return {
      meeting_id: meetingId,
      question,
      answer:
        "At [00:08] Speaker 1 required a public **Client** to connect through an **API Gateway**, with every request carrying HMAC verification. The whiteboard sketch was captured at [00:18] as Client → API Gateway with an HMAC-labelled edge. At [00:23] Speaker 2 routed gateway traffic on to a **Core Service**, added to the diagram at [00:34].",
      citations: [
        { timestamp_ms: 8000, label: "00:08", excerpt: "Every request has to carry HMAC verification." },
        { timestamp_ms: 18000, label: "00:18", excerpt: "Added Client and API Gateway with HMAC edge." },
        { timestamp_ms: 34000, label: "00:34", excerpt: "Added Core Service and Postgres DB." },
      ],
    };
  }

  if (
    qLower.includes("summar") ||
    qLower.includes("decision") ||
    qLower.includes("boundar") ||
    qLower.includes("overview") ||
    qLower.includes("notes") ||
    qLower.includes("spec")
  ) {
    return {
      meeting_id: meetingId,
      question,
      answer:
        "Here is the summary of the decisions made in this session:\n\n" +
        "1. **[00:18] HMAC-verified ingress:** A public Client connects through an API Gateway; every request carries HMAC verification.\n" +
        "2. **[00:34] Core Service + Postgres DB:** Gateway traffic routes to a Core Service, which persists everything in PostgreSQL.\n" +
        "3. **[00:49] Enforce JWT HMAC Verification:** Core Service → database calls must present a verified, signed token; the network alone is not trusted.\n" +
        "4. **[00:53] AI flag — Auth Token Leak Risk:** Unsigned JWTs can be forged; addressed by decision 3.",
      citations: [
        { timestamp_ms: 18000, label: "00:18", excerpt: "Client → API Gateway with HMAC verification." },
        { timestamp_ms: 34000, label: "00:34", excerpt: "Core Service and Postgres DB added." },
        { timestamp_ms: 49000, label: "00:49", excerpt: "Enforce JWT HMAC Verification decision node." },
        { timestamp_ms: 53000, label: "00:53", excerpt: "AI Intervention: Auth Token Leak Risk." },
      ],
    };
  }

  if (
    qLower.includes("component") ||
    qLower.includes("diagram") ||
    qLower.includes("node") ||
    qLower.includes("service") ||
    qLower.includes("topology")
  ) {
    return {
      meeting_id: meetingId,
      question,
      answer:
        "The final diagram has 5 components on one request path:\n\n" +
        "• **Client** (Terminal, **[00:18]**): Public client; signs every request with an HMAC.\n" +
        "• **API Gateway** (Service, **[00:18]**): Single ingress; verifies request signatures.\n" +
        "• **Core Service** (Service, **[00:34]**): Business logic behind the gateway.\n" +
        "• **Enforce JWT HMAC Verification** (Decision, **[00:49]**): Guards the Core Service → database hop.\n" +
        "• **Postgres DB** (Database, **[00:34]**): System of record.",
      citations: [
        { timestamp_ms: 18000, label: "00:18", excerpt: "Client and API Gateway added." },
        { timestamp_ms: 34000, label: "00:34", excerpt: "Core Service and Postgres DB added." },
        { timestamp_ms: 49000, label: "00:49", excerpt: "Enforce JWT HMAC Verification decision node added." },
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
