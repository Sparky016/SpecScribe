"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Glasses,
  Loader2,
  Radio,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { finalizeMeeting, listMeetings } from "../../lib/api";
import { MeetingSummary } from "../../lib/types";
import { LogoutButton } from "../../components/LogoutButton";

function formatDate(value?: string | null): string {
  if (!value) return "Unknown date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown date";
  return date.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

export default function MeetingsPage() {
  const [meetings, setMeetings] = useState<MeetingSummary[] | null>(null);
  const [backendUnavailable, setBackendUnavailable] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [finalizing, setFinalizing] = useState<string | null>(null);
  const [finalizeError, setFinalizeError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await listMeetings();
      setMeetings(data.meetings);
      setBackendUnavailable(Boolean(data.backend_unavailable));
    } catch (err) {
      console.warn("Meeting list failed:", err);
      setError("Could not load meetings.");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleFinalize = async (id: string) => {
    setFinalizing(id);
    setFinalizeError(null);
    try {
      await finalizeMeeting(id);
      await load();
    } catch (err) {
      console.warn("Finalize failed:", err);
      setFinalizeError("Could not finalize this meeting. Try again.");
    } finally {
      setFinalizing(null);
    }
  };

  const captured = meetings?.filter((m) => !m.is_demo) ?? [];
  const demo = meetings?.filter((m) => m.is_demo) ?? [];

  return (
    <main className="min-h-screen bg-[#070a0f] text-gray-100">
      <header className="px-6 py-5 border-b border-white/10 flex items-center justify-between backdrop-blur-md">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-[#00FF66]/10 border border-[#00FF66]/30 text-[#00FF66]">
            <Glasses className="w-5 h-5" />
          </div>
          <span className="text-base font-extrabold tracking-tight text-white">
            SpecScribe <span className="text-[#00FF66]">AR</span>
          </span>
        </Link>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <LogoutButton />
        </div>
      </header>

      <section className="max-w-4xl mx-auto px-6 py-10">
        <h1 className="text-2xl font-black text-white">Your meetings</h1>
        <p className="mt-1 text-sm text-gray-400">
          Meetings captured with Spectacles. Open one to replay the diagram, read the transcript and chat about it.
        </p>

        {backendUnavailable && (
          <div role="status" className="mt-6 px-4 py-3 rounded-xl border border-amber-400/40 bg-amber-400/10 text-xs text-amber-200">
            The backend is unavailable, so captured meetings can&apos;t be listed right now. The demo meeting still works.
          </div>
        )}
        {finalizeError && (
          <div role="alert" className="mt-6 px-4 py-3 rounded-xl border border-red-500/40 bg-red-500/10 text-xs text-red-200">
            {finalizeError}
          </div>
        )}

        {error ? (
          <div role="alert" className="mt-8 flex items-center gap-3 px-4 py-3 rounded-xl border border-red-500/40 bg-red-500/10 text-sm">
            <span>{error}</span>
            <button onClick={load} className="px-3 py-1 rounded-lg bg-[#141b26] border border-white/15 text-xs">
              Retry
            </button>
          </div>
        ) : meetings === null ? (
          <div role="status" aria-label="Loading meetings" className="mt-8 flex flex-col gap-3 animate-pulse">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-20 rounded-2xl bg-white/5" />
            ))}
          </div>
        ) : (
          <>
            <ul className="mt-8 flex flex-col gap-3">
              {captured.length === 0 && !backendUnavailable && (
                <li className="px-5 py-6 rounded-2xl border border-dashed border-white/15 text-sm text-gray-400 text-center">
                  No captured meetings yet. Start a session in the SpecScribe lens and it will appear here.
                </li>
              )}
              {captured.map((m) => (
                <MeetingRow
                  key={m.id}
                  meeting={m}
                  finalizing={finalizing === m.id}
                  onFinalize={() => handleFinalize(m.id)}
                />
              ))}
            </ul>

            {demo.length > 0 && (
              <>
                <h2 className="mt-10 text-xs font-mono uppercase tracking-wider text-gray-500">Sample</h2>
                <ul className="mt-3 flex flex-col gap-3">
                  {demo.map((m) => (
                    <MeetingRow key={m.id} meeting={m} finalizing={false} onFinalize={() => {}} />
                  ))}
                </ul>
              </>
            )}
          </>
        )}
      </section>
    </main>
  );
}

function MeetingRow({
  meeting,
  finalizing,
  onFinalize,
}: {
  meeting: MeetingSummary;
  finalizing: boolean;
  onFinalize: () => void;
}) {
  return (
    <li className="flex flex-wrap items-center gap-4 px-5 py-4 rounded-2xl bg-[#0d121c]/90 border border-white/10 hover:border-[#00FF66]/40 transition-colors">
      <div className="flex-1 min-w-[200px]">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-bold text-white">{meeting.title}</span>
          {meeting.is_demo && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono border border-[#00E5FF]/40 bg-[#00E5FF]/10 text-[#00E5FF]">
              DEMO
            </span>
          )}
          {meeting.is_live && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono border border-red-400/40 bg-red-400/10 text-red-300">
              <Radio className="w-3 h-3" /> LIVE
            </span>
          )}
          {meeting.finalized && !meeting.is_demo && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono border border-[#00FF66]/40 bg-[#00FF66]/10 text-[#00FF66]">
              <CheckCircle2 className="w-3 h-3" /> FINALIZED
            </span>
          )}
        </div>
        <div className="mt-1 flex items-center gap-1.5 text-xs text-gray-400">
          <CalendarClock className="w-3.5 h-3.5" />
          {formatDate(meeting.created_at)}
        </div>
      </div>

      {!meeting.is_demo && !meeting.finalized && !meeting.is_live && (
        <button
          onClick={onFinalize}
          disabled={finalizing}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-xs text-gray-200 disabled:opacity-50"
          title="Compile the tech spec and index the meeting for chat"
        >
          {finalizing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 text-amber-300" />}
          {finalizing ? "Finalizing…" : "Finalize"}
        </button>
      )}

      <Link
        href={`/meetings/${encodeURIComponent(meeting.id)}`}
        className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#00FF66] hover:bg-[#00e55c] text-black font-semibold text-xs transition-all"
      >
        Open
        <ArrowRight className="w-3.5 h-3.5" />
      </Link>
    </li>
  );
}
