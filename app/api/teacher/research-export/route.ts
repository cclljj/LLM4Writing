import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/src/lib/auth-server";
import { getAllActivities, hydrateDomainState } from "@/src/lib/activity-store";
import { recordAuditLog } from "@/src/lib/audit-log-store";
import { isSessionInActivityGroupScope } from "@/src/lib/monitor-session-scope";
import { buildResearchStudentInputExport, parseResearchExportIdentityMode } from "@/src/lib/research-export";
import { listSessions } from "@/src/lib/store";
import { getUsersVisibleToTeacherStore, listUsersStore } from "@/src/lib/user-store";

function safeFilePart(value: string): string {
  return value.trim().replace(/[^a-zA-Z0-9._-]+/g, "_") || "course";
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || (user.role !== "teacher" && user.role !== "admin")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const activityId = request.nextUrl.searchParams.get("activityId")?.trim() ?? "";
  const identityMode = parseResearchExportIdentityMode(request.nextUrl.searchParams.get("identity"));
  if (!activityId) return NextResponse.json({ error: "activity_id_required" }, { status: 400 });
  if (!identityMode) return NextResponse.json({ error: "invalid_identity_mode" }, { status: 400 });

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
  if (!activity) return NextResponse.json({ error: "activity_not_found" }, { status: 404 });
  if ((activity.courseStatus ?? "not_started") !== "ended") {
    return NextResponse.json({ error: "course_not_ended" }, { status: 409 });
  }

  const sessions = (await listSessions())
    .filter((session) => session.workflow === "spec10" && session.activityId === activityId)
    .filter((session) => isSessionInActivityGroupScope(session, activity));
  const payload = buildResearchStudentInputExport({ activity, sessions, identityMode });

  await recordAuditLog({
    actorUsername: user.username,
    actorRole: user.role,
    action: "research_data_export",
    targetType: "activity",
    targetId: activity.id,
    targetLabel: `${activity.school}/${activity.classNumber}/${activity.title}`,
    details: {
      identityMode,
      recordCount: payload.records.length,
      sessionCount: sessions.length
    }
  });

  const suffix = identityMode === "account" ? "with-accounts" : "anonymous";
  const filename = `${safeFilePart(activity.id)}_${safeFilePart(activity.classNumber)}_research-student-inputs-${suffix}.json`;
  return NextResponse.json(payload, {
    headers: {
      "Content-Disposition": `attachment; filename="${filename}"`
    }
  });
}
