import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getCurrentUser } from "@/src/lib/auth-server";
import { recordArtifactUpdateSignal } from "@/src/lib/learning-diagnostics";
import { getSession, saveSession } from "@/src/lib/store";
import { isLlmConfigured, llmChatCompletionText, type LlmChatMessage } from "@/src/lib/llm-client";
import { buildStudentCourseContext } from "@/src/lib/llm-context";
import { markUserOnline } from "@/src/lib/session-presence";

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

async function suggestWithLlm(
  stepPrompt: string | undefined,
  essay: string,
  activityTitle: string,
  crossStepContext: string
): Promise<string> {
  const fallback = "AI 建議：已收到你的草稿。建議先強化主論點句，並讓每段都對應一個清楚子論點，再補上具體例子與結語收束。";
  if (!isLlmConfigured()) return fallback;

  const messages: LlmChatMessage[] = [
    {
      role: "system",
      content:
        `${stepPrompt ?? "你是寫作教練，請用繁體中文給予可操作、具體的作文修改建議。"}\n\n` +
        "請根據學生文章提供：1) 結構建議 2) 論點與證據建議 3) 可直接改寫的示例句。語氣自然且鼓勵。"
    },
    {
      role: "user",
      content:
        `作文題目：${activityTitle || "未命名題目"}\n\n` +
        `以下是該學生從 Step1 到目前步驟的歷史互動（僅本人 student/ai/必要 system，已做長度限制）：\n${crossStepContext || "(無)"}\n\n` +
        `以下是學生目前文章：\n${essay}`
    }
  ];

  try {
    return await llmChatCompletionText({ messages, temperature: 0.6, maxTokens: 700 });
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
  if (!session) return NextResponse.json({ error: "session_not_found" }, { status: 404 });
  if (!session.participants.includes(user.username)) {
    return NextResponse.json({ error: "not_participant" }, { status: 403 });
  }
  markUserOnline(session, user.username);
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
  const suggestion = await suggestWithLlm(
    session.promptConfig?.stepPrompts?.["6"],
    draft,
    session.activityTitle ?? "",
    crossStepContext
  );
  const logText = [
    "### Step6 AI 修改建議",
    `- 時間：${timestamp}`,
    "- 文章內容：",
    draft || "（目前無內容）",
    "- AI 建議：",
    suggestion
  ].join("\n");

  session.messages.push(makeMessage("student", 6, `我想請 AI 提供修改建議。`, user.username));
  session.messages.push(makeMessage("ai", 6, logText, user.username));

  await saveSession(session);
  return NextResponse.json(session);
}
