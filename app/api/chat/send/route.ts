import { NextRequest, NextResponse } from "next/server";
import { sendStudentMessage } from "@/src/lib/engine";
import { getSession, saveSession } from "@/src/lib/store";
import { SendMessagePayload } from "@/src/lib/types";
import { getCurrentUser } from "@/src/lib/auth-server";
import { markUserOnline } from "@/src/lib/session-presence";
import { buildStudentInputHint } from "@/src/lib/student-input-hint";

const NON_HINT_ERRORS = new Set(["forbidden", "session_not_found", "unknown_participant", "step_non_interactive", "send_failed"]);

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

  const qualitySignalsBeforeSend = JSON.stringify(session.qualitySignals ?? {});

  try {
    markUserOnline(session.id, user.username);
    const userStep = session.personalSteps?.[user.username] ?? session.currentStep;
    const updated = await sendStudentMessage(session, user.username, payload.text, userStep, {
      onBeforeGroupAi: async (snapshot) => {
        await saveSession(snapshot);
      }
    });
    await saveSession(updated);
    return NextResponse.json(updated);
  } catch (error) {
    if (JSON.stringify(session.qualitySignals ?? {}) !== qualitySignalsBeforeSend) {
      await saveSession(session).catch(() => undefined);
    }
    const message = error instanceof Error ? error.message : "send_failed";
    const shouldAttachHint = typeof message === "string" && message.trim() && !NON_HINT_ERRORS.has(message);
    return NextResponse.json(
      {
        error: message,
        ...(shouldAttachHint ? { hint: buildStudentInputHint(message) } : {})
      },
      { status: 400 }
    );
  }
}
