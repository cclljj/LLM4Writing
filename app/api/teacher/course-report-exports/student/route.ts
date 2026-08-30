import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/src/lib/auth-server";
import { recordAuditLog } from "@/src/lib/audit-log-store";
import { generateIndividualStudentPortfolioJson } from "@/src/lib/course-report-export";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || (user.role !== "teacher" && user.role !== "admin")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const activityId = request.nextUrl.searchParams.get("activityId")?.trim() ?? "";
  const classNumber = request.nextUrl.searchParams.get("classNumber")?.trim() ?? "";
  const username = request.nextUrl.searchParams.get("username")?.trim() ?? "";
  if (!activityId || !classNumber || !username) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  try {
    const result = await generateIndividualStudentPortfolioJson({
      ownerUsername: user.username,
      ownerRole: user.role,
      activityId,
      classNumber,
      username,
    });
    await recordAuditLog({
      actorUsername: user.username,
      actorRole: user.role,
      action: "course_report_student_json_export",
      targetType: "student_course_report",
      targetId: `${activityId}::${classNumber}::${username}`,
      targetLabel: `${result.school}/${classNumber}/${result.title}/${username}`,
      details: { format: "json" },
    });
    return new NextResponse(result.bytes, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${result.filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "student_report_json_failed";
    const status = message === "forbidden_activity" ? 403 : message === "student_report_not_found" || message === "session_not_found" ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
