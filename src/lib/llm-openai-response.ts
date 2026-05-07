export type AssistantTextResult = {
  text: string | null;
  finishReason?: string | null;
};

export function extractTextFromUnknown(value: unknown): string {
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

function readFinishReason(firstChoice: Record<string, unknown> | undefined, response: Record<string, unknown>): string | null {
  const raw = firstChoice?.finish_reason ?? firstChoice?.finishReason ?? response.finish_reason ?? response.finishReason;
  return typeof raw === "string" && raw.trim() ? raw.trim() : null;
}

export function pickAssistantTextResult(data: unknown): AssistantTextResult {
  if (!data || typeof data !== "object") return { text: null, finishReason: null };
  const record = data as Record<string, unknown>;

  const choices = Array.isArray(record.choices) ? record.choices : [];
  const first = choices[0] as Record<string, unknown> | undefined;
  const finishReason = readFinishReason(first, record);

  const outputText = extractTextFromUnknown(record.output_text);
  if (outputText.trim()) return { text: outputText.trim(), finishReason };

  if (first) {
    const message = (first.message as Record<string, unknown> | undefined) ?? undefined;
    const messageContent = extractTextFromUnknown(message?.content);
    if (messageContent.trim()) return { text: messageContent.trim(), finishReason };

    const text = extractTextFromUnknown(first.text);
    if (text.trim()) return { text: text.trim(), finishReason };

    const refusal = extractTextFromUnknown(message?.refusal);
    if (refusal.trim()) return { text: refusal.trim(), finishReason };
  }

  return { text: null, finishReason };
}

export function isTruncatedFinishReason(reason?: string | null): boolean {
  const normalized = (reason ?? "").toLowerCase();
  if (!normalized) return false;
  return normalized === "length" || normalized === "max_tokens" || normalized === "max_output_tokens" || normalized.includes("length") || normalized.includes("token");
}
