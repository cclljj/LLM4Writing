import test from "node:test";
import assert from "node:assert/strict";
import {
  computeNextOpenClassId,
  endCourse,
  getCourseStatus,
  startCourse,
  togglePauseOrResumeCourse,
  upsertEssay,
  upsertOpenClass
} from "../src/lib/activity-store";

test("activity store behavior: open class id generation uses max existing sequence", () => {
  assert.equal(computeNextOpenClassId(["oc-001", "oc-009", "oc-010"]), "oc-011");
  assert.equal(computeNextOpenClassId(["x", "oc-099", "oc-003"]), "oc-100");
  assert.equal(computeNextOpenClassId([]), "oc-001");
});

test("activity store behavior: course state transitions are valid", () => {
  const essay = upsertEssay({
    title: `test-essay-${Date.now()}`,
    genre: "議論文",
    description: "for test",
    enabled: true
  });
  assert.equal(essay.id.startsWith("essay-"), true);
  const created = upsertOpenClass({
    school: "Demo High",
    classNumber: `9${String(Date.now()).slice(-2)}`,
    essayId: essay.id,
    durationMinutes: 40,
    supplemental: ""
  });
  assert.equal(created.ok, true);
  if (!created.ok) return;
  const activityId = created.saved.id;

  assert.equal(getCourseStatus(activityId), "not_started");

  const started = startCourse(activityId);
  assert.equal(started.ok, true);
  assert.equal(getCourseStatus(activityId), "in_progress");

  const paused = togglePauseOrResumeCourse(activityId);
  assert.equal(paused.ok, true);
  assert.equal(getCourseStatus(activityId), "paused");

  const resumed = togglePauseOrResumeCourse(activityId);
  assert.equal(resumed.ok, true);
  assert.equal(getCourseStatus(activityId), "in_progress");

  const ended = endCourse(activityId);
  assert.equal(ended.ok, true);
  assert.equal(getCourseStatus(activityId), "ended");
});

// single source-guard for this topic file

test("source-guard: system prompt config retains step12FeedbackPrompts key", async () => {
  const { readFileSync } = await import("node:fs");
  const { resolve, dirname } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const thisDir = dirname(fileURLToPath(import.meta.url));
  const src = readFileSync(resolve(thisDir, "../src/config/system-prompt-config.json"), "utf8");
  assert.ok(src.includes("\"step12FeedbackPrompts\""));
});
