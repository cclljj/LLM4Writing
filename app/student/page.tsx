"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { buildStudentNextAction } from "@/src/lib/student-next-action";
import { getStep9QuestionsFromConfig } from "@/src/lib/spec";
import { validateDraftContent } from "@/src/lib/answer-validation";
import { appendErrorHint, formatUserError } from "@/src/lib/error-messages";
import OutlineSvg from "@/app/_components/OutlineSvg";
import GroupWaitingStatus from "./_components/GroupWaitingStatus";
import NextActionCard from "./_components/NextActionCard";
import StudentProgressRail from "./_components/StudentProgressRail";
import { renderMessageHtml } from "./_components/renderMessageHtml";
import OutlineEditor from "./_components/OutlineEditor";
import StudentLobby from "./_components/StudentLobby";
import HistoryReview from "./_components/HistoryReview";
import InteractionPanel from "./_components/InteractionPanel";
import Step68Panel from "./_components/Step68Panel";

type InteractionMode = "group_interaction" | "personal_interaction" | "non_interactive" | "personal_reflection";

type Course = {
  id: string;
  classNumber: string;
  title: string;
  genre: string;
  essayDescription?: string;
  durationMinutes: number;
  supplemental: string;
  groupStatus?: string;
  courseStatus?: "not_started" | "in_progress" | "paused" | "ended";
};

type ParticipatedCourse = {
  activityId: string;
  title: string;
  classNumber: string;
  lastSessionId: string;
  lastStep: number;
  lastParticipatedAt: string;
  sessionCount: number;
};

type SessionState = {
  id: string;
  currentStep: number;
  personalSteps?: Record<string, number>;
  activityId?: string;
  activityTitle?: string;
  groupName?: string;
  workflow: string;
  participants: string[];
  groupGate?: Record<string, string[]>;
  stepState: {
    step1Substep: number;
    step2Substep: number;
    step1Substep3Question?: number;
    step1Substep4Question?: number;
    step2Substep1Question?: number;
  };
  outlines: Record<string, string>;
  step3SubmittedOutlines?: Record<string, string>;
  draftStep6: Record<string, string>;
  draftStep8: Record<string, string>;
  reports: { step5: Record<string, string>; step7: Record<string, string>; step10: Record<string, string> };
  promptConfig?: {
    questionBanks?: Record<string, string[]>;
    stepOpenings?: Record<string, string>;
    step9Questions?: Record<string, string>;
  };
  messages: Array<{
    id: string;
    role: string;
    userId?: string;
    text: string;
    at: string;
    step: number;
  }>;
};

type InteractiveItem = {
  id: string;
  kind: "question" | "student" | "ai";
  text: string;
  at: string;
  userId?: string;
};

type StepReview = {
  step: number;
  title: string;
  messages: InteractiveItem[];
};

const stepNameMap: Record<number, string> = {
  1: "審視題目",
  2: "蒐集資料",
  3: "生成論點",
  4: "對比修正",
  5: "摘要報告",
  6: "撰寫初稿",
  7: "分析回饋",
  8: "修改潤飾",
  9: "個人反思",
  10: "總結報告"
};

function getMode(step: number): InteractionMode {
  if ([1, 2, 4].includes(step)) return "group_interaction";
  if ([3, 6, 8].includes(step)) return "personal_interaction";
  if ([5, 7, 10].includes(step)) return "non_interactive";
  return "personal_reflection";
}

function getActiveGroupGateKey(session: SessionState | null, step: number): string | null {
  if (!session) return null;
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
  return null;
}

function looksLikeInstructionPromptText(text: string): boolean {
  if (text.includes("【") || text.includes("提問規則") || text.includes("批判性思考")) return true;
  if (text.includes("請回答以下問題")) return true;
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  return lines.length >= 4 || text.length >= 160;
}

function appendTeacherHelpHint(message: string): string {
  const hint = "如果你不確定怎麼修改，可以先舉手請老師來幫忙。";
  if (message.includes(hint)) return message;
  return `${message}\n\n${hint}`;
}

function getOwnStepFromSession(session: SessionState, username: string): number {
  return session.personalSteps?.[username] ?? session.currentStep;
}

export default function StudentPage() {
  const router = useRouter();
  const [showDebugLog, setShowDebugLog] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [loginUser, setLoginUser] = useState("");
  const [profile, setProfile] = useState<{ name?: string; school?: string; classNumber?: string; ownerTeacherUsername?: string } | null>(null);
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [classCourses, setClassCourses] = useState<Course[]>([]);
  const [upcomingCourses, setUpcomingCourses] = useState<Course[]>([]);
  const [activeCourses, setActiveCourses] = useState<Course[]>([]);
  const [pausedCourses, setPausedCourses] = useState<Course[]>([]);
  const [participatedCourses, setParticipatedCourses] = useState<ParticipatedCourse[]>([]);
  const [activityStatusMap, setActivityStatusMap] = useState<Record<string, "not_started" | "in_progress" | "paused" | "ended">>({});
  const [preparingCourse, setPreparingCourse] = useState<Course | null>(null);
  const [session, setSession] = useState<SessionState | null>(null);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [draftText, setDraftText] = useState("");
  const [step9Answers, setStep9Answers] = useState(["", "", "", ""]);
  const [refUser, setRefUser] = useState("");
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [isLoadingOverview, setIsLoadingOverview] = useState(false);
  const [isAutoAdvancingStep5, setIsAutoAdvancingStep5] = useState(false);
  const [isSuggestingStep6, setIsSuggestingStep6] = useState(false);
  const [step3StreamingText, setStep3StreamingText] = useState("");
  const [step6StreamingText, setStep6StreamingText] = useState("");
  const [step7StreamingText, setStep7StreamingText] = useState("");
  const [step10StreamingText, setStep10StreamingText] = useState("");
  const [step10LoadingDots, setStep10LoadingDots] = useState<"..." | "......">("...");
  const step10StreamRequestedRef = useRef<string>("");
  const [isCompletingStep6, setIsCompletingStep6] = useState(false);
  const [savedDraft6Text, setSavedDraft6Text] = useState("");
  const [isCompletingStep8, setIsCompletingStep8] = useState(false);
  const [savedDraft8Text, setSavedDraft8Text] = useState("");
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [draftSaveError, setDraftSaveError] = useState("");
  const [lastDraftSavedAt, setLastDraftSavedAt] = useState<string | null>(null);
  const [step6RefUser, setStep6RefUser] = useState("");
  const lastOwnStepRef = useRef<number | null>(null);
  const sessionEtagRef = useRef<string>("");
  const outlineMermaidRef = useRef<string>("");

  const applySessionSafely = (incoming: SessionState) => {
    setSession((prev) => {
      if (!prev || !loginUser) return incoming;
      if (prev.id !== incoming.id) return incoming;
      const prevOwnStep = getOwnStepFromSession(prev, loginUser);
      const nextOwnStep = getOwnStepFromSession(incoming, loginUser);
      const prevMessageCount = prev.messages?.length ?? 0;
      const nextMessageCount = incoming.messages?.length ?? 0;
      // Guard against out-of-order polling responses that would roll the user
      // back to an earlier personal step with no newer payload.
      if (nextOwnStep < prevOwnStep && nextMessageCount <= prevMessageCount) {
        return prev;
      }
      return incoming;
    });
  };

  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (data?.authenticated && data?.user?.username) {
          setLoginUser(data.user.username);
        } else {
          setLoginUser("");
          router.push("/login");
        }
      })
      .catch(() => {
        setLoginUser("");
        router.push("/login");
      })
      .finally(() => setAuthReady(true));
  }, []);

  useEffect(() => {
    if (!authReady || !loginUser) return;
    refreshOverview();
  }, [authReady, loginUser]);

  useEffect(() => {
    if (!authReady || !loginUser) return;
    if (!session?.id) {
      const timer = window.setInterval(() => {
        refreshOverview().catch(() => undefined);
      }, 15000);
      return () => window.clearInterval(timer);
    }
    const sessionId = session.id;
    let tick = 0;
    const timer = window.setInterval(() => {
      const headers: Record<string, string> = {};
      if (sessionEtagRef.current) headers["If-None-Match"] = sessionEtagRef.current;
      fetch(`/api/session/${sessionId}`, { headers })
        .then((res) => {
          const newEtag = res.headers.get("ETag");
          if (newEtag) sessionEtagRef.current = newEtag;
          if (res.status === 304) return null;
          return res.json();
        })
        .then((data) => {
          if (data?.id) applySessionSafely(data);
        })
        .catch(() => undefined);
      if (tick % 3 === 0) refreshActivityStatuses().catch(() => undefined);
      tick++;
    }, 5000);
    return () => window.clearInterval(timer);
  }, [authReady, loginUser, session?.id]);

  useEffect(() => {
    if (!session || !loginUser) return;
    const ownStep = session.personalSteps?.[loginUser] ?? session.currentStep;
    const justEnteredStep6 = lastOwnStepRef.current !== 6 && ownStep === 6;
    const justEnteredStep8 = lastOwnStepRef.current !== 8 && ownStep === 8;
    if (ownStep === 6 && (justEnteredStep6 || !draftText)) {
      const latestDraft = session.draftStep6[loginUser] ?? "";
      setDraftText(latestDraft);
      setSavedDraft6Text(latestDraft);
      setDraftSaveError("");
      setLastDraftSavedAt(null);
      setStep6RefUser((prev) => (prev ? prev : loginUser));
    }
    if (ownStep === 8) {
      const latestDraft = session.draftStep8[loginUser] ?? session.draftStep6[loginUser] ?? "";
      const hasUnsavedLocalStep8Edit = draftText !== savedDraft8Text;
      const shouldHydrateStep8Draft =
        justEnteredStep8 ||
        (!hasUnsavedLocalStep8Edit && (draftText.length === 0 || latestDraft !== draftText));
      if (shouldHydrateStep8Draft) {
        setDraftText(latestDraft);
        setSavedDraft8Text(latestDraft);
        setDraftSaveError("");
        setLastDraftSavedAt(null);
      }
    }
    if (!refUser && session.participants.length > 0) {
      setRefUser((session.participants.find((user) => user !== loginUser) ?? session.participants[0])!);
    }
    lastOwnStepRef.current = ownStep;
  }, [draftText, loginUser, refUser, savedDraft8Text, session?.currentStep, session?.id, session?.personalSteps, session?.participants, session?.draftStep6, session?.draftStep8]);

  useEffect(() => {
    const ownStep = session && loginUser ? session.personalSteps?.[loginUser] ?? session.currentStep : 1;
    if (!session || ownStep !== 5 || !session.reports?.step5 || isAutoAdvancingStep5) return;
    const timer = window.setTimeout(async () => {
      setIsAutoAdvancingStep5(true);
      try {
        const response = await fetch("/api/session/step5/continue", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: session.id })
        });
        const data = await response.json();
        if (response.ok && data?.id) {
          applySessionSafely(data);
        } else {
          setError(formatUserError(data.error ?? "step5_auto_advance_failed"));
        }
      } finally {
        setIsAutoAdvancingStep5(false);
      }
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [isAutoAdvancingStep5, loginUser, session]);

  useEffect(() => {
    const ownStep = session && loginUser ? session.personalSteps?.[loginUser] ?? session.currentStep : 1;
    if (!session || !loginUser || ownStep !== 6) return;
    if (!step6RefUser || !session.participants.includes(step6RefUser)) {
      setStep6RefUser(loginUser);
    }
  }, [loginUser, session, step6RefUser]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      setShowDebugLog(params.get("debug") === "yes");
    }
  }, []);

  const currentStep = session && loginUser
    ? session.personalSteps?.[loginUser] ?? session.currentStep
    : session?.currentStep ?? 1;

  useEffect(() => {
    if (currentStep !== 9) return;
    setStep9Answers(["", "", "", ""]);
  }, [currentStep, session?.id]);

  const sortedMessages = useMemo(
    () => [...(session?.messages ?? [])].sort((a, b) => a.at.localeCompare(b.at)),
    [session]
  );

  const interactiveMessages = useMemo(() => {
    if (!session) return [] as InteractiveItem[];
    const currentMode = getMode(currentStep);
    const activeGateKey = getActiveGroupGateKey(session, currentStep);
    const responders = activeGateKey ? session.groupGate?.[activeGateKey] ?? [] : [];
    const hasSubmittedThisTurn = Boolean(loginUser && responders.includes(loginUser));
    const hidePeerAnswersBeforeOwn =
      currentMode === "group_interaction" &&
      Array.isArray(responders) &&
      responders.length > 0 &&
      !hasSubmittedThisTurn;

    const stepMessages = sortedMessages.filter((m) => m.step === currentStep);
    let currentTurnStartIndex = -1;
    for (let i = stepMessages.length - 1; i >= 0; i -= 1) {
      const m = stepMessages[i]!;
      if (activeGateKey) {
        if (m.role === "system" && m.text.includes(`子步驟 ${activeGateKey}：`)) {
          currentTurnStartIndex = i;
          break;
        }
      } else if (m.role === "system" && m.text.startsWith("步驟 4 開頭詞：")) {
        currentTurnStartIndex = i;
        break;
      }
    }

    const toQuestionText = (t: string): string | null => {
      if (t.includes("子步驟 ")) {
        const idx = t.indexOf("子步驟 ");
        const extracted = t.slice(idx).trim();
        const m = extracted.match(/^子步驟\s+(\d-\d(?:-\d)?)：([\s\S]*)$/);
        if (!m) return extracted;
        const substep = m[1];
        const content = m[2]?.trim() ?? "";
        if (content.startsWith("請討論：") || looksLikeInstructionPromptText(content)) {
          return `子步驟 ${substep}：請依上一則 AI 提問進行回答。`;
        }
        return `子步驟 ${substep}：${content}`;
      }
      if (t.startsWith("下一題：")) return t.replace("下一題：", "").trim();
      if (t.startsWith("步驟 9 開始：")) return t.replace("步驟 9 開始：", "").trim();
      if (t.startsWith("步驟 3 開頭詞：")) return t.replace("步驟 3 開頭詞：", "").trim();
      return null;
    };

    const result: InteractiveItem[] = [];
    stepMessages.forEach((m, idx) => {
      if (m.role === "student") {
        if (currentStep >= 5 && m.userId && m.userId !== loginUser) return;
        if (currentStep === 3 && m.userId && m.userId !== loginUser) return;
        const isCurrentTurnMessage = currentTurnStartIndex >= 0 ? idx > currentTurnStartIndex : false;
        if (hidePeerAnswersBeforeOwn && isCurrentTurnMessage && m.userId && m.userId !== loginUser) return;
        result.push({ id: m.id, kind: "student", text: m.text, at: m.at, userId: m.userId });
        return;
      }
      if (m.role === "ai") {
        if (currentStep >= 5 && m.userId && m.userId !== loginUser) return;
        if (currentStep === 3 && m.userId !== loginUser) return;
        result.push({ id: m.id, kind: "ai", text: m.text, at: m.at });
        return;
      }
      if (m.role === "system") {
        if (currentStep >= 5 && m.userId && m.userId !== loginUser) return;
        const q = toQuestionText(m.text);
        if (q) result.push({ id: m.id, kind: "question", text: q, at: m.at });
      }
    });
    return result;
  }, [session, sortedMessages, loginUser, currentStep]);

  const historyReviewSteps = useMemo(() => {
    const ownStep = session && loginUser ? session.personalSteps?.[loginUser] ?? session.currentStep : 1;
    if (!session || !loginUser || ownStep <= 1) return [] as StepReview[];
    const reviews: StepReview[] = [];
    for (let step = 1; step < ownStep; step += 1) {
      const messages = sortedMessages
        .filter((m) => m.step === step)
        .flatMap((m): InteractiveItem[] => {
          if (m.role === "system" || m.role === "teacher") return [];
          if (m.role === "student") {
            if (m.userId !== loginUser) return [];
            return [{ id: m.id, kind: "student", text: m.text, at: m.at, userId: m.userId }];
          }
          if (m.role === "ai") {
            if (m.userId && m.userId !== loginUser) return [];
            return [{ id: m.id, kind: "ai", text: m.text, at: m.at, userId: m.userId }];
          }
          return [];
        });
      reviews.push({ step, title: stepNameMap[step] ?? `步驟 ${step}`, messages });
    }
    return reviews;
  }, [loginUser, session, sortedMessages]);

  const step3SubmittedOutlineMermaid = useMemo(() => {
    const ownStep = session && loginUser ? session.personalSteps?.[loginUser] ?? session.currentStep : 1;
    if (!session || !loginUser || ownStep < 4) return "";
    return session.step3SubmittedOutlines?.[loginUser]?.trim() ?? "";
  }, [loginUser, session]);

  const step4OutlineMermaid = useMemo(() => {
    const ownStep = session && loginUser ? session.personalSteps?.[loginUser] ?? session.currentStep : 1;
    if (!session || !loginUser || ownStep < 5) return "";
    return session.outlines?.[loginUser]?.trim() ?? "";
  }, [loginUser, session]);

  const currentActivity = useMemo(
    () => {
      const all = [...classCourses];
      if (preparingCourse) all.push(preparingCourse);
      return all.find((item) => item.id === session?.activityId) ?? preparingCourse;
    },
    [classCourses, preparingCourse, session?.activityId]
  );
  const teammateUsers = useMemo(() => {
    if (!session) return [];
    return session.participants.filter((user) => user !== loginUser);
  }, [session, loginUser]);

  const currentActivityStatus = session?.activityId ? activityStatusMap[session.activityId] : undefined;
  const courseStatusBlockedMessage =
    currentActivityStatus === "paused"
      ? "課程目前暫停中，已暫停互動與提交，請等待老師繼續上課。"
      : currentActivityStatus === "ended"
        ? "課程已結束，無法再互動或提交。請等待老師後續指示。"
        : currentActivityStatus === "not_started"
          ? "課程尚未開始，請等待老師開始上課。"
          : "";
  const currentMode = getMode(currentStep);
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
  const lastInteractive = interactiveMessages[interactiveMessages.length - 1];
  const lastIsQuestion = lastInteractive?.kind === "question";
  const activeGateKey = getActiveGroupGateKey(session, currentStep);
  const responders = activeGateKey ? session?.groupGate?.[activeGateKey] ?? [] : [];
  const step3CompletedUsers = session?.groupGate?.["3-complete"] ?? [];
  const step4CompletedUsers = session?.groupGate?.["4-complete"] ?? [];
  const step3CompletedByMe = Boolean(loginUser && step3CompletedUsers.includes(loginUser));
  const step4CompletedByMe = Boolean(loginUser && step4CompletedUsers.includes(loginUser));
  const step4CompletedPeers = useMemo(
    () => (session?.participants ?? []).filter((p) => p !== loginUser && step4CompletedUsers.includes(p)),
    [loginUser, session?.participants, step4CompletedUsers]
  );
  const allStep4Completed =
    currentStep === 4 &&
    !!session &&
    session.participants.length > 0 &&
    session.participants.every((p) => step4CompletedUsers.includes(p));
  const hasSubmittedThisTurn = Boolean(loginUser && responders.includes(loginUser));
  const allRespondedThisTurn =
    currentMode === "group_interaction" && !!session && session.participants.every((p) => responders.includes(p));
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
        !session.participants.every((p) => responders.includes(p));
  const latestStepMessage = session?.messages.filter((m) => m.step === currentStep).at(-1) ?? null;
  const waitingAiForGroup =
    currentStep === 4
      ? false
      : currentMode === "group_interaction" &&
        !!session &&
        session.participants.length > 0 &&
        session.participants.every((p) => responders.includes(p)) &&
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
    !session.participants.every((p) => step3CompletedUsers.includes(p));
  const groupStatusResponders = currentStep === 4 ? step4CompletedUsers : responders;
  const groupPendingMembers = session?.participants.filter((p) => !groupStatusResponders.includes(p)) ?? [];
  const groupSubmittedCount = Math.min(groupStatusResponders.length, session?.participants.length ?? 0);
  const groupTotalCount = session?.participants.length ?? 0;
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
  const groupStatusTone = groupStatusAllDone ? "success" : groupStatusSubmittedByMe ? "warning" : "";
  const ownStep7Report = session && loginUser ? session.reports.step7[loginUser] : undefined;
  const ownStep10Report = session && loginUser ? session.reports.step10[loginUser] : undefined;
  useEffect(() => {
    const isStep10Waiting = currentStep === 10 && !ownStep10Report?.trim();
    if (!isStep10Waiting) {
      setStep10LoadingDots("...");
      return;
    }
    const timer = window.setInterval(() => {
      setStep10LoadingDots((prev) => (prev === "..." ? "......" : "..."));
    }, 600);
    return () => window.clearInterval(timer);
  }, [currentStep, ownStep10Report]);
  const unsavedDraft6Chars = currentStep === 6 && draftText !== savedDraft6Text ? draftText.length : 0;
  const unsavedDraft8Chars = currentStep === 8 && draftText !== savedDraft8Text ? draftText.length : 0;
  const currentUnsavedDraftChars = currentStep === 8 ? unsavedDraft8Chars : unsavedDraft6Chars;
  const draftSaveStatus = useMemo(() => {
    if (isSavingDraft) return { state: "saving" as const, text: "正在儲存..." };
    if (draftSaveError) return { state: "error" as const, text: draftSaveError };
    if (currentUnsavedDraftChars > 0) return { state: "dirty" as const, text: `尚有 ${currentUnsavedDraftChars} 字未保存` };
    if (lastDraftSavedAt) {
      const time = new Date(lastDraftSavedAt).toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" });
      return { state: "saved" as const, text: `已自動保存於 ${time}` };
    }
    return { state: "saved" as const, text: "目前內容已保存" };
  }, [currentUnsavedDraftChars, draftSaveError, isSavingDraft, lastDraftSavedAt]);
  const nextAction = buildStudentNextAction({
    currentStep,
    currentMode,
    canReplyToQuestion,
    isSendingMessage,
    waitingAiForGroup,
    waitingGroupMembers,
    waitingGroupMemberNames: groupPendingMembers,
    step1CompletedWaitingTeacher,
    step2CompletedWaitingTeacher,
    step3CompletedByMe,
    waitingStep3Members,
    step4CompletedByMe,
    allStep4Completed,
    draftTextLength: draftText.trim().length,
    unsavedDraftChars: currentUnsavedDraftChars,
    step9AnsweredCount: step9Answers.filter((a) => a.trim().length > 0).length
  });
  const stepOpeningText = session?.promptConfig?.stepOpenings?.[String(currentStep)]?.trim() ?? "";
  const step9QuestionTexts = useMemo(() => {
    if (currentStep !== 9) return [] as string[];
    const latestSystem = [...(session?.messages ?? [])]
      .filter((m) => m.step === 9 && m.role === "system")
      .at(-1)?.text;
    const fromSystem = latestSystem
      ? Array.from(latestSystem.matchAll(/\n?[1-4]\.\s*(.+)/g)).map((m) => (m[1] ?? "").trim()).slice(0, 4)
      : [];
    if (fromSystem.length === 4) return fromSystem;
    return getStep9QuestionsFromConfig(session?.promptConfig?.step9Questions).slice(0, 4);
  }, [currentStep, session?.messages, session?.promptConfig?.step9Questions]);

  async function refreshOverview() {
    setIsLoadingOverview(true);
    try {
      const response = await fetch("/api/student/overview", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) { setError(formatUserError(data.error ?? "overview_failed")); return; }
      setProfile(data.profile ?? null);
      setMissingFields(data.missingFields ?? []);
      setClassCourses(data.classCourses ?? []);
      setUpcomingCourses(data.upcomingCourses ?? []);
      setActiveCourses(data.activeCourses ?? []);
      setPausedCourses(data.pausedCourses ?? []);
      setParticipatedCourses(data.participatedCourses ?? []);
      const allCourses: Course[] = [
        ...(data.classCourses ?? []),
        ...(data.upcomingCourses ?? []),
        ...(data.activeCourses ?? []),
        ...(data.pausedCourses ?? [])
      ];
      const statusMap = allCourses.reduce((acc, course) => {
        if (course.id && course.courseStatus) acc[course.id] = course.courseStatus;
        return acc;
      }, {} as Record<string, "not_started" | "in_progress" | "paused" | "ended">);
      setActivityStatusMap(statusMap);
      setError("");
    } finally {
      setIsLoadingOverview(false);
    }
  }

  async function refreshActivityStatuses() {
    const response = await fetch("/api/student/activities", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) return;
    const list: Course[] = data.activities ?? [];
    const statusMap = list.reduce((acc, course) => {
      if (course.id && course.courseStatus) acc[course.id] = course.courseStatus;
      return acc;
    }, {} as Record<string, "not_started" | "in_progress" | "paused" | "ended">);
    setActivityStatusMap(statusMap);
  }

  async function joinActivity(activityId: string) {
    if (!loginUser) { setError(formatUserError("auth_not_ready")); return; }
    setError("");
    const response = await fetch("/api/student/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activityId })
    });
    const raw = await response.text();
    let data: Record<string, unknown> = {};
    if (raw) {
      try { data = JSON.parse(raw) as Record<string, unknown>; } catch { data = {}; }
    }
    if (!response.ok) {
      if (data.error === "course_not_started") { setError(formatUserError("course_not_started")); return; }
      if (data.error === "course_ended") { setError(formatUserError("course_ended")); return; }
      if (data.error === "course_paused") { setError(formatUserError("course_paused")); return; }
      if (data.error === "not_group_member") { setError(formatUserError("not_group_member")); return; }
      if (data.error === "student_join_failed") {
        const detail = typeof data.detail === "string" ? data.detail : "unknown";
        setError(`進入課程失敗：${detail}。建議：請重新整理後再試，或請教師確認課程設定。`);
        return;
      }
      setError(formatUserError(typeof data.error === "string" ? data.error : "join_failed"));
      return;
    }
    applySessionSafely(data as SessionState);
    setPreparingCourse(null);
    await refreshOverview();
  }

  async function sendMessage(e: FormEvent) {
    e.preventDefault();
    if (!session || !text.trim() || !isInputEnabled) return;
    setError("");
    setIsSendingMessage(true);
    try {
      if (currentStep === 3) {
        setStep3StreamingText("");
        const textToSend = text;
        const response = await fetch("/api/session/step3/stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: session.id, text: textToSend })
        });
        if (!response.ok || !response.body) {
          try {
            const data = await response.json();
            setError(appendTeacherHelpHint(formatUserError(data.error ?? "step3_stream_failed")));
          } catch {
            setError(appendTeacherHelpHint(formatUserError("step3_stream_failed")));
          }
          return;
        }
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let liveText = "";
        let finalSession: typeof session | null = null;
        let streamError = "";
        outer: while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split("\n\n");
          buffer = parts.pop() ?? "";
          for (const part of parts) {
            const line = part.trim();
            if (!line.startsWith("data:")) continue;
            const payload = line.slice(5).trim();
            if (!payload) continue;
            try {
              const event = JSON.parse(payload) as
                | { type: "chunk"; text: string }
                | { type: "done"; session: typeof session }
                | { type: "error"; error?: string };
              if (event.type === "chunk") {
                liveText += event.text;
                setStep3StreamingText(liveText);
              } else if (event.type === "done") {
                finalSession = event.session;
                break outer;
              } else if (event.type === "error") {
                streamError = event.error ?? "step3_stream_failed";
                break outer;
              }
            } catch {
              // Ignore malformed event lines.
            }
          }
        }
        if (streamError) {
          setError(appendTeacherHelpHint(formatUserError(streamError)));
        } else if (finalSession) {
          applySessionSafely(finalSession);
          setText("");
        }
        return;
      }

      const response = await fetch("/api/chat/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: session.id, userId: loginUser, text })
      });
      const data = await response.json();
      if (!response.ok) {
        const errorText = typeof data.error === "string" ? data.error : "send_failed";
        const hintText = typeof data.hint === "string" && data.hint.trim() ? data.hint.trim() : "";
        setError(appendTeacherHelpHint(appendErrorHint(errorText, hintText)));
        return;
      }
      applySessionSafely(data);
      setText("");
    } finally {
      setIsSendingMessage(false);
      setStep3StreamingText("");
    }
  }

  async function submitStep9Batch(e: FormEvent) {
    e.preventDefault();
    if (!session || currentStep !== 9 || !isInputEnabled) return;
    const payload = `Q1: ${step9Answers[0]}\nQ2: ${step9Answers[1]}\nQ3: ${step9Answers[2]}\nQ4: ${step9Answers[3]}`;
    setError("");
    setIsSendingMessage(true);
    try {
      const response = await fetch("/api/chat/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: session.id, userId: loginUser, text: payload })
      });
      const data = await response.json();
      if (!response.ok) {
        const errorText = typeof data.error === "string" ? data.error : "send_failed";
        const hintText = typeof data.hint === "string" && data.hint.trim() ? data.hint.trim() : "";
        setError(appendTeacherHelpHint(appendErrorHint(errorText, hintText)));
        return;
      }
      applySessionSafely(data);
      setStep9Answers(["", "", "", ""]);
    } finally {
      setIsSendingMessage(false);
    }
  }

  async function saveArtifact(type: "outline" | "draft6" | "draft8", content: string): Promise<boolean> {
    if (!session) return false;
    const isDraft = type === "draft6" || type === "draft8";
    if (isDraft) {
      setIsSavingDraft(true);
      setDraftSaveError("");
    }
    try {
      const response = await fetch("/api/session/artifact/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: session.id, type, content })
      });
      const data = await response.json();
      if (!response.ok) {
        const message = formatUserError(data.error ?? "save_failed");
        setError(message);
        if (isDraft) setDraftSaveError(message);
        return false;
      }
      if (type === "draft6") setSavedDraft6Text(content);
      if (type === "draft8") setSavedDraft8Text(content);
      if (isDraft) setLastDraftSavedAt(new Date().toISOString());
      applySessionSafely(data);
      return true;
    } finally {
      if (isDraft) setIsSavingDraft(false);
    }
  }

  async function handleOutlineSave(mermaid: string) {
    outlineMermaidRef.current = mermaid;
    await saveArtifact("outline", mermaid);
  }

  async function completeOutlineTree(mermaid: string) {
    if (!session) return;
    const courseStatus = activityStatusMap[session.activityId ?? ""];
    if (courseStatus && courseStatus !== "in_progress") {
      setError(courseStatus === "paused" ? "課程目前暫停中，請等待老師繼續上課。" : "課程目前不可提交，請等待老師指示。");
      return;
    }
    const response = await fetch("/api/session/step3/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: session.id, outline: mermaid })
    });
    const data = await response.json();
    if (!response.ok) { setError(formatUserError(data.error ?? "complete_step3_failed")); return; }
    applySessionSafely(data);
  }

  async function completeStep4() {
    if (!session) return;
    const courseStatus = activityStatusMap[session.activityId ?? ""];
    if (courseStatus && courseStatus !== "in_progress") {
      setError(courseStatus === "paused" ? "課程目前暫停中，請等待老師繼續上課。" : "課程目前不可提交，請等待老師指示。");
      return;
    }
    setError("");
    const outlineToSave = outlineMermaidRef.current || (session.outlines[loginUser] ?? "");
    const response = await fetch("/api/session/step4/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: session.id, outline: outlineToSave })
    });
    const data = await response.json();
    if (!response.ok) { setError(formatUserError(data.error ?? "complete_step4_failed")); return; }
    applySessionSafely(data);
  }

  async function requestStep6Suggestion() {
    if (!session || currentStep !== 6) return;
    const courseStatus = activityStatusMap[session.activityId ?? ""];
    if (courseStatus && courseStatus !== "in_progress") {
      setError(courseStatus === "paused" ? "課程目前暫停中，請等待老師繼續上課。" : "課程目前不可操作，請等待老師指示。");
      return;
    }
    setError("");
    setStep6StreamingText("");
    setIsSuggestingStep6(true);
    try {
      const saved = await saveArtifact("draft6", draftText);
      if (!saved) {
        setError((prev) => prev || "儲存文章失敗，尚未送出 AI 建議。請先儲存成功後再試。");
        return;
      }
      const response = await fetch("/api/session/step6/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: session.id, draft: draftText })
      });
      if (!response.ok || !response.body) {
        // Fallback: try to parse JSON error body for legacy error responses.
        try {
          const data = await response.json();
          setError(formatUserError(data.error ?? "step6_suggest_failed"));
        } catch {
          setError(formatUserError("step6_suggest_failed"));
        }
        return;
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let liveText = "";
      let finalSession: typeof session | null = null;
      let streamError = "";
      outer: while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";
        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          if (!payload) continue;
          try {
            const event = JSON.parse(payload) as
              | { type: "chunk"; text: string }
              | { type: "done"; session: typeof session }
              | { type: "error"; error?: string };
            if (event.type === "chunk") {
              liveText += event.text;
              setStep6StreamingText(liveText);
            } else if (event.type === "done") {
              finalSession = event.session;
              break outer;
            } else if (event.type === "error") {
              streamError = event.error ?? "step6_suggest_failed";
              break outer;
            }
          } catch {
            // Ignore malformed event lines.
          }
        }
      }
      if (streamError) {
        setError(formatUserError(streamError));
      } else if (finalSession) {
        applySessionSafely(finalSession);
      }
    } catch {
      setError(formatUserError("step6_suggest_failed"));
    } finally {
      setIsSuggestingStep6(false);
      setStep6StreamingText("");
    }
  }

  async function streamStep10Report(sessionId: string): Promise<boolean> {
    setStep10StreamingText("");
    try {
      const response = await fetch("/api/session/step10/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId })
      });
      if (!response.ok || !response.body) {
        setError(formatUserError("step10_stream_failed"));
        return false;
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let liveText = "";
      let finalSession: typeof session | null = null;
      let streamError = "";
      outer: while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";
        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          if (!payload) continue;
          try {
            const event = JSON.parse(payload) as
              | { type: "chunk"; text: string }
              | { type: "done"; session: typeof session }
              | { type: "error"; error?: string };
            if (event.type === "chunk") {
              liveText += event.text;
              setStep10StreamingText(liveText);
            } else if (event.type === "done") {
              finalSession = event.session;
              break outer;
            } else if (event.type === "error") {
              streamError = event.error ?? "step10_stream_failed";
              break outer;
            }
          } catch {
            // ignore
          }
        }
      }
      if (streamError) {
        setError(formatUserError(streamError));
        return false;
      }
      if (finalSession) {
        applySessionSafely(finalSession);
        return true;
      }
      return false;
    } catch {
      setError(formatUserError("step10_stream_failed"));
      return false;
    } finally {
      setStep10StreamingText("");
    }
  }

  // Auto-trigger Step 10 streaming when student personal step reaches 10
  // without a stored report yet (#241).
  useEffect(() => {
    if (!session || !loginUser) return;
    if (currentStep !== 10) return;
    if (ownStep10Report && ownStep10Report.trim()) return;
    if (step10StreamRequestedRef.current === session.id) return;
    step10StreamRequestedRef.current = session.id;
    streamStep10Report(session.id)
      .then((ok) => {
        if (!ok) {
          step10StreamRequestedRef.current = "";
        }
      })
      .catch(() => {
        step10StreamRequestedRef.current = "";
      });
  }, [session?.id, currentStep, ownStep10Report, loginUser]);

  async function completeStep6ToStep8() {
    if (!session || currentStep !== 6) return;
    const draftError = validateDraftContent(draftText);
    if (draftError) { setError(draftError); return; }
    setError("");
    setStep7StreamingText("");
    setIsCompletingStep6(true);
    try {
      const response = await fetch("/api/session/step6/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: session.id, draft: draftText })
      });
      if (!response.ok || !response.body) {
        try {
          const data = await response.json();
          setError(appendErrorHint(data.error ?? "step6_complete_failed", typeof data.hint === "string" ? data.hint : undefined));
        } catch {
          setError(formatUserError("step6_complete_failed"));
        }
        return;
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let liveText = "";
      let finalSession: typeof session | null = null;
      let streamError = "";
      outer: while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";
        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          if (!payload) continue;
          try {
            const event = JSON.parse(payload) as
              | { type: "chunk"; text: string }
              | { type: "done"; session: typeof session }
              | { type: "error"; error?: string };
            if (event.type === "chunk") {
              liveText += event.text;
              setStep7StreamingText(liveText);
            } else if (event.type === "done") {
              finalSession = event.session;
              break outer;
            } else if (event.type === "error") {
              streamError = event.error ?? "step6_complete_failed";
              break outer;
            }
          } catch {
            // ignore malformed event lines
          }
        }
      }
      if (streamError) {
        setError(formatUserError(streamError));
      } else if (finalSession) {
        setSavedDraft6Text(draftText);
        setLastDraftSavedAt(new Date().toISOString());
        applySessionSafely(finalSession);
      }
    } catch {
      setError(formatUserError("step6_complete_failed"));
    } finally {
      setIsCompletingStep6(false);
      setStep7StreamingText("");
    }
  }

  async function completeStep8ToStep9() {
    if (!session || currentStep !== 8) return;
    setError("");
    setIsCompletingStep8(true);
    try {
      const response = await fetch("/api/session/step8/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: session.id, draft: draftText })
      });
      const data = await response.json();
      if (!response.ok) { setError(formatUserError(data.error ?? "step8_complete_failed")); return; }
      setSavedDraft8Text(draftText);
      setLastDraftSavedAt(new Date().toISOString());
      applySessionSafely(data);
    } finally {
      setIsCompletingStep8(false);
    }
  }

  return (
    <main>
      {error ? (
        <div className="card" style={{ borderColor: "#fecaca", background: "#fff1f2" }}>
          <small>{error}</small>
        </div>
      ) : null}

      {missingFields.length > 0 ? (
        <div className="card" style={{ borderColor: "#fecaca", background: "#fff1f2" }}>
          <h2>資料警告</h2>
          <small>你的帳號資料不完整（{missingFields.join(", ")}），請向老師反映。</small>
        </div>
      ) : null}

      {!session ? (
        <StudentLobby
          isLoadingOverview={isLoadingOverview}
          profile={profile}
          classCourses={classCourses}
          activeCourses={activeCourses}
          upcomingCourses={upcomingCourses}
          pausedCourses={pausedCourses}
          participatedCourses={participatedCourses}
          onJoinActivity={joinActivity}
          onPrepareCourse={setPreparingCourse}
        />
      ) : null}

      {preparingCourse ? (
        <div className="card" style={{ borderColor: "#93c5fd", background: "#eff6ff" }}>
          <h2>準備開始上課</h2>
          <p><strong>{preparingCourse.title}</strong></p>
          <p>班級：{preparingCourse.classNumber} / 文體：{preparingCourse.genre} / 討論時長：{preparingCourse.durationMinutes} 分鐘</p>
          <small>你已進入準備階段，請等待老師點選「開始上課」。</small>
          <div className="row" style={{ marginTop: 10 }}>
            <div style={{ width: 220 }}>
              <button type="button" onClick={() => joinActivity(preparingCourse.id)}>檢查並進入討論</button>
            </div>
            <div style={{ width: 180 }}>
              <button type="button" className="secondary" onClick={() => refreshOverview()}>重新整理狀態</button>
            </div>
            <div style={{ width: 180 }}>
              <button type="button" className="secondary" onClick={() => setPreparingCourse(null)}>離開準備</button>
            </div>
          </div>
        </div>
      ) : null}

      {session ? (
        <>
          <div className="card">
            <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ marginBottom: 0 }}>課程內容</h2>
              <div className="row" style={{ gap: 8 }}>
                <button
                  type="button"
                  className="secondary"
                  style={{ width: "auto" }}
                  onClick={() => {
                    setSession(null);
                    setPreparingCourse(null);
                    refreshOverview().catch(() => undefined);
                  }}
                >
                  返回學生端課程首頁
                </button>
              </div>
            </div>
          </div>

          <div className="card" style={{ borderColor: "#93c5fd", background: "#eff6ff", padding: "10px 14px" }}>
            <p style={{ margin: 0, fontWeight: 700, fontSize: 20, lineHeight: 1.4 }}>
              {session.activityTitle ?? currentActivity?.title ?? "未命名課程"}
            </p>
            <p style={{ margin: "6px 0 0", lineHeight: 1.5 }}>
              文體：{currentActivity?.genre ?? "—"} / 時長：{currentActivity?.durationMinutes ?? "—"} 分鐘
            </p>
            <p style={{ margin: "4px 0 0", lineHeight: 1.5 }}>
              班級：{currentActivity?.classNumber ?? "—"} / 組別：{session.groupName ?? "—"}
            </p>
            <p style={{ margin: "4px 0 0", lineHeight: 1.5 }}>
              組員名單：{session.participants.length > 0 ? session.participants.join("、") : "—"}
            </p>
            <div style={{ marginTop: 10 }}>
              <p style={{ margin: 0 }}><strong>引導說明</strong></p>
              <div style={{ marginTop: 4 }} dangerouslySetInnerHTML={{ __html: renderMessageHtml(currentActivity?.essayDescription || "—") }} />
            </div>
            <div style={{ marginTop: 10, borderTop: "1px solid #dbeafe", paddingTop: 8 }}>
              <p style={{ margin: 0 }}><strong>補充資料</strong></p>
              <div style={{ marginTop: 4 }} dangerouslySetInnerHTML={{ __html: renderMessageHtml(currentActivity?.supplemental || "—") }} />
            </div>
          </div>

          <StudentProgressRail currentStep={currentStep} />
          <NextActionCard action={nextAction} />

          <HistoryReview
            steps={historyReviewSteps}
            loginUser={loginUser}
            step3SubmittedOutlineMermaid={step3SubmittedOutlineMermaid}
            step4OutlineMermaid={step4OutlineMermaid}
          />

          <div className="card">
            <h2>Step {currentStep} - {stepNameMap[currentStep] ?? "未知步驟"}</h2>
            <div style={{ marginTop: 8 }}>
              <span className="badge">{stepModeLine}</span>
            </div>
            {[1, 2, 3, 4, 6, 8, 9].includes(currentStep) && stepOpeningText ? (
              <p>
                <small>
                  <span dangerouslySetInnerHTML={{ __html: renderMessageHtml(stepOpeningText) }} />
                </small>
              </p>
            ) : null}
            {currentStep !== 10 ? (
              <p>
                <small>
                  {currentStep >= 5
                    ? "此階段為個人步調，系統會依你的完成狀態自動推進步驟（例如步驟 9 完成後自動進入步驟 10）。"
                    : "步驟切換由教師端控制，你的頁面會自動同步。"}
                </small>
              </p>
            ) : null}
            {currentStep === 10 ? (
              <>
                <hr style={{ border: 0, borderTop: "1px solid #e5e7eb", margin: "10px 0" }} />
                <h3 style={{ margin: "0 0 8px" }}>總結報告</h3>
                {ownStep10Report && ownStep10Report.trim() ? (
                  <div style={{ marginTop: 4 }} dangerouslySetInnerHTML={{ __html: renderMessageHtml(ownStep10Report) }} />
                ) : step10StreamingText ? (
                  <div
                    style={{
                      marginTop: 4,
                      padding: "10px 12px",
                      border: "1px solid #cbd5e1",
                      borderRadius: 8,
                      background: "#f8fafc",
                      whiteSpace: "pre-wrap",
                      fontSize: 14,
                      lineHeight: 1.6
                    }}
                  >
                    <small style={{ display: "block", marginBottom: 6, color: "#64748b", fontWeight: 600 }}>
                      AI 正在產生總結，這個步驟會花比較多的時間，請稍候{step10LoadingDots}
                    </small>
                    {step10StreamingText}
                  </div>
                ) : (
                  <small style={{ color: "#94a3b8" }}>
                    AI 正在產生總結，這個步驟會花比較多的時間，請稍候{step10LoadingDots}
                  </small>
                )}
              </>
            ) : null}
          </div>

          {showGroupStatusCard ? (
            <GroupWaitingStatus
              currentStep={currentStep}
              activeGateKey={activeGateKey}
              title={groupStatusTitle}
              tone={groupStatusTone}
              submittedCount={groupSubmittedCount}
              totalCount={groupTotalCount}
              pendingMembers={groupPendingMembers}
            />
          ) : null}

          {currentStep === 3 ? (
            <div className="card">
              <h2>互動內容</h2>
              {interactiveMessages.map((message) => (
                <div key={message.id} style={{ borderTop: "1px solid #e5e7eb", padding: "8px 0" }}>
                  <strong>
                    {message.kind === "question"
                      ? "問題"
                      : message.kind === "student"
                        ? `學生${message.userId ? `(${message.userId})` : ""}`
                        : "AI 回覆"}
                  </strong>
                  <div style={{ marginTop: 4 }} dangerouslySetInnerHTML={{ __html: renderMessageHtml(message.text) }} />
                  <small>{message.at}</small>
                </div>
              ))}
              {interactiveMessages.length === 0 ? (
                <small>請先描述你目前想建構的文章主軸，或直接提出你在結構樹規劃上遇到的問題。</small>
              ) : null}
              {step3StreamingText ? (
                <div
                  style={{
                    borderTop: "1px solid #e5e7eb",
                    padding: "8px 0",
                    whiteSpace: "pre-wrap"
                  }}
                >
                  <strong>AI 回覆</strong>
                  <div style={{ marginTop: 4 }}>{step3StreamingText}</div>
                </div>
              ) : null}
              {isSendingMessage ? (
                <p style={{ marginTop: 10 }}><small>AI 正在整理回覆中，請稍候...</small></p>
              ) : null}
              {step3CompletedByMe ? (
                <p style={{ marginTop: 10 }}>
                  <small>{waitingStep3Members ? "你已完成結構樹，等待其他同學完成..." : "你已完成結構樹，可等待老師切換下一步。"}</small>
                </p>
              ) : null}
              {!step3CompletedByMe && isInputEnabled && canReplyToQuestion && !isSendingMessage ? (
                <form onSubmit={sendMessage}>
                  <label>你的回答</label>
                  <textarea value={text} onChange={(e) => setText(e.target.value)} onPaste={(e) => e.preventDefault()} />
                  <button type="submit" style={{ marginTop: 10 }}>發送訊息</button>
                </form>
              ) : null}
            </div>
          ) : null}

          {currentStep === 3 && loginUser ? (
            <div className="card">
              <h2>文章結構樹</h2>
              <OutlineEditor
                serverMermaid={session.outlines[loginUser] ?? ""}
                locked={step3CompletedByMe}
                lockedLabel="已完成送出"
                onSave={handleOutlineSave}
                onComplete={completeOutlineTree}
                completeLabel="完成結構樹"
                completeDisabled={step3CompletedByMe}
                completedMessage={
                  step3CompletedByMe
                    ? (waitingStep3Members ? "你已完成結構樹，等待其他同學完成..." : "你已完成結構樹，可等待老師切換下一步。")
                    : undefined
                }
              />
            </div>
          ) : null}

          {currentStep === 4 && session && loginUser ? (
            <>
              <div className="card">
                <h2>同組同學結構樹</h2>
                <label style={{ marginTop: 10 }}>選擇同學</label>
                <select value={refUser} onChange={(e) => setRefUser(e.target.value)}>
                  {(teammateUsers.length > 0 ? teammateUsers : session.participants).map((user) => (
                    <option key={user} value={user}>{user}</option>
                  ))}
                </select>
                <OutlineSvg compact mermaidText={session.outlines[refUser] ?? ""} />
              </div>

              <div className="card">
                <h2>我的結構樹（可編修）</h2>
                {step4CompletedByMe ? (
                  <>
                    <small>你已確認完成此步驟，已鎖定編修；你的變更已自動儲存。</small>
                    <OutlineSvg compact mermaidText={session.outlines[loginUser] ?? ""} />
                  </>
                ) : (
                  <>
                    <small style={{ display: "block", marginBottom: 8 }}>此步驟建議先與同學討論，再修改自己的結構樹。</small>
                    <OutlineEditor
                      serverMermaid={session.outlines[loginUser] ?? ""}
                      locked={false}
                      lockedLabel="已確認完成，編修已鎖定"
                      onSave={handleOutlineSave}
                    />
                  </>
                )}
              </div>
            </>
          ) : null}

          {(currentStep === 6 || currentStep === 8) && loginUser ? (
            <Step68Panel
              currentStep={currentStep as 6 | 8}
              participants={session.participants}
              outlines={session.outlines}
              draftText={draftText}
              onDraftChange={setDraftText}
              onSaveDraft={() => saveArtifact(currentStep === 6 ? "draft6" : "draft8", draftText)}
              onSuggest={requestStep6Suggestion}
              onCompleteStep6={completeStep6ToStep8}
              onCompleteStep8={completeStep8ToStep9}
              isSuggestingStep6={isSuggestingStep6}
              isCompletingStep6={isCompletingStep6}
              isCompletingStep8={isCompletingStep8}
              unsavedChars={currentStep === 6 ? unsavedDraft6Chars : unsavedDraft8Chars}
              saveStatus={draftSaveStatus}
              step6RefUser={step6RefUser || loginUser}
              onStep6RefUserChange={setStep6RefUser}
              step6StreamingText={currentStep === 6 ? step6StreamingText : undefined}
              step7StreamingText={currentStep === 6 ? step7StreamingText : undefined}
            />
          ) : null}

          {currentStep === 5 ? (
            <div className="card">
              <h2>摘要報告</h2>
              <pre>{(loginUser && session.reports?.step5?.[loginUser]) || "系統尚未產生摘要。"}</pre>
              <small>摘要顯示後將自動進入步驟 6。</small>
            </div>
          ) : null}

          {currentStep === 7 ? (
            <div className="card">
              <h2>分析回饋</h2>
              <h3>步驟 6 作文內容</h3>
              <pre>{loginUser ? session.draftStep6[loginUser] ?? "尚未提交初稿。" : "尚未提交初稿。"}</pre>
              <h3 style={{ marginTop: 12 }}>AI 分析回饋</h3>
              <pre>{ownStep7Report ?? "系統尚未產生分析。"}</pre>
            </div>
          ) : null}

          {currentStep === 10 ? (
            <div className="card" style={{ borderColor: "#bfdbfe", background: "#eff6ff" }}>
              <h2>課程已完成</h2>
              <small>整個課程已經結束，請等待老師指示進行後續課程。</small>
            </div>
          ) : null}

          {currentStep !== 3 && currentStep !== 5 && currentStep !== 8 && currentStep !== 10 ? (
            <InteractionPanel
              currentStep={currentStep}
              currentMode={currentMode}
              interactiveMessages={interactiveMessages}
              text={text}
              onTextChange={setText}
              onSendMessage={sendMessage}
              onSubmitStep9={submitStep9Batch}
              onCompleteStep4={completeStep4}
              onCompleteStep6={completeStep6ToStep8}
              isSendingMessage={isSendingMessage}
              waitingAiForGroup={waitingAiForGroup}
              waitingGroupMembers={waitingGroupMembers}
              step1CompletedWaitingTeacher={step1CompletedWaitingTeacher}
              step2CompletedWaitingTeacher={step2CompletedWaitingTeacher}
              step4CompletedByMe={step4CompletedByMe}
              allStep4Completed={allStep4Completed}
              step4CompletedPeers={step4CompletedPeers}
              isCompletingStep6={isCompletingStep6}
              isSuggestingStep6={isSuggestingStep6}
              isInputEnabled={isInputEnabled}
              canReplyToQuestion={canReplyToQuestion}
              courseStatusBlockedMessage={courseStatusBlockedMessage}
              step9Answers={step9Answers}
              onStep9AnswerChange={(idx, val) => {
                const next = [...step9Answers];
                next[idx] = val;
                setStep9Answers(next);
              }}
              step9QuestionTexts={step9QuestionTexts}
              error={error}
            />
          ) : null}

          {showDebugLog ? (
            <>
              <hr />
              <div className="card">
                <h2>完整對話紀錄（除錯）</h2>
                {sortedMessages.map((message) => (
                  <div key={message.id} style={{ borderTop: "1px solid #e5e7eb", padding: "8px 0" }}>
                    <strong>[S{message.step}] {message.role}{message.userId ? `(${message.userId})` : ""}</strong>
                    <div style={{ marginTop: 4 }} dangerouslySetInnerHTML={{ __html: renderMessageHtml(message.text) }} />
                    <small>{message.at}</small>
                  </div>
                ))}
              </div>
            </>
          ) : null}
        </>
      ) : null}
    </main>
  );
}
