import { NextRequest, NextResponse } from "next/server";
import { saveSession } from "@/src/lib/store";
import { requireStudentInSession } from "@/src/lib/api-helpers";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as { sessionId?: string };
  const result = await requireStudentInSession(body.sessionId);
  if (result instanceof NextResponse) return result;
  const { user, session } = result;

  const userStep = session.personalSteps?.[user.username] ?? session.currentStep;
  if (userStep !== 5) {
    return NextResponse.json({ error: "invalid_step" }, { status: 400 });
  }
  const ownStep5Report = session.reports?.step5?.[user.username];
  if (!ownStep5Report?.trim()) {
    return NextResponse.json({ error: "step5_summary_not_ready" }, { status: 400 });
  }

  session.personalSteps = session.personalSteps ?? {};
  session.personalSteps[user.username] = 6;
  await saveSession(session);
  return NextResponse.json(session);
}
