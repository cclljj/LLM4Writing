import { NextRequest, NextResponse } from "next/server";
import { createSession } from "@/src/lib/engine";
import { saveSession } from "@/src/lib/store";
import { StartSessionPayload } from "@/src/lib/types";

export async function POST(request: NextRequest) {
  const payload = (await request.json()) as StartSessionPayload;
  const participants = (payload.participants ?? []).filter(Boolean);

  if (participants.length === 0) {
    return NextResponse.json({ error: "participants_required" }, { status: 400 });
  }

  const session = createSession(participants);
  saveSession(session);

  return NextResponse.json(session, { status: 201 });
}
