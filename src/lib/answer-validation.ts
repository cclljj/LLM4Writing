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

function looksLikeRandomToken(text: string): boolean {
  const compact = text.replace(/\s+/g, "");
  const hasCjk = /[\u3400-\u9fff]/u.test(text);
  return !hasCjk && /^[A-Za-z0-9_-]{7,}$/.test(compact) && /[A-Za-z]/.test(compact) && /\d/.test(compact);
}

function isLowEffortAnswer(text: string): boolean {
  return /^(不知道|不會|隨便|沒意見|無|沒有|\.{2,}|。{2,}|哈+|呵+|lol)$/i.test(text.trim());
}

function hasQuestionOverlap(question: string, answer: string): boolean {
  const questionTerms = Array.from(
    new Set(
      (question.match(/[\u3400-\u9fff]{2,}/gu) ?? [])
        .map((term) => term.trim())
        .filter((term) => term.length >= 2)
    )
  ).slice(0, 12);
  if (questionTerms.length === 0) return true;
  return questionTerms.some((term) => answer.includes(term));
}

const SIMPLE_RELEVANCE_MIN_LEN = 20;
const SIMPLE_EXPLANATION_MARKERS = ["因為", "所以", "例如", "像是", "代表", "因此", "顯示", "說明", "比較", "影響"];
const CJK_STOP_CHARS = new Set(["的", "了", "是", "在", "有", "和", "與", "及", "或", "你", "我", "他", "她", "它", "們", "請", "這", "那", "把", "就", "都", "很", "再", "更", "嗎", "呢", "吧", "啊"]);

function extractQuestionKeywordsForSimple(question: string): string[] {
  const latinOrDigit = (question.match(/[A-Za-z0-9]+/g) ?? [])
    .map((token) => token.toLowerCase())
    .filter((token) => token.length >= 1);
  const cjkTerms = (question.match(/[\u3400-\u9fff]{2,}/gu) ?? [])
    .map((term) => term.trim())
    .filter((term) => term.length >= 2);
  return Array.from(new Set([...latinOrDigit, ...cjkTerms])).slice(0, 20);
}

function hasMeaningfulCjkOverlap(question: string, answer: string): boolean {
  const qChars = Array.from(question.match(/[\u3400-\u9fff]/gu) ?? [])
    .filter((char) => !CJK_STOP_CHARS.has(char));
  if (qChars.length === 0) return true;
  const matched = qChars.filter((char) => answer.includes(char));
  return new Set(matched).size >= 2;
}

function hasSimpleRelevance(question: string, answer: string): boolean {
  const lowerAnswer = answer.toLowerCase();
  const keywords = extractQuestionKeywordsForSimple(question);
  const hasKeywordOverlap = keywords.some((keyword) => lowerAnswer.includes(keyword) || answer.includes(keyword));
  if (hasKeywordOverlap) return true;
  return hasMeaningfulCjkOverlap(question, answer);
}

function hasExplanationSignal(answer: string): boolean {
  return SIMPLE_EXPLANATION_MARKERS.some((marker) => answer.includes(marker));
}

export function validateStudentAnswerSimple(session: SessionState, userId: string, step: number, answer: string): string | null {
  const trimmed = answer.trim();
  if (!trimmed) {
    return "請先輸入你的回答，再送出。";
  }
  if (trimmed.length < SIMPLE_RELEVANCE_MIN_LEN) {
    return `你的回答目前偏短，請至少寫到 ${SIMPLE_RELEVANCE_MIN_LEN} 字，並補上一個具體理由、例子或經驗。`;
  }
  if (looksLikeRandomToken(trimmed)) {
    return "你的回答看起來像隨機字串，請依題目內容用完整文字作答。";
  }
  if (isLowEffortAnswer(trimmed)) {
    return "看起來這次回覆比較像敷衍作答，請依題目要求認真嘗試回答。";
  }
  const question = extractCurrentSystemQuestion(session, step, userId);
  if (!question) return null;
  if (!hasSimpleRelevance(question, trimmed)) {
    return "你的回答和目前題目關聯性不足，請針對題目重點再具體作答。";
  }
  // Step1/2 uses a looser relevance check: as long as the answer is relevant
  // and includes a basic explanation trace, it should pass.
  if (!hasExplanationSignal(trimmed) && trimmed.length < SIMPLE_RELEVANCE_MIN_LEN + 8) {
    return "請直接對準題目關鍵字作答，補上與題目相關的理由、例子或經驗。";
  }
  return null;
}

/**
 * Validates step-6/8 essay submissions before advancing.
 * Returns a human-readable error string when the draft is insufficient, or null when valid.
 */
export function validateDraftContent(
  sessionOrDraft: SessionState | string,
  draftOrVersion?: string | "初稿" | "最終稿",
  maybeVersion?: "初稿" | "最終稿"
): string | null {
  const hasSessionArg = typeof sessionOrDraft !== "string";
  const session = hasSessionArg ? sessionOrDraft : undefined;
  const draft = hasSessionArg ? String(draftOrVersion ?? "") : sessionOrDraft;
  const version: "初稿" | "最終稿" = hasSessionArg ? (maybeVersion ?? "初稿") : "初稿";
  const trimmed = draft.trim();
  const cjkCount = (trimmed.match(/[㐀-鿿]/gu) ?? []).length;
  if (cjkCount < 50) {
    return `文章${version}中文字數不足（目前約 ${cjkCount} 個中文字，需至少 50 個）。請補充更完整內容後再送出。`;
  }

  if (looksLikeRandomToken(trimmed)) {
    return `文章${version}看起來像隨機字串，請依題目內容撰寫有意義的文字。`;
  }

  const compact = trimmed.replace(/\s/g, "");
  if (/^(不知道|不知|不會|隨便|沒意見|無|沒有|測試|test|asdf|qwerty|lol|哈+|呵+){1,5}$/i.test(compact)) {
    return `文章${version}不能只有敷衍文字，請根據寫作任務補上具體內容後再送出。`;
  }

  // Detect heavy repetition (e.g. "啊啊啊啊啊" or "測試測試測試測試").
  const deduped = trimmed.replace(/(.{1,6})\1{3,}/gu, "$1");
  if (deduped.length < trimmed.length * 0.4) {
    return `文章${version}看起來包含大量重複字元或填充文字，請修改為具體且有意義的內容後再送出。`;
  }

  const title = (session?.activityTitle ?? "").trim();
  if (title) {
    const normalizedTitle = normalizeForCompare(title);
    const normalizedDraft = normalizeForCompare(trimmed);
    if (normalizedDraft && normalizedTitle && normalizedDraft === normalizedTitle) {
      return `你目前貼上的是作文題目本身，請改用自己的內容完成文章${version}。`;
    }
    if (
      normalizedDraft &&
      normalizedTitle &&
      normalizedDraft.includes(normalizedTitle) &&
      normalizedTitle.length / Math.max(normalizedDraft.length, 1) >= 0.7
    ) {
      return `你的文章${version}和題目文字太接近，請加入自己的觀點與內容。`;
    }
    if (!hasQuestionOverlap(title, trimmed)) {
      return `你的文章${version}和題目關聯性不足，請聚焦題目關鍵概念補強內容後再送出。`;
    }
  }

  return null;
}
