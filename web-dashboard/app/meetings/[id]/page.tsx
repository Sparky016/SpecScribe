"use client";

import React, { use, useEffect, useMemo, useRef, useState } from "react";
import { TopBar } from "../../../components/TopBar";
import { DrawioCanvas } from "../../../components/DrawioCanvas";
import { TranscriptPanel } from "../../../components/TranscriptPanel";
import { TemporalScrubber } from "../../../components/TemporalScrubber";
import { RAGDrawer } from "../../../components/RAGDrawer";
import { fetchMeetingTimeline } from "../../../lib/api";
import { DiagramSnapshot, TimelineData } from "../../../lib/types";
import { DEMO_TIMELINE } from "../../../lib/demoData";

interface MeetingPageProps {
  params: Promise<{ id: string }>;
}

export default function MeetingReviewPage({ params }: MeetingPageProps) {
  const resolvedParams = use(params);
  const meetingId = resolvedParams.id || "demo-session-01";

  const [timeline, setTimeline] = useState<TimelineData>(DEMO_TIMELINE);
  const [loading, setLoading] = useState<boolean>(true);
  const [currentTimeMs, setCurrentTimeMs] = useState<number>(36000); // Start at milestone [00:36]
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [isRAGOpen, setIsRAGOpen] = useState<boolean>(false);

  // Fetch timeline on mount or meetingId change
  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      setLoading(true);
      try {
        const data = await fetchMeetingTimeline(meetingId);
        if (isMounted) {
          setTimeline(data);
          // Set initial time to first snapshot if available
          if (data.diagram_snapshots && data.diagram_snapshots.length > 0) {
            setCurrentTimeMs(data.diagram_snapshots[1]?.timestamp_ms || data.diagram_snapshots[0].timestamp_ms);
          }
        }
      } catch (err) {
        console.warn("Error loading timeline, using demo fallback:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadData();
    return () => {
      isMounted = false;
    };
  }, [meetingId]);

  // Total duration calculation
  const totalDurationMs = useMemo(() => {
    const lastTurn = timeline.transcript_turns[timeline.transcript_turns.length - 1];
    const lastSnap = timeline.diagram_snapshots[timeline.diagram_snapshots.length - 1];
    const lastInterv = timeline.agent_interventions[timeline.agent_interventions.length - 1];
    return Math.max(
      lastTurn?.timestamp_ms || 0,
      lastSnap?.timestamp_ms || 0,
      lastInterv?.timestamp_ms || 0,
      150000 // default 150 seconds (2.5 mins)
    );
  }, [timeline]);

  // Compute active diagram snapshot for currentTimeMs
  const activeSnapshot = useMemo(() => {
    if (!timeline.diagram_snapshots || timeline.diagram_snapshots.length === 0) {
      return undefined;
    }
    // Find the latest snapshot at or before currentTimeMs
    const candidate = [...timeline.diagram_snapshots]
      .reverse()
      .find((s) => s.timestamp_ms <= currentTimeMs);

    return candidate || timeline.diagram_snapshots[0];
  }, [timeline.diagram_snapshots, currentTimeMs]);

  // Playback timer loop
  useEffect(() => {
    if (!isPlaying) return;

    const intervalTime = 100; // tick every 100ms
    const stepMs = intervalTime * playbackSpeed;

    const timer = setInterval(() => {
      setCurrentTimeMs((prev) => {
        if (prev >= totalDurationMs) {
          setIsPlaying(false);
          return totalDurationMs;
        }
        return prev + stepMs;
      });
    }, intervalTime);

    return () => clearInterval(timer);
  }, [isPlaying, playbackSpeed, totalDurationMs]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts if typing inside an input/textarea
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;

      if (e.code === "Space") {
        e.preventDefault();
        setIsPlaying((p) => !p);
      } else if (e.code === "ArrowLeft") {
        e.preventDefault();
        setCurrentTimeMs((t) => Math.max(0, t - 5000));
      } else if (e.code === "ArrowRight") {
        e.preventDefault();
        setCurrentTimeMs((t) => Math.min(totalDurationMs, t + 5000));
      } else if (e.code === "Escape") {
        setIsRAGOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [totalDurationMs]);

  const handleSeek = (timestampMs: number) => {
    setCurrentTimeMs(Math.max(0, Math.min(timestampMs, totalDurationMs)));
  };

  const handleSelectSnapshot = (snapshot: DiagramSnapshot) => {
    setCurrentTimeMs(snapshot.timestamp_ms);
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-[#070a0f] text-gray-100 overflow-hidden select-none">
      {/* 1. Top Bar */}
      <TopBar
        timeline={timeline}
        currentSnapshotXml={activeSnapshot?.drawio_xml}
        onOpenRAG={() => setIsRAGOpen(true)}
        isRAGOpen={isRAGOpen}
      />

      {/* 2. Center Split-Pane (60% Left Canvas, 40% Right Transcript) */}
      <main className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
        {/* Left Pane (60% width): High-contrast Draw.io Diagram Canvas */}
        <section
          aria-label="Draw.io Diagram Canvas"
          className="w-full md:w-[60%] h-[50vh] md:h-full relative overflow-hidden flex flex-col"
        >
          <DrawioCanvas
            currentSnapshot={activeSnapshot}
            allSnapshots={timeline.diagram_snapshots}
            onSelectSnapshot={handleSelectSnapshot}
          />
        </section>

        {/* Right Pane (40% width): Synchronized Diarized Transcript & Decision Log */}
        <section
          aria-label="Synchronized Diarized Transcript"
          className="w-full md:w-[40%] h-[50vh] md:h-full relative overflow-hidden flex flex-col"
        >
          <TranscriptPanel
            timeline={timeline}
            currentTimeMs={currentTimeMs}
            onSeek={handleSeek}
          />
        </section>

        {/* 4. Slide-Out Drawer: "Ask the Meeting" RAG Agent */}
        <RAGDrawer
          isOpen={isRAGOpen}
          onClose={() => setIsRAGOpen(false)}
          timeline={timeline}
          onJumpToTimestamp={(ms) => {
            handleSeek(ms);
            // On mobile, auto-close drawer to view diagram change
            if (window.innerWidth < 768) {
              setIsRAGOpen(false);
            }
          }}
        />
      </main>

      {/* 3. Bottom Temporal Scrubber Bar */}
      <TemporalScrubber
        currentTimeMs={currentTimeMs}
        totalDurationMs={totalDurationMs}
        isPlaying={isPlaying}
        onTogglePlay={() => setIsPlaying(!isPlaying)}
        onSeek={handleSeek}
        snapshots={timeline.diagram_snapshots}
        interventions={timeline.agent_interventions}
        playbackSpeed={playbackSpeed}
        onChangeSpeed={setPlaybackSpeed}
      />
    </div>
  );
}
