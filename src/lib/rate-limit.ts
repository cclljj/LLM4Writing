import { isUpstashConfigured, upstashCommand, upstashPipeline } from "@/src/lib/upstash-rest";

export type RateLimitRule = { pattern: RegExp; max: number; windowMs: number };

export const RATE_LIMIT_RULES: RateLimitRule[] = [
  { pattern: /^\/api\/auth\/login/, max: 10, windowMs: 60_000 },
  { pattern: /^\/api\/chat\/send/, max: 30, windowMs: 60_000 },
  { pattern: /^\/api\//, max: 120, windowMs: 60_000 },
];

// Local fallback (dev / missing Redis / transient Redis errors).
const rlStore = new Map<string, number[]>();

function findRule(pathname: string): RateLimitRule | undefined {
  return RATE_LIMIT_RULES.find((r) => r.pattern.test(pathname));
}

function checkRateLimitInMemory(
  rule: RateLimitRule,
  ip: string,
  now: number
): { allowed: boolean; retryAfterSeconds: number } {
  const key = `${ip}::${rule.pattern.source}`;
  const timestamps = (rlStore.get(key) ?? []).filter((t) => now - t < rule.windowMs);

  if (timestamps.length >= rule.max) {
    const retryAfterMs = rule.windowMs - (now - timestamps[0]!);
    return { allowed: false, retryAfterSeconds: Math.ceil(retryAfterMs / 1000) };
  }

  timestamps.push(now);
  rlStore.set(key, timestamps);
  return { allowed: true, retryAfterSeconds: 0 };
}

async function checkRateLimitInRedis(
  rule: RateLimitRule,
  ip: string,
  now: number
): Promise<{ allowed: boolean; retryAfterSeconds: number } | null> {
  const bucket = Math.floor(now / rule.windowMs);
  const key = `ratelimit:${rule.pattern.source}:${ip}:${bucket}`;
  const windowSec = Math.ceil(rule.windowMs / 1000);

  const incrRaw = await upstashCommand<number>(["INCR", key]);
  const incr = typeof incrRaw === "number" ? incrRaw : Number.NaN;
  if (!Number.isFinite(incr)) return null;

  if (incr === 1) {
    await upstashCommand<string>(["EXPIRE", key, windowSec]);
  }

  if (incr <= rule.max) {
    return { allowed: true, retryAfterSeconds: 0 };
  }

  // Best-effort TTL lookup for Retry-After.
  const ttl = await upstashPipeline([["TTL", key]]);
  const ttlSeconds = Number(ttl?.[0]?.result ?? 0);
  const retryAfterSeconds = Number.isFinite(ttlSeconds) && ttlSeconds > 0 ? ttlSeconds : windowSec;
  return { allowed: false, retryAfterSeconds };
}

export async function checkRateLimit(
  ip: string,
  pathname: string,
  now = Date.now()
): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
  const rule = findRule(pathname);
  if (!rule) return { allowed: true, retryAfterSeconds: 0 };

  if (!isUpstashConfigured()) {
    return checkRateLimitInMemory(rule, ip, now);
  }

  try {
    const distributed = await checkRateLimitInRedis(rule, ip, now);
    if (distributed) return distributed;
  } catch {
    // Fall back to in-memory when Redis is temporarily unavailable.
  }

  return checkRateLimitInMemory(rule, ip, now);
}
