#!/usr/bin/env node
// Generates the dashboard and Lens node registries from shared/node_registry.json.
// Usage: node scripts/gen_node_registry.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const nodes = JSON.parse(readFileSync(resolve(root, "shared/node_registry.json"), "utf8")).nodes;
if (!Array.isArray(nodes) || nodes.length === 0) throw new Error("node_registry.json: 'nodes' must be a non-empty array");

const q = (s) => JSON.stringify(s);
const arr = (a) => `[${a.map(q).join(", ")}]`;

const dashboard = `/**
 * GENERATED — do not edit. Source: shared/node_registry.json
 * Regenerate with: node scripts/gen_node_registry.mjs
 */

export type NodeType = ${nodes.map((n) => q(n.typeName)).join(" | ")};

export interface NodeDefinition {
  typeName: NodeType;
  drawioStyle: string;
  defaultDimensions: { width: number; height: number };
  fillColor: string;
  strokeColor: string;
  labelPrefix: string;
  shape: ${[...new Set(nodes.map((n) => n.shape))].map(q).join(" | ")};
  labelKeywords: string[];
  styleKeywords: string[];
}

export const NODE_REGISTRY: Record<NodeType, NodeDefinition> = {
${nodes
  .map(
    (n) => `  ${n.typeName}: {
    typeName: ${q(n.typeName)},
    drawioStyle: ${q(n.drawioStyle)},
    defaultDimensions: { width: ${n.width}, height: ${n.height} },
    fillColor: ${q(n.fillColor)},
    strokeColor: ${q(n.strokeColor)},
    labelPrefix: ${q(n.labelPrefix)},
    shape: ${q(n.shape)},
    labelKeywords: ${arr(n.labelKeywords)},
    styleKeywords: ${arr(n.styleKeywords)},
  },`
  )
  .join("\n")}
};

export const DEFAULT_FALLBACK_COLORS = {
  fillColor: "#1F2937",
  strokeColor: "#38BDF8",
};
`;

const lens = `/**
 * GENERATED — do not edit. Source: shared/node_registry.json
 * Regenerate with: node scripts/gen_node_registry.mjs
 */

export interface LensNodeDefinition {
  typeName: string;
  fillColorHex: string;
  strokeColorHex: string;
  labelPrefix: string;
  defaultWidth: number;
  defaultHeight: number;
}

export const LENS_NODE_REGISTRY: Record<string, LensNodeDefinition> = {
${nodes
  .map(
    (n) => `  ${n.typeName}: {
    typeName: ${q(n.typeName)},
    fillColorHex: ${q(n.fillColor)},
    strokeColorHex: ${q(n.strokeColor)},
    labelPrefix: ${q(n.labelPrefix)},
    defaultWidth: ${n.width},
    defaultHeight: ${n.height},
  },`
  )
  .join("\n")}
};
`;

writeFileSync(resolve(root, "web-dashboard/lib/nodeRegistry.ts"), dashboard, "utf8");
writeFileSync(resolve(root, "spectacles-lens/Assets/Scripts/NodeRegistry.ts"), lens, "utf8");
