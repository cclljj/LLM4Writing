import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { recordArtifactUpdateSignal } from "@/src/lib/learning-diagnostics";
import { recordLearningEvent, saveSession } from "@/src/lib/store";
import {
  isLlmConfigured,
  llmChatCompletionText,
  type LlmChatMessage
} from "@/src/lib/llm-client";
import { buildStudentCourseContext } from "@/src/lib/llm-context";
import { hasStep6SuggestionQualityRisk, normalizeStep6SuggestionText } from "@/src/lib/llm-response";
import { requireStudentInSession } from "@/src/lib/api-helpers";
import { recordStreamingCall } from "@/src/lib/llm-stats";

function nowIso(): string {
  return new Date().toISOString();
}

function makeMessage(role: "student" | "ai", step: number, text: string, userId?: string) {
  return {
    id: randomUUID(),
    role,
    userId,
    text,
    at: nowIso(),
    step
  };
}

function buildSuggestMessages(
  stepPrompt: string | undefined,
  essay: string,
  activityTitle: string,
  crossStepContext: string
): LlmChatMessage[] {
  return [
    {
      role: "system",
      content:
        `${stepPrompt ?? "你是寫作教練，請用繁體中文給予可操作、具體的作文修改建議。"}\n\n` +
        "請根據學生文章提供完整且具體的多面向回饋，至少涵蓋：1) 字詞與語句 2) 段落結構 3) 論點與證據 4) 可直接改寫示例句。語氣自然且鼓勵。"
    },
    {
      role: "user",
      content:
        `作文題目：${activityTitle || "未命名題目"}\n\n` +
        `以下是該學生從 Step1 到目前步驟的歷史互動（僅本人 student/ai/必要 system，已做長度限制）：\n${crossStepContext || "(無)"}\n\n` +
        `以下是學生目前文章：\n${essay}`
    }
  ];
}

const FALLBACK_SUGGESTION =
  "AI 建議：已收到你的草稿。建議先強化主論點句，並讓每段都對應一個清楚子論點，再補上具體例子與結語收束。";

function scoreStep6Suggestion(text: string): number {
  const t = text.trim();
  if (!t) return -1;
  const lenScore = Math.min(3000, t.length);
  const keywordScore =
    (/(字詞|語句|用詞)/.test(t) ? 300 : 0) +
    (/(結構|段落)/.test(t) ? 300 : 0) +
    (/(論點|證據|例子|案例)/.test(t) ? 300 : 0) +
    (/(改寫|示例|試試看這樣說)/.test(t) ? 300 : 0);
  const bulletScore = (t.match(/(^|\n)\s*[-•]/g) ?? []).length * 40;
  const sentenceScore = (t.match(/[。！？]/g) ?? []).length * 10;
  return lenScore + keywordScore + bulletScore + sentenceScore;
}

function pickBetterStep6Suggestion(a: string, b: string): string {
  const aRisk = hasStep6SuggestionQualityRisk(a);
  const bRisk = hasStep6SuggestionQualityRisk(b);
  if (aRisk !== bRisk) return aRisk ? b : a;
  const aScore = scoreStep6Suggestion(a);
  const bScore = scoreStep6Suggestion(b);
  if (aScore !== bScore) return aScore > bScore ? a : b;
  return a.length >= b.length ? a : b;
}

async function generateStep6SuggestionText(
  messages: LlmChatMessage[],
  telemetry: { sessionId?: string; activityId?: string; step?: number; label?: string }
): Promise<string> {
  const firstRaw = await llmChatCompletionText({
    messages,
    temperature: 0.6,
    maxTokens: 2340,
    timeoutMs: 75_000,
    continueOnTruncation: true,
    continuationMaxRounds: 6,
    telemetry
  });
  const firstNormalized = normalizeStep6SuggestionText(firstRaw);
  if (!hasStep6SuggestionQualityRisk(firstNormalized)) return firstNormalized;

  const retryRaw = await llmChatCompletionText({
    messages: [
      ...messages,
      {
        role: "user",
        content:
          "請重新輸出一份完整且正式的最終版建議：不得重複句段、不得提到截斷或續寫過程、每句要完整收尾。"
      }
    ],
    temperature: 0.4,
    maxTokens: 2860,
    timeoutMs: 90_000,
    continueOnTruncation: true,
    continuationMaxRounds: 7,
    telemetry: { ...telemetry, label: `${telemetry.label ?? "step6_suggest"}:retry` }
  });
  const retryNormalized = normalizeStep6SuggestionText(retryRaw);
  return pickBetterStep6Suggestion(firstNormalized, retryNormalized);
}

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

  const draft = body.draft;
  session.draftStep6[user.username] = draft;
  recordArtifactUpdateSignal(session, "draft6", user.username);
  const crossStepContext = buildStudentCourseContext(session, user.username, 6, {
    maxMessages: 48,
    maxChars: 6500,
    includeSystem: true
  });

  const timestamp = nowIso();
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
        if (!isLlmConfigured()) {
          send({ type: "chunk", text: FALLBACK_SUGGESTION });
          collected.push(FALLBACK_SUGGESTION);
          usedFallback = true;
          void recordLearningEvent({
            sessionId: session.id,
            activityId: session.activityId,
            step: 6,
            kind: "fallback",
            fallbackUsed: true
          }).catch(() => undefined);
        } else {
          const messages = buildSuggestMessages(
            session.promptConfig?.stepPrompts?.["6"],
            draft,
            session.activityTitle ?? "",
            crossStepContext
          );
          try {
            const normalized = await generateStep6SuggestionText(messages, {
              sessionId: session.id,
              activityId: session.activityId,
              step: 6,
              label: "step6_suggest"
            });
            collected.push(normalized);
            const chunkSize = 120;
            for (let i = 0; i < normalized.length; i += chunkSize) {
              send({ type: "chunk", text: normalized.slice(i, i + chunkSize) });
            }
          } catch {
            if (collected.length === 0) {
              collected.push(FALLBACK_SUGGESTION);
              send({ type: "chunk", text: FALLBACK_SUGGESTION });
              usedFallback = true;
              void recordLearningEvent({
                sessionId: session.id,
                activityId: session.activityId,
                step: 6,
                kind: "fallback",
                fallbackUsed: true
              }).catch(() => undefined);
            }
          }
        }

        const suggestion = normalizeStep6SuggestionText(collected.join(""));
        const logText = [
          "### Step6 AI 修改建議",
          `- 時間：${timestamp}`,
          "- 文章內容：",
          draft || "（目前無內容）",
          "- AI 建議：",
          suggestion
        ].join("\n");

        session.messages.push(makeMessage("student", 6, "我想請 AI 提供修改建議。", user.username));
        session.messages.push(makeMessage("ai", 6, logText, user.username));

        await saveSession(session);
        void recordLearningEvent({
          sessionId: session.id,
          activityId: session.activityId,
          step: 6,
          kind: "step6_suggest",
          latencyMs: Date.now() - startedAt,
          fallbackUsed: usedFallback
        }).catch(() => undefined);
        send({ type: "done", session });
      } catch (err) {
        errored = true;
        send({ type: "error", error: err instanceof Error ? err.message : "step6_suggest_failed" });
      } finally {
        recordStreamingCall("step6_suggest", Date.now() - startedAt, errored);
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
