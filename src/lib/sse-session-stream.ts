// Shared reader for the step3/step6/step7/step10 session SSE endpoints (#459).
// Mirrors the loop previously duplicated four times in app/student/page.tsx:
// "data:" lines carry chunk/done/error events; malformed lines are ignored;
// the stream stops at the first done/error event.

export type SseSessionResult<TSession> = {
  finalSession: TSession | null;
  streamError: string;
};

export async function readSseSessionStream<TSession>(
  body: ReadableStream<Uint8Array>,
  opts: {
    defaultError: string;
    onChunk: (accumulatedText: string) => void;
  }
): Promise<SseSessionResult<TSession>> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let liveText = "";
  let finalSession: TSession | null = null;
  let streamError = "";
  outer: while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";
    for (const part of parts) {
      const line = part.trim();
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload) continue;
      try {
        const event = JSON.parse(payload) as
          | { type: "chunk"; text: string }
          | { type: "done"; session: TSession }
          | { type: "error"; error?: string };
        if (event.type === "chunk") {
          liveText += event.text;
          opts.onChunk(liveText);
        } else if (event.type === "done") {
          finalSession = event.session;
          break outer;
        } else if (event.type === "error") {
          streamError = event.error ?? opts.defaultError;
          break outer;
        }
      } catch {
        // Ignore malformed event lines.
      }
    }
  }
  return { finalSession, streamError };
}
