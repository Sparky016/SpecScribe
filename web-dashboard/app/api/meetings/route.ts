import { NextResponse } from "next/server";
import { backendFetch } from "../../../lib/backend";
import { DEMO_TIMELINE, DEMO_MEETING_ID } from "../../../lib/demoData";
import { MeetingListResponse, MeetingSummary } from "../../../lib/types";

const DEMO_SUMMARY: MeetingSummary = {
  id: DEMO_MEETING_ID,
  title: DEMO_TIMELINE.meeting.title,
  created_at: DEMO_TIMELINE.meeting.created_at,
  finalized: true,
  is_live: false,
  is_demo: true,
};

export async function GET() {
  try {
    const res = await backendFetch("api/meetings?limit=100", {
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
    });
    if (res.ok) {
      const data = await res.json();
      const meetings: MeetingSummary[] = Array.isArray(data?.meetings) ? data.meetings : [];
      const body: MeetingListResponse = { meetings: [...meetings, DEMO_SUMMARY] };
      return NextResponse.json(body);
    }
    console.warn(`Backend meeting list returned status ${res.status}`);
  } catch (err) {
    console.warn("Backend meeting list proxy error:", err);
  }

  const fallback: MeetingListResponse = { meetings: [DEMO_SUMMARY], backend_unavailable: true };
  return NextResponse.json(fallback);
}
