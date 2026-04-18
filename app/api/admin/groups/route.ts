import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/src/lib/auth-server";
import { findActivity, flushDomainState, hydrateDomainState, updateActivityGroups } from "@/src/lib/mock-data";
import { ActivityGroup } from "@/src/lib/types";
import { getUsersVisibleToTeacherStore, listUsersStore } from "@/src/lib/user-store";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || (user.role !== "teacher" && user.role !== "admin")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  await hydrateDomainState();
  const body = (await request.json()) as { activityId?: string; groups?: ActivityGroup[] };
  if (!body.activityId || !body.groups) {
    return NextResponse.json({ error: "missing_required_fields" }, { status: 400 });
  }

  const activity = findActivity(body.activityId);
  if (!activity) {
    return NextResponse.json({ error: "activity_not_found" }, { status: 404 });
  }

  const visibleUsers = user.role === "admin" ? await listUsersStore() : await getUsersVisibleToTeacherStore(user.username);
  const allowedStudents = visibleUsers
    .filter((student) => student.role === "student")
    .filter((student) => student.school === activity.school && student.classNumber === activity.classNumber)
    .map((student) => student.username);

  const updated = updateActivityGroups(body.activityId, body.groups, allowedStudents);
  if (!updated) {
    return NextResponse.json({ error: "activity_not_found" }, { status: 404 });
  }
  await flushDomainState();

  return NextResponse.json({ updated });
}
