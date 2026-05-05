import { randomUUID } from "node:crypto";
import { ChatMessage, SessionState, StartSessionPayload } from "@/src/lib/types";
import { getStep9QuestionsFromConfig, STEP_DEFINITIONS, getModeByStep, getStepName } from "@/src/lib/spec";
import { isLlmConfigured, llmChatCompletionText, LlmChatMessage } from "@/src/lib/llm-client";
import { buildStudentCourseContext } from "@/src/lib/llm-context";

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

function pickQuestionFromBank(session: SessionState, key: string, fallback: string): string {
  const bank = session.promptConfig?.questionBanks?.[key];
  if (bank && bank.length > 0) {
    return bank[Math.floor(Math.random() * bank.length)]!;
  }
  return fallback;
}

function pickQuestionFromSubStepPrompt(session: SessionState, key: string, fallback: string): string {
  const prompt = session.promptConfig?.subStepPrompts?.[key];
  if (prompt) {
    return prompt;
  }
  return fallback;
}

function pickQuestionFromSubStepFallback(session: SessionState, key: string, fallback: string): string {
  const prompt = session.promptConfig?.subStepPromptsFallbacks?.[key];
  if (prompt) return prompt;
  return fallback;
}

function looksLikeInstructionPrompt(text: string): boolean {
  // Heuristic: subStepPrompts may contain multi-paragraph instructions intended for the LLM,
  // not a student-facing question.
  if (text.includes("【") || text.includes("提問規則") || text.includes("批判性思考")) return true;
  if (text.includes("請回答以下問題")) return true;
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  return lines.length >= 4 || text.length >= 160;
}

function buildStep1Question(session: SessionState): string {
  const s = session.stepState.step1Substep;
  const key =
    s === 3 ? `1-3-${session.stepState.step1Substep3Question ?? 1}` : s === 4 ? `1-4-${session.stepState.step1Substep4Question ?? 1}` : `1-${s}`;
  const fallbackMap: Record<number, string> = {
    1: "請先說明你對題目的初步理解。",
    2: "請補充你們小組目前的立場。",
    3: "請提出一個可驗證的論據。",
    4: "請回應可能的反對意見。",
    5: "請總結本步驟結論。"
  };
  const fallback = fallbackMap[s] ?? "請繼續討論。";

  // SPEC_yunchieh: 1-1/1-2/1-5 使用問題庫；1-3/1-4 使用子步驟 prompt。
  if ([1, 2, 5].includes(s)) {
    return pickQuestionFromBank(session, key, fallback);
  }
  const candidate = pickQuestionFromSubStepPrompt(session, key, fallback);
  if (looksLikeInstructionPrompt(candidate)) {
    return s === 3
      ? pickQuestionFromSubStepFallback(
          session,
          key,
          "請用自己的話說明：題目關鍵詞在你的理解中包含哪些情況、不包含哪些情況？"
        )
      : pickQuestionFromSubStepFallback(
          session,
          key,
          "請延伸剛才的想法，補上一個理由或例子，讓你的主張更完整。"
        );
  }
  return candidate;
}

function buildStep2Question(session: SessionState): string {
  const s = session.stepState.step2Substep;
  const key = s === 1 ? `2-1-${session.stepState.step2Substep1Question ?? 1}` : `2-${s}`;
  const fallbackMap: Record<number, string> = {
    1: "請列出你們需要的資料來源。",
    2: "請評估資料可信度。",
    3: "請整理支持與反對資料。",
    4: "請補上一個具體案例。"
  };
  const fallback = fallbackMap[s] ?? "請繼續蒐集資料。";

  // SPEC_yunchieh: 2-1/2-2/2-3 使用子步驟 prompt；2-4 使用問題庫。
  if (s === 4) {
    return pickQuestionFromBank(session, key, fallback);
  }
  const candidate = pickQuestionFromSubStepPrompt(session, key, fallback);
  if (looksLikeInstructionPrompt(candidate)) {
    return s === 1
      ? pickQuestionFromSubStepFallback(
          session,
          key,
          "請挑一個最能支持你主張的具體例子，並說明為什麼選它。"
        )
      : pickQuestionFromSubStepFallback(
          session,
          key,
          s === 2
            ? "請把例子補充得更具體：時間、地點、人物、事件，並說明它如何支持你的主張。"
            : "請從這個例子再往前推：造成這個現象的深層原因是什麼？"
        );
  }
  return candidate;
}

function getCurrentSubstepKey(session: SessionState, step: number): string | null {
  if (step === 1) {
    if (session.stepState.step1Substep === 3) return `1-3-${session.stepState.step1Substep3Question ?? 1}`;
    if (session.stepState.step1Substep === 4) return `1-4-${session.stepState.step1Substep4Question ?? 1}`;
    return `1-${session.stepState.step1Substep}`;
  }
  if (step === 2) {
    if (session.stepState.step2Substep === 1) return `2-1-${session.stepState.step2Substep1Question ?? 1}`;
    return `2-${session.stepState.step2Substep}`;
  }
  return null;
}

function getCurrentGroupGateKey(session: SessionState, step: 1 | 2): string {
  if (step === 1) {
    const substep = session.stepState.step1Substep;
    if (substep === 3) return `1-3-${session.stepState.step1Substep3Question ?? 1}`;
    if (substep === 4) return `1-4-${session.stepState.step1Substep4Question ?? 1}`;
    return `1-${substep}`;
  }
  const substep = session.stepState.step2Substep;
  if (substep === 1) return `2-1-${session.stepState.step2Substep1Question ?? 1}`;
  return `2-${substep}`;
}

function getStep9Questions(session: SessionState): string[] {
  return getStep9QuestionsFromConfig(session.promptConfig?.step9Questions);
}

function buildStep9BatchPrompt(questions: string[]): string {
  return `步驟 9 請一次回答以下四題：\n1. ${questions[0]}\n2. ${questions[1]}\n3. ${questions[2]}\n4. ${questions[3]}\n\n請在下方依序填答四題後一次送出。`;
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
    reports: { step7: {}, step10: {} }
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
    session.reports = { step7: {}, step10: {} };
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

function normalizeForCompare(text: string): string {
  return text.replace(/[\s，。、「」；：？！,.!?;:'"()（）\[\]{}]/g, "").toLowerCase();
}

function extractCurrentSystemQuestion(session: SessionState, step: number, userId: string): string {
  const candidates = session.messages
    .filter((m) => m.role === "system" && m.step === step && (!m.userId || m.userId === userId))
    .slice(-6);
  const last = candidates[candidates.length - 1];
  return last?.text?.trim() ?? "";
}

function detectRequiredItemCount(question: string): number | null {
  const mapping: Record<string, number> = { 一: 1, 二: 2, 兩: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
  const matched = question.match(/([一二兩三四五六七八九]|\d+)\s*(個|點|項|則|句|關鍵字|理由|例子|想法|論點|重點)/);
  if (!matched) return null;
  const raw = matched[1]!;
  if (/^\d+$/.test(raw)) return Number(raw);
  return mapping[raw] ?? null;
}

function countAnswerItems(answer: string): number {
  const trimmed = answer.trim();
  if (!trimmed) return 0;
  const numbered = trimmed
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^(\d+[\.\)]|[一二三四五六七八九十][、.])/u.test(line));
  if (numbered.length > 0) return numbered.length;

  const parts = trimmed
    .split(/[\r\n、，,；;]+/)
    .map((p) => p.trim())
    .filter(Boolean);
  return parts.length;
}

function validateStudentAnswer(session: SessionState, userId: string, step: number, answer: string): string | null {
  const trimmed = answer.trim();
  if (trimmed.length < 2) {
    return "你的回答太短了，請再多寫一些，至少表達一個完整想法。";
  }

  const lowEffortPatterns = /^(不知道|不會|隨便|沒意見|無|沒有|\.{2,}|。{2,}|哈+|呵+|lol)$/i;
  if (lowEffortPatterns.test(trimmed)) {
    return "看起來這次回覆比較像敷衍作答，請依題目要求認真嘗試回答。";
  }

  const question = extractCurrentSystemQuestion(session, step, userId);
  if (!question) return null;

  const normalizedQuestion = normalizeForCompare(question);
  const normalizedAnswer = normalizeForCompare(trimmed);
  if (normalizedAnswer && normalizedQuestion && normalizedAnswer === normalizedQuestion) {
    return "你目前貼上的是題目本身，請用自己的話回答題目。";
  }
  if (
    normalizedAnswer &&
    normalizedQuestion &&
    normalizedQuestion.includes(normalizedAnswer) &&
    normalizedAnswer.length / Math.max(normalizedQuestion.length, 1) >= 0.7
  ) {
    return "你的內容和題目文字太接近，請用自己的想法重新回答。";
  }

  const requiredCount = detectRequiredItemCount(question);
  if (requiredCount && requiredCount >= 2) {
    const providedCount = countAnswerItems(trimmed);
    if (providedCount < requiredCount) {
      return `這題需要至少 ${requiredCount} 項內容，你目前只提供了 ${providedCount} 項，請補齊後再送出。`;
    }
  }
  return null;
}

async function generateAiTextWithRetry(messages: LlmChatMessage[], temperature: number, maxTokens: number): Promise<string> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await llmChatCompletionText({ messages, temperature, maxTokens });
    } catch (error) {
      lastError = error;
      if (attempt < 3) {
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
    const aiRaw = await generateAiTextForStep(session, step, contextText, userId);
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

async function generateAiTextForStep(session: SessionState, step: number, contextText: string, userId?: string): Promise<string> {
  const stepName = getStepName(step);
  const fallback =
    step === 3
      ? "AI（生成論點）回覆：已收到你的提問。請先整理一個清楚主張，並列出 2-3 個支持重點，把它們放進結構樹節點。"
      : `AI（${stepName}）回覆：已收到本輪回覆。請依目前步驟目標繼續討論。`;
  if (!isLlmConfigured()) {
    return fallback;
  }

  const systemParts: string[] = [];
  if (session.promptConfig.systemPrompt) systemParts.push(session.promptConfig.systemPrompt);
  const stepPrompt = session.promptConfig.stepPrompts[String(step)];
  if (stepPrompt) systemParts.push(stepPrompt);
  const substepKey = getCurrentSubstepKey(session, step);
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
  const scopedSteps = new Set([1, 2, 4, 6, 8, 9]);
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
    { role: "system", content: systemParts.join("\n\n") },
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
          : "請根據最新一輪組員回覆，產出本步驟應給學生的下一則引導回覆。")
    }
  ];

  try {
    return await generateAiTextWithRetry(messages, 0.6, 700);
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

function buildStep5Summary(session: SessionState): string {
  const relevant = session.messages.filter((m) => m.step >= 1 && m.step <= 4 && (m.role === "student" || m.role === "ai"));
  const brief = relevant.slice(-8).map((m) => `${m.role}${m.userId ? `(${m.userId})` : ""}: ${m.text}`).join("\n");
  return `步驟 5 摘要報告\n${brief || "目前尚無足夠資料。"}`;
}

function splitAiFeedbackAndQuestion(aiText: string): { feedbackText: string; nextQuestion?: string } {
  const marker = /(###\s*\*\*請回答以下問題\*\*|請回答以下問題)\s*[:：]?/m;
  const match = marker.exec(aiText);
  if (!match || typeof match.index !== "number") {
    return { feedbackText: aiText.trim() };
  }

  const before = aiText.slice(0, match.index).trim();
  const after = aiText.slice(match.index + match[0].length).trim();
  if (!after) {
    return { feedbackText: before || aiText.trim() };
  }

  const normalizedQuestion = after
    .replace(/^[-*]\s*/, "")
    .replace(/^###\s*/, "")
    .trim();

  return {
    feedbackText: before || "已收到大家的回覆。",
    nextQuestion: normalizedQuestion
  };
}

function isUsableNextQuestion(text?: string): boolean {
  const q = (text ?? "").trim();
  if (!q) return false;
  if (q.includes("請依上一則 AI 提問作答")) return false;
  return true;
}

function isNextQuestionSubStepPromptDriven(session: SessionState, step: 1 | 2, completedSubstep: number): boolean {
  if (step === 1) {
    if (completedSubstep === 3 && (session.stepState.step1Substep3Question ?? 1) < 3) return true;
    if (completedSubstep === 4 && (session.stepState.step1Substep4Question ?? 1) < 3) return true;
    if (completedSubstep < 5) {
      const nextSub = completedSubstep + 1;
      return nextSub === 3 || nextSub === 4;
    }
    return false;
  }

  if (completedSubstep === 1 && (session.stepState.step2Substep1Question ?? 1) < 3) return true;
  if (completedSubstep < 4) {
    const nextSub = completedSubstep + 1;
    return nextSub === 2 || nextSub === 3;
  }
  return false;
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

async function generateStep10Report(session: SessionState, userId: string): Promise<string> {
  const fallback = buildStep10Report(session, userId);
  if (!isLlmConfigured()) {
    return fallback;
  }

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

  try {
    return await generateAiTextWithRetry(messages, 0.6, 900);
  } catch {
    return fallback;
  }
}

async function finalizeStep9ForUser(session: SessionState, userId: string): Promise<void> {
  session.personalSteps = session.personalSteps ?? {};
  session.personalSteps[userId] = 10;
  const step10Report = await generateStep10Report(session, userId);
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

export function switchStep(session: SessionState, step: number): SessionState {
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
      session.reports.step5 = buildStep5Summary(session);
      session.messages.push(makeMessage({ role: "ai", step, text: session.reports.step5 }));
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
};

function handleStep1Or2Group(
  session: SessionState,
  userId: string,
  text: string
): { session: SessionState; allResponded: boolean; substep: number } {
  const step = session.currentStep;
  const substep = step === 1 ? session.stepState.step1Substep : session.stepState.step2Substep;
  const gateKey = getCurrentGroupGateKey(session, step as 1 | 2);

  session.messages.push(makeMessage({ role: "student", userId, step, text }));

  const responders = new Set(session.groupGate[gateKey] ?? []);
  responders.add(userId);
  session.groupGate[gateKey] = Array.from(responders);

  const allResponded = session.participants.every((participant) => responders.has(participant));
  if (!allResponded) {
    return { session, allResponded: false, substep };
  }

  return { session, allResponded: true, substep };
}

function advanceStep1Or2SubstepAfterAi(
  session: SessionState,
  step: 1 | 2,
  completedSubstep: number,
  nextQuestionFromAi?: string
): void {
  const safeNextQuestion = isUsableNextQuestion(nextQuestionFromAi) ? nextQuestionFromAi!.trim() : "";

  if (step === 1) {
    if (completedSubstep === 3 && (session.stepState.step1Substep3Question ?? 1) < 3) {
      session.stepState.step1Substep3Question = (session.stepState.step1Substep3Question ?? 1) + 1;
      const qIdx = session.stepState.step1Substep3Question;
      const q =
        safeNextQuestion ||
        pickQuestionFromSubStepFallback(
          session,
          `1-3-${qIdx}`,
          "請用自己的話補充說明：你認為題目中的關鍵詞範圍包含什麼、不包含什麼？"
        );
      session.messages.push(makeMessage({ role: "system", step, text: `子步驟 1-3-${qIdx}：${q}` }));
      return;
    }
    if (completedSubstep === 4 && (session.stepState.step1Substep4Question ?? 1) < 3) {
      session.stepState.step1Substep4Question = (session.stepState.step1Substep4Question ?? 1) + 1;
      const qIdx = session.stepState.step1Substep4Question;
      const q =
        safeNextQuestion ||
        pickQuestionFromSubStepFallback(
          session,
          `1-4-${qIdx}`,
          qIdx === 2
            ? "請從你們剛剛釐清的範圍出發：這篇文章最核心、最想傳達的一句話觀點是什麼？"
            : "請再收斂一次：用一句話寫出你們的核心主張（最想讓讀者記住的觀點）。"
        );
      session.messages.push(makeMessage({ role: "system", step, text: `子步驟 1-4-${qIdx}：${q}` }));
      return;
    }

    if (completedSubstep < 5) {
      session.stepState.step1Substep += 1;
      const nextSub = session.stepState.step1Substep;
      if (nextSub === 3) session.stepState.step1Substep3Question = 1;
      if (nextSub === 4) session.stepState.step1Substep4Question = 1;
      const mustUseQuestionBank = nextSub === 2 || nextSub === 5;
      const q = mustUseQuestionBank
        ? buildStep1Question(session)
        : nextSub === 3
          ? safeNextQuestion ||
            pickQuestionFromSubStepFallback(
              session,
              "1-3-1",
              "請先用一個生活中的具體例子，說明你認為題目關鍵詞在這裡代表什麼。"
            )
          : nextSub === 4
            ? safeNextQuestion ||
              pickQuestionFromSubStepFallback(
                session,
                "1-4-1",
                "請根據剛才的討論，用一句話說出你們最核心、最想傳達的觀點。"
              )
            : safeNextQuestion || buildStep1Question(session);
      if (nextSub === 3) {
        session.messages.push(makeMessage({ role: "system", step, text: `子步驟 1-3-1：${q}` }));
      } else if (nextSub === 4) {
        session.messages.push(makeMessage({ role: "system", step, text: `子步驟 1-4-1：${q}` }));
      } else {
        session.messages.push(makeMessage({ role: "system", step, text: `子步驟 1-${nextSub}：${q}` }));
      }
      return;
    }
    session.messages.push(makeMessage({ role: "system", step, text: "步驟 1 子步驟已完成，等待教師切換下一步。" }));
    return;
  }

  if (completedSubstep === 1 && (session.stepState.step2Substep1Question ?? 1) < 3) {
    session.stepState.step2Substep1Question = (session.stepState.step2Substep1Question ?? 1) + 1;
    const qIdx = session.stepState.step2Substep1Question;
    const q =
      safeNextQuestion ||
      pickQuestionFromSubStepFallback(
        session,
        `2-1-${qIdx}`,
        qIdx === 2
          ? "請挑一個你覺得最好用的具體例子（可以是生活經驗/新聞/歷史），並用 1-2 句話說明這個例子是什麼。"
          : "請說明：你選的這個例子，哪一個部分最能支持你的觀點？為什麼？"
      );
    session.messages.push(makeMessage({ role: "system", step, text: `子步驟 2-1-${qIdx}：${q}` }));
    return;
  }

  if (completedSubstep < 4) {
    session.stepState.step2Substep += 1;
    const nextSub = session.stepState.step2Substep;
    if (nextSub === 1) session.stepState.step2Substep1Question = 1;
    const mustUseQuestionBank = nextSub === 4;
    const q = mustUseQuestionBank
      ? buildStep2Question(session)
      : safeNextQuestion ||
        pickQuestionFromSubStepFallback(session, `2-${nextSub}`, nextSub === 2
          ? "請把你的例子補充得更具體：時間、地點、人物、發生了什麼，以及它如何連回你的主張？"
          : "請再往前一步：根據你剛才的例子，推論造成這個現象的深層原因是什麼？請至少說出一個因果鏈。");
    if (nextSub === 1) {
      session.messages.push(makeMessage({ role: "system", step, text: `子步驟 2-1-1：${q}` }));
    } else {
      session.messages.push(makeMessage({ role: "system", step, text: `子步驟 2-${nextSub}：${q}` }));
    }
    return;
  }
  session.messages.push(makeMessage({ role: "system", step, text: "步驟 2 子步驟已完成，等待教師切換下一步。" }));
}

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

  const validationError = validateStudentAnswer(session, userId, step, text);
  if (validationError) {
    throw new Error(validationError);
  }

  if (step === 1 || step === 2) {
    const result = handleStep1Or2Group(session, userId, text);
    if (result.allResponded) {
      if (hooks?.onBeforeGroupAi) {
        await hooks.onBeforeGroupAi(result.session);
      }
      const parsed = await generateStep1Or2AiWithQuestionRetry(
        result.session,
        step as 1 | 2,
        `all members answered step ${step} substep ${result.substep}`,
        userId
      );
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
      advanceStep1Or2SubstepAfterAi(result.session, step as 1 | 2, result.substep, parsed.nextQuestion);
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
    session.messages.push(makeMessage({ role: "ai", userId, step, text: await generateAiTextForStep(session, step, text, userId) }));
    return session;
  }

  if (mode === "group_interaction") {
    const gateKey = `${step}-1`;
    const responders = new Set(session.groupGate[gateKey] ?? []);
    responders.add(userId);
    session.groupGate[gateKey] = Array.from(responders);

    const allResponded = session.participants.every((participant) => responders.has(participant));
    if (allResponded) {
      session.messages.push(
        makeMessage({ role: "ai", step, text: await generateAiTextForStep(session, step, "all group members replied") })
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
    await finalizeStep9ForUser(session, userId);
    return session;
  }

  return session;
}
