import { NextRequest, NextResponse } from "next/server";
import { requireStudentInSession } from "@/src/lib/api-helpers";
import { rerunStep5SummaryForUser } from "@/src/lib/engine";
import { saveSession } from "@/src/lib/store";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as { sessionId?: string };
  const result = await requireStudentInSession(body.sessionId);
  if (result instanceof NextResponse) return result;
  const { user, session } = result;

  const userStep = session.personalSteps?.[user.username] ?? session.currentStep;
  if (userStep !== 6) {
    return NextResponse.json({ error: "invalid_step" }, { status: 400 });
  }

  try {
    await rerunStep5SummaryForUser(session, user.username);
    await saveSession(session);
    return NextResponse.json(session);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "step5_rerun_failed" },
      { status: 400 }
    );
  }
}
