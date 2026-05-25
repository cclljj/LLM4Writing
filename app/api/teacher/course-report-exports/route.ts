import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/src/lib/auth-server";
import { createExportJob, listJobsByOwner } from "@/src/lib/course-report-export";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || (user.role !== "teacher" && user.role !== "admin")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const jobs = listJobsByOwner(user.username).slice(0, 10);
  return NextResponse.json({ jobs });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || (user.role !== "teacher" && user.role !== "admin")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as { activityId?: string; classNumber?: string };
  const activityId = (body.activityId ?? "").trim();
  const classNumber = (body.classNumber ?? "").trim();
  if (!activityId || !classNumber) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  try {
    const job = await createExportJob({
      ownerUsername: user.username,
      ownerRole: user.role,
      activityId,
      classNumber,
    });
    return NextResponse.json({ jobId: job.id, status: job.status });
  } catch (error) {
    const message = error instanceof Error ? error.message : "export_create_failed";
    const status = message === "export_already_running" ? 409 : message === "forbidden_activity" ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
