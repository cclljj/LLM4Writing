import test from "node:test";
import assert from "node:assert/strict";
import {
  computeNextOpenClassId,
  endCourse,
  findActivity,
  getCourseEndedAt,
  getCourseStatus,
  startCourse,
  togglePauseOrResumeCourse,
  upsertEssay,
  upsertOpenClass
} from "../src/lib/activity-store";
import { getCourseStepConfigKey, resolveCourseStepConfig } from "../src/lib/prompt-config";

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

  assert.equal(findActivity(activityId)?.academicYear, "114");
  assert.equal(findActivity(activityId)?.academicYearTerm, "2");

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

  const endedAtIso = "2026-08-29T08:15:30.000Z";
  const ended = endCourse(activityId, endedAtIso);
  assert.equal(ended.ok, true);
  assert.equal(getCourseStatus(activityId), "ended");
  assert.equal(getCourseEndedAt(activityId), endedAtIso);
  assert.equal(findActivity(activityId)?.courseEndedAt, endedAtIso);

  const resumedAfterEnd = togglePauseOrResumeCourse(activityId);
  assert.equal(resumedAfterEnd.ok, true);
  assert.equal(getCourseStatus(activityId), "in_progress");
  assert.equal(getCourseEndedAt(activityId), undefined);
});

test("activity store behavior: owner teacher username is preserved on activity projection", () => {
  const essay = upsertEssay({
    title: `owner-teacher-essay-${Date.now()}`,
    genre: "議論文",
    description: "owner teacher projection test",
    enabled: true
  });
  const created = upsertOpenClass({
    school: "Demo High",
    classNumber: `8${String(Date.now()).slice(-2)}`,
    essayId: essay.id,
    durationMinutes: 30,
    supplemental: "",
    ownerTeacherUsername: "teacher"
  });
  assert.equal(created.ok, true);
  if (!created.ok) return;

  const activity = findActivity(created.saved.id);
  assert.ok(activity);
  assert.equal(activity?.ownerTeacherUsername, "teacher");
});

// single source-guard for this topic file

test("source-guard: 114-2 and initial 115-1 configs are exact snapshots of the original prompts and openings", async () => {
  const { readFileSync } = await import("node:fs");
  const { resolve, dirname } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const thisDir = dirname(fileURLToPath(import.meta.url));
  const config = JSON.parse(readFileSync(resolve(thisDir, "../src/config/course-step-configs.json"), "utf8"));
  const workflowConfig = JSON.parse(readFileSync(resolve(thisDir, "../src/config/course-workflow-configs.json"), "utf8"));
  const originalPrompts = JSON.parse(readFileSync(resolve(thisDir, "../src/config/system-prompt-config.json"), "utf8"));
  for (const term of ["114-2", "115-1"]) {
    const snapshot = config.terms?.[term];
    assert.equal(snapshot?.extends, undefined);
    assert.equal(snapshot?.workflowSteps, undefined);
    assert.deepEqual(snapshot?.promptConfig, originalPrompts);
    assert.deepEqual(workflowConfig.terms?.[term]?.workflowSteps?.map((step: { step: number; capability: string }) => `${step.step}:${step.capability}`), [
      "1:topic_discussion",
      "2:research_discussion",
      "3:outline",
      "4:peer_outline",
      "5:summary_report",
      "6:draft",
      "7:feedback_report",
      "8:revision",
      "9:reflection",
      "10:final_report"
    ]);
    for (const step of ["1", "2", "3", "4", "6", "8", "9"]) {
      assert.equal(snapshot?.stepOpenings?.[step], readFileSync(resolve(thisDir, `../src/config/step-opening/${step}.md`), "utf8"));
    }
  }
});

test("course step config: terms resolve independently and unknown terms safely use the default", () => {
  assert.equal(getCourseStepConfigKey("115", "1"), "115-1");

  const legacy = resolveCourseStepConfig("114", "2");
  const current = resolveCourseStepConfig("115", "1");
  const unknown = resolveCourseStepConfig("116", "1");

  assert.equal(current.promptConfig?.systemPrompt, legacy.promptConfig?.systemPrompt);
  assert.notEqual(current, legacy);
  assert.equal(unknown.promptConfig?.systemPrompt, legacy.promptConfig?.systemPrompt);
});
