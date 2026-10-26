import { NextRequest, NextResponse } from "next/server";
import { askMeetingRAG } from "../../../../../lib/api";
import { backendFetch } from "../../../../../lib/backend";
import { DEMO_TIMELINE } from "../../../../../lib/demoData";
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

  // Try FastAPI backend first
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
  } catch (err) {
    console.warn("Backend RAG query proxy fallback:", err);
  }

  // Local grounded RAG response
  const localRAG = await askMeetingRAG(id, question, DEMO_TIMELINE);
  return NextResponse.json(localRAG);
}

