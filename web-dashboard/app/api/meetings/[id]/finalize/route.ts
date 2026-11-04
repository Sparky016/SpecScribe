import { NextRequest, NextResponse } from "next/server";
import { backendFetch } from "../../../../../lib/backend";
import { DEMO_MEETING_ID } from "../../../../../lib/demoData";
import { isValidMeetingId } from "../../../../../lib/meetingId";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!isValidMeetingId(id) || id === DEMO_MEETING_ID || id === "demo") {
    return NextResponse.json({ error: "Invalid meeting id" }, { status: 400 });
  }

  try {
    const res = await backendFetch(`api/meetings/${encodeURIComponent(id)}/finalize`, { method: "POST" });
    if (res.ok) {
      const data = await res.json();
      // The full spec is fetched with the timeline; only report the summary here.
      return NextResponse.json({ meeting_id: data.meeting_id, chunks_created: data.chunks_created });
    }
    return NextResponse.json({ error: "Finalize failed" }, { status: res.status === 404 ? 404 : 502 });
  } catch (err) {
    console.warn("Backend finalize proxy error:", err);
  }
  return NextResponse.json({ error: "Backend unavailable" }, { status: 502 });
}
