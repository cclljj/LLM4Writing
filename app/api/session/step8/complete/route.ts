import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { saveSession } from "@/src/lib/store";
import { getStep9QuestionsFromConfig } from "@/src/lib/spec";
import { getCapabilityStep, requireStudentInSession, validateTextInput } from "@/src/lib/api-helpers";
import { validateDraftContent } from "@/src/lib/answer-validation";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as { sessionId?: string; draft?: string };
  const draftLenError = validateTextInput(body.draft, "draft"); // #388
  if (draftLenError) return draftLenError;
  const result = await requireStudentInSession(body.sessionId);
  if (result instanceof NextResponse) return result;
  const { user, session } = result;

  const userStep = session.personalSteps?.[user.username] ?? session.currentStep;
  const revisionStep = getCapabilityStep(session, "revision");
  const reflectionStep = getCapabilityStep(session, "reflection");
  if (!revisionStep || userStep !== revisionStep) {
    return NextResponse.json({ error: "invalid_step" }, { status: 400 });
  }

  const finalDraft = body.draft as string;
  const draftError = validateDraftContent(session, finalDraft, "最終稿");
  if (draftError) {
    return NextResponse.json({ error: "draft_insufficient", hint: draftError }, { status: 400 });
  }

  session.draftStep8[user.username] = finalDraft;
  session.personalSteps = session.personalSteps ?? {};
  session.personalSteps[user.username] = reflectionStep ?? revisionStep;
  if ((session.reflectionIndex?.[user.username] ?? 0) === 0) {
    const step9Questions = getStep9QuestionsFromConfig(session.promptConfig?.step9Questions);
    const step9Prompt = `請一次回答以下四題：\n1. ${step9Questions[0]}\n2. ${step9Questions[1]}\n3. ${step9Questions[2]}\n4. ${step9Questions[3]}\n\n請在下方依序填答四題後一次送出。`;
    session.messages.push({
      id: randomUUID(),
      role: "system",
      userId: user.username,
      text: step9Prompt,
      at: new Date().toISOString(),
      step: reflectionStep ?? revisionStep
    });
  }
  await saveSession(session);
  return NextResponse.json(session);
}
