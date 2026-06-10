import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/src/lib/auth-server";
import { recordArtifactUpdateSignal } from "@/src/lib/learning-diagnostics";
import { getSession, saveSession } from "@/src/lib/store";
import { markUserOnline } from "@/src/lib/session-presence";
import { isMakeupOutlinePending } from "@/src/lib/session-attendance";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "student") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = (await request.json()) as {
    sessionId?: string;
    type?: "outline" | "draft6" | "draft8";
    content?: string;
  };

  if (!body.sessionId || !body.type || body.content === undefined) {
    return NextResponse.json({ error: "missing_required_fields" }, { status: 400 });
  }
  if (typeof body.content === "string" && body.content.length > 10_000) { // #388
    return NextResponse.json({ error: "input_too_long", field: "content", maxLength: 10_000 }, { status: 400 });
  }

  const session = await getSession(body.sessionId);
  if (!session) {
    return NextResponse.json({ error: "session_not_found" }, { status: 404 });
  }

  if (!session.participants.includes(user.username)) {
    return NextResponse.json({ error: "not_participant" }, { status: 403 });
  }
  await markUserOnline(session.id, user.username);

  if (body.type === "outline") {
    const completedUsers = new Set(session.groupGate?.["3-complete"] ?? []);
    const reopenedUsers = new Set(session.groupGate?.["3-reopen"] ?? []);
    const canEditForMakeup = isMakeupOutlinePending(session, user.username);
    if (completedUsers.has(user.username) && !reopenedUsers.has(user.username) && !canEditForMakeup) {
      return NextResponse.json({ error: "step3_outline_locked_after_completion" }, { status: 409 });
    }
    session.outlines[user.username] = body.content;
    recordArtifactUpdateSignal(session, "outline", user.username);
  }

  if (body.type === "draft6") {
    session.draftStep6[user.username] = body.content;
    recordArtifactUpdateSignal(session, "draft6", user.username);
  }

  if (body.type === "draft8") {
    session.draftStep8[user.username] = body.content;
    recordArtifactUpdateSignal(session, "draft8", user.username);
  }

  await saveSession(session);
  return NextResponse.json(session);
}
