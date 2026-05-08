import { NextRequest, NextResponse } from "next/server";
import { recordArtifactUpdateSignal } from "@/src/lib/learning-diagnostics";
import { saveSession } from "@/src/lib/store";
import { requireStudentInSession } from "@/src/lib/api-helpers";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as { sessionId?: string; outline?: string };
  const result = await requireStudentInSession(body.sessionId);
  if (result instanceof NextResponse) return result;
  const { user, session } = result;

  if (session.currentStep !== 3) {
    return NextResponse.json({ error: "invalid_step" }, { status: 400 });
  }
  const outlineText = typeof body.outline === "string" ? body.outline : "";
  session.outlines[user.username] = outlineText;
  recordArtifactUpdateSignal(session, "outline", user.username);
  if (!session.step3SubmittedOutlines) session.step3SubmittedOutlines = {};
  if (!session.step3SubmittedOutlines[user.username]) {
    session.step3SubmittedOutlines[user.username] = outlineText;
  }

  const key = "3-complete";
  const doneUsers = new Set(session.groupGate[key] ?? []);
  doneUsers.add(user.username);
  session.groupGate[key] = Array.from(doneUsers);

  await saveSession(session);
  return NextResponse.json(session);
}
