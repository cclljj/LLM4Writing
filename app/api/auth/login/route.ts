import { NextRequest, NextResponse } from "next/server";
import {
  AUTH_COOKIE_ROLE,
  AUTH_COOKIE_SESSION,
  AUTH_COOKIE_USER,
  AUTH_SESSION_MAX_AGE,
  createAuthSessionToken,
  validateCredential
} from "@/src/lib/auth";

// ---------------------------------------------------------------------------
// #385: In-memory login brute-force protection
// Tracks failed attempts per username. Serverless-safe: resets on cold start,
// which is acceptable — persistent lockout requires external storage (Redis/DB).
// Limit: 10 failures within LOCKOUT_WINDOW_MS → locked for LOCKOUT_DURATION_MS.
// ---------------------------------------------------------------------------
const MAX_FAILURES = 10;
const LOCKOUT_WINDOW_MS = 10 * 60 * 1000; // 10 min sliding window
const LOCKOUT_DURATION_MS = 10 * 60 * 1000; // 10 min lockout
const RATE_LIMIT_DISABLED = process.env.DISABLE_LOGIN_RATE_LIMIT === "1";

type LoginAttemptRecord = { failures: number; windowStart: number; lockedUntil: number };
const loginAttempts = new Map<string, LoginAttemptRecord>();

function getLoginRecord(username: string): LoginAttemptRecord {
  const now = Date.now();
  let rec = loginAttempts.get(username);
  if (!rec || now - rec.windowStart > LOCKOUT_WINDOW_MS) {
    rec = { failures: 0, windowStart: now, lockedUntil: 0 };
    loginAttempts.set(username, rec);
  }
  return rec;
}

function isLockedOut(rec: LoginAttemptRecord): boolean {
  return rec.lockedUntil > Date.now();
}

function recordFailure(rec: LoginAttemptRecord): void {
  rec.failures += 1;
  if (rec.failures >= MAX_FAILURES) {
    rec.lockedUntil = Date.now() + LOCKOUT_DURATION_MS;
  }
}

function clearFailures(username: string): void {
  loginAttempts.delete(username);
}
// ---------------------------------------------------------------------------

function safeErrorDetail(error: unknown): string {
  if (!error) return "unknown";
  if (error instanceof Error) {
    const msg = error.message || "error";
    // Avoid leaking URLs/secrets in error messages.
    return msg.replace(/postgres:\/\/[^\\s]+/gi, "postgres://[redacted]").slice(0, 180);
  }
  if (typeof error === "string") return error.slice(0, 180);
  return "unknown";
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { username?: string; password?: string };
    const username = (body.username ?? "").trim();
    const password = body.password ?? "";

    // Check lockout before hitting bcrypt / DB (#385)
    if (!RATE_LIMIT_DISABLED && username) {
      const rec = getLoginRecord(username);
      if (isLockedOut(rec)) {
        const retryAfterSec = Math.ceil((rec.lockedUntil - Date.now()) / 1000);
        return NextResponse.json(
          { error: "too_many_attempts", retryAfterSeconds: retryAfterSec },
          { status: 429, headers: { "Retry-After": String(retryAfterSec) } }
        );
      }
    }

    const claims = await validateCredential(username, password);
    if (!claims) {
      if (!RATE_LIMIT_DISABLED && username) recordFailure(getLoginRecord(username));
      return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
    }

    // Success — clear failure record
    clearFailures(username);

    const user = { username: claims.username, role: claims.role };

    const response = NextResponse.json({
      ok: true,
      user,
      redirectTo: user.role === "student" ? "/student" : user.role === "admin" ? "/admin" : "/teacher"
    });
    const sessionToken = await createAuthSessionToken(claims);
    const cookieSecure = process.env.NODE_ENV === "production";
    response.cookies.set(AUTH_COOKIE_SESSION, sessionToken, {
      httpOnly: true,
      sameSite: "strict",
      secure: cookieSecure,
      path: "/",
      maxAge: AUTH_SESSION_MAX_AGE
    });
    // Clear legacy unsigned cookies so role is no longer client-controlled.
    response.cookies.set(AUTH_COOKIE_USER, "", {
      httpOnly: true,
      sameSite: "strict",
      secure: cookieSecure,
      path: "/",
      maxAge: 0
    });
    response.cookies.set(AUTH_COOKIE_ROLE, "", {
      httpOnly: true,
      sameSite: "strict",
      secure: cookieSecure,
      path: "/",
      maxAge: 0
    });

    return response;
  } catch (error) {
    return NextResponse.json(
      {
        error: "auth_service_unavailable",
        detail: safeErrorDetail(error),
        hint:
          "Check DB connectivity (Supabase pooler URL/port). For serverless, prefer Supabase transaction pooler (often :6543) and set SUPABASE_POOL_MODE=transaction."
      },
      { status: 503 }
    );
  }
}
