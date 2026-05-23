import test from "node:test";
import assert from "node:assert/strict";
import { buildStudentCourseContext } from "../src/lib/llm-context";
import {
  composeStep10Report,
  normalizeStep10SectionBody,
  parseStep10SectionTitles,
  resolveStep10ReportConfig,
  stripLeadingStep10SectionHeading
} from "../src/lib/step10-report-format";
import type { SessionState } from "../src/lib/types";

function makeSession(overrides: Partial<SessionState> = {}): SessionState {
  return {
    id: "ctx-1",
    createdAt: new Date().toISOString(),
    currentStep: 4,
    participants: ["s1", "s2"],
    personalSteps: { s1: 2, s2: 2 },
    messages: [],
    qualitySignals: { rejectedAnswerCounts: {}, rejectedAnswerLastAt: {} },
    artifactSignals: { outlineUpdatedAt: {}, draftStep6UpdatedAt: {}, draftStep8UpdatedAt: {} },
    groupGate: {},
    reflectionIndex: { s1: 0, s2: 0 },
    workflow: "spec10",
    phaseMax: 10,
    promptConfig: { stepPrompts: {}, subStepPrompts: {}, subStepPromptsFallbacks: {}, questionBanks: {}, step9Questions: {}, stepOpenings: {} },
    stepState: { step1Substep: 1, step2Substep: 1, step1Substep3Question: 1, step1Substep4Question: 1, step2Substep1Question: 1 },
    outlines: {},
    step3SubmittedOutlines: {},
    draftStep6: {},
    draftStep8: {},
    reports: { step5: {}, step7: {}, step10: {} },
    ...overrides
  };
}

test("step10 report behavior: section parsing and composition are stable", () => {
  const cfg = resolveStep10ReportConfig({ sections: [{ title: "一、摘要" }, { title: "二、建議" }] });
  assert.equal(cfg.sections.length, 2);

  const parsed = parseStep10SectionTitles("## 一、摘要\n## 二、建議");
  assert.deepEqual(parsed, ["摘要", "建議"]);

  const stripped = stripLeadingStep10SectionHeading("## 一、摘要\n內容A", "一、摘要");
  assert.equal(stripped.includes("## 一、摘要"), false);

  const normalized = normalizeStep10SectionBody("## 二、建議\n請再補例子\n請再補例子", "二、建議", ["摘要", "建議"]);
  assert.ok(normalized.includes("請再補例子"));

  const report = composeStep10Report(
    [
      { title: "一、摘要", body: "重點" },
      { title: "二、建議", body: "行動" }
    ],
    cfg.completionReminder
  );
  assert.ok(report.includes("## 摘要"));
  assert.ok(report.includes("## 建議"));
});

test("llm context behavior: layered summary + recent snippet output", () => {
  const session = makeSession({
    messages: [
      { id: "m1", role: "student", userId: "s1", step: 1, text: "我的結論是要限制手機時間", at: "2026-05-21T10:00:00.000Z" },
      { id: "m2", role: "student", userId: "s2", step: 1, text: "但是我不同意完全禁止", at: "2026-05-21T10:01:00.000Z" },
      { id: "m3", role: "student", userId: "s1", step: 1, text: "下一步要補一個例子嗎？", at: "2026-05-21T10:02:00.000Z" },
      { id: "m4", role: "ai", step: 1, text: "收到", at: "2026-05-21T10:03:00.000Z" }
    ]
  });

  const context = buildStudentCourseContext(session, "s1", 4, { maxMessages: 20, maxChars: 2000 });
  assert.ok(context.includes("[歷史摘要-結論]") || context.includes("[近期原文]"));
  assert.equal(context.includes("收到"), false);
});

// single source-guard for this topic file

test("source-guard: diagnostics route still exposes fallbackMetricsSource field", async () => {
  const { readFileSync } = await import("node:fs");
  const { resolve, dirname } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const thisDir = dirname(fileURLToPath(import.meta.url));
  const src = readFileSync(resolve(thisDir, "../app/api/admin/diagnostics/route.ts"), "utf8");
  assert.ok(src.includes("fallbackMetricsSource"));
  assert.ok(src.includes("buildRecentFallbackTraces"), "diagnostics should construct recent fallback traces");
  assert.ok(src.includes("sampleErrorSource"), "fallback sample should expose category source");
  assert.ok(src.includes("recentFallbackTraces"), "diagnostics response should expose reconstructed trace list");
});
