import { NextRequest, NextResponse } from "next/server";
import { askMeetingRAG } from "../../../../../lib/api";
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
  const body = await request.json();
  const question = body.question || "";

  // Canned answers are for the offline demo meeting only; no backend call.
  if (id === DEMO_MEETING_ID) {
    return NextResponse.json(await askMeetingRAG(id, question, DEMO_TIMELINE));
  }

  try {
    const res = await backendFetch(`api/meetings/${encodeURIComponent(id)}/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question }),
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
