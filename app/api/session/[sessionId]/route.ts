import { NextResponse } from "next/server";
import { getSession, saveSession } from "@/src/lib/store";
import { reconcileCompletedStep9Users } from "@/src/lib/engine";
import { findActivity, hydrateDomainState, resolvePromptConfigForActivity, resolveStructureTreeTemplate } from "@/src/lib/mock-data";
import { getCurrentUser } from "@/src/lib/auth-server";
import { markUserOnline } from "@/src/lib/session-presence";

function isSingleNodeOutline(outline: string): boolean {
  const raw = outline.trim();
  if (!raw) return true;
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !line.startsWith("graph "))
    .filter((line) => !line.startsWith("flowchart "))
    .filter((line) => !line.startsWith("```"));
  const nodeIds = new Set<string>();
  for (const line of lines) {
    const nodeMatch = line.match(/^([A-Za-z0-9_-]+)\s*\["([\s\S]*)"\]$/);
    if (nodeMatch) {
      nodeIds.add(nodeMatch[1]!);
      continue;
    }
    const edgeWithLabelMatch = line.match(/^([A-Za-z0-9_-]+)\s*-->\s*([A-Za-z0-9_-]+)\s*\["([\s\S]*)"\]$/);
    if (edgeWithLabelMatch) {
      nodeIds.add(edgeWithLabelMatch[1]!);
      nodeIds.add(edgeWithLabelMatch[2]!);
      continue;
    }
    const edgeMatch = line.match(/^([A-Za-z0-9_-]+)\s*-->\s*([A-Za-z0-9_-]+)$/);
    if (edgeMatch) {
      nodeIds.add(edgeMatch[1]!);
      nodeIds.add(edgeMatch[2]!);
    }
  }
  return nodeIds.size <= 1;
}

export async function GET(_: Request, context: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await context.params;
  const session = await getSession(sessionId);

  if (!session) {
    return NextResponse.json({ error: "session_not_found" }, { status: 404 });
  }
  let changed = false;
  const user = await getCurrentUser();
  if (user?.role === "student" && session.participants.includes(user.username)) {
    markUserOnline(session, user.username);
    changed = true;
  }
  await hydrateDomainState();
  if (session.activityId) {
    const activity = findActivity(session.activityId);
    const resolvedConfig = resolvePromptConfigForActivity(session.activityId);
    const nextStepOpenings = {
      ...(resolvedConfig.stepOpenings ?? {}),
      ...(session.promptConfig?.stepOpenings ?? {})
    };
    const hadStepOpenings = Boolean(session.promptConfig?.stepOpenings && Object.keys(session.promptConfig.stepOpenings).length > 0);
    if (!hadStepOpenings) {
      session.promptConfig = {
        ...resolvedConfig,
        ...session.promptConfig,
        stepOpenings: nextStepOpenings
      };
      changed = true;
    }
    if (!session.outlines || typeof session.outlines !== "object") {
      session.outlines = {};
      changed = true;
    }
    if (activity) {
      const structureTreeTemplate = resolveStructureTreeTemplate(activity.genre, activity.title);
      let outlineBackfilled = false;
      if (structureTreeTemplate) {
        session.participants.forEach((participant) => {
          if (isSingleNodeOutline(session.outlines?.[participant] ?? "")) {
            session.outlines[participant] = structureTreeTemplate;
            outlineBackfilled = true;
            changed = true;
          }
        });
      }
    }
  }
  if (!session.step3SubmittedOutlines || typeof session.step3SubmittedOutlines !== "object") {
    session.step3SubmittedOutlines = {};
    changed = true;
  }
  if (session.currentStep >= 4) {
    const doneUsers = new Set(session.groupGate?.["3-complete"] ?? []);
    session.participants.forEach((participant) => {
      if (!doneUsers.has(participant)) return;
      const snapshot = session.step3SubmittedOutlines?.[participant]?.trim() ?? "";
      const outline = session.outlines?.[participant]?.trim() ?? "";
      if (!snapshot && outline) {
        session.step3SubmittedOutlines![participant] = outline;
        changed = true;
      }
    });
  }
  const reconciled = await reconcileCompletedStep9Users(session);
  if (reconciled) {
    changed = true;
  }
  if (changed) {
    await saveSession(session);
  }

  return NextResponse.json(session);
}
