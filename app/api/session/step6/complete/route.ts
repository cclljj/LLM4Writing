import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getCurrentUser } from "@/src/lib/auth-server";
import { recordArtifactUpdateSignal } from "@/src/lib/learning-diagnostics";
import { getSession, saveSession } from "@/src/lib/store";
import { isLlmConfigured, llmChatCompletionText, type LlmChatMessage } from "@/src/lib/llm-client";
import { sanitizeStudentFacingText } from "@/src/lib/llm-response";
import { markUserOnline } from "@/src/lib/session-presence";

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

async function buildStep7Feedback(stepPrompt: string | undefined, essay: string): Promise<string> {
  const fallback = "AI 分析回饋：已收到你的文章。建議優先檢查主題句是否明確、段落是否對應論點、例證是否足夠具體，最後再強化結語收束。";
  if (!isLlmConfigured()) return fallback;

  const messages: LlmChatMessage[] = [
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

  try {
    return await llmChatCompletionText({ messages, temperature: 0.5, maxTokens: 800 });
  } catch {
    return fallback;
  }
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "student") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = (await request.json()) as { sessionId?: string; draft?: string };
  if (!body.sessionId || typeof body.draft !== "string") {
    return NextResponse.json({ error: "missing_required_fields" }, { status: 400 });
  }

  const session = await getSession(body.sessionId);
  if (!session) {
    return NextResponse.json({ error: "session_not_found" }, { status: 404 });
  }
  if (!session.participants.includes(user.username)) {
    return NextResponse.json({ error: "not_participant" }, { status: 403 });
  }
  markUserOnline(session, user.username);
  const userStep = session.personalSteps?.[user.username] ?? session.currentStep;
  if (userStep !== 6) {
    return NextResponse.json({ error: "invalid_step" }, { status: 400 });
  }

  const finalDraft = body.draft;
  session.draftStep6[user.username] = finalDraft;
  recordArtifactUpdateSignal(session, "draft6", user.username);
  const feedback = sanitizeStudentFacingText(
    await buildStep7Feedback(session.promptConfig?.stepPrompts?.["7"], finalDraft)
  );
  session.reports.step7[user.username] = feedback;
  session.messages.push(makeAiStep7Message(feedback, user.username));
  session.personalSteps = session.personalSteps ?? {};
  session.personalSteps[user.username] = 8;
  await saveSession(session);
  return NextResponse.json(session);
}
