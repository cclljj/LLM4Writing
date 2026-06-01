import type { PersistedEventRow } from "@/src/lib/store";
import { getTaipeiDateKey } from "@/src/lib/time-format";
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
  runId: string;
  sessionIds: string[];
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

type RunBucket = {
  runId: string;
  sessionIds: Set<string>;
  date: string;
  groupName: string;
  startedAt: string;
  endedAt: string | null;
  participantUsernames: Set<string>;
  latestStep: number;
  acceptedAnswers: number;
  totalAi: number;
  fallbackCount: number;
  rejectionCount: number;
  stepDurationsByStep: Record<number, number[]>;
  fallbackByStep: Record<number, number>;
  rejectedByStep: Record<number, number>;
};

type StepDurationSample = {
  step: number;
  date: string;
  startedAt: string;
  durationMs: number;
};

function toMs(iso?: string | null): number {
  const ms = new Date(iso ?? "").getTime();
  return Number.isFinite(ms) ? ms : 0;
}

function dayKey(iso: string): string {
  return getTaipeiDateKey(iso);
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

function computeStepDurationSamples(session: SessionState): StepDurationSample[] {
  const byDate = new Map<string, Map<number, { firstMs: number; firstIso: string; lastMs: number }>>();
  for (const message of session.messages) {
    if (!Number.isFinite(message.step) || message.step < 1) continue;
    const ms = toMs(message.at);
    if (ms <= 0) continue;
    const date = dayKey(message.at);
    if (!date) continue;
    const stepMap = byDate.get(date) ?? new Map<number, { firstMs: number; firstIso: string; lastMs: number }>();
    const current = stepMap.get(message.step);
    stepMap.set(message.step, {
      firstMs: current ? Math.min(current.firstMs, ms) : ms,
      firstIso: current && current.firstMs <= ms ? current.firstIso : message.at,
      lastMs: current ? Math.max(current.lastMs, ms) : ms
    });
    byDate.set(date, stepMap);
  }

  return Array.from(byDate.entries()).flatMap(([date, stepMap]) => {
    const steps = Array.from(stepMap.keys()).sort((a, b) => a - b);
    return steps.flatMap((step, index) => {
      const current = stepMap.get(step);
      const nextStep = steps[index + 1];
      const nextStart = nextStep ? stepMap.get(nextStep)?.firstMs ?? 0 : 0;
      const start = current?.firstMs ?? 0;
      const end = nextStart > start ? nextStart : current?.lastMs ?? 0;
      const duration = end > start ? end - start : 0;
      return duration > 0 && current ? [{ step, date, startedAt: current.firstIso, durationMs: duration }] : [];
    });
  });
}

function topSteps(record: Record<number, number>, limit = 3): number[] {
  return Object.entries(record)
    .map(([step, count]) => ({ step: Number(step), count }))
    .filter((item) => Number.isFinite(item.step) && item.count > 0)
    .sort((a, b) => b.count - a.count || a.step - b.step)
    .slice(0, limit)
    .map((item) => item.step);
}

function getSessionGroupKey(session: SessionState): string {
  return session.groupId?.trim() || session.groupName?.trim() || session.participants.slice().sort().join(",");
}

function getSessionGroupName(session: SessionState): string {
  return session.groupName?.trim() || session.groupId?.trim() || "—";
}

function ensureRun(runs: Map<string, RunBucket>, session: SessionState, date: string, occurredAt: string): RunBucket {
  const safeDate = date || dayKey(occurredAt) || dayKey(getSessionStartedAt(session));
  const groupKey = getSessionGroupKey(session);
  const runKey = `${safeDate}::${groupKey}`;
  const existing = runs.get(runKey);
  const run = existing ?? {
    runId: runKey,
    sessionIds: new Set<string>(),
    date: safeDate,
    groupName: getSessionGroupName(session),
    startedAt: occurredAt || getSessionStartedAt(session),
    endedAt: null,
    participantUsernames: new Set<string>(),
    latestStep: 0,
    acceptedAnswers: 0,
    totalAi: 0,
    fallbackCount: 0,
    rejectionCount: 0,
    stepDurationsByStep: {},
    fallbackByStep: {},
    rejectedByStep: {}
  };

  run.sessionIds.add(session.id);
  session.participants.forEach((participant) => run.participantUsernames.add(participant));
  if (occurredAt && (!run.startedAt || occurredAt.localeCompare(run.startedAt) < 0)) run.startedAt = occurredAt;
  if (occurredAt && (!run.endedAt || occurredAt.localeCompare(run.endedAt) > 0)) run.endedAt = occurredAt;
  runs.set(runKey, run);
  return run;
}

function addRunStep(run: RunBucket, step: number): void {
  if (Number.isFinite(step) && step > 0) {
    run.latestStep = Math.max(run.latestStep, Math.round(step));
  }
}

function buildDiagnosticsRunBuckets(
  sessions: SessionState[],
  events: PersistedEventRow[],
  hasEventMetrics: boolean
): RunBucket[] {
  const runs = new Map<string, RunBucket>();
  const sessionsById = new Map(sessions.map((session) => [session.id, session]));

  for (const session of sessions) {
    for (const message of session.messages) {
      const date = dayKey(message.at);
      if (!date) continue;
      const run = ensureRun(runs, session, date, message.at);
      addRunStep(run, message.step);
      if (message.role === "student") {
        run.acceptedAnswers += 1;
      } else if (!hasEventMetrics && message.role === "ai") {
        run.totalAi += 1;
        if (isFallbackText(message.text ?? "")) {
          run.fallbackCount += 1;
          if (message.step > 0) run.fallbackByStep[message.step] = (run.fallbackByStep[message.step] ?? 0) + 1;
        }
      }
    }

    if (!hasEventMetrics) {
      const rejectedCounts = session.qualitySignals?.rejectedAnswerCounts ?? {};
      const rejectedLastAt = session.qualitySignals?.rejectedAnswerLastAt ?? {};
      for (const [key, count] of Object.entries(rejectedCounts)) {
        const rejected = Number.isFinite(count) ? count : 0;
        const occurredAt = rejectedLastAt[key] ?? getSessionEndedAt(session) ?? getSessionStartedAt(session);
        const date = dayKey(occurredAt);
        if (rejected <= 0 || !date) continue;
        const run = ensureRun(runs, session, date, occurredAt);
        run.rejectionCount += rejected;
        const scope = key.split("::").slice(1).join("::");
        const step = parseStepFromScope(scope);
        if (step) {
          addRunStep(run, step);
          run.rejectedByStep[step] = (run.rejectedByStep[step] ?? 0) + rejected;
        }
      }
    }

    computeStepDurationSamples(session).forEach((duration) => {
      const run = ensureRun(runs, session, duration.date, duration.startedAt);
      addRunStep(run, duration.step);
      (run.stepDurationsByStep[duration.step] ??= []).push(duration.durationMs);
    });
  }

  if (hasEventMetrics) {
    for (const event of events) {
      const sessionId = event.session_id ?? "";
      const session = sessionsById.get(sessionId);
      if (!session) continue;
      const occurredAt = event.created_at.toISOString();
      const date = dayKey(occurredAt);
      if (!date) continue;
      const run = ensureRun(runs, session, date, occurredAt);
      const step = parseStepFromEvent(event) ?? 0;
      addRunStep(run, step);
      if (event.kind === "student_rejection") {
        run.rejectionCount += 1;
        if (step > 0) run.rejectedByStep[step] = (run.rejectedByStep[step] ?? 0) + 1;
        continue;
      }
      if (!LLM_RESPONSE_EVENT_KINDS.has(event.kind)) continue;
      run.totalAi += 1;
      if (event.fallback_used) {
        run.fallbackCount += 1;
        if (step > 0) run.fallbackByStep[step] = (run.fallbackByStep[step] ?? 0) + 1;
      }
    }
  }

  return Array.from(runs.values());
}

function serializeDiagnosticsRuns(runs: RunBucket[]): CourseDiagnosticsSession[] {
  return runs
    .map((run) => {
      const stepDurations = Object.entries(run.stepDurationsByStep)
        .map(([step, durations]) => ({
          step: Number(step),
          averageMs: average(durations),
          sampleCount: durations.length
        }))
        .sort((a, b) => a.step - b.step);
      const riskiestSteps = Array.from(new Set([...topSteps(run.fallbackByStep, 2), ...topSteps(run.rejectedByStep, 2)])).slice(0, 3);
      return {
        runId: run.runId,
        sessionIds: Array.from(run.sessionIds).sort(),
        date: run.date,
        startedAt: run.startedAt,
        endedAt: run.endedAt,
        groupName: run.groupName,
        participantCount: run.participantUsernames.size,
        latestStep: run.latestStep,
        acceptedAnswers: run.acceptedAnswers,
        totalAi: run.totalAi,
        fallbackCount: run.fallbackCount,
        fallbackRate: run.totalAi > 0 ? run.fallbackCount / run.totalAi : 0,
        rejectionCount: run.rejectionCount,
        rejectionRate:
          run.acceptedAnswers + run.rejectionCount > 0
            ? run.rejectionCount / (run.acceptedAnswers + run.rejectionCount)
            : 0,
        averageStepDurationMs: average(stepDurations.map((duration) => duration.averageMs)),
        stepDurations,
        riskiestSteps
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date) || a.groupName.localeCompare(b.groupName, "zh-Hant"));
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
  const runBuckets = buildDiagnosticsRunBuckets(sessions, events, hasEventMetrics);
  const diagnosticsSessions = serializeDiagnosticsRuns(runBuckets);
  const allStepDurations: Record<number, number[]> = {};
  const fallbackByStep: Record<number, number> = {};
  const rejectionByStep: Record<number, number> = {};

  runBuckets.forEach((run) => {
    Object.entries(run.stepDurationsByStep).forEach(([step, durations]) => {
      const key = Number(step);
      (allStepDurations[key] ??= []).push(...durations);
    });
    Object.entries(run.fallbackByStep).forEach(([step, count]) => {
      const key = Number(step);
      fallbackByStep[key] = (fallbackByStep[key] ?? 0) + count;
    });
    Object.entries(run.rejectedByStep).forEach(([step, count]) => {
      const key = Number(step);
      rejectionByStep[key] = (rejectionByStep[key] ?? 0) + count;
    });
  });

  const totalFallbacks = diagnosticsSessions.reduce((sum, item) => sum + item.fallbackCount, 0);
  const totalRejections = diagnosticsSessions.reduce((sum, item) => sum + item.rejectionCount, 0);
  const totalAi = diagnosticsSessions.reduce((sum, item) => sum + item.totalAi, 0);
  const acceptedAnswers = diagnosticsSessions.reduce((sum, item) => sum + item.acceptedAnswers, 0);

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
