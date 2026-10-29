// Server-side only. Calls the FastAPI backend with the bearer token.
// SPECSCRIBE_API_TOKEN is deliberately NOT a NEXT_PUBLIC_ variable, so Next.js never
// inlines it into the browser bundle. Only call this from route handlers or server code.

const DEFAULT_BACKEND_URL = "http://localhost:8000";

export async function backendFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = process.env.SPECSCRIBE_API_TOKEN;
  if (!token) {
    throw new Error("SPECSCRIBE_API_TOKEN is not set; cannot call the backend");
  }

  // Bound internal service URL injected by Vercel Services, with fallbacks for local dev
  const backendBase =
    process.env.BACKEND_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    DEFAULT_BACKEND_URL;
  const base = backendBase.endsWith("/") ? backendBase : `${backendBase}/`;
  const cleanPath = path.startsWith("/") ? path.slice(1) : path;

  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);

  return fetch(new URL(cleanPath, base), { ...init, headers });
}
