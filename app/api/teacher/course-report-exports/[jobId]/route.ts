import { NextResponse } from "next/server";
import { getCurrentUser } from "@/src/lib/auth-server";
import { getJob } from "@/src/lib/course-report-export";

type Context = { params: Promise<{ jobId: string }> };

export async function GET(_: Request, context: Context) {
  const user = await getCurrentUser();
  if (!user || (user.role !== "teacher" && user.role !== "admin")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const { jobId } = await context.params;
  const job = getJob(jobId);
  if (!job || job.ownerUsername !== user.username) {
    return NextResponse.json({ error: "job_not_found" }, { status: 404 });
  }
  return NextResponse.json({ job });
}
