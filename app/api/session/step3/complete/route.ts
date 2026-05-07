import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/src/lib/auth-server";
import { recordArtifactUpdateSignal } from "@/src/lib/learning-diagnostics";
import { getSession, saveSession } from "@/src/lib/store";
import { markUserOnline } from "@/src/lib/session-presence";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "student") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = (await request.json()) as { sessionId?: string; outline?: string };
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
  if (session.currentStep !== 3) {
    return NextResponse.json({ error: "invalid_step" }, { status: 400 });
  }
  const outlineText = typeof body.outline === "string" ? body.outline : "";
  session.outlines[user.username] = outlineText;
  recordArtifactUpdateSignal(session, "outline", user.username);
  if (!session.step3SubmittedOutlines) {
    session.step3SubmittedOutlines = {};
  }
  if (!session.step3SubmittedOutlines[user.username]) {
    session.step3SubmittedOutlines[user.username] = outlineText;
  }

  const key = "3-complete";
  const doneUsers = new Set(session.groupGate[key] ?? []);
  doneUsers.add(user.username);
  session.groupGate[key] = Array.from(doneUsers);

  await saveSession(session);
  return NextResponse.json(session);
}
