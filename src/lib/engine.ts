import { randomUUID } from "node:crypto";
import { ChatMessage, SessionState, StartSessionPayload } from "@/src/lib/types";
import { STEP_DEFINITIONS, getModeByStep, getStepName } from "@/src/lib/spec";
import { isLlmConfigured, llmChatCompletionText, LlmChatMessage } from "@/src/lib/llm-client";
import { buildStudentCourseContext } from "@/src/lib/llm-context";
import { normalizeForCompare, validateStudentAnswer, validateStudentAnswerSimple } from "@/src/lib/answer-validation";
import { recordRejectedAnswerSignal } from "@/src/lib/learning-diagnostics";
import { sanitizeStudentFacingText, splitAiFeedbackAndQuestion } from "@/src/lib/llm-response";
import { buildStep1Question, buildStep2Question, buildStep9BatchPrompt, getCurrentGroupGateKey, getCurrentSubstepKey, getStep9Questions } from "@/src/lib/workflow-questions";
import { advanceStep1Or2SubstepAfterAi, handleStep1Or2Group, isNextQuestionSubStepPromptDriven } from "@/src/lib/workflow-step1-2";

function now(): string {
  return new Date().toISOString();
}

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

async function generateAiTextWithRetry(
  messages: LlmChatMessage[],
  temperature: number,
  maxTokens: number,
  options: { attempts?: number; timeoutMs?: number; continueOnTruncation?: boolean; continuationMaxRounds?: number } = {}
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
        continuationMaxRounds: options.continuationMaxRounds
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

async function generateStep1Or2AiWithQuestionRetry(
  session: SessionState,
  step: 1 | 2,
  contextText: string,
  userId: string
): Promise<{ feedbackText: string; nextQuestion?: string }> {
  let lastParsed: { feedbackText: string; nextQuestion?: string } = {
    feedbackText: "已收到大家的回覆。",
    nextQuestion: undefined
  };

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const aiRaw = await generateAiTextForStep(session, step, contextText, userId, { attempts: 1, timeoutMs: 25_000 });
    const parsed = splitAiFeedbackAndQuestion(aiRaw);
    lastParsed = parsed;
    if (parsed.nextQuestion?.trim()) {
      return parsed;
    }
    if (attempt < 3) {
      await new Promise((resolve) => setTimeout(resolve, 120));
    }
  }

  return lastParsed;
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
    ? buildStudentCourseContext(session, scopedUserId, step, { maxMessages: 48, maxChars: 6500, includeSystem: true })
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
        ? 700 // group dialog feedback JSON (allow enough room for complete feedback + question)
        : step === 3
          ? 600 // tutor reply (typically short)
          : step === 4
            ? 800 // group discussion guidance
            : 1200; // long-form steps (6/7/8/9/10)
    // Step 4 keeps single-round response for latency; Step 1/2 use extra continuation
    // to avoid truncated feedback at substep boundaries (e.g., 2-3 -> 2-4).
    const shortStep = step === 4;
    const continuationMaxRounds = step === 1 || step === 2 ? 3 : shortStep ? 0 : 1;
    return await generateAiTextWithRetry(messages, 0.6, maxTokensByStep, {
      continueOnTruncation: !shortStep,
      continuationMaxRounds,
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
    return await llmChatCompletionText({ messages, temperature: 0.6, maxTokens: 400 });
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
  return `步驟 10 總結報告（${userId}）\n最終稿：${essay}\n總評：結構已改善，建議再精煉結語。\n\n整個課程操作結束，請等待老師的下一步指示。`;
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
    return sanitizeStudentFacingText(await generateAiTextWithRetry(messages, 0.6, 1000, { continuationMaxRounds: 2 }));
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
  const systemParts: string[] = [];
  if (session.promptConfig.systemPrompt) systemParts.push(session.promptConfig.systemPrompt);
  const step10Prompt = session.promptConfig.stepPrompts["10"];
  if (step10Prompt) systemParts.push(step10Prompt);
  systemParts.push("請針對該學生在整個課程中的表現，輸出完整總結報告。");

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
        "請輸出步驟 10 的總結報告，並在最後一段明確寫出：「整個課程操作結束，請等待老師的下一步指示」。"
    }
  ];
  return { messages, fallback };
}

async function generateStep10Report(session: SessionState, userId: string): Promise<string> {
  const { messages, fallback } = buildStep10LlmInput(session, userId);
  if (!isLlmConfigured()) {
    return fallback;
  }
  try {
    return await generateAiTextWithRetry(messages, 0.6, 900);
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
  let changed = false;
  for (const participant of session.participants) {
    const userStep = session.personalSteps?.[participant] ?? session.currentStep;
    const answeredCount = session.reflectionIndex?.[participant] ?? 0;
    if (userStep !== 9 || answeredCount < step9Questions.length) continue;

    const hasStep10Report = Boolean(session.reports.step10?.[participant]?.trim());
    if (!hasStep10Report) {
      await finalizeStep9ForUser(session, participant);
    } else {
      session.personalSteps![participant] = 10;
    }
    changed = true;
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
      for (const participant of session.participants) {
        const summary = await generateStep5SummaryForUser(session, participant);
        session.reports.step5[participant] = summary;
        session.messages.push(makeMessage({ role: "ai", userId: participant, step, text: summary }));
      }
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
      session.messages.push(makeMessage({ role: "ai", step, text: "步驟 10 總結報告已生成，整個課程操作結束，請等待老師的下一步指示。" }));
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
  generateStep1Or2Ai?: (
    session: SessionState,
    step: 1 | 2,
    contextText: string,
    userId: string
  ) => Promise<{ feedbackText: string; nextQuestion?: string }>;
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
    recordRejectedAnswerSignal(session, userId, rejectionScope, now());
    throw new Error(validationError);
  }

  if (step === 1 || step === 2) {
    const result = handleStep1Or2Group(session, userId, text, makeMessage);
    if (result.allResponded) {
      if (hooks?.onBeforeGroupAi) {
        await hooks.onBeforeGroupAi(result.session);
      }
      let parsed: { feedbackText: string; nextQuestion?: string };
      try {
        const contextText = `all members answered step ${step} substep ${result.substep}`;
        parsed = hooks?.generateStep1Or2Ai
          ? await hooks.generateStep1Or2Ai(result.session, step as 1 | 2, contextText, userId)
          : await generateStep1Or2AiWithQuestionRetry(result.session, step as 1 | 2, contextText, userId);
      } catch {
        parsed = {
          feedbackText: "已收到大家的回覆。遠端 AI 暫時無法完成回覆，系統先使用備用問題讓討論繼續。",
          nextQuestion: undefined
        };
      }
      const shouldEmitAiFeedback = !isNextQuestionSubStepPromptDriven(result.session, step as 1 | 2, result.substep);
      if (shouldEmitAiFeedback) {
        result.session.messages.push(
          makeMessage({
            role: "ai",
            step,
            text: parsed.feedbackText
          })
        );
      }
      const completedGateKey = getCurrentGroupGateKey(result.session, step as 1 | 2);
      result.session.groupGate[completedGateKey] = [];
      advanceStep1Or2SubstepAfterAi(result.session, step as 1 | 2, result.substep, parsed.nextQuestion, makeMessage);
    }
    return result.session;
  }

  if (step === 4) {
    const completedUsers = new Set(session.groupGate["4-complete"] ?? []);
    if (completedUsers.has(userId)) {
      throw new Error("step4_already_completed");
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
