import { NextRequest, NextResponse } from "next/server";
import { saveSession } from "@/src/lib/store";
import { requireStudentInSession } from "@/src/lib/api-helpers";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as { sessionId?: string };
  const result = await requireStudentInSession(body.sessionId);
  if (result instanceof NextResponse) return result;
  const { user, session } = result;

  if (session.currentStep !== 3) {
    return NextResponse.json({ error: "invalid_step" }, { status: 400 });
  }

  const doneKey = "3-complete";
  const doneUsers = new Set(session.groupGate[doneKey] ?? []);
  doneUsers.delete(user.username);
  session.groupGate[doneKey] = Array.from(doneUsers);

  const reopenKey = "3-reopen";
  const reopenUsers = new Set(session.groupGate[reopenKey] ?? []);
  reopenUsers.add(user.username);
  session.groupGate[reopenKey] = Array.from(reopenUsers);

  await saveSession(session);
  return NextResponse.json(session);
}
