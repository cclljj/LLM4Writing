import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE_ROLE, AUTH_COOKIE_USER } from "@/src/lib/auth";

// ---------------------------------------------------------------------------
// Rate limiting (in-process sliding window)
// Note: state is per-process instance; across multiple Edge replicas each
// replica enforces its own limit. This is sufficient to stop brute force on
// a school-scale deployment.
// ---------------------------------------------------------------------------

type RateLimitRule = { pattern: RegExp; max: number; windowMs: number };

const RATE_LIMIT_RULES: RateLimitRule[] = [
  { pattern: /^\/api\/auth\/login/, max: 10, windowMs: 60_000 },
  { pattern: /^\/api\/chat\/send/, max: 30, windowMs: 60_000 },
  { pattern: /^\/api\//, max: 120, windowMs: 60_000 },
];

// Map<"ip::ruleSource", timestamps[]>
const rlStore = new Map<string, number[]>();

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

function checkRateLimit(ip: string, pathname: string): { allowed: boolean; retryAfterSeconds: number } {
  const rule = RATE_LIMIT_RULES.find((r) => r.pattern.test(pathname));
  if (!rule) return { allowed: true, retryAfterSeconds: 0 };

  const now = Date.now();
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

// ---------------------------------------------------------------------------
// Path helpers for auth guard
// ---------------------------------------------------------------------------

function isStudentPath(pathname: string): boolean {
  return pathname === "/student" || pathname.startsWith("/student/");
}

function isTeacherPath(pathname: string): boolean {
  return pathname === "/teacher" || pathname.startsWith("/teacher/");
}

function isAdminPath(pathname: string): boolean {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

// ---------------------------------------------------------------------------
// Proxy
// ---------------------------------------------------------------------------

export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Rate limit API routes first
  if (pathname.startsWith("/api/")) {
    const ip = getClientIp(request);
    const { allowed, retryAfterSeconds } = checkRateLimit(ip, pathname);
    if (!allowed) {
      return NextResponse.json(
        { error: "rate_limit_exceeded", retryAfterSeconds },
        {
          status: 429,
          headers: { "Retry-After": String(retryAfterSeconds) }
        }
      );
    }
    return NextResponse.next();
  }

  // Auth guard for page routes
  const username = request.cookies.get(AUTH_COOKIE_USER)?.value;
  const role = request.cookies.get(AUTH_COOKIE_ROLE)?.value;
  const isAuthed = Boolean(username) && (role === "student" || role === "teacher" || role === "admin");

  if (pathname === "/login" && isAuthed) {
    const url = request.nextUrl.clone();
    url.pathname = role === "student" ? "/student" : role === "admin" ? "/admin" : "/teacher";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (isStudentPath(pathname)) {
    if (!isAuthed) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }

    if (role !== "student") {
      const url = request.nextUrl.clone();
      url.pathname = "/teacher";
      return NextResponse.redirect(url);
    }
  }

  if (isTeacherPath(pathname)) {
    if (!isAuthed) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }

    if (role !== "teacher" && role !== "admin") {
      const url = request.nextUrl.clone();
      url.pathname = "/student";
      return NextResponse.redirect(url);
    }
  }

  if (isAdminPath(pathname)) {
    if (!isAuthed) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }

    if (role !== "admin") {
      const url = request.nextUrl.clone();
      url.pathname = role === "student" ? "/student" : "/teacher";
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*", "/login", "/student/:path*", "/teacher/:path*", "/admin/:path*"]
};
