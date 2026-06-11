// Pure monitor helpers extracted from LearningMonitorTab (#460): step gate
// evaluation, advance hints, stuck-risk classification and step durations.

import { buildAdvancedStuckRisk } from "@/src/lib/learning-diagnostics";
import { excludeWaitingMembers } from "@/src/lib/session-attendance";
import { MonitorSession } from "./types";

export function getGroupCurrentStep(session: MonitorSession): number {
  const participants = session.participants ?? [];
  if (participants.length === 0 || !session.personalSteps) {
    return session.currentStep;
  }
  let minStep: number | null = null;
  for (const p of participants) {
    const step = session.personalSteps[p];
    if (typeof step === "number") {
      minStep = minStep === null ? step : Math.min(minStep, step);
    }
  }
  return minStep ?? session.currentStep;
}

export function formatStepDurationsText(entries: Array<{ step: number; minutes: number }>): string {
  if (entries.length === 0) return "—";
  return entries
    .sort((a, b) => a.step - b.step)
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
  if (session.currentStep === 3) return "3-complete";
  if (session.currentStep === 4) return "4-complete";
  return null;
}

export function getDetailedStepCode(session: MonitorSession, step: number = session.currentStep): string {
  if (step !== session.currentStep) return String(step);
  if (step === 1) {
    const sub = session.stepState?.step1Substep ?? 1;
    if (sub === 3) return `1-3-${session.stepState?.step1Substep3Question ?? 1}`;
    if (sub === 4) return `1-4-${session.stepState?.step1Substep4Question ?? 1}`;
    return `1-${sub}`;
  }
  if (step === 2) {
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

export function resolveStepGateMembers(session: MonitorSession, gateKey: "3-complete" | "4-complete"): string[] {
  const joinedMembers = (session.joinedUsers ?? []).filter((user) => session.participants.includes(user));
  if (joinedMembers.length > 0) return excludeWaitingMembers(joinedMembers, session);

  const activeFromStats = session.participants.filter((participant) => {
    const stats = session.studentMessageStats?.[participant];
    return (stats?.count ?? 0) > 0;
  });
  if (activeFromStats.length > 0) return excludeWaitingMembers(activeFromStats, session);

  if (gateKey === "3-complete") {
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
  const reopenedUsers = new Set(session.groupGate?.["3-reopen"] ?? []);
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
  const nextStep = step < 10 ? step + 1 : undefined;
  const stepMessages = session.messages.filter((m) => m.step === step);

  if (step === 1) {
    const ready = Boolean(session.stepReadyHints?.step1Ready) || stepMessages.some(
      (m) => m.role === "system" && m.text.includes("步驟 1 子步驟已完成，等待教師切換下一步")
    );
    return ready
      ? { ready: true, text: "全部組員已完成步驟 1，建議切換到 Step 2。", nextStep }
      : {
          ready: false,
          text: `步驟 1 進行中（目前子步驟 ${getDetailedStepCode(session, 1)}），等待全部組員完成。`
        };
  }

  if (step === 2) {
    const ready = Boolean(session.stepReadyHints?.step2Ready) || stepMessages.some(
      (m) => m.role === "system" && m.text.includes("步驟 2 子步驟已完成，等待教師切換下一步")
    );
    return ready
      ? { ready: true, text: "全部組員已完成步驟 2，建議切換到 Step 3。", nextStep }
      : {
          ready: false,
          text: `步驟 2 進行中（目前子步驟 ${getDetailedStepCode(session, 2)}），等待全部組員完成。`
        };
  }

  if (step === 4) {
    const completedUsers = session.groupGate?.["4-complete"] ?? [];
    const step4GateMembers = resolveStepGateMembers(session, "4-complete");
    const ready =
      step4GateMembers.length > 0 &&
      step4GateMembers.every((participant) => completedUsers.includes(participant));
    return ready
      ? { ready: true, text: "步驟 4 已全員確認完成，建議切換到 Step 5。", nextStep }
      : { ready: false, text: "步驟 4 尚未收齊已加入成員的完成確認。" };
  }

  if (step === 3) {
    const completedUsers = new Set(session.groupGate?.["3-complete"] ?? []);
    // Backward-compatibility: legacy sessions may miss the gate signal even though
    // students already submitted Step3 snapshots before the newer gate logic landed.
    session.participants.forEach((participant) => {
      if (hasStep3CompletionEvidence(session, participant, completedUsers)) completedUsers.add(participant);
    });
    const step3GateMembers = resolveStepGateMembers(session, "3-complete");
    const ready =
      step3GateMembers.length > 0 &&
      step3GateMembers.every((participant) => completedUsers.has(participant));
    return ready
      ? { ready: true, text: `步驟 ${step} 已收齊完成條件，建議切換到 Step ${nextStep}。`, nextStep }
      : {
          ready: false,
          text: "步驟 3 尚未收齊已加入成員的完成結構樹回報。"
        };
  }

  if (step >= 5 && step <= 10) {
    return {
      ready: false,
      text: `步驟 ${step} 為個人步調階段，無需收齊全班回覆。各步驟人數：${getPersonalStepCountText(session)}`
    };
  }

  return { ready: false, text: "目前已是最後步驟或無下一步建議。" };
}

export function getPersonalStepCountText(session: MonitorSession): string {
  const counts = new Map<number, number>();
  session.participants.forEach((participant) => {
    const step = session.personalSteps?.[participant] ?? session.currentStep;
    if (step < 5 || step > 10) return;
    counts.set(step, (counts.get(step) ?? 0) + 1);
  });
  return [5, 6, 7, 8, 9, 10]
    .map((step) => `S${step}:${counts.get(step) ?? 0}`)
    .join(" / ");
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
