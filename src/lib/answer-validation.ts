import { SessionState } from "./types";

export function normalizeForCompare(text: string): string {
  return text.replace(/[\s，。、「」；：？！,.!?;:'"()（）\[\]{}]/g, "").toLowerCase();
}

export function extractCurrentSystemQuestion(session: SessionState, step: number, userId: string): string {
  const candidates = session.messages
    .filter((m) => m.role === "system" && m.step === step && (!m.userId || m.userId === userId))
    .slice(-6);
  const last = candidates[candidates.length - 1];
  return last?.text?.trim() ?? "";
}

export function detectRequiredItemCount(question: string): number | null {
  const mapping: Record<string, number> = { 一: 1, 二: 2, 兩: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
  const matched = question.match(/([一二兩三四五六七八九]|\d+)\s*(個|點|項|則|句|關鍵字|理由|例子|想法|論點|重點)/);
  if (!matched) return null;
  const raw = matched[1]!;
  if (/^\d+$/.test(raw)) return Number(raw);
  return mapping[raw] ?? null;
}

export function countAnswerItems(answer: string): number {
  const trimmed = answer.trim();
  if (!trimmed) return 0;
  const numbered = trimmed
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^(\d+[\.)]|[一二三四五六七八九十][、.])/u.test(line));
  if (numbered.length > 0) return numbered.length;

  const parts = trimmed
    .split(/[\r\n、，,；;]+/)
    .map((p) => p.trim())
    .filter(Boolean);
  return parts.length;
}

export function validateStudentAnswer(session: SessionState, userId: string, step: number, answer: string): string | null {
  const trimmed = answer.trim();
  if (trimmed.length < 2) {
    return "你的回答太短了，請再多寫一些，至少表達一個完整想法。";
  }

  // Reject random-looking single-token input (e.g. "ru4vm3jp6").
  const compact = trimmed.replace(/\s+/g, "");
  const hasCjk = /[\u3400-\u9fff]/u.test(trimmed);
  const looksLikeRandomToken =
    !hasCjk &&
    /^[A-Za-z0-9_-]{7,}$/.test(compact) &&
    /[A-Za-z]/.test(compact) &&
    /\d/.test(compact);
  if (looksLikeRandomToken) {
    return "你的回答看起來像隨機字串，請依題目內容用完整文字作答。";
  }

  const lowEffortPatterns = /^(不知道|不會|隨便|沒意見|無|沒有|\.{2,}|。{2,}|哈+|呵+|lol)$/i;
  if (lowEffortPatterns.test(trimmed)) {
    return "看起來這次回覆比較像敷衍作答，請依題目要求認真嘗試回答。";
  }

  const question = extractCurrentSystemQuestion(session, step, userId);
  if (!question) return null;

  const normalizedQuestion = normalizeForCompare(question);
  const normalizedAnswer = normalizeForCompare(trimmed);
  if (normalizedAnswer && normalizedQuestion && normalizedAnswer === normalizedQuestion) {
    return "你目前貼上的是題目本身，請用自己的話回答題目。";
  }
  if (
    normalizedAnswer &&
    normalizedQuestion &&
    normalizedQuestion.includes(normalizedAnswer) &&
    normalizedAnswer.length / Math.max(normalizedQuestion.length, 1) >= 0.7
  ) {
    return "你的內容和題目文字太接近，請用自己的想法重新回答。";
  }

  const requiredCount = detectRequiredItemCount(question);
  if (requiredCount && requiredCount >= 2) {
    const providedCount = countAnswerItems(trimmed);
    if (providedCount < requiredCount) {
      return `這題需要至少 ${requiredCount} 項內容，你目前只提供了 ${providedCount} 項，請補齊後再送出。`;
    }
  }

  // Basic relevance check: for short answers, require at least one key term overlap with question.
  const questionTerms = Array.from(
    new Set(
      (question.match(/[\u3400-\u9fff]{2,}/gu) ?? [])
        .map((term) => term.trim())
        .filter((term) => term.length >= 2)
    )
  ).slice(0, 12);
  if (questionTerms.length > 0 && trimmed.length <= 24) {
    const hasOverlap = questionTerms.some((term) => trimmed.includes(term));
    if (!hasOverlap) {
      return "你的回答和目前題目關聯性不足，請針對題目重點再具體作答。";
    }
  }

  return null;
}
