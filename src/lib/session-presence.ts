// In-process presence tracking: sessionId → username → ISO timestamp.
// Deliberately ephemeral (not persisted) — presence is best-effort and
// resets on server restart. This keeps session updated_at stable so ETag
// can suppress redundant session polls.
const presenceMap = new Map<string, Map<string, string>>();

const DEFAULT_ONLINE_WINDOW_MS = 45_000;

function onlineWindowMs(): number {
  const raw = Number(process.env.SESSION_ONLINE_WINDOW_MS ?? "");
  if (Number.isFinite(raw) && raw > 0) return raw;
  return DEFAULT_ONLINE_WINDOW_MS;
}

export function markUserOnline(sessionId: string, username: string, atIso?: string): void {
  if (!sessionId || !username) return;
  let bySession = presenceMap.get(sessionId);
  if (!bySession) {
    bySession = new Map();
    presenceMap.set(sessionId, bySession);
  }
  bySession.set(username, atIso ?? new Date().toISOString());
}

export function getOnlineUsers(sessionId: string, nowMs = Date.now()): string[] {
  const bySession = presenceMap.get(sessionId);
  if (!bySession) return [];
  const threshold = nowMs - onlineWindowMs();
  const result: string[] = [];
  for (const [username, iso] of bySession) {
    const ts = Date.parse(iso);
    if (Number.isFinite(ts) && ts >= threshold) result.push(username);
  }
  return result;
}
