import { NextRequest, NextResponse } from "next/server";
import { MAX_CHAT_HISTORY_TURNS, MAX_CHAT_TURN_CHARS, askMeetingRAG } from "../../../../../lib/api";
import { ChatTurn } from "../../../../../lib/types";
import { backendFetch } from "../../../../../lib/backend";
import { DEMO_TIMELINE, DEMO_MEETING_ID } from "../../../../../lib/demoData";
import { isValidMeetingId } from "../../../../../lib/meetingId";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!isValidMeetingId(id)) {
    return NextResponse.json({ error: "Invalid meeting id" }, { status: 400 });
  }
  const body = await request.json().catch(() => ({}));
  const question = typeof body?.question === "string" ? body.question.trim() : "";
  if (!question) {
    return NextResponse.json({ error: "Question is required" }, { status: 400 });
  }
  if (body.history !== undefined && !Array.isArray(body.history)) {
    return NextResponse.json({ error: "history must be an array" }, { status: 400 });
  }
  const history: ChatTurn[] = (body.history || [])
    .filter(
      (t: unknown): t is ChatTurn =>
        typeof t === "object" &&
        t !== null &&
        ((t as ChatTurn).role === "user" || (t as ChatTurn).role === "assistant") &&
        typeof (t as ChatTurn).content === "string"
    )
    .slice(-MAX_CHAT_HISTORY_TURNS)
    .map((t: ChatTurn) => ({ role: t.role, content: t.content.slice(0, MAX_CHAT_TURN_CHARS) }));

  // Canned answers are for the offline demo meeting only; no backend call.
  if (id === DEMO_MEETING_ID) {
    return NextResponse.json(await askMeetingRAG(id, question, DEMO_TIMELINE));
  }

  try {
    const res = await backendFetch(`api/meetings/${encodeURIComponent(id)}/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: question.slice(0, 2000), history }),
    });

    if (res.ok) {
      const data = await res.json();
      return NextResponse.json(data);
    }
    console.warn(`Backend RAG query returned status ${res.status}`);
  } catch (err) {
    console.warn("Backend RAG query proxy error:", err);
  }

  return NextResponse.json({ error: "Backend unavailable" }, { status: 502 });
}
