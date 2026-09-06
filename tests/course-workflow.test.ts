import test from "node:test";
import assert from "node:assert/strict";
import {
  getGuidedDiscussionPromptStep,
  getNextWorkflowStep,
  getSessionWorkflowSteps,
  getStepsBeforeCapability,
  getWorkflowCapability,
  getWorkflowPromptStepKey,
  getWorkflowStepByCapability,
  getWorkflowStepMode,
  getWorkflowStepName,
  normalizeCourseWorkflowSteps,
  resolveDefaultCourseWorkflowStepsFromConfig
} from "../src/lib/course-workflow";

test("workflow fallback is sourced from the configured default term", () => {
  const defaultSteps = resolveDefaultCourseWorkflowStepsFromConfig();
  const normalizedMissing = normalizeCourseWorkflowSteps(undefined);
  const normalizedInvalid = normalizeCourseWorkflowSteps([
    { step: 0, name: "", mode: "missing", capability: "missing" }
  ]);

  assert.ok(defaultSteps.length > 0);
  assert.deepEqual(normalizedMissing, defaultSteps);
  assert.deepEqual(normalizedInvalid, defaultSteps);
});

test("term workflow supports reordered and additional existing-capability steps", () => {
  const workflowSteps = normalizeCourseWorkflowSteps([
    { step: 20, name: "自由個人討論", mode: "personal_interaction", capability: "personal_interaction" },
    { step: 1, name: "重新命名的討論", mode: "group_interaction", capability: "topic_discussion" },
    { step: 10, name: "完成回顧", mode: "non_interactive", capability: "final_report" }
  ]);
  const session = { workflowSteps };

  assert.deepEqual(getSessionWorkflowSteps(session).map((item) => item.step), [20, 1, 10]);
  assert.equal(getWorkflowStepName(session, 20), "自由個人討論");
  assert.equal(getWorkflowStepMode(session, 20), "personal_interaction");
  assert.equal(getNextWorkflowStep(session, 20)?.step, 1);
});

test("capability helpers decouple runtime step ids from legacy prompt keys", () => {
  const workflowSteps = normalizeCourseWorkflowSteps([
    { step: 11, name: "題目討論", mode: "group_interaction", capability: "topic_discussion" },
    { step: 13, name: "生成論點", mode: "personal_interaction", capability: "outline" },
    { step: 17, name: "摘要報告", mode: "non_interactive", capability: "summary_report" },
    { step: 19, name: "個人反思", mode: "personal_reflection", capability: "reflection" },
    { step: 20, name: "總結報告", mode: "non_interactive", capability: "final_report" }
  ]);
  const session = { workflowSteps };

  assert.equal(getWorkflowStepByCapability(session, "outline")?.step, 13);
  assert.equal(getWorkflowCapability(session, 20), "final_report");
  assert.equal(getWorkflowPromptStepKey(session, 13), "3");
  assert.equal(getGuidedDiscussionPromptStep(getWorkflowCapability(session, 11)), 1);
  assert.deepEqual(getStepsBeforeCapability(session, "summary_report"), [11, 13]);
});
