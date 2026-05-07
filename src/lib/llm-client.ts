import "server-only";
import { isTruncatedFinishReason, pickAssistantTextResult } from "@/src/lib/llm-openai-response";

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
}): Promise<string> {
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

      if (!continueOnTruncation || !isTruncatedFinishReason(result.finishReason) || round >= continuationMaxRounds) {
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

    return collected.join("\n").trim();
  } finally {
    clearTimeout(timeout);
  }
}
