import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/src/lib/auth-server";
import { getSession, saveSession } from "@/src/lib/store";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "student") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = (await request.json()) as { sessionId?: string };
  if (!body.sessionId) {
    return NextResponse.json({ error: "missing_required_fields" }, { status: 400 });
  }

  const session = await getSession(body.sessionId);
  if (!session) {
    return NextResponse.json({ error: "session_not_found" }, { status: 404 });
  }
  if (!session.participants.includes(user.username)) {
    return NextResponse.json({ error: "not_participant" }, { status: 403 });
  }
  if (session.currentStep !== 4) {
    return NextResponse.json({ error: "invalid_step" }, { status: 400 });
  }

  const key = "4-complete";
  const doneUsers = new Set(session.groupGate[key] ?? []);
  doneUsers.add(user.username);
  session.groupGate[key] = Array.from(doneUsers);

  await saveSession(session);
  return NextResponse.json(session);
}
