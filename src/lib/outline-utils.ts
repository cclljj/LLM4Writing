import dagre from "@dagrejs/dagre";

export type OutlineNode = {
  id: string;
  parentId: string | null;
  text: string;
  x: number;
  y: number;
  w?: number;
  h?: number;
  lines?: string[];
};

export type OutlineEdge = {
  fromId: string;
  toId: string;
  points: Array<{ x: number; y: number }>;
};

export type OutlinePreview = {
  nodes: OutlineNode[];
  edges: OutlineEdge[];
  width: number;
  height: number;
};

type BuildOutlinePreviewOptions = {
  compact?: boolean;
};

export function extractMermaidText(text: string): string | null {
  const fenced = text.match(/```mermaid\s*([\s\S]*?)```/i);
  if (fenced?.[1]?.trim()) return fenced[1].trim();
  const trimmed = text.trim();
  if ((trimmed.includes("graph ") || trimmed.includes("flowchart ")) && trimmed.includes("-->")) {
    return trimmed;
  }
  return null;
}

export function fromMermaid(text: string): OutlineNode[] {
  const raw = text.trim();
  if (!raw) return [];
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !line.startsWith("graph "))
    .filter((line) => !line.startsWith("flowchart "))
    .filter((line) => !line.startsWith("```"));

  const nodeTextMap = new Map<string, string>();
  const parentMap = new Map<string, string | null>();

  for (const line of lines) {
    const nodeMatch = line.match(/^([A-Za-z0-9_-]+)\s*\["([\s\S]*)"\]$/);
    if (nodeMatch) {
      const [, id, label] = nodeMatch;
      nodeTextMap.set(id, label.replaceAll('\\"', '"').replace(/<br\s*\/?>/gi, "\n"));
      if (!parentMap.has(id)) parentMap.set(id, null);
      continue;
    }
    const edgeWithLabelMatch = line.match(/^([A-Za-z0-9_-]+)\s*-->\s*([A-Za-z0-9_-]+)\s*\["([\s\S]*)"\]$/);
    if (edgeWithLabelMatch) {
      const [, parentId, childId, childLabel] = edgeWithLabelMatch;
      parentMap.set(childId, parentId);
      if (!parentMap.has(parentId)) parentMap.set(parentId, null);
      if (!nodeTextMap.has(parentId)) nodeTextMap.set(parentId, parentId);
      nodeTextMap.set(childId, childLabel.replaceAll('\\"', '"').replace(/<br\s*\/?>/gi, "\n"));
      continue;
    }
    const edgeMatch = line.match(/^([A-Za-z0-9_-]+)\s*-->\s*([A-Za-z0-9_-]+)$/);
    if (edgeMatch) {
      const [, parentId, childId] = edgeMatch;
      parentMap.set(childId, parentId);
      if (!parentMap.has(parentId)) parentMap.set(parentId, null);
      if (!nodeTextMap.has(parentId)) nodeTextMap.set(parentId, parentId);
      if (!nodeTextMap.has(childId)) nodeTextMap.set(childId, childId);
    }
  }

  const ids = Array.from(nodeTextMap.keys());
  if (ids.length === 0) return [];

  const depthMap = new Map<string, number>();
  const getDepth = (id: string): number => {
    const cached = depthMap.get(id);
    if (cached) return cached;
    const parent = parentMap.get(id);
    const depth = parent ? getDepth(parent) + 1 : 1;
    depthMap.set(id, depth);
    return depth;
  };
  ids.forEach((id) => getDepth(id));

  const groups = new Map<number, string[]>();
  ids.forEach((id) => {
    const depth = depthMap.get(id) ?? 1;
    const arr = groups.get(depth) ?? [];
    arr.push(id);
    groups.set(depth, arr);
  });

  const nodes: OutlineNode[] = [];
  Array.from(groups.keys())
    .sort((a, b) => a - b)
    .forEach((depth) => {
      const levelIds = groups.get(depth) ?? [];
      levelIds.sort();
      levelIds.forEach((id, idx) => {
        nodes.push({
          id,
          parentId: parentMap.get(id) ?? null,
          text: nodeTextMap.get(id) ?? id,
          x: 120 + idx * 170,
          y: 40 + (depth - 1) * 120
        });
      });
    });
  return nodes;
}

function wrapByChars(line: string, maxChars: number): string[] {
  const trimmed = line.trim();
  if (!trimmed) return [""];
  const chunks: string[] = [];
  let cursor = 0;
  while (cursor < trimmed.length) {
    chunks.push(trimmed.slice(cursor, cursor + maxChars));
    cursor += maxChars;
  }
  return chunks;
}

function wrapNodeText(text: string, maxCharsPerLine: number, maxLines: number): string[] {
  const sourceLines = text.split("\n");
  const wrapped: string[] = [];
  for (const src of sourceLines) {
    const chunks = wrapByChars(src, maxCharsPerLine);
    for (const c of chunks) {
      wrapped.push(c);
      if (wrapped.length >= maxLines) {
        const last = wrapped[maxLines - 1] ?? "";
        wrapped[maxLines - 1] = last.length >= maxCharsPerLine ? `${last.slice(0, Math.max(0, maxCharsPerLine - 1))}…` : `${last}…`;
        return wrapped.slice(0, maxLines);
      }
    }
  }
  return wrapped.length > 0 ? wrapped : [""];
}

export function buildOutlinePreview(mermaidText: string, options: BuildOutlinePreviewOptions = {}): OutlinePreview | null {
  const nodes = fromMermaid(mermaidText).map((node) => ({ ...node }));
  if (nodes.length === 0) return null;

  const compact = options.compact ?? false;
  const maxCharsPerLine = compact ? 12 : 16;
  const maxLines = compact ? 4 : 5;
  const charPx = compact ? 11 : 12;
  const linePx = compact ? 15 : 16;
  const padX = compact ? 12 : 14;
  const padY = compact ? 10 : 12;
  const nodeMinW = compact ? 160 : 180;
  const nodeMaxW = compact ? 240 : 280;
  const nodeMinH = compact ? 72 : 84;
  const hGap = compact ? 28 : 34;
  const vGap = compact ? 38 : 46;

  for (const n of nodes) {
    const lines = wrapNodeText(n.text, maxCharsPerLine, maxLines);
    const maxLen = Math.max(...lines.map((line) => line.length), 1);
    const w = Math.min(nodeMaxW, Math.max(nodeMinW, padX * 2 + maxLen * charPx));
    const h = Math.max(nodeMinH, padY * 2 + lines.length * linePx);
    n.lines = lines;
    n.w = w;
    n.h = h;
  }

  const byId = new Map(nodes.map((n) => [n.id, n]));
  const graph = new dagre.graphlib.Graph();
  graph.setGraph({
    rankdir: "TB",
    ranksep: nodeMinH + vGap,
    nodesep: hGap,
    marginx: 20,
    marginy: 20,
    ranker: "tight-tree",
  });
  graph.setDefaultEdgeLabel(() => ({}));

  for (const n of nodes) {
    graph.setNode(n.id, { width: n.w ?? nodeMinW, height: n.h ?? nodeMinH });
  }

  for (const n of nodes) {
    if (!n.parentId || !byId.has(n.parentId)) continue;
    graph.setEdge(n.parentId, n.id);
  }

  dagre.layout(graph);

  const positioned = nodes.map((n) => {
    const gnode = graph.node(n.id) as { x: number; y: number; width: number; height: number } | undefined;
    if (!gnode) return n;
    return {
      ...n,
      w: gnode.width,
      h: gnode.height,
      x: gnode.x - gnode.width / 2,
      y: gnode.y - gnode.height / 2,
    };
  });

  const edges: OutlineEdge[] = [];
  for (const n of nodes) {
    if (!n.parentId || !byId.has(n.parentId)) continue;
    const edge = graph.edge(n.parentId, n.id) as { points?: Array<{ x: number; y: number }> } | undefined;
    if (!edge?.points || edge.points.length === 0) continue;
    edges.push({ fromId: n.parentId, toId: n.id, points: edge.points.map((p) => ({ x: p.x, y: p.y })) });
  }

  const graphMeta = graph.graph() as { width?: number; height?: number };
  const width = Math.max(620, Math.ceil((graphMeta.width ?? 0) + 40));
  const height = Math.max(280, Math.ceil((graphMeta.height ?? 0) + 40));
  return { nodes: positioned, edges, width, height };
}
