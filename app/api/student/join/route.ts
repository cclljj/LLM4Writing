import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/src/lib/auth-server";
import { createSession } from "@/src/lib/engine";
import { findActivity, hydrateDomainState, resolvePromptConfigForActivity } from "@/src/lib/mock-data";
import { listSessions, saveSession } from "@/src/lib/store";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "student") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  await hydrateDomainState();
  const body = (await request.json()) as { activityId?: string };
  const activityId = body.activityId ?? "";
  const activity = findActivity(activityId);
  if (!activity) {
    return NextResponse.json({ error: "activity_not_found" }, { status: 404 });
  }

  if (activity.courseStatus === "not_started") {
    return NextResponse.json({ error: "course_not_started" }, { status: 400 });
  }
  if (activity.courseStatus === "paused") {
    return NextResponse.json({ error: "course_paused" }, { status: 400 });
  }
  if (activity.courseStatus === "ended") {
    return NextResponse.json({ error: "course_ended" }, { status: 400 });
  }

  const group = activity.groups.find((g) => g.members.includes(user.username));
  if (!group) {
    return NextResponse.json({ error: "not_group_member" }, { status: 403 });
  }

  const sessions = await listSessions();
  const existing = sessions.find(
    (s) => s.workflow === "spec10" && s.activityId === activity.id && s.participants.includes(user.username)
  );
  if (existing) {
    return NextResponse.json(existing);
  }

  const session = createSession({
    participants: group.members,
    workflow: "spec10",
    phaseMax: 10,
    activityId: activity.id,
    activityTitle: activity.title,
    groupId: group.groupId,
    groupName: group.groupName,
    promptConfig: resolvePromptConfigForActivity(activity.id)
  });

  await saveSession(session);
  return NextResponse.json(session, { status: 201 });
}
