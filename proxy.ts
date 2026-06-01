import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE_SESSION, verifyAuthSessionToken } from "@/src/lib/auth";
import { checkRateLimit } from "@/src/lib/rate-limit";
import { generateCspNonce } from "@/src/lib/csp-nonce";

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
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

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const ORIGIN_GUARDED_API_PREFIXES = ["/api/admin/", "/api/teacher/", "/api/session/"];

function isOriginGuardedApiPath(pathname: string): boolean {
  return ORIGIN_GUARDED_API_PREFIXES.some((prefix) => pathname === prefix.slice(0, -1) || pathname.startsWith(prefix));
}

function getExpectedOrigin(request: NextRequest): string | null {
  const configured = process.env.APP_ORIGIN?.trim();
  if (configured) {
    try {
      const parsed = new URL(configured);
      return `${parsed.protocol}//${parsed.host}`.toLowerCase();
    } catch {
      return null;
    }
  }

  // Fall back to runtime host/protocol only; avoid trusting forwarded host/proto
  // headers as CSRF baseline source.
  const host = request.headers.get("host") || request.nextUrl.host;
  if (!host) return null;
  const protocol = request.nextUrl.protocol.replace(":", "");
  if (!protocol) return null;
  return `${protocol.toLowerCase()}://${host.toLowerCase()}`;
}

function isSameOrigin(value: string, expectedOrigin: string): boolean {
  try {
    const parsed = new URL(value);
    return `${parsed.protocol}//${parsed.host}`.toLowerCase() === expectedOrigin;
  } catch {
    return false;
  }
}

function validateStateChangeOrigin(request: NextRequest): { ok: true } | { ok: false; error: "missing_origin" | "invalid_origin" } {
  const expectedOrigin = getExpectedOrigin(request);
  if (!expectedOrigin) return { ok: false, error: "invalid_origin" };

  const origin = request.headers.get("origin")?.trim();
  if (origin) {
    return isSameOrigin(origin, expectedOrigin) ? { ok: true } : { ok: false, error: "invalid_origin" };
  }

  // Fallback for environments that only attach Referer on same-origin requests.
  const referer = request.headers.get("referer")?.trim();
  if (referer) {
    return isSameOrigin(referer, expectedOrigin) ? { ok: true } : { ok: false, error: "invalid_origin" };
  }

  return { ok: false, error: "missing_origin" };
}

// ---------------------------------------------------------------------------
// #386: Nonce-based CSP — generated per page request.
// Replaces 'unsafe-inline' in script-src with 'nonce-{nonce}' + 'strict-dynamic'.
// The nonce is forwarded via x-nonce request header so RootLayout can read it.
// ---------------------------------------------------------------------------

function buildNonceCsp(nonce: string): string {
  const isProduction = process.env.NODE_ENV === "production";
  const parts = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isProduction ? "" : " 'unsafe-eval'"}`,
    "style-src 'self' 'unsafe-inline'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data: https:",
    "connect-src 'self' https:",
    "form-action 'self'",
    ...(isProduction ? ["upgrade-insecure-requests"] : [])
  ];
  return parts.join("; ");
}

/**
 * Build a NextResponse.next() that injects the CSP nonce into both
 * the request headers (readable by Server Components via headers()) and
 * the response headers (enforced by the browser).
 */
function nextWithNonce(request: NextRequest): NextResponse {
  const nonce = generateCspNonce();
  const csp = buildNonceCsp(nonce);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

// ---------------------------------------------------------------------------
// Proxy
// ---------------------------------------------------------------------------

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Rate limit API routes first
  if (pathname.startsWith("/api/")) {
    const ip = getClientIp(request);
    const { allowed, retryAfterSeconds } = await checkRateLimit(ip, pathname);
    if (!allowed) {
      return NextResponse.json(
        { error: "rate_limit_exceeded", retryAfterSeconds },
        {
          status: 429,
          headers: { "Retry-After": String(retryAfterSeconds) }
        }
      );
    }

    if (MUTATING_METHODS.has(request.method.toUpperCase()) && isOriginGuardedApiPath(pathname)) {
      const originValidation = validateStateChangeOrigin(request);
      if (!originValidation.ok) {
        return NextResponse.json({ error: originValidation.error }, { status: 403 });
      }
    }

    return NextResponse.next();
  }

  // Auth guard for page routes
  const sessionToken = request.cookies.get(AUTH_COOKIE_SESSION)?.value ?? "";
  const authedUser = sessionToken ? await verifyAuthSessionToken(sessionToken) : null;
  const role = authedUser?.role;
  const isAuthed = Boolean(authedUser);

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

  // All page routes: inject nonce-based CSP (#386)
  return nextWithNonce(request);
}

export const config = {
  matcher: ["/", "/api/:path*", "/login", "/student/:path*", "/teacher/:path*", "/admin/:path*"]
};
