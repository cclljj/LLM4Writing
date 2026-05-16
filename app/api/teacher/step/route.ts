import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/src/lib/auth-server";
import { getSession, saveSession } from "@/src/lib/store";
import { switchStep } from "@/src/lib/engine";
import { SwitchStepPayload } from "@/src/lib/types";
import { recordAuditLog } from "@/src/lib/audit-log-store";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || (user.role !== "teacher" && user.role !== "admin")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const payload = (await request.json()) as SwitchStepPayload;
  const session = await getSession(payload.sessionId);

  if (!session) {
    return NextResponse.json({ error: "session_not_found" }, { status: 404 });
  }

  try {
    const fromStep = session.currentStep;
    const updated = await switchStep(session, payload.step);
    await saveSession(updated);
    void recordAuditLog({
      actorUsername: user.username,
      actorRole: user.role,
      action: "teacher_step_switch",
      targetType: "session",
      targetId: updated.id,
      targetLabel: updated.groupName ?? updated.groupId ?? updated.id,
      details: {
        activityId: updated.activityId ?? "",
        fromStep,
        toStep: payload.step
      }
    }).catch(() => undefined);
    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "switch_failed" },
      { status: 400 }
    );
  }
}
