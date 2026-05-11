export type ActivityScopedSession = {
  activityId?: string | null;
};

export type GroupScopedSession = ActivityScopedSession & {
  groupId?: string | null;
  groupName?: string | null;
  participants?: readonly string[];
};

export type ActivityGroupScope = {
  groupId?: string | null;
  groupName?: string | null;
  members?: readonly string[];
};

export type ActivityScope = {
  id?: string | null;
  groups?: readonly ActivityGroupScope[];
};

export function normalizeActivityScope(activityId?: string | null): string {
  return activityId?.trim() ?? "";
}

export function isSessionInActivityScope(
  session: ActivityScopedSession,
  activityId?: string | null
): boolean {
  const scope = normalizeActivityScope(activityId);
  return Boolean(scope) && session.activityId === scope;
}

export function getActivityScopedSessions<T extends ActivityScopedSession>(
  sessions: readonly T[],
  activityId?: string | null
): T[] {
  const scope = normalizeActivityScope(activityId);
  if (!scope) return [];
  return sessions.filter((session) => session.activityId === scope);
}

function normalizeText(value?: string | null): string {
  return value?.trim() ?? "";
}

function sameMembers(left?: readonly string[], right?: readonly string[]): boolean {
  if (!left?.length || !right?.length) return false;
  if (left.length !== right.length) return false;
  const leftSet = new Set(left);
  if (leftSet.size !== right.length) return false;
  return right.every((item) => leftSet.has(item));
}

export function isSessionInActivityGroupScope(
  session: GroupScopedSession,
  activity?: ActivityScope | null
): boolean {
  const activityId = normalizeActivityScope(activity?.id);
  if (!activityId || session.activityId !== activityId) return false;

  const groups = activity?.groups ?? [];
  if (groups.length === 0) return true;

  const sessionGroupId = normalizeText(session.groupId);
  const sessionGroupName = normalizeText(session.groupName);
  const sessionParticipants = session.participants ?? [];

  return groups.some((group) => {
    const groupIdMatches = Boolean(sessionGroupId) && sessionGroupId === normalizeText(group.groupId);
    const groupNameMatches = Boolean(sessionGroupName) && sessionGroupName === normalizeText(group.groupName);
    const membersMatch = sameMembers(sessionParticipants, group.members);

    if (sessionParticipants.length > 0 && group.members?.length) {
      return membersMatch && (groupIdMatches || groupNameMatches || (!sessionGroupId && !sessionGroupName));
    }
    return groupIdMatches || groupNameMatches;
  });
}

export function getActivityGroupScopedSessions<T extends GroupScopedSession>(
  sessions: readonly T[],
  activity?: ActivityScope | null
): T[] {
  if (!activity) return [];
  return sessions.filter((session) => isSessionInActivityGroupScope(session, activity));
}
