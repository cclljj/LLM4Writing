import { SessionState } from "./types";
import { getStep9QuestionsFromConfig } from "./spec";

export function pickQuestionFromBank(session: SessionState, key: string, fallback: string): string {
  const bank = session.promptConfig?.questionBanks?.[key];
  if (bank && bank.length > 0) {
    return bank[Math.floor(Math.random() * bank.length)]!;
  }
  return fallback;
}

export function pickQuestionFromSubStepPrompt(session: SessionState, key: string, fallback: string): string {
  const prompt = session.promptConfig?.subStepPrompts?.[key];
  if (prompt) {
    return prompt;
  }
  return fallback;
}

export function pickQuestionFromSubStepFallback(session: SessionState, key: string, fallback: string): string {
  const prompt = session.promptConfig?.subStepPromptsFallbacks?.[key];
  if (prompt) return prompt;
  return fallback;
}

export function looksLikeInstructionPrompt(text: string): boolean {
  if (text.includes("【") || text.includes("提問規則") || text.includes("批判性思考")) return true;
  if (text.includes("請回答以下問題")) return true;
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  return lines.length >= 4 || text.length >= 160;
}

export function buildStep1Question(session: SessionState): string {
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

export function buildStep2Question(session: SessionState): string {
  const s = session.stepState.step2Substep;
  const key = s === 1 ? `2-1-${session.stepState.step2Substep1Question ?? 1}` : `2-${s}`;
  const fallbackMap: Record<number, string> = {
    1: "請列出你們需要的資料來源。",
    2: "請評估資料可信度。",
    3: "請整理支持與反對資料。",
    4: "請補上一個具體案例。"
  };
  const fallback = fallbackMap[s] ?? "請繼續蒐集資料。";

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

export function getCurrentSubstepKey(session: SessionState, step: number): string | null {
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

export function getCurrentGroupGateKey(session: SessionState, step: 1 | 2): string {
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

export function getStep9Questions(session: SessionState): string[] {
  return getStep9QuestionsFromConfig(session.promptConfig?.step9Questions);
}

export function buildStep9BatchPrompt(questions: string[]): string {
  return `步驟 9 請一次回答以下四題：\n1. ${questions[0]}\n2. ${questions[1]}\n3. ${questions[2]}\n4. ${questions[3]}\n\n請在下方依序填答四題後一次送出。`;
}
