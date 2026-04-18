import { NextResponse } from "next/server";
import { getCurrentUser } from "@/src/lib/auth-server";
import { listSessions } from "@/src/lib/store";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "teacher") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const sessions = await listSessions();
  const activeSessions = sessions
    .filter((s) => s.workflow === "spec10")
    .map((s) => ({
      sessionId: s.id,
      activityId: s.activityId,
      activityTitle: s.activityTitle,
      groupId: s.groupId,
      groupName: s.groupName,
      participants: s.participants,
      currentStep: s.currentStep,
      messages: s.messages
    }));

  return NextResponse.json({ sessions: activeSessions });
}
