import { NextResponse } from "next/server";
import { getCurrentUser } from "@/src/lib/auth-server";
import { getAllActivities, hydrateDomainState } from "@/src/lib/mock-data";
import { listSessions } from "@/src/lib/store";
import { getUsersVisibleToTeacherStore, listUsersStore } from "@/src/lib/user-store";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || (user.role !== "teacher" && user.role !== "admin")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  await hydrateDomainState();
  const baseActivities = getAllActivities();
  const visibleUsers = user.role === "admin" ? await listUsersStore() : await getUsersVisibleToTeacherStore(user.username);
  const visibleStudents = visibleUsers.filter((u) => u.role === "student");
  const visibleClasses = new Set(visibleStudents.map((u) => `${u.school}::${u.classNumber ?? ""}`));
  const visibleActivities =
    user.role === "admin"
      ? baseActivities
      : baseActivities.filter((activity) => visibleClasses.has(`${activity.school}::${activity.classNumber}`));
  const activityMap = new Map(visibleActivities.map((activity) => [activity.id, activity]));
  const visibleActivityIds = new Set(visibleActivities.map((activity) => activity.id));

  const sessions = await listSessions();
  const activeSessions = sessions
    .filter((s) => s.workflow === "spec10" && Boolean(s.activityId) && visibleActivityIds.has(s.activityId!))
    .map((s) => {
      const activity = activityMap.get(s.activityId!);
      return {
        sessionId: s.id,
        activityId: s.activityId,
        activityTitle: s.activityTitle,
        school: activity?.school ?? "",
        classNumber: activity?.classNumber ?? "",
        groupId: s.groupId,
        groupName: s.groupName,
        participants: s.participants,
        joinedUsers: s.joinedUsers ?? [],
        currentStep: s.currentStep,
        messages: s.messages,
        groupGate: s.groupGate,
        stepState: s.stepState,
        reflectionIndex: s.reflectionIndex
      };
    });

  return NextResponse.json({ sessions: activeSessions });
}
