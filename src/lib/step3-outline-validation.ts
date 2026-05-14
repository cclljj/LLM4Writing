import { fromMermaid } from "@/src/lib/outline-utils";
import type { OutlineNode } from "@/src/lib/outline-utils";

export type Step3OutlineValidationResult = {
  ok: boolean;
  requiredNodeCount: number;
  changedNodeCount: number;
  unchangedNodeIds: string[];
};

function normalizeNodeText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function buildDepthMap(nodes: OutlineNode[]): Map<string, number> {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const depthCache = new Map<string, number>();

  const resolveDepth = (id: string, visiting = new Set<string>()): number => {
    const cached = depthCache.get(id);
    if (typeof cached === "number") return cached;
    if (visiting.has(id)) {
      depthCache.set(id, 1);
      return 1;
    }
    visiting.add(id);
    const node = byId.get(id);
    const parentId = node?.parentId ?? null;
    const depth = parentId && byId.has(parentId) ? resolveDepth(parentId, visiting) + 1 : 1;
    depthCache.set(id, depth);
    visiting.delete(id);
    return depth;
  };

  nodes.forEach((node) => resolveDepth(node.id));
  return depthCache;
}

export function validateStep3OutlineCompletion(
  defaultOutlineMermaid: string,
  submittedOutlineMermaid: string,
  minEditableDepth = 3
): Step3OutlineValidationResult {
  const defaultNodes = fromMermaid(defaultOutlineMermaid);
  const submittedNodes = fromMermaid(submittedOutlineMermaid);
  const defaultDepthMap = buildDepthMap(defaultNodes);
  const submittedMap = new Map(submittedNodes.map((node) => [node.id, node]));

  const targetNodes = defaultNodes.filter((node) => (defaultDepthMap.get(node.id) ?? 1) >= minEditableDepth);
  const unchangedNodeIds: string[] = [];

  for (const node of targetNodes) {
    const submittedNode = submittedMap.get(node.id);
    if (!submittedNode) continue;
    if (normalizeNodeText(submittedNode.text) === normalizeNodeText(node.text)) {
      unchangedNodeIds.push(node.id);
    }
  }

  return {
    ok: targetNodes.length > 0 && unchangedNodeIds.length === 0,
    requiredNodeCount: targetNodes.length,
    changedNodeCount: targetNodes.length - unchangedNodeIds.length,
    unchangedNodeIds
  };
}
