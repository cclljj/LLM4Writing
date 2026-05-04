import { NextResponse } from "next/server";
import { getCurrentUser } from "@/src/lib/auth-server";
import { getAllActivities, hydrateDomainState } from "@/src/lib/mock-data";
import { listSessions } from "@/src/lib/store";
import { getUsersVisibleToTeacherStore, listUsersStore } from "@/src/lib/user-store";

function normalizeText(text: string): string {
  return text.replace(/\r\n/g, "\n").trim();
}

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
      const stepPrompts = s.promptConfig?.stepPrompts ?? {};
      const stepOpenings = s.promptConfig?.stepOpenings ?? {};
      const filteredMessages = s.messages.filter((message) => {
        if (message.role !== "system") return true;
        const stepPrompt = stepPrompts[String(message.step)] ?? "";
        if (!stepPrompt.trim()) return true;
        return normalizeText(message.text) !== normalizeText(stepPrompt);
      });
      const withOpenings = [...filteredMessages];
      const stepsInView = Array.from(new Set(filteredMessages.map((message) => message.step)));
      stepsInView.forEach((step) => {
        const opening = (stepOpenings[String(step)] ?? "").trim();
        if (!opening) return;
        const openingNormalized = normalizeText(opening);
        const alreadyExists = withOpenings.some(
          (message) => message.step === step && message.role === "system" && normalizeText(message.text) === openingNormalized
        );
        if (alreadyExists) return;
        const firstStepIndex = withOpenings.findIndex((message) => message.step === step);
        if (firstStepIndex < 0) return;
        const anchor = withOpenings[firstStepIndex]!;
        withOpenings.splice(firstStepIndex, 0, {
          id: `opening-${s.id}-group-${step}`,
          role: "system",
          step,
          at: anchor.at,
          text: opening
        });
      });
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
        personalSteps: s.personalSteps ?? {},
        messages: withOpenings,
        groupGate: s.groupGate,
        stepState: s.stepState,
        reflectionIndex: s.reflectionIndex
      };
    });

  return NextResponse.json({ sessions: activeSessions });
}
