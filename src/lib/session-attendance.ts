import type { MakeupOutlineReason, SessionState } from "@/src/lib/types";

export const WAITING_EXCLUSION_LABEL = "本次不列入等待";
export const MAKEUP_OUTLINE_LABEL = "需補個人結構圖";

function unique(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function currentSubstepKey(session: SessionState): string | undefined {
  if (session.currentStep === 1) {
    const sub = session.stepState?.step1Substep ?? 1;
    if (sub === 3) return `1-3-${session.stepState?.step1Substep3Question ?? 1}`;
    if (sub === 4) return `1-4-${session.stepState?.step1Substep4Question ?? 1}`;
    return `1-${sub}`;
  }
  if (session.currentStep === 2) {
    const sub = session.stepState?.step2Substep ?? 1;
    if (sub === 1) return `2-1-${session.stepState?.step2Substep1Question ?? 1}`;
    return `2-${sub}`;
  }
  return undefined;
}

export function getWaitingExcludedUsernames(session: Pick<SessionState, "attendanceOverrides">): string[] {
  return unique(session.attendanceOverrides?.waitingExcludedUsernames ?? []);
}

export function isWaitingExcluded(session: Pick<SessionState, "attendanceOverrides">, username: string): boolean {
  return getWaitingExcludedUsernames(session).includes(username);
}

export function excludeWaitingMembers<T extends string>(
  members: readonly T[],
  session: Pick<SessionState, "attendanceOverrides">
): T[] {
  const excluded = new Set(getWaitingExcludedUsernames(session));
  return members.filter((member) => !excluded.has(member));
}

export function resolveStep12GateMembers(session: SessionState): string[] {
  const joinedMembers = (session.joinedUsers ?? []).filter((user) => session.participants.includes(user));
  const baseMembers = joinedMembers.length > 0 ? joinedMembers : session.participants;
  return excludeWaitingMembers(baseMembers, session);
}

export function ensureMakeupWork(session: SessionState): NonNullable<SessionState["makeupWork"]> {
  session.makeupWork ??= {
    outlineRequiredUsernames: [],
    outlineCompletedUsernames: [],
    outlineCompletedAt: {},
    outlineReasons: {},
    outlineEvents: []
  };
  session.makeupWork.outlineRequiredUsernames = unique(session.makeupWork.outlineRequiredUsernames ?? []);
  session.makeupWork.outlineCompletedUsernames = unique(session.makeupWork.outlineCompletedUsernames ?? []);
  session.makeupWork.outlineCompletedAt ??= {};
  session.makeupWork.outlineReasons ??= {};
  session.makeupWork.outlineEvents ??= [];
  return session.makeupWork;
}

export function requireMakeupOutline(session: SessionState, username: string, reason: MakeupOutlineReason): void {
  const makeup = ensureMakeupWork(session);
  if (!makeup.outlineRequiredUsernames.includes(username)) makeup.outlineRequiredUsernames.push(username);
  const reasons = makeup.outlineReasons?.[username] ?? [];
  if (!reasons.includes(reason)) reasons.push(reason);
  makeup.outlineReasons![username] = reasons;
}

export function isMakeupOutlinePending(session: Pick<SessionState, "makeupWork">, username: string): boolean {
  const required = session.makeupWork?.outlineRequiredUsernames ?? [];
  const completed = session.makeupWork?.outlineCompletedUsernames ?? [];
  return required.includes(username) && !completed.includes(username);
}

export function completeMakeupOutline(session: SessionState, username: string, outline: string, at = new Date().toISOString()): void {
  const makeup = ensureMakeupWork(session);
  if (!makeup.outlineCompletedUsernames.includes(username)) makeup.outlineCompletedUsernames.push(username);
  makeup.outlineCompletedAt![username] = at;
  const reason = makeup.outlineReasons?.[username]?.[0] ?? "teacher_assigned";
  makeup.outlineEvents!.push({
    username,
    reason,
    stepContext: session.currentStep,
    createdAt: at,
    text: outline
  });
}

export function setWaitingExclusion(session: SessionState, input: {
  username: string;
  excluded: boolean;
  by: string;
  at?: string;
}): void {
  const at = input.at ?? new Date().toISOString();
  const current = getWaitingExcludedUsernames(session);
  const next = new Set(current);
  if (input.excluded) next.add(input.username);
  else next.delete(input.username);
  session.attendanceOverrides = {
    waitingExcludedUsernames: Array.from(next),
    updatedAt: at,
    updatedBy: input.by,
    events: [
      ...(session.attendanceOverrides?.events ?? []),
      {
        username: input.username,
        excluded: input.excluded,
        step: session.currentStep,
        substepKey: currentSubstepKey(session),
        at,
        by: input.by
      }
    ]
  };

  if (input.excluded && session.currentStep === 3) {
    const hasSubmitted = Boolean(session.step3SubmittedOutlines?.[input.username]?.trim());
    if (!hasSubmitted) requireMakeupOutline(session, input.username, "absent_step3");
  }
  if (input.excluded && session.currentStep === 4) {
    requireMakeupOutline(session, input.username, "absent_step4");
  }
}
