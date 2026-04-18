import { randomUUID } from "node:crypto";
import { ChatMessage, SessionState, StartSessionPayload } from "@/src/lib/types";
import { REFLECTION_QUESTIONS, STEP_DEFINITIONS, getModeByStep, getStepName } from "@/src/lib/spec";

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
    activityTitle: payload.activityTitle
  };

  session.messages.push(
    makeMessage({
      role: "system",
      step: 1,
      text:
        workflow === "legacy_phase"
          ? `進入 Phase1。任務：${payload.activityTitle ?? "未命名任務"}。請開始討論。`
          : `Session started. Current step: 1 ${getStepName(1)}.`
    })
  );

  return session;
}

function isLegacy(session: SessionState): boolean {
  return session.workflow === "legacy_phase";
}

function generateAiTextForStep(step: number, contextText: string): string {
  const stepName = getStepName(step);
  return `AI(${stepName}) 回覆：已收到內容「${contextText.slice(0, 80)}${contextText.length > 80 ? "..." : ""}」，請依本步驟目標繼續。`;
}

function generateLegacyAiText(step: number, contextText: string): string {
  return `AI(Phase${step})：收到你的訊息「${contextText.slice(0, 80)}${contextText.length > 80 ? "..." : ""}」，請繼續。`;
}

function generateOneShotReport(step: number): string {
  return `AI(${getStepName(step)}) 一次性報告：已根據既有對話與作文內容產生本步驟分析結果。`;
}

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

  const mode = getModeByStep(step);

  if (mode === "non_interactive") {
    session.messages.push(
      makeMessage({
        role: "ai",
        step,
        text: generateOneShotReport(step)
      })
    );
  }

  if (mode === "personal_reflection") {
    session.messages.push(
      makeMessage({
        role: "system",
        step,
        text: `步驟 9 開始：${REFLECTION_QUESTIONS[0]}`
      })
    );
  }

  return session;
}

export function advanceLegacyPhase(session: SessionState): SessionState {
  if (!isLegacy(session)) {
    throw new Error("not_legacy_session");
  }

  if (session.currentStep >= session.phaseMax) {
    session.messages.push(
      makeMessage({
        role: "system",
        step: session.currentStep,
        text: "已達最後階段。"
      })
    );
    return session;
  }

  session.currentStep += 1;
  session.messages.push(
    makeMessage({
      role: "system",
      step: session.currentStep,
      text: `進入 Phase${session.currentStep}。`
    })
  );

  return session;
}

export function sendStudentMessage(session: SessionState, userId: string, text: string): SessionState {
  const step = session.currentStep;

  if (!session.participants.includes(userId)) {
    throw new Error("unknown_participant");
  }

  if (isLegacy(session)) {
    session.messages.push(
      makeMessage({
        role: "student",
        userId,
        step,
        text
      })
    );
    session.messages.push(
      makeMessage({
        role: "ai",
        step,
        text: generateLegacyAiText(step, text)
      })
    );
    return session;
  }

  const mode = getModeByStep(step);

  if (mode === "non_interactive") {
    throw new Error("step_non_interactive");
  }

  const studentMessage = makeMessage({
    role: "student",
    userId,
    step,
    text
  });
  session.messages.push(studentMessage);

  if (mode === "personal_interaction") {
    session.messages.push(
      makeMessage({
        role: "ai",
        step,
        text: generateAiTextForStep(step, text)
      })
    );
    return session;
  }

  if (mode === "group_interaction") {
    const responders = new Set(session.groupGate[step] ?? []);
    responders.add(userId);
    session.groupGate[step] = Array.from(responders);

    const allResponded = session.participants.every((participant) => responders.has(participant));
    if (allResponded) {
      session.messages.push(
        makeMessage({
          role: "ai",
          step,
          text: generateAiTextForStep(step, "all group members replied")
        })
      );
      session.groupGate[step] = [];
    }
    return session;
  }

  if (mode === "personal_reflection") {
    const current = session.reflectionIndex[userId] ?? 0;
    const next = current + 1;
    session.reflectionIndex[userId] = next;

    if (next < REFLECTION_QUESTIONS.length) {
      session.messages.push(
        makeMessage({
          role: "system",
          step,
          text: `下一題：${REFLECTION_QUESTIONS[next]}`
        })
      );
    } else {
      session.messages.push(
        makeMessage({
          role: "system",
          step,
          text: "個人反思完成。"
        })
      );
    }

    return session;
  }

  return session;
}
