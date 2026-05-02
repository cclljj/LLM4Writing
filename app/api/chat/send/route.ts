import { NextRequest, NextResponse } from "next/server";
import { sendStudentMessage } from "@/src/lib/engine";
import { getSession, saveSession } from "@/src/lib/store";
import { SendMessagePayload } from "@/src/lib/types";
import { getCurrentUser } from "@/src/lib/auth-server";

export async function POST(request: NextRequest) {
  const payload = (await request.json()) as SendMessagePayload;
  const user = await getCurrentUser();
  if (!user || user.role !== "student") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const session = await getSession(payload.sessionId);

  if (!session) {
    return NextResponse.json({ error: "session_not_found" }, { status: 404 });
  }

  try {
    const updated = await sendStudentMessage(session, user.username, payload.text);
    await saveSession(updated);
    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "send_failed" },
      { status: 400 }
    );
  }
}
