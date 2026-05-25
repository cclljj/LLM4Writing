import { NextResponse } from "next/server";
import { getCurrentUser } from "@/src/lib/auth-server";
import { requestCancelJob } from "@/src/lib/course-report-export";

type Context = { params: Promise<{ jobId: string }> };

export async function POST(_: Request, context: Context) {
  const user = await getCurrentUser();
  if (!user || (user.role !== "teacher" && user.role !== "admin")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const { jobId } = await context.params;
  const job = requestCancelJob(jobId, user.username);
  if (!job) return NextResponse.json({ error: "job_not_found" }, { status: 404 });
  return NextResponse.json({ jobId: job.id, status: job.status, cancelRequested: job.cancelRequested });
}
