import type { PersistedEventRow } from "@/src/lib/store";
import type { SessionState } from "@/src/lib/types";

const FALLBACK_MARKERS = [
  "AI（生成論點）回覆：已收到你的提問",
  "回覆：已收到本輪回覆。請依目前步驟目標繼續討論",
  "AI 建議：已收到你的草稿",
  "AI 分析回饋：已收到你的文章",
  "總評：結構已改善，建議再精煉結語",
  "已收到你的訊息「"
];

const LLM_RESPONSE_EVENT_KINDS = new Set(["step12_round", "step3_response", "step6_suggest", "step7_feedback", "step10_report"]);

export type CourseStepDuration = {
  step: number;
  averageMs: number;
  sampleCount: number;
};

export type CourseDiagnosticsSession = {
  sessionId: string;
  date: string;
  startedAt: string;
  endedAt: string | null;
  groupName: string;
  participantCount: number;
  latestStep: number;
  acceptedAnswers: number;
  totalAi: number;
  fallbackCount: number;
  fallbackRate: number;
  rejectionCount: number;
  rejectionRate: number;
  averageStepDurationMs: number;
  stepDurations: CourseStepDuration[];
  riskiestSteps: number[];
};

export type CourseDiagnosticsPayload = {
  activityId: string;
  source: "persisted_learning_events" | "estimated_from_session_messages";
  estimationNotes: string[];
  summary: {
    totalSessions: number;
    totalFallbacks: number;
    totalRejections: number;
    totalAi: number;
    acceptedAnswers: number;
    fallbackRate: number;
    rejectionRate: number;
    slowestStep: number | null;
    highestFallbackStep: number | null;
    highestRejectionStep: number | null;
    averageStepDurations: CourseStepDuration[];
  };
  sessions: CourseDiagnosticsSession[];
};

type SessionMetricBucket = {
  totalAi: number;
  fallbacks: number;
  acceptedAnswers: number;
  rejectedAnswers: number;
  fallbackByStep: Record<number, number>;
  rejectedByStep: Record<number, number>;
};

function toMs(iso?: string | null): number {
  const ms = new Date(iso ?? "").getTime();
  return Number.isFinite(ms) ? ms : 0;
}

function dayKey(iso: string): string {
  const ms = toMs(iso);
  return ms > 0 ? new Date(ms).toISOString().slice(0, 10) : "";
}

function isFallbackText(text: string): boolean {
  return FALLBACK_MARKERS.some((marker) => text.includes(marker));
}

function parseStepFromScope(scope: string): number | null {
  const normalized = scope.trim();
  if (!normalized) return null;
  if (normalized.startsWith("step-")) {
    const step = Number.parseInt(normalized.slice(5), 10);
    return Number.isFinite(step) ? step : null;
  }
  const first = normalized.split("-")[0] ?? "";
  const step = Number.parseInt(first, 10);
  return Number.isFinite(step) ? step : null;
}

function parseStepFromEvent(event: Pick<PersistedEventRow, "step" | "kind">): number | null {
  if (typeof event.step === "number" && Number.isFinite(event.step)) return Math.max(0, Math.round(event.step));
  const matched = event.kind.match(/(?:step[-_]?)(\d+)/i);
  return matched?.[1] ? Number.parseInt(matched[1], 10) : null;
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function getSessionStartedAt(session: SessionState): string {
  const firstMessageAt = session.messages
    .map((message) => message.at)
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b))[0];
  return firstMessageAt ?? session.createdAt;
}

function getSessionEndedAt(session: SessionState): string | null {
  const lastMessageAt = session.messages
    .map((message) => message.at)
    .filter(Boolean)
    .sort((a, b) => b.localeCompare(a))[0];
  return lastMessageAt ?? session.createdAt ?? null;
}

function computeStepDurations(session: SessionState): CourseStepDuration[] {
  const firstAtByStep = new Map<number, number>();
  const lastAtByStep = new Map<number, number>();
  for (const message of session.messages) {
    if (!Number.isFinite(message.step) || message.step < 1) continue;
    const ms = toMs(message.at);
    if (ms <= 0) continue;
    const currentFirst = firstAtByStep.get(message.step);
    if (!currentFirst || ms < currentFirst) firstAtByStep.set(message.step, ms);
    const currentLast = lastAtByStep.get(message.step);
    if (!currentLast || ms > currentLast) lastAtByStep.set(message.step, ms);
  }

  const steps = Array.from(firstAtByStep.keys()).sort((a, b) => a - b);
  return steps.flatMap((step, index) => {
    const start = firstAtByStep.get(step) ?? 0;
    const nextStep = steps[index + 1];
    const nextStart = nextStep ? firstAtByStep.get(nextStep) ?? 0 : 0;
    const end = nextStart > start ? nextStart : lastAtByStep.get(step) ?? 0;
    const duration = end > start ? end - start : 0;
    return duration > 0 ? [{ step, averageMs: duration, sampleCount: 1 }] : [];
  });
}

function buildMetricsFromEvents(sessions: SessionState[], events: PersistedEventRow[]): Map<string, SessionMetricBucket> {
  const sessionIds = new Set(sessions.map((session) => session.id));
  const buckets = new Map<string, SessionMetricBucket>();
  const getBucket = (sessionId: string) => {
    const existing = buckets.get(sessionId);
    if (existing) return existing;
    const created: SessionMetricBucket = {
      totalAi: 0,
      fallbacks: 0,
      acceptedAnswers: 0,
      rejectedAnswers: 0,
      fallbackByStep: {},
      rejectedByStep: {}
    };
    buckets.set(sessionId, created);
    return created;
  };

  for (const session of sessions) {
    const bucket = getBucket(session.id);
    bucket.acceptedAnswers = session.messages.filter((message) => message.role === "student").length;
  }

  for (const event of events) {
    const sessionId = event.session_id ?? "";
    if (!sessionIds.has(sessionId)) continue;
    const bucket = getBucket(sessionId);
    const step = parseStepFromEvent(event) ?? 0;
    if (event.kind === "student_rejection") {
      bucket.rejectedAnswers += 1;
      if (step > 0) bucket.rejectedByStep[step] = (bucket.rejectedByStep[step] ?? 0) + 1;
      continue;
    }
    if (!LLM_RESPONSE_EVENT_KINDS.has(event.kind)) continue;
    bucket.totalAi += 1;
    if (event.fallback_used) {
      bucket.fallbacks += 1;
      if (step > 0) bucket.fallbackByStep[step] = (bucket.fallbackByStep[step] ?? 0) + 1;
    }
  }
  return buckets;
}

function buildMetricsFromSessions(sessions: SessionState[]): Map<string, SessionMetricBucket> {
  const buckets = new Map<string, SessionMetricBucket>();
  for (const session of sessions) {
    const bucket: SessionMetricBucket = {
      totalAi: 0,
      fallbacks: 0,
      acceptedAnswers: 0,
      rejectedAnswers: 0,
      fallbackByStep: {},
      rejectedByStep: {}
    };
    for (const message of session.messages) {
      if (message.role === "student") {
        bucket.acceptedAnswers += 1;
      } else if (message.role === "ai") {
        bucket.totalAi += 1;
        if (isFallbackText(message.text ?? "")) {
          bucket.fallbacks += 1;
          bucket.fallbackByStep[message.step] = (bucket.fallbackByStep[message.step] ?? 0) + 1;
        }
      }
    }
    const rejectedCounts = session.qualitySignals?.rejectedAnswerCounts ?? {};
    const rejectedLastAt = session.qualitySignals?.rejectedAnswerLastAt ?? {};
    for (const [key, count] of Object.entries(rejectedCounts)) {
      const rejected = Number.isFinite(count) ? count : 0;
      bucket.rejectedAnswers += rejected;
      const scope = key.split("::").slice(1).join("::");
      const step = parseStepFromScope(scope);
      if (step) bucket.rejectedByStep[step] = (bucket.rejectedByStep[step] ?? 0) + rejected;
      void rejectedLastAt;
    }
    buckets.set(session.id, bucket);
  }
  return buckets;
}

function topSteps(record: Record<number, number>, limit = 3): number[] {
  return Object.entries(record)
    .map(([step, count]) => ({ step: Number(step), count }))
    .filter((item) => Number.isFinite(item.step) && item.count > 0)
    .sort((a, b) => b.count - a.count || a.step - b.step)
    .slice(0, limit)
    .map((item) => item.step);
}

export function buildCourseDiagnostics(
  activityId: string,
  sessionsInput: SessionState[],
  learningEventsInput: PersistedEventRow[] = []
): CourseDiagnosticsPayload {
  const sessions = sessionsInput
    .filter((session) => session.workflow === "spec10" && session.activityId === activityId)
    .sort((a, b) => getSessionStartedAt(b).localeCompare(getSessionStartedAt(a)));
  const events = learningEventsInput.filter((event) => event.activity_id === activityId);
  const hasEventMetrics = events.some((event) => event.kind === "student_rejection" || LLM_RESPONSE_EVENT_KINDS.has(event.kind));
  const metrics = hasEventMetrics ? buildMetricsFromEvents(sessions, events) : buildMetricsFromSessions(sessions);

  const allStepDurations: Record<number, number[]> = {};
  let totalFallbacks = 0;
  let totalRejections = 0;
  let totalAi = 0;
  let acceptedAnswers = 0;
  const fallbackByStep: Record<number, number> = {};
  const rejectionByStep: Record<number, number> = {};

  const diagnosticsSessions = sessions.map((session) => {
    const startedAt = getSessionStartedAt(session);
    const endedAt = getSessionEndedAt(session);
    const bucket = metrics.get(session.id) ?? {
      totalAi: 0,
      fallbacks: 0,
      acceptedAnswers: 0,
      rejectedAnswers: 0,
      fallbackByStep: {},
      rejectedByStep: {}
    };
    const stepDurations = computeStepDurations(session);
    stepDurations.forEach((duration) => {
      (allStepDurations[duration.step] ??= []).push(duration.averageMs);
    });
    totalFallbacks += bucket.fallbacks;
    totalRejections += bucket.rejectedAnswers;
    totalAi += bucket.totalAi;
    acceptedAnswers += bucket.acceptedAnswers;
    Object.entries(bucket.fallbackByStep).forEach(([step, count]) => {
      const key = Number(step);
      fallbackByStep[key] = (fallbackByStep[key] ?? 0) + count;
    });
    Object.entries(bucket.rejectedByStep).forEach(([step, count]) => {
      const key = Number(step);
      rejectionByStep[key] = (rejectionByStep[key] ?? 0) + count;
    });
    const riskiestSteps = Array.from(new Set([...topSteps(bucket.fallbackByStep, 2), ...topSteps(bucket.rejectedByStep, 2)])).slice(0, 3);
    return {
      sessionId: session.id,
      date: dayKey(startedAt),
      startedAt,
      endedAt,
      groupName: session.groupName ?? session.groupId ?? "—",
      participantCount: session.participants.length,
      latestStep: session.currentStep,
      acceptedAnswers: bucket.acceptedAnswers,
      totalAi: bucket.totalAi,
      fallbackCount: bucket.fallbacks,
      fallbackRate: bucket.totalAi > 0 ? bucket.fallbacks / bucket.totalAi : 0,
      rejectionCount: bucket.rejectedAnswers,
      rejectionRate:
        bucket.acceptedAnswers + bucket.rejectedAnswers > 0
          ? bucket.rejectedAnswers / (bucket.acceptedAnswers + bucket.rejectedAnswers)
          : 0,
      averageStepDurationMs: average(stepDurations.map((duration) => duration.averageMs)),
      stepDurations,
      riskiestSteps
    };
  });

  const averageStepDurations = Object.entries(allStepDurations)
    .map(([step, durations]) => ({
      step: Number(step),
      averageMs: average(durations),
      sampleCount: durations.length
    }))
    .sort((a, b) => a.step - b.step);

  return {
    activityId,
    source: hasEventMetrics ? "persisted_learning_events" : "estimated_from_session_messages",
    estimationNotes: [
      hasEventMetrics
        ? "Fallback 與拒答優先使用 learning_events；若舊資料缺少事件，該部分可能低估。"
        : "Fallback 與拒答由 session 訊息與 qualitySignals 估算，舊資料可能低估實際次數。",
      "步驟停留時間以同一 session 內各 step 首次訊息到下一 step 首次訊息估算；Step 5 以後個人步調會被彙整成 session 平均。"
    ],
    summary: {
      totalSessions: diagnosticsSessions.length,
      totalFallbacks,
      totalRejections,
      totalAi,
      acceptedAnswers,
      fallbackRate: totalAi > 0 ? totalFallbacks / totalAi : 0,
      rejectionRate: acceptedAnswers + totalRejections > 0 ? totalRejections / (acceptedAnswers + totalRejections) : 0,
      slowestStep: averageStepDurations.slice().sort((a, b) => b.averageMs - a.averageMs)[0]?.step ?? null,
      highestFallbackStep: topSteps(fallbackByStep, 1)[0] ?? null,
      highestRejectionStep: topSteps(rejectionByStep, 1)[0] ?? null,
      averageStepDurations
    },
    sessions: diagnosticsSessions
  };
}
