import { NextResponse } from "next/server";
import { getCurrentUser } from "@/src/lib/auth-server";
import { listSessions } from "@/src/lib/store";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "teacher") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const sessions = await listSessions();
  const legacySessions = sessions
    .filter((s) => s.workflow === "legacy_phase")
    .map((s) => ({
      sessionId: s.id,
      activityId: s.activityId,
      activityTitle: s.activityTitle,
      participants: s.participants,
      currentStep: s.currentStep,
      messages: s.messages.slice(-20)
    }));

  return NextResponse.json({ sessions: legacySessions });
}
