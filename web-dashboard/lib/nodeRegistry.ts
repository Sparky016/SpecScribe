/**
 * GENERATED — do not edit. Source: shared/node_registry.json
 * Regenerate with: node scripts/gen_node_registry.mjs
 */

export type NodeType = "service" | "decision" | "database" | "terminal";

export interface NodeDefinition {
  typeName: NodeType;
  drawioStyle: string;
  defaultDimensions: { width: number; height: number };
  fillColor: string;
  strokeColor: string;
  labelPrefix: string;
  shape: "rounded" | "rhombus" | "cylinder" | "ellipse";
  labelKeywords: string[];
  styleKeywords: string[];
}

export const NODE_REGISTRY: Record<NodeType, NodeDefinition> = {
  service: {
    typeName: "service",
    drawioStyle: "rounded=1;whiteSpace=wrap;html=1;fillColor=#107C41;strokeColor=#00FF66;fontColor=#FFFFFF;strokeWidth=2;",
    defaultDimensions: { width: 140, height: 60 },
    fillColor: "#107C41",
    strokeColor: "#00FF66",
    labelPrefix: "Svc",
    shape: "rounded",
    labelKeywords: ["service", "api", "gateway", "worker", "broker"],
    styleKeywords: ["rounded=1"],
  },
  decision: {
    typeName: "decision",
    drawioStyle: "rhombus;whiteSpace=wrap;html=1;fillColor=#004D40;strokeColor=#00E5FF;fontColor=#FFFFFF;strokeWidth=2;",
    defaultDimensions: { width: 120, height: 80 },
    fillColor: "#004D40",
    strokeColor: "#00E5FF",
    labelPrefix: "Dec",
    shape: "rhombus",
    labelKeywords: ["decision", "condition", "auth?", "filter?"],
    styleKeywords: ["rhombus"],
  },
  database: {
    typeName: "database",
    drawioStyle: "shape=cylinder3;whiteSpace=wrap;html=1;boundedLbl=1;backgroundOutline=1;size=15;fillColor=#0D47A1;strokeColor=#00E5FF;fontColor=#FFFFFF;strokeWidth=2;",
    defaultDimensions: { width: 120, height: 80 },
    fillColor: "#0D47A1",
    strokeColor: "#00E5FF",
    labelPrefix: "DB",
    shape: "cylinder",
    labelKeywords: ["db", "database", "redis", "postgres", "storage"],
    styleKeywords: ["shape=cylinder3"],
  },
  terminal: {
    typeName: "terminal",
    drawioStyle: "ellipse;whiteSpace=wrap;html=1;fillColor=#311B92;strokeColor=#00FF66;fontColor=#FFFFFF;strokeWidth=2;",
    defaultDimensions: { width: 100, height: 60 },
    fillColor: "#311B92",
    strokeColor: "#00FF66",
    labelPrefix: "Client",
    shape: "ellipse",
    labelKeywords: ["terminal", "client", "alert", "end", "user"],
    styleKeywords: ["ellipse"],
  },
};

export const DEFAULT_FALLBACK_COLORS = {
  fillColor: "#1F2937",
  strokeColor: "#38BDF8",
};
