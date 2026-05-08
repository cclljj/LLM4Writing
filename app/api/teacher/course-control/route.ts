import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/src/lib/auth-server";
import {
  endCourse,
  flushDomainState,
  getAllActivities,
  hydrateDomainState,
  startCourse,
  togglePauseOrResumeCourse
} from "@/src/lib/activity-store";
import { getUsersVisibleToTeacherStore, listUsersStore } from "@/src/lib/user-store";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || (user.role !== "teacher" && user.role !== "admin")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  await hydrateDomainState();
  const body = (await request.json()) as { activityId?: string; action?: "start" | "pause_resume" | "end" };
  if (!body.activityId || !body.action) {
    return NextResponse.json({ error: "missing_required_fields" }, { status: 400 });
  }

  const baseActivities = getAllActivities();
  const visibleUsers = user.role === "admin" ? await listUsersStore() : await getUsersVisibleToTeacherStore(user.username);
  const visibleStudents = visibleUsers.filter((u) => u.role === "student");
  const visibleClasses = new Set(visibleStudents.map((u) => `${u.school}::${u.classNumber ?? ""}`));
  const visibleActivities =
    user.role === "admin"
      ? baseActivities
      : baseActivities.filter((activity) => visibleClasses.has(`${activity.school}::${activity.classNumber}`));
  if (!visibleActivities.some((activity) => activity.id === body.activityId)) {
    return NextResponse.json({ error: "forbidden_activity" }, { status: 403 });
  }

  if (body.action === "start") {
    const result = startCourse(body.activityId);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    await flushDomainState();
    return NextResponse.json({ ok: true, status: result.status });
  }

  if (body.action === "pause_resume") {
    const result = togglePauseOrResumeCourse(body.activityId);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    await flushDomainState();
    return NextResponse.json({ ok: true, status: result.status });
  }

  if (body.action !== "end") {
    return NextResponse.json({ error: "invalid_action" }, { status: 400 });
  }

  const result = endCourse(body.activityId);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  await flushDomainState();

  return NextResponse.json({ ok: true, status: result.status });
}
