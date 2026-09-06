import type { CourseWorkflowStep } from "@/src/lib/types";
import { getWorkflowStepOrderIndex } from "@/src/lib/course-workflow";

export type PdfTimelineMessage = {
  role: string;
  step: number;
  text: string;
  at: string;
};

export type CourseReportTimelineItem =
  | { type: "outline"; step: number; outlineKind: "submitted_outline" | "revised_outline" }
  | { type: "message"; msg: PdfTimelineMessage };

function normalizeStepValue(rawStep: unknown): number {
  if (typeof rawStep === "number" && Number.isFinite(rawStep)) return rawStep;
  if (typeof rawStep === "string") {
    const direct = Number(rawStep.trim());
    if (Number.isFinite(direct)) return direct;
    const match = rawStep.match(/\d+/);
    if (match) {
      const parsed = Number(match[0]);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return Number.POSITIVE_INFINITY;
}

function workflowOrderIndex(workflowSteps: CourseWorkflowStep[] | undefined, step: number): number {
  if (!workflowSteps || workflowSteps.length === 0) return normalizeStepValue(step);
  return getWorkflowStepOrderIndex({ workflowSteps }, step);
}

export function injectStep8DraftTimeline(
  timelineMessages: PdfTimelineMessage[],
  step8DraftRaw: string,
  fallbackAtIso: string,
  revisionStep = 8,
  workflowSteps?: CourseWorkflowStep[]
): PdfTimelineMessage[] {
  const step8Draft = (step8DraftRaw ?? "").trim();
  if (!step8Draft) return timelineMessages;
  const duplicated = timelineMessages.some((message) => normalizeStepValue(message.step) === revisionStep && message.text.trim() === step8Draft);
  if (duplicated) return timelineMessages;
  const anchorAt = timelineMessages[timelineMessages.length - 1]?.at ?? fallbackAtIso;
  const injected = {
    role: "system",
    step: revisionStep,
    text: `## 最終稿\n${step8Draft}`,
    at: anchorAt,
  };
  const revisionOrderIndex = workflowOrderIndex(workflowSteps, revisionStep);
  const nextStepIndex = timelineMessages.findIndex((message) => workflowOrderIndex(workflowSteps, normalizeStepValue(message.step)) > revisionOrderIndex);
  if (nextStepIndex < 0) return [...timelineMessages, injected];
  return [...timelineMessages.slice(0, nextStepIndex), injected, ...timelineMessages.slice(nextStepIndex)];
}

export function buildCourseReportTimelineItems(input: {
  messages: PdfTimelineMessage[];
  hasStep3Outline: boolean;
  hasStep4Outline: boolean;
  outlineStep?: number;
  peerOutlineStep?: number;
  workflowSteps?: CourseWorkflowStep[];
}): CourseReportTimelineItem[] {
  const hasConfiguredWorkflow = Boolean(input.workflowSteps && input.workflowSteps.length > 0);
  const outlineStep = input.outlineStep ?? (hasConfiguredWorkflow ? undefined : 3);
  const peerOutlineStep = input.peerOutlineStep ?? (hasConfiguredWorkflow ? undefined : 4);
  const normalizedMessages = input.messages.map((message, index) => ({
    msg: { ...message, step: normalizeStepValue(message.step) },
    index,
  }));
  const steps = new Set(normalizedMessages.map((message) => message.msg.step).filter(Number.isFinite));
  if (input.hasStep3Outline && outlineStep !== undefined) steps.add(outlineStep);
  if (input.hasStep4Outline && peerOutlineStep !== undefined) steps.add(peerOutlineStep);

  return Array.from(steps)
    .sort((a, b) => workflowOrderIndex(input.workflowSteps, a) - workflowOrderIndex(input.workflowSteps, b))
    .flatMap((step): CourseReportTimelineItem[] => {
      const items: CourseReportTimelineItem[] = [];
      if (outlineStep !== undefined && step === outlineStep && input.hasStep3Outline) items.push({ type: "outline", step, outlineKind: "submitted_outline" });
      if (peerOutlineStep !== undefined && step === peerOutlineStep && input.hasStep4Outline) items.push({ type: "outline", step, outlineKind: "revised_outline" });
      normalizedMessages
        .filter((message) => message.msg.step === step)
        .sort((a, b) => a.index - b.index)
        .forEach(({ msg }) => items.push({ type: "message", msg }));
      return items;
    });
}
