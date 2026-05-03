import { NextResponse } from "next/server";
import { getSession, saveSession } from "@/src/lib/store";
import { reconcileCompletedStep9Users } from "@/src/lib/engine";
import { hydrateDomainState, resolvePromptConfigForActivity } from "@/src/lib/mock-data";

export async function GET(_: Request, context: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await context.params;
  const session = await getSession(sessionId);

  if (!session) {
    return NextResponse.json({ error: "session_not_found" }, { status: 404 });
  }
  let changed = false;
  await hydrateDomainState();
  if (session.activityId) {
    const resolvedConfig = resolvePromptConfigForActivity(session.activityId);
    const nextStepOpenings = {
      ...(resolvedConfig.stepOpenings ?? {}),
      ...(session.promptConfig?.stepOpenings ?? {})
    };
    const hadStepOpenings = Boolean(session.promptConfig?.stepOpenings && Object.keys(session.promptConfig.stepOpenings).length > 0);
    if (!hadStepOpenings) {
      session.promptConfig = {
        ...resolvedConfig,
        ...session.promptConfig,
        stepOpenings: nextStepOpenings
      };
      changed = true;
    }
  }
  if (!session.step3SubmittedOutlines || typeof session.step3SubmittedOutlines !== "object") {
    session.step3SubmittedOutlines = {};
    changed = true;
  }
  if (session.currentStep >= 4) {
    const doneUsers = new Set(session.groupGate?.["3-complete"] ?? []);
    session.participants.forEach((participant) => {
      if (!doneUsers.has(participant)) return;
      const snapshot = session.step3SubmittedOutlines?.[participant]?.trim() ?? "";
      const outline = session.outlines?.[participant]?.trim() ?? "";
      if (!snapshot && outline) {
        session.step3SubmittedOutlines![participant] = outline;
        changed = true;
      }
    });
  }
  const reconciled = await reconcileCompletedStep9Users(session);
  if (reconciled) {
    changed = true;
  }
  if (changed) {
    await saveSession(session);
  }

  return NextResponse.json(session);
}
