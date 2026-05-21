import test from "node:test";
import assert from "node:assert/strict";
import { getOnlineUsers, markUserOnline } from "../src/lib/session-presence";
import { validateStep3OutlineCompletion } from "../src/lib/step3-outline-validation";
import {
  computeTeacherMonitorPayloadHash,
  hasLowLatencyStepAdvanceGate,
  resolveTeacherMonitorNextPollDelay,
  TEACHER_MONITOR_FAST_POLL_MS,
  TEACHER_MONITOR_MAX_POLL_MS,
  TEACHER_MONITOR_MIN_POLL_MS
} from "../src/lib/teacher-monitor-polling";

test("session presence behavior: online user appears then expires by window", async () => {
  const sessionId = `presence-${Date.now()}-${Math.random()}`;
  await markUserOnline(sessionId, "alice");
  const nowOnline = await getOnlineUsers(sessionId);
  assert.ok(nowOnline.includes("alice"));

  const oldIso = new Date(Date.now() - 60_000).toISOString();
  await markUserOnline(sessionId, "bob", oldIso);
  const filtered = await getOnlineUsers(sessionId);
  assert.ok(!filtered.includes("bob"));
});

test("step3 completion behavior: unchanged depth-3 node fails, edited passes", () => {
  const defaultMermaid = [
    "graph TD",
    "  n1[\"主題\"]",
    "  n2[\"理由A\"]",
    "  n3[\"理由B\"]",
    "  n4[\"例子A1\"]",
    "  n5[\"例子B1\"]",
    "  n1 --> n2",
    "  n1 --> n3",
    "  n2 --> n4",
    "  n3 --> n5"
  ].join("\n");

  const unchanged = defaultMermaid;
  const changed = defaultMermaid.replace("例子A1", "例子A1-補充").replace("例子B1", "例子B1-補充");

  const bad = validateStep3OutlineCompletion(defaultMermaid, unchanged, 3);
  assert.equal(bad.ok, false);
  assert.ok(bad.unchangedNodeIds.length >= 1);

  const good = validateStep3OutlineCompletion(defaultMermaid, changed, 3);
  assert.equal(good.ok, true);
  assert.equal(good.unchangedNodeIds.length, 0);
});

test("teacher monitor polling behavior: hash and delay policy are deterministic", () => {
  const base = [{ sessionId: "s1", currentStep: 3, messageCount: 4, groupGate: { "3-complete": ["s1"] } }];
  const same = [{ sessionId: "s1", currentStep: 3, messageCount: 4, groupGate: { "3-complete": ["s1"] } }];
  const changed = [{ sessionId: "s1", currentStep: 4, messageCount: 4, groupGate: { "4-complete": ["s1"] } }];

  assert.equal(computeTeacherMonitorPayloadHash(base), computeTeacherMonitorPayloadHash(same));
  assert.notEqual(computeTeacherMonitorPayloadHash(base), computeTeacherMonitorPayloadHash(changed));

  assert.equal(hasLowLatencyStepAdvanceGate(base), true);
  assert.equal(hasLowLatencyStepAdvanceGate([{ sessionId: "s2", currentStep: 6 }]), false);

  assert.equal(resolveTeacherMonitorNextPollDelay({ currentDelayMs: 8000, unchanged: true, hasLowLatencyGate: true }), TEACHER_MONITOR_FAST_POLL_MS);
  assert.equal(resolveTeacherMonitorNextPollDelay({ currentDelayMs: 8000, unchanged: false, hasLowLatencyGate: false }), TEACHER_MONITOR_MIN_POLL_MS);
  assert.equal(resolveTeacherMonitorNextPollDelay({ currentDelayMs: 20000, unchanged: true, hasLowLatencyGate: false }), TEACHER_MONITOR_MAX_POLL_MS);
});

// single source-guard for this topic file

test("source-guard: session route still references If-None-Match", async () => {
  const { readFileSync } = await import("node:fs");
  const { resolve, dirname } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const thisDir = dirname(fileURLToPath(import.meta.url));
  const src = readFileSync(resolve(thisDir, "../app/api/session/[sessionId]/route.ts"), "utf8");
  assert.ok(src.includes("If-None-Match") || src.includes("if-none-match"));
});
