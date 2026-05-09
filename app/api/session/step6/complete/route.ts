import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { recordArtifactUpdateSignal } from "@/src/lib/learning-diagnostics";
import { saveSession } from "@/src/lib/store";
import {
  isLlmConfigured,
  llmChatCompletionText,
  type LlmChatMessage
} from "@/src/lib/llm-client";
import { sanitizeStudentFacingText } from "@/src/lib/llm-response";
import { requireStudentInSession } from "@/src/lib/api-helpers";
import { validateDraftContent } from "@/src/lib/answer-validation";
import { recordStreamingCall } from "@/src/lib/llm-stats";

function nowIso(): string {
  return new Date().toISOString();
}

function makeAiStep7Message(text: string, userId?: string) {
  return {
    id: randomUUID(),
    role: "ai" as const,
    userId,
    text,
    at: nowIso(),
    step: 7
  };
}

function buildStep7Messages(stepPrompt: string | undefined, essay: string): LlmChatMessage[] {
  return [
    {
      role: "system",
      content:
        `${stepPrompt ?? "你是寫作分析教練，請用繁體中文給出具體、可執行的分析回饋。"}\n\n` +
        "請針對文章輸出：1) 優點 2) 可改進處 3) 具體修改建議。語氣專業且清楚。"
    },
    {
      role: "user",
      content: `學生最終版本文章如下：\n${essay || "（目前無內容）"}`
    }
  ];
}

const FALLBACK_FEEDBACK =
  "AI 分析回饋：已收到你的文章。建議優先檢查主題句是否明確、段落是否對應論點、例證是否足夠具體，最後再強化結語收束。";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as { sessionId?: string; draft?: string };
  if (typeof body.draft !== "string") {
    return NextResponse.json({ error: "missing_required_fields" }, { status: 400 });
  }
  const result = await requireStudentInSession(body.sessionId);
  if (result instanceof NextResponse) return result;
  const { user, session } = result;

  const userStep = session.personalSteps?.[user.username] ?? session.currentStep;
  if (userStep !== 6) {
    return NextResponse.json({ error: "invalid_step" }, { status: 400 });
  }

  const finalDraft = body.draft;
  const draftError = validateDraftContent(session, finalDraft, "初稿");
  if (draftError) {
    return NextResponse.json({ error: "draft_insufficient", hint: draftError }, { status: 400 });
  }

  session.draftStep6[user.username] = finalDraft;
  recordArtifactUpdateSignal(session, "draft6", user.username);

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };

      const startedAt = Date.now();
      let errored = false;
      const collected: string[] = [];
      try {
        if (!isLlmConfigured()) {
          send({ type: "chunk", text: FALLBACK_FEEDBACK });
          collected.push(FALLBACK_FEEDBACK);
        } else {
          const messages = buildStep7Messages(session.promptConfig?.stepPrompts?.["7"], finalDraft);
          try {
            const fullText = await llmChatCompletionText({
              messages,
              temperature: 0.5,
              maxTokens: 1400,
              timeoutMs: 60_000,
              continueOnTruncation: true,
              continuationMaxRounds: 4
            });
            if (fullText.trim()) {
              const normalized = fullText.trim();
              collected.push(normalized);
              const chunkSize = 120;
              for (let i = 0; i < normalized.length; i += chunkSize) {
                send({ type: "chunk", text: normalized.slice(i, i + chunkSize) });
              }
            }
          } catch {
            if (collected.length === 0) {
              collected.push(FALLBACK_FEEDBACK);
              send({ type: "chunk", text: FALLBACK_FEEDBACK });
            }
          }
        }

        const feedback = sanitizeStudentFacingText(collected.join(""));
        session.reports.step7[user.username] = feedback;
        session.messages.push(makeAiStep7Message(feedback, user.username));
        session.personalSteps = session.personalSteps ?? {};
        session.personalSteps[user.username] = 8;
        await saveSession(session);
        send({ type: "done", session });
      } catch (err) {
        errored = true;
        send({ type: "error", error: err instanceof Error ? err.message : "step7_complete_failed" });
      } finally {
        recordStreamingCall("step6_complete", Date.now() - startedAt, errored);
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
