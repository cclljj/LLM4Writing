import { NextRequest, NextResponse } from "next/server";
import { saveSession } from "@/src/lib/store";
import {
  isLlmConfigured,
  llmChatCompletionStream
} from "@/src/lib/llm-client";
import { sanitizeStudentFacingText } from "@/src/lib/llm-response";
import { requireStudentInSession } from "@/src/lib/api-helpers";
import { buildStep10LlmInput, recordStep10Report } from "@/src/lib/engine";
import { recordStreamingCall } from "@/src/lib/llm-stats";

/**
 * SSE-streamed endpoint for the Step 10 final report (#241).
 *
 * Pre-conditions:
 *   - Caller is a session participant
 *   - Caller's personal step is 10
 *   - No existing step 10 report (or caller explicitly opts to regenerate — currently
 *     not supported; we just no-op when a report already exists)
 *
 * Behavior:
 *   - When LLM is configured: streams chunks via `text/event-stream` and finalizes
 *     by saving the assembled report to the session.
 *   - When LLM is not configured: emits a single fallback chunk and finalizes.
 *   - When a report already exists: emits a `done` event with the current session
 *     immediately (idempotent for client retries).
 */
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as { sessionId?: string };
  const result = await requireStudentInSession(body.sessionId);
  if (result instanceof NextResponse) return result;
  const { user, session } = result;

  const userStep = session.personalSteps?.[user.username] ?? session.currentStep;
  if (userStep !== 10) {
    return NextResponse.json({ error: "invalid_step" }, { status: 400 });
  }

  const existing = session.reports.step10?.[user.username]?.trim() ?? "";
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };

      const startedAt = Date.now();
      let errored = false;
      try {
        if (existing) {
          // Idempotent: client retried after report already saved.
          send({ type: "chunk", text: existing });
          send({ type: "done", session });
          return;
        }

        const { messages, fallback } = buildStep10LlmInput(session, user.username);
        const collected: string[] = [];

        if (!isLlmConfigured()) {
          send({ type: "chunk", text: fallback });
          collected.push(fallback);
        } else {
          try {
            for await (const delta of llmChatCompletionStream({
              messages,
              temperature: 0.6,
              maxTokens: 1200
            })) {
              collected.push(delta);
              send({ type: "chunk", text: delta });
            }
          } catch {
            if (collected.length === 0) {
              collected.push(fallback);
              send({ type: "chunk", text: fallback });
            }
          }
        }

        const report = sanitizeStudentFacingText(collected.join(""));
        recordStep10Report(session, user.username, report);
        await saveSession(session);
        send({ type: "done", session });
      } catch (err) {
        errored = true;
        send({ type: "error", error: err instanceof Error ? err.message : "step10_stream_failed" });
      } finally {
        recordStreamingCall("step10_stream", Date.now() - startedAt, errored);
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no"
    }
  });
}
