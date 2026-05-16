import { NextRequest, NextResponse } from "next/server";
import {
  AUTH_COOKIE_ROLE,
  AUTH_COOKIE_SESSION,
  AUTH_COOKIE_USER,
  AUTH_SESSION_MAX_AGE,
  createAuthSessionToken,
  validateCredential
} from "@/src/lib/auth";

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

    const claims = await validateCredential(username, password);
    if (!claims) {
      return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
    }
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
