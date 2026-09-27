import test from "node:test";
import assert from "node:assert/strict";
import { buildStaggeredOutlineTree } from "../src/lib/courseImplementationPdf";

test("course PDF outline tree retains parent links and staggers siblings", () => {
  const nodes = buildStaggeredOutlineTree([
    "graph TD",
    "A[\"中心想法：海洋保育的重要性\"]",
    "A --> B[\"原因一：減少塑膠垃圾\"]",
    "A --> C[\"原因二：保護海洋生物\"]",
    "A --> E[\"原因三：減少廢水污染\"]",
    "B --> D[\"例子：自備環保餐具與水壺\"]",
  ].join("\n"));

  assert.deepEqual(nodes, [
    { id: "A", parentId: null, text: "中心想法：海洋保育的重要性", depth: 1, column: 0, row: 0 },
    { id: "B", parentId: "A", text: "原因一：減少塑膠垃圾", depth: 2, column: 0, row: 0 },
    { id: "C", parentId: "A", text: "原因二：保護海洋生物", depth: 2, column: 1, row: 0 },
    { id: "E", parentId: "A", text: "原因三：減少廢水污染", depth: 2, column: 0, row: 1 },
    { id: "D", parentId: "B", text: "例子：自備環保餐具與水壺", depth: 3, column: 0, row: 0 },
  ]);
});
