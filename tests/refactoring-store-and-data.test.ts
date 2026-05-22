import test from "node:test";
import assert from "node:assert/strict";
import type { SessionState } from "../src/lib/types";
import {
  countSessions,
  deleteSessionsByActivityId,
  getSession,
  getStorageMode,
  listMonitorSessionSummariesByActivityId,
  listSessions,
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
    messages: [{ id: "m1", role: "student", userId: "s1", step: 1, text: "hello", at: new Date().toISOString() }]
  });

  await saveSession(session);
  const fetched = await getSession(sid);
  assert.ok(fetched, "session should be retrievable after save");
  assert.equal(fetched?.id, sid);

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
