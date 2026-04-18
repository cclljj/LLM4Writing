import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE_ROLE, AUTH_COOKIE_USER, validateCredential } from "@/src/lib/auth";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as { username?: string; password?: string };
  const username = (body.username ?? "").trim();
  const password = body.password ?? "";

  const user = validateCredential(username, password);
  if (!user) {
    return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true, user, redirectTo: user.role === "teacher" ? "/teacher" : "/student" });
  response.cookies.set(AUTH_COOKIE_USER, user.username, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV == "production",
    path: "/",
    maxAge: 60 * 60 * 12
  });
  response.cookies.set(AUTH_COOKIE_ROLE, user.role, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV == "production",
    path: "/",
    maxAge: 60 * 60 * 12
  });

  return response;
}
