"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Download,
  FileCode,
  FileText,
  Sparkles,
  Layers,
  Bot,
  User,
  Check,
  ChevronDown,
  ArrowLeft,
} from "lucide-react";
import { TimelineData } from "../lib/types";
import { LogoutButton } from "./LogoutButton";
import {
  exportDecisionLogJson,
  exportDrawioXml,
  exportTechSpecMd,
  formatTimestamp,
} from "../lib/api";

interface TopBarProps {
  timeline: TimelineData;
  currentSnapshotXml?: string;
  totalDurationMs: number;
  onOpenRAG: () => void;
  isRAGOpen: boolean;
}

export const TopBar: React.FC<TopBarProps> = ({
  timeline,
  currentSnapshotXml,
  totalDurationMs,
  onOpenRAG,
  isRAGOpen,
}) => {
  const [exportOpen, setExportOpen] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState<string | null>(null);

  // Distinct speakers, in order of first appearance
  const speakerLabels = Array.from(
    new Set(timeline.transcript_turns.map((t) => t.speaker_label).filter(Boolean))
  );

  const hasDrawio =Boolean(currentSnapshotXml || timeline.meeting.latest_drawio_xml);
  const hasSpec = Boolean(timeline.meeting.generated_spec_md);

  const handleExport = (type: "drawio" | "md" | "json") => {
    if (type === "drawio") {
      exportDrawioXml(timeline, currentSnapshotXml);
      setDownloadSuccess(".drawio XML");
    } else if (type === "md") {
      exportTechSpecMd(timeline);
      setDownloadSuccess("Tech Spec .md");
    } else if (type === "json") {
      exportDecisionLogJson(timeline);
      setDownloadSuccess("Decision Log .json");
    }
    setExportOpen(false);
    setTimeout(() => setDownloadSuccess(null), 3000);
  };

  return (
    <header className="h-16 border-b border-white/10 bg-[#0a0e14]/90 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between z-30 sticky top-0">
      {/* Left: Brand & Meeting Info */}
      <div className="flex items-center gap-3 sm:gap-4 overflow-hidden">
        <Link
          href="/meetings"
          className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors flex items-center gap-1.5 text-xs font-mono"
          title="Back to your meetings"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="hidden md:inline font-semibold text-[#00FF66]">Meetings</span>
        </Link>

        <div className="h-5 w-px bg-white/15 hidden sm:block" />

        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00FF66] opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#00FF66]" />
            </span>
            <h1 className="text-sm sm:text-base font-bold text-white truncate max-w-[200px] sm:max-w-xs md:max-w-md lg:max-w-lg">
              {timeline.meeting.title}
            </h1>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-gray-400 font-mono">
            <span className="text-gray-300">ID: {timeline.meeting.id.slice(0, 15)}</span>
            <span>•</span>
            <span className="text-[#00E5FF]">Duration: {formatTimestamp(totalDurationMs)}</span>
          </div>
        </div>
      </div>

      {/* Center/Right: Speaker Badges */}
      <div className="hidden lg:flex items-center gap-2">
        {speakerLabels.map((label, i) => (
          <div
            key={label}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium ${
              i % 2 === 0
                ? "bg-[#107C41]/20 border-[#00FF66]/30 text-[#00FF66]"
                : "bg-[#0D47A1]/20 border-[#00E5FF]/30 text-[#00E5FF]"
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>{label}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-xs font-medium text-amber-400">
          <Bot className="w-3.5 h-3.5" />
          <span>Raising-Hand AI</span>
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
        </div>
      </div>

      {/* Right: 1-Click Export & RAG Drawer Button */}
      <div className="flex items-center gap-2 sm:gap-3">
        {downloadSuccess && (
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#00FF66]/20 border border-[#00FF66]/40 text-[#00FF66] text-xs font-mono animate-fade-in">
            <Check className="w-3.5 h-3.5" />
            <span>Downloaded {downloadSuccess}</span>
          </div>
        )}

        {/* 1-Click Export Dropdown */}
        <div className="relative">
          <button
            onClick={() => setExportOpen(!exportOpen)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#141b26] hover:bg-[#1a2332] border border-white/10 hover:border-white/20 text-xs sm:text-sm font-medium text-gray-200 transition-all shadow-sm"
            aria-label="Export artifacts"
          >
            <Download className="w-3.5 h-3.5 text-[#00E5FF]" />
            <span className="hidden sm:inline">1-Click Export</span>
            <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
          </button>

          {exportOpen && (
            <div className="absolute right-0 mt-2 w-56 rounded-xl bg-[#0f1520] border border-white/15 shadow-2xl p-1.5 z-50 text-xs animate-in fade-in slide-in-from-top-2">
              <div className="px-2 py-1.5 text-[10px] font-mono uppercase text-gray-400 tracking-wider">
                Export Verified Artifacts
              </div>
              <button
                onClick={() => handleExport("drawio")}
                disabled={!hasDrawio}
                title={hasDrawio ? undefined : "No diagram available to export"}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-white/5 text-left text-gray-200 hover:text-[#00FF66] transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
              >
                <Layers className="w-4 h-4 text-[#00FF66]" />
                <div className="flex flex-col">
                  <span className="font-semibold">Download .drawio XML</span>
                  <span className="text-[10px] text-gray-400">Interactive architecture canvas</span>
                </div>
              </button>
              <button
                onClick={() => handleExport("md")}
                disabled={!hasSpec}
                title={hasSpec ? undefined : "No tech spec generated yet"}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-white/5 text-left text-gray-200 hover:text-[#00E5FF] transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
              >
                <FileText className="w-4 h-4 text-[#00E5FF]" />
                <div className="flex flex-col">
                  <span className="font-semibold">Export Tech Spec .md</span>
                  <span className="text-[10px] text-gray-400">Gemini-compiled PRD & ADR</span>
                </div>
              </button>
              <button
                onClick={() => handleExport("json")}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-white/5 text-left text-gray-200 hover:text-amber-400 transition-colors"
              >
                <FileCode className="w-4 h-4 text-amber-400" />
                <div className="flex flex-col">
                  <span className="font-semibold">Export Decision Log JSON</span>
                  <span className="text-[10px] text-gray-400">Full audit trail & timestamps</span>
                </div>
              </button>
            </div>
          )}
        </div>

        {/* Ask the Meeting RAG Button */}
        <button
          onClick={onOpenRAG}
          className={`flex items-center gap-2 px-3 sm:px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all shadow-md ${
            isRAGOpen
              ? "bg-[#00FF66] text-black shadow-[#00FF66]/30 shadow-lg"
              : "bg-gradient-to-r from-[#00FF66]/20 to-[#00E5FF]/20 hover:from-[#00FF66]/30 hover:to-[#00E5FF]/30 border border-[#00FF66]/40 text-white"
          }`}
          title="Chat about this meeting"
        >
          <Sparkles className={`w-3.5 h-3.5 ${isRAGOpen ? "text-black" : "text-[#00FF66] animate-pulse"}`} />
          <span>Chat</span>
        </button>

        <LogoutButton compact />
      </div>
    </header>
  );
};
