import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/src/lib/auth-server";
import { getUsers, resetUserPassword } from "@/src/lib/mock-data";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "teacher") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  return NextResponse.json({ users: getUsers() });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "teacher") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = (await request.json()) as { username?: string; newPassword?: string };
  if (!body.username || !body.newPassword) {
    return NextResponse.json({ error: "missing_required_fields" }, { status: 400 });
  }

  const ok = resetUserPassword(body.username, body.newPassword);
  if (!ok) {
    return NextResponse.json({ error: "user_not_found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
