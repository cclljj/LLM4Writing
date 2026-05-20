"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { resolvePendingOutlineAfterServerSync, shouldSyncOutlineFromSession } from "@/src/lib/outline-sync-guard";
import { getStructureTreeNodePermissions } from "@/src/lib/structure-tree-permissions";
import { fromMermaid as parseMermaid } from "@/src/lib/outline-utils";
import type { OutlineNode } from "@/src/lib/outline-utils";
import Step3ToolHint from "./Step3ToolHint";

function newNodeId(): string {
  return `n-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function makeDefaultOutlineNodes(): OutlineNode[] {
  return [{ id: "root", parentId: null, text: "主題", x: 380, y: 40 }];
}

function escapeMermaidLabel(text: string): string {
  return text.replaceAll('"', '\\"').replace(/\r?\n/g, "<br/>");
}

function toMermaid(nodes: OutlineNode[]): string {
  const lines: string[] = ["graph TD"];
  nodes.forEach((node) => {
    lines.push(`  ${node.id}["${escapeMermaidLabel(node.text || "未命名節點")}"]`);
  });
  nodes
    .filter((node) => node.parentId)
    .forEach((node) => {
      lines.push(`  ${node.parentId} --> ${node.id}`);
    });
  return lines.join("\n");
}

function fromMermaid(text: string): OutlineNode[] {
  const nodes = parseMermaid(text);
  return nodes.length > 0 ? nodes : makeDefaultOutlineNodes();
}

type OutlineEditorProps = {
  serverMermaid: string;
  locked: boolean;
  lockedLabel?: string;
  onSave: (mermaid: string) => Promise<void>;
  onComplete?: (mermaid: string) => Promise<void>;
  completeLabel?: string;
  completeDisabled?: boolean;
  completedMessage?: string;
  completeHint?: string;
};

export default function OutlineEditor({
  serverMermaid,
  locked,
  lockedLabel = "已完成送出",
  onSave,
  onComplete,
  completeLabel = "完成",
  completeDisabled = false,
  completedMessage,
  completeHint,
}: OutlineEditorProps) {
  const [outlineNodes, setOutlineNodes] = useState<OutlineNode[]>(makeDefaultOutlineNodes);
  const [outlineDirty, setOutlineDirty] = useState(false);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [dropTargetNodeId, setDropTargetNodeId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const outlineCanvasRef = useRef<HTMLDivElement | null>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const autoSaveSeqRef = useRef(0);
  const pendingOutlineSyncRef = useRef<string | null>(null);

  useEffect(() => {
    const saved = serverMermaid.trim();
    if (
      !shouldSyncOutlineFromSession({
        localPendingOutline: pendingOutlineSyncRef.current,
        serverOutline: saved,
        outlineDirty,
        draggingNodeId,
        editingNodeId
      })
    ) {
      return;
    }
    pendingOutlineSyncRef.current = resolvePendingOutlineAfterServerSync({
      localPendingOutline: pendingOutlineSyncRef.current,
      serverOutline: saved
    });
    setOutlineNodes(saved ? fromMermaid(saved) : makeDefaultOutlineNodes());
    setOutlineDirty(false);
    setEditingNodeId(null);
  }, [serverMermaid, outlineDirty, draggingNodeId, editingNodeId]);

  useEffect(() => {
    if (!draggingNodeId) return;

    function onMouseMove(event: MouseEvent) {
      const canvas = outlineCanvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left - dragOffset.x;
      const y = event.clientY - rect.top - dragOffset.y;
      const limitX = Math.max(980, canvas.scrollWidth - 130);
      const limitY = Math.max(520, canvas.scrollHeight - 80);
      setOutlineDirty(true);
      setOutlineNodes((prev) =>
        prev.map((node) =>
          node.id === draggingNodeId
            ? {
                ...node,
                x: Math.max(10, Math.min(limitX, x)),
                y: Math.max(10, Math.min(limitY, y))
              }
            : node
        )
      );
    }

    function onMouseUp() {
      setOutlineNodes((prev) => {
        if (!draggingNodeId || !dropTargetNodeId || draggingNodeId === dropTargetNodeId) return prev;
        const dragging = prev.find((node) => node.id === draggingNodeId);
        const target = prev.find((node) => node.id === dropTargetNodeId);
        if (!dragging || !target) return prev;
        const ancestorSet = new Set<string>();
        let cursor: OutlineNode | undefined = target;
        while (cursor?.parentId) {
          ancestorSet.add(cursor.parentId);
          cursor = prev.find((node) => node.id === cursor?.parentId);
        }
        if (ancestorSet.has(dragging.id)) return prev;
        setOutlineDirty(true);
        return prev.map((node) =>
          node.id === draggingNodeId ? { ...node, parentId: target.id, y: target.y + 120 } : node
        );
      });
      setDraggingNodeId(null);
      setDropTargetNodeId(null);
    }

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [dragOffset.x, dragOffset.y, draggingNodeId, dropTargetNodeId]);

  const childrenMap = useMemo(() => {
    const map = new Map<string, OutlineNode[]>();
    outlineNodes.forEach((node) => {
      if (!node.parentId) return;
      const list = map.get(node.parentId) ?? [];
      list.push(node);
      map.set(node.parentId, list);
    });
    return map;
  }, [outlineNodes]);

  const outlineCanvasSize = useMemo(() => {
    const defaultWidth = 1100;
    const defaultHeight = 640;
    if (outlineNodes.length === 0) return { width: defaultWidth, height: defaultHeight };
    const maxX = Math.max(...outlineNodes.map((node) => node.x + 170));
    const maxY = Math.max(...outlineNodes.map((node) => node.y + 130));
    return {
      width: Math.max(defaultWidth, maxX),
      height: Math.max(defaultHeight, maxY)
    };
  }, [outlineNodes]);

  const statusLabel = locked
    ? lockedLabel
    : outlineDirty
      ? "有未儲存變更，完成編輯後會自動儲存"
      : editingNodeId
        ? "正在編輯節點，按 Enter 可完成並儲存"
        : "結構樹已同步";

  function getDepth(nodeId: string): number {
    let depth = 1;
    let cursor = outlineNodes.find((node) => node.id === nodeId);
    while (cursor?.parentId) {
      depth += 1;
      cursor = outlineNodes.find((node) => node.id === cursor?.parentId);
    }
    return depth;
  }

  function addChildNode(parentId: string) {
    if (locked) return;
    const parent = outlineNodes.find((node) => node.id === parentId);
    if (!parent) return;
    const siblings = outlineNodes.filter((node) => node.parentId === parentId);
    const permissions = getStructureTreeNodePermissions(getDepth(parentId), siblings.length);
    if (!permissions.canAddChild) return;
    const next: OutlineNode = {
      id: newNodeId(),
      parentId,
      text: `新節點 ${siblings.length + 1}`,
      x: parent.x + siblings.length * 140,
      y: parent.y + 120
    };
    setOutlineDirty(true);
    setOutlineNodes((prev) => {
      const nextNodes = [...prev, next];
      autoSaveNodes(nextNodes).catch(() => undefined);
      return nextNodes;
    });
  }

  function removeLeafNode(nodeId: string) {
    if (locked) return;
    const hasChildren = outlineNodes.some((node) => node.parentId === nodeId);
    const permissions = getStructureTreeNodePermissions(getDepth(nodeId), hasChildren ? 1 : 0);
    if (!permissions.canDelete) return;
    setOutlineDirty(true);
    setOutlineNodes((prev) => {
      const nextNodes = prev.filter((node) => node.id !== nodeId);
      autoSaveNodes(nextNodes).catch(() => undefined);
      return nextNodes;
    });
    if (editingNodeId === nodeId) setEditingNodeId(null);
  }

  async function autoSaveNodes(nodes: OutlineNode[]) {
    const seq = ++autoSaveSeqRef.current;
    const mermaidText = toMermaid(nodes);
    pendingOutlineSyncRef.current = mermaidText;
    await onSave(mermaidText);
    if (seq === autoSaveSeqRef.current) {
      setOutlineDirty(false);
    }
  }

  function finishNodeEditing(nodeId: string, nextText?: string) {
    if (locked) return;
    setEditingNodeId(null);
    if (!getStructureTreeNodePermissions(getDepth(nodeId), childrenMap.get(nodeId)?.length ?? 0).canEditText) return;
    setOutlineDirty(true);
    setOutlineNodes((prev) => {
      const nextNodes =
        nextText === undefined
          ? prev
          : prev.map((item) => (item.id === nodeId ? { ...item, text: nextText } : item));
      autoSaveNodes(nextNodes).catch(() => undefined);
      return nextNodes;
    });
  }

  function scheduleLongPressEdit(nodeId: string) {
    if (locked) return;
    if (!getStructureTreeNodePermissions(getDepth(nodeId), childrenMap.get(nodeId)?.length ?? 0).canEditText) return;
    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    longPressTimerRef.current = window.setTimeout(() => {
      setDraggingNodeId(null);
      setDropTargetNodeId(null);
      setEditingNodeId(nodeId);
      longPressTimerRef.current = null;
    }, 500);
  }

  function clearLongPressEdit() {
    if (!longPressTimerRef.current) return;
    window.clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = null;
  }

  async function handleComplete() {
    if (locked) return;
    if (!onComplete) return;
    const mermaid = toMermaid(outlineNodes);
    await onComplete(mermaid);
    setOutlineDirty(false);
  }

  return (
    <>
      <Step3ToolHint statusLabel={statusLabel} />
      <div
        style={{
          width: "100%",
          maxHeight: 560,
          border: "1px solid #e5e7eb",
          borderRadius: 10,
          marginTop: 10,
          overflow: "auto",
          background: "linear-gradient(180deg, #f8fafc 0%, #ffffff 100%)"
        }}
      >
        <div
          ref={outlineCanvasRef}
          style={{
            position: "relative",
            width: outlineCanvasSize.width,
            height: outlineCanvasSize.height,
            minWidth: "100%",
            minHeight: 560
          }}
        >
          <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
            {outlineNodes
              .filter((node) => node.parentId)
              .map((node) => {
                const parent = outlineNodes.find((item) => item.id === node.parentId);
                if (!parent) return null;
                return (
                  <line
                    key={`edge-${parent.id}-${node.id}`}
                    x1={parent.x + 60}
                    y1={parent.y + 34}
                    x2={node.x + 60}
                    y2={node.y}
                    stroke="#64748b"
                    strokeWidth={2}
                  />
                );
              })}
          </svg>

          {outlineNodes.map((node) => {
            const children = childrenMap.get(node.id) ?? [];
            const depth = getDepth(node.id);
            const permissions = getStructureTreeNodePermissions(depth, children.length);
            return (
              <div
                key={node.id}
                onMouseEnter={() => draggingNodeId && setDropTargetNodeId(node.id)}
                onMouseDown={(event) => {
                  if (locked) return;
                  const target = event.target as HTMLElement;
                  if (target.closest("button") || target.closest("input")) return;
                  if (!permissions.canEditText) return;
                  const box = event.currentTarget.getBoundingClientRect();
                  setDragOffset({ x: event.clientX - box.left, y: event.clientY - box.top });
                  setDraggingNodeId(node.id);
                  scheduleLongPressEdit(node.id);
                }}
                onMouseUp={clearLongPressEdit}
                onMouseLeave={clearLongPressEdit}
                onTouchStart={(event) => {
                  if (locked) return;
                  const target = event.target as HTMLElement;
                  if (target.closest("button") || target.closest("input")) return;
                  if (!permissions.canEditText) return;
                  scheduleLongPressEdit(node.id);
                }}
                onTouchEnd={clearLongPressEdit}
                onTouchMove={clearLongPressEdit}
                onDoubleClick={(event) => {
                  event.stopPropagation();
                  if (locked) return;
                  if (!permissions.canEditText) return;
                  setDraggingNodeId(null);
                  setDropTargetNodeId(null);
                  setEditingNodeId(node.id);
                }}
                style={{
                  position: "absolute",
                  left: node.x,
                  top: node.y,
                  width: 120,
                  minHeight: 68,
                  borderRadius: 10,
                  border: node.id === dropTargetNodeId ? "2px solid #0ea5e9" : "1px solid #94a3b8",
                  background: "#ffffff",
                  boxShadow: "0 4px 14px rgba(15, 23, 42, 0.08)",
                  padding: "8px 10px 6px",
                  cursor: permissions.canEditText ? "move" : "default",
                  opacity: locked ? 0.92 : 1,
                  userSelect: "none"
                }}
              >
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 4, marginBottom: 4 }}>
                  {permissions.canAddChild && !locked ? (
                    <button
                      type="button"
                      className="secondary"
                      style={{ width: 24, height: 24, padding: 0, lineHeight: 1 }}
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={() => addChildNode(node.id)}
                    >
                      ➕
                    </button>
                  ) : null}
                  {permissions.canDelete && !locked ? (
                    <button
                      type="button"
                      className="secondary"
                      style={{ width: 24, height: 24, padding: 0, lineHeight: 1 }}
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={() => removeLeafNode(node.id)}
                    >
                      ➖
                    </button>
                  ) : null}
                </div>
                {permissions.canEditText && !locked && editingNodeId === node.id ? (
                  <input
                    autoFocus
                    value={node.text}
                    onChange={(e) => {
                      setOutlineDirty(true);
                      setOutlineNodes((prev) =>
                        prev.map((item) => (item.id === node.id ? { ...item, text: e.target.value } : item))
                      );
                    }}
                    onBlur={(e) => finishNodeEditing(node.id, e.target.value)}
                    onPaste={(e) => e.preventDefault()}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        finishNodeEditing(node.id, (e.target as HTMLInputElement).value);
                      }
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                  />
                ) : (
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", whiteSpace: "pre-wrap" }}>
                    {node.text}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {onComplete ? (
        <div style={{ marginTop: 10 }}>
          <div className="row" style={{ gap: 10 }}>
            <div style={{ width: 180 }}>
              <button type="button" className="secondary" onClick={handleComplete} disabled={completeDisabled}>
                {completeLabel}
              </button>
            </div>
          </div>
          {completeHint ? (
            <small style={{ display: "block", marginTop: 8, color: "#b91c1c" }}>
              {completeHint}
            </small>
          ) : null}
        </div>
      ) : null}

      {completedMessage ? (
        <small style={{ display: "block", marginTop: 8 }}>{completedMessage}</small>
      ) : null}
    </>
  );
}
