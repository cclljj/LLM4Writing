import { isUpstashConfigured, upstashPipeline } from "@/src/lib/upstash-rest";

// Local fallback presence tracking: sessionId → username → ISO timestamp.
// Used when Upstash is not configured or temporarily unavailable.
const presenceMap = new Map<string, Map<string, string>>();

const DEFAULT_ONLINE_WINDOW_MS = 45_000;

function onlineWindowMs(): number {
  const raw = Number(process.env.SESSION_ONLINE_WINDOW_MS ?? "");
  if (Number.isFinite(raw) && raw > 0) return raw;
  return DEFAULT_ONLINE_WINDOW_MS;
}

function markUserOnlineInMemory(sessionId: string, username: string, atIso?: string): void {
  if (!sessionId || !username) return;
  let bySession = presenceMap.get(sessionId);
  if (!bySession) {
    bySession = new Map();
    presenceMap.set(sessionId, bySession);
  }
  bySession.set(username, atIso ?? new Date().toISOString());
}

function getOnlineUsersInMemory(sessionId: string, nowMs = Date.now()): string[] {
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

async function markUserOnlineInRedis(sessionId: string, username: string, atIso?: string): Promise<void> {
  const at = atIso ?? new Date().toISOString();
  const ttlMs = onlineWindowMs();
  const userKey = `presence:${sessionId}:${username}`;
  const setKey = `presence:${sessionId}:users`;

  await upstashPipeline([
    ["SET", userKey, at, "PX", ttlMs],
    ["SADD", setKey, username],
    ["PEXPIRE", setKey, ttlMs * 2]
  ]);
}

async function getOnlineUsersInRedis(sessionId: string, nowMs = Date.now()): Promise<string[] | null> {
  const setKey = `presence:${sessionId}:users`;
  const usersRes = await upstashPipeline([["SMEMBERS", setKey]]);
  const users = usersRes?.[0]?.result;
  if (!Array.isArray(users) || users.length === 0) return [];

  const commands = users.map((username) => ["GET", `presence:${sessionId}:${String(username)}`] as Array<string | number>);
  const values = await upstashPipeline(commands);
  if (!values) return null;

  const threshold = nowMs - onlineWindowMs();
  const result: string[] = [];
  const staleUsers: string[] = [];
  for (let i = 0; i < users.length; i += 1) {
    const username = String(users[i]);
    const iso = values[i]?.result;
    if (typeof iso !== "string") {
      staleUsers.push(username);
      continue;
    }
    const ts = Date.parse(iso);
    if (Number.isFinite(ts) && ts >= threshold) result.push(username);
  }

  if (staleUsers.length > 0) {
    const cleanupCommands = staleUsers.map((username) => ["SREM", setKey, username] as Array<string | number>);
    await upstashPipeline(cleanupCommands).catch(() => undefined);
  }

  return result;
}

export async function markUserOnline(sessionId: string, username: string, atIso?: string): Promise<void> {
  if (!isUpstashConfigured()) {
    markUserOnlineInMemory(sessionId, username, atIso);
    return;
  }
  try {
    await markUserOnlineInRedis(sessionId, username, atIso);
  } catch {
    markUserOnlineInMemory(sessionId, username, atIso);
  }
}

export async function getOnlineUsers(sessionId: string, nowMs = Date.now()): Promise<string[]> {
  if (!isUpstashConfigured()) {
    return getOnlineUsersInMemory(sessionId, nowMs);
  }
  try {
    const distributed = await getOnlineUsersInRedis(sessionId, nowMs);
    if (distributed) return distributed;
  } catch {
    // fall through
  }
  return getOnlineUsersInMemory(sessionId, nowMs);
}
