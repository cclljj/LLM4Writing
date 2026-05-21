export const TEACHER_MONITOR_FAST_POLL_MS = 1000;
export const TEACHER_MONITOR_MIN_POLL_MS = 3000;
export const TEACHER_MONITOR_MAX_POLL_MS = 30000;

type MonitorPollingSession = {
  sessionId: string;
  currentStep: number;
  messages?: unknown[];
  messageCount?: number;
  lastMessageAt?: string | null;
  groupGate?: Record<string, string[]>;
  personalSteps?: Record<string, number>;
};

function stableStringArrayRecordSignature(record?: Record<string, string[]>): string {
  if (!record) return "";
  return Object.entries(record)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, values]) => `${key}=${[...values].sort().join(",")}`)
    .join(";");
}

function stableNumberRecordSignature(record?: Record<string, number>): string {
  if (!record) return "";
  return Object.entries(record)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join(";");
}

export function computeTeacherMonitorPayloadHash(sessions: MonitorPollingSession[]): string {
  return sessions
    .map((session) => {
      const messageCount = session.messageCount ?? session.messages?.length ?? 0;
      const groupGate = stableStringArrayRecordSignature(session.groupGate);
      const personalSteps = stableNumberRecordSignature(session.personalSteps);
      return `${session.sessionId}:${session.currentStep}:${messageCount}:${session.lastMessageAt ?? ""}:${groupGate}:${personalSteps}`;
    })
    .join("|");
}

export function hasLowLatencyStepAdvanceGate(sessions: MonitorPollingSession[]): boolean {
  return sessions.some((session) => session.currentStep === 3 || session.currentStep === 4);
}

export function resolveTeacherMonitorNextPollDelay(input: {
  currentDelayMs: number;
  unchanged: boolean;
  hasLowLatencyGate: boolean;
}): number {
  if (input.hasLowLatencyGate) return TEACHER_MONITOR_FAST_POLL_MS;
  if (!input.unchanged) return TEACHER_MONITOR_MIN_POLL_MS;
  return Math.min(TEACHER_MONITOR_MAX_POLL_MS, input.currentDelayMs * 2);
}
