import test from "node:test";
import assert from "node:assert/strict";

async function read(relativePath: string): Promise<string> {
  const { readFileSync } = await import("node:fs");
  const { resolve, dirname } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const thisDir = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(thisDir, relativePath), "utf8");
}

test("source-guard: student course-history page includes Step6/7/8/10 latestWork artifacts", async () => {
  const src = await read("../app/student/history/[activityId]/page.tsx");
  assert.ok(src.includes("history.latestWork.draftStep6"), "history page should include Step6 draft artifact");
  assert.ok(src.includes("history.latestWork.step7Report"), "history page should include Step7 report artifact");
  assert.ok(src.includes("history.latestWork.draftStep8"), "history page should include Step8 draft artifact");
  assert.ok(src.includes("history.latestWork.step10Report"), "history page should include Step10 report artifact");
});

test("source-guard: monitor route includes outlines and step3SubmittedOutlines fields", async () => {
  const src = await read("../app/api/teacher/monitor/route.ts");
  assert.ok(src.includes("outlines:"), "monitor route must include outlines field");
  assert.ok(src.includes("step3SubmittedOutlines:"), "monitor route must include step3SubmittedOutlines field");
});

test("source-guard: personal-progress route includes outline + step8 artifact fields", async () => {
  const src = await read("../app/api/teacher/personal-progress/route.ts");
  assert.ok(src.includes("userOutline:"), "personal-progress route must include userOutline field");
  assert.ok(src.includes("userStep3SubmittedOutline:"), "personal-progress route must include userStep3SubmittedOutline field");
  assert.ok(src.includes("userDraftStep8:"), "personal-progress route must include userDraftStep8 field");
});

test("source-guard: monitor session type includes outline fields", async () => {
  const src = await read("../app/teacher/_components/types.ts");
  assert.ok(src.includes("outlines?: Record<string, string>"), "MonitorSession type must include outlines field");
  assert.ok(src.includes("step3SubmittedOutlines?: Record<string, string>"), "MonitorSession type must include step3SubmittedOutlines field");
});

test("source-guard: learning monitor uses outline labels and participant mapping", async () => {
  const src = await read("../app/teacher/_components/LearningMonitorTab.tsx");
  assert.ok(src.includes("步驟三完成結構樹"), "learning monitor should render step3 submitted outline label");
  assert.ok(src.includes("步驟四對比修正後"), "learning monitor should render step4 revised outline label");
  assert.ok(
    src.includes("step3SubmittedOutlines?.[p]") || src.includes("step3SubmittedOutlines?.[participant]"),
    "learning monitor should read per-participant step3 submitted outlines"
  );
  assert.ok(
    src.includes("outlines?.[p]") || src.includes("outlines?.[participant]"),
    "learning monitor should read per-participant revised outlines"
  );
  assert.ok(src.includes("setUserOutline"), "learning monitor should track userOutline state updates");
  assert.ok(src.includes("setUserStep3SubmittedOutline"), "learning monitor should track userStep3SubmittedOutline state updates");
});
