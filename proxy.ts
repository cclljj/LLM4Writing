import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE_ROLE, AUTH_COOKIE_USER } from "@/src/lib/auth";
import { checkRateLimit } from "@/src/lib/rate-limit";

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
