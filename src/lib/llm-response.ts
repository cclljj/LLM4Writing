export type StepAiResponse = {
  feedbackText: string;
  nextQuestion?: string;
};

function readString(record: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

function stripJsonFence(text: string): string {
  return text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

export function parseStructuredStepAiResponse(aiText: string): StepAiResponse | null {
  const raw = stripJsonFence(aiText);
  if (!raw.startsWith("{") || !raw.endsWith("}")) return null;

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const record = parsed as Record<string, unknown>;
    const feedbackText = readString(record, ["feedback", "feedbackText", "response", "reply"]);
    const nextQuestion = readString(record, ["nextQuestion", "question", "next_question"]);
    if (!feedbackText && !nextQuestion) return null;
    return {
      feedbackText: feedbackText ?? "已收到大家的回覆。",
      nextQuestion
    };
  } catch {
    return null;
  }
}

export function splitAiFeedbackAndQuestion(aiText: string): StepAiResponse {
  const structured = parseStructuredStepAiResponse(aiText);
  if (structured) return structured;

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

export function isUsableNextQuestion(text?: string): boolean {
  const q = (text ?? "").trim();
  if (!q) return false;
  if (q.includes("請依上一則 AI 提問作答")) return false;
  return true;
}
