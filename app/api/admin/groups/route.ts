import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/src/lib/auth-server";
import { updateActivityGroups } from "@/src/lib/mock-data";
import { ActivityGroup } from "@/src/lib/types";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "teacher") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = (await request.json()) as { activityId?: string; groups?: ActivityGroup[] };
  if (!body.activityId || !body.groups) {
    return NextResponse.json({ error: "missing_required_fields" }, { status: 400 });
  }

  const updated = updateActivityGroups(body.activityId, body.groups);
  if (!updated) {
    return NextResponse.json({ error: "activity_not_found" }, { status: 404 });
  }

  return NextResponse.json({ updated });
}
