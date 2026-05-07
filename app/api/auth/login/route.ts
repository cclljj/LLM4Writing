import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE_ROLE, AUTH_COOKIE_USER, validateCredential } from "@/src/lib/auth";

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

    const user = await validateCredential(username, password);
    if (!user) {
      return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
    }

    const response = NextResponse.json({
      ok: true,
      user,
      redirectTo: user.role === "student" ? "/student" : user.role === "admin" ? "/admin" : "/teacher"
    });
    response.cookies.set(AUTH_COOKIE_USER, user.username, {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV == "production",
      path: "/",
      maxAge: 60 * 60 * 12
    });
    response.cookies.set(AUTH_COOKIE_ROLE, user.role, {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV == "production",
      path: "/",
      maxAge: 60 * 60 * 12
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
