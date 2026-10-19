import { ParsedEdge, ParsedGraph, ParsedVertex } from "./types";
import { DEFAULT_FALLBACK_COLORS, NODE_REGISTRY, NodeType } from "./nodeRegistry";

/**
 * Parses Draw.io / mxGraph XML into structured vertices and edges
 * with automatic fallback layout coordinates if geometry is missing or zero.
 */
export function parseDrawioXml(xmlString: string): ParsedGraph {
  const vertices: ParsedVertex[] = [];
  const edges: ParsedEdge[] = [];

  if (!xmlString || typeof xmlString !== "string") {
    return { vertices, edges };
  }

  try {
    // If running in browser, use DOMParser
    if (typeof window !== "undefined" && window.DOMParser) {
      const parser = new DOMParser();
      const doc = parser.parseFromString(xmlString, "application/xml");
      const cells = doc.querySelectorAll("mxCell");

      cells.forEach((cell) => {
        const id = cell.getAttribute("id") || "";
        if (id === "0" || id === "1") return; // default layers

        const isVertex = cell.getAttribute("vertex") === "1";
        const isEdge = cell.getAttribute("edge") === "1";
        const value = cell.getAttribute("value") || "";
        const style = cell.getAttribute("style") || "";

        if (isVertex) {
          const geo = cell.querySelector("mxGeometry");
          const x = geo ? parseFloat(geo.getAttribute("x") || "0") : 0;
          const y = geo ? parseFloat(geo.getAttribute("y") || "0") : 0;
          const width = geo ? parseFloat(geo.getAttribute("width") || "140") : 140;
          const height = geo ? parseFloat(geo.getAttribute("height") || "60") : 60;

          const type = detectNodeType(style, value);
          const { fillColor, strokeColor } = extractColors(style, type);

          vertices.push({
            id,
            label: value || id,
            style,
            type,
            x,
            y,
            width: width || 140,
            height: height || 60,
            fillColor,
            strokeColor,
          });
        } else if (isEdge) {
          const source = cell.getAttribute("source") || "";
          const target = cell.getAttribute("target") || "";
          edges.push({
            id,
            source,
            target,
            label: value,
            style,
          });
        }
      });
    } else {
      // Regex fallback for server-side or environments without DOMParser
      const cellRegex = /<mxCell\s+([^>]+)(?:\/>|>([\s\S]*?)<\/mxCell>)/g;
      let match;
      while ((match = cellRegex.exec(xmlString)) !== null) {
        const attrs = match[1];
        const inner = match[2] || "";

        const idMatch = attrs.match(/id="([^"]+)"/);
        const id = idMatch ? idMatch[1] : "";
        if (id === "0" || id === "1") continue;

        const isVertex = /vertex="1"/.test(attrs);
        const isEdge = /edge="1"/.test(attrs);
        const valueMatch = attrs.match(/value="([^"]*)"/);
        const value = valueMatch ? valueMatch[1] : "";
        const styleMatch = attrs.match(/style="([^"]*)"/);
        const style = styleMatch ? styleMatch[1] : "";

        if (isVertex) {
          const geoMatch = inner.match(/<mxGeometry[^>]*x="([^"]+)"[^>]*y="([^"]+)"[^>]*width="([^"]+)"[^>]*height="([^"]+)"/);
          const x = geoMatch ? parseFloat(geoMatch[1]) : 0;
          const y = geoMatch ? parseFloat(geoMatch[2]) : 0;
          const width = geoMatch ? parseFloat(geoMatch[3]) : 140;
          const height = geoMatch ? parseFloat(geoMatch[4]) : 60;

          const type = detectNodeType(style, value);
          const { fillColor, strokeColor } = extractColors(style, type);

          vertices.push({
            id,
            label: value || id,
            style,
            type,
            x,
            y,
            width,
            height,
            fillColor,
            strokeColor,
          });
        } else if (isEdge) {
          const sourceMatch = attrs.match(/source="([^"]+)"/);
          const targetMatch = attrs.match(/target="([^"]+)"/);
          edges.push({
            id,
            source: sourceMatch ? sourceMatch[1] : "",
            target: targetMatch ? targetMatch[1] : "",
            label: value,
            style,
          });
        }
      }
    }

    // Auto-layout pass if coordinates are missing/zero or all stacked
    ensureLayout(vertices, edges);
  } catch (err) {
    console.error("Error parsing draw.io xml:", err);
  }

  return { vertices, edges };
}

function detectNodeType(style: string, label: string): "service" | "decision" | "database" | "terminal" | "default" {
  const s = style.toLowerCase();
  const l = label.toLowerCase();
  const order: NodeType[] = ["database", "decision", "terminal", "service"];
  for (const typeKey of order) {
    const def = NODE_REGISTRY[typeKey];
    if (def.styleKeywords.some((kw) => s.includes(kw)) || def.labelKeywords.some((kw) => l.includes(kw))) {
      return typeKey;
    }
  }
  return "service";
}

function extractColors(style: string, type: "service" | "decision" | "database" | "terminal" | "default") {
  const fillMatch = style.match(/fillColor=([^;]+)/);
  const strokeMatch = style.match(/strokeColor=([^;]+)/);

  if (fillMatch && strokeMatch) {
    return { fillColor: fillMatch[1], strokeColor: strokeMatch[1] };
  }

  if (type in NODE_REGISTRY) {
    const def = NODE_REGISTRY[type as NodeType];
    return { fillColor: def.fillColor, strokeColor: def.strokeColor };
  }

  return DEFAULT_FALLBACK_COLORS;
}


/**
 * If coordinates are all 0 or clustered, perform an automatic topological/grid layout
 */
function ensureLayout(vertices: ParsedVertex[], edges: ParsedEdge[]) {
  const needsLayout = vertices.length > 0 && vertices.every((v) => v.x === 0 && v.y === 0);
  if (!needsLayout && vertices.some((v) => v.x !== 0 || v.y !== 0)) {
    return;
  }

  // Build simple adjacency
  const inDegree: Record<string, number> = {};
  const outgoing: Record<string, string[]> = {};
  vertices.forEach((v) => {
    inDegree[v.id] = 0;
    outgoing[v.id] = [];
  });

  edges.forEach((e) => {
    if (inDegree[e.target] !== undefined) inDegree[e.target]++;
    if (outgoing[e.source]) outgoing[e.source].push(e.target);
  });

  // Assign layers (BFS starting from root nodes)
  const layer: Record<string, number> = {};
  const queue: string[] = [];

  vertices.forEach((v) => {
    if (inDegree[v.id] === 0) {
      layer[v.id] = 0;
      queue.push(v.id);
    }
  });

  if (queue.length === 0 && vertices.length > 0) {
    layer[vertices[0].id] = 0;
    queue.push(vertices[0].id);
  }

  while (queue.length > 0) {
    const curr = queue.shift()!;
    const currLayer = layer[curr];
    const neighbors = outgoing[curr] || [];
    for (const next of neighbors) {
      if (layer[next] === undefined || layer[next] <= currLayer) {
        layer[next] = currLayer + 1;
        queue.push(next);
      }
    }
  }

  // Catch unvisited
  vertices.forEach((v, idx) => {
    if (layer[v.id] === undefined) {
      layer[v.id] = idx;
    }
  });

  // Group by layer
  const layersMap: Record<number, ParsedVertex[]> = {};
  vertices.forEach((v) => {
    const l = layer[v.id];
    if (!layersMap[l]) layersMap[l] = [];
    layersMap[l].push(v);
  });

  const startX = 60;
  const startY = 80;
  const layerGapX = 220;
  const nodeGapY = 110;

  Object.entries(layersMap).forEach(([layerNumStr, layerNodes]) => {
    const lNum = parseInt(layerNumStr, 10);
    const totalHeight = layerNodes.length * nodeGapY;
    const offsetY = startY + Math.max(0, (300 - totalHeight) / 2);

    layerNodes.forEach((node, nodeIdx) => {
      node.x = startX + lNum * layerGapX;
      node.y = offsetY + nodeIdx * nodeGapY;
    });
  });
}
