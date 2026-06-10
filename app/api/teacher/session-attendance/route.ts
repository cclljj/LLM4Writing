import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/src/lib/auth-server";
import { recordAuditLog } from "@/src/lib/audit-log-store";
import { setWaitingExclusion } from "@/src/lib/session-attendance";
import { canAccessTeacherSession } from "@/src/lib/teacher-session-access";
import { getSession, saveSession } from "@/src/lib/store";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || (user.role !== "teacher" && user.role !== "admin")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = (await request.json()) as { sessionId?: string; username?: string; excluded?: boolean };
  const sessionId = body.sessionId?.trim() ?? "";
  const username = body.username?.trim() ?? "";
  if (!sessionId || !username || typeof body.excluded !== "boolean") {
    return NextResponse.json({ error: "missing_required_fields" }, { status: 400 });
  }

  const session = await getSession(sessionId);
  if (!session) return NextResponse.json({ error: "session_not_found" }, { status: 404 });
  if (!(await canAccessTeacherSession(user, session))) {
    return NextResponse.json({ error: "forbidden_session" }, { status: 403 });
  }
  if (!session.participants.includes(username)) {
    return NextResponse.json({ error: "not_session_participant" }, { status: 400 });
  }

  setWaitingExclusion(session, { username, excluded: body.excluded, by: user.username });
  const saved = await saveSession(session);

  void recordAuditLog({
    actorUsername: user.username,
    actorRole: user.role,
    action: "session_waiting_exclusion",
    targetType: "session",
    targetId: saved.id,
    targetLabel: saved.groupName ?? saved.groupId ?? saved.id,
    details: {
      activityId: saved.activityId ?? "",
      username,
      excluded: body.excluded,
      currentStep: saved.currentStep
    }
  }).catch(() => undefined);

  return NextResponse.json(saved);
}
