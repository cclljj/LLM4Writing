import test from "node:test";
import assert from "node:assert/strict";
import { buildPrintableOutlinePreview } from "../src/lib/courseImplementationPdf";

test("course PDF outline uses the same positioned tree preview as the web", () => {
  const preview = buildPrintableOutlinePreview([
    "graph TD",
    "A[\"中心想法：海洋保育的重要性\"]",
    "A --> B[\"原因一：減少塑膠垃圾\"]",
    "A --> C[\"原因二：保護海洋生物\"]",
    "B --> D[\"例子：自備環保餐具與水壺\"]",
  ].join("\n"));

  assert.ok(preview);
  assert.equal(preview!.nodes.length, 4);
  assert.equal(preview!.edges.length, 3);
  assert.ok(preview!.edges.every((edge) => edge.points.length >= 2));
  assert.deepEqual(preview!.nodes.find((node) => node.id === "A")?.lines, ["中心想法：海洋保育的重要性"]);
});
