import "server-only";

export type LlmCallKind = "chat" | "stream";
export type LlmErrorCategory = "timeout" | "truncation" | "parse_fail" | "other";

type LlmCallBucket = {
  total: number;
  errors: number;
  truncations: number;
  durationsMs: number[];
  errorCategories: Record<LlmErrorCategory, number>;
};

const RING_BUFFER_SIZE = 300;

const stats: Record<LlmCallKind, LlmCallBucket> = {
  chat: {
    total: 0,
    errors: 0,
    truncations: 0,
    durationsMs: [],
    errorCategories: { timeout: 0, truncation: 0, parse_fail: 0, other: 0 }
  },
  stream: {
    total: 0,
    errors: 0,
    truncations: 0,
    durationsMs: [],
    errorCategories: { timeout: 0, truncation: 0, parse_fail: 0, other: 0 }
  }
};

function pushDuration(bucket: LlmCallBucket, durationMs: number): void {
  const safe = Number.isFinite(durationMs) && durationMs >= 0 ? Math.round(durationMs) : 0;
  bucket.durationsMs.push(safe);
  if (bucket.durationsMs.length > RING_BUFFER_SIZE) {
    bucket.durationsMs.shift();
  }
}

function median(sorted: number[]): number {
  if (sorted.length === 0) return 0;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx]!;
}

export function classifyLlmError(error: unknown): LlmErrorCategory {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const lower = message.toLowerCase();
  if (lower.includes("aborterror") || lower.includes("timed out") || lower.includes("timeout") || lower.includes("aborted")) {
    return "timeout";
  }
  if (lower.includes("truncated")) {
    return "truncation";
  }
  if (
    lower.includes("llm_parse_fail") ||
    lower.includes("llm_missing_assistant_text") ||
    lower.includes("unexpected end of json") ||
    lower.includes("json")
  ) {
    return "parse_fail";
  }
  return "other";
}

export function recordLlmCall(input: {
  kind: LlmCallKind;
  durationMs: number;
  errorCategory?: LlmErrorCategory;
  hadTruncation?: boolean;
}): void {
  const bucket = stats[input.kind];
  bucket.total += 1;
  pushDuration(bucket, input.durationMs);
  if (input.hadTruncation) {
    bucket.truncations += 1;
  }
  if (input.errorCategory) {
    bucket.errors += 1;
    bucket.errorCategories[input.errorCategory] += 1;
  }
}

export type LlmCallStatsSummary = {
  kind: LlmCallKind;
  total: number;
  errors: number;
  errorRate: number;
  truncations: number;
  truncationRate: number;
  avgMs: number;
  medianMs: number;
  p95Ms: number;
  sampleSize: number;
  errorCategories: Record<LlmErrorCategory, number>;
};

export function getLlmCallStats(): LlmCallStatsSummary[] {
  return (Object.keys(stats) as LlmCallKind[]).map((kind) => {
    const bucket = stats[kind];
    const sorted = [...bucket.durationsMs].sort((a, b) => a - b);
    const avg = sorted.length > 0 ? Math.round(sorted.reduce((sum, value) => sum + value, 0) / sorted.length) : 0;
    return {
      kind,
      total: bucket.total,
      errors: bucket.errors,
      errorRate: bucket.total > 0 ? bucket.errors / bucket.total : 0,
      truncations: bucket.truncations,
      truncationRate: bucket.total > 0 ? bucket.truncations / bucket.total : 0,
      avgMs: avg,
      medianMs: Math.round(median(sorted)),
      p95Ms: Math.round(percentile(sorted, 95)),
      sampleSize: sorted.length,
      errorCategories: {
        timeout: bucket.errorCategories.timeout,
        truncation: bucket.errorCategories.truncation,
        parse_fail: bucket.errorCategories.parse_fail,
        other: bucket.errorCategories.other
      }
    };
  });
}
