import { NextRequest, NextResponse } from "next/server";
import { askMeetingRAG } from "../../../../../lib/api";
import { DEMO_TIMELINE } from "../../../../../lib/demoData";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const question = body.question || "";

  // Bound internal service URL injected by Vercel Services, with fallbacks for local dev
  const backendBase =
    process.env.BACKEND_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    "http://localhost:8000";

  // Try FastAPI backend first
  try {
    const targetUrl = new URL(
      `api/meetings/${id}/ask`,
      backendBase.endsWith("/") ? backendBase : `${backendBase}/`
    );
    const res = await fetch(targetUrl, {
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

