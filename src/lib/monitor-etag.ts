import type { MonitorActivityRevision } from "@/src/lib/store";

export const MONITOR_PRESENCE_REFRESH_MS = 10_000;

export function buildMonitorActivityEtag(
  revision: MonitorActivityRevision,
  nowMs = Date.now(),
  presenceRefreshMs = MONITOR_PRESENCE_REFRESH_MS
): string {
  const updatedToken = revision.updatedAt ? Date.parse(revision.updatedAt) || 0 : 0;
  const presenceBucket = Math.floor(nowMs / Math.max(1, presenceRefreshMs));
  return `W/"monitor-${revision.total}-${updatedToken}-${presenceBucket}"`;
}
