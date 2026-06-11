// Pure helpers extracted from app/student/page.tsx (#457). Keep this module
// free of React so the logic stays unit-testable in Node.

export type InteractionMode = "group_interaction" | "personal_interaction" | "non_interactive" | "personal_reflection";

export const STUDENT_FETCH_TIMEOUT_MS = 8000;
export const STUDENT_FETCH_RETRY_DELAYS_MS = [500, 1200];

export class StudentFetchError extends Error {
  status?: number;
  code: "http" | "network" | "timeout" | "parse";

  constructor(message: string, code: StudentFetchError["code"], status?: number) {
    super(message);
    this.name = "StudentFetchError";
    this.code = code;
    this.status = status;
  }
}

export type FetchJsonOptions = {
  timeoutMs?: number;
  retryDelaysMs?: number[];
};

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export function isRetryableStudentFetchError(error: unknown): boolean {
  if (!(error instanceof StudentFetchError)) return true;
  if (error.code === "network" || error.code === "timeout" || error.code === "parse") return true;
  return Boolean(error.status && (error.status === 429 || error.status >= 500));
}

export async function fetchStudentJson<T>(
  input: RequestInfo | URL,
  init: RequestInit = {},
  options: FetchJsonOptions = {}
): Promise<{ data: T; response: Response }> {
  const timeoutMs = options.timeoutMs ?? STUDENT_FETCH_TIMEOUT_MS;
  const retryDelaysMs = options.retryDelaysMs ?? STUDENT_FETCH_RETRY_DELAYS_MS;
  let lastError: unknown;

  for (let attempt = 0; attempt <= retryDelaysMs.length; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(input, { ...init, signal: controller.signal });
      const raw = await response.text();
      let data: T;
      try {
        data = raw ? (JSON.parse(raw) as T) : ({} as T);
      } catch {
        throw new StudentFetchError("student_json_parse_failed", "parse", response.status);
      }
      if (!response.ok) {
        const errorCode = typeof (data as { error?: unknown }).error === "string"
          ? (data as { error: string }).error
          : "student_request_failed";
        throw new StudentFetchError(errorCode, "http", response.status);
      }
      return { data, response };
    } catch (error) {
      const normalizedError =
        error instanceof StudentFetchError
          ? error
          : new StudentFetchError(
              error instanceof DOMException && error.name === "AbortError" ? "student_request_timeout" : "student_network_failed",
              error instanceof DOMException && error.name === "AbortError" ? "timeout" : "network"
            );
      lastError = normalizedError;
      if (attempt >= retryDelaysMs.length || !isRetryableStudentFetchError(normalizedError)) {
        throw normalizedError;
      }
      await sleep(retryDelaysMs[attempt]!);
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError instanceof Error ? lastError : new StudentFetchError("student_request_failed", "network");
}

export function getStudentRetryableMessage(target: "auth" | "overview" | "join"): string {
  if (target === "auth") return "目前無法確認登入狀態，可能是網路或伺服器暫時忙碌。請稍候再試；如果全班都遇到這個畫面，請老師通知管理者。";
  if (target === "join") return "目前無法進入課程，可能是網路或伺服器暫時忙碌。請再按一次進入課程；如果仍失敗，請先通知老師。";
  return "目前無法載入課程清單，可能是網路或伺服器暫時忙碌。請按重新整理課程清單再試；如果全班都遇到這個畫面，請老師通知管理者。";
}

export function getMode(step: number): InteractionMode {
  if ([1, 2, 4].includes(step)) return "group_interaction";
  if ([3, 6, 8].includes(step)) return "personal_interaction";
  if ([5, 7, 10].includes(step)) return "non_interactive";
  return "personal_reflection";
}

export type GroupGateSessionLike = {
  stepState?: {
    step1Substep?: number;
    step2Substep?: number;
    step1Substep3Question?: number;
    step1Substep4Question?: number;
    step2Substep1Question?: number;
  } | null;
};

export function getActiveGroupGateKey(session: GroupGateSessionLike | null, step: number): string | null {
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

export function looksLikeInstructionPromptText(text: string): boolean {
  if (text.includes("【") || text.includes("提問規則") || text.includes("批判性思考")) return true;
  if (text.includes("請回答以下問題")) return true;
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  return lines.length >= 4 || text.length >= 160;
}

export function appendTeacherHelpHint(message: string): string {
  const hint = "如果你不確定怎麼修改，可以先舉手請老師來幫忙。";
  if (message.includes(hint)) return message;
  return `${message}\n\n${hint}`;
}

export function getOwnStepFromSession(
  session: { personalSteps?: Record<string, number>; currentStep: number },
  username: string
): number {
  return session.personalSteps?.[username] ?? session.currentStep;
}

// Race-condition guards extracted from app/student/page.tsx (#459). These are
// the decision rules that protect in-flight student edits from polling
// overwrites; they must stay pure so the safety-net tests can pin behavior.

export function shouldAcceptIncomingSession(input: {
  prevOwnStep: number;
  nextOwnStep: number;
  prevMessageCount: number;
  nextMessageCount: number;
}): boolean {
  // Guard against out-of-order polling responses that would roll the user
  // back to an earlier personal step with no newer payload.
  if (input.nextOwnStep < input.prevOwnStep && input.nextMessageCount <= input.prevMessageCount) {
    return false;
  }
  return true;
}

export type DraftHydrationDecision = {
  hydrateStep6: boolean;
  step6Draft: string;
  hydrateStep8: boolean;
  step8Draft: string;
};

export function resolveDraftHydration(input: {
  ownStep: number;
  lastOwnStep: number | null;
  draftText: string;
  savedDraft8Text: string;
  latestDraft6: string;
  latestDraft8: string | undefined;
}): DraftHydrationDecision {
  const justEnteredStep6 = input.lastOwnStep !== 6 && input.ownStep === 6;
  const justEnteredStep8 = input.lastOwnStep !== 8 && input.ownStep === 8;
  const decision: DraftHydrationDecision = {
    hydrateStep6: false,
    step6Draft: "",
    hydrateStep8: false,
    step8Draft: ""
  };
  if (input.ownStep === 6 && (justEnteredStep6 || !input.draftText)) {
    decision.hydrateStep6 = true;
    decision.step6Draft = input.latestDraft6;
  }
  if (input.ownStep === 8) {
    const latestDraft = input.latestDraft8 ?? input.latestDraft6;
    const hasUnsavedLocalStep8Edit = input.draftText !== input.savedDraft8Text;
    decision.hydrateStep8 =
      justEnteredStep8 ||
      (!hasUnsavedLocalStep8Edit && (input.draftText.length === 0 || latestDraft !== input.draftText));
    decision.step8Draft = latestDraft;
  }
  return decision;
}

export type InteractiveItem = {
  id: string;
  kind: "question" | "student" | "ai";
  text: string;
  at: string;
  userId?: string;
};

export type StepReview = {
  step: number;
  title: string;
  messages: InteractiveItem[];
};

export type StudentMessageLike = {
  id: string;
  role: string;
  userId?: string;
  text: string;
  at: string;
  step: number;
};

export function buildInteractiveMessages(input: {
  session: (GroupGateSessionLike & { groupGate?: Record<string, string[]> }) | null;
  sortedMessages: StudentMessageLike[];
  loginUser: string;
  currentStep: number;
}): InteractiveItem[] {
  const { session, sortedMessages, loginUser, currentStep } = input;
  if (!session) return [];
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
}

export function buildHistoryReviewSteps(
  stepNames: Record<number, string>,
  input: {
    session: { personalSteps?: Record<string, number>; currentStep: number } | null;
    sortedMessages: StudentMessageLike[];
    loginUser: string;
  }
): StepReview[] {
  const { session, sortedMessages, loginUser } = input;
  const ownStep = session && loginUser ? session.personalSteps?.[loginUser] ?? session.currentStep : 1;
  if (!session || !loginUser || ownStep <= 1) return [];
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
    reviews.push({ step, title: stepNames[step] ?? `步驟 ${step}`, messages });
  }
  return reviews;
}
