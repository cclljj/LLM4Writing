import { NextResponse } from "next/server";
import { getCurrentUser } from "@/src/lib/auth-server";
import systemPromptConfig from "@/src/config/system-prompt-config.json";
import { listSessions } from "@/src/lib/store";
import { findActivity } from "@/src/lib/activity-store";
import { getLlmCallStats } from "@/src/lib/llm-observability";
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

function estimateTokensFromText(text: string): number {
  if (!text.trim()) return 0;
  const cjkChars = (text.match(/[\u3400-\u9fff]/g) ?? []).length;
  const latinWords = (text.match(/[A-Za-z0-9_]+/g) ?? []).length;
  const symbols = Math.max(0, text.length - cjkChars);
  // Coarse heuristic for mixed Traditional Chinese + English content.
  return Math.max(1, Math.round(cjkChars * 1.2 + latinWords * 0.8 + symbols * 0.15));
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

function computeTokenUsageStats(sessions: SessionState[], cutoffMs: number): {
  overall: { aiMessages: number; estimatedCompletionTokens: number; avgPerMessage: number };
  byStep: Record<string, { aiMessages: number; estimatedCompletionTokens: number; avgPerMessage: number }>;
  bySessionId: Record<string, { aiMessages: number; estimatedCompletionTokens: number }>;
} {
  const byStep: Record<string, { aiMessages: number; estimatedCompletionTokens: number }> = {};
  const bySessionId: Record<string, { aiMessages: number; estimatedCompletionTokens: number }> = {};
  let aiMessages = 0;
  let estimatedCompletionTokens = 0;

  for (const session of sessions) {
    for (const m of session.messages) {
      if (m.role !== "ai") continue;
      const atMs = new Date(m.at).getTime();
      if (!Number.isFinite(atMs) || atMs < cutoffMs) continue;
      const est = estimateTokensFromText(m.text ?? "");
      aiMessages += 1;
      estimatedCompletionTokens += est;

      const stepKey = String(m.step);
      const stepBucket = byStep[stepKey] ?? (byStep[stepKey] = { aiMessages: 0, estimatedCompletionTokens: 0 });
      stepBucket.aiMessages += 1;
      stepBucket.estimatedCompletionTokens += est;

      const sessionBucket = bySessionId[session.id] ?? (bySessionId[session.id] = { aiMessages: 0, estimatedCompletionTokens: 0 });
      sessionBucket.aiMessages += 1;
      sessionBucket.estimatedCompletionTokens += est;
    }
  }

  const byStepWithAvg: Record<string, { aiMessages: number; estimatedCompletionTokens: number; avgPerMessage: number }> = {};
  for (const [step, bucket] of Object.entries(byStep)) {
    byStepWithAvg[step] = {
      aiMessages: bucket.aiMessages,
      estimatedCompletionTokens: bucket.estimatedCompletionTokens,
      avgPerMessage: bucket.aiMessages > 0 ? Math.round(bucket.estimatedCompletionTokens / bucket.aiMessages) : 0
    };
  }

  return {
    overall: {
      aiMessages,
      estimatedCompletionTokens,
      avgPerMessage: aiMessages > 0 ? Math.round(estimatedCompletionTokens / aiMessages) : 0
    },
    byStep: byStepWithAvg,
    bySessionId
  };
}

function hasRecentActivity(session: SessionState, cutoffMs: number): boolean {
  const lastAt = session.messages.at(-1)?.at ?? session.createdAt;
  const ts = new Date(lastAt).getTime();
  return Number.isFinite(ts) && ts >= cutoffMs;
}

type RecentActivityStatus = "active" | "idle" | "stuck";

function computeRecentActivityStatus(lastEventAt: string, nowMs: number): RecentActivityStatus {
  const ts = new Date(lastEventAt).getTime();
  if (!Number.isFinite(ts)) return "idle";
  const diffMin = (nowMs - ts) / (60 * 1000);
  if (diffMin <= 5) return "active";
  if (diffMin <= 20) return "idle";
  return "stuck";
}

function computeCurrentStepDwellMinutes(session: SessionState, nowMs: number): number {
  const targetStep = session.currentStep;
  const firstMsgInStep = session.messages.find((m) => m.step === targetStep);
  const startAt = firstMsgInStep?.at ?? session.createdAt;
  const startMs = new Date(startAt).getTime();
  if (!Number.isFinite(startMs) || startMs > nowMs) return 0;
  return Math.max(0, Math.floor((nowMs - startMs) / (60 * 1000)));
}

function buildGroupStepDistribution(session: SessionState): string {
  const counter: Record<number, number> = {};
  const steps = session.personalSteps && Object.keys(session.personalSteps).length > 0
    ? Object.values(session.personalSteps)
    : session.participants.map(() => session.currentStep);
  for (const step of steps) {
    const normalized = Number.isFinite(step) ? step : session.currentStep;
    counter[normalized] = (counter[normalized] ?? 0) + 1;
  }
  return Object.entries(counter)
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([step, count]) => `Step ${step}: ${count}人`)
    .join(" / ");
}

function computeRejectedAnswerCount(session: SessionState): number {
  const counts = session.qualitySignals?.rejectedAnswerCounts;
  if (!counts || typeof counts !== "object") return 0;
  return Object.values(counts).reduce((sum, value) => sum + (Number.isFinite(value) ? value : 0), 0);
}

function dayKeyFromIso(iso: string): string {
  const ms = new Date(iso).getTime();
  if (!Number.isFinite(ms)) return "";
  return new Date(ms).toISOString().slice(0, 10);
}

function parseRejectedKey(key: string): { scope: string; countKey: string } | null {
  const [userId, ...rest] = key.split("::");
  if (!userId || rest.length === 0) return null;
  return { scope: rest.join("::"), countKey: key };
}

function parseStepFromScope(scope: string): string | null {
  const normalized = scope.trim();
  if (!normalized) return null;
  if (normalized.startsWith("step-")) {
    const step = normalized.slice(5).split(/[^0-9]/)[0] ?? "";
    return step || null;
  }
  const first = normalized.split("-")[0] ?? "";
  return /^\d+$/.test(first) ? first : null;
}

function computeRejectedByStep(sessions: SessionState[], cutoffMs: number): Record<string, number> {
  const byStep: Record<string, number> = {};
  for (const session of sessions) {
    const counts = session.qualitySignals?.rejectedAnswerCounts ?? {};
    const lastAt = session.qualitySignals?.rejectedAnswerLastAt ?? {};
    for (const [key, count] of Object.entries(counts)) {
      const parsed = parseRejectedKey(key);
      if (!parsed) continue;
      const stepKey = parseStepFromScope(parsed.scope);
      if (!stepKey) continue;
      const ts = new Date(lastAt[parsed.countKey] ?? "").getTime();
      if (!Number.isFinite(ts) || ts < cutoffMs) continue;
      byStep[stepKey] = (byStep[stepKey] ?? 0) + (Number.isFinite(count) ? count : 0);
    }
  }
  return byStep;
}

function computeAcceptedByStep(sessions: SessionState[], cutoffMs: number): Record<string, number> {
  const byStep: Record<string, number> = {};
  for (const session of sessions) {
    for (const m of session.messages) {
      if (m.role !== "student") continue;
      const atMs = new Date(m.at).getTime();
      if (!Number.isFinite(atMs) || atMs < cutoffMs) continue;
      const key = String(m.step);
      byStep[key] = (byStep[key] ?? 0) + 1;
    }
  }
  return byStep;
}

function computeStepKpis(
  sessions: SessionState[],
  cutoffMs: number,
  fallbackRate: ReturnType<typeof computeFallbackRate>,
  llmResponseTime: ReturnType<typeof computeLlmResponseTime>
): Record<
  string,
  {
    successRate: number;
    fallbackRate: number;
    refusalRate: number;
    avgWaitMs: number;
    totalAi: number;
    successes: number;
    fallbacks: number;
    acceptedAnswers: number;
    rejectedAnswers: number;
    waitSamples: number;
  }
> {
  const rejectedByStep = computeRejectedByStep(sessions, cutoffMs);
  const acceptedByStep = computeAcceptedByStep(sessions, cutoffMs);
  const stepKeys = new Set<string>([
    ...Object.keys(fallbackRate.byStep),
    ...Object.keys(rejectedByStep),
    ...Object.keys(acceptedByStep),
    ...Object.keys(llmResponseTime)
  ]);

  const result: Record<
    string,
    {
      successRate: number;
      fallbackRate: number;
      refusalRate: number;
      avgWaitMs: number;
      totalAi: number;
      successes: number;
      fallbacks: number;
      acceptedAnswers: number;
      rejectedAnswers: number;
      waitSamples: number;
    }
  > = {};

  for (const stepKey of stepKeys) {
    const fallbackBucket = fallbackRate.byStep[stepKey] ?? { totalAi: 0, fallbacks: 0, rate: 0 };
    const totalAi = fallbackBucket.totalAi;
    const fallbacks = fallbackBucket.fallbacks;
    const successes = Math.max(0, totalAi - fallbacks);
    const accepted = acceptedByStep[stepKey] ?? 0;
    const rejected = rejectedByStep[stepKey] ?? 0;
    const waitBucket = llmResponseTime[stepKey];
    result[stepKey] = {
      successRate: totalAi > 0 ? successes / totalAi : 0,
      fallbackRate: totalAi > 0 ? fallbacks / totalAi : 0,
      refusalRate: accepted + rejected > 0 ? rejected / (accepted + rejected) : 0,
      avgWaitMs: waitBucket?.avg ?? 0,
      totalAi,
      successes,
      fallbacks,
      acceptedAnswers: accepted,
      rejectedAnswers: rejected,
      waitSamples: waitBucket?.samples ?? 0
    };
  }

  return result;
}

type TrendDimension = "course" | "class";

type TrendPoint = {
  date: string;
  totalAi: number;
  successes: number;
  fallbacks: number;
  acceptedAnswers: number;
  rejectedAnswers: number;
  waitSamples: number;
  avgWaitMs: number;
  successRate: number;
  fallbackRate: number;
  refusalRate: number;
};

type TrendSeries = {
  key: string;
  school: string;
  classNumber: string;
  activityTitle: string;
  points: TrendPoint[];
};

type TrendMutableBucket = {
  totalAi: number;
  successes: number;
  fallbacks: number;
  acceptedAnswers: number;
  rejectedAnswers: number;
  waitTotalMs: number;
  waitSamples: number;
};

type TrendMeta = {
  key: string;
  school: string;
  classNumber: string;
  activityTitle: string;
};

function buildTrendMeta(
  session: SessionState,
  activity: { school?: string; classNumber?: string; title?: string } | undefined,
  dimension: TrendDimension
): TrendMeta {
  const school = activity?.school ?? "—";
  const classNumber = activity?.classNumber ?? "—";
  const activityTitle = session.activityTitle ?? activity?.title ?? session.activityId ?? "未命名課程";
  if (dimension === "class") {
    return {
      key: `${school}::${classNumber}`,
      school,
      classNumber,
      activityTitle: "全部課程"
    };
  }
  return {
    key: `${school}::${classNumber}::${activityTitle}`,
    school,
    classNumber,
    activityTitle
  };
}

function computeTrendSeries(
  sessions: SessionState[],
  cutoffMs: number,
  dimension: TrendDimension
): TrendSeries[] {
  const byGroupDay = new Map<string, TrendMutableBucket>();
  const metaMap = new Map<string, TrendMeta>();
  const waitTracker = new Map<string, string | null>();

  for (const session of sessions) {
    const activity = session.activityId ? findActivity(session.activityId) : undefined;
    const meta = buildTrendMeta(session, activity, dimension);
    metaMap.set(meta.key, meta);

    for (const message of session.messages) {
      const atMs = new Date(message.at).getTime();
      if (!Number.isFinite(atMs) || atMs < cutoffMs) continue;
      const day = dayKeyFromIso(message.at);
      if (!day) continue;
      const dayKey = `${meta.key}::${day}`;
      const bucket = byGroupDay.get(dayKey) ?? {
        totalAi: 0,
        successes: 0,
        fallbacks: 0,
        acceptedAnswers: 0,
        rejectedAnswers: 0,
        waitTotalMs: 0,
        waitSamples: 0
      };

      if (message.role === "student") {
        bucket.acceptedAnswers += 1;
        waitTracker.set(`${session.id}::${meta.key}::${message.step}`, message.at);
      } else if (message.role === "ai") {
        bucket.totalAi += 1;
        if (isFallbackText(message.text ?? "")) bucket.fallbacks += 1;
        else bucket.successes += 1;

        const waitKey = `${session.id}::${meta.key}::${message.step}`;
        const lastStudentAt = waitTracker.get(waitKey);
        if (lastStudentAt) {
          const diff = new Date(message.at).getTime() - new Date(lastStudentAt).getTime();
          if (Number.isFinite(diff) && diff > 0 && diff < 5 * 60 * 1000) {
            bucket.waitTotalMs += diff;
            bucket.waitSamples += 1;
          }
          waitTracker.set(waitKey, null);
        }
      }

      byGroupDay.set(dayKey, bucket);
    }

    const counts = session.qualitySignals?.rejectedAnswerCounts ?? {};
    const lastAt = session.qualitySignals?.rejectedAnswerLastAt ?? {};
    for (const [key, count] of Object.entries(counts)) {
      const rejectedAt = lastAt[key];
      const ts = new Date(rejectedAt ?? "").getTime();
      if (!Number.isFinite(ts) || ts < cutoffMs) continue;
      const day = dayKeyFromIso(rejectedAt ?? "");
      if (!day) continue;
      const dayKey = `${meta.key}::${day}`;
      const bucket = byGroupDay.get(dayKey) ?? {
        totalAi: 0,
        successes: 0,
        fallbacks: 0,
        acceptedAnswers: 0,
        rejectedAnswers: 0,
        waitTotalMs: 0,
        waitSamples: 0
      };
      bucket.rejectedAnswers += Number.isFinite(count) ? count : 0;
      byGroupDay.set(dayKey, bucket);
    }
  }

  const pointsByGroup = new Map<string, TrendPoint[]>();
  for (const [groupDayKey, bucket] of byGroupDay.entries()) {
    const splitAt = groupDayKey.lastIndexOf("::");
    if (splitAt < 0) continue;
    const groupKey = groupDayKey.slice(0, splitAt);
    const day = groupDayKey.slice(splitAt + 2);
    const points = pointsByGroup.get(groupKey) ?? [];
    points.push({
      date: day,
      totalAi: bucket.totalAi,
      successes: bucket.successes,
      fallbacks: bucket.fallbacks,
      acceptedAnswers: bucket.acceptedAnswers,
      rejectedAnswers: bucket.rejectedAnswers,
      waitSamples: bucket.waitSamples,
      avgWaitMs: bucket.waitSamples > 0 ? Math.round(bucket.waitTotalMs / bucket.waitSamples) : 0,
      successRate: bucket.totalAi > 0 ? bucket.successes / bucket.totalAi : 0,
      fallbackRate: bucket.totalAi > 0 ? bucket.fallbacks / bucket.totalAi : 0,
      refusalRate:
        bucket.acceptedAnswers + bucket.rejectedAnswers > 0
          ? bucket.rejectedAnswers / (bucket.acceptedAnswers + bucket.rejectedAnswers)
          : 0
    });
    pointsByGroup.set(groupKey, points);
  }

  return Array.from(pointsByGroup.entries())
    .map(([groupKey, points]) => {
      const meta = metaMap.get(groupKey);
      return {
        key: groupKey,
        school: meta?.school ?? "—",
        classNumber: meta?.classNumber ?? "—",
        activityTitle: meta?.activityTitle ?? "未命名課程",
        points: points.sort((a, b) => a.date.localeCompare(b.date))
      };
    })
    .sort((a, b) => a.key.localeCompare(b.key));
}

function buildLlmErrorTaxonomy() {
  const stats = getLlmCallStats();
  let timeout = 0;
  let truncation = 0;
  let parseFail = 0;
  let other = 0;
  let totalCalls = 0;
  for (const s of stats) {
    totalCalls += s.total;
    timeout += s.errorCategories.timeout;
    parseFail += s.errorCategories.parse_fail;
    other += s.errorCategories.other;
    truncation += s.truncations + s.errorCategories.truncation;
  }
  const totalClassified = timeout + truncation + parseFail + other;
  return {
    totalCalls,
    totalClassified,
    timeout: { count: timeout, rate: totalClassified > 0 ? timeout / totalClassified : 0 },
    truncation: { count: truncation, rate: totalClassified > 0 ? truncation / totalClassified : 0 },
    parseFail: { count: parseFail, rate: totalClassified > 0 ? parseFail / totalClassified : 0 },
    other: { count: other, rate: totalClassified > 0 ? other / totalClassified : 0 },
    byKind: stats
  };
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
    .map((session) => {
      const activity = session.activityId ? findActivity(session.activityId) : undefined;
      const lastMessageAt = session.messages.at(-1)?.at ?? session.createdAt;
      return {
        sessionId: session.id,
        activityTitle: session.activityTitle ?? session.activityId ?? "未命名課程",
        school: activity?.school ?? "—",
        classNumber: activity?.classNumber ?? "—",
        groupName: session.groupName ?? session.groupId ?? "未命名組",
        currentStep: session.currentStep,
        participantCount: session.participants.length,
        messageCount: session.messages.length,
        lastMessageAt,
        activityStatus: computeRecentActivityStatus(lastMessageAt, nowMs),
        currentStepDwellMinutes: computeCurrentStepDwellMinutes(session, nowMs),
        groupStepDistribution: buildGroupStepDistribution(session),
        rejectedAnswerCount: computeRejectedAnswerCount(session)
      };
    });

  const llm = {
    configured: readEnvFlag("LLM_URL") && (readEnvFlag("LLM_KEY") || readEnvFlag("LLM_key")) && readEnvFlag("LLM_MODEL"),
    urlPresent: readEnvFlag("LLM_URL"),
    keyPresent: readEnvFlag("LLM_KEY") || readEnvFlag("LLM_key"),
    modelPresent: readEnvFlag("LLM_MODEL"),
    model: readEnvFlag("LLM_MODEL") ? process.env.LLM_MODEL : null
  };
  const tokenUsage = computeTokenUsageStats(windowedSpecSessions, cutoffMs);
  const llmResponseTime = computeLlmResponseTime(windowedSpecSessions, cutoffMs);
  const fallbackRate = computeFallbackRate(windowedSpecSessions, cutoffMs);
  const stepKpis = computeStepKpis(windowedSpecSessions, cutoffMs, fallbackRate, llmResponseTime);
  const trends = {
    byCourse: computeTrendSeries(windowedSpecSessions, cutoffMs, "course"),
    byClass: computeTrendSeries(windowedSpecSessions, cutoffMs, "class")
  };
  const llmErrorTaxonomy = buildLlmErrorTaxonomy();

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
      recent: recentSessions.map((session) => ({
        ...session,
        estimatedCompletionTokens: tokenUsage.bySessionId[session.sessionId]?.estimatedCompletionTokens ?? 0
      }))
    },
    timeWindow: selectedWindow,
    llmResponseTime,
    fallbackRate,
    stepKpis,
    trends,
    llmErrorTaxonomy,
    artifactHealth: computeArtifactHealth(windowedSpecSessions),
    tokenUsage,
    generatedAt: new Date().toISOString()
  });
}
