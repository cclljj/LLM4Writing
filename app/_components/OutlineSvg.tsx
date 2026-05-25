"use client";

import { buildOutlinePreview } from "@/src/lib/outline-utils";

type Props = {
  mermaidText: string;
  label?: string;
  /** compact=true uses smaller boxes (110×64) suited for student/history views */
  compact?: boolean;
};

export default function OutlineSvg({ mermaidText, label, compact = false }: Props) {
  const preview = buildOutlinePreview(mermaidText, { compact });
  if (!preview) return null;

  const nodeDefaultW = compact ? 160 : 180;
  const nodeDefaultH = compact ? 72 : 84;
  const lineHeight = compact ? 15 : 16;
  const textTopPad = compact ? 14 : 18;
  const elbowGap = compact ? 10 : 12;

  return (
    <div
      style={{
        marginTop: 8,
        overflow: "auto",
        border: "1px solid #e5e7eb",
        borderRadius: 8,
        padding: compact ? 0 : 8,
        background: compact ? "#ffffff" : "#f8fafc"
      }}
    >
      {label ? <small style={{ display: "block", marginBottom: 4, color: "#475569" }}>{label}</small> : null}
      <svg
        width={preview.width}
        height={preview.height}
        style={{ display: "block" }}
        role="img"
        aria-label={label}
      >
        {preview.edges.length > 0
          ? preview.edges.map((edge) => (
            <polyline
              key={`${edge.fromId}-${edge.toId}`}
              points={edge.points.map((p) => `${p.x},${p.y}`).join(" ")}
              stroke="#94a3b8"
              strokeWidth="2"
              fill="none"
            />
          ))
          : preview.nodes
            .filter((node) => node.parentId)
            .map((node) => {
              const parent = preview.nodes.find((item) => item.id === node.parentId);
              if (!parent) return null;
              const parentW = parent.w ?? nodeDefaultW;
              const parentH = parent.h ?? nodeDefaultH;
              const childW = node.w ?? nodeDefaultW;
              const parentCx = parent.x + parentW / 2;
              const childCx = node.x + childW / 2;
              const startY = parent.y + parentH;
              const endY = node.y;
              const midY = Math.floor((startY + endY) / 2);
              return (
                <polyline
                  key={`${parent.id}-${node.id}`}
                  points={`${parentCx},${startY} ${parentCx},${Math.min(startY + elbowGap, midY)} ${childCx},${midY} ${childCx},${endY}`}
                  stroke="#94a3b8"
                  strokeWidth="2"
                  fill="none"
                />
              );
            })}
        {preview.nodes.map((node) => (
          <g key={node.id}>
            <rect
              x={node.x}
              y={node.y}
              width={node.w ?? nodeDefaultW}
              height={node.h ?? nodeDefaultH}
              rx="10"
              fill={compact ? "#f8fafc" : "#fff"}
              stroke={compact ? "#94a3b8" : "#64748b"}
            />
            <text
              x={node.x + (node.w ?? nodeDefaultW) / 2}
              y={node.y + textTopPad}
              textAnchor="middle"
              fontSize="12"
              fill="#0f172a"
            >
              {(node.lines && node.lines.length > 0 ? node.lines : node.text.split("\n")).map((line, idx) => (
                <tspan
                  key={`${node.id}-${idx}`}
                  x={node.x + (node.w ?? nodeDefaultW) / 2}
                  dy={idx === 0 ? 0 : lineHeight}
                >
                  {line}
                </tspan>
              ))}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
