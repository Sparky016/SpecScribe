"use client";

import React, { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Glasses, Lock, LogIn } from "lucide-react";
import { safeNextPath } from "../../lib/session";

function LoginForm() {
  const searchParams = useSearchParams();
  const nextPath = safeNextPath(searchParams.get("next"));
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        // Full navigation so the middleware sees the new cookie.
        window.location.assign(nextPath);
        return;
      }
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Sign-in failed");
    } catch {
      setError("Could not reach the server. Try again.");
    }
    setSubmitting(false);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full max-w-sm p-6 rounded-2xl bg-[#0d121c]/95 border border-white/10 shadow-2xl flex flex-col gap-4"
    >
      <div className="flex items-center gap-2.5">
        <div className="p-2 rounded-xl bg-[#00FF66]/10 border border-[#00FF66]/30 text-[#00FF66]">
          <Glasses className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-base font-extrabold tracking-tight text-white">
            SpecScribe <span className="text-[#00FF66]">AR</span>
          </h1>
          <p className="text-[11px] text-gray-400">Sign in to review your captured meetings</p>
        </div>
      </div>

      <label className="flex flex-col gap-1.5 text-xs text-gray-300">
        <span className="flex items-center gap-1.5">
          <Lock className="w-3.5 h-3.5 text-[#00E5FF]" />
          Team password
        </span>
        <input
          type="password"
          autoFocus
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="bg-[#080c14] border border-white/15 focus:border-[#00FF66] rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none transition-colors"
          placeholder="••••••••"
        />
      </label>

      {error && (
        <div role="alert" className="px-3 py-2 rounded-lg border border-red-500/40 bg-red-500/10 text-xs text-red-200">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={!password || submitting}
        className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#00FF66] hover:bg-[#00e55c] disabled:opacity-40 text-black font-bold text-sm transition-all"
      >
        <LogIn className="w-4 h-4" />
        {submitting ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-[#070a0f] text-gray-100 flex items-center justify-center px-4">
      <div className="fixed inset-0 pointer-events-none opacity-25">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-gradient-to-tr from-[#00FF66]/20 to-[#00E5FF]/20 rounded-full blur-[140px]" />
      </div>
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
