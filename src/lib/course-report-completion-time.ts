type CompletionMessage = {
  role: string;
  userId?: string;
  step: number | string;
  text?: string;
  at?: string;
};

function normalizeStepNumber(step: number | string): number {
  if (typeof step === "number") return step;
  const match = step.match(/\d+/);
  return match ? Number.parseInt(match[0]!, 10) : Number.NaN;
}

function isValidIsoLike(value: string | undefined): value is string {
  return Boolean(value && Number.isFinite(new Date(value).getTime()));
}

export function resolveStudentReportCompletedAtIso(input: {
  messages: CompletionMessage[];
  username: string;
  courseEndedAt?: string;
  legacyFallbackAt?: string;
}): string | undefined {
  const step10CompletedAt = input.messages
    .filter((message) => {
      if (normalizeStepNumber(message.step) !== 10) return false;
      if (message.role !== "ai") return false;
      if (message.userId !== input.username) return false;
      if (!message.text?.trim()) return false;
      return isValidIsoLike(message.at);
    })
    .map((message) => message.at!)
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];

  if (step10CompletedAt) return step10CompletedAt;
  if (isValidIsoLike(input.courseEndedAt)) return input.courseEndedAt;
  if (isValidIsoLike(input.legacyFallbackAt)) return input.legacyFallbackAt;
  return undefined;
}
