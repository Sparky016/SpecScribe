// Shared-password dashboard login: a signed, expiring session cookie.
// Uses Web Crypto only, so it runs in both the Edge middleware and Node route handlers.
// Env (server-side only): DASHBOARD_PASSWORD, DASHBOARD_SESSION_SECRET.
// DASHBOARD_AUTH_DISABLED=1 skips login, but only outside production.

export const SESSION_COOKIE = "specscribe_session";
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const encoder = new TextEncoder();

export type AuthConfig =
  | { mode: "enabled"; password: string; secret: string }
  | { mode: "disabled" }
  | { mode: "misconfigured" };

export function getAuthConfig(): AuthConfig {
  const password = process.env.DASHBOARD_PASSWORD || "";
  const secret = process.env.DASHBOARD_SESSION_SECRET || "";
  if (password && secret) return { mode: "enabled", password, secret };
  if (process.env.DASHBOARD_AUTH_DISABLED === "1" && process.env.NODE_ENV !== "production") {
    return { mode: "disabled" };
  }
  return { mode: "misconfigured" };
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hmac(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return toBase64Url(new Uint8Array(sig));
}

// Constant-time comparison over the SHA-256 digests, so lengths never leak.
export async function safeEqual(a: string, b: string): Promise<boolean> {
  const [da, db] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(a)),
    crypto.subtle.digest("SHA-256", encoder.encode(b)),
  ]);
  const va = new Uint8Array(da);
  const vb = new Uint8Array(db);
  let diff = 0;
  for (let i = 0; i < va.length; i++) diff |= va[i] ^ vb[i];
  return diff === 0;
}

export async function createSessionToken(secret: string, now: number = Date.now()): Promise<string> {
  const expires = String(now + SESSION_TTL_MS);
  return `${expires}.${await hmac(secret, expires)}`;
}

export async function verifySessionToken(
  token: string | undefined,
  secret: string,
  now: number = Date.now()
): Promise<boolean> {
  if (!token) return false;
  const [expires, signature] = token.split(".");
  if (!expires || !signature || !/^\d+$/.test(expires)) return false;
  if (Number(expires) <= now) return false;
  return safeEqual(signature, await hmac(secret, expires));
}

// Only same-origin relative paths are accepted as post-login redirects.
export function safeNextPath(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) {
    return "/meetings";
  }
  return next;
}
