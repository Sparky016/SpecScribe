import { NextRequest, NextResponse } from "next/server";
import { askMeetingRAG } from "../../../../../lib/api";
import { DEMO_TIMELINE } from "../../../../../lib/demoData";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const question = body.question || "";

  // Try FastAPI backend first
  try {
    const res = await fetch(`${API_BASE_URL}/api/meetings/${id}/ask`, {
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
