import { NextResponse } from "next/server";
import { getCurrentUser } from "@/src/lib/auth-server";
import { getActivitiesForStudent, hydrateDomainState } from "@/src/lib/mock-data";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "student") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  await hydrateDomainState();
  const activities = getActivitiesForStudent(user.username);
  return NextResponse.json({ activities });
}
