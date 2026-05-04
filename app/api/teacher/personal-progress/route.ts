import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/src/lib/auth-server";
import { getAllActivities, hydrateDomainState } from "@/src/lib/mock-data";
import { getSession } from "@/src/lib/store";
import { getUsersVisibleToTeacherStore, listUsersStore } from "@/src/lib/user-store";

function normalizeText(text: string): string {
  return text.replace(/\r\n/g, "\n").trim();
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || (user.role !== "teacher" && user.role !== "admin")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const sessionId = request.nextUrl.searchParams.get("sessionId") ?? "";
  const username = request.nextUrl.searchParams.get("username") ?? "";

  await hydrateDomainState();
  const baseActivities = getAllActivities();
  const visibleUsers = user.role === "admin" ? await listUsersStore() : await getUsersVisibleToTeacherStore(user.username);
  const visibleStudents = visibleUsers.filter((u) => u.role === "student");
  const visibleClasses = new Set(visibleStudents.map((u) => `${u.school}::${u.classNumber ?? ""}`));
  const visibleActivities =
    user.role === "admin"
      ? baseActivities
      : baseActivities.filter((activity) => visibleClasses.has(`${activity.school}::${activity.classNumber}`));
  const visibleActivityIds = new Set(visibleActivities.map((activity) => activity.id));

  const session = await getSession(sessionId);
  if (!session) {
    return NextResponse.json({ error: "session_not_found" }, { status: 404 });
  }
  if (!session.activityId || !visibleActivityIds.has(session.activityId)) {
    return NextResponse.json({ error: "forbidden_session" }, { status: 403 });
  }
  if (username && !session.participants.includes(username)) {
    return NextResponse.json({ error: "participant_not_found" }, { status: 404 });
  }

  const progress = session.participants.map((participant) => {
    const ownMessages = session.messages.filter((message) => message.userId === participant);
    const ownInteractiveMessages = ownMessages.filter((message) => [3, 6, 8].includes(message.step));
    const last = ownMessages[ownMessages.length - 1];
    return {
      username: participant,
      currentStep: last?.step ?? session.currentStep,
      messageCount: ownInteractiveMessages.length,
      lastMessageAt: last?.at ?? null
    };
  });

  const personalMessages = username
    ? (() => {
        const base = session.messages.filter(
          (message) => message.userId === username || message.role === "ai" || message.role === "system"
        );
        const stepPrompts = session.promptConfig?.stepPrompts ?? {};
        const stepOpenings = session.promptConfig?.stepOpenings ?? {};

        const filtered = base.filter((message) => {
          if (message.role !== "system") return true;
          const stepPrompt = stepPrompts[String(message.step)] ?? "";
          if (!stepPrompt.trim()) return true;
          return normalizeText(message.text) !== normalizeText(stepPrompt);
        });

        const withOpenings = [...filtered];
        const stepsInView = Array.from(new Set(filtered.map((message) => message.step)));
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
            id: `opening-${session.id}-${username}-${step}`,
            role: "system",
            step,
            at: anchor.at,
            text: opening
          });
        });
        return withOpenings;
      })()
    : [];

  return NextResponse.json({
    sessionId: session.id,
    activityTitle: session.activityTitle,
    progress,
    personalMessages
  });
}
