/**
 * Canonical Node Registry for Lens Studio 5.15 Spatial Client
 * Source: SPEC_DOC.md §4.5 (Finding #10)
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
  service: {
    typeName: "service",
    fillColorHex: "#107C41",
    strokeColorHex: "#00FF66",
    labelPrefix: "Svc",
    defaultWidth: 140,
    defaultHeight: 60,
  },
  decision: {
    typeName: "decision",
    fillColorHex: "#004D40",
    strokeColorHex: "#00E5FF",
    labelPrefix: "Dec",
    defaultWidth: 120,
    defaultHeight: 80,
  },
  database: {
    typeName: "database",
    fillColorHex: "#0D47A1",
    strokeColorHex: "#00E5FF",
    labelPrefix: "DB",
    defaultWidth: 120,
    defaultHeight: 80,
  },
  terminal: {
    typeName: "terminal",
    fillColorHex: "#311B92",
    strokeColorHex: "#00FF66",
    labelPrefix: "Client",
    defaultWidth: 100,
    defaultHeight: 60,
  },
};
