import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/src/lib/auth-server";
import { createSession } from "@/src/lib/engine";
import { findActivity, hydrateDomainState, resolvePromptConfigForActivity } from "@/src/lib/mock-data";
import { listSessions, saveSession } from "@/src/lib/store";

export async function POST(request: NextRequest) {
  try {
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

    const hasGrouping = activity.groups.length > 0;
    const group = activity.groups.find((g) => g.members.includes(user.username));
    if (hasGrouping && !group) {
      return NextResponse.json({ error: "not_group_member" }, { status: 403 });
    }

    const participants = group?.members ?? [];
    if (participants.length === 0 || !participants.includes(user.username)) {
      return NextResponse.json({ error: "not_group_member" }, { status: 403 });
    }

    const sessions = await listSessions();
    const existing = sessions.find(
      (s) => s.workflow === "spec10" && s.activityId === activity.id && s.participants.includes(user.username)
    );
    if (existing) {
      const resolvedConfig = resolvePromptConfigForActivity(activity.id);
      const nextStepOpenings = {
        ...(resolvedConfig.stepOpenings ?? {}),
        ...(existing.promptConfig?.stepOpenings ?? {})
      };
      const promptConfigPatched =
        !existing.promptConfig?.stepOpenings ||
        Object.keys(existing.promptConfig.stepOpenings).length === 0 ||
        Object.keys(nextStepOpenings).length !== Object.keys(existing.promptConfig.stepOpenings).length;
      if (promptConfigPatched) {
        existing.promptConfig = {
          ...resolvedConfig,
          ...existing.promptConfig,
          stepOpenings: nextStepOpenings
        };
      }

      const messageJoinedUsers = Array.from(
        new Set(
          existing.messages
            .filter((m) => m.role === "student" && typeof m.userId === "string" && m.userId.trim().length > 0)
            .map((m) => m.userId as string)
        )
      );
      // Guard against legacy/corrupted records where joinedUsers was accidentally prefilled with full participants.
      const trustedJoinedUsers = (existing.joinedUsers ?? []).filter(
        (name) => messageJoinedUsers.includes(name) || name === user.username
      );
      const nextJoinedUsers = Array.from(new Set([...trustedJoinedUsers, ...messageJoinedUsers, user.username]));
      const prevJoinedUsers = existing.joinedUsers ?? [];
      const joinedChanged =
        nextJoinedUsers.length !== prevJoinedUsers.length ||
        nextJoinedUsers.some((name) => !prevJoinedUsers.includes(name));
      if (joinedChanged || promptConfigPatched) {
        existing.joinedUsers = nextJoinedUsers;
        await saveSession(existing);
      }
      return NextResponse.json(existing);
    }

    const session = createSession({
      participants,
      workflow: "spec10",
      phaseMax: 10,
      activityId: activity.id,
      activityTitle: activity.title,
      activityEssayDescription: activity.essayDescription ?? "",
      activitySupplemental: activity.supplemental ?? "",
      groupId: group?.groupId ?? "g-auto",
      groupName: group?.groupName ?? "未分組",
      promptConfig: resolvePromptConfigForActivity(activity.id)
    });
    session.joinedUsers = [user.username];

    await saveSession(session);
    return NextResponse.json(session, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "student_join_failed";
    return NextResponse.json({ error: "student_join_failed", detail: message }, { status: 500 });
  }
}
