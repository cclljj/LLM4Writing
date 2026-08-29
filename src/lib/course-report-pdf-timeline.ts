export type PdfTimelineMessage = {
  role: string;
  step: number;
  text: string;
  at: string;
};

export type CourseReportTimelineItem =
  | { type: "outline"; step: 3 | 4 }
  | { type: "message"; msg: PdfTimelineMessage };

export function injectStep8DraftTimeline(
  timelineMessages: PdfTimelineMessage[],
  step8DraftRaw: string,
  fallbackAtIso: string
): PdfTimelineMessage[] {
  const step8Draft = (step8DraftRaw ?? "").trim();
  if (!step8Draft) return timelineMessages;
  const duplicated = timelineMessages.some((message) => message.step === 8 && message.text.trim() === step8Draft);
  if (duplicated) return timelineMessages;
  const anchorAt = timelineMessages[timelineMessages.length - 1]?.at ?? fallbackAtIso;
  const injected = {
    role: "system",
    step: 8,
    text: `## 步驟八最終稿\n${step8Draft}`,
    at: anchorAt,
  };
  const nextStepIndex = timelineMessages.findIndex((message) => message.step > 8);
  if (nextStepIndex < 0) return [...timelineMessages, injected];
  return [...timelineMessages.slice(0, nextStepIndex), injected, ...timelineMessages.slice(nextStepIndex)];
}

export function buildCourseReportTimelineItems(input: {
  messages: PdfTimelineMessage[];
  hasStep3Outline: boolean;
  hasStep4Outline: boolean;
}): CourseReportTimelineItem[] {
  const steps = new Set(input.messages.map((message) => message.step));
  if (input.hasStep3Outline) steps.add(3);
  if (input.hasStep4Outline) steps.add(4);

  return Array.from(steps)
    .sort((a, b) => a - b)
    .flatMap((step): CourseReportTimelineItem[] => {
      const items: CourseReportTimelineItem[] = [];
      if (step === 3 && input.hasStep3Outline) items.push({ type: "outline", step });
      if (step === 4 && input.hasStep4Outline) items.push({ type: "outline", step });
      input.messages
        .filter((message) => message.step === step)
        .forEach((msg) => items.push({ type: "message", msg }));
      return items;
    });
}
