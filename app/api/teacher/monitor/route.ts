import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/src/lib/auth-server";
import { getAllActivities, hydrateDomainState } from "@/src/lib/activity-store";
import { getSession, listMonitorSessionsByActivityId, listSessions } from "@/src/lib/store";
import { getUsersVisibleToTeacherStore, listUsersStore } from "@/src/lib/user-store";
import { getOnlineUsers } from "@/src/lib/session-presence";
import { isSessionInActivityGroupScope } from "@/src/lib/monitor-session-scope";
import { ChatMessage, SessionState } from "@/src/lib/types";

function normalizeText(text: string): string {
  return text.replace(/\r\n/g, "\n").trim();
}

function parsePaginationParam(raw: string | null, defaultValue: number): number {
  const n = parseInt(raw ?? "", 10);
  return Number.isFinite(n) && n >= 0 ? n : defaultValue;
}

function buildMessagesWithOpenings(session: SessionState): ChatMessage[] {
  const stepPrompts = session.promptConfig?.stepPrompts ?? {};
  const stepOpenings = session.promptConfig?.stepOpenings ?? {};
  const filteredMessages = session.messages.filter((message) => {
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
      id: `opening-${session.id}-group-${step}`,
      role: "system",
      step,
      at: anchor.at,
      text: opening
    });
  });
  return withOpenings;
}

async function buildMonitorSessionPayload(
  session: SessionState,
  activity: { school?: string; classNumber?: string } | undefined,
  detail: "summary" | "full"
) {
  const messagesWithOpenings = detail === "full" ? buildMessagesWithOpenings(session) : [];
  const lastMessage = session.messages[session.messages.length - 1];
  const step1Ready = session.messages.some(
    (message) => message.step === 1 && message.role === "system" && message.text.includes("步驟 1 子步驟已完成，等待教師切換下一步")
  );
  const step2Ready = session.messages.some(
    (message) => message.step === 2 && message.role === "system" && message.text.includes("步驟 2 子步驟已完成，等待教師切換下一步")
  );
  const studentMessageStats = Object.fromEntries(
    session.participants.map((participant) => {
      const own = session.messages.filter((message) => message.role === "student" && message.userId === participant);
      const last = own[own.length - 1];
      return [
        participant,
        {
          count: own.length,
          lastMessageAt: last?.at ?? null
        }
      ];
    })
  );

  const onlineUsers = await getOnlineUsers(session.id);

  return {
    sessionId: session.id,
    activityId: session.activityId,
    activityTitle: session.activityTitle,
    school: activity?.school ?? "",
    classNumber: activity?.classNumber ?? "",
    groupId: session.groupId,
    groupName: session.groupName,
    participants: session.participants,
    joinedUsers: session.joinedUsers ?? [],
    onlineUsers,
    currentStep: session.currentStep,
    personalSteps: session.personalSteps ?? {},
    messages: messagesWithOpenings,
    messageCount: session.messages.length,
    lastMessageAt: lastMessage?.at ?? null,
    studentMessageStats,
    stepReadyHints: { step1Ready, step2Ready },
    groupGate: session.groupGate,
    stepState: session.stepState,
    reflectionIndex: session.reflectionIndex,
    outlines: detail === "full" ? session.outlines ?? {} : {},
    step3SubmittedOutlines: detail === "full" ? session.step3SubmittedOutlines ?? {} : {},
    qualitySignals: session.qualitySignals ?? { rejectedAnswerCounts: {}, rejectedAnswerLastAt: {} },
    artifactDiagnostics: {
      step3OutlineChars: Object.fromEntries(Object.entries(session.outlines ?? {}).map(([userId, outline]) => [userId, outline.length])),
      step3OutlineUpdatedAt: session.artifactSignals?.outlineUpdatedAt ?? {},
      draftStep6Chars: Object.fromEntries(Object.entries(session.draftStep6 ?? {}).map(([userId, draft]) => [userId, draft.length])),
      draftStep6UpdatedAt: session.artifactSignals?.draftStep6UpdatedAt ?? {}
    }
  };
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || (user.role !== "teacher" && user.role !== "admin")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const limit = parsePaginationParam(url.searchParams.get("limit"), 50);
  const offset = parsePaginationParam(url.searchParams.get("offset"), 0);
  const detail = url.searchParams.get("detail") === "full" ? "full" : "summary";
  const requestedSessionId = url.searchParams.get("sessionId") ?? "";
  const requestedActivityId = url.searchParams.get("activityId") ?? "";

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

  if (requestedSessionId) {
    const session = await getSession(requestedSessionId);
    const activity = session?.activityId ? activityMap.get(session.activityId) : undefined;
    const isVisible =
      Boolean(session) &&
      session!.workflow === "spec10" &&
      Boolean(session!.activityId) &&
      visibleActivityIds.has(session!.activityId!) &&
      (!requestedActivityId || session!.activityId === requestedActivityId) &&
      Boolean(activity && isSessionInActivityGroupScope(session!, activity));
    if (!session || !activity || !isVisible) return NextResponse.json({ error: "session_not_found" }, { status: 404 });
    return NextResponse.json({ session: await buildMonitorSessionPayload(session, activity, detail) });
  }

  if (requestedActivityId) {
    const activity = activityMap.get(requestedActivityId);
    if (!activity || !visibleActivityIds.has(requestedActivityId)) {
      return NextResponse.json({ sessions: [], total: 0, limit, offset });
    }

    const { sessions, total } = await listMonitorSessionsByActivityId(requestedActivityId, { limit, offset });
    const scopedSessions = sessions.filter((s) => isSessionInActivityGroupScope(s, activity));
    const visibleSessions = await Promise.all(
      scopedSessions.map((s) => buildMonitorSessionPayload(s, activity, detail))
    );
    return NextResponse.json({ sessions: visibleSessions, total, limit, offset });
  }

  const sessions = await listSessions();
  const scopedSessions = sessions
    .filter((s) => s.workflow === "spec10" && Boolean(s.activityId) && visibleActivityIds.has(s.activityId!))
    .filter((s) => {
      const activity = activityMap.get(s.activityId!);
      return Boolean(activity && isSessionInActivityGroupScope(s, activity));
    });
  const total = scopedSessions.length;
  const paginatedSessions = scopedSessions.slice(offset, offset + limit);
  const paginated = await Promise.all(
    paginatedSessions.map((s) => buildMonitorSessionPayload(s, activityMap.get(s.activityId!), detail))
  );

  return NextResponse.json({ sessions: paginated, total, limit, offset });
}
