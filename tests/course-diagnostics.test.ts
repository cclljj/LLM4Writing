import test from "node:test";
import assert from "node:assert/strict";
import { buildCourseDiagnostics } from "../src/lib/course-diagnostics";
import type { PersistedEventRow } from "../src/lib/store";
import type { SessionState } from "../src/lib/types";

function makeSession(overrides: Partial<SessionState> = {}): SessionState {
  return {
    id: "s1",
    createdAt: "2026-06-01T01:00:00.000Z",
    currentStep: 3,
    participants: ["stu1", "stu2"],
    joinedUsers: ["stu1", "stu2"],
    messages: [
      { id: "m1", role: "student", userId: "stu1", step: 1, text: "我想到責任、選擇、後果。", at: "2026-06-01T01:00:00.000Z" },
      { id: "m2", role: "ai", step: 1, text: "請繼續討論。", at: "2026-06-01T01:01:00.000Z" },
      { id: "m3", role: "student", userId: "stu2", step: 2, text: "我找到一個生活例子。", at: "2026-06-01T01:05:00.000Z" },
      { id: "m4", role: "ai", step: 2, text: "AI 建議：已收到你的草稿", at: "2026-06-01T01:06:00.000Z" }
    ],
    qualitySignals: {
      rejectedAnswerCounts: { "stu1::step-2": 2 },
      rejectedAnswerLastAt: { "stu1::step-2": "2026-06-01T01:05:30.000Z" }
    },
    groupGate: {},
    reflectionIndex: {},
    workflow: "spec10",
    phaseMax: 10,
    activityId: "oc-1",
    activityTitle: "測試課程",
    groupId: "g1",
    groupName: "1",
    promptConfig: { stepPrompts: {}, subStepPrompts: {}, questionBanks: {} },
    stepState: { step1Substep: 1, step2Substep: 1 },
    outlines: {},
    draftStep6: {},
    draftStep8: {},
    reports: { step5: {}, step7: {}, step10: {} },
    ...overrides
  };
}

function makeEvent(overrides: Partial<PersistedEventRow>): PersistedEventRow {
  return {
    id: "e1",
    session_id: "s1",
    activity_id: "oc-1",
    step: 2,
    kind: "step6_suggest",
    latency_ms: 1000,
    fallback_used: true,
    error_category: null,
    created_at: new Date("2026-06-01T01:06:00.000Z"),
    ...overrides
  };
}

test("course diagnostics estimates fallback, rejection, and dwell time from session messages", () => {
  const diagnostics = buildCourseDiagnostics("oc-1", [makeSession()]);
  assert.equal(diagnostics.source, "estimated_from_session_messages");
  assert.equal(diagnostics.summary.totalSessions, 1);
  assert.equal(diagnostics.summary.totalFallbacks, 1);
  assert.equal(diagnostics.summary.totalRejections, 2);
  assert.equal(diagnostics.summary.highestFallbackStep, 2);
  assert.equal(diagnostics.summary.highestRejectionStep, 2);
  assert.ok((diagnostics.summary.averageStepDurations.find((item) => item.step === 1)?.averageMs ?? 0) > 0);
});

test("course diagnostics prefers persisted learning events when available", () => {
  const diagnostics = buildCourseDiagnostics("oc-1", [makeSession()], [
    makeEvent({ id: "e1", kind: "step3_response", step: 3, fallback_used: true }),
    makeEvent({ id: "e2", kind: "student_rejection", step: 3, fallback_used: false })
  ]);
  assert.equal(diagnostics.source, "persisted_learning_events");
  assert.equal(diagnostics.summary.totalFallbacks, 1);
  assert.equal(diagnostics.summary.totalRejections, 1);
  assert.equal(diagnostics.summary.highestFallbackStep, 3);
  assert.equal(diagnostics.summary.highestRejectionStep, 3);
});

test("course diagnostics groups same-day sessions by group and splits different days", () => {
  const sameDayA = makeSession({
    id: "s-a",
    createdAt: "2026-06-01T01:00:00.000Z",
    messages: [
      { id: "a1", role: "student", userId: "stu1", step: 1, text: "回答一", at: "2026-06-01T01:00:00.000Z" },
      { id: "a2", role: "ai", step: 1, text: "AI 建議：已收到你的草稿", at: "2026-06-01T01:01:00.000Z" }
    ],
    qualitySignals: { rejectedAnswerCounts: {}, rejectedAnswerLastAt: {} }
  });
  const sameDayB = makeSession({
    id: "s-b",
    createdAt: "2026-06-01T02:00:00.000Z",
    messages: [
      { id: "b1", role: "student", userId: "stu2", step: 2, text: "回答二", at: "2026-06-01T02:00:00.000Z" },
      { id: "b2", role: "ai", step: 2, text: "正常回覆", at: "2026-06-01T02:01:00.000Z" }
    ],
    qualitySignals: {
      rejectedAnswerCounts: { "stu2::step-2": 1 },
      rejectedAnswerLastAt: { "stu2::step-2": "2026-06-01T02:00:30.000Z" }
    }
  });
  const nextDay = makeSession({
    id: "s-c",
    createdAt: "2026-06-02T01:00:00.000Z",
    messages: [
      { id: "c1", role: "student", userId: "stu1", step: 1, text: "隔天回答", at: "2026-06-02T01:00:00.000Z" },
      { id: "c2", role: "ai", step: 1, text: "正常回覆", at: "2026-06-02T01:01:00.000Z" }
    ],
    qualitySignals: { rejectedAnswerCounts: {}, rejectedAnswerLastAt: {} }
  });

  const diagnostics = buildCourseDiagnostics("oc-1", [sameDayA, sameDayB, nextDay]);
  assert.equal(diagnostics.sessions.length, 2);
  const june1 = diagnostics.sessions.find((session) => session.date === "2026-06-01");
  const june2 = diagnostics.sessions.find((session) => session.date === "2026-06-02");
  assert.ok(june1);
  assert.ok(june2);
  assert.deepEqual(june1.sessionIds, ["s-a", "s-b"]);
  assert.equal(june1.fallbackCount, 1);
  assert.equal(june1.rejectionCount, 1);
  assert.equal(june1.totalAi, 2);
  assert.deepEqual(june2.sessionIds, ["s-c"]);
});

test("course diagnostics splits a single session by Taipei implementation dates", () => {
  const spanningSession = makeSession({
    id: "s-span",
    createdAt: "2026-06-01T15:20:00.000Z",
    currentStep: 4,
    messages: [
      { id: "d1", role: "student", userId: "stu1", step: 1, text: "第一天回答", at: "2026-06-01T15:30:00.000Z" },
      { id: "d2", role: "ai", step: 1, text: "AI 建議：已收到你的草稿", at: "2026-06-01T15:31:00.000Z" },
      { id: "d3", role: "student", userId: "stu2", step: 3, text: "第二天繼續", at: "2026-06-01T16:30:00.000Z" },
      { id: "d4", role: "ai", step: 3, text: "正常回覆", at: "2026-06-01T16:31:00.000Z" }
    ],
    qualitySignals: {
      rejectedAnswerCounts: { "stu2::step-3": 1 },
      rejectedAnswerLastAt: { "stu2::step-3": "2026-06-01T16:30:30.000Z" }
    }
  });

  const diagnostics = buildCourseDiagnostics("oc-1", [spanningSession]);
  assert.equal(diagnostics.sessions.length, 2);
  const dayOne = diagnostics.sessions.find((session) => session.date === "2026-06-01");
  const dayTwo = diagnostics.sessions.find((session) => session.date === "2026-06-02");
  assert.ok(dayOne);
  assert.ok(dayTwo);
  assert.deepEqual(dayOne.sessionIds, ["s-span"]);
  assert.deepEqual(dayTwo.sessionIds, ["s-span"]);
  assert.equal(dayOne.fallbackCount, 1);
  assert.equal(dayOne.totalAi, 1);
  assert.equal(dayTwo.rejectionCount, 1);
  assert.equal(dayTwo.totalAi, 1);
  assert.equal(dayOne.stepDurations.find((item) => item.step === 1)?.averageMs, 60_000);
  assert.equal(dayOne.stepDurations.some((item) => item.averageMs > 60 * 60 * 1000), false);
});

test("course diagnostics groups by Taipei date instead of UTC date", () => {
  const lateNight = makeSession({
    id: "s-late",
    createdAt: "2026-06-01T16:20:00.000Z",
    messages: [
      { id: "late-1", role: "student", userId: "stu1", step: 1, text: "台北凌晨回答", at: "2026-06-01T16:30:00.000Z" },
      { id: "late-2", role: "ai", step: 1, text: "正常回覆", at: "2026-06-01T16:31:00.000Z" }
    ],
    qualitySignals: { rejectedAnswerCounts: {}, rejectedAnswerLastAt: {} }
  });

  const diagnostics = buildCourseDiagnostics("oc-1", [lateNight]);
  assert.equal(diagnostics.sessions.length, 1);
  assert.equal(diagnostics.sessions[0]?.date, "2026-06-02");
});
