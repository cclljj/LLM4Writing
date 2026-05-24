import test from "node:test";
import assert from "node:assert/strict";

test("source-guard: student course-history page includes Step6/7/8/10 latestWork artifacts", async () => {
  const { readFileSync } = await import("node:fs");
  const { resolve, dirname } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const thisDir = dirname(fileURLToPath(import.meta.url));
  const src = readFileSync(resolve(thisDir, "../app/student/history/[activityId]/page.tsx"), "utf8");

  assert.ok(src.includes("history.latestWork.draftStep6"), "history page should include Step6 draft artifact");
  assert.ok(src.includes("history.latestWork.step7Report"), "history page should include Step7 report artifact");
  assert.ok(src.includes("history.latestWork.draftStep8"), "history page should include Step8 draft artifact");
  assert.ok(src.includes("history.latestWork.step10Report"), "history page should include Step10 report artifact");
});
