import { NextRequest, NextResponse } from "next/server";
import { findActivity } from "@/src/lib/activity-store";
import { recordArtifactUpdateSignal } from "@/src/lib/learning-diagnostics";
import { resolveStructureTreeTemplate } from "@/src/lib/genre-resolver";
import { saveSession } from "@/src/lib/store";
import { validateStep3OutlineCompletion } from "@/src/lib/step3-outline-validation";
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
  if (outlineText.length > 10_000) { // #388
    return NextResponse.json({ error: "input_too_long", field: "outline", maxLength: 10_000 }, { status: 400 });
  }
  const activity = session.activityId ? findActivity(session.activityId) : undefined;
  const templateTitle = activity?.title ?? session.activityTitle ?? "作文題目";
  const templateGenre = activity?.genre ?? "議論文";
  const defaultOutlineTemplate = resolveStructureTreeTemplate(templateGenre, templateTitle);
  if (!defaultOutlineTemplate.trim()) {
    return NextResponse.json({ error: "step3_default_outline_unavailable" }, { status: 500 });
  }
  const outlineValidation = validateStep3OutlineCompletion(defaultOutlineTemplate, outlineText, 3);
  if (!outlineValidation.ok) {
    return NextResponse.json(
      {
        error: "step3_outline_depth3_not_edited",
        detail: {
          requiredNodeCount: outlineValidation.requiredNodeCount,
          changedNodeCount: outlineValidation.changedNodeCount
        }
      },
      { status: 400 }
    );
  }

  session.outlines[user.username] = outlineText;
  recordArtifactUpdateSignal(session, "outline", user.username);
  if (!session.step3SubmittedOutlines) session.step3SubmittedOutlines = {};
  session.step3SubmittedOutlines[user.username] = outlineText;

  const key = "3-complete";
  const doneUsers = new Set(session.groupGate[key] ?? []);
  doneUsers.add(user.username);
  session.groupGate[key] = Array.from(doneUsers);
  const reopenKey = "3-reopen";
  const reopenUsers = new Set(session.groupGate[reopenKey] ?? []);
  if (reopenUsers.has(user.username)) {
    reopenUsers.delete(user.username);
    session.groupGate[reopenKey] = Array.from(reopenUsers);
  }

  await saveSession(session);
  return NextResponse.json(session);
}
