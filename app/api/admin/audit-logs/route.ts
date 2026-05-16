import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/src/lib/auth-server";
import { listAuditLogs } from "@/src/lib/audit-log-store";

function parsePositiveInt(raw: string | null, fallback: number, max: number): number {
  const n = parseInt(raw ?? "", 10);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(n, max);
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const days = parsePositiveInt(request.nextUrl.searchParams.get("days"), 7, 90);
  const limit = parsePositiveInt(request.nextUrl.searchParams.get("limit"), 300, 500);
  const offset = parsePositiveInt(request.nextUrl.searchParams.get("offset"), 0, 50_000);
  const now = new Date();
  const from = new Date(now);
  from.setDate(from.getDate() - (days - 1));
  from.setHours(0, 0, 0, 0);

  const { logs, total } = await listAuditLogs({
    fromIso: from.toISOString(),
    toIso: now.toISOString(),
    limit,
    offset
  });

  return NextResponse.json({
    logs,
    total,
    days,
    limit,
    offset,
    fromIso: from.toISOString(),
    toIso: now.toISOString()
  });
}
