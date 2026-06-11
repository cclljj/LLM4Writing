import test from "node:test";
import assert from "node:assert/strict";
import {
  buildResearchStudentInputExport,
  RESEARCH_EXPORT_HASH_SALT_MISSING,
  resolveResearchExportHashSalt
} from "../src/lib/research-export";
import type { Activity, SessionState } from "../src/lib/types";

const activity: Activity = {
  id: "oc-101",
  school: "研究高中",
  classNumber: "701",
  essayId: "essay-1",
  title: "研究題目",
  genre: "議論文",
  durationMinutes: 40,
  supplemental: "",
  courseStatus: "ended",
  groups: [{ groupId: "g1", groupName: "第一組", members: ["alice", "bob"] }]
};

function makeSession(): SessionState {
  return {
    id: "session-1",
    workflow: "spec10",
    phaseMax: 10,
    currentStep: 3,
    activityId: activity.id,
    activityTitle: activity.title,
    groupId: "g1",
    groupName: "第一組",
    participants: ["alice", "bob"],
    joinedUsers: ["alice"],
    messages: [
      { id: "m1", role: "system", step: 3, text: "請回答", at: "2026-06-07T00:00:00.000Z" },
      { id: "m2", role: "student", userId: "alice", step: 3, text: "  我的想法\r\n第二行  ", at: "2026-06-07T00:01:00.000Z" },
      { id: "m3", role: "ai", userId: "alice", step: 3, text: "AI 回覆", at: "2026-06-07T00:02:00.000Z" },
      { id: "m4", role: "student", userId: "mallory", step: 3, text: "非成員", at: "2026-06-07T00:03:00.000Z" },
      { id: "m5", role: "student", userId: "bob", step: 4, text: "同學回應", at: "2026-06-07T00:04:00.000Z" }
    ],
    stepState: { step1Substep: 1, step2Substep: 1 },
    groupGate: {},
    reflectionIndex: {},
    outlines: {},
    step3SubmittedOutlines: {},
    makeupWork: {
      outlineRequiredUsernames: ["bob"],
      outlineCompletedUsernames: ["bob"],
      outlineCompletedAt: { bob: "2026-06-07T00:05:00.000Z" },
      outlineReasons: { bob: ["absent_step3"] },
      outlineEvents: [
        {
          username: "bob",
          reason: "absent_step3",
          stepContext: 6,
          createdAt: "2026-06-07T00:05:00.000Z",
          text: "graph TD\nA[補做主題] --> B[理由]"
        }
      ]
    },
    draftStep6: {},
    draftStep8: {},
    reports: { step5: {}, step7: {}, step10: {} },
    promptConfig: { stepPrompts: {}, subStepPrompts: {}, questionBanks: {} },
    createdAt: "2026-06-07T00:00:00.000Z"
  };
}

function withEnv<T>(env: { nodeEnv?: string; researchExportHashSalt?: string | undefined }, run: () => T): T {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalSalt = process.env.RESEARCH_EXPORT_HASH_SALT;
  try {
    if (env.nodeEnv !== undefined) {
      Object.defineProperty(process.env, "NODE_ENV", {
        value: env.nodeEnv,
        configurable: true,
        enumerable: true,
        writable: true
      });
    }
    if (env.researchExportHashSalt === undefined) {
      delete process.env.RESEARCH_EXPORT_HASH_SALT;
    } else {
      process.env.RESEARCH_EXPORT_HASH_SALT = env.researchExportHashSalt;
    }
    return run();
  } finally {
    Object.defineProperty(process.env, "NODE_ENV", {
      value: originalNodeEnv,
      configurable: true,
      enumerable: true,
      writable: true
    });
    if (originalSalt === undefined) {
      delete process.env.RESEARCH_EXPORT_HASH_SALT;
    } else {
      process.env.RESEARCH_EXPORT_HASH_SALT = originalSalt;
    }
  }
}

test("research export: anonymous mode includes only participant student inputs", () => {
  const payload = buildResearchStudentInputExport({
    activity,
    sessions: [makeSession()],
    identityMode: "anonymous",
    exportedAt: "2026-06-07T01:00:00.000Z"
  });

  assert.equal(payload.schemaVersion, "research-student-inputs-v2");
  assert.equal(payload.identityMode, "anonymous");
  assert.equal(payload.records.length, 3);
  assert.equal(payload.records[0]!.text, "我的想法\n第二行");
  assert.equal(payload.records[0]!.studentAccount, undefined);
  assert.equal(payload.records[0]!.studentHash.length, 64);
  assert.deepEqual(payload.records.map((record) => record.role), ["student", "student", "student"]);
  assert.deepEqual(payload.records.map((record) => record.type), ["student_message", "student_message", "makeup_outline"]);
  assert.deepEqual(payload.records.map((record) => record.studentAccount), [undefined, undefined, undefined]);
});

test("research export: account mode includes raw student account", () => {
  const payload = buildResearchStudentInputExport({
    activity,
    sessions: [makeSession()],
    identityMode: "account"
  });

  assert.equal(payload.identityMode, "account");
  assert.deepEqual(payload.records.map((record) => record.studentAccount), ["alice", "bob", "bob"]);
});

test("research export: production requires configured hash salt", () => {
  withEnv({ nodeEnv: "production", researchExportHashSalt: undefined }, () => {
    assert.throws(
      () =>
        buildResearchStudentInputExport({
          activity,
          sessions: [makeSession()],
          identityMode: "anonymous"
        }),
      { message: RESEARCH_EXPORT_HASH_SALT_MISSING }
    );
  });
});

test("research export: production treats blank hash salt as missing", () => {
  withEnv({ nodeEnv: "production", researchExportHashSalt: "   " }, () => {
    assert.throws(() => resolveResearchExportHashSalt(), { message: RESEARCH_EXPORT_HASH_SALT_MISSING });
  });
});

test("research export: production uses configured hash salt", () => {
  withEnv({ nodeEnv: "production", researchExportHashSalt: "test-secret-salt" }, () => {
    const payload = buildResearchStudentInputExport({
      activity,
      sessions: [makeSession()],
      identityMode: "anonymous"
    });
    assert.equal(payload.records[0]!.studentHash.length, 64);
  });
});
