/**
 * Tests for Issue #225:
 * Teacher/admin view renders step-3 and step-4 outlines as SVG trees
 * in both group and individual record panels.
 */
import test from "node:test";
import assert from "node:assert/strict";

// ---------------------------------------------------------------------------
// monitor route exposes outlines and step3SubmittedOutlines
// ---------------------------------------------------------------------------

test("#225: monitor route source includes outlines and step3SubmittedOutlines fields", async () => {
  const { readFileSync } = await import("node:fs");
  const { resolve, dirname } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const thisDir = dirname(fileURLToPath(import.meta.url));

  const src = readFileSync(resolve(thisDir, "../app/api/teacher/monitor/route.ts"), "utf8");
  assert.ok(src.includes("outlines:"), "monitor route must include outlines field");
  assert.ok(src.includes("step3SubmittedOutlines:"), "monitor route must include step3SubmittedOutlines field");
});

// ---------------------------------------------------------------------------
// personal-progress route exposes userOutline and userStep3SubmittedOutline
// ---------------------------------------------------------------------------

test("#225: personal-progress route source includes userOutline and userStep3SubmittedOutline fields", async () => {
  const { readFileSync } = await import("node:fs");
  const { resolve, dirname } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const thisDir = dirname(fileURLToPath(import.meta.url));

  const src = readFileSync(resolve(thisDir, "../app/api/teacher/personal-progress/route.ts"), "utf8");
  assert.ok(src.includes("userOutline:"), "personal-progress route must include userOutline field");
  assert.ok(src.includes("userStep3SubmittedOutline:"), "personal-progress route must include userStep3SubmittedOutline field");
});

// ---------------------------------------------------------------------------
// teacher page uses renderOutlineSvg helper and new outline state
// ---------------------------------------------------------------------------

test("#225: teacher page defines renderOutlineSvg helper function", async () => {
  const { readFileSync } = await import("node:fs");
  const { resolve, dirname } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const thisDir = dirname(fileURLToPath(import.meta.url));

  const src = readFileSync(resolve(thisDir, "../app/teacher/page.tsx"), "utf8");
  assert.ok(src.includes("function renderOutlineSvg("), "teacher page must define renderOutlineSvg helper");
});

test("#225: teacher page tracks userOutline and userStep3SubmittedOutline state", async () => {
  const { readFileSync } = await import("node:fs");
  const { resolve, dirname } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const thisDir = dirname(fileURLToPath(import.meta.url));

  const src = readFileSync(resolve(thisDir, "../app/teacher/page.tsx"), "utf8");
  assert.ok(src.includes("userOutline"), "teacher page must track userOutline state");
  assert.ok(src.includes("userStep3SubmittedOutline"), "teacher page must track userStep3SubmittedOutline state");
});

test("#225: teacher page MonitorSession type includes outlines and step3SubmittedOutlines", async () => {
  const { readFileSync } = await import("node:fs");
  const { resolve, dirname } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const thisDir = dirname(fileURLToPath(import.meta.url));

  const src = readFileSync(resolve(thisDir, "../app/teacher/page.tsx"), "utf8");
  assert.ok(
    src.includes("outlines?: Record<string, string>"),
    "MonitorSession type must include outlines field"
  );
  assert.ok(
    src.includes("step3SubmittedOutlines?: Record<string, string>"),
    "MonitorSession type must include step3SubmittedOutlines field"
  );
});

test("#225: teacher page group record renders step3 and step4 outlines for each participant", async () => {
  const { readFileSync } = await import("node:fs");
  const { resolve, dirname } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const thisDir = dirname(fileURLToPath(import.meta.url));

  const src = readFileSync(resolve(thisDir, "../app/teacher/page.tsx"), "utf8");
  assert.ok(src.includes("步驟三完成結構樹"), "teacher group view must label step-3 submitted outline");
  assert.ok(src.includes("步驟四對比修正後"), "teacher group view must label step-4 revised outline");
  assert.ok(src.includes("step3SubmittedOutlines?.[p]") || src.includes("step3SubmittedOutlines?.[participant]"), "teacher group view must read per-participant step3SubmittedOutlines");
  assert.ok(src.includes("outlines?.[p]") || src.includes("outlines?.[participant]"), "teacher group view must read per-participant outlines");
});

test("#225: teacher page individual record renders step3 and step4 outlines for selected user", async () => {
  const { readFileSync } = await import("node:fs");
  const { resolve, dirname } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const thisDir = dirname(fileURLToPath(import.meta.url));

  const src = readFileSync(resolve(thisDir, "../app/teacher/page.tsx"), "utf8");
  assert.ok(src.includes("userStep3SubmittedOutline"), "teacher individual view must use userStep3SubmittedOutline");
  assert.ok(src.includes("userOutline"), "teacher individual view must use userOutline");
});
