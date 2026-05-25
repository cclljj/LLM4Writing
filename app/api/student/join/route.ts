import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/src/lib/auth-server";
import { createSession } from "@/src/lib/engine";
import { hydrateDomainState } from "@/src/lib/activity-store";
import { loadActivityWithConfig } from "@/src/lib/prompt-config";
import { resolveStructureTreeTemplate } from "@/src/lib/genre-resolver";
import { listSessions, saveSession } from "@/src/lib/store";
import { markUserOnline } from "@/src/lib/session-presence";
import { listUsersStore } from "@/src/lib/user-store";

function isSingleNodeOutline(outline: string): boolean {
  const raw = outline.trim();
  if (!raw) return true;
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !line.startsWith("graph "))
    .filter((line) => !line.startsWith("flowchart "))
    .filter((line) => !line.startsWith("```"));
  const nodeIds = new Set<string>();
  for (const line of lines) {
    const nodeMatch = line.match(/^([A-Za-z0-9_-]+)\s*\["([\s\S]*)"\]$/);
    if (nodeMatch) {
      nodeIds.add(nodeMatch[1]!);
      continue;
    }
    const edgeWithLabelMatch = line.match(/^([A-Za-z0-9_-]+)\s*-->\s*([A-Za-z0-9_-]+)\s*\["([\s\S]*)"\]$/);
    if (edgeWithLabelMatch) {
      nodeIds.add(edgeWithLabelMatch[1]!);
      nodeIds.add(edgeWithLabelMatch[2]!);
      continue;
    }
    const edgeMatch = line.match(/^([A-Za-z0-9_-]+)\s*-->\s*([A-Za-z0-9_-]+)$/);
    if (edgeMatch) {
      nodeIds.add(edgeMatch[1]!);
      nodeIds.add(edgeMatch[2]!);
    }
  }
  return nodeIds.size <= 1;
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "student") {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    await hydrateDomainState();
    const body = (await request.json()) as { activityId?: string };
    const activityId = body.activityId ?? "";
    const loaded = loadActivityWithConfig(activityId);
    if (!loaded) {
      return NextResponse.json({ error: "activity_not_found" }, { status: 404 });
    }
    const { activity, promptConfig: resolvedConfig } = loaded;

    if (activity.courseStatus === "not_started") {
      return NextResponse.json({ error: "course_not_started" }, { status: 400 });
    }
    if (activity.courseStatus === "paused") {
      return NextResponse.json({ error: "course_paused" }, { status: 400 });
    }
    if (activity.courseStatus === "ended") {
      return NextResponse.json({ error: "course_ended" }, { status: 400 });
    }

    const hasGrouping = activity.groups.length > 0;
    const group = activity.groups.find((g) => g.members.includes(user.username));
    if (hasGrouping && !group) {
      return NextResponse.json({ error: "not_group_member" }, { status: 403 });
    }

    const participants = group?.members ?? [];
    if (participants.length === 0 || !participants.includes(user.username)) {
      return NextResponse.json({ error: "not_group_member" }, { status: 403 });
    }

    const sessions = await listSessions();
    const allUsers = await listUsersStore();
    const userNameMap = new Map(allUsers.map((account) => [account.username, account.name?.trim() || account.username]));
    const toSessionResponse = <T extends { participants: string[] }>(payload: T) => ({
      ...payload,
      participantDisplayNames: payload.participants.reduce((acc, username) => {
        acc[username] = userNameMap.get(username) || username;
        return acc;
      }, {} as Record<string, string>)
    });
    const existing = sessions.find(
      (s) => s.workflow === "spec10" && s.activityId === activity.id && s.participants.includes(user.username)
    );
    if (existing) {
      if (!existing.outlines || typeof existing.outlines !== "object") {
        existing.outlines = {};
      }
      const structureTreeTemplate = resolveStructureTreeTemplate(activity.genre, activity.title);
      const nextStepOpenings = {
        ...(resolvedConfig.stepOpenings ?? {}),
        ...(existing.promptConfig?.stepOpenings ?? {})
      };
      const promptConfigPatched =
        !existing.promptConfig?.stepOpenings ||
        Object.keys(existing.promptConfig.stepOpenings).length === 0 ||
        Object.keys(nextStepOpenings).length !== Object.keys(existing.promptConfig.stepOpenings).length;
      if (promptConfigPatched) {
        existing.promptConfig = {
          ...resolvedConfig,
          ...existing.promptConfig,
          stepOpenings: nextStepOpenings
        };
      }
      const outlinePatched = Boolean(
        structureTreeTemplate &&
        isSingleNodeOutline(existing.outlines?.[user.username] ?? "")
      );
      if (outlinePatched) {
        existing.outlines[user.username] = structureTreeTemplate;
      }
      const messageJoinedUsers = Array.from(
        new Set(
          existing.messages
            .filter((m) => m.role === "student" && typeof m.userId === "string" && m.userId.trim().length > 0)
            .map((m) => m.userId as string)
        )
      );
      // #395: joinedUsers must be append-only during normal joins.
      // Do not shrink peers just because they have not spoken yet; otherwise
      // step1/2 gate members may be reduced and trigger premature auto-advance.
      const persistedJoinedUsers = (existing.joinedUsers ?? []).filter((name) => participants.includes(name));
      const nextJoinedUsers = Array.from(new Set([...persistedJoinedUsers, ...messageJoinedUsers, user.username]));
      const prevJoinedUsers = existing.joinedUsers ?? [];
      const joinedChanged =
        nextJoinedUsers.length !== prevJoinedUsers.length ||
        nextJoinedUsers.some((name) => !prevJoinedUsers.includes(name));
      await markUserOnline(existing.id, user.username);
      if (joinedChanged || promptConfigPatched || outlinePatched) {
        existing.joinedUsers = nextJoinedUsers;
        await saveSession(existing);
      } else {
        await saveSession(existing);
      }
      return NextResponse.json(toSessionResponse(existing));
    }

    const session = createSession({
      participants,
      workflow: "spec10",
      phaseMax: 10,
      activityId: activity.id,
      activityTitle: activity.title,
      activityEssayDescription: activity.essayDescription ?? "",
      activitySupplemental: activity.supplemental ?? "",
      groupId: group?.groupId ?? "g-auto",
      groupName: group?.groupName ?? "未分組",
      promptConfig: resolvedConfig
    });
    const structureTreeTemplate = resolveStructureTreeTemplate(activity.genre, activity.title);
    if (structureTreeTemplate) {
      participants.forEach((participant) => {
        session.outlines[participant] = structureTreeTemplate;
      });
    }
    session.joinedUsers = [user.username];
    await markUserOnline(session.id, user.username);

    await saveSession(session);
    return NextResponse.json(toSessionResponse(session), { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "student_join_failed";
    return NextResponse.json({ error: "student_join_failed", detail: message }, { status: 500 });
  }
}
