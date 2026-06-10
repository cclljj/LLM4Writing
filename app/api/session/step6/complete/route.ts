import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { recordArtifactUpdateSignal } from "@/src/lib/learning-diagnostics";
import { recordLearningEvent, saveSession } from "@/src/lib/store";
import {
  isLlmConfigured,
  llmChatCompletionText,
  type LlmChatMessage
} from "@/src/lib/llm-client";
import { hasFormalLlmQualityRisk, normalizeFormalLlmText } from "@/src/lib/llm-response";
import { requireStudentInSession, validateTextInput } from "@/src/lib/api-helpers";
import { validateDraftContent } from "@/src/lib/answer-validation";
import { recordStreamingCall } from "@/src/lib/llm-stats";
import { classifyLlmError } from "@/src/lib/llm-observability";
import { appendFallbackDebugTrace, buildPromptText, truncateTraceText } from "@/src/lib/fallback-debug-trace";
import { isMakeupOutlinePending } from "@/src/lib/session-attendance";

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

async function generateStep7FeedbackText(
  messages: LlmChatMessage[],
  telemetry: { sessionId?: string; activityId?: string; step?: number; label?: string }
): Promise<string> {
  const firstRaw = await llmChatCompletionText({
    messages,
    temperature: 0.5,
    maxTokens: 1820,
    timeoutMs: 60_000,
    continueOnTruncation: true,
    continuationMaxRounds: 4,
    telemetry
  });
  const first = normalizeFormalLlmText(firstRaw, { fallback: FALLBACK_FEEDBACK });
  if (!hasFormalLlmQualityRisk(first)) return first;

  const retryRaw = await llmChatCompletionText({
    messages: [
      ...messages,
      {
        role: "user",
        content: "請重新輸出完整且正式的分析回饋：不得重複句段、不得提到截斷或續寫過程、每句要完整收尾。"
      }
    ],
    temperature: 0.4,
    maxTokens: 2080,
    timeoutMs: 75_000,
    continueOnTruncation: true,
    continuationMaxRounds: 5,
    telemetry: { ...telemetry, label: `${telemetry.label ?? "step7_complete"}:retry` }
  });
  return normalizeFormalLlmText(retryRaw, { fallback: FALLBACK_FEEDBACK });
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as { sessionId?: string; draft?: string };
  const draftLenError = validateTextInput(body.draft, "draft"); // #388
  if (draftLenError) return draftLenError;
  const result = await requireStudentInSession(body.sessionId);
  if (result instanceof NextResponse) return result;
  const { user, session } = result;

  const userStep = session.personalSteps?.[user.username] ?? session.currentStep;
  if (userStep !== 6) {
    return NextResponse.json({ error: "invalid_step" }, { status: 400 });
  }
  if (isMakeupOutlinePending(session, user.username)) {
    return NextResponse.json({ error: "makeup_outline_required" }, { status: 409 });
  }

  const finalDraft = body.draft as string;
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
      let usedFallback = false;
      const collected: string[] = [];
      try {
        const promptMessages = buildStep7Messages(session.promptConfig?.stepPrompts?.["7"], finalDraft);
        const originalPrompt = truncateTraceText(buildPromptText(promptMessages));
        if (!isLlmConfigured()) {
          send({ type: "chunk", text: FALLBACK_FEEDBACK });
          collected.push(FALLBACK_FEEDBACK);
          usedFallback = true;
          appendFallbackDebugTrace(session, {
            at: nowIso(),
            step: 7,
            kind: "fallback",
            originalPrompt,
            originalResponse: "(llm_not_configured)",
            rejectionReasons: ["llm_not_configured"],
            errorCategory: "other"
          });
          void recordLearningEvent({
            sessionId: session.id,
            activityId: session.activityId,
            step: 7,
            kind: "fallback",
            fallbackUsed: true,
            errorCategory: "other"
          }).catch(() => undefined);
        } else {
          try {
            const normalized = await generateStep7FeedbackText(promptMessages, {
              sessionId: session.id,
              activityId: session.activityId,
              step: 7,
              label: "step7_complete"
            });
            collected.push(normalized);
            const chunkSize = 120;
            for (let i = 0; i < normalized.length; i += chunkSize) {
              send({ type: "chunk", text: normalized.slice(i, i + chunkSize) });
            }
          } catch (error) {
            if (collected.length === 0) {
              collected.push(FALLBACK_FEEDBACK);
              send({ type: "chunk", text: FALLBACK_FEEDBACK });
              usedFallback = true;
              const category = classifyLlmError(error);
              appendFallbackDebugTrace(session, {
                at: nowIso(),
                step: 7,
                kind: "fallback",
                originalPrompt,
                originalResponse: `(llm_error:${category})`,
                rejectionReasons: ["llm_call_failed"],
                errorCategory: category
              });
              void recordLearningEvent({
                sessionId: session.id,
                activityId: session.activityId,
                step: 7,
                kind: "fallback",
                fallbackUsed: true,
                errorCategory: category
              }).catch(() => undefined);
            }
          }
        }

        const feedback = normalizeFormalLlmText(collected.join(""), { fallback: FALLBACK_FEEDBACK });
        session.reports.step7[user.username] = feedback;
        session.messages.push(makeAiStep7Message(feedback, user.username));
        session.personalSteps = session.personalSteps ?? {};
        session.personalSteps[user.username] = 8;
        await saveSession(session);
        void recordLearningEvent({
          sessionId: session.id,
          activityId: session.activityId,
          step: 7,
          kind: "step7_feedback",
          latencyMs: Date.now() - startedAt,
          fallbackUsed: usedFallback
        }).catch(() => undefined);
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
