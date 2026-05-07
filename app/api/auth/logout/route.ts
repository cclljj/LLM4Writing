import { NextResponse } from "next/server";
import { AUTH_COOKIE_ROLE, AUTH_COOKIE_USER } from "@/src/lib/auth";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(AUTH_COOKIE_USER, "", { httpOnly: true, sameSite: "strict", path: "/", maxAge: 0 });
  response.cookies.set(AUTH_COOKIE_ROLE, "", { httpOnly: true, sameSite: "strict", path: "/", maxAge: 0 });
  return response;
}
