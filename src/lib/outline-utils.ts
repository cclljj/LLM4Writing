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

export type OutlinePreview = {
  nodes: OutlineNode[];
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

  const byId = new Map(nodes.map((n) => [n.id, n]));
  const children = new Map<string, string[]>();
  const roots: string[] = [];
  for (const n of nodes) {
    if (!n.parentId || !byId.has(n.parentId)) {
      roots.push(n.id);
      continue;
    }
    const bucket = children.get(n.parentId) ?? [];
    bucket.push(n.id);
    children.set(n.parentId, bucket);
  }
  roots.sort();
  for (const bucket of children.values()) bucket.sort();

  const depthById = new Map<string, number>();
  const setDepth = (id: string, depth: number): void => {
    if ((depthById.get(id) ?? 0) >= depth) return;
    depthById.set(id, depth);
    for (const childId of children.get(id) ?? []) setDepth(childId, depth + 1);
  };
  for (const rootId of roots) setDepth(rootId, 1);
  for (const n of nodes) if (!depthById.has(n.id)) depthById.set(n.id, 1);

  for (const n of nodes) {
    const lines = wrapNodeText(n.text, maxCharsPerLine, maxLines);
    const maxLen = Math.max(...lines.map((line) => line.length), 1);
    const w = Math.min(nodeMaxW, Math.max(nodeMinW, padX * 2 + maxLen * charPx));
    const h = Math.max(nodeMinH, padY * 2 + lines.length * linePx);
    n.lines = lines;
    n.w = w;
    n.h = h;
  }

  const order: string[] = [];
  const walk = (id: string): void => {
    const childIds = children.get(id) ?? [];
    if (childIds.length === 0) {
      order.push(id);
      return;
    }
    childIds.forEach((childId) => walk(childId));
  };
  roots.forEach((rootId) => walk(rootId));
  for (const n of nodes) if (!order.includes(n.id)) order.push(n.id);

  const centerX = new Map<string, number>();
  let cursor = 0;
  for (const id of order) {
    const n = byId.get(id);
    if (!n) continue;
    centerX.set(id, cursor + (n.w ?? nodeMinW) / 2);
    cursor += (n.w ?? nodeMinW) + hGap;
  }
  const placeParent = (id: string): number => {
    const childIds = children.get(id) ?? [];
    if (childIds.length === 0) return centerX.get(id) ?? 0;
    const childCenters = childIds.map((childId) => placeParent(childId)).sort((a, b) => a - b);
    const center = (childCenters[0]! + childCenters[childCenters.length - 1]!) / 2;
    centerX.set(id, center);
    return center;
  };
  roots.forEach((rootId) => placeParent(rootId));

  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = 0;
  for (const n of nodes) {
    const cx = centerX.get(n.id) ?? 0;
    const w = n.w ?? nodeMinW;
    const h = n.h ?? nodeMinH;
    n.x = cx - w / 2;
    n.y = ((depthById.get(n.id) ?? 1) - 1) * (nodeMinH + vGap);
    minX = Math.min(minX, n.x);
    maxX = Math.max(maxX, n.x + w);
    maxY = Math.max(maxY, n.y + h);
  }

  const normLeft = 20 - minX;
  const normalized = nodes.map((n) => ({ ...n, x: n.x + normLeft, y: n.y + 20 }));
  const width = Math.max(620, Math.ceil(maxX - minX + 40));
  const height = Math.max(280, Math.ceil(maxY + 40));
  return { nodes: normalized, width, height };
}
