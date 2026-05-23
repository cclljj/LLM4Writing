import test from "node:test";
import assert from "node:assert/strict";
import { buildRecentFallbackTraces } from "../src/lib/diagnostics-fallback-traces";
import type { PersistedEventRow } from "../src/lib/store";
import type { SessionState } from "../src/lib/types";

function makeSession(): SessionState {
  return {
    id: "s-1",
    createdAt: "2026-05-23T10:00:00.000Z",
    currentStep: 1,
    personalSteps: { stu1: 1, stu2: 1 },
    participants: ["stu1", "stu2"],
    joinedUsers: ["stu1", "stu2"],
    messages: [
      { id: "m1", role: "system", step: 1, text: "子步驟 1-2：請找出三個關鍵字。", at: "2026-05-23T10:01:00.000Z" },
      { id: "m2", role: "student", userId: "stu1", step: 1, text: "我覺得關鍵字是責任、選擇、後果。", at: "2026-05-23T10:02:00.000Z" },
      { id: "m3", role: "student", userId: "stu2", step: 1, text: "我補充：自律、同儕、時間管理。", at: "2026-05-23T10:03:00.000Z" }
    ],
    qualitySignals: { rejectedAnswerCounts: {}, rejectedAnswerLastAt: {} },
    artifactSignals: { outlineUpdatedAt: {}, draftStep6UpdatedAt: {}, draftStep8UpdatedAt: {} },
    step12RoundLogs: [],
    step12RoundState: { completedGateKeys: [] },
    groupGate: { "1-2": [] },
    reflectionIndex: { stu1: 0, stu2: 0 },
    workflow: "spec10",
    phaseMax: 10,
    activityId: "ac-1",
    activityTitle: "手機使用與自律",
    groupId: "g1",
    groupName: "第一組",
    promptConfig: {
      systemPrompt: "你是國小寫作老師，請使用繁體中文。",
      stepPrompts: { "1": "步驟一要協助學生辨識題目重點。" },
      step12FeedbackPrompts: {},
      step12FeedbackFocusPrompts: {},
      subStepPrompts: {},
      subStepPromptsFallbacks: {},
      questionBanks: {},
      step9Questions: {},
      stepOpenings: {}
    },
    systemPromptCache: {},
    stepState: { step1Substep: 2, step2Substep: 1, step1Substep3Question: 1, step1Substep4Question: 1, step2Substep1Question: 1 },
    outlines: {},
    step3SubmittedOutlines: {},
    draftStep6: {},
    draftStep8: {},
    reports: { step5: {}, step7: {}, step10: {} }
  };
}

function makeLearningEvent(): PersistedEventRow {
  return {
    id: "ev-1",
    session_id: "s-1",
    activity_id: "ac-1",
    step: 1,
    kind: "step12_feedback",
    latency_ms: 1200,
    fallback_used: true,
    error_category: "parse_fail",
    created_at: new Date("2026-05-23T10:04:00.000Z")
  };
}

test("diagnostics fallback traces: reconstructs readable prompt from session context", () => {
  const traces = buildRecentFallbackTraces({
    learningEvents: [makeLearningEvent()],
    llmEvents: [],
    sessions: [makeSession()],
    limit: 5
  });

  assert.equal(traces.length, 1);
  assert.equal(traces[0]?.sampleErrorSource, "learning_event");
  assert.equal(traces[0]?.reconstructionSource, "session_messages_and_prompt_config");
  assert.ok(traces[0]?.reconstructedPrompt.includes("[system]"));
  assert.ok(traces[0]?.reconstructedPrompt.includes("[user]"));
  assert.ok(traces[0]?.reconstructedPrompt.includes("手機使用與自律"));
  assert.ok(traces[0]?.reconstructedPrompt.includes("子步驟 1-2"));
});

test("diagnostics fallback traces: keeps event-only trace when session is unavailable", () => {
  const traces = buildRecentFallbackTraces({
    learningEvents: [makeLearningEvent()],
    llmEvents: [],
    sessions: [],
    limit: 5
  });

  assert.equal(traces.length, 1);
  assert.equal(traces[0]?.reconstructionSource, "event_only");
  assert.ok(traces[0]?.reconstructedPrompt.includes("[reconstructed=false]"));
});
