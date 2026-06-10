import type { SessionState } from "@/src/lib/types";

export const STUDENT_SESSION_FAST_POLL_MS = 5000;
export const STUDENT_SESSION_MAX_POLL_MS = 30000;

type StudentPollingSession = Pick<SessionState, "id" | "currentStep"> &
  Partial<Pick<
    SessionState,
    | "personalSteps"
    | "groupGate"
    | "outlines"
    | "step3SubmittedOutlines"
    | "draftStep6"
    | "draftStep8"
    | "attendanceOverrides"
    | "makeupWork"
  >> & {
    messages?: Array<Pick<SessionState["messages"][number], "at">>;
    reports?: Partial<SessionState["reports"]>;
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

function hasReportText(record: Record<string, string> | undefined, username: string): string {
  return record?.[username]?.trim() ? "1" : "0";
}

function textLengthSignature(record: Record<string, string> | undefined, username: string): string {
  return String(record?.[username]?.length ?? 0);
}

export function computeStudentSessionPayloadHash(session: StudentPollingSession, username: string): string {
  const messages = session.messages ?? [];
  const lastMessageAt = messages.at(-1)?.at ?? "";
  const personalSteps = stableNumberRecordSignature(session.personalSteps);
  const groupGate = stableStringArrayRecordSignature(session.groupGate);
  const reportSignature = [
    hasReportText(session.reports?.step5, username),
    hasReportText(session.reports?.step7, username),
    hasReportText(session.reports?.step10, username)
  ].join(",");
  const artifactSignature = [
    textLengthSignature(session.outlines, username),
    textLengthSignature(session.step3SubmittedOutlines, username),
    textLengthSignature(session.draftStep6, username),
    textLengthSignature(session.draftStep8, username)
  ].join(",");
  const attendanceSignature = [
    [...(session.attendanceOverrides?.waitingExcludedUsernames ?? [])].sort().join(","),
    session.attendanceOverrides?.updatedAt ?? ""
  ].join(",");
  const makeupSignature = [
    (session.makeupWork?.outlineRequiredUsernames ?? []).includes(username) ? "required" : "",
    (session.makeupWork?.outlineCompletedUsernames ?? []).includes(username) ? "completed" : "",
    session.makeupWork?.outlineCompletedAt?.[username] ?? "",
    (session.makeupWork?.outlineReasons?.[username] ?? []).join(",")
  ].join(",");
  return [
    session.id,
    session.currentStep,
    messages.length,
    lastMessageAt,
    personalSteps,
    groupGate,
    username,
    artifactSignature,
    reportSignature,
    attendanceSignature,
    makeupSignature
  ].join(":");
}

export function resolveStudentSessionNextPollDelay(input: {
  currentDelayMs: number;
  unchanged: boolean;
}): number {
  if (!input.unchanged) return STUDENT_SESSION_FAST_POLL_MS;
  return Math.min(STUDENT_SESSION_MAX_POLL_MS, Math.max(STUDENT_SESSION_FAST_POLL_MS, input.currentDelayMs * 2));
}
