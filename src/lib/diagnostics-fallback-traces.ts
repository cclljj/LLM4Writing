import type { PersistedEventRow } from "@/src/lib/store";
import type { SessionState } from "@/src/lib/types";

export type FallbackTraceErrorSource = "learning_event" | "matched_llm_event" | "none";
export type FallbackTraceReconstructionSource = "session_messages_and_prompt_config" | "event_only";

export type RecentFallbackTrace = {
  at: string;
  step: number | null;
  kind: string;
  sessionId: string | null;
  activityId: string | null;
  fallbackUsed: boolean;
  matchedLlmErrorCategory: string | null;
  sampleErrorSource: FallbackTraceErrorSource;
  reconstructionSource: FallbackTraceReconstructionSource;
  reconstructedPrompt: string;
};

function truncate(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars - 1)}…`;
}

function compact(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function formatMessage(role: string, userId: string | undefined, text: string): string {
  const who = role === "student" ? `學生${userId ? `(${userId})` : ""}` : role === "ai" ? "AI" : "系統";
  return `${who}：${compact(text)}`;
}

function extractSubstepFromSystemMessage(text: string): string | null {
  const m = text.match(/子步驟\s*([0-9]+(?:-[0-9]+){1,2})/);
  return m?.[1] ?? null;
}

function getMessagesBeforeEvent(session: SessionState, atMs: number) {
  return session.messages.filter((message) => {
    const ms = new Date(message.at).getTime();
    return Number.isFinite(ms) && ms <= atMs;
  });
}

function buildStepRecent(messages: SessionState["messages"], step: number, limit = 10): string {
  const lines = messages
    .filter((message) => message.step === step)
    .slice(-limit)
    .map((message) => formatMessage(message.role, message.userId, message.text));
  return lines.join("\n") || "(無)";
}

function buildCrossStepRecent(messages: SessionState["messages"], limit = 14): string {
  const lines = messages
    .slice(-limit)
    .map((message) => `Step ${message.step} ${formatMessage(message.role, message.userId, message.text)}`);
  return lines.join("\n") || "(無)";
}

function findCurrentQuestion(messages: SessionState["messages"], step: number): string {
  const candidate = messages
    .slice()
    .reverse()
    .find((message) => message.role === "system" && message.step === step && /子步驟|步驟/.test(message.text));
  return candidate ? compact(candidate.text) : "(未知)";
}

function buildSystemPrompt(session: SessionState, step: number, substepKey: string | null): string {
  const chunks: string[] = [];
  if (session.promptConfig.systemPrompt?.trim()) chunks.push(session.promptConfig.systemPrompt.trim());
  const stepPrompt = session.promptConfig.stepPrompts?.[String(step)]?.trim();
  if (stepPrompt) chunks.push(stepPrompt);
  if (substepKey) {
    chunks.push(`目前子步驟：${substepKey}`);
    const subStepPrompt = session.promptConfig.subStepPrompts?.[substepKey]?.trim();
    if (subStepPrompt) chunks.push(`子步驟 Prompt（${substepKey}）：\n${subStepPrompt}`);
  }
  return chunks.join("\n\n").trim() || "(無可用 system prompt)";
}

function buildReconstructedPrompt(fallbackEvent: PersistedEventRow, session?: SessionState): {
  source: FallbackTraceReconstructionSource;
  prompt: string;
} {
  const atIso = fallbackEvent.created_at.toISOString();
  if (!session || typeof fallbackEvent.step !== "number") {
    return {
      source: "event_only",
      prompt: [
        "[reconstructed=false] 無法取得對應 session 或 step，僅保留 fallback 事件資訊。",
        `time=${atIso}`,
        `kind=${fallbackEvent.kind}`,
        `step=${fallbackEvent.step ?? "—"}`,
        `sessionId=${fallbackEvent.session_id ?? "—"}`,
        `activityId=${fallbackEvent.activity_id ?? "—"}`
      ].join("\n")
    };
  }

  const atMs = fallbackEvent.created_at.getTime();
  const messagesBefore = getMessagesBeforeEvent(session, atMs);
  const step = fallbackEvent.step;
  const sameStepRecent = buildStepRecent(messagesBefore, step);
  const crossStepRecent = buildCrossStepRecent(messagesBefore);
  const currentQuestion = findCurrentQuestion(messagesBefore, step);
  const lastSystem = messagesBefore
    .slice()
    .reverse()
    .find((message) => message.role === "system" && message.step === step);
  const substepKey = lastSystem ? extractSubstepFromSystemMessage(lastSystem.text) : null;
  const systemPrompt = buildSystemPrompt(session, step, substepKey);
  const essayTitle = session.activityTitle?.trim() || "未命名題目";
  const userPrompt = [
    `作文題目：${essayTitle}`,
    `目前事件：fallback kind=${fallbackEvent.kind}, step=${step}, at=${atIso}`,
    `目前子步驟題目：${currentQuestion}`,
    "",
    `本步驟最近對話：\n${sameStepRecent}`,
    "",
    `課程歷史（近似節錄）：\n${crossStepRecent}`
  ].join("\n");

  const reconstructed = [
    "[reconstructed=true] 以下為 fallback 當下近似送給 LLM 的內容重建（非 provider 原始 request body）。",
    "",
    "[system]",
    systemPrompt,
    "",
    "[user]",
    userPrompt
  ].join("\n");

  return {
    source: "session_messages_and_prompt_config",
    prompt: truncate(reconstructed, 5000)
  };
}

export function buildRecentFallbackTraces(input: {
  learningEvents: PersistedEventRow[];
  llmEvents: PersistedEventRow[];
  sessions: SessionState[];
  limit?: number;
}): RecentFallbackTrace[] {
  const limit = typeof input.limit === "number" && input.limit > 0 ? Math.min(20, input.limit) : 8;
  const fallbackEvents = input.learningEvents
    .filter((event) => event.fallback_used)
    .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
    .slice(0, limit);
  const llmErrors = input.llmEvents.filter((event) => typeof event.error_category === "string" && event.error_category.trim().length > 0);
  const sessionById = new Map<string, SessionState>();
  input.sessions.forEach((session) => sessionById.set(session.id, session));

  return fallbackEvents.map((fallbackEvent) => {
    const ownCategory = typeof fallbackEvent.error_category === "string" && fallbackEvent.error_category.trim().length > 0
      ? fallbackEvent.error_category
      : null;
    const matched = ownCategory
      ? null
      : llmErrors
          .filter((llmEvent) => {
            if (llmEvent.session_id && fallbackEvent.session_id && llmEvent.session_id !== fallbackEvent.session_id) return false;
            if (llmEvent.activity_id && fallbackEvent.activity_id && llmEvent.activity_id !== fallbackEvent.activity_id) return false;
            const diffMs = Math.abs(llmEvent.created_at.getTime() - fallbackEvent.created_at.getTime());
            return diffMs <= 2 * 60 * 1000;
          })
          .sort((a, b) => {
            const aDiff = Math.abs(a.created_at.getTime() - fallbackEvent.created_at.getTime());
            const bDiff = Math.abs(b.created_at.getTime() - fallbackEvent.created_at.getTime());
            if (aDiff !== bDiff) return aDiff - bDiff;
            const aSameStep = typeof a.step === "number" && typeof fallbackEvent.step === "number" && a.step === fallbackEvent.step ? 1 : 0;
            const bSameStep = typeof b.step === "number" && typeof fallbackEvent.step === "number" && b.step === fallbackEvent.step ? 1 : 0;
            return bSameStep - aSameStep;
          })[0];

    const session = fallbackEvent.session_id ? sessionById.get(fallbackEvent.session_id) : undefined;
    const reconstructed = buildReconstructedPrompt(fallbackEvent, session);
    return {
      at: fallbackEvent.created_at.toISOString(),
      step: fallbackEvent.step ?? null,
      kind: fallbackEvent.kind,
      sessionId: fallbackEvent.session_id ?? null,
      activityId: fallbackEvent.activity_id ?? null,
      fallbackUsed: fallbackEvent.fallback_used,
      matchedLlmErrorCategory: ownCategory ?? matched?.error_category ?? null,
      sampleErrorSource: ownCategory ? "learning_event" : matched?.error_category ? "matched_llm_event" : "none",
      reconstructionSource: reconstructed.source,
      reconstructedPrompt: reconstructed.prompt
    };
  });
}
