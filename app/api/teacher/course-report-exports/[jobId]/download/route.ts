import { NextResponse } from "next/server";
import { getCurrentUser } from "@/src/lib/auth-server";
import { getDownloadBuffer, getJob } from "@/src/lib/course-report-export";

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
  const zip = getDownloadBuffer(job);
  if (!zip) return NextResponse.json({ error: "export_not_ready" }, { status: 409 });
  return new NextResponse(zip, {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename=\"${job.zipFileName}\"`,
      "Cache-Control": "no-store",
    },
  });
}
