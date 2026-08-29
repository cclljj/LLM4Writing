import assert from "node:assert/strict";
import test from "node:test";
import { buildOutlinePreview } from "@/src/lib/outline-utils";

function overlap(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number }
): boolean {
  return !(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y);
}

test("outline layout: graph-engine preview returns routed edges and non-overlapping nodes", () => {
  const mermaid = `
flowchart TB
  A["議論文 AI 對生活的影響"] --> B["引論"]
  A --> C["本論"]
  A --> D["結論"]
  B --> E["便利性增加與效率提升"]
  B --> F["也可能造成依賴與思考惰性"]
  C --> G["支持觀點：改善生活品質與生產力"]
  C --> H["反對觀點：工作取代與社會不平等"]
  D --> I["結論一：不能躺平，仍需主動學習"]
  D --> J["結論二：善用 AI 而非被 AI 取代"]
  `;

  const preview = buildOutlinePreview(mermaid, { compact: true });
  assert.ok(preview);
  assert.ok(preview!.nodes.length >= 10);
  assert.ok(preview!.edges.length > 0);
  assert.ok(preview!.edges.every((edge) => edge.points.length >= 2));

  const boxes = preview!.nodes.map((n) => ({
    id: n.id,
    x: n.x,
    y: n.y,
    w: n.w ?? 0,
    h: n.h ?? 0
  }));
  for (let i = 0; i < boxes.length; i += 1) {
    for (let j = i + 1; j < boxes.length; j += 1) {
      assert.equal(overlap(boxes[i]!, boxes[j]!), false, `nodes overlap: ${boxes[i]!.id} vs ${boxes[j]!.id}`);
    }
  }
});

test("outline layout: report preview can keep long node text without ellipsis truncation", () => {
  const longText = "這是一段很長的第四步驟修正後結構樹節點文字，用來確認 PDF 報告模式會保留完整內容，不會因為預設節點行數上限而被省略。";
  const preview = buildOutlinePreview(
    `
flowchart TB
  A["主題"]
  B["${longText}"]
  A --> B
  `,
    { maxLines: 40 }
  );

  assert.ok(preview);
  const target = preview!.nodes.find((node) => node.id === "B");
  assert.ok(target);
  assert.equal(target!.lines?.join("").includes("…"), false);
  assert.equal(target!.lines?.join(""), longText);
});
