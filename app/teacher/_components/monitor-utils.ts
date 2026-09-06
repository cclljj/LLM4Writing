// Pure monitor helpers extracted from LearningMonitorTab (#460): step gate
// evaluation, advance hints, stuck-risk classification and step durations.

import { buildAdvancedStuckRisk } from "@/src/lib/learning-diagnostics";
import { excludeWaitingMembers } from "@/src/lib/session-attendance";
import {
  getGuidedDiscussionPromptStep,
  getNextWorkflowStep,
  pickEarlierWorkflowStep,
  getSessionWorkflowSteps,
  getWorkflowCapability,
  getWorkflowStepOrderIndex
} from "@/src/lib/course-workflow";
import { MonitorSession } from "./types";
import { getActiveGroupGateKey } from "@/src/lib/student-page-helpers";

export function getGroupCurrentStep(session: MonitorSession): number {
  const participants = session.participants ?? [];
  if (participants.length === 0 || !session.personalSteps) {
    return session.currentStep;
  }
  let minStep: number | null = null;
  for (const p of participants) {
    const step = session.personalSteps[p];
    if (typeof step === "number") {
      minStep = minStep === null ? step : pickEarlierWorkflowStep(session, minStep, step);
    }
  }
  return minStep ?? session.currentStep;
}

export function formatStepDurationsText(entries: Array<{ step: number; minutes: number }>, session?: MonitorSession): string {
  if (entries.length === 0) return "—";
  return entries
    .sort((a, b) => getWorkflowStepOrderIndex(session ?? {}, a.step) - getWorkflowStepOrderIndex(session ?? {}, b.step))
    .map((entry) => `S${entry.step}:${entry.minutes}分`)
    .join(" / ");
}

export function computeSessionStepDurations(session: MonitorSession): Array<{ step: number; minutes: number }> {
  const byStep = new Map<number, { start: number; end: number }>();
  for (const message of session.messages) {
    const ts = new Date(message.at).getTime();
    if (!Number.isFinite(ts)) continue;
    const prev = byStep.get(message.step);
    if (!prev) {
      byStep.set(message.step, { start: ts, end: ts });
    } else {
      prev.start = Math.min(prev.start, ts);
      prev.end = Math.max(prev.end, ts);
    }
  }
  const now = Date.now();
  const result: Array<{ step: number; minutes: number }> = [];
  for (const [step, range] of byStep.entries()) {
    const end = step === session.currentStep ? now : range.end;
    const minutes = Math.max(0, Math.floor((end - range.start) / 60000));
    result.push({ step, minutes });
  }
  return result;
}

export function computeUserStepDurations(session: MonitorSession, username: string): Array<{ step: number; minutes: number }> {
  const personalStep = session.personalSteps?.[username] ?? session.currentStep;
  const byStep = new Map<number, { start: number; end: number }>();
  for (const message of session.messages) {
    if (message.userId !== username) continue;
    const ts = new Date(message.at).getTime();
    if (!Number.isFinite(ts)) continue;
    const prev = byStep.get(message.step);
    if (!prev) {
      byStep.set(message.step, { start: ts, end: ts });
    } else {
      prev.start = Math.min(prev.start, ts);
      prev.end = Math.max(prev.end, ts);
    }
  }
  const now = Date.now();
  const result: Array<{ step: number; minutes: number }> = [];
  for (const [step, range] of byStep.entries()) {
    const end = step === personalStep ? now : range.end;
    const minutes = Math.max(0, Math.floor((end - range.start) / 60000));
    result.push({ step, minutes });
  }
  return result;
}

export function getMonitorGateKey(session: MonitorSession): string | null {
  const configuredKey = getActiveGroupGateKey(session, session.currentStep);
  if (configuredKey) return configuredKey;
  const guidedStep = getGuidedDiscussionPromptStep(getWorkflowCapability(session, session.currentStep));
  if (guidedStep === 1) {
    const sub = session.stepState?.step1Substep ?? 1;
    if (sub === 3) return `1-3-${session.stepState?.step1Substep3Question ?? 1}`;
    if (sub === 4) return `1-4-${session.stepState?.step1Substep4Question ?? 1}`;
    return `1-${sub}`;
  }
  if (guidedStep === 2) {
    const sub = session.stepState?.step2Substep ?? 1;
    if (sub === 1) return `2-1-${session.stepState?.step2Substep1Question ?? 1}`;
    return `2-${sub}`;
  }
  if (getWorkflowCapability(session, session.currentStep) === "outline") return `${session.currentStep}-complete`;
  if (getWorkflowCapability(session, session.currentStep) === "peer_outline") return `${session.currentStep}-complete`;
  return null;
}

export function getDetailedStepCode(session: MonitorSession, step: number = session.currentStep): string {
  if (step !== session.currentStep) return String(step);
  const configuredKey = getActiveGroupGateKey(session, step);
  if (configuredKey) return configuredKey;
  const guidedStep = getGuidedDiscussionPromptStep(getWorkflowCapability(session, step));
  if (guidedStep === 1) {
    const sub = session.stepState?.step1Substep ?? 1;
    if (sub === 3) return `1-3-${session.stepState?.step1Substep3Question ?? 1}`;
    if (sub === 4) return `1-4-${session.stepState?.step1Substep4Question ?? 1}`;
    return `1-${sub}`;
  }
  if (guidedStep === 2) {
    const sub = session.stepState?.step2Substep ?? 1;
    if (sub === 1) return `2-1-${session.stepState?.step2Substep1Question ?? 1}`;
    return `2-${sub}`;
  }
  return String(step);
}

export function getSessionLastEventAt(session: MonitorSession): Date | null {
  if (session.lastMessageAt) {
    const parsed = new Date(session.lastMessageAt);
    if (Number.isFinite(parsed.getTime())) return parsed;
  }
  const latest = session.messages
    .map((message) => new Date(message.at).getTime())
    .filter((time) => Number.isFinite(time))
    .sort((a, b) => b - a)[0];
  return typeof latest === "number" ? new Date(latest) : null;
}

export function resolveStepGateMembers(session: MonitorSession, gateKey: string): string[] {
  const joinedMembers = (session.joinedUsers ?? []).filter((user) => session.participants.includes(user));
  if (joinedMembers.length > 0) return excludeWaitingMembers(joinedMembers, session);

  const activeFromStats = session.participants.filter((participant) => {
    const stats = session.studentMessageStats?.[participant];
    return (stats?.count ?? 0) > 0;
  });
  if (activeFromStats.length > 0) return excludeWaitingMembers(activeFromStats, session);

  if (gateKey === `${session.currentStep}-complete` && getWorkflowCapability(session, session.currentStep) === "outline") {
    const submittedUsers = session.participants.filter((participant) => {
      return hasStep3CompletionEvidence(session, participant);
    });
    if (submittedUsers.length > 0) return excludeWaitingMembers(submittedUsers, session);
  }

  return excludeWaitingMembers(session.participants, session);
}

export function hasStep3CompletionEvidence(
  session: MonitorSession,
  participant: string,
  completedUsers?: ReadonlySet<string>
): boolean {
  if (completedUsers?.has(participant)) return true;
  const outlineStep = getSessionWorkflowSteps(session).find((step) => step.capability === "outline")?.step;
  if (outlineStep === undefined) return false;
  const reopenedUsers = new Set(session.groupGate?.[`${outlineStep}-reopen`] ?? []);
  if (reopenedUsers.has(participant)) return false;
  const submitted = session.step3SubmittedOutlines?.[participant]?.trim() ?? "";
  if (submitted.length > 0) return true;
  const outlineChars = session.artifactDiagnostics?.step3OutlineChars?.[participant] ?? 0;
  if (outlineChars > 0) return true;
  const outlineUpdatedAt = session.artifactDiagnostics?.step3OutlineUpdatedAt?.[participant] ?? "";
  return outlineUpdatedAt.trim().length > 0;
}

export function getStepAdvanceHint(session: MonitorSession): { ready: boolean; text: string; nextStep?: number } {
  const step = session.currentStep;
  const nextStep = getNextWorkflowStep(session, step)?.step;
  const stepMessages = session.messages.filter((m) => m.step === step);
  const capability = getWorkflowCapability(session, step);
  const guidedStep = getGuidedDiscussionPromptStep(capability);

  if (guidedStep === 1) {
    const ready = Boolean(session.stepReadyHints?.step1Ready) || stepMessages.some(
      (m) => m.role === "system" && m.text.includes("步驟 1 子步驟已完成，等待教師切換下一步")
    );
    return ready
      ? { ready: true, text: `全部組員已完成目前步驟，建議切換到 Step ${nextStep ?? "下一步"}。`, nextStep }
      : {
          ready: false,
          text: `目前步驟進行中（目前子步驟 ${getDetailedStepCode(session, step)}），等待全部組員完成。`
        };
  }

  if (guidedStep === 2) {
    const ready = Boolean(session.stepReadyHints?.step2Ready) || stepMessages.some(
      (m) => m.role === "system" && m.text.includes("步驟 2 子步驟已完成，等待教師切換下一步")
    );
    return ready
      ? { ready: true, text: `全部組員已完成目前步驟，建議切換到 Step ${nextStep ?? "下一步"}。`, nextStep }
      : {
          ready: false,
          text: `目前步驟進行中（目前子步驟 ${getDetailedStepCode(session, step)}），等待全部組員完成。`
        };
  }

  if (capability === "peer_outline") {
    const completeGate = `${step}-complete`;
    const completedUsers = session.groupGate?.[completeGate] ?? [];
    const step4GateMembers = resolveStepGateMembers(session, completeGate);
    const ready =
      step4GateMembers.length > 0 &&
      step4GateMembers.every((participant) => completedUsers.includes(participant));
    return ready
      ? { ready: true, text: `目前步驟已全員確認完成，建議切換到 Step ${nextStep ?? "下一步"}。`, nextStep }
      : { ready: false, text: "目前步驟尚未收齊已加入成員的完成確認。" };
  }

  if (capability === "outline") {
    const completeGate = `${step}-complete`;
    const completedUsers = new Set(session.groupGate?.[completeGate] ?? []);
    // Backward-compatibility: legacy sessions may miss the gate signal even though
    // students already submitted Step3 snapshots before the newer gate logic landed.
    session.participants.forEach((participant) => {
      if (hasStep3CompletionEvidence(session, participant, completedUsers)) completedUsers.add(participant);
    });
    const step3GateMembers = resolveStepGateMembers(session, completeGate);
    const ready =
      step3GateMembers.length > 0 &&
      step3GateMembers.every((participant) => completedUsers.has(participant));
    return ready
      ? { ready: true, text: `步驟 ${step} 已收齊完成條件，建議切換到 Step ${nextStep ?? "下一步"}。`, nextStep }
      : {
          ready: false,
          text: "目前步驟尚未收齊已加入成員的完成結構樹回報。"
        };
  }

  if (getWorkflowStepByMode(session, step) === "individual") {
    return {
      ready: false,
      text: `步驟 ${step} 為個人步調階段，無需收齊全班回覆。各步驟人數：${getPersonalStepCountText(session)}`
    };
  }

  return { ready: false, text: "目前已是最後步驟或無下一步建議。" };
}

export function getPersonalStepCountText(session: MonitorSession): string {
  const counts = new Map<number, number>();
  const personalPacedSteps = getSessionWorkflowSteps(session)
    .filter((step) => step.mode !== "group_interaction")
    .map((step) => step.step);
  session.participants.forEach((participant) => {
    const step = session.personalSteps?.[participant] ?? session.currentStep;
    if (!personalPacedSteps.includes(step)) return;
    counts.set(step, (counts.get(step) ?? 0) + 1);
  });
  return personalPacedSteps
    .map((step) => `S${step}:${counts.get(step) ?? 0}`)
    .join(" / ");
}

function getWorkflowStepByMode(session: MonitorSession, step: number): "group" | "individual" | "unknown" {
  const item = getSessionWorkflowSteps(session).find((workflowStep) => workflowStep.step === step);
  if (!item) return "unknown";
  return item.mode === "group_interaction" ? "group" : "individual";
}

export function getStuckRisk(session: MonitorSession): {
  level: "ok" | "watch" | "stuck";
  text: string;
  pendingMembers: string[];
  affectedUsers: string[];
  reasons: string[];
  suggestions: string[];
  minutesSinceLastEvent: number | null;
} {
  const isReady = getStepAdvanceHint(session).ready;
  if (isReady) {
    const latest = getSessionLastEventAt(session);
    const minutesSinceLastEvent = latest ? Math.floor((Date.now() - latest.getTime()) / 60000) : null;
    return {
      level: "ok",
      text: "已達切換條件，可一鍵推進。",
      pendingMembers: [],
      affectedUsers: [],
      reasons: ["已達切換條件，可一鍵推進。"],
      suggestions: ["可使用儀表板的一鍵推進按鈕切換到下一步。"],
      minutesSinceLastEvent
    };
  }
  return buildAdvancedStuckRisk(session);
}
