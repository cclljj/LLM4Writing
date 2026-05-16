import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/src/lib/auth-server";
import { listSessionsByParticipant } from "@/src/lib/store";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "student") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const activityId = request.nextUrl.searchParams.get("activityId") ?? "";
  const sessions = await listSessionsByParticipant(user.username, {
    activityId: activityId.trim() || undefined
  });

  const history = sessions
    .map((session) => ({
      sessionId: session.id,
      activityId: session.activityId,
      activityTitle: session.activityTitle,
      currentStep: session.currentStep,
      messageCount: session.messages.length,
      createdAt: session.createdAt
    }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return NextResponse.json({ history });
}
