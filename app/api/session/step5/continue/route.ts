import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/src/lib/auth-server";
import { getSession, saveSession } from "@/src/lib/store";
import { markUserOnline } from "@/src/lib/session-presence";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "student") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = (await request.json()) as { sessionId?: string };
  if (!body.sessionId) {
    return NextResponse.json({ error: "missing_required_fields" }, { status: 400 });
  }

  const session = await getSession(body.sessionId);
  if (!session) {
    return NextResponse.json({ error: "session_not_found" }, { status: 404 });
  }
  if (!session.participants.includes(user.username)) {
    return NextResponse.json({ error: "not_participant" }, { status: 403 });
  }
  markUserOnline(session.id, user.username);
  const userStep = session.personalSteps?.[user.username] ?? session.currentStep;
  if (userStep !== 5) {
    return NextResponse.json({ error: "invalid_step" }, { status: 400 });
  }
  if (!session.reports?.step5) {
    return NextResponse.json({ error: "step5_summary_not_ready" }, { status: 400 });
  }

  session.personalSteps = session.personalSteps ?? {};
  session.personalSteps[user.username] = 6;
  await saveSession(session);
  return NextResponse.json(session);
}
