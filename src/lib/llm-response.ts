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

function unescapeJsonString(input: string): string {
  return input.replace(/\\"/g, "\"").replace(/\\n/g, "\n").replace(/\\t/g, "\t").trim();
}

function extractFeedbackFromJsonish(raw: string): string | null {
  const m = raw.match(/"feedback"\s*:\s*"([\s\S]*?)"\s*(?:,|\}|$)/i);
  if (!m?.[1]) return null;
  const extracted = unescapeJsonString(m[1]);
  return extracted || null;
}

function normalizeDanglingTail(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return trimmed;

  const trailingPunctuation = trimmed.replace(/[，、；：,.!?！？。]+$/g, "").trim();
  if (!trailingPunctuation) return trimmed;

  const danglingEnding = /(都|而且|但是|不過|並且|以及|所以|因此|另外|同時|然後|接著|且|並)$/u;
  if (!danglingEnding.test(trailingPunctuation)) return trimmed;

  // Remove the dangling connector token and force a clean sentence end.
  const repaired = trailingPunctuation.replace(danglingEnding, "").trim();
  const repairedNoCommaTail = repaired.replace(/[，、；：,]+$/g, "").trim();
  if (!repairedNoCommaTail) return "已收到大家的回覆。";
  return `${repairedNoCommaTail}。`;
}

export function sanitizeStudentFacingText(aiText: string): string {
  const raw = stripJsonFence(aiText);
  const feedbackFromJsonish = extractFeedbackFromJsonish(raw);
  if (feedbackFromJsonish) return normalizeDanglingTail(feedbackFromJsonish);

  // Defensive cleanup for malformed JSON-like leftovers.
  const cleaned = raw
    .replace(/^\s*\{\s*"feedback"\s*:\s*/i, "")
    .replace(/,\s*"nextQuestion"\s*:\s*[\s\S]*$/i, "")
    .replace(/\}\s*$/g, "")
    .replace(/^"+|"+$/g, "")
    .trim();
  return normalizeDanglingTail(cleaned || aiText.trim());
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
    return { feedbackText: sanitizeStudentFacingText(aiText) };
  }

  const before = aiText.slice(0, match.index).trim();
  const after = aiText.slice(match.index + match[0].length).trim();
  if (!after) {
    return { feedbackText: sanitizeStudentFacingText(before || aiText.trim()) };
  }

  const normalizedQuestion = after
    .replace(/^[-*]\s*/, "")
    .replace(/^###\s*/, "")
    .trim();

  return {
    feedbackText: sanitizeStudentFacingText(before || "已收到大家的回覆。"),
    nextQuestion: normalizedQuestion
  };
}

export function isUsableNextQuestion(text?: string): boolean {
  const q = (text ?? "").trim();
  if (!q) return false;
  if (q.includes("請依上一則 AI 提問作答")) return false;
  return true;
}
