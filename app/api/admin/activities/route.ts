import { NextResponse } from "next/server";
import { getCurrentUser } from "@/src/lib/auth-server";
import {
  deleteOpenClassTask,
  flushDomainState,
  getAllActivities,
  getOpenClasses,
  hydrateDomainState
} from "@/src/lib/activity-store";
import { getUsersVisibleToTeacherStore, listUsersStore } from "@/src/lib/user-store";
import { deleteSessionsByActivityId, listSessions } from "@/src/lib/store";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || (user.role !== "teacher" && user.role !== "admin")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  try {
    await hydrateDomainState();
  } catch {
    // Degrade gracefully so learning management can still render available in-memory activity state.
  }
  const baseActivities = getAllActivities();
  const visibleUsers = user.role === "admin" ? await listUsersStore() : await getUsersVisibleToTeacherStore(user.username);
  const visibleStudents = visibleUsers.filter((u) => u.role === "student");
  const visibleClasses = new Set(visibleStudents.map((u) => `${u.school}::${u.classNumber ?? ""}`));

  const scopedActivities =
    user.role === "admin"
      ? baseActivities
      : baseActivities.filter((activity) => visibleClasses.has(`${activity.school}::${activity.classNumber}`));
  const activities = scopedActivities.map((activity) => ({
    ...activity,
    studentCandidates: visibleStudents
      .filter((student) => student.school === activity.school && student.classNumber === activity.classNumber)
      .map((student) => student.username)
  }));

  return NextResponse.json({ activities });
}

export async function DELETE(request: Request) {
  const user = await getCurrentUser();
  if (!user || (user.role !== "admin" && user.role !== "teacher")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as { activityId?: string };
  const activityId = (body.activityId ?? "").trim();
  if (!activityId) {
    return NextResponse.json({ error: "missing_activity_id" }, { status: 400 });
  }

  await hydrateDomainState();

  // Teacher delete (#254、修正於 #256): allowed when:
  //  - target.ownerTeacherUsername === user.username (explicit ownership), OR
  //  - target.ownerTeacherUsername is missing (legacy task) AND the target's
  //    school+class is visible to this teacher (class-scope fallback).
  // AND no student activity exists in any related session.
  // admin retains unrestricted delete (used by both 課程管理 + 學習管理 flows).
  if (user.role === "teacher") {
    const target = getOpenClasses().find((oc) => oc.id === activityId);
    if (!target) {
      return NextResponse.json({ error: "activity_not_found" }, { status: 404 });
    }
    const isExplicitOwner = target.ownerTeacherUsername === user.username;
    let inTeacherScope = false;
    if (!isExplicitOwner && !target.ownerTeacherUsername) {
      // Legacy fallback: check class scope visibility.
      const visibleUsers = await getUsersVisibleToTeacherStore(user.username);
      const visibleClasses = new Set(
        visibleUsers
          .filter((u) => u.role === "student")
          .map((u) => `${u.school}::${u.classNumber ?? ""}`)
      );
      inTeacherScope = visibleClasses.has(`${target.school}::${target.classNumber}`);
    }
    if (!isExplicitOwner && !inTeacherScope) {
      return NextResponse.json({ error: "not_owner" }, { status: 403 });
    }
    const sessions = await listSessions().catch(() => []);
    const hasActivity = sessions.some(
      (s) => s.activityId === activityId && s.messages.some((m) => m.role === "student")
    );
    if (hasActivity) {
      return NextResponse.json({ error: "task_has_student_activity" }, { status: 409 });
    }
  }

  const deleted = deleteOpenClassTask(activityId);
  if (!deleted.ok) {
    return NextResponse.json({ error: deleted.error }, { status: 404 });
  }
  await flushDomainState();
  const removedSessions = await deleteSessionsByActivityId(activityId);
  return NextResponse.json({ ok: true, removedSessions });
}
