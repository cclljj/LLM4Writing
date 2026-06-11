// Pure derived view-state for the student page (#459): gate/waiting/group
// status, interaction permissions and step metadata, all computed from the
// polled session. Extracted from app/student/page.tsx unchanged; wrap in a
// single useMemo so child memo() components keep stable prop identities.

import { getActiveGroupGateKey, getMode, InteractionMode } from "@/src/lib/student-page-helpers";
import { getStep9QuestionsFromConfig } from "@/src/lib/spec";
import { SessionState } from "./student-session-types";

export type StudentGateView = ReturnType<typeof buildStudentGateView>;

export function buildStudentGateView(input: {
  session: SessionState | null;
  loginUser: string;
  currentStep: number;
  activityStatusMap: Record<string, "not_started" | "in_progress" | "paused" | "ended">;
  lastInteractiveKind: "question" | "student" | "ai" | undefined;
}) {
  const { session, loginUser, currentStep, activityStatusMap, lastInteractiveKind } = input;

  const ownStep = session && loginUser ? session.personalSteps?.[loginUser] ?? session.currentStep : 1;
  const step3SubmittedOutlineMermaid =
    !session || !loginUser || ownStep < 4 ? "" : session.step3SubmittedOutlines?.[loginUser]?.trim() ?? "";
  const step4OutlineMermaid =
    !session || !loginUser || ownStep < 5 ? "" : session.outlines?.[loginUser]?.trim() ?? "";

  const teammateUsers = session ? session.participants.filter((user) => user !== loginUser) : [];
  const waitingExcludedUsers = new Set(session?.attendanceOverrides?.waitingExcludedUsernames ?? []);
  const effectiveParticipants = (session?.participants ?? []).filter((user) => !waitingExcludedUsers.has(user));
  const makeupOutlinePending = Boolean(
    session &&
      loginUser &&
      (session.makeupWork?.outlineRequiredUsernames ?? []).includes(loginUser) &&
      !(session.makeupWork?.outlineCompletedUsernames ?? []).includes(loginUser)
  );

  const currentActivityStatus = session?.activityId ? activityStatusMap[session.activityId] : undefined;
  const courseStatusBlockedMessage =
    currentActivityStatus === "paused"
      ? "課程目前暫停中，已暫停互動與提交，請等待老師繼續上課。"
      : currentActivityStatus === "ended"
        ? "課程已結束，無法再互動或提交。請等待老師後續指示。"
        : currentActivityStatus === "not_started"
          ? "課程尚未開始，請等待老師開始上課。"
          : "";
  const currentMode: InteractionMode = getMode(currentStep);
  const currentModeLabel =
    currentMode === "group_interaction"
      ? "小組互動"
      : currentMode === "personal_interaction"
        ? "個人互動"
        : currentMode === "non_interactive"
          ? "無互動"
          : "個人反思";
  const isInputEnabled = currentMode !== "non_interactive" && (!currentActivityStatus || currentActivityStatus === "in_progress");

  const stepSubstepText =
    currentStep === 1
      ? `目前子步驟：${
          (session?.stepState.step1Substep ?? 1) === 3
            ? `1-3-${session?.stepState.step1Substep3Question ?? 1}`
            : (session?.stepState.step1Substep ?? 1) === 4
              ? `1-4-${session?.stepState.step1Substep4Question ?? 1}`
              : `1-${session?.stepState.step1Substep ?? 1}`
        }`
      : currentStep === 2
        ? `目前子步驟：${
            (session?.stepState.step2Substep ?? 1) === 1
              ? `2-1-${session?.stepState.step2Substep1Question ?? 1}`
              : `2-${session?.stepState.step2Substep ?? 1}`
          }`
        : null;
  const stepModeLine = `${stepSubstepText ?? "目前子步驟：—"} ｜ 模式：${currentModeLabel}`;
  const lastIsQuestion = lastInteractiveKind === "question";
  const activeGateKey = getActiveGroupGateKey(session, currentStep);
  const usernameToName = session?.participantDisplayNames ?? {};
  const toDisplayName = (username: string) => usernameToName[username] || username;
  const responders = activeGateKey ? session?.groupGate?.[activeGateKey] ?? [] : [];
  const step3CompletedUsers = session?.groupGate?.["3-complete"] ?? [];
  const step4CompletedUsers = session?.groupGate?.["4-complete"] ?? [];
  const step3CompletedByMe = Boolean(loginUser && step3CompletedUsers.includes(loginUser));
  const step4CompletedByMe = Boolean(loginUser && step4CompletedUsers.includes(loginUser));
  const step4CompletedPeers = (session?.participants ?? []).filter(
    (p) => p !== loginUser && step4CompletedUsers.includes(p)
  );
  const allStep4Completed =
    currentStep === 4 &&
    effectiveParticipants.length > 0 &&
    effectiveParticipants.every((p) => step4CompletedUsers.includes(p));
  const hasSubmittedThisTurn = Boolean(loginUser && responders.includes(loginUser));
  const allRespondedThisTurn =
    currentMode === "group_interaction" &&
    effectiveParticipants.length > 0 &&
    effectiveParticipants.every((p) => responders.includes(p));
  const canReplyToQuestion =
    currentStep === 4
      ? !step4CompletedByMe
      : currentMode === "group_interaction"
        ? !hasSubmittedThisTurn && !allRespondedThisTurn
        : currentStep === 3
          ? !step3CompletedByMe
          : Boolean(lastIsQuestion);
  const waitingGroupMembers =
    currentStep === 4
      ? !!session && step4CompletedByMe && !allStep4Completed
      : currentMode === "group_interaction" &&
        !!session &&
        Array.isArray(responders) &&
        hasSubmittedThisTurn &&
        !effectiveParticipants.every((p) => responders.includes(p));
  const latestStepMessage = session?.messages.filter((m) => m.step === currentStep).at(-1) ?? null;
  const waitingAiForGroup =
    currentStep === 4
      ? false
      : currentMode === "group_interaction" &&
        !!session &&
        effectiveParticipants.length > 0 &&
        effectiveParticipants.every((p) => responders.includes(p)) &&
        latestStepMessage?.role !== "ai";
  const step1CompletedWaitingTeacher =
    currentStep === 1 &&
    latestStepMessage?.role === "system" &&
    latestStepMessage.text.includes("步驟 1 子步驟已完成，等待教師切換下一步");
  const step2CompletedWaitingTeacher =
    currentStep === 2 &&
    latestStepMessage?.role === "system" &&
    latestStepMessage.text.includes("步驟 2 子步驟已完成，等待教師切換下一步");
  const waitingStep3Members =
    currentStep === 3 &&
    !!session &&
    step3CompletedByMe &&
    !effectiveParticipants.every((p) => step3CompletedUsers.includes(p));
  const groupStatusResponders = currentStep === 4 ? step4CompletedUsers : responders;
  const effectiveGroupStatusResponders = groupStatusResponders.filter((username) =>
    effectiveParticipants.includes(username)
  );
  const groupPendingMemberNames = effectiveParticipants
    .filter((username) => !groupStatusResponders.includes(username))
    .map((username) => toDisplayName(username));
  const groupMemberNames = effectiveParticipants.map((username) => toDisplayName(username));
  const groupLabel = session?.groupName ? `第 ${session.groupName} 組` : "—";
  const groupSubmittedCount = Math.min(effectiveGroupStatusResponders.length, effectiveParticipants.length);
  const groupTotalCount = effectiveParticipants.length;
  const groupStatusAllDone = currentStep === 4 ? allStep4Completed : allRespondedThisTurn;
  const groupStatusSubmittedByMe = currentStep === 4 ? step4CompletedByMe : hasSubmittedThisTurn;
  const showGroupStatusCard = Boolean(session && currentMode === "group_interaction" && [1, 2, 4].includes(currentStep));
  const groupStatusTitle = groupStatusAllDone
    ? currentStep === 4
      ? "全組已確認完成，等待老師切換下一步"
      : "全組已完成本題，AI 正在整理下一步"
    : groupStatusSubmittedByMe
      ? "你的部分已完成，正在等待同組同學"
      : "輪到你完成目前任務";
  const groupStatusTone: "" | "warning" | "success" = groupStatusAllDone ? "success" : groupStatusSubmittedByMe ? "warning" : "";
  const ownStep7Report = session && loginUser ? session.reports.step7[loginUser] : undefined;
  const ownStep10Report = session && loginUser ? session.reports.step10[loginUser] : undefined;
  const isStep10ReportReady = Boolean(ownStep10Report && ownStep10Report.trim());
  const stepOpeningText = session?.promptConfig?.stepOpenings?.[String(currentStep)]?.trim() ?? "";
  const step9QuestionTexts = (() => {
    if (currentStep !== 9) return [] as string[];
    const latestSystem = [...(session?.messages ?? [])]
      .filter((m) => m.step === 9 && m.role === "system")
      .at(-1)?.text;
    const fromSystem = latestSystem
      ? Array.from(latestSystem.matchAll(/\n?[1-4]\.\s*(.+)/g)).map((m) => (m[1] ?? "").trim()).slice(0, 4)
      : [];
    if (fromSystem.length === 4) return fromSystem;
    return getStep9QuestionsFromConfig(session?.promptConfig?.step9Questions).slice(0, 4);
  })();

  return {
    step3SubmittedOutlineMermaid,
    step4OutlineMermaid,
    teammateUsers,
    effectiveParticipants,
    makeupOutlinePending,
    currentActivityStatus,
    courseStatusBlockedMessage,
    currentMode,
    isInputEnabled,
    stepModeLine,
    activeGateKey,
    usernameToName,
    step3CompletedByMe,
    step4CompletedByMe,
    step4CompletedPeers,
    allStep4Completed,
    canReplyToQuestion,
    waitingGroupMembers,
    waitingAiForGroup,
    step1CompletedWaitingTeacher,
    step2CompletedWaitingTeacher,
    waitingStep3Members,
    groupPendingMemberNames,
    groupMemberNames,
    groupLabel,
    groupSubmittedCount,
    groupTotalCount,
    showGroupStatusCard,
    groupStatusTitle,
    groupStatusTone,
    ownStep7Report,
    ownStep10Report,
    isStep10ReportReady,
    stepOpeningText,
    step9QuestionTexts
  };
}
