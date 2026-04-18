import { randomUUID } from "node:crypto";
import { ChatMessage, SessionState } from "@/src/lib/types";
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

export function createSession(participants: string[]): SessionState {
  const sessionId = randomUUID();
  const session: SessionState = {
    id: sessionId,
    createdAt: now(),
    currentStep: 1,
    participants,
    messages: [],
    groupGate: {},
    reflectionIndex: Object.fromEntries(participants.map((id) => [id, 0]))
  };

  session.messages.push(
    makeMessage({
      role: "system",
      step: 1,
      text: `Session started. Current step: 1 ${getStepName(1)}.`
    })
  );

  return session;
}

function generateAiTextForStep(step: number, contextText: string): string {
  const stepName = getStepName(step);
  return `AI(${stepName}) 回覆：已收到內容「${contextText.slice(0, 80)}${contextText.length > 80 ? "..." : ""}」，請依本步驟目標繼續。`;
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

export function sendStudentMessage(session: SessionState, userId: string, text: string): SessionState {
  const step = session.currentStep;
  const mode = getModeByStep(step);

  if (!session.participants.includes(userId)) {
    throw new Error("unknown_participant");
  }

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
