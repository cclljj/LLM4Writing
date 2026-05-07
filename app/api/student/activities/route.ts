import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/src/lib/auth-server";
import { getActivitiesForStudent, hydrateDomainState } from "@/src/lib/mock-data";

function parsePaginationParam(raw: string | null, defaultValue: number): number {
  const n = parseInt(raw ?? "", 10);
  return Number.isFinite(n) && n >= 0 ? n : defaultValue;
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "student") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const limit = parsePaginationParam(url.searchParams.get("limit"), 50);
  const offset = parsePaginationParam(url.searchParams.get("offset"), 0);

  await hydrateDomainState();
  const activities = getActivitiesForStudent(user.username);
  const total = activities.length;
  const paginated = activities.slice(offset, offset + limit);

  return NextResponse.json({ activities: paginated, total, limit, offset });
}
