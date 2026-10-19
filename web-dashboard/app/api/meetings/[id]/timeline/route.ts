import { NextRequest, NextResponse } from "next/server";
import { DEMO_TIMELINE, DEMO_MEETING_ID } from "../../../../../lib/demoData";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (id === DEMO_MEETING_ID || id === "demo") {
    return NextResponse.json(DEMO_TIMELINE);
  }

  try {
    const res = await fetch(`${API_BASE_URL}/api/meetings/${id}/timeline`, {
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
    });

    if (res.ok) {
      const data = await res.json();
      return NextResponse.json(data);
    }
  } catch (err) {
    console.warn("Backend timeline route proxy error, falling back to demo:", err);
  }

  return NextResponse.json({
    ...DEMO_TIMELINE,
    meeting: {
      ...DEMO_TIMELINE.meeting,
      id,
      title: `Meeting ${id.slice(0, 8)}: Architecture Review`,
    },
  });
}
