import { NextRequest, NextResponse } from "next/server";
import { backendFetch } from "../../../../../lib/backend";
import { DEMO_TIMELINE, DEMO_MEETING_ID } from "../../../../../lib/demoData";
import { isValidMeetingId } from "../../../../../lib/meetingId";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!isValidMeetingId(id)) {
    return NextResponse.json({ error: "Invalid meeting id" }, { status: 400 });
  }

  if (id === DEMO_MEETING_ID || id === "demo") {
    return NextResponse.json(DEMO_TIMELINE);
  }

  try {
    const query = new URLSearchParams();
    for (const key of ["limit", "offset", "from_ms", "to_ms"]) {
      const value = request.nextUrl.searchParams.get(key);
      if (value !== null) query.set(key, value);
    }
    const suffix = query.toString() ? `?${query.toString()}` : "";
    const res = await backendFetch(`api/meetings/${encodeURIComponent(id)}/timeline${suffix}`, {
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
    });

    if (res.ok) {
      const data = await res.json();
      return NextResponse.json(data);
    }
    console.warn(`Backend timeline returned status ${res.status}`);
  } catch (err) {
    console.warn("Backend timeline route proxy error:", err);
  }

  return NextResponse.json({ error: "Backend unavailable" }, { status: 502 });
}
