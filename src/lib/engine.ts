import { randomUUID } from "node:crypto";
import { ChatMessage, SessionState, StartSessionPayload } from "@/src/lib/types";
import { getStep9QuestionsFromConfig, STEP_DEFINITIONS, getModeByStep, getStepName } from "@/src/lib/spec";
import { isLlmConfigured, llmChatCompletionText, LlmChatMessage } from "@/src/lib/llm-client";

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
    return `請討論：${prompt}`;
  }
  return fallback;
}

function buildStep1Question(session: SessionState): string {
  const s = session.stepState.step1Substep;
  const key = `1-${s}`;
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
  return pickQuestionFromSubStepPrompt(session, key, fallback);
}

function buildStep2Question(session: SessionState): string {
  const s = session.stepState.step2Substep;
  const key = `2-${s}`;
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
  return pickQuestionFromSubStepPrompt(session, key, fallback);
}

function getCurrentSubstepKey(session: SessionState, step: number): string | null {
  if (step === 1) return `1-${session.stepState.step1Substep}`;
  if (step === 2) return `2-${session.stepState.step2Substep}`;
  return null;
}

function getStep9Questions(session: SessionState): string[] {
  return getStep9QuestionsFromConfig(session.promptConfig?.step9Questions);
}

function initializeStepQuestion(session: SessionState, step: number): void {
  if (step === 1) {
    session.stepState.step1Substep = 1;
    const q = buildStep1Question(session);
    session.messages.push(
      makeMessage({
        role: "system",
        step,
        text: `步驟 1 開頭詞：${session.promptConfig.stepPrompts["1"] ?? "請開始審視題目。"}\n子步驟 1-1：${q}`
      })
    );
  }

  if (step === 2) {
    session.stepState.step2Substep = 1;
    const q = buildStep2Question(session);
    session.messages.push(
      makeMessage({
        role: "system",
        step,
        text: `步驟 2 開頭詞：${session.promptConfig.stepPrompts["2"] ?? "請開始蒐集資料。"}\n子步驟 2-1：${q}`
      })
    );
  }

  if ([3, 4, 6, 8, 9].includes(step)) {
    session.messages.push(
      makeMessage({
        role: "system",
        step,
        text: `步驟 ${step} 開頭詞：${session.promptConfig.stepPrompts[String(step)] ?? `請進入步驟 ${step}。`}`
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
    groupId: payload.groupId,
    groupName: payload.groupName,
    promptConfig: payload.promptConfig ?? { stepPrompts: {}, subStepPrompts: {}, questionBanks: {}, step9Questions: {} },
    stepState: { step1Substep: 1, step2Substep: 1 },
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
    session.stepState = { step1Substep: 1, step2Substep: 1 };
  }
  if (typeof session.stepState.step1Substep !== "number") {
    session.stepState.step1Substep = 1;
  }
  if (typeof session.stepState.step2Substep !== "number") {
    session.stepState.step2Substep = 1;
  }
  if (!session.promptConfig || typeof session.promptConfig !== "object") {
    session.promptConfig = { stepPrompts: {}, subStepPrompts: {}, questionBanks: {}, step9Questions: {} };
  }
  if (!session.promptConfig.stepPrompts || typeof session.promptConfig.stepPrompts !== "object") {
    session.promptConfig.stepPrompts = {};
  }
  if (!session.promptConfig.subStepPrompts || typeof session.promptConfig.subStepPrompts !== "object") {
    session.promptConfig.subStepPrompts = {};
  }
  if (!session.promptConfig.questionBanks || typeof session.promptConfig.questionBanks !== "object") {
    session.promptConfig.questionBanks = {};
  }
  if (!session.promptConfig.step9Questions || typeof session.promptConfig.step9Questions !== "object") {
    session.promptConfig.step9Questions = {};
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

function buildRecentContext(session: SessionState, step: number, userId?: string): string {
  const relevant = session.messages
    .filter((m) => {
      if (m.step !== step) return false;
      if (m.role === "system") return true;
      if (m.role === "student") return !userId || m.userId === userId;
      if (m.role === "ai") return !userId || m.userId === userId;
      return false;
    })
    .slice(-12);

  return relevant
    .map((m) => {
      if (m.role === "student") return `學生${m.userId ? `(${m.userId})` : ""}：${m.text}`;
      if (m.role === "ai") return `AI：${m.text}`;
      return `系統：${m.text}`;
    })
    .join("\n");
}

function buildHistoryContextForStep3(session: SessionState, userId: string): string {
  const relevant = session.messages
    .filter((m) => {
      if (!(m.step === 1 || m.step === 2 || m.step === 3)) return false;
      if (m.role === "system") return true;
      if (m.role === "student") return m.userId === userId;
      if (m.role === "ai") return !m.userId || m.userId === userId;
      return false;
    })
    .slice(-20);
  return relevant
    .map((m) => {
      if (m.role === "student") return `S${m.step}-學生${m.userId ? `(${m.userId})` : ""}：${m.text}`;
      if (m.role === "ai") return `S${m.step}-AI：${m.text}`;
      return `S${m.step}-系統：${m.text}`;
    })
    .join("\n");
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

  const recent = buildRecentContext(session, step, step === 3 ? userId : undefined);
  const step3History = step === 3 && userId ? buildHistoryContextForStep3(session, userId) : "";
  const messages: LlmChatMessage[] = [
    { role: "system", content: systemParts.join("\n\n") },
    {
      role: "user",
      content:
        `以下是最近對話內容（可能含系統指示）：\n${recent || "(無)"}\n\n` +
        (step === 3 ? `以下是步驟 1/2 對談脈絡（用於引導結構樹）：\n${step3History || "(無)"}\n\n` : "") +
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
      makeMessage({ role: "system", step, text: `步驟 9 開始：${step9Questions[0]}` })
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

function handleStep1Or2Group(
  session: SessionState,
  userId: string,
  text: string
): { session: SessionState; allResponded: boolean; substep: number } {
  const step = session.currentStep;
  const substep = step === 1 ? session.stepState.step1Substep : session.stepState.step2Substep;
  const gateKey = `${step}-${substep}`;

  session.messages.push(makeMessage({ role: "student", userId, step, text }));

  const responders = new Set(session.groupGate[gateKey] ?? []);
  responders.add(userId);
  session.groupGate[gateKey] = Array.from(responders);

  const allResponded = session.participants.every((participant) => responders.has(participant));
  if (!allResponded) {
    return { session, allResponded: false, substep };
  }

  session.groupGate[gateKey] = [];

  return { session, allResponded: true, substep };
}

function advanceStep1Or2SubstepAfterAi(
  session: SessionState,
  step: 1 | 2,
  completedSubstep: number,
  nextQuestionFromAi?: string
): void {
  if (step === 1) {
    if (completedSubstep < 5) {
      session.stepState.step1Substep += 1;
      const nextSub = session.stepState.step1Substep;
      const q = nextQuestionFromAi?.trim() || buildStep1Question(session);
      session.messages.push(makeMessage({ role: "system", step, text: `子步驟 1-${nextSub}：${q}` }));
      return;
    }
    session.messages.push(makeMessage({ role: "system", step, text: "步驟 1 子步驟已完成，等待教師切換下一步。" }));
    return;
  }

  if (completedSubstep < 4) {
    session.stepState.step2Substep += 1;
    const nextSub = session.stepState.step2Substep;
    const q = nextQuestionFromAi?.trim() || buildStep2Question(session);
    session.messages.push(makeMessage({ role: "system", step, text: `子步驟 2-${nextSub}：${q}` }));
    return;
  }
  session.messages.push(makeMessage({ role: "system", step, text: "步驟 2 子步驟已完成，等待教師切換下一步。" }));
}

export async function sendStudentMessage(session: SessionState, userId: string, text: string, stepOverride?: number): Promise<SessionState> {
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

  if (step === 1 || step === 2) {
    const result = handleStep1Or2Group(session, userId, text);
    if (result.allResponded) {
      const aiRaw = await generateAiTextForStep(result.session, step, `all members answered step ${step} substep ${result.substep}`);
      const parsed = splitAiFeedbackAndQuestion(aiRaw);
      result.session.messages.push(
        makeMessage({
          role: "ai",
          step,
          text: parsed.feedbackText
        })
      );
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
    const current = session.reflectionIndex[userId] ?? 0;
    const next = current + 1;
    session.reflectionIndex[userId] = next;

    if (next < step9Questions.length) {
      session.messages.push(makeMessage({ role: "system", userId, step, text: `下一題：${step9Questions[next]}` }));
    } else {
      session.messages.push(makeMessage({ role: "system", userId, step, text: "個人反思完成。" }));
      session.personalSteps = session.personalSteps ?? {};
      session.personalSteps[userId] = 10;
      const step10Report = await generateStep10Report(session, userId);
      session.reports.step10[userId] = step10Report;
      session.messages.push(makeMessage({ role: "ai", userId, step: 10, text: step10Report }));
    }
    return session;
  }

  return session;
}
