import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { saveSession } from "@/src/lib/store";
import {
  isLlmConfigured,
  llmChatCompletionStream,
  type LlmChatMessage
} from "@/src/lib/llm-client";
import { buildStudentCourseContext } from "@/src/lib/llm-context";
import { sanitizeStudentFacingText } from "@/src/lib/llm-response";
import { recordRejectedAnswerSignal } from "@/src/lib/learning-diagnostics";
import { requireStudentInSession } from "@/src/lib/api-helpers";
import { validateStudentAnswer } from "@/src/lib/answer-validation";
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

function buildStep3Messages(
  systemPrompt: string | undefined,
  stepPrompt: string | undefined,
  activityTitle: string,
  sameStepRecent: string,
  crossStepContext: string,
  studentText: string
): LlmChatMessage[] {
  return [
    {
      role: "system",
      content:
        [
          systemPrompt,
          stepPrompt,
          "目前步驟：3（生成論點）。請嚴格遵守步驟與輸出格式要求。",
          "請依據 Step 3 的角色、目標與輸出格式，僅針對學生提問給出回覆與建議。禁止主動提問、禁止要求學生再回答新問題。請用自然、擬人化、像老師與學生對話的語氣回覆，不要使用生硬標題或固定模板標籤。"
        ]
          .filter(Boolean)
          .join("\n\n")
    },
    {
      role: "user",
      content:
        `作文題目：${activityTitle || "未命名題目"}\n\n` +
        `以下是本步驟最近對話內容：\n${sameStepRecent || "(無)"}\n\n` +
        `以下是該學生從 Step1 到目前步驟的歷史互動（僅本人 student/ai/必要 system，已做長度限制）：\n${crossStepContext || "(無)"}\n\n` +
        `學生最新提問或想法：${studentText}`
    }
  ];
}

const FALLBACK_STEP3 =
  "AI 回覆：已收到你的想法。請先整理一個清楚主張，並列出 2 到 3 個支持重點，把它們放進結構樹節點。";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as { sessionId?: string; text?: string };
  if (typeof body.text !== "string") {
    return NextResponse.json({ error: "missing_required_fields" }, { status: 400 });
  }
  const studentText = body.text;

  const result = await requireStudentInSession(body.sessionId);
  if (result instanceof NextResponse) return result;
  const { user, session } = result;

  const userStep = session.personalSteps?.[user.username] ?? session.currentStep;
  if (userStep !== 3) {
    return NextResponse.json({ error: "invalid_step" }, { status: 400 });
  }

  const validationError = validateStudentAnswer(session, user.username, 3, studentText);
  if (validationError) {
    recordRejectedAnswerSignal(session, user.username, "step-3", nowIso());
    await saveSession(session).catch(() => undefined);
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  session.messages.push(makeMessage("student", 3, studentText, user.username));

  const sameStepRecent = session.messages
    .filter((m) => m.step === 3)
    .slice(-10)
    .map((m) => {
      if (m.role === "student") return `學生${m.userId ? `(${m.userId})` : ""}：${m.text}`;
      if (m.role === "ai") return `AI：${m.text}`;
      return `系統：${m.text}`;
    })
    .join("\n");
  const crossStepContext = buildStudentCourseContext(session, user.username, 3, {
    maxMessages: 48,
    maxChars: 6500,
    includeSystem: true
  });

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
          collected.push(FALLBACK_STEP3);
          send({ type: "chunk", text: FALLBACK_STEP3 });
        } else {
          const messages = buildStep3Messages(
            session.promptConfig?.systemPrompt,
            session.promptConfig?.stepPrompts?.["3"],
            session.activityTitle ?? "",
            sameStepRecent,
            crossStepContext,
            studentText
          );
          try {
            for await (const delta of llmChatCompletionStream({
              messages,
              temperature: 0.6,
              maxTokens: 600
            })) {
              collected.push(delta);
              send({ type: "chunk", text: delta });
            }
          } catch {
            if (collected.length === 0) {
              collected.push(FALLBACK_STEP3);
              send({ type: "chunk", text: FALLBACK_STEP3 });
            }
          }
        }

        const aiText = sanitizeStudentFacingText(collected.join(""));
        session.messages.push(makeMessage("ai", 3, aiText, user.username));
        await saveSession(session);
        send({ type: "done", session });
      } catch (err) {
        errored = true;
        send({ type: "error", error: err instanceof Error ? err.message : "step3_stream_failed" });
      } finally {
        recordStreamingCall("step3_stream", Date.now() - startedAt, errored);
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
