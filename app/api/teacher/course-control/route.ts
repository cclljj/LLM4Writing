import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/src/lib/auth-server";
import { endCourse, getActivitiesVisibleToTeacher, getAllActivities, startCourse } from "@/src/lib/mock-data";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || (user.role !== "teacher" && user.role !== "admin")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = (await request.json()) as { activityId?: string; action?: "start" | "end" };
  if (!body.activityId || !body.action) {
    return NextResponse.json({ error: "missing_required_fields" }, { status: 400 });
  }

  const visibleActivities = user.role === "admin" ? getAllActivities() : getActivitiesVisibleToTeacher(user.username);
  if (!visibleActivities.some((activity) => activity.id === body.activityId)) {
    return NextResponse.json({ error: "forbidden_activity" }, { status: 403 });
  }

  if (body.action === "start") {
    const result = startCourse(body.activityId);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ ok: true, status: result.status });
  }

  const result = endCourse(body.activityId);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true, status: result.status });
}
