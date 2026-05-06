import { NextResponse } from "next/server";
import { getCurrentUser } from "@/src/lib/auth-server";
import { deleteOpenClassTask, flushDomainState, getAllActivities, hydrateDomainState } from "@/src/lib/mock-data";
import { getUsersVisibleToTeacherStore, listUsersStore } from "@/src/lib/user-store";
import { deleteSessionsByActivityId } from "@/src/lib/store";

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
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as { activityId?: string };
  const activityId = (body.activityId ?? "").trim();
  if (!activityId) {
    return NextResponse.json({ error: "missing_activity_id" }, { status: 400 });
  }

  await hydrateDomainState();
  const deleted = deleteOpenClassTask(activityId);
  if (!deleted.ok) {
    return NextResponse.json({ error: deleted.error }, { status: 404 });
  }
  await flushDomainState();
  const removedSessions = await deleteSessionsByActivityId(activityId);
  return NextResponse.json({ ok: true, removedSessions });
}
