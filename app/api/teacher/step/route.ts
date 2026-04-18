import { NextRequest, NextResponse } from "next/server";
import { getSession, saveSession } from "@/src/lib/store";
import { switchStep } from "@/src/lib/engine";
import { SwitchStepPayload } from "@/src/lib/types";

export async function POST(request: NextRequest) {
  const payload = (await request.json()) as SwitchStepPayload;
  const session = await getSession(payload.sessionId);

  if (!session) {
    return NextResponse.json({ error: "session_not_found" }, { status: 404 });
  }

  try {
    const updated = switchStep(session, payload.step);
    await saveSession(updated);
    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "switch_failed" },
      { status: 400 }
    );
  }
}
