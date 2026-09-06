import { NextRequest, NextResponse } from "next/server";
import { createSession } from "@/src/lib/engine";
import { saveSession } from "@/src/lib/store";
import { StartSessionPayload } from "@/src/lib/types";
import { getCurrentUser } from "@/src/lib/auth-server";
import { getUsersVisibleToTeacherStore, listUsersStore } from "@/src/lib/user-store";
import { hydrateDomainState } from "@/src/lib/activity-store";
import { loadActivityWithConfig } from "@/src/lib/prompt-config";

export async function POST(request: NextRequest) {
  // #383: Require teacher or admin role — prevents unauthenticated session creation
  // and LLM prompt injection via malicious promptConfig.
  const user = await getCurrentUser();
  if (!user || (user.role !== "teacher" && user.role !== "admin")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const payload = (await request.json()) as StartSessionPayload;
  const participants = Array.from(
    new Set(
      (payload.participants ?? [])
        .map((participant) => participant.trim())
        .filter(Boolean)
    )
  );

  if (participants.length === 0) {
    return NextResponse.json({ error: "participants_required" }, { status: 400 });
  }
  const visibleUsers = user.role === "admin"
    ? await listUsersStore()
    : await getUsersVisibleToTeacherStore(user.username);
  const allowedStudents = new Set(
    visibleUsers
      .filter((visibleUser) => visibleUser.role === "student")
      .map((visibleStudent) => visibleStudent.username)
  );
  const invalidParticipants = participants.filter((participant) => !allowedStudents.has(participant));
  if (invalidParticipants.length > 0) {
    return NextResponse.json(
      { error: "invalid_participants_scope", participants: invalidParticipants },
      { status: 403 }
    );
  }

  // Session creation is also used by teacher tooling.  When it targets an
  // activity, resolve both prompts and workflow from that activity's term
  // config instead of accepting caller-provided workflow content.
  await hydrateDomainState();
  const loaded = payload.activityId ? loadActivityWithConfig(payload.activityId) : undefined;
  if (payload.activityId && !loaded) {
    return NextResponse.json({ error: "activity_not_found" }, { status: 404 });
  }
  const session = createSession({
    ...payload,
    participants,
    ...(loaded
      ? {
          promptConfig: loaded.promptConfig,
          workflowSteps: loaded.workflowSteps,
          guidedDiscussionSubsteps: loaded.guidedDiscussionSubsteps,
          activityTitle: payload.activityTitle ?? loaded.activity.title,
          activityEssayDescription: payload.activityEssayDescription ?? loaded.activity.essayDescription ?? "",
          activitySupplemental: payload.activitySupplemental ?? loaded.activity.supplemental ?? ""
        }
      : {})
  });
  await saveSession(session);

  return NextResponse.json(session, { status: 201 });
}
