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

function extractFeedbackFromLooseJsonish(raw: string): string | null {
  const keyMatch = /"feedback"\s*:\s*"/i.exec(raw);
  if (!keyMatch || typeof keyMatch.index !== "number") return null;
  let i = keyMatch.index + keyMatch[0].length;
  let out = "";
  let escaped = false;

  while (i < raw.length) {
    const ch = raw[i]!;
    const rest = raw.slice(i);
    if (!escaped && ch === "\"") break;
    // Truncated JSON fallback: stop before next known key boundary.
    if (!escaped && /^"\s*,\s*"(nextQuestion|next_question|question|feedbackText|response|reply)"\s*:/i.test(rest)) {
      break;
    }
    out += ch;
    escaped = !escaped && ch === "\\";
    if (escaped && ch !== "\\") escaped = false;
    if (!escaped && ch !== "\\") escaped = false;
    i += 1;
  }

  const extracted = unescapeJsonString(out).replace(/"\s*,?\s*$/g, "").trim();
  return extracted || null;
}

function looksLikeJsonShell(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  return /"feedback"\s*:|^\s*\{[\s\S]*\}\s*$|^\s*\{[\s\S]*$/i.test(trimmed);
}

export function sanitizeStudentFacingText(aiText: string): string {
  const raw = stripJsonFence(aiText);
  const feedbackFromJsonish = extractFeedbackFromLooseJsonish(raw);
  if (feedbackFromJsonish) return feedbackFromJsonish;

  // Defensive cleanup for malformed JSON-like leftovers.
  const cleaned = raw
    .replace(/^\s*\{\s*"feedback"\s*:\s*/i, "")
    .replace(/,\s*"nextQuestion"\s*:\s*[\s\S]*$/i, "")
    .replace(/\}\s*$/g, "")
    .replace(/^"+|"+$/g, "")
    .trim();
  if (cleaned && !looksLikeJsonShell(cleaned)) return cleaned;
  if (!cleaned && !looksLikeJsonShell(aiText)) return aiText.trim();
  return "已收到大家的回覆。";
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
