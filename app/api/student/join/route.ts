import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/src/lib/auth-server";
import { createSession } from "@/src/lib/engine";
import { findActivity } from "@/src/lib/mock-data";
import { listSessions, saveSession } from "@/src/lib/store";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "student") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = (await request.json()) as { activityId?: string };
  const activityId = body.activityId ?? "";
  const activity = findActivity(activityId);
  if (!activity) {
    return NextResponse.json({ error: "activity_not_found" }, { status: 404 });
  }

  const group = activity.groups.find((g) => g.members.includes(user.username));
  if (!group) {
    return NextResponse.json({ error: "not_group_member" }, { status: 403 });
  }

  const sessions = await listSessions();
  const existing = sessions.find(
    (s) => s.workflow === "legacy_phase" && s.activityId === activity.id && s.participants.includes(user.username)
  );
  if (existing) {
    return NextResponse.json(existing);
  }

  const session = createSession({
    participants: group.members,
    workflow: "legacy_phase",
    phaseMax: 5,
    activityId: activity.id,
    activityTitle: activity.title
  });

  await saveSession(session);
  return NextResponse.json(session, { status: 201 });
}
