import test from "node:test";
import assert from "node:assert/strict";
import {
  appendTeacherHelpHint,
  getActiveGroupGateKey,
  getMode,
  getOwnStepFromSession,
  getStudentRetryableMessage,
  isRetryableStudentFetchError,
  looksLikeInstructionPromptText,
  StudentFetchError
} from "../src/lib/student-page-helpers";
import { stepNameMap } from "../src/lib/step-names";

test("stepNameMap covers all ten steps with non-empty names", () => {
  for (let step = 1; step <= 10; step++) {
    assert.ok(stepNameMap[step]?.trim(), `step ${step} should have a display name`);
  }
});

test("getMode maps each step to its interaction mode", () => {
  for (const step of [1, 2, 4]) assert.equal(getMode(step), "group_interaction");
  for (const step of [3, 6, 8]) assert.equal(getMode(step), "personal_interaction");
  for (const step of [5, 7, 10]) assert.equal(getMode(step), "non_interactive");
  assert.equal(getMode(9), "personal_reflection");
});

test("getActiveGroupGateKey derives step1/step2 substep gate keys", () => {
  assert.equal(getActiveGroupGateKey(null, 1), null);
  assert.equal(getActiveGroupGateKey({ stepState: { step1Substep: 2 } }, 1), "1-2");
  assert.equal(getActiveGroupGateKey({ stepState: { step1Substep: 3, step1Substep3Question: 2 } }, 1), "1-3-2");
  assert.equal(getActiveGroupGateKey({ stepState: { step1Substep: 4 } }, 1), "1-4-1");
  assert.equal(getActiveGroupGateKey({ stepState: { step2Substep: 1, step2Substep1Question: 3 } }, 2), "2-1-3");
  assert.equal(getActiveGroupGateKey({ stepState: { step2Substep: 2 } }, 2), "2-2");
  assert.equal(getActiveGroupGateKey({ stepState: {} }, 1), "1-1");
  assert.equal(getActiveGroupGateKey({ stepState: {} }, 3), null);
});

test("isRetryableStudentFetchError retries transient failures only", () => {
  assert.equal(isRetryableStudentFetchError(new StudentFetchError("x", "network")), true);
  assert.equal(isRetryableStudentFetchError(new StudentFetchError("x", "timeout")), true);
  assert.equal(isRetryableStudentFetchError(new StudentFetchError("x", "parse", 200)), true);
  assert.equal(isRetryableStudentFetchError(new StudentFetchError("x", "http", 429)), true);
  assert.equal(isRetryableStudentFetchError(new StudentFetchError("x", "http", 503)), true);
  assert.equal(isRetryableStudentFetchError(new StudentFetchError("x", "http", 401)), false);
  assert.equal(isRetryableStudentFetchError(new StudentFetchError("x", "http", 404)), false);
  assert.equal(isRetryableStudentFetchError(new Error("plain")), true);
});

test("appendTeacherHelpHint adds the hint exactly once", () => {
  const hinted = appendTeacherHelpHint("請修改你的結構樹。");
  assert.ok(hinted.includes("舉手請老師"));
  assert.equal(appendTeacherHelpHint(hinted), hinted);
});

test("looksLikeInstructionPromptText flags instruction-shaped text", () => {
  assert.equal(looksLikeInstructionPromptText("【提問規則】請依序回答"), true);
  assert.equal(looksLikeInstructionPromptText("請回答以下問題：你怎麼看？"), true);
  assert.equal(looksLikeInstructionPromptText("a\nb\nc\nd"), true);
  assert.equal(looksLikeInstructionPromptText("好的"), false);
});

test("getOwnStepFromSession prefers personal step over session step", () => {
  assert.equal(getOwnStepFromSession({ currentStep: 3, personalSteps: { amy: 6 } }, "amy"), 6);
  assert.equal(getOwnStepFromSession({ currentStep: 3, personalSteps: { amy: 6 } }, "bob"), 3);
  assert.equal(getOwnStepFromSession({ currentStep: 3 }, "amy"), 3);
});

test("getStudentRetryableMessage returns actionable text per target", () => {
  for (const target of ["auth", "overview", "join"] as const) {
    const message = getStudentRetryableMessage(target);
    assert.ok(message.length > 10, `${target} message should be meaningful`);
    assert.ok(message.includes("老師"), `${target} message should tell students to involve the teacher`);
  }
});
