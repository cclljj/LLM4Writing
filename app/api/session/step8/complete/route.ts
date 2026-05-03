import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getCurrentUser } from "@/src/lib/auth-server";
import { getSession, saveSession } from "@/src/lib/store";
import { getStep9QuestionsFromConfig } from "@/src/lib/spec";

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
  const userStep = session.personalSteps?.[user.username] ?? session.currentStep;
  if (userStep !== 8) {
    return NextResponse.json({ error: "invalid_step" }, { status: 400 });
  }

  session.draftStep8[user.username] = body.draft;
  session.personalSteps = session.personalSteps ?? {};
  session.personalSteps[user.username] = 9;
  if ((session.reflectionIndex?.[user.username] ?? 0) === 0) {
    const step9Questions = getStep9QuestionsFromConfig(session.promptConfig?.step9Questions);
    session.messages.push({
      id: randomUUID(),
      role: "system",
      userId: user.username,
      text: `步驟 9 開始：${step9Questions[0]}`,
      at: new Date().toISOString(),
      step: 9
    });
  }
  await saveSession(session);
  return NextResponse.json(session);
}
