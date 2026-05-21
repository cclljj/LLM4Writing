import { getAllActivities, hydrateDomainState } from "@/src/lib/activity-store";
import { isSessionInActivityGroupScope } from "@/src/lib/monitor-session-scope";
import type { AuthUser } from "@/src/lib/auth";
import type { SessionState } from "@/src/lib/types";
import { getUsersVisibleToTeacherStore } from "@/src/lib/user-store";

export async function canAccessTeacherSession(user: AuthUser, session: SessionState): Promise<boolean> {
  if (user.role === "admin") return true;
  if (user.role !== "teacher") return false;
  if (!session.activityId) return false;

  await hydrateDomainState();
  const visibleUsers = await getUsersVisibleToTeacherStore(user.username);
  const visibleStudents = visibleUsers.filter((visibleUser) => visibleUser.role === "student");
  const visibleClasses = new Set(
    visibleStudents.map((visibleUser) => `${visibleUser.school}::${visibleUser.classNumber ?? ""}`)
  );
  const activity = getAllActivities().find((item) => item.id === session.activityId);
  if (!activity) return false;
  if (!visibleClasses.has(`${activity.school}::${activity.classNumber}`)) return false;
  return isSessionInActivityGroupScope(session, activity);
}
