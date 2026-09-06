import { NextRequest, NextResponse } from "next/server";
import { saveSession } from "@/src/lib/store";
import { requireStudentInSession } from "@/src/lib/api-helpers";
import { getNextWorkflowStep, getWorkflowStepByCapability } from "@/src/lib/course-workflow";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as { sessionId?: string };
  const result = await requireStudentInSession(body.sessionId);
  if (result instanceof NextResponse) return result;
  const { user, session } = result;

  const userStep = session.personalSteps?.[user.username] ?? session.currentStep;
  const summaryStep = getWorkflowStepByCapability(session, "summary_report")?.step;
  if (!summaryStep || userStep !== summaryStep) {
    return NextResponse.json({ error: "invalid_step" }, { status: 400 });
  }
  const ownStep5Report = session.reports?.step5?.[user.username];
  if (!ownStep5Report?.trim()) {
    return NextResponse.json({ error: "step5_summary_not_ready" }, { status: 400 });
  }

  session.personalSteps = session.personalSteps ?? {};
  session.personalSteps[user.username] = getNextWorkflowStep(session, summaryStep)?.step ?? summaryStep;
  await saveSession(session);
  return NextResponse.json(session);
}
