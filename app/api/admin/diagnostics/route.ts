import { NextResponse } from "next/server";
import { getCurrentUser } from "@/src/lib/auth-server";
import systemPromptConfig from "@/src/config/system-prompt-config.json";
import { listSessions } from "@/src/lib/store";
import type { SessionState } from "@/src/lib/types";
type DiagnosticsWindow = "24h" | "7d" | "14d" | "30d";
const WINDOW_MS: Record<DiagnosticsWindow, number> = {
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "14d": 14 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000
};

function readEnvFlag(name: string): boolean {
  const value = process.env[name];
  return typeof value === "string" && value.trim().length > 0;
}

function countRecord(value: unknown): number {
  if (!value || typeof value !== "object" || Array.isArray(value)) return 0;
  return Object.keys(value).length;
}

function countWritingTaskQuestionBanks(value: unknown): number {
  if (!value || typeof value !== "object" || Array.isArray(value)) return 0;
  return Object.values(value as Record<string, unknown>).reduce<number>((sum, task) => {
    if (!task || typeof task !== "object" || Array.isArray(task)) return sum;
    const questionBanks = (task as Record<string, unknown>).questionBanks;
    return sum + countRecord(questionBanks);
  }, 0);
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

/**
 * Per-step LLM response time, estimated from `student → ai` consecutive message
 * pairs in the same step (#250 part B). Not perfectly accurate for group steps
 * (1/2/4) where AI replies to a gate, but works well as a proxy.
 */
function computeLlmResponseTime(
  sessions: SessionState[],
  cutoffMs: number
): Record<string, { median: number; avg: number; samples: number }> {
  const byStep: Record<string, number[]> = {};
  for (const session of sessions) {
    const messages = session.messages;
    let lastStudentByStep: Record<number, string | null> = {};
    for (const m of messages) {
      const atMs = new Date(m.at).getTime();
      if (!Number.isFinite(atMs) || atMs < cutoffMs) continue;
      if (m.role === "student" && m.step >= 1) {
        lastStudentByStep[m.step] = m.at;
      } else if (m.role === "ai" && m.step >= 1) {
        const prevStudentAt = lastStudentByStep[m.step];
        if (prevStudentAt) {
          const diff = new Date(m.at).getTime() - new Date(prevStudentAt).getTime();
          if (Number.isFinite(diff) && diff > 0 && diff < 5 * 60 * 1000) {
            // Cap at 5 minutes to filter outliers (idle gaps).
            const key = String(m.step);
            (byStep[key] ??= []).push(diff);
          }
          // Consume the student timestamp so each pair counts once.
          lastStudentByStep[m.step] = null;
        }
      }
    }
  }
  const result: Record<string, { median: number; avg: number; samples: number }> = {};
  for (const [step, durations] of Object.entries(byStep)) {
    const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
    result[step] = {
      median: Math.round(median(durations)),
      avg: Math.round(avg),
      samples: durations.length
    };
  }
  return result;
}

/**
 * Per-step fallback rate (#250 part C). Scans ai messages for known fallback
 * marker substrings and divides by total ai messages per step.
 */
const FALLBACK_MARKERS: Array<{ pattern: string; description: string }> = [
  { pattern: "AI（生成論點）回覆：已收到你的提問", description: "Step 3 fallback" },
  { pattern: "回覆：已收到本輪回覆。請依目前步驟目標繼續討論", description: "通用 step fallback" },
  { pattern: "AI 建議：已收到你的草稿", description: "Step 6 suggest fallback" },
  { pattern: "AI 分析回饋：已收到你的文章", description: "Step 7 fallback" },
  { pattern: "總評：結構已改善，建議再精煉結語", description: "Step 10 fallback" },
  { pattern: "已收到你的訊息「", description: "legacy phase fallback" }
];

function isFallbackText(text: string): boolean {
  for (const m of FALLBACK_MARKERS) {
    if (text.includes(m.pattern)) return true;
  }
  return false;
}

function computeFallbackRate(
  sessions: SessionState[],
  cutoffMs: number
): {
  byStep: Record<string, { totalAi: number; fallbacks: number; rate: number }>;
  overall: { totalAi: number; fallbacks: number; rate: number };
} {
  const byStep: Record<string, { totalAi: number; fallbacks: number }> = {};
  let totalAi = 0;
  let fallbacks = 0;
  for (const session of sessions) {
    for (const m of session.messages) {
      if (m.role !== "ai") continue;
      const atMs = new Date(m.at).getTime();
      if (!Number.isFinite(atMs) || atMs < cutoffMs) continue;
      totalAi += 1;
      const stepKey = String(m.step);
      const bucket = byStep[stepKey] ?? (byStep[stepKey] = { totalAi: 0, fallbacks: 0 });
      bucket.totalAi += 1;
      if (isFallbackText(m.text ?? "")) {
        fallbacks += 1;
        bucket.fallbacks += 1;
      }
    }
  }
  const byStepWithRate: Record<string, { totalAi: number; fallbacks: number; rate: number }> = {};
  for (const [step, b] of Object.entries(byStep)) {
    byStepWithRate[step] = {
      totalAi: b.totalAi,
      fallbacks: b.fallbacks,
      rate: b.totalAi > 0 ? b.fallbacks / b.totalAi : 0
    };
  }
  return {
    byStep: byStepWithRate,
    overall: {
      totalAi,
      fallbacks,
      rate: totalAi > 0 ? fallbacks / totalAi : 0
    }
  };
}

/**
 * Artifact health summary across all spec10 sessions / participants (#250 part D).
 * Reports completion rates and average sizes for outline / draft6 / draft8 / step10.
 */
const OUTLINE_SHORT_THRESHOLD = 20;
const DRAFT6_SHORT_THRESHOLD = 100;

function computeArtifactHealth(sessions: SessionState[]) {
  let totalStudents = 0;
  const outline = { has: 0, empty: 0, short: 0, totalChars: 0 };
  const draft6 = { has: 0, empty: 0, short: 0, totalChars: 0 };
  const draft8 = { has: 0, empty: 0, totalChars: 0 };
  const step10 = { has: 0, empty: 0 };

  for (const session of sessions) {
    for (const username of session.participants) {
      totalStudents += 1;
      const o = (session.outlines?.[username] ?? "").trim();
      const d6 = (session.draftStep6?.[username] ?? "").trim();
      const d8 = (session.draftStep8?.[username] ?? "").trim();
      const r10 = (session.reports?.step10?.[username] ?? "").trim();

      if (o) {
        outline.has += 1;
        outline.totalChars += o.length;
        if (o.length < OUTLINE_SHORT_THRESHOLD) outline.short += 1;
      } else {
        outline.empty += 1;
      }
      if (d6) {
        draft6.has += 1;
        draft6.totalChars += d6.length;
        if (d6.length < DRAFT6_SHORT_THRESHOLD) draft6.short += 1;
      } else {
        draft6.empty += 1;
      }
      if (d8) {
        draft8.has += 1;
        draft8.totalChars += d8.length;
      } else {
        draft8.empty += 1;
      }
      if (r10) step10.has += 1;
      else step10.empty += 1;
    }
  }

  const ratio = (n: number) => (totalStudents > 0 ? n / totalStudents : 0);
  const avg = (total: number, count: number) => (count > 0 ? Math.round(total / count) : 0);

  return {
    totalStudents,
    outline: {
      has: outline.has,
      empty: outline.empty,
      short: outline.short,
      avgChars: avg(outline.totalChars, outline.has),
      completionRate: ratio(outline.has),
      shortRate: ratio(outline.short)
    },
    draft6: {
      has: draft6.has,
      empty: draft6.empty,
      short: draft6.short,
      avgChars: avg(draft6.totalChars, draft6.has),
      completionRate: ratio(draft6.has),
      shortRate: ratio(draft6.short)
    },
    draft8: {
      has: draft8.has,
      empty: draft8.empty,
      avgChars: avg(draft8.totalChars, draft8.has),
      completionRate: ratio(draft8.has)
    },
    step10: {
      has: step10.has,
      empty: step10.empty,
      completionRate: ratio(step10.has)
    }
  };
}

function hasRecentActivity(session: SessionState, cutoffMs: number): boolean {
  const lastAt = session.messages.at(-1)?.at ?? session.createdAt;
  const ts = new Date(lastAt).getTime();
  return Number.isFinite(ts) && ts >= cutoffMs;
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const config = systemPromptConfig as Record<string, unknown>;
  const sessions = await listSessions();
  const requestUrl = new URL(request.url);
  const windowParam = requestUrl.searchParams.get("window");
  const selectedWindow: DiagnosticsWindow =
    windowParam === "24h" || windowParam === "7d" || windowParam === "14d" || windowParam === "30d"
      ? windowParam
      : "7d";
  const nowMs = Date.now();
  const cutoffMs = nowMs - WINDOW_MS[selectedWindow];
  const specSessions = sessions.filter((session) => session.workflow === "spec10");
  const windowedSpecSessions = specSessions.filter((session) => hasRecentActivity(session, cutoffMs));
  const recentSessions = windowedSpecSessions
    .slice()
    .sort((a, b) => {
      const aLast = a.messages.at(-1)?.at ?? a.createdAt;
      const bLast = b.messages.at(-1)?.at ?? b.createdAt;
      return bLast.localeCompare(aLast);
    })
    .slice(0, 5)
    .map((session) => ({
      sessionId: session.id,
      activityTitle: session.activityTitle ?? session.activityId ?? "未命名課程",
      groupName: session.groupName ?? session.groupId ?? "未命名組",
      currentStep: session.currentStep,
      participantCount: session.participants.length,
      messageCount: session.messages.length,
      lastMessageAt: session.messages.at(-1)?.at ?? session.createdAt
    }));

  const llm = {
    configured: readEnvFlag("LLM_URL") && (readEnvFlag("LLM_KEY") || readEnvFlag("LLM_key")) && readEnvFlag("LLM_MODEL"),
    urlPresent: readEnvFlag("LLM_URL"),
    keyPresent: readEnvFlag("LLM_KEY") || readEnvFlag("LLM_key"),
    modelPresent: readEnvFlag("LLM_MODEL"),
    model: readEnvFlag("LLM_MODEL") ? process.env.LLM_MODEL : null
  };

  return NextResponse.json({
    llm,
    promptConfig: {
      hasSystemPrompt: typeof config.systemPrompt === "string" && config.systemPrompt.trim().length > 0,
      stepPrompts: countRecord(config.stepPrompts),
      stepPromptsOld: countRecord(config.stepPrompts_old),
      subStepPrompts: countRecord(config.subStepPrompts),
      subStepPromptsFallbacks: countRecord(config.subStepPrompts_fallbacks),
      baseQuestionBanks: countRecord(config.questionBanks),
      writingTaskQuestionBanks: countWritingTaskQuestionBanks(config.writingTasks),
      writingTasks: countRecord(config.writingTasks),
      step9Questions: countRecord(config.step9Questions),
      stepOpenings: countRecord(config.stepOpenings)
    },
    sessions: {
      total: sessions.length,
      spec10: specSessions.length,
      spec10InWindow: windowedSpecSessions.length,
      recent: recentSessions
    },
    timeWindow: selectedWindow,
    llmResponseTime: computeLlmResponseTime(windowedSpecSessions, cutoffMs),
    fallbackRate: computeFallbackRate(windowedSpecSessions, cutoffMs),
    artifactHealth: computeArtifactHealth(windowedSpecSessions),
    generatedAt: new Date().toISOString()
  });
}
