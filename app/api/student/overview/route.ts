import { NextResponse } from "next/server";
import { getCurrentUser } from "@/src/lib/auth-server";
import { getAllActivities, hydrateDomainState } from "@/src/lib/mock-data";
import { listSessions } from "@/src/lib/store";
import { getUserStore } from "@/src/lib/user-store";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "student") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  await hydrateDomainState();
  const profile = await getUserStore(user.username);
  if (!profile || profile.role !== "student") {
    return NextResponse.json({ error: "student_profile_not_found" }, { status: 404 });
  }

  const missingFields: string[] = [];
  if (!profile.school) missingFields.push("school");
  if (!profile.classNumber) missingFields.push("classNumber");
  if (!profile.ownerTeacherUsername) missingFields.push("ownerTeacherUsername");

  const activities = getAllActivities();
  const classCourses = activities
    .filter((activity) => activity.school === profile.school && activity.classNumber === profile.classNumber)
    .sort((a, b) => a.id.localeCompare(b.id));
  const upcomingCourses = activities.filter(
    (activity) =>
      activity.school === profile.school &&
      activity.classNumber === profile.classNumber &&
      activity.courseStatus === "not_started"
  );
  const activeCourses = classCourses.filter((activity) => activity.courseStatus === "in_progress");
  const pausedCourses = classCourses.filter((activity) => activity.courseStatus === "paused");

  const sessions = await listSessions();
  const ownSessions = sessions
    .filter((session) => session.workflow === "spec10")
    .filter((session) => session.participants.includes(user.username))
    .filter((session) => Boolean(session.activityId));

  const byActivity = new Map<string, { lastAt: string; lastStep: number; lastSessionId: string; count: number }>();
  ownSessions.forEach((session) => {
    const aid = session.activityId!;
    const existing = byActivity.get(aid);
    if (!existing) {
      byActivity.set(aid, {
        lastAt: session.createdAt,
        lastStep: session.currentStep,
        lastSessionId: session.id,
        count: 1
      });
      return;
    }

    if (session.createdAt > existing.lastAt) {
      existing.lastAt = session.createdAt;
      existing.lastStep = session.currentStep;
      existing.lastSessionId = session.id;
    }
    existing.count += 1;
  });

  const participatedCourses = Array.from(byActivity.entries())
    .map(([activityId, value]) => {
      const activity = activities.find((item) => item.id === activityId);
      return {
        activityId,
        title: activity?.title ?? activityId,
        classNumber: activity?.classNumber ?? "—",
        lastSessionId: value.lastSessionId,
        lastStep: value.lastStep,
        lastParticipatedAt: value.lastAt,
        sessionCount: value.count
      };
    })
    .sort((a, b) => b.lastParticipatedAt.localeCompare(a.lastParticipatedAt));

  return NextResponse.json({
    profile: {
      username: profile.username,
      school: profile.school,
      classNumber: profile.classNumber,
      ownerTeacherUsername: profile.ownerTeacherUsername
    },
    missingFields,
    classCourses,
    upcomingCourses,
    activeCourses,
    pausedCourses,
    participatedCourses
  });
}
