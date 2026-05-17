import { ChatMessage, SessionState } from "./types";
import { isUsableNextQuestion } from "./llm-response";
import { buildStep1Question, buildStep2Question, getCurrentGroupGateKey, pickQuestionFromSubStepFallback } from "./workflow-questions";

export type MessageFactory = (input: Omit<ChatMessage, "id" | "at">) => ChatMessage;

function getStep12GateMembers(session: SessionState): string[] {
  const joinedMembers = (session.joinedUsers ?? []).filter((user) => session.participants.includes(user));
  return joinedMembers.length > 0 ? joinedMembers : session.participants;
}

export function handleStep1Or2Group(
  session: SessionState,
  userId: string,
  text: string,
  makeMessage: MessageFactory
): { session: SessionState; allResponded: boolean; substep: number } {
  const step = session.currentStep;
  const substep = step === 1 ? session.stepState.step1Substep : session.stepState.step2Substep;
  const gateKey = getCurrentGroupGateKey(session, step as 1 | 2);

  session.messages.push(makeMessage({ role: "student", userId, step, text }));

  const responders = new Set(session.groupGate[gateKey] ?? []);
  responders.add(userId);
  session.groupGate[gateKey] = Array.from(responders);

  const gateMembers = getStep12GateMembers(session);
  const allResponded = gateMembers.length > 0 && gateMembers.every((participant) => responders.has(participant));
  if (!allResponded) {
    return { session, allResponded: false, substep };
  }

  return { session, allResponded: true, substep };
}

export function isNextQuestionSubStepPromptDriven(session: SessionState, step: 1 | 2, completedSubstep: number): boolean {
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

export function getNextSubstepKeyAfterCompletion(
  session: SessionState,
  step: 1 | 2,
  completedSubstep: number
): string | null {
  if (step === 1) {
    if (completedSubstep === 3 && (session.stepState.step1Substep3Question ?? 1) < 3) {
      return `1-3-${(session.stepState.step1Substep3Question ?? 1) + 1}`;
    }
    if (completedSubstep === 4 && (session.stepState.step1Substep4Question ?? 1) < 3) {
      return `1-4-${(session.stepState.step1Substep4Question ?? 1) + 1}`;
    }
    if (completedSubstep < 5) {
      const nextSub = completedSubstep + 1;
      if (nextSub === 3) return "1-3-1";
      if (nextSub === 4) return "1-4-1";
      return `1-${nextSub}`;
    }
    return null;
  }

  if (completedSubstep === 1 && (session.stepState.step2Substep1Question ?? 1) < 3) {
    return `2-1-${(session.stepState.step2Substep1Question ?? 1) + 1}`;
  }
  if (completedSubstep < 4) {
    const nextSub = completedSubstep + 1;
    if (nextSub === 1) return "2-1-1";
    return `2-${nextSub}`;
  }
  return null;
}

export function advanceStep1Or2SubstepAfterAi(
  session: SessionState,
  step: 1 | 2,
  completedSubstep: number,
  nextQuestionFromAi: string | undefined,
  makeMessage: MessageFactory
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
      const q = safeNextQuestion || (mustUseQuestionBank
        ? buildStep1Question(session)
        : nextSub === 3
          ? pickQuestionFromSubStepFallback(
              session,
              "1-3-1",
              "請先用一個生活中的具體例子，說明你認為題目關鍵詞在這裡代表什麼。"
            )
          : nextSub === 4
            ? pickQuestionFromSubStepFallback(
                session,
                "1-4-1",
                "請根據剛才的討論，用一句話說出你們最核心、最想傳達的觀點。"
              )
            : buildStep1Question(session));
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
    const q = safeNextQuestion || (mustUseQuestionBank
      ? buildStep2Question(session)
      : pickQuestionFromSubStepFallback(
          session,
          `2-${nextSub}`,
          nextSub === 2
            ? "請把你的例子補充得更具體：時間、地點、人物、發生了什麼，以及它如何連回你的主張？"
            : "請再往前一步：根據你剛才的例子，推論造成這個現象的深層原因是什麼？請至少說出一個因果鏈。"
        ));
    if (nextSub === 1) {
      session.messages.push(makeMessage({ role: "system", step, text: `子步驟 2-1-1：${q}` }));
    } else {
      session.messages.push(makeMessage({ role: "system", step, text: `子步驟 2-${nextSub}：${q}` }));
    }
    return;
  }
  session.messages.push(makeMessage({ role: "system", step, text: "步驟 2 子步驟已完成，等待教師切換下一步。" }));
}

export function recoverStalledStep1Or2AiWait(
  session: SessionState,
  makeMessage: MessageFactory,
  options: { idleMs?: number; nowMs?: number } = {}
): boolean {
  if (session.currentStep !== 1 && session.currentStep !== 2) return false;
  const step = session.currentStep as 1 | 2;
  const completedSubstep = step === 1 ? session.stepState.step1Substep : session.stepState.step2Substep;
  const gateKey = getCurrentGroupGateKey(session, step);
  const responders = session.groupGate[gateKey] ?? [];
  const gateMembers = getStep12GateMembers(session);
  const allResponded = gateMembers.length > 0 && gateMembers.every((participant) => responders.includes(participant));
  if (!allResponded) return false;

  const gateResponderMessages = session.messages
    .filter((message) => message.step === step && message.role === "student" && message.userId && responders.includes(message.userId))
    .slice()
    .sort((a, b) => b.at.localeCompare(a.at));
  const latestGateResponse = gateResponderMessages[0];
  if (!latestGateResponse) return false;

  const latestStepActivity = session.messages
    .filter((message) => message.step === step)
    .slice()
    .sort((a, b) => b.at.localeCompare(a.at))[0];

  const latestMs = new Date((latestStepActivity ?? latestGateResponse).at).getTime();
  if (!Number.isFinite(latestMs)) return false;
  const idleMs = options.idleMs ?? 45_000;
  const nowMs = options.nowMs ?? Date.now();
  if (nowMs - latestMs < idleMs) return false;

  session.groupGate[gateKey] = [];
  advanceStep1Or2SubstepAfterAi(session, step, completedSubstep, undefined, makeMessage);
  return true;
}
