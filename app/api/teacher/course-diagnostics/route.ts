import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/src/lib/auth-server";
import { getAllActivities, hydrateDomainState } from "@/src/lib/activity-store";
import { buildCourseDiagnostics } from "@/src/lib/course-diagnostics";
import { isSessionInActivityGroupScope } from "@/src/lib/monitor-session-scope";
import { listLearningEventsSince, listSessionsByActivityId } from "@/src/lib/store";
import { getUsersVisibleToTeacherStore, listUsersStore } from "@/src/lib/user-store";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || (user.role !== "teacher" && user.role !== "admin")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const activityId = url.searchParams.get("activityId")?.trim() ?? "";
  if (!activityId) {
    return NextResponse.json({ error: "activity_id_required" }, { status: 400 });
  }

  await hydrateDomainState();
  const baseActivities = getAllActivities();
  const visibleUsers = user.role === "admin" ? await listUsersStore() : await getUsersVisibleToTeacherStore(user.username);
  const visibleStudents = visibleUsers.filter((item) => item.role === "student");
  const visibleClasses = new Set(visibleStudents.map((item) => `${item.school}::${item.classNumber ?? ""}`));
  const visibleActivities =
    user.role === "admin"
      ? baseActivities
      : baseActivities.filter((activity) => visibleClasses.has(`${activity.school}::${activity.classNumber}`));
  const activity = visibleActivities.find((item) => item.id === activityId);
  if (!activity) {
    return NextResponse.json({ error: "activity_not_found" }, { status: 404 });
  }

  const sessions = (await listSessionsByActivityId(activityId, { workflow: "spec10" }))
    .filter((session) => isSessionInActivityGroupScope(session, activity));
  const learningEvents = await listLearningEventsSince("1970-01-01T00:00:00.000Z");
  const scopedEvents = learningEvents.filter((event) => event.activity_id === activityId);

  return NextResponse.json(buildCourseDiagnostics(activityId, sessions, scopedEvents));
}
