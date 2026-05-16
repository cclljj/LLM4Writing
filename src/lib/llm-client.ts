import "server-only";
import { isTruncatedFinishReason, pickAssistantTextResult } from "@/src/lib/llm-openai-response";
import { classifyLlmError, recordLlmCall, withLlmEventContext, type LlmEventContext } from "@/src/lib/llm-observability";

export type LlmChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type LlmConfig = {
  url: string;
  key: string;
  model: string;
};

function readEnv(name: string): string | undefined {
  const v = process.env[name];
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

export function getLlmConfig(): LlmConfig | null {
  const url = readEnv("LLM_URL");
  const key = readEnv("LLM_KEY") ?? readEnv("LLM_key"); // tolerate common casing mistake
  const model = readEnv("LLM_MODEL");

  if (!url || !key || !model) return null;
  return { url, key, model };
}

export function isLlmConfigured(): boolean {
  return getLlmConfig() !== null;
}

export async function llmChatCompletionText(input: {
  messages: LlmChatMessage[];
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  continueOnTruncation?: boolean;
  continuationMaxRounds?: number;
  telemetry?: LlmEventContext;
}): Promise<string> {
  return withLlmEventContext(input.telemetry ?? {}, async () => {
  const startedAt = Date.now();
  const cfg = getLlmConfig();
  if (!cfg) {
    throw new Error("llm_not_configured_missing_LLM_URL_LLM_KEY_LLM_MODEL");
  }

  const controller = new AbortController();
  const timeoutMs = input.timeoutMs ?? 30_000;
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  const continueOnTruncation = input.continueOnTruncation ?? true;
  const continuationMaxRounds = input.continuationMaxRounds ?? 1;
  const collected: string[] = [];
  let messages = input.messages;
  let hadTruncation = false;

  try {
    for (let round = 0; round <= continuationMaxRounds; round += 1) {
      const res = await fetch(cfg.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${cfg.key}`,
          // These are harmless for non-OpenRouter providers; OpenRouter may use them for analytics/rate limits.
          "X-Title": "llm4writing",
          "HTTP-Referer": "https://vercel.app"
        },
        body: JSON.stringify({
          model: cfg.model,
          messages,
          temperature: input.temperature ?? 0.7,
          max_tokens: input.maxTokens ?? 900
        }),
        signal: controller.signal
      });

      // Avoid "Unexpected end of JSON input" by reading as text first.
      const raw = await res.text();
      if (!res.ok) {
        throw new Error(`llm_http_${res.status}:${raw.slice(0, 300)}`);
      }
      if (!raw.trim()) {
        throw new Error("llm_empty_response_body");
      }

      const data = JSON.parse(raw) as unknown;
      const result = pickAssistantTextResult(data);
      const text = result.text;
      if (!text) {
        throw new Error(`llm_missing_assistant_text:${raw.slice(0, 300)}`);
      }
      collected.push(text);

      const truncated = isTruncatedFinishReason(result.finishReason);
      if (truncated) hadTruncation = true;

      if (!continueOnTruncation || !truncated || round >= continuationMaxRounds) {
        recordLlmCall({ kind: "chat", durationMs: Date.now() - startedAt, hadTruncation });
        return collected.join("\n").trim();
      }

      messages = [
        ...input.messages,
        {
          role: "assistant",
          content: collected.join("\n")
        },
        {
          role: "user",
          content: "你的上一則回覆因長度限制被截斷。請從中斷處自然接續完成，不要重複已寫過的內容。"
        }
      ];
    }

    recordLlmCall({ kind: "chat", durationMs: Date.now() - startedAt, hadTruncation });
    return collected.join("\n").trim();
  } catch (error) {
    recordLlmCall({
      kind: "chat",
      durationMs: Date.now() - startedAt,
      hadTruncation,
      errorCategory: classifyLlmError(error)
    });
    throw error;
  } finally {
    clearTimeout(timeout);
  }
  });
}

/**
 * Streams chat completion deltas from the configured LLM provider.
 * Yields incremental text chunks as they arrive (OpenAI-compatible SSE format).
 *
 * Notes:
 * - Caller is responsible for accumulating the full text if needed.
 * - Throws if LLM is not configured or the HTTP request fails.
 * - Malformed SSE lines are skipped silently to be robust against provider quirks.
 */
export async function* llmChatCompletionStream(input: {
  messages: LlmChatMessage[];
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  telemetry?: LlmEventContext;
}): AsyncGenerator<string, void, unknown> {
  const startedAt = Date.now();
  const cfg = getLlmConfig();
  if (!cfg) {
    throw new Error("llm_not_configured_missing_LLM_URL_LLM_KEY_LLM_MODEL");
  }

  const controller = new AbortController();
  const timeoutMs = input.timeoutMs ?? 60_000;
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let parseFailCount = 0;
  let emittedChunks = 0;

  try {
    const res = await fetch(cfg.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cfg.key}`,
        Accept: "text/event-stream",
        "X-Title": "llm4writing",
        "HTTP-Referer": "https://vercel.app"
      },
      body: JSON.stringify({
        model: cfg.model,
        messages: input.messages,
        temperature: input.temperature ?? 0.7,
        max_tokens: input.maxTokens ?? 900,
        stream: true
      }),
      signal: controller.signal
    });

    if (!res.ok || !res.body) {
      const raw = await res.text().catch(() => "");
      throw new Error(`llm_http_${res.status}:${raw.slice(0, 300)}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const payload = trimmed.slice(5).trim();
        if (payload === "[DONE]") return;
        try {
          const parsed = JSON.parse(payload) as {
            choices?: Array<{ delta?: { content?: string } }>;
          };
          const delta = parsed.choices?.[0]?.delta?.content;
          if (typeof delta === "string" && delta.length > 0) {
            emittedChunks += 1;
            yield delta;
          }
        } catch {
          // Skip malformed SSE lines; some providers emit keep-alives or comments.
          parseFailCount += 1;
        }
      }
    }
    recordLlmCall({
      kind: "stream",
      durationMs: Date.now() - startedAt,
      errorCategory: emittedChunks === 0 && parseFailCount > 0 ? "parse_fail" : undefined
    });
  } catch (error) {
    recordLlmCall({
      kind: "stream",
      durationMs: Date.now() - startedAt,
      errorCategory: classifyLlmError(error)
    });
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
