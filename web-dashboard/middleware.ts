import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, getAuthConfig, verifySessionToken } from "./lib/session";

// Everything except the public landing page, the login page and the auth API needs a session.
const PUBLIC_PATHS = new Set(["/", "/login"]);

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (PUBLIC_PATHS.has(pathname) || pathname.startsWith("/api/auth/")) {
    return NextResponse.next();
  }

  const config = getAuthConfig();
  if (config.mode === "disabled") return NextResponse.next();

  const authed =
    config.mode === "enabled" &&
    (await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value, config.secret));
  if (authed) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    const error = config.mode === "misconfigured" ? "Dashboard login is not configured" : "Not signed in";
    return NextResponse.json({ error }, { status: 401 });
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
