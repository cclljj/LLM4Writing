import { NextResponse } from "next/server";
import { getCurrentUser } from "@/src/lib/auth-server";
import { getAllActivities, hydrateDomainState } from "@/src/lib/activity-store";
import { listSessionsByParticipant } from "@/src/lib/store";
import { resolveStudentCourseLatestWork } from "@/src/lib/student-course-history";

export async function GET(_: Request, context: { params: Promise<{ activityId: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.role !== "student") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  await hydrateDomainState();
  const { activityId } = await context.params;
  if (!activityId) {
    return NextResponse.json({ error: "activityId_required" }, { status: 400 });
  }

  const activity = getAllActivities().find((item) => item.id === activityId);
  if (!activity) {
    return NextResponse.json({ error: "activity_not_found" }, { status: 404 });
  }

  const sessions = (await listSessionsByParticipant(user.username, {
    workflow: "spec10",
    activityId
  }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  if (sessions.length === 0) {
    return NextResponse.json({ error: "no_participation_record" }, { status: 404 });
  }

  const latest = sessions[0]!;
  const latestPersonalStep = latest.personalSteps?.[user.username] ?? latest.currentStep;
  const latestWork = resolveStudentCourseLatestWork({ sessions, username: user.username, latestPersonalStep });
  const ownMessages = latest.messages.filter((message) => message.userId === user.username);
  const totalMessages = sessions.reduce((sum, session) => sum + session.messages.filter((m) => m.userId === user.username).length, 0);
  const maxStepReached = sessions.reduce(
    (max, session) => Math.max(max, session.personalSteps?.[user.username] ?? session.currentStep),
    1
  );

  return NextResponse.json({
    viewer: {
      username: user.username
    },
    activity: {
      id: activity.id,
      title: activity.title,
      classNumber: activity.classNumber,
      genre: activity.genre,
      durationMinutes: activity.durationMinutes,
      essayDescription: activity.essayDescription ?? "",
      supplemental: activity.supplemental ?? ""
    },
    summary: {
      sessionCount: sessions.length,
      lastSessionId: latest.id,
      lastParticipatedAt: latest.createdAt,
      maxStepReached,
      totalOwnMessages: totalMessages,
      ownMessagesInLatestSession: ownMessages.length
    },
    latestSession: {
      sessionId: latest.id,
      personalStep: latestPersonalStep,
      groupName: latest.groupName ?? "",
      participants: latest.participants,
      messages: latest.messages
    },
    latestWork,
    sessions: sessions.map((session) => ({
      sessionId: session.id,
      createdAt: session.createdAt,
      currentStep: session.personalSteps?.[user.username] ?? session.currentStep,
      ownMessageCount: session.messages.filter((message) => message.userId === user.username).length
    }))
  });
}
