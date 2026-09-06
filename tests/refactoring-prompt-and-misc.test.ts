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

  assert.equal(findActivity(activityId)?.academicYear, "115");
  assert.equal(findActivity(activityId)?.academicYearTerm, "1");

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

test("source-guard: 114-2 remains the original snapshot and 115-1 only applies its documented prompt override", async () => {
  const { readFileSync } = await import("node:fs");
  const { resolve, dirname } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const thisDir = dirname(fileURLToPath(import.meta.url));
  const config = JSON.parse(readFileSync(resolve(thisDir, "../src/config/course-step-configs.json"), "utf8"));
  const workflowConfig = JSON.parse(readFileSync(resolve(thisDir, "../src/config/course-workflow-configs.json"), "utf8"));
  const originalPrompts = JSON.parse(readFileSync(resolve(thisDir, "../src/config/system-prompt-config.json"), "utf8"));
  assert.equal(config.default, "115-1");
  assert.equal(workflowConfig.default, "115-1");
  for (const term of ["114-2", "115-1"]) {
    const snapshot = config.terms?.[term];
    assert.equal(snapshot?.extends, undefined);
    assert.equal(snapshot?.workflowSteps, undefined);
    const expectedPromptConfig = structuredClone(originalPrompts);
    if (term === "115-1") {
      expectedPromptConfig.subStepPrompts["1-4-1"] = "你是作文老師。請只輸出一個給 12-14 歲學生回答的問題。禁止輸出規則、說明、前言、標題、清單、範例、角色扮演文字；禁止說「請依上一則 AI 提問作答」；禁止重貼本提示內容。問題必須是一句完整問句、以「？」結尾，語句白話、具體，且要引用學生上一則回覆中的關鍵詞。提問目標：引導學生思考這篇文章最想讓讀者感受到或記住的重點是什麼。若文體是議論文，請學生說出他對此議題的立場或看法；若文體是記敘文或抒情文，請學生說出這件事帶給他的影響、體悟或感受。要求學生用一到兩句話表達。";
    }
    assert.deepEqual(snapshot?.promptConfig, expectedPromptConfig);
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
