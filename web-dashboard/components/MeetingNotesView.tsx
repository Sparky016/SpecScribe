"use client";

import React, { useState } from "react";
import {
  FileText,
  Copy,
  Check,
  Download,
  Sparkles,
  Clock,
  Layers,
  Database,
  ShieldAlert,
  Loader2,
} from "lucide-react";
import { downloadFile, formatTimestamp } from "../lib/api";

interface MeetingNotesViewProps {
  specMd?: string | null;
  meetingId: string;
  meetingTitle: string;
  onSeek: (timestampMs: number) => void;
  onFinalize?: () => Promise<void>;
}

export const MeetingNotesView: React.FC<MeetingNotesViewProps> = ({
  specMd,
  meetingId,
  meetingTitle,
  onSeek,
  onFinalize,
}) => {
  const [copied, setCopied] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [finalizeError, setFinalizeError] = useState<string | null>(null);

  const handleCopy = async () => {
    if (!specMd) return;
    try {
      await navigator.clipboard.writeText(specMd);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handleDownload = () => {
    if (!specMd) return;
    downloadFile(specMd, `${meetingId}-tech-spec.md`, "text/markdown");
  };

  const handleTriggerFinalize = async () => {
    if (!onFinalize || isFinalizing) return;
    setIsFinalizing(true);
    setFinalizeError(null);
    try {
      await onFinalize();
    } catch (err) {
      console.warn("Finalize failed:", err);
      setFinalizeError("Could not compile meeting notes. Please check the backend connection.");
    } finally {
      setIsFinalizing(false);
    }
  };

  if (!specMd) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-[#0a0e14]">
        <div className="p-4 rounded-2xl bg-white/5 border border-white/10 text-gray-300 max-w-md flex flex-col items-center gap-3">
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300">
            <FileText className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-white">Meeting Notes Not Yet Compiled</h3>
          <p className="text-xs text-gray-400 leading-relaxed">
            The AI Technical Specification and Executive Summary are generated when the meeting is finalized.
          </p>
          {finalizeError && (
            <div className="text-xs text-red-300 bg-red-500/10 border border-red-500/30 px-3 py-1.5 rounded-lg">
              {finalizeError}
            </div>
          )}
          {onFinalize && (
            <button
              onClick={handleTriggerFinalize}
              disabled={isFinalizing}
              className="mt-2 flex items-center gap-2 px-4 py-2 rounded-xl bg-[#00FF66] hover:bg-[#00e55c] disabled:opacity-50 text-black font-semibold text-xs transition-all shadow-md shadow-[#00FF66]/20"
            >
              {isFinalizing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5" />
              )}
              <span>{isFinalizing ? "Compiling Spec with Gemini…" : "Generate Meeting Notes Now"}</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#0a0e14]">
      {/* Sub-header with metadata and action buttons */}
      <div className="px-4 py-2.5 border-b border-white/10 bg-[#0d121b]/90 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono uppercase tracking-wider text-gray-400 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-[#00E5FF]" />
            AI-Compiled Technical Specification
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 hover:text-white text-xs transition-colors"
            title="Copy Markdown text"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-[#00FF66]" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? "Copied" : "Copy"}</span>
          </button>
          <button
            onClick={handleDownload}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[#00E5FF] hover:bg-[#00E5FF]/10 text-xs transition-colors"
            title="Download .md file"
          >
            <Download className="w-3.5 h-3.5" />
            <span>.md</span>
          </button>
        </div>
      </div>

      {/* Rendered Markdown Body */}
      <div className="flex-1 overflow-y-auto p-5 text-gray-200 space-y-4 text-xs leading-relaxed selection:bg-[#00FF66] selection:text-black">
        <FormattedSpecContent content={specMd} onSeek={onSeek} />
      </div>
    </div>
  );
};

// Formatter to render Markdown sections, tables, and timestamp pills
function FormattedSpecContent({
  content,
  onSeek,
}: {
  content: string;
  onSeek: (ms: number) => void;
}) {
  const lines = content.split("\n");
  const renderedElements: React.ReactNode[] = [];
  let tableRows: string[] = [];
  let inTable = false;

  const flushTable = (key: string) => {
    if (tableRows.length === 0) return;
    const headerRow = tableRows[0];
    const dataRows = tableRows.slice(2); // Skip separator row
    const headers = headerRow.split("|").map((h) => h.trim()).filter(Boolean);

    renderedElements.push(
      <div key={key} className="overflow-x-auto my-3 border border-white/15 rounded-xl bg-[#090d15]">
        <table className="w-full text-left text-[11px] border-collapse">
          <thead>
            <tr className="border-b border-white/15 bg-white/5 text-gray-300">
              {headers.map((h, hIdx) => (
                <th key={hIdx} className="px-3 py-2 font-semibold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 text-gray-300">
            {dataRows.map((row, rIdx) => {
              const cells = row.split("|").map((c) => c.trim()).filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
              return (
                <tr key={rIdx} className="hover:bg-white/[0.02] transition-colors">
                  {cells.map((cell, cIdx) => (
                    <td key={cIdx} className="px-3 py-2 font-mono text-[10.5px]">
                      <InlineText text={cell} onSeek={onSeek} />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
    tableRows = [];
    inTable = false;
  };

  lines.forEach((line, index) => {
    const trimmed = line.trim();

    // Table detection
    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      inTable = true;
      tableRows.push(trimmed);
      return;
    } else if (inTable) {
      flushTable(`table-${index}`);
    }

    if (trimmed.startsWith("# ")) {
      renderedElements.push(
        <h1 key={index} className="text-base sm:text-lg font-black text-white pt-2 pb-1 border-b border-white/15">
          <InlineText text={trimmed.slice(2)} onSeek={onSeek} />
        </h1>
      );
    } else if (trimmed.startsWith("## ")) {
      renderedElements.push(
        <h2 key={index} className="text-sm font-bold text-[#00FF66] pt-4 pb-1 border-b border-white/10 flex items-center gap-1.5">
          <InlineText text={trimmed.slice(3)} onSeek={onSeek} />
        </h2>
      );
    } else if (trimmed.startsWith("### ")) {
      renderedElements.push(
        <h3 key={index} className="text-xs font-bold text-[#00E5FF] pt-2">
          <InlineText text={trimmed.slice(4)} onSeek={onSeek} />
        </h3>
      );
    } else if (trimmed.startsWith("---")) {
      renderedElements.push(<hr key={index} className="border-white/10 my-3" />);
    } else if (trimmed.startsWith("* ") || trimmed.startsWith("- ")) {
      renderedElements.push(
        <li key={index} className="ml-4 list-disc text-gray-300 pl-1 py-0.5">
          <InlineText text={trimmed.slice(2)} onSeek={onSeek} />
        </li>
      );
    } else if (/^\d+\.\s/.test(trimmed)) {
      const match = trimmed.match(/^(\d+\.)\s(.*)/);
      if (match) {
        renderedElements.push(
          <div key={index} className="flex items-start gap-2 py-1 pl-1">
            <span className="font-mono text-[#00FF66] font-bold shrink-0">{match[1]}</span>
            <div className="flex-1">
              <InlineText text={match[2]} onSeek={onSeek} />
            </div>
          </div>
        );
      }
    } else if (trimmed.length > 0) {
      renderedElements.push(
        <p key={index} className="text-gray-300 leading-relaxed">
          <InlineText text={trimmed} onSeek={onSeek} />
        </p>
      );
    }
  });

  if (inTable) {
    flushTable("table-end");
  }

  return <div className="space-y-2">{renderedElements}</div>;
}

// Inline parser for bold, inline code, and clickable timestamp pills [MM:SS]
function InlineText({
  text,
  onSeek,
}: {
  text: string;
  onSeek: (ms: number) => void;
}) {
  const parts = text.split(/(\[\d{2}:\d{2}\]|`[^`]+`|\*\*[^*]+\*\*)/g);

  return (
    <>
      {parts.map((part, idx) => {
        // Timestamp Pill [MM:SS]
        const tsMatch = part.match(/\[(\d{2}):(\d{2})\]/);
        if (tsMatch) {
          const mins = parseInt(tsMatch[1], 10);
          const secs = parseInt(tsMatch[2], 10);
          const ms = (mins * 60 + secs) * 1000;
          return (
            <button
              key={idx}
              onClick={() => onSeek(ms)}
              className="inline-flex items-center gap-1 mx-1 px-1.5 py-0.5 rounded font-mono text-[10px] font-bold bg-[#00E5FF]/20 text-[#00E5FF] hover:bg-[#00E5FF] hover:text-black border border-[#00E5FF]/40 transition-colors align-baseline"
              title={`Jump timeline to ${tsMatch[1]}:${tsMatch[2]}`}
            >
              <Clock className="w-2.5 h-2.5" />
              <span>{part}</span>
            </button>
          );
        }

        // Inline Code `...`
        if (part.startsWith("`") && part.endsWith("`")) {
          return (
            <code key={idx} className="font-mono bg-white/10 px-1 py-0.5 rounded text-[10.5px] text-[#00FF66]">
              {part.slice(1, -1)}
            </code>
          );
        }

        // Bold **...**
        if (part.startsWith("**") && part.endsWith("**")) {
          return (
            <strong key={idx} className="font-bold text-white">
              {part.slice(2, -2)}
            </strong>
          );
        }

        return <span key={idx}>{part}</span>;
      })}
    </>
  );
}

