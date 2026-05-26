export type PdfTimelineMessage = {
  role: string;
  step: number;
  text: string;
  at: string;
};

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
  return [
    ...timelineMessages,
    {
      role: "system",
      step: 8,
      text: `## 步驟八最終稿\n${step8Draft}`,
      at: anchorAt,
    },
  ];
}
