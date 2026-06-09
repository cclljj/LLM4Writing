import { randomUUID } from "node:crypto";
import { ChatMessage, SessionState, StartSessionPayload, Step12FallbackDebugTrace, Step12RoundLog } from "@/src/lib/types";
import { STEP_DEFINITIONS, getModeByStep, getStepName } from "@/src/lib/spec";
import { isLlmConfigured, llmChatCompletionText, LlmChatMessage } from "@/src/lib/llm-client";
import { buildStudentCourseContext } from "@/src/lib/llm-context";
import { findActivity } from "@/src/lib/activity-store";
import {
  extractCurrentSystemQuestion,
  normalizeForCompare,
  validateStep4DiscussionMessage,
  validateStudentAnswer,
  validateStudentAnswerSimple
} from "@/src/lib/answer-validation";
import { recordRejectedAnswerSignal } from "@/src/lib/learning-diagnostics";
import { classifyLlmError } from "@/src/lib/llm-observability";
import { PersistedErrorCategory, recordLearningEvent } from "@/src/lib/store";
import { getStep12FeedbackRiskReasons } from "@/src/lib/step12-feedback-quality";
import {
  buildStep10SectionPrompt,
  composeStep10Report,
  normalizeStep10SectionBody,
  resolveStep10ReportConfig
} from "@/src/lib/step10-report-format";
import {
  hasFormalLlmQualityRisk,
  parseStructuredStepAiResponse,
  normalizeFormalLlmText,
  normalizeStep5Summary,
  sanitizeStudentFacingText,
  splitAiFeedbackAndQuestion,
  isUsableNextQuestion
} from "@/src/lib/llm-response";
import { buildStep1Question, buildStep2Question, buildStep9BatchPrompt, getCurrentGroupGateKey, getCurrentSubstepKey, getStep9Questions } from "@/src/lib/workflow-questions";
import { advanceStep1Or2SubstepAfterAi, getNextSubstepKeyAfterCompletion, handleStep1Or2Group } from "@/src/lib/workflow-step1-2";

function now(): string {
  return new Date().toISOString();
}

const TOKEN_SCALE_NUMERATOR = 13;
const TOKEN_SCALE_DENOMINATOR = 10;

function scaleTokens(base: number): number {
  return Math.max(1, Math.round((base * TOKEN_SCALE_NUMERATOR) / TOKEN_SCALE_DENOMINATOR));
}

const step12RoundLocks = new Set<string>();

function makeMessage(input: Omit<ChatMessage, "id" | "at">): ChatMessage {
  return {
    id: randomUUID(),
    at: now(),
    ...input
  };
}

function initializeStepQuestion(session: SessionState, step: number): void {
  if (step === 1) {
    session.stepState.step1Substep = 1;
    session.stepState.step1Substep3Question = 1;
    session.stepState.step1Substep4Question = 1;
    const q = buildStep1Question(session);
    session.messages.push(
      makeMessage({
        role: "system",
        step,
        text: `子步驟 1-1：${q}`
      })
    );
  }

  if (step === 2) {
    session.stepState.step2Substep = 1;
    session.stepState.step2Substep1Question = 1;
    const q = buildStep2Question(session);
    session.messages.push(
      makeMessage({
        role: "system",
        step,
        text: `子步驟 2-1-1：${q}`
      })
    );
  }
}

export function createSession(payload: StartSessionPayload): SessionState {
  const sessionId = randomUUID();
  const workflow = payload.workflow ?? "spec10";
  const phaseMax = payload.phaseMax ?? (workflow === "legacy_phase" ? 5 : 10);
  const participants = payload.participants;

  const session: SessionState = {
    id: sessionId,
    createdAt: now(),
    currentStep: 1,
    personalSteps: Object.fromEntries(participants.map((id) => [id, 1])),
    participants,
    messages: [],
    qualitySignals: { rejectedAnswerCounts: {}, rejectedAnswerLastAt: {} },
    artifactSignals: { outlineUpdatedAt: {}, draftStep6UpdatedAt: {}, draftStep8UpdatedAt: {} },
    step12RoundLogs: [],
    step12FallbackDebugTraces: [],
    step12RoundState: { completedGateKeys: [] },
    groupGate: {},
    reflectionIndex: Object.fromEntries(participants.map((id) => [id, 0])),
    workflow,
    phaseMax,
    activityId: payload.activityId,
    activityTitle: payload.activityTitle,
    activityEssayDescription: payload.activityEssayDescription,
    activitySupplemental: payload.activitySupplemental,
    groupId: payload.groupId,
    groupName: payload.groupName,
    promptConfig:
      payload.promptConfig ?? {
        stepPrompts: {},
        step12FeedbackPrompts: {},
        step12FeedbackFocusPrompts: {},
        subStepPrompts: {},
        subStepPromptsFallbacks: {},
        questionBanks: {},
        step9Questions: {},
        stepOpenings: {}
      },
    stepState: { step1Substep: 1, step2Substep: 1, step1Substep3Question: 1, step1Substep4Question: 1, step2Substep1Question: 1 },
    outlines: {},
    step3SubmittedOutlines: {},
    draftStep6: {},
    draftStep8: {},
    reports: { step5: {}, step7: {}, step10: {} }
  };

  if (workflow === "legacy_phase") {
    session.messages.push(
      makeMessage({
        role: "system",
        step: 1,
        text: `進入 Phase1。任務：${payload.activityTitle ?? "未命名任務"}。請開始討論。`
      })
    );
  } else {
    initializeStepQuestion(session, 1);
  }

  return session;
}

function isLegacy(session: SessionState): boolean {
  return session.workflow === "legacy_phase";
}

function normalizeSessionRuntimeShape(session: SessionState): void {
  if (!Array.isArray(session.messages)) {
    session.messages = [];
  }
  if (!Array.isArray(session.participants)) {
    session.participants = [];
  }
  if (!session.groupGate || typeof session.groupGate !== "object") {
    session.groupGate = {};
  }
  if (!session.qualitySignals || typeof session.qualitySignals !== "object") {
    session.qualitySignals = { rejectedAnswerCounts: {}, rejectedAnswerLastAt: {} };
  }
  if (!session.qualitySignals.rejectedAnswerCounts || typeof session.qualitySignals.rejectedAnswerCounts !== "object") {
    session.qualitySignals.rejectedAnswerCounts = {};
  }
  if (!session.qualitySignals.rejectedAnswerLastAt || typeof session.qualitySignals.rejectedAnswerLastAt !== "object") {
    session.qualitySignals.rejectedAnswerLastAt = {};
  }
  if (!session.artifactSignals || typeof session.artifactSignals !== "object") {
    session.artifactSignals = { outlineUpdatedAt: {}, draftStep6UpdatedAt: {}, draftStep8UpdatedAt: {} };
  }
  if (!session.artifactSignals.outlineUpdatedAt || typeof session.artifactSignals.outlineUpdatedAt !== "object") {
    session.artifactSignals.outlineUpdatedAt = {};
  }
  if (!session.artifactSignals.draftStep6UpdatedAt || typeof session.artifactSignals.draftStep6UpdatedAt !== "object") {
    session.artifactSignals.draftStep6UpdatedAt = {};
  }
  if (!session.artifactSignals.draftStep8UpdatedAt || typeof session.artifactSignals.draftStep8UpdatedAt !== "object") {
    session.artifactSignals.draftStep8UpdatedAt = {};
  }
  if (!Array.isArray(session.step12RoundLogs)) {
    session.step12RoundLogs = [];
  }
  if (!Array.isArray(session.step12FallbackDebugTraces)) {
    session.step12FallbackDebugTraces = [];
  }
  if (!session.step12RoundState || typeof session.step12RoundState !== "object") {
    session.step12RoundState = { completedGateKeys: [] };
  }
  if (!Array.isArray(session.step12RoundState.completedGateKeys)) {
    session.step12RoundState.completedGateKeys = [];
  }
  if (!session.reflectionIndex || typeof session.reflectionIndex !== "object") {
    session.reflectionIndex = {};
  }
  if (!session.stepState || typeof session.stepState !== "object") {
    session.stepState = { step1Substep: 1, step2Substep: 1, step1Substep3Question: 1, step1Substep4Question: 1, step2Substep1Question: 1 };
  }
  if (typeof session.stepState.step1Substep !== "number") {
    session.stepState.step1Substep = 1;
  }
  if (typeof session.stepState.step2Substep !== "number") {
    session.stepState.step2Substep = 1;
  }
  if (typeof session.stepState.step1Substep3Question !== "number") {
    session.stepState.step1Substep3Question = 1;
  }
  if (typeof session.stepState.step1Substep4Question !== "number") {
    session.stepState.step1Substep4Question = 1;
  }
  if (typeof session.stepState.step2Substep1Question !== "number") {
    session.stepState.step2Substep1Question = 1;
  }
  if (!session.promptConfig || typeof session.promptConfig !== "object") {
    session.promptConfig = {
      stepPrompts: {},
      step12FeedbackPrompts: {},
      step12FeedbackFocusPrompts: {},
      subStepPrompts: {},
      subStepPromptsFallbacks: {},
      questionBanks: {},
      step9Questions: {},
      stepOpenings: {}
    };
  }
  if (!session.promptConfig.stepPrompts || typeof session.promptConfig.stepPrompts !== "object") {
    session.promptConfig.stepPrompts = {};
  }
  if (!session.promptConfig.subStepPrompts || typeof session.promptConfig.subStepPrompts !== "object") {
    session.promptConfig.subStepPrompts = {};
  }
  if (!session.promptConfig.step12FeedbackPrompts || typeof session.promptConfig.step12FeedbackPrompts !== "object") {
    session.promptConfig.step12FeedbackPrompts = {};
  }
  if (!session.promptConfig.step12FeedbackFocusPrompts || typeof session.promptConfig.step12FeedbackFocusPrompts !== "object") {
    session.promptConfig.step12FeedbackFocusPrompts = {};
  }
  if (!session.promptConfig.subStepPromptsFallbacks || typeof session.promptConfig.subStepPromptsFallbacks !== "object") {
    session.promptConfig.subStepPromptsFallbacks = {};
  }
  if (!session.promptConfig.questionBanks || typeof session.promptConfig.questionBanks !== "object") {
    session.promptConfig.questionBanks = {};
  }
  if (!session.promptConfig.step9Questions || typeof session.promptConfig.step9Questions !== "object") {
    session.promptConfig.step9Questions = {};
  }
  if (!session.promptConfig.stepOpenings || typeof session.promptConfig.stepOpenings !== "object") {
    session.promptConfig.stepOpenings = {};
  }
  if (!session.reports || typeof session.reports !== "object") {
    session.reports = { step5: {}, step7: {}, step10: {} };
  }
  if (!session.reports.step5 || typeof session.reports.step5 !== "object" || Array.isArray(session.reports.step5)) {
    const legacyRaw = (session.reports as unknown as { step5?: unknown }).step5;
    const legacyStep5 = typeof legacyRaw === "string" ? legacyRaw : "";
    session.reports.step5 = {};
    if (legacyStep5.trim()) {
      session.participants.forEach((participant) => {
        session.reports.step5[participant] = legacyStep5;
      });
    }
  }
  if (!session.reports.step7 || typeof session.reports.step7 !== "object") {
    session.reports.step7 = {};
  }
  if (!session.reports.step10 || typeof session.reports.step10 !== "object") {
    session.reports.step10 = {};
  }
  if (!session.step3SubmittedOutlines || typeof session.step3SubmittedOutlines !== "object") {
    session.step3SubmittedOutlines = {};
  }
  if (!session.personalSteps || typeof session.personalSteps !== "object") {
    session.personalSteps = {};
  }
  session.participants.forEach((participant) => {
    if (typeof session.personalSteps?.[participant] !== "number") {
      session.personalSteps![participant] = session.currentStep;
    }
  });
}

function ensureParticipants(session: SessionState, fallbackUserId: string): string[] {
  normalizeSessionRuntimeShape(session);
  const known = new Set<string>();

  if (Array.isArray(session.participants)) {
    session.participants.forEach((p) => {
      if (typeof p === "string" && p.trim()) known.add(p);
    });
  }

  // Recover legacy/corrupted session payloads by learning participants from existing student messages.
  session.messages.forEach((m) => {
    if (m.role === "student" && typeof m.userId === "string" && m.userId.trim()) {
      known.add(m.userId);
    }
  });

  if (fallbackUserId.trim()) {
    known.add(fallbackUserId.trim());
  }

  session.participants = Array.from(known);
  return session.participants;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const safeConcurrency = Math.max(1, Math.floor(concurrency));
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function runWorker() {
    while (true) {
      const current = nextIndex;
      nextIndex += 1;
      if (current >= items.length) return;
      results[current] = await worker(items[current]!, current);
    }
  }

  const workers = Array.from({ length: Math.min(safeConcurrency, items.length) }, () => runWorker());
  await Promise.all(workers);
  return results;
}

async function generateAiTextWithRetry(
  messages: LlmChatMessage[],
  temperature: number,
  maxTokens: number,
  options: {
    attempts?: number;
    timeoutMs?: number;
    continueOnTruncation?: boolean;
    continuationMaxRounds?: number;
    telemetry?: { sessionId?: string; activityId?: string; step?: number; label?: string };
  } = {}
): Promise<string> {
  let lastError: unknown;
  const attempts = options.attempts ?? 3;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await llmChatCompletionText({
        messages,
        temperature,
        maxTokens,
        timeoutMs: options.timeoutMs,
        continueOnTruncation: options.continueOnTruncation,
        continuationMaxRounds: options.continuationMaxRounds,
        telemetry: options.telemetry
      });
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 250));
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error("llm_retry_exhausted");
}

function compactWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function truncateForTrace(text: string, maxChars = 6000): string {
  const normalized = text.trim();
  if (normalized.length <= maxChars) return normalized;
  return `${normalized.slice(0, maxChars - 1)}…`;
}

function summarizeLlmCallError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error ?? "unknown_error");
  return truncateForTrace(raw, 800);
}

function buildLlmCallFailureTraceResponse(errorCategory: PersistedErrorCategory, error: unknown): string {
  const summary = summarizeLlmCallError(error);
  return truncateForTrace(`(llm_error:${errorCategory}) ${summary}`, 1200);
}

function buildLlmCallFailureReasons(error: unknown): string[] {
  const summary = summarizeLlmCallError(error).toLowerCase();
  const reasons = ["llm_call_failed"];
  const codeMatch = summary.match(/llm_http_\d{3}/);
  if (codeMatch?.[0]) reasons.push(codeMatch[0]);
  return reasons;
}

function buildOriginalPromptText(messages: LlmChatMessage[]): string {
  return messages
    .map((message) => `[${message.role}]\n${message.content}`)
    .join("\n\n");
}

function buildStep12StepContext(session: SessionState, step: 1 | 2, userId: string): {
  essayTitle: string;
  currentSubstepKey: string;
  currentQuestion: string;
  sameStepRecent: string;
  crossStepContext: string;
  step11GenreCheckHint: string;
} {
  const currentSubstepKey = getCurrentSubstepKey(session, step) ?? `${step}-unknown`;
  const currentQuestion = extractCurrentSystemQuestion(session, step, userId) || "(尚無題目)";
  const essayTitle = session.activityTitle?.trim() || "未命名題目";
  const sameStepRecent = session.messages
    .filter((m) => m.step === step)
    .slice(-10)
    .map((m) => {
      if (m.role === "student") return `學生${m.userId ? `(${m.userId})` : ""}：${m.text}`;
      if (m.role === "ai") return `AI：${m.text}`;
      return `系統：${m.text}`;
    })
    .join("\n");
  const crossStepContext = buildStudentCourseContext(session, userId, step, {
    maxMessages: 48,
    maxChars: 13000,
    includeSystem: true
  });
  const step11GenreCheckHint = buildStep11GenreCheckHint(session, currentSubstepKey);
  return { essayTitle, currentSubstepKey, currentQuestion, sameStepRecent, crossStepContext, step11GenreCheckHint };
}

function resolveGenreLabel(text: string): string | null {
  const normalized = normalizeForCompare(text);
  if (!normalized) return null;
  const genreMatchers: Array<{ label: string; aliases: string[] }> = [
    { label: "議論文", aliases: ["議論文", "論說文"] },
    { label: "記敘文", aliases: ["記敘文", "敘事文", "故事文"] },
    { label: "說明文", aliases: ["說明文"] },
    { label: "抒情文", aliases: ["抒情文"] }
  ];
  for (const genre of genreMatchers) {
    if (genre.aliases.some((alias) => normalized.includes(normalizeForCompare(alias)))) {
      return genre.label;
    }
  }
  return null;
}

function buildStep11GenreCheckHint(session: SessionState, currentSubstepKey: string): string {
  if (session.currentStep !== 1 || currentSubstepKey !== "1-1") return "";
  const expectedGenreRaw = session.activityId ? findActivity(session.activityId)?.genre ?? "" : "";
  const expectedGenre = resolveGenreLabel(expectedGenreRaw);
  if (!expectedGenre) return "";

  const gateResponses = session.messages
    .filter((message) => message.step === 1 && message.role === "student")
    .slice(-Math.max(session.participants.length, 1));
  if (gateResponses.length === 0) return `文體檢核：本題正確文體是「${expectedGenre}」。請在回饋中提醒學生判準。`;

  const studentGenres = gateResponses.map((message) => {
    const guessed = resolveGenreLabel(message.text);
    return `${message.userId ?? "unknown"}=${guessed ?? "未明確回答文體"}`;
  });
  const hasMismatch = gateResponses.some((message) => {
    const guessed = resolveGenreLabel(message.text);
    return guessed !== expectedGenre;
  });
  if (!hasMismatch) return `文體檢核：學生回答與題目文體一致（${expectedGenre}）。`;

  return [
    `文體檢核：本題正確文體是「${expectedGenre}」。`,
    `學生本輪回答判讀：${studentGenres.join("；")}。`,
    "回饋要求：必須明確指出文體錯誤、說明為何此題屬於正確文體，並要求學生下一輪改用正確文體判準思考。"
  ].join("\n");
}

function sanitizeStep12Feedback(raw: string, fallbackText: string): string {
  const parsed = parseStructuredStepAiResponse(raw);
  const feedback = parsed?.feedbackText ?? splitAiFeedbackAndQuestion(raw).feedbackText ?? raw;
  const normalized = normalizeFormalLlmText(feedback, { fallback: fallbackText });
  return normalized
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .replace(/^\{\s*/, "")
    .replace(/\s*\}$/, "")
    .replace(/^"+|"+$/g, "")
    .trim();
}

function buildStep12FallbackFeedback(session: SessionState, step: 1 | 2, substepKey: string): string {
  if (step === 1 && substepKey === "1-1") {
    const hint = buildStep11GenreCheckHint(session, substepKey);
    const expected = (hint.match(/本題正確文體是「([^」]+)」/) ?? [])[1];
    if (expected) {
      return `你們有開始判斷文體，方向不錯。先校正一下：這一題的文體應是「${expected}」。請下一輪用「${expected}」的判準（寫作目的與表達方式）重新確認一次，再進入後續關鍵字討論。`;
    }
  }
  const recentStudentTexts = session.messages
    .filter((message) => message.step === step && message.role === "student")
    .slice(-4)
    .map((message) => message.text.trim())
    .filter((text) => text.length > 0);
  const latestStudentSnippet =
    recentStudentTexts.length > 0
      ? recentStudentTexts[recentStudentTexts.length - 1]!.slice(0, 60)
      : "";

  const substepFeedbackMap: Record<string, string> = {
    "1-3-1": "你們已開始用例子界定題目關鍵詞，方向正確。下一輪請把例子對應到關鍵詞的判準說清楚，避免只描述情境。",
    "1-3-2": "你們已嘗試釐清關鍵詞範圍，進展很好。下一輪請明確對照「哪些算、哪些不算」並各補一個短例，讓判準更一致。",
    "1-3-3": "你們已提出初步判斷，已看到共識雛形。下一輪請補上判斷理由，說明你們為什麼把該情況歸類為算或不算。",
    "1-4-1": "你們正在把前面的討論收斂成核心主張，方向正確。請把主張寫成一句完整句，避免出現多個並列觀點。",
    "1-4-2": "你們已提出主張草稿。下一輪請再指出主張要解決的核心問題，讓立場與目的更清楚。",
    "1-4-3": "你們已接近最終主張。請再精煉句子，保留一個最核心觀點，讓讀者一看就能掌握立場。",
    "2-1-1": "你們已開始找可用例子，方向正確。下一輪請優先選擇最能支持主張、且細節清楚的例子。",
    "2-1-2": "你們已提出候選例子。下一輪請補上選擇理由，說明這個例子如何直接支持你們的主張。",
    "2-1-3": "你們已指出例子與主張的連結。下一輪請再把「最有力的那個細節」說清楚，讓論證更集中。",
    "2-2": "你們已補充部分例子內容。下一輪請把時間、人物、事件與結果交代完整，並明確連回主張句。",
    "2-3": "你們已從例子推進到原因分析，進展很好。下一輪請補上一段因果鏈，從事件到深層原因要有清楚推論。",
    "2-4": "你們已完成原因整理。下一輪請再確認案例與立場的一致性，讓整體論證更完整。"
  };

  const base = substepFeedbackMap[substepKey] ?? "你們已完成本輪回覆。下一輪請把理由與例子的連結說得更具體，讓論證更完整。";
  if (!latestStudentSnippet) return base;
  return `${base} 你們剛才提到「${latestStudentSnippet}」，這是可延伸的重點，建議沿著這個重點補強論證。`;
}

function getStep12QuestionRiskReasons(text: string): string[] {
  const reasons: string[] = [];
  const q = compactWhitespace(text);
  if (!isUsableNextQuestion(q)) reasons.push("question_not_usable");
  if (q.length < 8) reasons.push("question_too_short");
  if (!/[？?]$/.test(q)) reasons.push("question_missing_terminal_question_mark");
  if (q.includes("\n")) reasons.push("question_contains_newline");
  if (/提問規則|子步驟 Prompt|請依上一則 AI 提問作答|questionBanks|stepPrompts/i.test(q)) reasons.push("question_instruction_leak");
  return Array.from(new Set(reasons));
}

function getRandomQuestionFromBank(session: SessionState, key: string): string | undefined {
  const bank = session.promptConfig.questionBanks?.[key] ?? [];
  const candidates = bank.map((item) => item.trim()).filter((item) => item.length > 0);
  if (candidates.length === 0) return undefined;
  return candidates[Math.floor(Math.random() * candidates.length)]!;
}

function getDefaultStep12FallbackQuestion(nextSubstepKey: string): string {
  const fallbackMap: Record<string, string> = {
    "1-2": "請補充你們小組目前的立場。",
    "1-3-1": "請先用一個生活中的具體例子，說明你認為題目關鍵詞在這裡代表什麼。",
    "1-3-2": "你剛剛提到的關鍵詞，哪些情況算、哪些情況不算？請各舉一個例子。",
    "1-3-3": "請再補上一個理由，說明你怎麼判斷這個情況算或不算。",
    "1-4-1": "請根據剛才的討論，用一句話說出你們最核心、最想傳達的觀點。",
    "1-4-2": "請說明：你們的核心主張想解決的關鍵問題是什麼？",
    "1-4-3": "請再收斂一次：用一句話寫出你們最終核心主張。",
    "1-5": "請總結本步驟結論。",
    "2-1-2": "請挑一個最能支持主張的具體例子，並說明為什麼選它。",
    "2-1-3": "請說明：這個例子哪一個部分最能支持你的觀點？為什麼？",
    "2-2": "請把你的例子補充得更具體：時間、地點、人物、發生了什麼，以及它如何連回你的主張？",
    "2-3": "請再往前一步：根據你剛才的例子，推論造成這個現象的深層原因是什麼？",
    "2-4": "請補上一個具體案例，並說明它如何支持你們的立場。"
  };
  return fallbackMap[nextSubstepKey] ?? "請延伸剛才的討論，補上一個具體理由或例子。";
}

function getStep12FallbackQuestion(session: SessionState, nextSubstepKey: string): string {
  const configFallback = session.promptConfig.subStepPromptsFallbacks?.[nextSubstepKey]?.trim();
  if (configFallback) return configFallback;
  const bankQuestion = getRandomQuestionFromBank(session, nextSubstepKey);
  if (bankQuestion) return bankQuestion;
  return getDefaultStep12FallbackQuestion(nextSubstepKey);
}

function getStep12FeedbackPrompt(session: SessionState, step: 1 | 2): string {
  const prompts = session.promptConfig.step12FeedbackPrompts ?? {};
  const configured = prompts[String(step)]?.trim() || prompts.default?.trim();
  if (configured) return configured;
  return [
    "你現在只負責「回饋」，禁止新增「### **請回答以下問題**」區塊（下一題由系統第二階段產生）。",
    "回饋必須包含：1) 先肯定本輪進展；2) 指出下一輪要補強的具體點。",
    "禁止輸出空泛句（例如「已收到大家的回覆，整理得很好，請繼續下一題」或同義句）。",
    "請只輸出 JSON：{\"feedback\":\"...\"}，不要輸出其他文字。"
  ].join("\n");
}

function getStep12FeedbackFocusPrompt(session: SessionState, substepKey: string): string {
  return session.promptConfig.step12FeedbackFocusPrompts?.[substepKey]?.trim() ?? "";
}

function buildStep12FeedbackBoundaryPrompt(step: 1 | 2, currentSubstepKey: string, nextSubstepKey: string | null): string {
  const currentStepName = step === 1 ? "步驟一「審視題目」" : "步驟二「蒐集資料」";
  const bannedFutureStages =
    step === 1
      ? "禁止提到或暗示即將進入步驟二、第二階段、蒐集資料、步驟三、第三階段、生成論點。"
      : "禁止提到或暗示即將進入步驟三、第三階段、生成論點。";
  const nextBoundary = nextSubstepKey
    ? `下一步補強只能描述「目前 ${currentStepName} 內，下一個合法子步驟 ${nextSubstepKey} 要補強的內容」，不可宣告進入其他步驟或階段。`
    : `目前 ${currentStepName} 的子步驟即將收尾；只能提醒等待教師切換或整理本步驟重點，不可宣告進入其他步驟或階段。`;
  return [
    `目前流程邊界：學生仍在 ${currentStepName}，目前子步驟是 ${currentSubstepKey}。`,
    nextBoundary,
    bannedFutureStages
  ].join("\n");
}

async function generateStep12Feedback(
  session: SessionState,
  step: 1 | 2,
  userId: string,
  nextSubstepKey: string | null
): Promise<{
  feedbackText: string;
  source: "llm" | "fallback";
  llmAttempts: number;
  usedFallback: boolean;
  fallbackErrorCategory?: PersistedErrorCategory;
  fallbackDebugTrace?: Step12FallbackDebugTrace;
}> {
  const context = buildStep12StepContext(session, step, userId);
  const fallback = buildStep12FallbackFeedback(session, step, context.currentSubstepKey);
  const stepPrompt = session.promptConfig.stepPrompts[String(step)] ?? "";
  const feedbackPrompt = getStep12FeedbackPrompt(session, step);
  const feedbackFocusPrompt = getStep12FeedbackFocusPrompt(session, context.currentSubstepKey);
  const boundaryPrompt = buildStep12FeedbackBoundaryPrompt(step, context.currentSubstepKey, nextSubstepKey);
  const systemParts = [session.promptConfig.systemPrompt ?? "", stepPrompt, `目前子步驟：${context.currentSubstepKey}`]
    .filter(Boolean)
    .join("\n\n");
  const feedbackInstructions = [feedbackPrompt, boundaryPrompt, feedbackFocusPrompt ? `本子步驟回饋焦點：${feedbackFocusPrompt}` : ""]
    .filter(Boolean)
    .join("\n\n");
  const baseMessages: LlmChatMessage[] = [
    {
      role: "system",
      content: `${systemParts}\n\n${feedbackInstructions}`
    },
    {
      role: "user",
      content:
        `作文題目：${context.essayTitle}\n` +
        `目前子步驟題目：${context.currentQuestion}\n\n` +
        (context.step11GenreCheckHint ? `文體檢核補充：\n${context.step11GenreCheckHint}\n\n` : "") +
        `本步驟最近對話：\n${context.sameStepRecent || "(無)"}\n\n` +
        `課程歷史（節錄）：\n${context.crossStepContext || "(無)"}\n\n` +
        `目前事件：all members answered step ${step} substep ${context.currentSubstepKey}`
      }
  ];
  const originalPrompt = truncateForTrace(buildOriginalPromptText(baseMessages));

  if (!isLlmConfigured()) {
    return {
      feedbackText: fallback,
      source: "fallback",
      llmAttempts: 0,
      usedFallback: true,
      fallbackErrorCategory: "other",
      fallbackDebugTrace: {
        at: now(),
        step,
        kind: "step12_feedback",
        substepKey: context.currentSubstepKey,
        originalQuestion: context.currentQuestion,
        originalPrompt,
        originalResponse: "(llm_not_configured)",
        rejectionReasons: ["llm_not_configured"],
        errorCategory: "other"
      }
    };
  }

  let llmAttempts = 0;
  let fallbackErrorCategory: PersistedErrorCategory | undefined;
  let fallbackDebugTrace: Step12FallbackDebugTrace | undefined;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    llmAttempts = attempt;
    try {
      const raw = await generateAiTextWithRetry(baseMessages, 0.5, scaleTokens(700), {
        attempts: 1,
        timeoutMs: 25_000,
        continuationMaxRounds: 2,
        telemetry: { sessionId: session.id, activityId: session.activityId, step, label: "step12_feedback" }
      });
      const normalized = sanitizeStep12Feedback(raw, fallback);
      const rejectionReasons = getStep12FeedbackRiskReasons(normalized, step, context.currentSubstepKey);
      if (rejectionReasons.length === 0) {
        return { feedbackText: normalized, source: "llm", llmAttempts, usedFallback: false };
      }
      fallbackErrorCategory = fallbackErrorCategory ?? "other";
      fallbackDebugTrace = {
        at: now(),
        step,
        kind: "step12_feedback",
        substepKey: context.currentSubstepKey,
        originalQuestion: context.currentQuestion,
        originalPrompt,
        originalResponse: truncateForTrace(raw),
        rejectionReasons,
        errorCategory: "other"
      };
    } catch (error) {
      fallbackErrorCategory = classifyLlmError(error);
      fallbackDebugTrace = {
        at: now(),
        step,
        kind: "step12_feedback",
        substepKey: context.currentSubstepKey,
        originalQuestion: context.currentQuestion,
        originalPrompt,
        originalResponse: buildLlmCallFailureTraceResponse(fallbackErrorCategory, error),
        rejectionReasons: buildLlmCallFailureReasons(error),
        errorCategory: fallbackErrorCategory
      };
      // Continue to next attempt; fallback handled after loop.
    }
  }

  return {
    feedbackText: fallback,
    source: "fallback",
    llmAttempts,
    usedFallback: true,
    fallbackErrorCategory: fallbackErrorCategory ?? "other",
    fallbackDebugTrace:
      fallbackDebugTrace ??
      {
        at: now(),
        step,
        kind: "step12_feedback",
        substepKey: context.currentSubstepKey,
        originalQuestion: context.currentQuestion,
        originalPrompt,
        originalResponse: "(no_response_captured)",
        rejectionReasons: ["unknown_fallback_reason"],
        errorCategory: fallbackErrorCategory ?? "other"
      }
  };
}

async function generateStep12NextQuestion(
  session: SessionState,
  step: 1 | 2,
  userId: string,
  nextSubstepKey: string,
  feedbackText: string
): Promise<{
  nextQuestion: string;
  source: "subStepPrompt_llm" | "questionBank_random" | "fallback";
  llmAttempts: number;
  usedFallback: boolean;
  fallbackErrorCategory?: PersistedErrorCategory;
  fallbackDebugTrace?: Step12FallbackDebugTrace;
}> {
  const context = buildStep12StepContext(session, step, userId);
  const subStepPrompt = session.promptConfig.subStepPrompts?.[nextSubstepKey]?.trim() ?? "";
  if (!subStepPrompt) {
    const bankQuestion = getRandomQuestionFromBank(session, nextSubstepKey);
    if (bankQuestion) {
      return { nextQuestion: bankQuestion, source: "questionBank_random", llmAttempts: 0, usedFallback: false };
    }
    return {
      nextQuestion: getStep12FallbackQuestion(session, nextSubstepKey),
      source: "fallback",
      llmAttempts: 0,
      usedFallback: true,
      fallbackErrorCategory: "other",
      fallbackDebugTrace: {
        at: now(),
        step,
        kind: "step12_next_question",
        substepKey: nextSubstepKey,
        originalQuestion: context.currentQuestion,
        originalPrompt: "(no_llm_request_substep_prompt_missing)",
        originalResponse: "(no_llm_response_substep_prompt_missing)",
        rejectionReasons: ["substep_prompt_missing_and_question_bank_empty"],
        errorCategory: "other"
      }
    };
  }

  const fallback = getStep12FallbackQuestion(session, nextSubstepKey);
  if (!isLlmConfigured()) {
    return {
      nextQuestion: fallback,
      source: "fallback",
      llmAttempts: 0,
      usedFallback: true,
      fallbackErrorCategory: "other",
      fallbackDebugTrace: {
        at: now(),
        step,
        kind: "step12_next_question",
        substepKey: nextSubstepKey,
        originalQuestion: context.currentQuestion,
        originalPrompt: "(llm_not_configured_prompt_not_sent)",
        originalResponse: "(llm_not_configured)",
        rejectionReasons: ["llm_not_configured"],
        errorCategory: "other"
      }
    };
  }

  const stepPrompt = session.promptConfig.stepPrompts[String(step)] ?? "";
  const baseMessages: LlmChatMessage[] = [
    {
      role: "system",
      content:
        [session.promptConfig.systemPrompt ?? "", stepPrompt, `目前子步驟：${nextSubstepKey}`, `子步驟 Prompt（${nextSubstepKey}）：\n${subStepPrompt}`]
          .filter(Boolean)
          .join("\n\n") +
        '\n\n你現在只負責產生「下一題」。請只輸出 JSON：{"nextQuestion":"..."}，不要輸出其他文字。'
    },
    {
      role: "user",
      content:
        `作文題目：${context.essayTitle}\n` +
        `前一題：${context.currentQuestion}\n` +
        `AI 回饋：${feedbackText}\n\n` +
        `本步驟最近對話：\n${context.sameStepRecent || "(無)"}\n\n` +
        `請產生下一題（僅一個完整問句，需以「？」結尾）。`
    }
  ];
  const originalPrompt = truncateForTrace(buildOriginalPromptText(baseMessages));

  let llmAttempts = 0;
  let fallbackErrorCategory: PersistedErrorCategory | undefined;
  let fallbackDebugTrace: Step12FallbackDebugTrace | undefined;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    llmAttempts = attempt;
    try {
      const raw = await generateAiTextWithRetry(baseMessages, 0.4, scaleTokens(320), {
        attempts: 1,
        timeoutMs: 20_000,
        continuationMaxRounds: 1,
        telemetry: { sessionId: session.id, activityId: session.activityId, step, label: "step12_next_question" }
      });
      const parsed = parseStructuredStepAiResponse(raw) ?? splitAiFeedbackAndQuestion(raw);
      const nextQuestion = compactWhitespace(parsed.nextQuestion ?? "");
      const rejectionReasons = getStep12QuestionRiskReasons(nextQuestion);
      if (rejectionReasons.length === 0) {
        return { nextQuestion, source: "subStepPrompt_llm", llmAttempts, usedFallback: false };
      }
      fallbackErrorCategory = fallbackErrorCategory ?? "other";
      fallbackDebugTrace = {
        at: now(),
        step,
        kind: "step12_next_question",
        substepKey: nextSubstepKey,
        originalQuestion: context.currentQuestion,
        originalPrompt,
        originalResponse: truncateForTrace(raw),
        rejectionReasons,
        errorCategory: "other"
      };
    } catch (error) {
      fallbackErrorCategory = classifyLlmError(error);
      fallbackDebugTrace = {
        at: now(),
        step,
        kind: "step12_next_question",
        substepKey: nextSubstepKey,
        originalQuestion: context.currentQuestion,
        originalPrompt,
        originalResponse: buildLlmCallFailureTraceResponse(fallbackErrorCategory, error),
        rejectionReasons: buildLlmCallFailureReasons(error),
        errorCategory: fallbackErrorCategory
      };
      // Continue to retry.
    }
  }

  return {
    nextQuestion: fallback,
    source: "fallback",
    llmAttempts,
    usedFallback: true,
    fallbackErrorCategory: fallbackErrorCategory ?? "other",
    fallbackDebugTrace:
      fallbackDebugTrace ??
      {
        at: now(),
        step,
        kind: "step12_next_question",
        substepKey: nextSubstepKey,
        originalQuestion: context.currentQuestion,
        originalPrompt,
        originalResponse: "(no_response_captured)",
        rejectionReasons: ["unknown_fallback_reason"],
        errorCategory: fallbackErrorCategory ?? "other"
      }
  };
}

function appendStep12RoundLog(session: SessionState, log: Step12RoundLog): void {
  session.step12RoundLogs = session.step12RoundLogs ?? [];
  session.step12RoundLogs.push(log);
  if (session.step12RoundLogs.length > 60) {
    session.step12RoundLogs.splice(0, session.step12RoundLogs.length - 60);
  }
}

function appendStep12FallbackDebugTrace(session: SessionState, trace: Step12FallbackDebugTrace): void {
  session.step12FallbackDebugTraces = session.step12FallbackDebugTraces ?? [];
  session.step12FallbackDebugTraces.push(trace);
  if (session.step12FallbackDebugTraces.length > 120) {
    session.step12FallbackDebugTraces.splice(0, session.step12FallbackDebugTraces.length - 120);
  }
}

async function generateAiTextForStep(
  session: SessionState,
  step: number,
  contextText: string,
  userId?: string,
  retryOptions?: { attempts?: number; timeoutMs?: number; continueOnTruncation?: boolean; continuationMaxRounds?: number }
): Promise<string> {
  const stepName = getStepName(step);
  const fallback =
    step === 3
      ? "AI（生成論點）回覆：已收到你的提問。請先整理一個清楚主張，並列出 2-3 個支持重點，把它們放進結構樹節點。"
      : `AI（${stepName}）回覆：已收到本輪回覆。請依目前步驟目標繼續討論。`;
  if (!isLlmConfigured()) {
    return fallback;
  }

  const substepKey = getCurrentSubstepKey(session, step);
  // Cached system prompt assembly (#243): the assembled system message is fully
  // determined by promptConfig (immutable per session) + step + substepKey, so we
  // memoize on session.systemPromptCache to avoid rebuilding on every LLM call.
  const cacheKey = substepKey ? `${step}:${substepKey}` : String(step);
  session.systemPromptCache = session.systemPromptCache ?? {};
  let systemMessageContent = session.systemPromptCache[cacheKey];
  if (!systemMessageContent) {
    const systemParts: string[] = [];
    if (session.promptConfig.systemPrompt) systemParts.push(session.promptConfig.systemPrompt);
    const stepPrompt = session.promptConfig.stepPrompts[String(step)];
    if (stepPrompt) systemParts.push(stepPrompt);
    if (substepKey) {
      const substepPrompt = session.promptConfig.subStepPrompts[substepKey];
      const questionBank = session.promptConfig.questionBanks[substepKey];
      systemParts.push(`目前子步驟：${substepKey}`);
      if (substepPrompt) {
        systemParts.push(`子步驟 Prompt（${substepKey}）：\n${substepPrompt}`);
      }
      if (questionBank && questionBank.length > 0) {
        systemParts.push(`子步驟問題庫（${substepKey}）：\n${questionBank.map((q, i) => `${i + 1}. ${q}`).join("\n")}`);
      }
    }
    systemParts.push(`目前步驟：${step}（${stepName}）。請嚴格遵守步驟與輸出格式要求。`);
    if (step === 1 || step === 2) {
      systemParts.push(
        `Step1/2 請只輸出 JSON，不要加 Markdown code fence 或額外說明。格式：{"feedback":"給全組的簡短回饋","nextQuestion":"下一題要問學生的一句完整問題"}。feedback 與 nextQuestion 都必須是繁體中文；nextQuestion 不可空白、不可照抄 prompt、不可寫「請依上一則 AI 提問作答」。`
      );
    }
    systemMessageContent = systemParts.join("\n\n");
    session.systemPromptCache[cacheKey] = systemMessageContent;
  }
  const scopedSteps = new Set([1, 2, 3, 4, 6, 8, 9]);
  const scopedUserId = userId && scopedSteps.has(step) ? userId : undefined;
  const crossStepContext = scopedUserId
    ? buildStudentCourseContext(session, scopedUserId, step, { maxMessages: 48, maxChars: 13000, includeSystem: true })
    : "";
  const sameStepRecent = session.messages
    .filter((m) => m.step === step)
    .slice(-10)
    .map((m) => {
      if (m.role === "student") return `學生${m.userId ? `(${m.userId})` : ""}：${m.text}`;
      if (m.role === "ai") return `AI：${m.text}`;
      return `系統：${m.text}`;
    })
    .join("\n");
  const essayTitle = session.activityTitle?.trim() || "未命名題目";
  const messages: LlmChatMessage[] = [
    { role: "system", content: systemMessageContent },
    {
      role: "user",
      content:
        `作文題目：${essayTitle}\n\n` +
        `以下是本步驟最近對話內容：\n${sameStepRecent || "(無)"}\n\n` +
        (scopedUserId
          ? `以下是該學生從 Step1 到目前步驟的歷史互動（僅本人 student/ai/必要 system，已做長度限制）：\n${crossStepContext || "(無)"}\n\n`
          : "") +
        `目前事件：${contextText}\n\n` +
        (step === 3
          ? "請依據 stepPrompts[3] 的角色、目標與輸出格式，僅針對學生提問給出回覆與建議。禁止主動提問、禁止要求學生再回答新問題。請用自然、擬人化、像老師與學生對話的語氣回覆，不要使用生硬標題或固定模板標籤（例如「指出問題」「提示說明」）。"
          : step === 1 || step === 2
            ? "請根據最新一輪組員回覆，產出 JSON 格式的回饋與下一題。只輸出 JSON 物件，不要輸出其他文字。"
            : "請根據最新一輪組員回覆，產出本步驟應給學生的下一則引導回覆。")
    }
  ];

  try {
    // Token budgets by step (#239): tighter limits for short conversational steps,
    // generous budget only for long-form content (article suggestions, analyses).
    const maxTokensByStep =
      step === 1 || step === 2
        ? scaleTokens(700) // group dialog feedback JSON (allow enough room for complete feedback + question)
        : step === 3
          ? scaleTokens(600) // tutor reply (typically short)
          : step === 4
            ? scaleTokens(800) // group discussion guidance
            : scaleTokens(1200); // long-form steps (6/7/8/9/10)
    // Step 4 keeps single-round response for latency; Step 1/2 use extra continuation
    // to avoid truncated feedback at substep boundaries (e.g., 2-3 -> 2-4).
    const shortStep = step === 4;
    const continuationMaxRounds = step === 1 || step === 2 ? 3 : shortStep ? 0 : 1;
    return await generateAiTextWithRetry(messages, 0.6, maxTokensByStep, {
      continueOnTruncation: !shortStep,
      continuationMaxRounds,
      telemetry: { sessionId: session.id, activityId: session.activityId, step, label: "step_ai_reply" },
      ...retryOptions
    });
  } catch {
    return fallback;
  }
}

async function generateLegacyAiText(session: SessionState, step: number, contextText: string): Promise<string> {
  const fallback = `AI(Phase${step})：收到你的訊息「${contextText.slice(0, 80)}${contextText.length > 80 ? "..." : ""}」，請繼續。`;
  if (!isLlmConfigured()) {
    return fallback;
  }
  const messages: LlmChatMessage[] = [
    {
      role: "system",
      content:
        session.promptConfig.systemPrompt ??
        "你是一位引導式寫作的作文老師，請使用繁體中文，以鼓勵與提問方式引導學生。"
    },
    { role: "user", content: `目前 Phase${step}。學生訊息：${contextText}` }
  ];
  try {
    return await llmChatCompletionText({
      messages,
      temperature: 0.6,
      maxTokens: scaleTokens(400),
      telemetry: { sessionId: session.id, activityId: session.activityId, step, label: "legacy_phase_reply" }
    });
  } catch {
    return fallback;
  }
}

function buildStep5FallbackSummary(session: SessionState, userId: string): string {
  const relevant = session.messages
    .filter((m) => m.step >= 1 && m.step <= 4 && (m.role === "system" || m.role === "ai" || (m.role === "student" && m.userId === userId)))
    .slice(-24);
  const brief = relevant
    .map((m) => {
      if (m.role === "student") return `學生(${userId})：${m.text}`;
      if (m.role === "ai") return `AI：${m.text}`;
      return `系統：${m.text}`;
    })
    .join("\n");
  return `### **讚美與鼓勵**\n你在前四個步驟有持續投入，已建立自己的寫作方向。\n\n### **我們討論了什麼**\n${brief || "目前尚無足夠資料。"}\n\n### **我們學到了什麼**\n接下來可把以上重點整理成段落主張與例子，進入初稿撰寫。`;
}

function buildStep7Report(session: SessionState, userId: string): string {
  const essay = session.draftStep6[userId] ?? "(尚未撰寫初稿)";
  return `步驟 7 分析回饋（${userId}）\n初稿：${essay}\n建議：請加強論點與例證的連結。`;
}

function buildStep10Report(session: SessionState, userId: string): string {
  const essay = session.draftStep8[userId] ?? session.draftStep6[userId] ?? "(尚未提交作文)";
  return `步驟 10 總結報告（${userId}）\n最終稿：${essay}\n總評：結構已改善，建議再精煉結語。`;
}

function buildFullCourseContextForUser(session: SessionState, userId: string): string {
  const relevant = session.messages
    .filter((m) => {
      if (m.role === "teacher") return false;
      if (m.role === "student") return m.userId === userId;
      if (m.role === "ai") return !m.userId || m.userId === userId;
      if (m.role === "system") return !m.userId || m.userId === userId;
      return false;
    })
    .slice(-80);

  return relevant
    .map((m) => {
      if (m.role === "student") return `S${m.step}-學生(${userId})：${m.text}`;
      if (m.role === "ai") return `S${m.step}-AI：${m.text}`;
      return `S${m.step}-系統：${m.text}`;
    })
    .join("\n");
}

function buildStep1To4PersonalContextForUser(session: SessionState, userId: string): string {
  const relevant = session.messages
    .filter((m) => {
      if (m.step < 1 || m.step > 4) return false;
      if (m.role === "teacher") return false;
      if (m.role === "student") return m.userId === userId;
      if (m.role === "system" || m.role === "ai") return true;
      return false;
    })
    .slice(-120);

  return relevant
    .map((m) => {
      if (m.role === "student") return `S${m.step}-學生(${userId})：${m.text}`;
      if (m.role === "ai") return `S${m.step}-AI：${m.text}`;
      return `S${m.step}-系統：${m.text}`;
    })
    .join("\n");
}

function buildStep5LlmInput(
  session: SessionState,
  userId: string
): { messages: LlmChatMessage[]; fallback: string } {
  const fallback = buildStep5FallbackSummary(session, userId);
  const systemParts: string[] = [];
  if (session.promptConfig.systemPrompt) systemParts.push(session.promptConfig.systemPrompt);
  const step5Prompt = session.promptConfig.stepPrompts["5"];
  if (step5Prompt) systemParts.push(step5Prompt);
  systemParts.push("請只輸出步驟五摘要報告，不要輸出 JSON。");

  const personalContext = buildStep1To4PersonalContextForUser(session, userId);
  const messages: LlmChatMessage[] = [
    { role: "system", content: systemParts.join("\n\n") },
    {
      role: "user",
      content:
        `學生帳號：${userId}\n` +
        `作文題目：${session.activityTitle?.trim() || "未命名題目"}\n` +
        `題目說明：${session.activityEssayDescription?.trim() || "(無)"}\n` +
        `補充資料：${session.activitySupplemental?.trim() || "(無)"}\n\n` +
        `以下是這位學生在本課程 Step1-4 的個人互動歷程（含系統引導、互動題目、AI 回饋與該學生回應；不含同組其他同學發言）：\n` +
        `${personalContext || "(無)"}\n\n` +
        "請依照步驟五格式輸出摘要報告。"
    }
  ];

  return { messages, fallback };
}

async function generateStep5SummaryForUser(session: SessionState, userId: string): Promise<string> {
  const { messages, fallback } = buildStep5LlmInput(session, userId);
  if (!isLlmConfigured()) return fallback;
  try {
    const raw = await generateAiTextWithRetry(messages, 0.6, scaleTokens(1200), {
      continuationMaxRounds: 4,
      telemetry: { sessionId: session.id, activityId: session.activityId, step: 5, label: "step5_summary" }
    });
    const first = normalizeStep5Summary(normalizeFormalLlmText(raw, { fallback }));
    if (!hasFormalLlmQualityRisk(first)) return first;

    const retryRaw = await generateAiTextWithRetry(
      [
        ...messages,
        {
          role: "user",
          content:
            "請重新輸出完整且正式的摘要報告：不得重複句段、不得提到截斷或續寫過程、每句要完整收尾。"
        }
      ],
      0.5,
      scaleTokens(1400),
      { continuationMaxRounds: 6, telemetry: { sessionId: session.id, activityId: session.activityId, step: 5, label: "step5_summary_retry" } }
    );
    return normalizeStep5Summary(normalizeFormalLlmText(retryRaw, { fallback }));
  } catch {
    return fallback;
  }
}

/**
 * Builds the LLM input + fallback text for the Step 10 final report.
 * Exported so the streaming endpoint (#241) can reuse the same prompt structure.
 */
export function buildStep10LlmInput(
  session: SessionState,
  userId: string
): { messages: LlmChatMessage[]; fallback: string } {
  const fallback = buildStep10Report(session, userId);
  const reportConfig = resolveStep10ReportConfig(session.promptConfig.step10Report);
  const systemParts: string[] = [];
  if (session.promptConfig.systemPrompt) systemParts.push(session.promptConfig.systemPrompt);
  systemParts.push(reportConfig.baseInstruction);
  systemParts.push(
    "Step10 的章節標題由系統程式統一加入。LLM 回覆時不得自行輸出標題、Markdown 標題、粗體符號或完整報告格式。"
  );

  const fullContext = buildFullCourseContextForUser(session, userId);
  const finalEssay = session.draftStep8[userId] ?? session.draftStep6[userId] ?? "(尚未提交作文)";
  const messages: LlmChatMessage[] = [
    { role: "system", content: systemParts.join("\n\n") },
    {
      role: "user",
      content:
        `學生帳號：${userId}\n` +
        `最終作文內容：\n${finalEssay}\n\n` +
        `學生完整歷程紀錄（含前序步驟）：\n${fullContext || "(無)"}\n\n` +
        "請輸出步驟 10 的總結報告。"
    }
  ];
  return { messages, fallback };
}

async function generateStep10Report(session: SessionState, userId: string): Promise<string> {
  const { messages, fallback } = buildStep10LlmInput(session, userId);
  if (!isLlmConfigured()) {
    return fallback;
  }
  return generateStep10ReportChunkedText(messages, fallback, session.promptConfig.step10Report, {
    sessionId: session.id,
    activityId: session.activityId,
    step: 10,
    label: "step10_report"
  });
}

export async function generateStep10ReportChunkedText(
  messages: LlmChatMessage[],
  fallback: string,
  config: SessionState["promptConfig"]["step10Report"],
  telemetry: { sessionId?: string; activityId?: string; step?: number; label?: string }
): Promise<string> {
  const reportConfig = resolveStep10ReportConfig(config);
  const allTitles = reportConfig.sections.map((section) => section.title);
  try {
    const sections: Array<{ title: string; body: string }> = [];
    for (let index = 0; index < reportConfig.sections.length; index += 1) {
      const section = reportConfig.sections[index]!;
      const sectionRaw = await generateAiTextWithRetry(
        [
          ...messages,
          {
            role: "user",
            content: buildStep10SectionPrompt(reportConfig.sectionPromptTemplate, section)
          }
        ],
        0.5,
        scaleTokens(620),
        {
          continuationMaxRounds: 4,
          telemetry: { ...telemetry, label: `${telemetry.label ?? "step10_report"}:section_${index + 1}` }
        }
      );
      const normalizedSection = normalizeStep10SectionBody(
        normalizeFormalLlmText(sectionRaw, { fallback: `${section.title}：${fallback}` }),
        section.title,
        allTitles
      );
      sections.push({ title: section.title, body: normalizedSection });
    }

    const stitched = composeStep10Report(sections, reportConfig.completionReminder);
    if (!hasFormalLlmQualityRisk(stitched)) return stitched;

    const retryRaw = await generateAiTextWithRetry(
      [
        ...messages,
        {
          role: "user",
          content: `${reportConfig.finalPolishPrompt}\n\n${stitched}`
        }
      ],
      0.4,
      scaleTokens(1600),
      {
        continuationMaxRounds: 7,
        telemetry: { ...telemetry, label: `${telemetry.label ?? "step10_report"}:final_retry` }
      }
    );
    return normalizeStep10SectionBody(normalizeFormalLlmText(retryRaw, { fallback: stitched || fallback }), "", []);
  } catch {
    return fallback;
  }
}

/**
 * Records a Step 10 report onto the session: stores the AI text and pushes the AI
 * message into the messages stream. Used by the streaming endpoint (#241) after
 * collecting all SSE chunks.
 */
export function recordStep10Report(session: SessionState, userId: string, report: string): void {
  session.reports.step10[userId] = report;
  session.messages.push(makeMessage({ role: "ai", userId, step: 10, text: report }));
}

/**
 * Marks a user as having completed Step 9 and bumps their personal step to 10.
 *
 * Behavior controlled by `options.generateReport`:
 * - `true` (default, used by reconcile/recovery path): synchronously generates the
 *   Step 10 report via a non-streaming LLM call and pushes the AI message.
 * - `false` (used by the chat/send fast path #241): leaves report generation to a
 *   subsequent streaming call to `/api/session/step10/stream`.
 */
async function finalizeStep9ForUser(
  session: SessionState,
  userId: string,
  options: { generateReport?: boolean } = {}
): Promise<void> {
  session.personalSteps = session.personalSteps ?? {};
  session.personalSteps[userId] = 10;
  const generateReport = options.generateReport ?? true;
  if (!generateReport) return;
  const step10Report = sanitizeStudentFacingText(await generateStep10Report(session, userId));
  session.reports.step10[userId] = step10Report;
  session.messages.push(makeMessage({ role: "ai", userId, step: 10, text: step10Report }));
}

export async function reconcileCompletedStep9Users(session: SessionState): Promise<boolean> {
  normalizeSessionRuntimeShape(session);
  const step9Questions = getStep9Questions(session);
  const STEP10_RECONCILE_CONCURRENCY = 3;
  let changed = false;
  const needsReportUsers: string[] = [];
  for (const participant of session.participants) {
    const userStep = session.personalSteps?.[participant] ?? session.currentStep;
    const answeredCount = session.reflectionIndex?.[participant] ?? 0;
    if (userStep !== 9 || answeredCount < step9Questions.length) continue;

    const hasStep10Report = Boolean(session.reports.step10?.[participant]?.trim());
    if (!hasStep10Report) {
      session.personalSteps![participant] = 10;
      needsReportUsers.push(participant);
    } else {
      session.personalSteps![participant] = 10;
    }
    changed = true;
  }

  if (needsReportUsers.length > 0) {
    const reports = await mapWithConcurrency(
      needsReportUsers,
      STEP10_RECONCILE_CONCURRENCY,
      async (userId) => sanitizeStudentFacingText(await generateStep10Report(session, userId))
    );
    needsReportUsers.forEach((userId, index) => {
      const step10Report = reports[index]!;
      session.reports.step10[userId] = step10Report;
      session.messages.push(makeMessage({ role: "ai", userId, step: 10, text: step10Report }));
    });
  }
  return changed;
}

// --- existing non-LLM report builders below ---

export async function switchStep(session: SessionState, step: number): Promise<SessionState> {
  normalizeSessionRuntimeShape(session);
  if (!STEP_DEFINITIONS.find((s) => s.step === step)) {
    throw new Error(`invalid_step:${step}`);
  }

  session.currentStep = step;
  session.participants.forEach((participant) => {
    session.personalSteps![participant] = step;
  });
  if (step >= 4) {
    const doneUsers = new Set(session.groupGate["3-complete"] ?? []);
    session.participants.forEach((participant) => {
      if (!doneUsers.has(participant)) return;
      const snapshot = session.step3SubmittedOutlines?.[participant]?.trim() ?? "";
      const outline = session.outlines[participant]?.trim() ?? "";
      if (!snapshot && outline) {
        session.step3SubmittedOutlines![participant] = outline;
      }
    });
  }
  session.messages.push(
    makeMessage({
      role: "teacher",
      step,
      text: `Teacher switched class to step ${step} ${getStepName(step)}.`
    })
  );

  if (isLegacy(session)) {
    session.messages.push(
      makeMessage({
        role: "system",
        step,
        text: `已切換到 Phase${step}。`
      })
    );
    return session;
  }

  initializeStepQuestion(session, step);

  const mode = getModeByStep(step);
  if (mode === "non_interactive") {
    if (step === 5) {
      const STEP5_CONCURRENCY = 4;
      const summaries = await mapWithConcurrency(
        session.participants,
        STEP5_CONCURRENCY,
        async (participant) => generateStep5SummaryForUser(session, participant)
      );
      session.participants.forEach((participant, idx) => {
        const summary = summaries[idx]!;
        session.reports.step5[participant] = summary;
        session.messages.push(makeMessage({ role: "ai", userId: participant, step, text: summary }));
      });
    }

    if (step === 7) {
      session.participants.forEach((participant) => {
        session.reports.step7[participant] = buildStep7Report(session, participant);
      });
      session.messages.push(makeMessage({ role: "ai", step, text: "步驟 7 分析回饋已生成。" }));
    }

    if (step === 10) {
      session.participants.forEach((participant) => {
        session.reports.step10[participant] = buildStep10Report(session, participant);
      });
      session.messages.push(makeMessage({ role: "ai", step, text: "步驟 10 總結報告已生成。" }));
    }
  }

  if (mode === "personal_reflection") {
    const step9Questions = getStep9Questions(session);
    session.messages.push(
      makeMessage({ role: "system", step, text: buildStep9BatchPrompt(step9Questions) })
    );
  }

  return session;
}

export function advanceLegacyPhase(session: SessionState): SessionState {
  if (!isLegacy(session)) {
    throw new Error("not_legacy_session");
  }

  if (session.currentStep >= session.phaseMax) {
    session.messages.push(makeMessage({ role: "system", step: session.currentStep, text: "已達最後階段。" }));
    return session;
  }

  session.currentStep += 1;
  session.messages.push(makeMessage({ role: "system", step: session.currentStep, text: `進入 Phase${session.currentStep}。` }));
  return session;
}

type SendMessageHooks = {
  onBeforeGroupAi?: (session: SessionState) => Promise<void> | void;
};

export async function sendStudentMessage(
  session: SessionState,
  userId: string,
  text: string,
  stepOverride?: number,
  hooks?: SendMessageHooks
): Promise<SessionState> {
  normalizeSessionRuntimeShape(session);
  const step = stepOverride ?? session.currentStep;
  const participants = ensureParticipants(session, userId);

  if (!participants.includes(userId)) {
    throw new Error("unknown_participant");
  }

  if (isLegacy(session)) {
    session.messages.push(makeMessage({ role: "student", userId, step, text }));
    session.messages.push(makeMessage({ role: "ai", step, text: await generateLegacyAiText(session, step, text) }));
    return session;
  }

  const mode = getModeByStep(step);
  if (mode === "non_interactive") {
    throw new Error("step_non_interactive");
  }

  const validationError =
    step === 1 || step === 2
      ? validateStudentAnswerSimple(session, userId, step, text)
      : validateStudentAnswer(session, userId, step, text);
  if (validationError) {
    const rejectionScope = step === 1 || step === 2 ? getCurrentGroupGateKey(session, step as 1 | 2) : `step-${step}`;
    const rejectedAt = now();
    recordRejectedAnswerSignal(session, userId, rejectionScope, rejectedAt);
    void recordLearningEvent({
      sessionId: session.id,
      activityId: session.activityId,
      step,
      kind: "student_rejection",
      fallbackUsed: false,
      createdAt: rejectedAt
    }).catch(() => undefined);
    throw new Error(validationError);
  }

  if (step === 1 || step === 2) {
    const result = handleStep1Or2Group(session, userId, text, makeMessage);
    if (result.allResponded) {
      const completedGateKey = getCurrentGroupGateKey(result.session, step as 1 | 2);
      const roundKey = `${step}:${completedGateKey}`;
      result.session.step12RoundState = result.session.step12RoundState ?? { completedGateKeys: [] };
      result.session.step12RoundState.completedGateKeys = result.session.step12RoundState.completedGateKeys ?? [];

      if (result.session.step12RoundState.completedGateKeys.includes(roundKey)) {
        return result.session;
      }
      if (result.session.step12RoundState.inFlightGateKey === roundKey) {
        return result.session;
      }

      const lockKey = `${result.session.id}:${roundKey}`;
      if (step12RoundLocks.has(lockKey)) {
        return result.session;
      }

      step12RoundLocks.add(lockKey);
      result.session.step12RoundState.inFlightGateKey = roundKey;
      const startedAt = Date.now();
      try {
        if (hooks?.onBeforeGroupAi) {
          await hooks.onBeforeGroupAi(result.session);
        }

        const nextSubStepKey = getNextSubstepKeyAfterCompletion(result.session, step as 1 | 2, result.substep);
        const feedbackResult = await generateStep12Feedback(result.session, step as 1 | 2, userId, nextSubStepKey);
        result.session.messages.push(
          makeMessage({
            role: "ai",
            step,
            text: feedbackResult.feedbackText
          })
        );

        let questionSource: "subStepPrompt_llm" | "questionBank_random" | "fallback" = "fallback";
        let llmAttemptCountQuestion = 0;
        let questionUsedFallback = false;
        let questionFallbackErrorCategory: PersistedErrorCategory | undefined;
        let questionFallbackDebugTrace: Step12FallbackDebugTrace | undefined;
        let nextQuestion: string | undefined;

        if (nextSubStepKey) {
          const questionResult = await generateStep12NextQuestion(
            result.session,
            step as 1 | 2,
            userId,
            nextSubStepKey,
            feedbackResult.feedbackText
          );
          questionSource = questionResult.source;
          llmAttemptCountQuestion = questionResult.llmAttempts;
          questionUsedFallback = questionResult.usedFallback;
          questionFallbackErrorCategory = questionResult.fallbackErrorCategory;
          questionFallbackDebugTrace = questionResult.fallbackDebugTrace;
          nextQuestion = questionResult.nextQuestion;
        }

        result.session.groupGate[completedGateKey] = [];
        advanceStep1Or2SubstepAfterAi(result.session, step as 1 | 2, result.substep, nextQuestion, makeMessage);

        result.session.step12RoundState.completedGateKeys.push(roundKey);
        if (result.session.step12RoundState.completedGateKeys.length > 120) {
          result.session.step12RoundState.completedGateKeys.splice(
            0,
            result.session.step12RoundState.completedGateKeys.length - 120
          );
        }

        const roundCompletedAt = now();
        const roundLatencyMs = Date.now() - startedAt;
        appendStep12RoundLog(result.session, {
          currentStep: step,
          currentSubStep: completedGateKey,
          nextSubStep: nextSubStepKey ?? "(end)",
          feedbackSource: feedbackResult.source,
          questionSource,
          llmAttemptCountFeedback: feedbackResult.llmAttempts,
          llmAttemptCountQuestion,
          usedFallback: feedbackResult.usedFallback || questionUsedFallback,
          latencyMs: roundLatencyMs,
          at: roundCompletedAt
        });
        void recordLearningEvent({
          sessionId: result.session.id,
          activityId: result.session.activityId,
          step,
          kind: "step12_round",
          latencyMs: roundLatencyMs,
          fallbackUsed: feedbackResult.usedFallback || questionUsedFallback,
          errorCategory:
            feedbackResult.usedFallback || questionUsedFallback
              ? (feedbackResult.fallbackErrorCategory ?? questionFallbackErrorCategory ?? "other")
              : undefined,
          createdAt: roundCompletedAt
        }).catch(() => undefined);
        if (feedbackResult.usedFallback) {
          if (feedbackResult.fallbackDebugTrace) {
            appendStep12FallbackDebugTrace(result.session, feedbackResult.fallbackDebugTrace);
          }
          void recordLearningEvent({
            sessionId: result.session.id,
            activityId: result.session.activityId,
            step,
            kind: "step12_feedback",
            fallbackUsed: true,
            errorCategory: feedbackResult.fallbackErrorCategory ?? "other",
            createdAt: roundCompletedAt
          }).catch(() => undefined);
        }
        if (questionUsedFallback) {
          if (questionFallbackDebugTrace) {
            appendStep12FallbackDebugTrace(result.session, questionFallbackDebugTrace);
          }
          void recordLearningEvent({
            sessionId: result.session.id,
            activityId: result.session.activityId,
            step,
            kind: "step12_next_question",
            fallbackUsed: true,
            errorCategory: questionFallbackErrorCategory ?? "other",
            createdAt: roundCompletedAt
          }).catch(() => undefined);
        }
      } finally {
        if (result.session.step12RoundState?.inFlightGateKey === roundKey) {
          result.session.step12RoundState.inFlightGateKey = undefined;
        }
        step12RoundLocks.delete(lockKey);
      }
    }
    return result.session;
  }

  if (step === 4) {
    const completedUsers = new Set(session.groupGate["4-complete"] ?? []);
    if (completedUsers.has(userId)) {
      throw new Error("step4_already_completed");
    }
    const step4ModerationError = validateStep4DiscussionMessage(text);
    if (step4ModerationError) {
      throw new Error(step4ModerationError);
    }
    session.messages.push(makeMessage({ role: "student", userId, step, text }));
    return session;
  }

  session.messages.push(makeMessage({ role: "student", userId, step, text }));

  if (mode === "personal_interaction") {
    const aiText = sanitizeStudentFacingText(await generateAiTextForStep(session, step, text, userId));
    session.messages.push(makeMessage({ role: "ai", userId, step, text: aiText }));
    return session;
  }

  if (mode === "group_interaction") {
    const gateKey = `${step}-1`;
    const responders = new Set(session.groupGate[gateKey] ?? []);
    responders.add(userId);
    session.groupGate[gateKey] = Array.from(responders);

    const allResponded = session.participants.every((participant) => responders.has(participant));
    if (allResponded) {
      const aiText = sanitizeStudentFacingText(await generateAiTextForStep(session, step, "all group members replied"));
      session.messages.push(
        makeMessage({ role: "ai", step, text: aiText })
      );
      session.groupGate[gateKey] = [];
    }
    return session;
  }

  if (mode === "personal_reflection") {
    const step9Questions = getStep9Questions(session);
    const answers = new Map<number, string>();
    const pattern = /Q([1-4])\s*:\s*([\s\S]*?)(?=\nQ[1-4]\s*:|$)/g;
    for (const match of text.matchAll(pattern)) {
      const idx = Number(match[1]);
      const body = (match[2] ?? "").trim();
      if (idx >= 1 && idx <= 4) {
        answers.set(idx, body);
      }
    }
    if (answers.size !== 4) {
      throw new Error("請一次完整回答四題（Q1~Q4）後再送出。");
    }

    const lowEffortPatterns = /^(不知道|不會|隨便|沒意見|無|沒有|\.{2,}|。{2,}|哈+|呵+|lol)$/i;
    for (let i = 1; i <= 4; i += 1) {
      const answer = (answers.get(i) ?? "").trim();
      const question = step9Questions[i - 1] ?? "";
      if (answer.length < 8) {
        throw new Error(`第 ${i} 題需要再具體一些（內容太短），請補強後再送出。`);
      }
      if (lowEffortPatterns.test(answer)) {
        throw new Error(`第 ${i} 題看起來比較像敷衍作答，請再認真補強。`);
      }
      const normalizedQuestion = normalizeForCompare(question);
      const normalizedAnswer = normalizeForCompare(answer);
      if (normalizedAnswer && normalizedQuestion && normalizedAnswer === normalizedQuestion) {
        throw new Error(`第 ${i} 題目前像是貼上題目本身，請用自己的話作答。`);
      }
    }

    session.reflectionIndex[userId] = step9Questions.length;
    session.messages.push(makeMessage({ role: "system", userId, step, text: "個人反思完成。" }));
    // Defer Step 10 report generation to the streaming endpoint (#241).
    // The frontend will detect personalSteps[user] === 10 with no report and call
    // /api/session/step10/stream to get an SSE-streamed report.
    await finalizeStep9ForUser(session, userId, { generateReport: false });
    return session;
  }

  return session;
}
