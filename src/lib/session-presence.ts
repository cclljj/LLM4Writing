import { SessionState } from "@/src/lib/types";

const DEFAULT_ONLINE_WINDOW_MS = 45_000;

function onlineWindowMs(): number {
  const raw = Number(process.env.SESSION_ONLINE_WINDOW_MS ?? "");
  if (Number.isFinite(raw) && raw > 0) return raw;
  return DEFAULT_ONLINE_WINDOW_MS;
}

export function markUserOnline(session: SessionState, username: string, atIso?: string): void {
  if (!username) return;
  if (!session.onlineUsersLastSeen || typeof session.onlineUsersLastSeen !== "object") {
    session.onlineUsersLastSeen = {};
  }
  session.onlineUsersLastSeen[username] = atIso ?? new Date().toISOString();
}

export function getOnlineUsers(session: SessionState, nowMs = Date.now()): string[] {
  const map = session.onlineUsersLastSeen ?? {};
  const threshold = nowMs - onlineWindowMs();
  return Object.entries(map)
    .filter(([, iso]) => {
      const ts = Date.parse(iso);
      return Number.isFinite(ts) && ts >= threshold;
    })
    .map(([username]) => username);
}

