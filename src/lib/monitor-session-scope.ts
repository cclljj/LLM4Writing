export type ActivityScopedSession = {
  activityId?: string | null;
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
