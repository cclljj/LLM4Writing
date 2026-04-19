import "server-only";

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

function extractTextFromUnknown(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    const parts = value
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object") {
          const record = item as Record<string, unknown>;
          if (typeof record.text === "string") return record.text;
          if (typeof record.content === "string") return record.content;
        }
        return "";
      })
      .filter(Boolean);
    return parts.join("\n");
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (typeof record.text === "string") return record.text;
    if (typeof record.content === "string") return record.content;
  }
  return "";
}

function pickAssistantText(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const record = data as Record<string, unknown>;

  const outputText = extractTextFromUnknown(record.output_text);
  if (outputText.trim()) return outputText.trim();

  const choices = Array.isArray(record.choices) ? record.choices : [];
  const first = choices[0] as Record<string, unknown> | undefined;
  if (first) {
    const message = (first.message as Record<string, unknown> | undefined) ?? undefined;
    const messageContent = extractTextFromUnknown(message?.content);
    if (messageContent.trim()) return messageContent.trim();

    const text = extractTextFromUnknown(first.text);
    if (text.trim()) return text.trim();

    const refusal = extractTextFromUnknown(message?.refusal);
    if (refusal.trim()) return refusal.trim();
  }

  return null;
}

export async function llmChatCompletionText(input: {
  messages: LlmChatMessage[];
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
}): Promise<string> {
  const cfg = getLlmConfig();
  if (!cfg) {
    throw new Error("llm_not_configured_missing_LLM_URL_LLM_KEY_LLM_MODEL");
  }

  const controller = new AbortController();
  const timeoutMs = input.timeoutMs ?? 30_000;
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
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
        messages: input.messages,
        temperature: input.temperature ?? 0.7,
        max_tokens: input.maxTokens ?? 600
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
    const text = pickAssistantText(data);
    if (!text) {
      throw new Error(`llm_missing_assistant_text:${raw.slice(0, 300)}`);
    }
    return text;
  } finally {
    clearTimeout(timeout);
  }
}
