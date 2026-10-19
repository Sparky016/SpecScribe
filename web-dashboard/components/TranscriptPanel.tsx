"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  MessageSquare,
  Bot,
  User,
  ShieldAlert,
  AlertTriangle,
  Lightbulb,
  Search,
  Clock,
  Pin,
  Filter,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import {
  AgentIntervention,
  DiagramSnapshot,
  InterventionCategory,
  TimelineData,
  TranscriptTurn,
} from "../lib/types";
import { formatTimestamp } from "../lib/api";

interface TranscriptPanelProps {
  timeline: TimelineData;
  currentTimeMs: number;
  onSeek: (timestampMs: number) => void;
}

type StreamItem =
  | { type: "TURN"; data: TranscriptTurn; timestamp_ms: number }
  | { type: "INTERVENTION"; data: AgentIntervention; timestamp_ms: number }
  | { type: "SNAPSHOT"; data: DiagramSnapshot; timestamp_ms: number };

export const TranscriptPanel: React.FC<TranscriptPanelProps> = ({
  timeline,
  currentTimeMs,
  onSeek,
}) => {
  const [filter, setFilter] = useState<"ALL" | "TURNS" | "AI" | "DECISIONS">("ALL");
  const activeItemRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Merge and sort all events into a unified chronological stream
  const streamItems: StreamItem[] = useMemo(() => {
    const turns: StreamItem[] = timeline.transcript_turns.map((t) => ({
      type: "TURN",
      data: t,
      timestamp_ms: t.timestamp_ms,
    }));

    const interventions: StreamItem[] = timeline.agent_interventions.map((i) => ({
      type: "INTERVENTION",
      data: i,
      timestamp_ms: i.timestamp_ms,
    }));

    const snapshots: StreamItem[] = timeline.diagram_snapshots.map((s) => ({
      type: "SNAPSHOT",
      data: s,
      timestamp_ms: s.timestamp_ms,
    }));

    const merged = [...turns, ...interventions, ...snapshots];
    merged.sort((a, b) => a.timestamp_ms - b.timestamp_ms);
    return merged;
  }, [timeline]);

  // Filter items
  const filteredItems = useMemo(() => {
    if (filter === "TURNS") return streamItems.filter((i) => i.type === "TURN");
    if (filter === "AI") return streamItems.filter((i) => i.type === "INTERVENTION");
    if (filter === "DECISIONS") return streamItems.filter((i) => i.type === "SNAPSHOT");
    return streamItems;
  }, [streamItems, filter]);

  // Determine which item is currently "active" relative to currentTimeMs
  const activeIndex = useMemo(() => {
    let index = -1;
    for (let i = 0; i < filteredItems.length; i++) {
      if (filteredItems[i].timestamp_ms <= currentTimeMs) {
        index = i;
      } else {
        break;
      }
    }
    return index;
  }, [filteredItems, currentTimeMs]);

  // Smooth scroll active item into view
  useEffect(() => {
    if (activeItemRef.current && containerRef.current) {
      activeItemRef.current.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }
  }, [activeIndex]);

  return (
    <div className="w-full h-full bg-[#0a0e14] flex flex-col overflow-hidden">
      {/* Header and Filter Tabs */}
      <div className="p-3.5 border-b border-white/10 bg-[#0d121b]/80 backdrop-blur-md flex flex-col gap-2.5 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-[#00FF66]" />
            <h2 className="text-xs sm:text-sm font-bold text-white tracking-wide">
              SYNCHRONIZED AUDIT LOG
            </h2>
          </div>
          <span className="text-[11px] font-mono text-gray-400">
            {filteredItems.length} items
          </span>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
          <button
            onClick={() => setFilter("ALL")}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
              filter === "ALL"
                ? "bg-white/15 text-white font-semibold"
                : "text-gray-400 hover:text-white hover:bg-white/5"
            }`}
          >
            All Stream
          </button>
          <button
            onClick={() => setFilter("TURNS")}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
              filter === "TURNS"
                ? "bg-[#00FF66]/20 text-[#00FF66] font-semibold border border-[#00FF66]/30"
                : "text-gray-400 hover:text-white hover:bg-white/5"
            }`}
          >
            Diarized Dialogue
          </button>
          <button
            onClick={() => setFilter("AI")}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors whitespace-nowrap flex items-center gap-1 ${
              filter === "AI"
                ? "bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/30"
                : "text-gray-400 hover:text-white hover:bg-white/5"
            }`}
          >
            <Bot className="w-3 h-3 text-amber-400" />
            <span>AI Critiques</span>
          </button>
          <button
            onClick={() => setFilter("DECISIONS")}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
              filter === "DECISIONS"
                ? "bg-[#00E5FF]/20 text-[#00E5FF] font-semibold border border-[#00E5FF]/30"
                : "text-gray-400 hover:text-white hover:bg-white/5"
            }`}
          >
            Decisions
          </button>
        </div>
      </div>

      {/* Chronological Event Stream */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto p-4 space-y-3.5 scroll-smooth"
      >
        {filteredItems.map((item, idx) => {
          const isActive = idx === activeIndex;

          if (item.type === "TURN") {
            return (
              <TurnCard
                key={item.data.id}
                turn={item.data}
                isActive={isActive}
                onSeek={() => onSeek(item.timestamp_ms)}
                ref={isActive ? activeItemRef : undefined}
              />
            );
          }

          if (item.type === "INTERVENTION") {
            return (
              <InterventionCard
                key={item.data.id}
                intervention={item.data}
                isActive={isActive}
                onSeek={() => onSeek(item.timestamp_ms)}
                ref={isActive ? activeItemRef : undefined}
              />
            );
          }

          if (item.type === "SNAPSHOT") {
            return (
              <SnapshotCard
                key={item.data.id}
                snapshot={item.data}
                isActive={isActive}
                onSeek={() => onSeek(item.timestamp_ms)}
                ref={isActive ? activeItemRef : undefined}
              />
            );
          }

          return null;
        })}
      </div>
    </div>
  );
};

// Sub-Component: Speaker Dialogue Turn Card
const TurnCard = React.forwardRef<
  HTMLDivElement,
  { turn: TranscriptTurn; isActive: boolean; onSeek: () => void }
>(({ turn, isActive, onSeek }, ref) => {
  const isSpeaker0 = turn.speaker_label.includes("0") || turn.speaker_label.includes("Ruan");
  const speakerColor = isSpeaker0 ? "text-[#00FF66]" : "text-[#00E5FF]";
  const avatarBg = isSpeaker0 ? "bg-[#107C41]/30 border-[#00FF66]/40" : "bg-[#0D47A1]/30 border-[#00E5FF]/40";

  return (
    <div
      ref={ref}
      onClick={onSeek}
      className={`p-3 rounded-xl cursor-pointer transition-all duration-200 border ${
        isActive
          ? "bg-[#131b27] border-[#00FF66] shadow-[0_0_15px_rgba(0,255,102,0.15)] ring-1 ring-[#00FF66]/50"
          : "bg-[#0d121a]/90 hover:bg-[#121924] border-white/10 hover:border-white/20"
      }`}
    >
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-2">
          <div className={`w-5 h-5 rounded-full flex items-center justify-center border text-[10px] ${avatarBg} ${speakerColor}`}>
            <User className="w-3 h-3" />
          </div>
          <span className={`text-xs font-semibold ${speakerColor}`}>
            {turn.speaker_label}
          </span>
        </div>
        <div className="flex items-center gap-1.5 font-mono text-[11px]">
          {isActive && (
            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#00FF66]/20 text-[#00FF66] border border-[#00FF66]/40 animate-pulse">
              ACTIVE
            </span>
          )}
          <span className="text-gray-400 hover:text-white">
            [{formatTimestamp(turn.timestamp_ms)}]
          </span>
        </div>
      </div>
      <p className="text-xs text-gray-200 leading-relaxed pl-7">
        {turn.transcript_text}
      </p>
    </div>
  );
});
TurnCard.displayName = "TurnCard";

// Sub-Component: Raising-Hand AI Agent Intervention Card
const InterventionCard = React.forwardRef<
  HTMLDivElement,
  { intervention: AgentIntervention; isActive: boolean; onSeek: () => void }
>(({ intervention, isActive, onSeek }, ref) => {
  const { icon, badgeBg, borderColor, textColor, glowColor } = getCategoryConfig(
    intervention.category
  );

  return (
    <div
      ref={ref}
      onClick={onSeek}
      className={`p-3.5 rounded-xl cursor-pointer transition-all duration-200 border ${
        isActive
          ? `bg-[#1a1412] ${borderColor} ring-1 ring-amber-400 shadow-[0_0_18px_rgba(245,158,11,0.2)]`
          : `bg-[#131114] hover:bg-[#171419] ${borderColor}/60 hover:${borderColor}`
      }`}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-lg ${badgeBg} ${textColor}`}>
            {icon}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className={`text-xs font-bold ${textColor}`}>
                {intervention.short_title}
              </span>
              {intervention.was_pinched && (
                <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-amber-400/20 text-amber-300 border border-amber-400/40 flex items-center gap-0.5">
                  <Pin className="w-2.5 h-2.5" />
                  Pinched
                </span>
              )}
            </div>
            <span className="text-[10px] font-mono uppercase text-gray-400">
              Raising-Hand Intervention • {intervention.category}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 font-mono text-[11px]">
          {isActive && (
            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-400/20 text-amber-300 border border-amber-400/40 animate-pulse">
              ACTIVE
            </span>
          )}
          <span className="text-amber-400 font-semibold">
            [{formatTimestamp(intervention.timestamp_ms)}]
          </span>
        </div>
      </div>

      <p className="text-xs text-gray-300 leading-relaxed pl-8">
        {intervention.detailed_body}
      </p>
    </div>
  );
});
InterventionCard.displayName = "InterventionCard";

// Sub-Component: Diagram Snapshot Milestone Card
const SnapshotCard = React.forwardRef<
  HTMLDivElement,
  { snapshot: DiagramSnapshot; isActive: boolean; onSeek: () => void }
>(({ snapshot, isActive, onSeek }, ref) => {
  return (
    <div
      ref={ref}
      onClick={onSeek}
      className={`p-2.5 rounded-xl cursor-pointer transition-all duration-200 border ${
        isActive
          ? "bg-[#0b1722] border-[#00E5FF] ring-1 ring-[#00E5FF]/40 shadow-[0_0_15px_rgba(0,229,255,0.15)]"
          : "bg-[#0a1017]/80 hover:bg-[#0f1722] border-white/10 hover:border-[#00E5FF]/30"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[#00E5FF] animate-pulse" />
          <span className="text-xs font-semibold text-gray-200">
            {snapshot.diff_summary}
          </span>
        </div>
        <span className="text-[11px] font-mono text-[#00E5FF]">
          [{formatTimestamp(snapshot.timestamp_ms)}]
        </span>
      </div>
      {snapshot.decision_rationale && (
        <p className="text-[11px] text-gray-400 mt-1 pl-4 line-clamp-1 italic">
          &ldquo;{snapshot.decision_rationale}&rdquo;
        </p>
      )}
    </div>
  );
});
SnapshotCard.displayName = "SnapshotCard";

function getCategoryConfig(category: InterventionCategory) {
  switch (category) {
    case "VULNERABILITY":
      return {
        icon: <ShieldAlert className="w-3.5 h-3.5 text-red-400" />,
        badgeBg: "bg-red-500/20",
        borderColor: "border-red-500/40",
        textColor: "text-red-400",
        glowColor: "rgba(239, 68, 68, 0.2)",
      };
    case "LOGIC_FLAW":
      return {
        icon: <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />,
        badgeBg: "bg-amber-500/20",
        borderColor: "border-amber-500/40",
        textColor: "text-amber-400",
        glowColor: "rgba(245, 158, 11, 0.2)",
      };
    case "ALTERNATIVE_IDEA":
      return {
        icon: <Lightbulb className="w-3.5 h-3.5 text-purple-400" />,
        badgeBg: "bg-purple-500/20",
        borderColor: "border-purple-500/40",
        textColor: "text-purple-300",
        glowColor: "rgba(168, 85, 247, 0.2)",
      };
    case "RESEARCH":
      return {
        icon: <Search className="w-3.5 h-3.5 text-blue-400" />,
        badgeBg: "bg-blue-500/20",
        borderColor: "border-blue-500/40",
        textColor: "text-blue-300",
        glowColor: "rgba(59, 130, 246, 0.2)",
      };
  }
}
