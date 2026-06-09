import test from "node:test";
import assert from "node:assert/strict";
import type { SessionState } from "../src/lib/types";
import {
  countSessions,
  deleteSessionsByActivityId,
  getSession,
  getStorageMode,
  hasStudentActivityByActivityId,
  listActivityIdsWithStudentMessages,
  listMonitorSessionSummariesByActivityId,
  listSessions,
  listSessionsByActivityId,
  listSessionsByParticipant,
  recordLearningEvent,
  listLearningEventsSince,
  saveSession
} from "../src/lib/store";
import { recordRejectedAnswerSignal } from "../src/lib/learning-diagnostics";

function makeSession(id: string, overrides: Partial<SessionState> = {}): SessionState {
  return {
    id,
    createdAt: new Date().toISOString(),
    currentStep: 1,
    participants: ["s1", "s2"],
    personalSteps: { s1: 1, s2: 1 },
    messages: [],
    qualitySignals: { rejectedAnswerCounts: {}, rejectedAnswerLastAt: {} },
    artifactSignals: { outlineUpdatedAt: {}, draftStep6UpdatedAt: {}, draftStep8UpdatedAt: {} },
    groupGate: {},
    reflectionIndex: { s1: 0, s2: 0 },
    workflow: "spec10",
    phaseMax: 10,
    promptConfig: {
      stepPrompts: {},
      subStepPrompts: {},
      subStepPromptsFallbacks: {},
      questionBanks: {},
      step9Questions: {},
      stepOpenings: {}
    },
    stepState: { step1Substep: 1, step2Substep: 1, step1Substep3Question: 1, step1Substep4Question: 1, step2Substep1Question: 1 },
    outlines: {},
    step3SubmittedOutlines: {},
    draftStep6: {},
    draftStep8: {},
    reports: { step5: {}, step7: {}, step10: {} },
    ...overrides
  };
}

test("store behavior: save/get/count/list roundtrip works", async () => {
  const sid = `t-store-${Date.now()}-${Math.random()}`;
  const session = makeSession(sid, {
    activityId: "oc-test-store",
    messages: [{ id: "m1", role: "student", userId: "s1", step: 1, text: "hello", at: new Date().toISOString() }],
    step12FallbackDebugTraces: [
      {
        at: new Date().toISOString(),
        step: 1,
        kind: "step12_feedback",
        substepKey: "1-1",
        originalQuestion: "子步驟 1-1：這篇文章的文體是什麼？",
        originalPrompt: "[system]...\n[user]...",
        originalResponse: "已收到大家回覆，請繼續下一題",
        rejectionReasons: ["generic_feedback_template"],
        errorCategory: "other"
      }
    ]
  });

  await saveSession(session);
  const fetched = await getSession(sid);
  assert.ok(fetched, "session should be retrievable after save");
  assert.equal(fetched?.id, sid);
  assert.equal(fetched?.step12FallbackDebugTraces?.length, 1, "fallback debug traces should roundtrip through store");

  const all = await listSessions({ limit: 1, offset: 0 });
  assert.ok(all.length >= 1);

  const total = await countSessions();
  assert.ok(total >= 1);

  await deleteSessionsByActivityId("oc-test-store");
});

test("store behavior: participant query includes the student session", async () => {
  const sid = `t-participant-${Date.now()}-${Math.random()}`;
  const activityId = `oc-p-${Date.now()}`;
  const session = makeSession(sid, {
    activityId,
    participants: ["s1", "sX"],
    messages: [{ id: "m2", role: "student", userId: "s1", step: 1, text: "joined", at: new Date().toISOString() }]
  });

  await saveSession(session);
  const rows = await listSessionsByParticipant("s1", { activityId });
  assert.ok(rows.some((r) => r.id === sid), "participant query should include saved session");

  await deleteSessionsByActivityId(activityId);
});

test("store behavior: activity query returns only scoped sessions", async () => {
  const activityId = `oc-activity-scope-${Date.now()}`;
  const otherActivityId = `${activityId}-other`;
  const sid1 = `t-activity-scope-1-${Math.random()}`;
  const sid2 = `t-activity-scope-2-${Math.random()}`;
  const sidOther = `t-activity-scope-other-${Math.random()}`;

  await saveSession(makeSession(sid1, {
    activityId,
    messages: [{ id: "m-activity-1", role: "student", userId: "s1", step: 1, text: "one", at: new Date().toISOString() }]
  }));
  await saveSession(makeSession(sid2, {
    activityId,
    messages: [{ id: "m-activity-2", role: "ai", step: 1, text: "two", at: new Date().toISOString() }]
  }));
  await saveSession(makeSession(sidOther, {
    activityId: otherActivityId,
    messages: [{ id: "m-other", role: "student", userId: "s1", step: 1, text: "other", at: new Date().toISOString() }]
  }));

  const scoped = await listSessionsByActivityId(activityId, { workflow: "spec10" });
  assert.ok(scoped.some((session) => session.id === sid1));
  assert.ok(scoped.some((session) => session.id === sid2));
  assert.equal(scoped.some((session) => session.id === sidOther), false);
  assert.equal(await hasStudentActivityByActivityId(activityId), true);
  const idsWithStudentMessages = await listActivityIdsWithStudentMessages();
  assert.equal(idsWithStudentMessages.has(activityId), true);
  assert.equal(idsWithStudentMessages.has(otherActivityId), true);

  await deleteSessionsByActivityId(activityId);
  await deleteSessionsByActivityId(otherActivityId);
});

test("store behavior: monitor summaries are activity-scoped and paginated", async () => {
  const activityId = `oc-monitor-${Date.now()}`;
  const sid1 = `t-monitor-1-${Math.random()}`;
  const sid2 = `t-monitor-2-${Math.random()}`;

  await saveSession(makeSession(sid1, { activityId, currentStep: 2 }));
  await saveSession(makeSession(sid2, { activityId, currentStep: 3 }));

  const page = await listMonitorSessionSummariesByActivityId(activityId, { limit: 1, offset: 0 });
  assert.equal(page.sessions.length, 1);
  assert.equal(page.total >= 2, true);
  assert.equal(page.sessions[0]?.activityId, activityId);

  await deleteSessionsByActivityId(activityId);
});

test("learning diagnostics behavior: rejected answer signal is accumulated", () => {
  const session = { qualitySignals: { rejectedAnswerCounts: {} as Record<string, number>, rejectedAnswerLastAt: {} as Record<string, string> } };
  recordRejectedAnswerSignal(session, "u1", "step1::q1");
  recordRejectedAnswerSignal(session, "u1", "step1::q1");
  assert.equal(session.qualitySignals.rejectedAnswerCounts["u1::step1::q1"], 2);
});

test("event behavior: learning events can be listed (DB mode) or safely no-op (memory mode)", async () => {
  const mode = getStorageMode();
  const cutoff = new Date(Date.now() - 60_000).toISOString();

  await recordLearningEvent({ kind: "fallback", activityId: "oc-event", step: 2, fallbackUsed: true, errorCategory: "other" });
  const rows = await listLearningEventsSince(cutoff);

  if (mode === "postgres") {
    assert.ok(Array.isArray(rows));
  } else {
    assert.deepEqual(rows, []);
  }
});

// single source-guard for this topic file

test("source-guard: store keeps optimistic-lock error type", async () => {
  const { readFileSync } = await import("node:fs");
  const { resolve, dirname } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const thisDir = dirname(fileURLToPath(import.meta.url));
  const src = readFileSync(resolve(thisDir, "../src/lib/store.ts"), "utf8");
  assert.ok(src.includes("SessionVersionConflictError"));
});

test("source-guard: activity-scoped routes avoid unbounded listSessions", async () => {
  const { readFileSync } = await import("node:fs");
  const { resolve, dirname } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const thisDir = dirname(fileURLToPath(import.meta.url));
  const files = [
    "../app/api/teacher/research-export/route.ts",
    "../app/api/teacher/course-diagnostics/route.ts",
    "../app/api/student/join/route.ts",
    "../app/api/admin/activities/route.ts",
    "../app/api/admin/openclasses/route.ts"
  ];
  for (const file of files) {
    const src = readFileSync(resolve(thisDir, file), "utf8");
    assert.equal(src.includes("listSessions()"), false, `${file} should not call unbounded listSessions()`);
  }

  const monitor = readFileSync(resolve(thisDir, "../app/api/teacher/monitor/route.ts"), "utf8");
  assert.ok(monitor.includes("listSessions({ limit: GLOBAL_MONITOR_SESSION_SCAN_LIMIT"));
  const diagnostics = readFileSync(resolve(thisDir, "../app/api/admin/diagnostics/route.ts"), "utf8");
  assert.ok(diagnostics.includes("listSessions({ limit: DIAGNOSTICS_SESSION_SCAN_LIMIT"));
});
