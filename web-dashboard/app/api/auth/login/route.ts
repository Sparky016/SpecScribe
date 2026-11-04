import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, SESSION_TTL_MS, createSessionToken, getAuthConfig, safeEqual } from "../../../../lib/session";

export async function POST(request: NextRequest) {
  const config = getAuthConfig();
  if (config.mode === "disabled") {
    return NextResponse.json({ ok: true });
  }
  if (config.mode === "misconfigured") {
    return NextResponse.json(
      { error: "Dashboard login is not configured. Set DASHBOARD_PASSWORD and DASHBOARD_SESSION_SECRET." },
      { status: 503 }
    );
  }

  let password = "";
  try {
    const body = await request.json();
    password = typeof body?.password === "string" ? body.password : "";
  } catch {
    // fall through with an empty password
  }

  if (!password || !(await safeEqual(password, config.password))) {
    return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, await createSessionToken(config.secret), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  });
  return response;
}
