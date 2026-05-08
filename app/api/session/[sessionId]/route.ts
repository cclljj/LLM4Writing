import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getSessionWithMeta, saveSession } from "@/src/lib/store";
import { reconcileCompletedStep9Users } from "@/src/lib/engine";
import { recoverStalledStep1Or2AiWait } from "@/src/lib/workflow-step1-2";
import { ChatMessage } from "@/src/lib/types";
import { hydrateDomainState } from "@/src/lib/activity-store";
import { loadActivityWithConfig } from "@/src/lib/prompt-config";
import { resolveStructureTreeTemplate } from "@/src/lib/genre-resolver";
import { getCurrentUser } from "@/src/lib/auth-server";
import { markUserOnline } from "@/src/lib/session-presence";

function makeMessage(input: Omit<ChatMessage, "id" | "at">): ChatMessage {
  return {
    id: randomUUID(),
    at: new Date().toISOString(),
    ...input
  };
}

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

export async function GET(request: Request, context: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await context.params;
  const meta = await getSessionWithMeta(sessionId);

  if (!meta) {
    return NextResponse.json({ error: "session_not_found" }, { status: 404 });
  }

  const { session, updatedAt } = meta;
  const etag = `"${updatedAt}"`;

  // Mark presence in the in-process map (does NOT touch session payload or updated_at)
  const user = await getCurrentUser();
  if (user?.role === "student" && session.participants.includes(user.username)) {
    markUserOnline(session.id, user.username);
  }

  // ETag check — only after presence is recorded (presence is side-effect only)
  const ifNoneMatch = request.headers.get("if-none-match");
  if (ifNoneMatch === etag) {
    return new NextResponse(null, {
      status: 304,
      headers: { ETag: etag }
    });
  }

  let changed = false;
  await hydrateDomainState();
  if (session.activityId) {
    const loaded = loadActivityWithConfig(session.activityId);
    const resolvedConfig = loaded?.promptConfig;
    const nextStepOpenings = {
      ...(resolvedConfig?.stepOpenings ?? {}),
      ...(session.promptConfig?.stepOpenings ?? {})
    };
    const hadStepOpenings = Boolean(session.promptConfig?.stepOpenings && Object.keys(session.promptConfig.stepOpenings).length > 0);
    if (!hadStepOpenings && resolvedConfig) {
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
    if (loaded?.activity) {
      const { activity } = loaded;
      const structureTreeTemplate = resolveStructureTreeTemplate(activity.genre, activity.title);
      if (structureTreeTemplate) {
        session.participants.forEach((participant) => {
          if (isSingleNodeOutline(session.outlines?.[participant] ?? "")) {
            session.outlines[participant] = structureTreeTemplate;
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
  if (recoverStalledStep1Or2AiWait(session, makeMessage)) {
    changed = true;
  }
  if (changed) {
    await saveSession(session);
  }

  const response = NextResponse.json(session);
  response.headers.set("ETag", changed ? `"${new Date().toISOString()}"` : etag);
  return response;
}
