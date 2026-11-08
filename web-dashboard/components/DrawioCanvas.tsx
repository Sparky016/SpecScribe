"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Script from "next/script";
import { ChevronLeft, ChevronRight, ExternalLink, Info, Layers, Loader2 } from "lucide-react";
import { DiagramSnapshot } from "../lib/types";
import { formatTimestamp } from "../lib/api";

// Official diagrams.net viewer (same renderer as app.diagrams.net).
const VIEWER_SCRIPT_URL = "https://viewer.diagrams.net/js/viewer-static.min.js";

declare global {
  interface Window {
    GraphViewer?: {
      createViewerForElement: (element: HTMLElement, callback?: (viewer: unknown) => void) => void;
    };
  }
}

type ViewerStatus = "loading" | "ready" | "error";

interface DrawioCanvasProps {
  currentSnapshot?: DiagramSnapshot;
  allSnapshots: DiagramSnapshot[];
  onSelectSnapshot: (snapshot: DiagramSnapshot) => void;
  // Shown when the meeting has no snapshots yet (e.g. a meeting's final diagram only).
  fallbackXml?: string;
}

export function diagramsNetUrl(xml: string): string {
  return `https://app.diagrams.net/?lightbox=1&edit=_blank#R${encodeURIComponent(xml)}`;
}

export const DrawioCanvas: React.FC<DrawioCanvasProps> = ({
  currentSnapshot,
  allSnapshots,
  onSelectSnapshot,
  fallbackXml,
}) => {
  const [showRationale, setShowRationale] = useState<boolean>(true);
  const [status, setStatus] = useState<ViewerStatus>(() =>
    typeof window !== "undefined" && window.GraphViewer ? "ready" : "loading"
  );
  const containerRef = useRef<HTMLDivElement>(null);

  const xml = currentSnapshot?.drawio_xml || fallbackXml || "";
  const currentIndex = allSnapshots.findIndex((s) => s.id === currentSnapshot?.id);

  // Show the rationale again whenever the snapshot changes.
  useEffect(() => {
    setShowRationale(true);
  }, [currentSnapshot?.id]);

  // (Re)render the diagram with the diagrams.net viewer whenever the XML changes.
  useEffect(() => {
    const container = containerRef.current;
    if (status !== "ready" || !container || !window.GraphViewer) return;
    container.replaceChildren();
    if (!xml) return;

    const host = document.createElement("div");
    // Not the "mxgraph" class: the viewer script auto-processes those, which would render twice.
    host.className = "specscribe-drawio-viewer";
    // The viewer sizes itself from the host's width; an unsized flex child is 0px wide and renders nothing.
    host.style.width = "100%";
    host.setAttribute(
      "data-mxgraph",
      JSON.stringify({
        xml,
        highlight: "#00FF66",
        nav: true,
        resize: true,
        "auto-fit": true,
        center: true,
        lightbox: false,
        toolbar: "zoom layers lightbox",
        "toolbar-nohide": true,
        "dark-mode": true,
        border: 16,
      })
    );
    container.appendChild(host);
    try {
      window.GraphViewer.createViewerForElement(host);
    } catch (err) {
      console.warn("draw.io viewer failed to render:", err);
      setStatus("error");
    }
    return () => {
      container.replaceChildren();
    };
  }, [xml, status]);

  const triggerBadgeStyle = useMemo(() => {
    switch (currentSnapshot?.triggered_by) {
      case "PINCH_PALETTE":
        return "bg-[#00FF66]/15 border-[#00FF66]/40 text-[#00FF66]";
      case "VISION_DIFF":
        return "bg-[#00E5FF]/15 border-[#00E5FF]/40 text-[#00E5FF]";
      case "AGENT_SUGGESTION":
        return "bg-amber-400/15 border-amber-400/40 text-amber-300";
      default:
        return "bg-gray-700/30 border-gray-600 text-gray-300";
    }
  }, [currentSnapshot?.triggered_by]);

  return (
    <div className="relative w-full h-full bg-[#070a0f] overflow-hidden flex flex-col border-r border-white/10">
      <Script
        src={VIEWER_SCRIPT_URL}
        strategy="afterInteractive"
        onReady={() => setStatus(window.GraphViewer ? "ready" : "error")}
        onError={() => setStatus("error")}
      />

      {/* Header: timestamp, diff summary, snapshot navigation */}
      <div className="z-20 flex flex-wrap items-center justify-between gap-2 px-4 pt-4">
        {currentSnapshot ? (
          <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-[#0c121d]/90 backdrop-blur-md border border-white/15 shadow-xl max-w-full min-w-0">
            <span className="font-mono text-xs px-2 py-0.5 rounded bg-white/10 text-[#00E5FF] font-bold">
              {formatTimestamp(currentSnapshot.timestamp_ms)}
            </span>
            <span className="text-xs sm:text-sm font-semibold text-gray-100 truncate">
              {currentSnapshot.diff_summary}
            </span>
            <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border uppercase tracking-wider ${triggerBadgeStyle}`}>
              {currentSnapshot.triggered_by}
            </span>
          </div>
        ) : (
          <span />
        )}

        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[#0c121d]/90 backdrop-blur-md border border-white/15 shadow-xl">
          <button
            onClick={() => currentIndex > 0 && onSelectSnapshot(allSnapshots[currentIndex - 1])}
            disabled={currentIndex <= 0}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
            title="Previous Snapshot"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-[11px] font-mono text-gray-400 px-1">
            {currentIndex >= 0 ? `${currentIndex + 1}/${allSnapshots.length}` : `0/${allSnapshots.length}`}
          </span>
          <button
            onClick={() =>
              currentIndex < allSnapshots.length - 1 && onSelectSnapshot(allSnapshots[currentIndex + 1])
            }
            disabled={currentIndex >= allSnapshots.length - 1}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
            title="Next Snapshot"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          {xml && (
            <>
              <div className="w-px h-4 bg-white/15 mx-0.5" />
              <a
                href={diagramsNetUrl(xml)}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] text-gray-300 hover:text-white hover:bg-white/10 transition-colors"
                title="Open this diagram in diagrams.net"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Open in diagrams.net</span>
              </a>
            </>
          )}
        </div>
      </div>

      {/* draw.io viewer */}
      <div className="relative flex-1 min-h-0 overflow-auto p-4 pb-28">
        {!xml ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-500 space-y-2">
            <Layers className="w-10 h-10 text-gray-600" />
            <p className="text-sm">No diagram captured at this point in the meeting.</p>
            <p className="text-xs text-gray-600">Scrub forward to see the architecture evolve.</p>
          </div>
        ) : status === "error" ? (
          <div role="alert" className="h-full flex flex-col items-center justify-center gap-2 text-sm text-gray-300">
            <p>The diagrams.net viewer could not be loaded.</p>
            <a
              href={diagramsNetUrl(xml)}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#141b26] border border-white/15 text-xs hover:bg-[#1a2332]"
            >
              <ExternalLink className="w-3.5 h-3.5" /> Open in diagrams.net instead
            </a>
          </div>
        ) : (
          <>
            {status === "loading" && (
              <div role="status" className="absolute inset-0 flex items-center justify-center gap-2 text-xs text-gray-400">
                <Loader2 className="w-4 h-4 animate-spin text-[#00FF66]" /> Loading diagram viewer…
              </div>
            )}
            <div
              ref={containerRef}
              aria-label="draw.io diagram"
              className="w-full flex justify-center [&_.geDiagramContainer]:!bg-transparent"
            />
          </>
        )}
      </div>

      {/* Decision rationale */}
      {currentSnapshot && currentSnapshot.decision_rationale && showRationale && (
        <div className="absolute bottom-4 left-4 right-4 z-20">
          <div className="p-3 rounded-xl bg-[#0c121d]/95 backdrop-blur-md border border-[#00E5FF]/20 shadow-2xl flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <div className="p-1.5 rounded-lg bg-[#00E5FF]/10 text-[#00E5FF] mt-0.5">
                <Info className="w-4 h-4" />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-mono text-[#00E5FF] font-bold">DECISION RATIONALE</span>
                  <span className="text-[10px] text-gray-500 font-mono">Captured from live dialogue</span>
                </div>
                <p className="text-xs text-gray-300 mt-0.5 leading-relaxed">{currentSnapshot.decision_rationale}</p>
              </div>
            </div>
            <button
              onClick={() => setShowRationale(false)}
              className="text-gray-500 hover:text-gray-300 text-xs px-1"
              title="Hide Rationale"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
