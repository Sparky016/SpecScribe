"use client";

import React, { useMemo, useState } from "react";
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Sparkles,
  Layers,
  ChevronLeft,
  ChevronRight,
  Info,
  ExternalLink,
} from "lucide-react";
import { DiagramSnapshot, ParsedGraph, ParsedVertex } from "../lib/types";
import { parseDrawioXml } from "../lib/xmlParser";
import { formatTimestamp } from "../lib/api";

interface DrawioCanvasProps {
  currentSnapshot?: DiagramSnapshot;
  allSnapshots: DiagramSnapshot[];
  onSelectSnapshot: (snapshot: DiagramSnapshot) => void;
}

export const DrawioCanvas: React.FC<DrawioCanvasProps> = ({
  currentSnapshot,
  allSnapshots,
  onSelectSnapshot,
}) => {
  const [zoom, setZoom] = useState<number>(1);
  const [showRationale, setShowRationale] = useState<boolean>(true);

  // Parse active snapshot's drawio XML into graph elements
  const graph: ParsedGraph = useMemo(() => {
    if (!currentSnapshot || !currentSnapshot.drawio_xml) {
      return { vertices: [], edges: [] };
    }
    return parseDrawioXml(currentSnapshot.drawio_xml);
  }, [currentSnapshot]);

  const currentIndex = allSnapshots.findIndex((s) => s.id === currentSnapshot?.id);

  const handlePrev = () => {
    if (currentIndex > 0) {
      onSelectSnapshot(allSnapshots[currentIndex - 1]);
    }
  };

  const handleNext = () => {
    if (currentIndex < allSnapshots.length - 1) {
      onSelectSnapshot(allSnapshots[currentIndex + 1]);
    }
  };

  const handleZoomIn = () => setZoom((z) => Math.min(z + 0.15, 2.0));
  const handleZoomOut = () => setZoom((z) => Math.max(z - 0.15, 0.5));
  const handleResetZoom = () => setZoom(1);

  // Identify the latest/newest node based on diff summary to add a glowing pulse
  const highlightedNodeId = useMemo(() => {
    if (!currentSnapshot) return null;
    const diff = currentSnapshot.diff_summary.toLowerCase();
    const node = graph.vertices.find((v) => diff.includes(v.label.toLowerCase()));
    return node ? node.id : graph.vertices[graph.vertices.length - 1]?.id || null;
  }, [currentSnapshot, graph.vertices]);

  // Determine trigger badge color
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
    <div className="relative w-full h-full bg-[#070a0f] overflow-hidden flex flex-col select-none border-r border-white/10">
      {/* Background Architectural Grid Pattern */}
      <div
        className="absolute inset-0 opacity-20 pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255, 255, 255, 0.15) 1px, transparent 0)`,
          backgroundSize: "24px 24px",
        }}
      />

      {/* Floating Header Pill: Exact Timestamp & Diff Summary */}
      <div className="absolute top-4 left-4 right-4 z-20 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        {currentSnapshot && (
          <div className="pointer-events-auto flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-[#0c121d]/90 backdrop-blur-md border border-white/15 shadow-xl animate-fade-in max-w-full">
            <span className="font-mono text-xs px-2 py-0.5 rounded bg-white/10 text-[#00E5FF] font-bold">
              {formatTimestamp(currentSnapshot.timestamp_ms)}
            </span>
            <div className="flex items-center gap-2 truncate">
              <span className="text-xs sm:text-sm font-semibold text-gray-100 truncate">
                {currentSnapshot.diff_summary}
              </span>
            </div>
            <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border uppercase tracking-wider ${triggerBadgeStyle}`}>
              {currentSnapshot.triggered_by}
            </span>
          </div>
        )}

        {/* Viewport Controls */}
        <div className="pointer-events-auto flex items-center gap-1.5 p-1 rounded-xl bg-[#0c121d]/90 backdrop-blur-md border border-white/15 shadow-xl">
          <button
            onClick={handlePrev}
            disabled={currentIndex <= 0}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
            title="Previous Snapshot"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-[11px] font-mono text-gray-400 px-1">
            {currentIndex >= 0 ? `${currentIndex + 1}/${allSnapshots.length}` : `0/0`}
          </span>
          <button
            onClick={handleNext}
            disabled={currentIndex >= allSnapshots.length - 1}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
            title="Next Snapshot"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <div className="w-px h-4 bg-white/15 mx-0.5" />
          <button
            onClick={handleZoomOut}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            onClick={handleResetZoom}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors text-[10px] font-mono"
            title="Reset Zoom"
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            onClick={handleZoomIn}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* SVG Canvas Diagram Renderer */}
      <div className="flex-1 w-full h-full flex items-center justify-center p-6 overflow-auto">
        {graph.vertices.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-gray-500 space-y-2">
            <Layers className="w-10 h-10 text-gray-600 animate-pulse" />
            <p className="text-sm">No diagram shapes placed yet at this timestamp.</p>
            <p className="text-xs text-gray-600">Scrub forward to view architecture evolutions.</p>
          </div>
        ) : (
          <div
            className="transition-transform duration-300 ease-out origin-center"
            style={{ transform: `scale(${zoom})` }}
          >
            <svg
              className="overflow-visible"
              width="900"
              height="420"
              viewBox="0 0 900 420"
              style={{ filter: "drop-shadow(0 15px 30px rgba(0,0,0,0.7))" }}
            >
              <defs>
                {/* Arrowhead marker for edges */}
                <marker
                  id="arrowhead-cyan"
                  markerWidth="8"
                  markerHeight="8"
                  refX="7"
                  refY="4"
                  orient="auto"
                >
                  <polygon points="0 1, 8 4, 0 7" fill="#00E5FF" />
                </marker>
                <marker
                  id="arrowhead-green"
                  markerWidth="8"
                  markerHeight="8"
                  refX="7"
                  refY="4"
                  orient="auto"
                >
                  <polygon points="0 1, 8 4, 0 7" fill="#00FF66" />
                </marker>

                {/* Glow Filter for Active Delta Nodes */}
                <filter id="glow-neon" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="4" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>

              {/* Render Edges */}
              {graph.edges.map((edge) => {
                const sourceNode = graph.vertices.find((v) => v.id === edge.source);
                const targetNode = graph.vertices.find((v) => v.id === edge.target);
                if (!sourceNode || !targetNode) return null;

                const x1 = sourceNode.x + sourceNode.width / 2;
                const y1 = sourceNode.y + sourceNode.height / 2;
                const x2 = targetNode.x + targetNode.width / 2;
                const y2 = targetNode.y + targetNode.height / 2;

                const isGreen = edge.style.includes("#00FF66");
                const strokeColor = isGreen ? "#00FF66" : "#00E5FF";
                const marker = isGreen ? "url(#arrowhead-green)" : "url(#arrowhead-cyan)";

                // Orthogonal path routing
                const midX = (x1 + x2) / 2;
                const pathD = `M ${x1} ${y1} L ${midX} ${y1} L ${midX} ${y2} L ${x2} ${y2}`;

                return (
                  <g key={edge.id} className="transition-all duration-300">
                    {/* Shadow path */}
                    <path
                      d={pathD}
                      fill="none"
                      stroke="#000000"
                      strokeWidth="5"
                      strokeOpacity="0.4"
                    />
                    {/* Line */}
                    <path
                      d={pathD}
                      fill="none"
                      stroke={strokeColor}
                      strokeWidth="2.5"
                      strokeDasharray={edge.style.includes("dashed") ? "4,4" : undefined}
                      markerEnd={marker}
                    />
                    {edge.label && (
                      <text
                        x={midX}
                        y={(y1 + y2) / 2 - 6}
                        fill="#A0AEC0"
                        fontSize="10"
                        fontFamily="monospace"
                        textAnchor="middle"
                      >
                        {edge.label}
                      </text>
                    )}
                  </g>
                );
              })}

              {/* Render Vertices */}
              {graph.vertices.map((node) => {
                const isHighlighted = node.id === highlightedNodeId;
                return (
                  <g
                    key={node.id}
                    className="cursor-pointer transition-transform duration-300 hover:scale-[1.03]"
                    transform={`translate(${node.x}, ${node.y})`}
                  >
                    {/* Highlighting pulse for new additions */}
                    {isHighlighted && (
                      <rect
                        x="-4"
                        y="-4"
                        width={node.width + 8}
                        height={node.height + 8}
                        rx={node.type === "terminal" ? "40" : "14"}
                        fill="none"
                        stroke={node.strokeColor || "#00FF66"}
                        strokeWidth="2"
                        className="animate-ping opacity-40"
                      />
                    )}

                    {/* Shape rendering by type */}
                    {renderNodeShape(node, isHighlighted)}

                    {/* Node Text Label */}
                    <text
                      x={node.width / 2}
                      y={node.height / 2 + 5}
                      fill="#FFFFFF"
                      fontSize="12"
                      fontWeight="600"
                      fontFamily="system-ui, -apple-system, sans-serif"
                      textAnchor="middle"
                      className="pointer-events-none drop-shadow"
                    >
                      {node.label}
                    </text>

                    {/* Node Type Pill Indicator */}
                    <text
                      x={node.width / 2}
                      y={node.height / 2 + 18}
                      fill="rgba(255, 255, 255, 0.6)"
                      fontSize="8.5"
                      fontFamily="monospace"
                      textAnchor="middle"
                      className="pointer-events-none uppercase tracking-wider"
                    >
                      {node.type}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        )}
      </div>

      {/* Bottom Architectural Rationale Bar */}
      {currentSnapshot && currentSnapshot.decision_rationale && showRationale && (
        <div className="absolute bottom-4 left-4 right-4 z-20 pointer-events-auto">
          <div className="p-3 rounded-xl bg-[#0c121d]/95 backdrop-blur-md border border-[#00E5FF]/20 shadow-2xl flex items-start justify-between gap-3 animate-slide-in">
            <div className="flex items-start gap-2.5">
              <div className="p-1.5 rounded-lg bg-[#00E5FF]/10 text-[#00E5FF] mt-0.5">
                <Info className="w-4 h-4" />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-mono text-[#00E5FF] font-bold">
                    DECISION RATIONALE
                  </span>
                  <span className="text-[10px] text-gray-500 font-mono">
                    Captured from live dialogue
                  </span>
                </div>
                <p className="text-xs text-gray-300 mt-0.5 leading-relaxed">
                  {currentSnapshot.decision_rationale}
                </p>
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

function renderNodeShape(node: ParsedVertex, isHighlighted: boolean) {
  const { width, height, type, fillColor, strokeColor } = node;

  if (type === "database") {
    // Render Cylinder
    const capHeight = 16;
    return (
      <g>
        {/* Main Body */}
        <path
          d={`M 0 ${capHeight / 2} 
              L 0 ${height - capHeight / 2} 
              A ${width / 2} ${capHeight / 2} 0 0 0 ${width} ${height - capHeight / 2} 
              L ${width} ${capHeight / 2} 
              Z`}
          fill={fillColor || "#0D47A1"}
          stroke={strokeColor || "#00E5FF"}
          strokeWidth="2"
        />
        {/* Bottom Cap */}
        <ellipse
          cx={width / 2}
          cy={height - capHeight / 2}
          rx={width / 2}
          ry={capHeight / 2}
          fill={fillColor || "#0D47A1"}
          stroke={strokeColor || "#00E5FF"}
          strokeWidth="2"
        />
        {/* Top Cap */}
        <ellipse
          cx={width / 2}
          cy={capHeight / 2}
          rx={width / 2}
          ry={capHeight / 2}
          fill={fillColor || "#0D47A1"}
          stroke={strokeColor || "#00E5FF"}
          strokeWidth="2"
        />
      </g>
    );
  }

  if (type === "decision") {
    // Render Rhombus (Diamond)
    const points = `${width / 2},0 ${width},${height / 2} ${width / 2},${height} 0,${height / 2}`;
    return (
      <polygon
        points={points}
        fill={fillColor || "#004D40"}
        stroke={strokeColor || "#00E5FF"}
        strokeWidth="2"
      />
    );
  }

  if (type === "terminal") {
    // Render Ellipse / Pill
    return (
      <rect
        x="0"
        y="0"
        width={width}
        height={height}
        rx={height / 2}
        fill={fillColor || "#311B92"}
        stroke={strokeColor || "#00FF66"}
        strokeWidth="2"
      />
    );
  }

  // Default: Rounded Rectangle (Service)
  return (
    <rect
      x="0"
      y="0"
      width={width}
      height={height}
      rx="10"
      fill={fillColor || "#107C41"}
      stroke={strokeColor || "#00FF66"}
      strokeWidth="2"
    />
  );
}
