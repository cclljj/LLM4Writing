import { randomUUID } from "node:crypto";
import { ChatMessage, SessionState, StartSessionPayload } from "@/src/lib/types";
import { REFLECTION_QUESTIONS, STEP_DEFINITIONS, getModeByStep, getStepName } from "@/src/lib/spec";
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

function pickQuestion(session: SessionState, key: string, fallback: string): string {
  const bank = session.promptConfig?.questionBanks?.[key];
  if (bank && bank.length > 0) {
    return bank[Math.floor(Math.random() * bank.length)]!;
  }

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
  return pickQuestion(session, key, fallbackMap[s] ?? "請繼續討論。");
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
  return pickQuestion(session, key, fallbackMap[s] ?? "請繼續蒐集資料。");
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
    promptConfig: payload.promptConfig ?? { stepPrompts: {}, subStepPrompts: {}, questionBanks: {} },
    stepState: { step1Substep: 1, step2Substep: 1 },
    outlines: {},
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

function buildRecentContext(session: SessionState, step: number): string {
  const relevant = session.messages
    .filter((m) => m.step === step && (m.role === "student" || m.role === "ai" || m.role === "system"))
    .slice(-12);

  return relevant
    .map((m) => {
      if (m.role === "student") return `學生${m.userId ? `(${m.userId})` : ""}：${m.text}`;
      if (m.role === "ai") return `AI：${m.text}`;
      return `系統：${m.text}`;
    })
    .join("\n");
}

async function generateAiTextForStep(session: SessionState, step: number, contextText: string): Promise<string> {
  const stepName = getStepName(step);
  if (!isLlmConfigured()) {
    return `AI(${stepName}) 回覆：已收到內容「${contextText.slice(0, 80)}${contextText.length > 80 ? "..." : ""}」，請依本步驟目標繼續。`;
  }

  const systemParts: string[] = [];
  if (session.promptConfig.systemPrompt) systemParts.push(session.promptConfig.systemPrompt);
  const stepPrompt = session.promptConfig.stepPrompts[String(step)];
  if (stepPrompt) systemParts.push(stepPrompt);
  systemParts.push(`目前步驟：${step}（${stepName}）。請嚴格遵守步驟與輸出格式要求。`);

  const recent = buildRecentContext(session, step);
  const messages: LlmChatMessage[] = [
    { role: "system", content: systemParts.join("\n\n") },
    {
      role: "user",
      content:
        `以下是最近對話內容（可能含系統指示）：\n${recent || "(無)"}\n\n` +
        `目前事件：${contextText}\n\n` +
        `請根據最新一輪組員回覆，產出本步驟應給學生的下一則引導回覆。`
    }
  ];

  return llmChatCompletionText({ messages, temperature: 0.6, maxTokens: 700 });
}

async function generateLegacyAiText(session: SessionState, step: number, contextText: string): Promise<string> {
  if (!isLlmConfigured()) {
    return `AI(Phase${step})：收到你的訊息「${contextText.slice(0, 80)}${contextText.length > 80 ? "..." : ""}」，請繼續。`;
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
  return llmChatCompletionText({ messages, temperature: 0.6, maxTokens: 400 });
}

function buildStep5Summary(session: SessionState): string {
  const relevant = session.messages.filter((m) => m.step >= 1 && m.step <= 4 && (m.role === "student" || m.role === "ai"));
  const brief = relevant.slice(-8).map((m) => `${m.role}${m.userId ? `(${m.userId})` : ""}: ${m.text}`).join("\n");
  return `步驟 5 摘要報告\n${brief || "目前尚無足夠資料。"}`;
}

function buildStep7Report(session: SessionState, userId: string): string {
  const essay = session.draftStep6[userId] ?? "(尚未撰寫初稿)";
  return `步驟 7 分析回饋（${userId}）\n初稿：${essay}\n建議：請加強論點與例證的連結。`;
}

function buildStep10Report(session: SessionState, userId: string): string {
  const essay = session.draftStep8[userId] ?? session.draftStep6[userId] ?? "(尚未提交作文)";
  return `步驟 10 總結報告（${userId}）\n最終稿：${essay}\n總評：結構已改善，建議再精煉結語。`;
}

// --- existing non-LLM report builders below ---

export function switchStep(session: SessionState, step: number): SessionState {
  if (!STEP_DEFINITIONS.find((s) => s.step === step)) {
    throw new Error(`invalid_step:${step}`);
  }

  session.currentStep = step;
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
      session.messages.push(makeMessage({ role: "ai", step, text: "步驟 10 總結報告已生成。" }));
    }
  }

  if (mode === "personal_reflection") {
    session.messages.push(
      makeMessage({ role: "system", step, text: `步驟 9 開始：${REFLECTION_QUESTIONS[0]}` })
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

  if (step === 1) {
    if (substep < 5) {
      session.stepState.step1Substep += 1;
      const nextSub = session.stepState.step1Substep;
      const q = buildStep1Question(session);
      session.messages.push(makeMessage({ role: "system", step, text: `子步驟 1-${nextSub}：${q}` }));
    } else {
      session.messages.push(makeMessage({ role: "system", step, text: "步驟 1 子步驟已完成，等待教師切換下一步。" }));
    }
  }

  if (step === 2) {
    if (substep < 4) {
      session.stepState.step2Substep += 1;
      const nextSub = session.stepState.step2Substep;
      const q = buildStep2Question(session);
      session.messages.push(makeMessage({ role: "system", step, text: `子步驟 2-${nextSub}：${q}` }));
    } else {
      session.messages.push(makeMessage({ role: "system", step, text: "步驟 2 子步驟已完成，等待教師切換下一步。" }));
    }
  }

  return { session, allResponded: true, substep };
}

export async function sendStudentMessage(session: SessionState, userId: string, text: string): Promise<SessionState> {
  const step = session.currentStep;

  if (!session.participants.includes(userId)) {
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
      result.session.messages.push(
        makeMessage({
          role: "ai",
          step,
          text: await generateAiTextForStep(result.session, step, `all members answered step ${step} substep ${result.substep}`)
        })
      );
    }
    return result.session;
  }

  session.messages.push(makeMessage({ role: "student", userId, step, text }));

  if (mode === "personal_interaction") {
    session.messages.push(makeMessage({ role: "ai", step, text: await generateAiTextForStep(session, step, text) }));
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
    const current = session.reflectionIndex[userId] ?? 0;
    const next = current + 1;
    session.reflectionIndex[userId] = next;

    if (next < REFLECTION_QUESTIONS.length) {
      session.messages.push(makeMessage({ role: "system", step, text: `下一題：${REFLECTION_QUESTIONS[next]}` }));
    } else {
      session.messages.push(makeMessage({ role: "system", step, text: "個人反思完成。" }));
    }
    return session;
  }

  return session;
}
