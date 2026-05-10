export type StepAiResponse = {
  feedbackText: string;
  nextQuestion?: string;
};

const STEP5_SECTION_TITLES = ["讚美與鼓勵", "我們討論了什麼", "我們學到了什麼"] as const;

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

function normalizeStep5SectionHeading(line: string): string | null {
  const compact = line.replace(/[＊*#\s]/g, "");
  for (const title of STEP5_SECTION_TITLES) {
    if (compact === title) return title;
  }
  return null;
}

export function normalizeStep5Summary(raw: string): string {
  const text = raw.trim();
  if (!text) return raw;
  const lines = text.split(/\r?\n/);
  const sections = new Map<string, string>();
  let currentTitle: string | null = null;
  let buffer: string[] = [];

  const flush = () => {
    if (!currentTitle) return;
    const content = buffer.join("\n").trim();
    if (!content) return;
    const prev = sections.get(currentTitle) ?? "";
    if (content.length >= prev.length) sections.set(currentTitle, content);
  };

  for (const line of lines) {
    const maybeTitle = normalizeStep5SectionHeading(line.trim());
    if (maybeTitle) {
      flush();
      currentTitle = maybeTitle;
      buffer = [];
      continue;
    }
    if (currentTitle) buffer.push(line);
  }
  flush();

  if (sections.size === 0) return text;
  return STEP5_SECTION_TITLES
    .filter((title) => sections.has(title))
    .map((title) => `### **${title}**\n${sections.get(title)}`)
    .join("\n\n")
    .trim();
}

function normalizeCompact(text: string): string {
  return text.replace(/\s+/g, "").trim();
}

function looksLikeTruncationMeta(text: string): boolean {
  return /(上一則回覆被截斷|很抱歉上一則回覆被截斷|從中斷處|繼續討論，讓它)/.test(text);
}

export function normalizeStep6SuggestionText(raw: string): string {
  return normalizeFormalLlmText(raw, { fallback: "AI 建議：目前無法整理可讀建議，請再試一次。" });
}

export function normalizeFormalLlmText(raw: string, options: { fallback?: string } = {}): string {
  const cleaned = sanitizeStudentFacingText(raw);
  const paras = cleaned
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
    .filter((p) => !looksLikeTruncationMeta(p));

  const deduped: string[] = [];
  const seen = new Map<string, number>();
  paras.forEach((p) => {
    const key = normalizeCompact(p);
    const existingIdx = seen.get(key);
    if (existingIdx === undefined) {
      seen.set(key, deduped.length);
      deduped.push(p);
      return;
    }
    if (p.length > deduped[existingIdx]!.length) {
      deduped[existingIdx] = p;
    }
  });

  const result = deduped.join("\n\n").trim();
  if (!result) return options.fallback ?? "目前無法整理可讀內容，請再試一次。";
  return result;
}

export function hasStep6SuggestionQualityRisk(text: string): boolean {
  return hasFormalLlmQualityRisk(text);
}

export function hasFormalLlmQualityRisk(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return true;
  if (looksLikeTruncationMeta(trimmed)) return true;

  const lines = trimmed
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length >= 16);
  const counts = new Map<string, number>();
  for (const line of lines) {
    const key = normalizeCompact(line);
    const n = (counts.get(key) ?? 0) + 1;
    counts.set(key, n);
    if (n >= 2) return true;
  }

  const end = trimmed.at(-1) ?? "";
  const completeEnding = /[。！？.!?」』]$/.test(end);
  if (!completeEnding && trimmed.length >= 80) return true;

  return false;
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
