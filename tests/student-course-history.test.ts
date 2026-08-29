import test from "node:test";
import assert from "node:assert/strict";
import { resolveStudentCourseLatestWork } from "../src/lib/student-course-history";
import type { SessionState } from "../src/lib/types";

function makeSession(overrides: Partial<SessionState>): SessionState {
  return {
    id: "session",
    createdAt: "2026-08-29T00:00:00.000Z",
    currentStep: 10,
    personalSteps: { alice: 10 },
    participants: ["alice"],
    joinedUsers: ["alice"],
    messages: [],
    groupGate: {},
    reflectionIndex: {},
    workflow: "spec10",
    phaseMax: 10,
    promptConfig: { stepPrompts: {}, subStepPrompts: {}, questionBanks: {} },
    stepState: { step1Substep: 1, step2Substep: 1 },
    outlines: {},
    step3SubmittedOutlines: {},
    draftStep6: {},
    draftStep8: {},
    reports: { step5: {}, step7: {}, step10: {} },
    ...overrides,
  };
}

test("student course history: latest work recovers Step8 draft from another course session", () => {
  const newestWithoutStep8 = makeSession({
    id: "newest",
    createdAt: "2026-08-29T02:00:00.000Z",
    draftStep6: { alice: "最新 session 的 Step6 初稿" },
    reports: { step5: {}, step7: {}, step10: { alice: "最新 session 的 Step10 報告" } },
  });
  const olderWithStep8 = makeSession({
    id: "older",
    createdAt: "2026-08-29T01:00:00.000Z",
    draftStep8: { alice: "較早 session 的 Step8 潤飾稿" },
  });

  const latestWork = resolveStudentCourseLatestWork({
    sessions: [newestWithoutStep8, olderWithStep8],
    username: "alice",
    latestPersonalStep: 10,
  });

  assert.equal(latestWork.draftStep6, "最新 session 的 Step6 初稿");
  assert.equal(latestWork.draftStep8, "較早 session 的 Step8 潤飾稿");
  assert.equal(latestWork.step10Report, "最新 session 的 Step10 報告");
});

test("student course history: Step4 outline remains hidden before personal Step4", () => {
  const session = makeSession({ outlines: { alice: "graph TD\nA[提前存在的模板]" } });
  const latestWork = resolveStudentCourseLatestWork({
    sessions: [session],
    username: "alice",
    latestPersonalStep: 3,
  });

  assert.equal(latestWork.outline, "graph TD\nA[提前存在的模板]");
  assert.equal(latestWork.step4Outline, "");
});
