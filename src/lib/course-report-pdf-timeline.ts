export type PdfTimelineMessage = {
  role: string;
  step: number;
  text: string;
  at: string;
};

export type CourseReportTimelineItem =
  | { type: "outline"; step: 3 | 4 }
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

export function injectStep8DraftTimeline(
  timelineMessages: PdfTimelineMessage[],
  step8DraftRaw: string,
  fallbackAtIso: string
): PdfTimelineMessage[] {
  const step8Draft = (step8DraftRaw ?? "").trim();
  if (!step8Draft) return timelineMessages;
  const duplicated = timelineMessages.some((message) => normalizeStepValue(message.step) === 8 && message.text.trim() === step8Draft);
  if (duplicated) return timelineMessages;
  const anchorAt = timelineMessages[timelineMessages.length - 1]?.at ?? fallbackAtIso;
  const injected = {
    role: "system",
    step: 8,
    text: `## 步驟八最終稿\n${step8Draft}`,
    at: anchorAt,
  };
  const nextStepIndex = timelineMessages.findIndex((message) => normalizeStepValue(message.step) > 8);
  if (nextStepIndex < 0) return [...timelineMessages, injected];
  return [...timelineMessages.slice(0, nextStepIndex), injected, ...timelineMessages.slice(nextStepIndex)];
}

export function buildCourseReportTimelineItems(input: {
  messages: PdfTimelineMessage[];
  hasStep3Outline: boolean;
  hasStep4Outline: boolean;
}): CourseReportTimelineItem[] {
  const normalizedMessages = input.messages.map((message, index) => ({
    msg: { ...message, step: normalizeStepValue(message.step) },
    index,
  }));
  const steps = new Set(normalizedMessages.map((message) => message.msg.step).filter(Number.isFinite));
  if (input.hasStep3Outline) steps.add(3);
  if (input.hasStep4Outline) steps.add(4);

  return Array.from(steps)
    .sort((a, b) => a - b)
    .flatMap((step): CourseReportTimelineItem[] => {
      const items: CourseReportTimelineItem[] = [];
      if (step === 3 && input.hasStep3Outline) items.push({ type: "outline", step });
      if (step === 4 && input.hasStep4Outline) items.push({ type: "outline", step });
      normalizedMessages
        .filter((message) => message.msg.step === step)
        .sort((a, b) => a.index - b.index)
        .forEach(({ msg }) => items.push({ type: "message", msg }));
      return items;
    });
}
