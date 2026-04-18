import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE_ROLE, AUTH_COOKIE_USER } from "@/src/lib/auth";

function isStudentPath(pathname: string): boolean {
  return pathname === "/student" || pathname.startsWith("/student/");
}

function isTeacherPath(pathname: string): boolean {
  return pathname === "/teacher" || pathname.startsWith("/teacher/");
}

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const username = request.cookies.get(AUTH_COOKIE_USER)?.value;
  const role = request.cookies.get(AUTH_COOKIE_ROLE)?.value;
  const isAuthed = Boolean(username) && (role === "student" || role === "teacher");

  if (pathname === "/login" && isAuthed) {
    const url = request.nextUrl.clone();
    url.pathname = role === "teacher" ? "/teacher" : "/student";
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

    if (role !== "teacher") {
      const url = request.nextUrl.clone();
      url.pathname = "/student";
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/login", "/student/:path*", "/teacher/:path*"]
};
