"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Play,
  Pause,
  RotateCcw,
  SkipBack,
  SkipForward,
  Layers,
  Bot,
  ShieldAlert,
  Clock,
} from "lucide-react";
import { DiagramSnapshot, AgentIntervention } from "../lib/types";
import { formatTimestamp } from "../lib/api";

interface TemporalScrubberProps {
  currentTimeMs: number;
  totalDurationMs: number;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onSeek: (ms: number) => void;
  snapshots: DiagramSnapshot[];
  interventions: AgentIntervention[];
  playbackSpeed: number;
  onChangeSpeed: (speed: number) => void;
}

export const TemporalScrubber: React.FC<TemporalScrubberProps> = ({
  currentTimeMs,
  totalDurationMs,
  isPlaying,
  onTogglePlay,
  onSeek,
  snapshots,
  interventions,
  playbackSpeed,
  onChangeSpeed,
}) => {
  const [hoverTimeMs, setHoverTimeMs] = useState<number | null>(null);

  const duration = Math.max(totalDurationMs, 1000);
  const progressPercent = Math.min(Math.max((currentTimeMs / duration) * 100, 0), 100);

  // Combine and sort all milestone markers for step navigation
  const allMilestones = useMemo(() => {
    const list: { ms: number; title: string; type: "snapshot" | "intervention" }[] = [
      ...snapshots.map((s) => ({
        ms: s.timestamp_ms,
        title: s.diff_summary,
        type: "snapshot" as const,
      })),
      ...interventions.map((i) => ({
        ms: i.timestamp_ms,
        title: `${i.short_title}: ${i.category}`,
        type: "intervention" as const,
      })),
    ];
    list.sort((a, b) => a.ms - b.ms);
    return list;
  }, [snapshots, interventions]);

  const handleStepBack = () => {
    const prev = [...allMilestones].reverse().find((m) => m.ms < currentTimeMs - 500);
    if (prev) {
      onSeek(prev.ms);
    } else {
      onSeek(0);
    }
  };

  const handleStepForward = () => {
    const next = allMilestones.find((m) => m.ms > currentTimeMs + 500);
    if (next) {
      onSeek(next.ms);
    } else {
      onSeek(duration);
    }
  };

  const handleTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(clickX / rect.width, 1));
    onSeek(Math.round(ratio * duration));
  };

  const handleTrackMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(clickX / rect.width, 1));
    setHoverTimeMs(Math.round(ratio * duration));
  };

  return (
    <div className="h-20 bg-[#080c13]/95 backdrop-blur-md border-t border-white/10 px-4 sm:px-6 flex flex-col justify-center gap-1.5 z-30 select-none shadow-2xl">
      {/* Top Row: Playback Controls & Time Display */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Step Back */}
          <button
            onClick={handleStepBack}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
            title="Step to Previous Decision / AI Flag"
          >
            <SkipBack className="w-4 h-4" />
          </button>

          {/* Play / Pause Primary Action */}
          <button
            onClick={onTogglePlay}
            className={`p-2 rounded-xl transition-all shadow-md ${
              isPlaying
                ? "bg-amber-400 text-black shadow-amber-400/20"
                : "bg-[#00FF66] text-black shadow-[#00FF66]/20 hover:scale-105"
            }`}
            title={isPlaying ? "Pause Timeline (Space)" : "Play Timeline (Space)"}
          >
            {isPlaying ? (
              <Pause className="w-4 h-4 fill-current" />
            ) : (
              <Play className="w-4 h-4 fill-current ml-0.5" />
            )}
          </button>

          {/* Step Forward */}
          <button
            onClick={handleStepForward}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
            title="Step to Next Decision / AI Flag"
          >
            <SkipForward className="w-4 h-4" />
          </button>

          {/* Reset */}
          <button
            onClick={() => onSeek(0)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
            title="Reset to 00:00"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          {/* Speed Selector */}
          <div className="flex items-center rounded-lg bg-white/5 border border-white/10 p-0.5 ml-1">
            {[1, 2, 4].map((speed) => (
              <button
                key={speed}
                onClick={() => onChangeSpeed(speed)}
                className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition-colors ${
                  playbackSpeed === speed
                    ? "bg-[#00E5FF]/20 text-[#00E5FF] font-bold"
                    : "text-gray-400 hover:text-gray-200"
                }`}
              >
                {speed}x
              </button>
            ))}
          </div>
        </div>

        {/* Center: Marker Legend */}
        <div className="hidden md:flex items-center gap-4 text-[11px] font-mono text-gray-400">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#00E5FF] shadow-[0_0_8px_#00E5FF]" />
            <span>Diagram Snapshot ({snapshots.length})</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-[0_0_8px_#F59E0B]" />
            <span>Raising-Hand Flag ({interventions.length})</span>
          </div>
        </div>

        {/* Right: Elapsed / Total Clock */}
        <div className="flex items-center gap-2 font-mono text-xs sm:text-sm">
          <span className="text-[#00FF66] font-bold">
            {formatTimestamp(currentTimeMs)}
          </span>
          <span className="text-gray-500">/</span>
          <span className="text-gray-400">
            {formatTimestamp(duration)}
          </span>
        </div>
      </div>

      {/* Bottom Track: Interactive Scrubber with Cyan and Amber Markers */}
      <div
        className="relative w-full h-5 flex items-center cursor-pointer group"
        onClick={handleTrackClick}
        onMouseMove={handleTrackMouseMove}
        onMouseLeave={() => setHoverTimeMs(null)}
      >
        {/* Background Rail */}
        <div className="w-full h-1.5 rounded-full bg-white/10 group-hover:h-2 transition-all overflow-hidden relative">
          {/* Progress Fill */}
          <div
            className="h-full bg-gradient-to-r from-[#00FF66] to-[#00E5FF] rounded-full transition-all duration-75"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Cyan Snapshot Markers on Timeline */}
        {snapshots.map((snap) => {
          const markerPercent = (snap.timestamp_ms / duration) * 100;
          return (
            <div
              key={snap.id}
              className="absolute group/marker -translate-x-1/2 z-10"
              style={{ left: `${markerPercent}%` }}
              onClick={(e) => {
                e.stopPropagation();
                onSeek(snap.timestamp_ms);
              }}
            >
              <div className="w-3 h-3 rounded-full bg-[#00E5FF] border-2 border-[#080c13] shadow-[0_0_8px_#00E5FF] hover:scale-150 transition-transform cursor-pointer" />
              {/* Tooltip on Hover */}
              <div className="opacity-0 group-hover/marker:opacity-100 pointer-events-none absolute bottom-5 left-1/2 -translate-x-1/2 px-2 py-1 rounded bg-[#0c121d] border border-[#00E5FF]/40 text-[#00E5FF] text-[10px] font-mono whitespace-nowrap shadow-xl transition-opacity z-50">
                [{formatTimestamp(snap.timestamp_ms)}] {snap.diff_summary}
              </div>
            </div>
          );
        })}

        {/* Amber Agent Intervention Markers on Timeline */}
        {interventions.map((interv) => {
          const markerPercent = (interv.timestamp_ms / duration) * 100;
          return (
            <div
              key={interv.id}
              className="absolute group/marker -translate-x-1/2 z-20"
              style={{ left: `${markerPercent}%` }}
              onClick={(e) => {
                e.stopPropagation();
                onSeek(interv.timestamp_ms);
              }}
            >
              <div className="w-3.5 h-3.5 rounded-full bg-amber-400 border-2 border-[#080c13] shadow-[0_0_10px_#F59E0B] hover:scale-150 transition-transform cursor-pointer flex items-center justify-center text-[8px] font-bold text-black">
                !
              </div>
              {/* Tooltip on Hover */}
              <div className="opacity-0 group-hover/marker:opacity-100 pointer-events-none absolute bottom-5 left-1/2 -translate-x-1/2 px-2 py-1 rounded bg-[#17120a] border border-amber-400/40 text-amber-300 text-[10px] font-mono whitespace-nowrap shadow-xl transition-opacity z-50">
                [{formatTimestamp(interv.timestamp_ms)}] {interv.short_title}
              </div>
            </div>
          );
        })}

        {/* Current Playhead Handle */}
        <div
          className="absolute -translate-x-1/2 w-4 h-4 rounded-full bg-white border-2 border-[#00FF66] shadow-[0_0_12px_#00FF66] pointer-events-none z-30 transition-all duration-75"
          style={{ left: `${progressPercent}%` }}
        />

        {/* Hover Time Tooltip */}
        {hoverTimeMs !== null && (
          <div
            className="absolute bottom-6 -translate-x-1/2 px-2 py-0.5 rounded bg-black/80 border border-white/20 text-gray-200 text-[10px] font-mono pointer-events-none z-40"
            style={{ left: `${(hoverTimeMs / duration) * 100}%` }}
          >
            {formatTimestamp(hoverTimeMs)}
          </div>
        )}
      </div>
    </div>
  );
};
