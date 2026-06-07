import { isUpstashConfigured, upstashCommand, upstashPipeline } from "@/src/lib/upstash-rest";

export const LOGIN_MAX_FAILURES = 10;
export const LOGIN_LOCKOUT_WINDOW_MS = 10 * 60 * 1000;
export const LOGIN_LOCKOUT_DURATION_MS = 10 * 60 * 1000;

type LoginAttemptRecord = { failures: number; windowStart: number; lockedUntil: number };

const loginAttempts = new Map<string, LoginAttemptRecord>();

export class LoginRateLimitDependencyError extends Error {
  constructor(message = "login_rate_limit_dependency_unavailable") {
    super(message);
    this.name = "LoginRateLimitDependencyError";
  }
}

function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

function shouldFailClosedInProduction(): boolean {
  return process.env.NODE_ENV === "production" && process.env.ALLOW_INSECURE_MEMORY_RATE_LIMIT !== "1";
}

export function isLoginRateLimitDisabled(): boolean {
  if (process.env.DISABLE_LOGIN_RATE_LIMIT !== "1") return false;
  return process.env.NODE_ENV !== "production" || process.env.ALLOW_INSECURE_MEMORY_RATE_LIMIT === "1";
}

function getMemoryRecord(username: string, now: number): LoginAttemptRecord {
  const key = normalizeUsername(username);
  let rec = loginAttempts.get(key);
  if (!rec || now - rec.windowStart > LOGIN_LOCKOUT_WINDOW_MS) {
    rec = { failures: 0, windowStart: now, lockedUntil: 0 };
    loginAttempts.set(key, rec);
  }
  return rec;
}

function getRedisKeys(username: string): { failureKey: string; lockKey: string } {
  const normalized = normalizeUsername(username).replace(/[^a-z0-9_.@-]/g, "_");
  return {
    failureKey: `loginfail:${normalized}`,
    lockKey: `loginlock:${normalized}`
  };
}

function ensureLoginRateLimitStorageAvailable(): void {
  if (!isUpstashConfigured() && shouldFailClosedInProduction()) {
    throw new LoginRateLimitDependencyError();
  }
}

export async function checkLoginLockout(
  username: string,
  now = Date.now()
): Promise<{ locked: boolean; retryAfterSeconds: number }> {
  ensureLoginRateLimitStorageAvailable();
  if (!isUpstashConfigured()) {
    const rec = getMemoryRecord(username, now);
    if (rec.lockedUntil > now) {
      return { locked: true, retryAfterSeconds: Math.ceil((rec.lockedUntil - now) / 1000) };
    }
    return { locked: false, retryAfterSeconds: 0 };
  }

  const { lockKey } = getRedisKeys(username);
  try {
    const ttlRaw = await upstashCommand<number>(["TTL", lockKey]);
    const ttl = typeof ttlRaw === "number" ? ttlRaw : Number.NaN;
    if (Number.isFinite(ttl) && ttl > 0) {
      return { locked: true, retryAfterSeconds: Math.ceil(ttl) };
    }
    return { locked: false, retryAfterSeconds: 0 };
  } catch {
    if (shouldFailClosedInProduction()) throw new LoginRateLimitDependencyError();
    const rec = getMemoryRecord(username, now);
    return rec.lockedUntil > now
      ? { locked: true, retryAfterSeconds: Math.ceil((rec.lockedUntil - now) / 1000) }
      : { locked: false, retryAfterSeconds: 0 };
  }
}

export async function recordLoginFailure(username: string, now = Date.now()): Promise<void> {
  ensureLoginRateLimitStorageAvailable();
  if (!isUpstashConfigured()) {
    const rec = getMemoryRecord(username, now);
    rec.failures += 1;
    if (rec.failures >= LOGIN_MAX_FAILURES) {
      rec.lockedUntil = now + LOGIN_LOCKOUT_DURATION_MS;
    }
    return;
  }

  const { failureKey, lockKey } = getRedisKeys(username);
  try {
    const failuresRaw = await upstashCommand<number>(["INCR", failureKey]);
    const failures = typeof failuresRaw === "number" ? failuresRaw : Number.NaN;
    if (!Number.isFinite(failures)) throw new Error("login_rate_limit_incr_failed");
    if (failures === 1) {
      await upstashCommand<string>(["EXPIRE", failureKey, Math.ceil(LOGIN_LOCKOUT_WINDOW_MS / 1000)]);
    }
    if (failures >= LOGIN_MAX_FAILURES) {
      await upstashPipeline([
        ["SET", lockKey, "1", "EX", Math.ceil(LOGIN_LOCKOUT_DURATION_MS / 1000)],
        ["DEL", failureKey]
      ]);
    }
  } catch {
    if (shouldFailClosedInProduction()) throw new LoginRateLimitDependencyError();
    const rec = getMemoryRecord(username, now);
    rec.failures += 1;
    if (rec.failures >= LOGIN_MAX_FAILURES) {
      rec.lockedUntil = now + LOGIN_LOCKOUT_DURATION_MS;
    }
  }
}

export async function clearLoginFailures(username: string): Promise<void> {
  ensureLoginRateLimitStorageAvailable();
  const key = normalizeUsername(username);
  loginAttempts.delete(key);
  if (!isUpstashConfigured()) return;
  const { failureKey, lockKey } = getRedisKeys(username);
  try {
    await upstashPipeline([["DEL", failureKey], ["DEL", lockKey]]);
  } catch {
    if (shouldFailClosedInProduction()) throw new LoginRateLimitDependencyError();
  }
}

export function resetLoginRateLimitMemoryForTests(): void {
  loginAttempts.clear();
}
