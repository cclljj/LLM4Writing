export type OutlineNode = {
  id: string;
  parentId: string | null;
  text: string;
  x: number;
  y: number;
};

export type OutlinePreview = {
  nodes: OutlineNode[];
  width: number;
  height: number;
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

export function buildOutlinePreview(mermaidText: string): OutlinePreview | null {
  const nodes = fromMermaid(mermaidText).map((node) => ({ ...node }));
  if (nodes.length === 0) return null;
  const minX = Math.min(...nodes.map((node) => node.x));
  const minY = Math.min(...nodes.map((node) => node.y));
  const normalized = nodes.map((node) => ({ ...node, x: node.x - minX + 20, y: node.y - minY + 20 }));
  const maxX = Math.max(...normalized.map((node) => node.x + 130));
  const maxY = Math.max(...normalized.map((node) => node.y + 80));
  return { nodes: normalized, width: Math.max(520, maxX + 20), height: Math.max(240, maxY + 20) };
}
