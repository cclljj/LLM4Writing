"use client";

import { buildOutlinePreview } from "@/src/lib/outline-utils";

type Props = {
  mermaidText: string;
  label?: string;
  /** compact=true uses smaller boxes (110×64) suited for student/history views */
  compact?: boolean;
};

export default function OutlineSvg({ mermaidText, label, compact = false }: Props) {
  const preview = buildOutlinePreview(mermaidText);
  if (!preview) return null;

  const nodeW = compact ? 110 : 130;
  const nodeH = compact ? 64 : 80;
  const centerX = nodeW / 2;
  const edgeY = Math.floor(nodeH / 2);

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
        {preview.nodes
          .filter((node) => node.parentId)
          .map((node) => {
            const parent = preview.nodes.find((item) => item.id === node.parentId);
            if (!parent) return null;
            return (
              <line
                key={`${parent.id}-${node.id}`}
                x1={parent.x + centerX}
                y1={parent.y + edgeY}
                x2={node.x + centerX}
                y2={node.y}
                stroke="#94a3b8"
                strokeWidth="2"
              />
            );
          })}
        {preview.nodes.map((node) => (
          <g key={node.id}>
            <rect x={node.x} y={node.y} width={nodeW} height={nodeH} rx="10" fill={compact ? "#f8fafc" : "#fff"} stroke={compact ? "#94a3b8" : "#64748b"} />
            <text
              x={node.x + centerX}
              y={node.y + (compact ? Math.floor(nodeH / 2) + 4 : 28)}
              textAnchor="middle"
              fontSize="12"
              fill="#0f172a"
            >
              {compact ? (
                node.text.length > 20 ? `${node.text.slice(0, 20)}...` : node.text
              ) : (
                node.text.split("\n").map((line, idx) => (
                  <tspan key={`${node.id}-${idx}`} x={node.x + centerX} dy={idx === 0 ? 0 : 16}>
                    {line}
                  </tspan>
                ))
              )}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
