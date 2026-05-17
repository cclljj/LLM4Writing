import { NextResponse } from "next/server";
import { getCurrentUser } from "@/src/lib/auth-server";
import { listLearningEventsSince, type PersistedEventRow } from "@/src/lib/store";

type FallbackWindow = "2h" | "12h" | "24h" | "7d";

const WINDOW_MS: Record<FallbackWindow, number> = {
  "2h": 2 * 60 * 60 * 1000,
  "12h": 12 * 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000
};

const RESPONSE_KINDS = new Set(["step12_round", "step3_response", "step6_suggest", "step7_feedback", "step10_report"]);

function parseWindow(raw: string | null): FallbackWindow {
  if (raw === "2h" || raw === "12h" || raw === "24h" || raw === "7d") return raw;
  return "12h";
}

function parseStepFromEvent(event: Pick<PersistedEventRow, "step" | "kind">): string {
  if (typeof event.step === "number" && Number.isFinite(event.step)) {
    return String(Math.max(0, Math.round(event.step)));
  }
  const matched = event.kind.match(/(?:step[-_]?)(\d+)/i);
  return matched?.[1] ?? "0";
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const window = parseWindow(url.searchParams.get("window"));
  const nowMs = Date.now();
  const cutoffIso = new Date(nowMs - WINDOW_MS[window]).toISOString();
  const learningEvents = await listLearningEventsSince(cutoffIso);

  const byStep: Record<string, { totalAi: number; fallbacks: number; fallbackRate: number }> = {};
  const byKind: Record<string, { total: number; fallbackCount: number; fallbackRate: number }> = {};
  const byHour: Record<string, { totalAi: number; fallbacks: number; fallbackRate: number }> = {};

  let totalAi = 0;
  let fallbacks = 0;

  for (const event of learningEvents) {
    const kindBucket = byKind[event.kind] ?? { total: 0, fallbackCount: 0, fallbackRate: 0 };
    kindBucket.total += 1;
    if (event.fallback_used) kindBucket.fallbackCount += 1;
    kindBucket.fallbackRate = kindBucket.total > 0 ? kindBucket.fallbackCount / kindBucket.total : 0;
    byKind[event.kind] = kindBucket;

    if (!RESPONSE_KINDS.has(event.kind)) continue;

    totalAi += 1;
    if (event.fallback_used) fallbacks += 1;

    const stepKey = parseStepFromEvent(event);
    const stepBucket = byStep[stepKey] ?? { totalAi: 0, fallbacks: 0, fallbackRate: 0 };
    stepBucket.totalAi += 1;
    if (event.fallback_used) stepBucket.fallbacks += 1;
    stepBucket.fallbackRate = stepBucket.totalAi > 0 ? stepBucket.fallbacks / stepBucket.totalAi : 0;
    byStep[stepKey] = stepBucket;

    const hourKey = event.created_at.toISOString().slice(0, 13) + ":00Z";
    const hourBucket = byHour[hourKey] ?? { totalAi: 0, fallbacks: 0, fallbackRate: 0 };
    hourBucket.totalAi += 1;
    if (event.fallback_used) hourBucket.fallbacks += 1;
    hourBucket.fallbackRate = hourBucket.totalAi > 0 ? hourBucket.fallbacks / hourBucket.totalAi : 0;
    byHour[hourKey] = hourBucket;
  }

  return NextResponse.json({
    window,
    source: "persisted_learning_events",
    generatedAt: new Date(nowMs).toISOString(),
    eventCoverage: {
      learningEvents: learningEvents.length
    },
    overall: {
      totalAi,
      fallbacks,
      fallbackRate: totalAi > 0 ? fallbacks / totalAi : 0
    },
    byStep,
    byKind,
    byHour
  });
}
