import "server-only";

/**
 * Lightweight in-memory stats for streaming LLM endpoints (#250).
 *
 * Stored in a module-scope object that lives for the lifetime of the Node process.
 * Stats are bounded (per-endpoint ring buffer of recent durations) so memory stays
 * stable. Resets on every cold-start; this is acceptable for diagnostic use only.
 *
 * NOT suitable as a source of truth for billing / SLA — for that, persist to DB.
 */

type EndpointStat = {
  total: number;
  errors: number;
  /** Bounded ring buffer of last N durations (ms). */
  durationsMs: number[];
};

const RING_BUFFER_SIZE = 200;
const stats: Record<string, EndpointStat> = {};

export function recordStreamingCall(endpoint: string, durationMs: number, errored: boolean): void {
  const bucket = stats[endpoint] ?? (stats[endpoint] = { total: 0, errors: 0, durationsMs: [] });
  bucket.total += 1;
  if (errored) bucket.errors += 1;
  bucket.durationsMs.push(durationMs);
  if (bucket.durationsMs.length > RING_BUFFER_SIZE) {
    bucket.durationsMs.shift();
  }
}

export type StreamingEndpointSummary = {
  endpoint: string;
  total: number;
  errors: number;
  errorRate: number;
  avgMs: number;
  medianMs: number;
  p95Ms: number;
  sampleSize: number;
};

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

export function getStreamingStats(): StreamingEndpointSummary[] {
  return Object.entries(stats)
    .map(([endpoint, s]) => {
      const sorted = [...s.durationsMs].sort((a, b) => a - b);
      const avg = sorted.length > 0 ? sorted.reduce((acc, x) => acc + x, 0) / sorted.length : 0;
      return {
        endpoint,
        total: s.total,
        errors: s.errors,
        errorRate: s.total > 0 ? s.errors / s.total : 0,
        avgMs: Math.round(avg),
        medianMs: Math.round(median(sorted)),
        p95Ms: Math.round(percentile(sorted, 95)),
        sampleSize: sorted.length
      };
    })
    .sort((a, b) => a.endpoint.localeCompare(b.endpoint));
}
