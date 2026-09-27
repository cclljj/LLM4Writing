import test from "node:test";
import assert from "node:assert/strict";
import { buildReadableOutlineRows } from "../src/lib/courseImplementationPdf";

test("course PDF outline rows retain all nodes in a readable hierarchy", () => {
  const rows = buildReadableOutlineRows([
    "graph TD",
    "A[\"中心想法：海洋保育的重要性\"]",
    "A --> B[\"原因一：減少塑膠垃圾\"]",
    "A --> C[\"原因二：保護海洋生物\"]",
    "B --> D[\"例子：自備環保餐具與水壺\"]",
  ].join("\n"));

  assert.deepEqual(rows, [
    { depth: 1, text: "中心想法：海洋保育的重要性" },
    { depth: 2, text: "原因一：減少塑膠垃圾" },
    { depth: 2, text: "原因二：保護海洋生物" },
    { depth: 3, text: "例子：自備環保餐具與水壺" },
  ]);
});
