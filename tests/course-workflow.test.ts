import test from "node:test";
import assert from "node:assert/strict";
import { getNextWorkflowStep, getSessionWorkflowSteps, getWorkflowStepMode, getWorkflowStepName, normalizeCourseWorkflowSteps } from "../src/lib/course-workflow";

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
