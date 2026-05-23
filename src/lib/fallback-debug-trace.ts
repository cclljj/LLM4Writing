import type { FallbackDebugTrace, SessionState } from "@/src/lib/types";

export function truncateTraceText(text: string, maxChars = 6000): string {
  const normalized = text.trim();
  if (normalized.length <= maxChars) return normalized;
  return `${normalized.slice(0, maxChars - 1)}…`;
}

export function buildPromptText(messages: Array<{ role: string; content: string }>): string {
  return messages
    .map((message) => `[${message.role}]\n${message.content}`)
    .join("\n\n");
}

export function appendFallbackDebugTrace(session: SessionState, trace: FallbackDebugTrace): void {
  session.step12FallbackDebugTraces = Array.isArray(session.step12FallbackDebugTraces)
    ? session.step12FallbackDebugTraces
    : [];
  session.step12FallbackDebugTraces.push(trace);
  if (session.step12FallbackDebugTraces.length > 120) {
    session.step12FallbackDebugTraces.splice(0, session.step12FallbackDebugTraces.length - 120);
  }
}
