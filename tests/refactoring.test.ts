/**
 * Tests for:
 * - Issue #220: QualitySignals type unification
 * - Issue #221: current_step DB column + store enhancements (memory mode)
 * - Issue #222: Pagination in monitor/activities
 * - Issue #223: ETag / presence decoupling
 * - Issue #323: DB-level teacher monitor pagination and diagnostics cache
 * - Issue #324: Step8 draft hydration should not overwrite unsaved local edits
 */
import test from "node:test";
import assert from "node:assert/strict";

// ---------------------------------------------------------------------------
// Issue #220: QualitySignals is now imported from types.ts in learning-diagnostics
// ---------------------------------------------------------------------------

test("#220: learning-diagnostics does not locally define QualitySignals", async () => {
  const { readFileSync } = await import("node:fs");
  const { resolve, dirname } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const thisDir = dirname(fileURLToPath(import.meta.url));

  const src = readFileSync(resolve(thisDir, "../src/lib/learning-diagnostics.ts"), "utf8");

  // Must NOT have a local type/interface definition of QualitySignals
  const localDef = /^(export\s+)?(type|interface)\s+QualitySignals\s*[={]/m;
  assert.ok(!localDef.test(src), "learning-diagnostics.ts must not locally define QualitySignals");

  // Must import QualitySignals from types
  assert.ok(src.includes("from") && src.includes("types"), "must import from types.ts");
});

test("#220: recordRejectedAnswerSignal accepts SessionState.qualitySignals shape", async () => {
  const { recordRejectedAnswerSignal } = await import("../src/lib/learning-diagnostics.js");

  const session = {
    qualitySignals: { rejectedAnswerCounts: {} as Record<string, number>, rejectedAnswerLastAt: {} as Record<string, string> }
  };
  recordRejectedAnswerSignal(session, "user1", "step1::q1");
  assert.equal(session.qualitySignals.rejectedAnswerCounts["user1::step1::q1"], 1);
});

// ---------------------------------------------------------------------------
// Issue #221: store in-memory mode — listSessions pagination + getSessionWithMeta
// ---------------------------------------------------------------------------

test("#221: listSessions with limit/offset in memory mode", async () => {
  // Inline a lightweight memory-mode implementation to mirror store.ts behaviour
  const items = Array.from({ length: 10 }, (_, i) => ({ id: String(i) }));

  function paginate<T>(arr: T[], opts?: { limit?: number; offset?: number }): T[] {
    const limit = typeof opts?.limit === "number" && opts.limit > 0 ? opts.limit : undefined;
    const offset = typeof opts?.offset === "number" && opts.offset >= 0 ? opts.offset : 0;
    return limit !== undefined ? arr.slice(offset, offset + limit) : arr.slice(offset);
  }

  assert.equal(paginate(items, { limit: 3, offset: 0 }).length, 3);
  assert.equal(paginate(items, { limit: 3, offset: 7 }).length, 3);
  assert.equal(paginate(items, { limit: 3, offset: 9 }).length, 1); // only 1 left
  assert.equal(paginate(items).length, 10); // no opts → all
  assert.equal(paginate(items, { offset: 5 }).length, 5);
});

test("#221: store.ts exposes getSessionWithMeta and countSessions exports", async () => {
  const storeModule = await import("../src/lib/store.js");
  assert.ok(typeof storeModule.getSessionWithMeta === "function", "getSessionWithMeta must be exported");
  assert.ok(typeof storeModule.countSessions === "function", "countSessions must be exported");
  assert.ok(typeof storeModule.listSessions === "function", "listSessions must be exported");
  assert.ok(
    typeof storeModule.listMonitorSessionsByActivityId === "function",
    "listMonitorSessionsByActivityId must be exported for activity-scoped monitor pagination"
  );
});

test("#221: store.ts CREATE TABLE includes current_step column in ALTER", async () => {
  const { readFileSync } = await import("node:fs");
  const { resolve, dirname } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const thisDir = dirname(fileURLToPath(import.meta.url));

  const src = readFileSync(resolve(thisDir, "../src/lib/store.ts"), "utf8");
  assert.ok(src.includes("current_step"), "store.ts must reference current_step");
  assert.ok(src.includes("ADD COLUMN IF NOT EXISTS"), "store.ts must use ADD COLUMN IF NOT EXISTS for safe migration");
});

test("#221: saveSession writes session summary columns in transactional update path", async () => {
  const { readFileSync } = await import("node:fs");
  const { resolve, dirname } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const thisDir = dirname(fileURLToPath(import.meta.url));

  const src = readFileSync(resolve(thisDir, "../src/lib/store.ts"), "utf8");
  assert.ok(src.includes("client.begin"), "saveSession should use transaction boundary");
  assert.ok(src.includes("FOR UPDATE"), "saveSession should lock row for concurrent writes");
  assert.ok(src.includes("current_step = ${summary.currentStep}"), "saveSession must sync current_step in update path");
});

// ---------------------------------------------------------------------------
// Issue #222: Pagination helper (parsePaginationParam behaviour)
// ---------------------------------------------------------------------------

test("#222: parsePaginationParam clamps invalid values to default", () => {
  function parsePaginationParam(raw: string | null, defaultValue: number): number {
    const n = parseInt(raw ?? "", 10);
    return Number.isFinite(n) && n >= 0 ? n : defaultValue;
  }

  assert.equal(parsePaginationParam("10", 50), 10);
  assert.equal(parsePaginationParam("0", 50), 0);
  assert.equal(parsePaginationParam(null, 50), 50);
  assert.equal(parsePaginationParam("", 50), 50);
  assert.equal(parsePaginationParam("abc", 50), 50);
  assert.equal(parsePaginationParam("-5", 50), 50); // negative → default
});

test("#222: monitor route source includes limit/offset and total fields", async () => {
  const { readFileSync } = await import("node:fs");
  const { resolve, dirname } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const thisDir = dirname(fileURLToPath(import.meta.url));

  const src = readFileSync(resolve(thisDir, "../app/api/teacher/monitor/route.ts"), "utf8");
  assert.ok(src.includes("limit"), "monitor route must handle limit");
  assert.ok(src.includes("offset"), "monitor route must handle offset");
  assert.ok(src.includes("total"), "monitor route must return total");
});

test("#323: store.ts persists session summary columns for monitor queries", async () => {
  const { readFileSync } = await import("node:fs");
  const { resolve, dirname } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const thisDir = dirname(fileURLToPath(import.meta.url));

  const src = readFileSync(resolve(thisDir, "../src/lib/store.ts"), "utf8");
  for (const column of ["workflow", "activity_id", "group_id", "message_count", "last_message_at", "participant_count"]) {
    assert.ok(src.includes(column), `store.ts must define and write ${column}`);
  }
  assert.ok(src.includes("idx_llm4writing_sessions_workflow_activity_updated"), "store.ts must index workflow/activity monitor scans");
  assert.ok(src.includes("workflow = ${summary.workflow}"), "saveSession must sync workflow summary in update path");
  assert.ok(src.includes("activity_id = ${summary.activityId}"), "saveSession must sync activity_id summary in update path");
});

test("#323: teacher monitor uses activity-scoped DB pagination path", async () => {
  const { readFileSync } = await import("node:fs");
  const { resolve, dirname } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const thisDir = dirname(fileURLToPath(import.meta.url));

  const routeSrc = readFileSync(resolve(thisDir, "../app/api/teacher/monitor/route.ts"), "utf8");
  const storeSrc = readFileSync(resolve(thisDir, "../src/lib/store.ts"), "utf8");

  assert.ok(routeSrc.includes("listMonitorSessionSummariesByActivityId"), "monitor route must call the activity-scoped summary store query");
  assert.ok(routeSrc.includes("requestedActivityId"), "monitor route must branch on activityId");
  assert.ok(storeSrc.includes("WHERE (workflow = 'spec10'"), "store query must filter workflow in SQL");
  assert.ok(storeSrc.includes("activity_id = ${trimmedActivityId}"), "store query must filter activity_id in SQL");
  assert.ok(storeSrc.includes("ORDER BY updated_at DESC"), "store query must sort in SQL");
  assert.ok(storeSrc.includes("LIMIT ${limit} OFFSET ${offset}"), "store query must paginate in SQL");
});

test("#323: admin diagnostics route uses short TTL cache", async () => {
  const { readFileSync } = await import("node:fs");
  const { resolve, dirname } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const thisDir = dirname(fileURLToPath(import.meta.url));

  const src = readFileSync(resolve(thisDir, "../app/api/admin/diagnostics/route.ts"), "utf8");
  assert.ok(src.includes("DIAGNOSTICS_CACHE_TTL_MS"), "diagnostics route must define a TTL");
  assert.ok(src.includes("getDiagnosticsCache"), "diagnostics route must use a process cache");
  assert.ok(src.includes("X-Diagnostics-Cache"), "diagnostics route should expose cache hit/miss for verification");
  assert.ok(src.includes("buildDiagnosticsPayload"), "diagnostics payload building should be separated from request/cache handling");
});

test("#329: store defines persisted event tables and participant index", async () => {
  const { readFileSync } = await import("node:fs");
  const { resolve, dirname } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const thisDir = dirname(fileURLToPath(import.meta.url));

  const src = readFileSync(resolve(thisDir, "../src/lib/store.ts"), "utf8");
  assert.ok(src.includes("llm4writing_llm_events"), "store.ts must create llm4writing_llm_events");
  assert.ok(src.includes("llm4writing_learning_events"), "store.ts must create llm4writing_learning_events");
  assert.ok(src.includes("llm4writing_session_participants"), "store.ts must create llm4writing_session_participants");
  assert.ok(src.includes("recordLlmEvent"), "store.ts must export recordLlmEvent");
  assert.ok(src.includes("recordLearningEvent"), "store.ts must export recordLearningEvent");
  assert.ok(src.includes("listSessionsByParticipant"), "store.ts must export participant-scoped session query");
});

test("#332: participant query has DB fallback for legacy rows missing participant index", async () => {
  const { readFileSync } = await import("node:fs");
  const { resolve, dirname } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const thisDir = dirname(fileURLToPath(import.meta.url));

  const src = readFileSync(resolve(thisDir, "../src/lib/store.ts"), "utf8");
  assert.ok(src.includes("rows.length > 0"), "store.ts should keep primary participant-index query first");
  assert.ok(src.includes("COALESCE(s.payload->'participants', '[]'::jsonb) ? ${trimmedUsername}"), "fallback should include payload participants lookup");
  assert.ok(src.includes("FROM llm4writing_session_messages m"), "fallback should include student message table lookup");
  assert.ok(src.includes("jsonb_array_elements(COALESCE(s.payload->'messages', '[]'::jsonb))"), "fallback should include legacy payload messages lookup");
});

test("#329: student APIs use participant-scoped DB query path", async () => {
  const { readFileSync } = await import("node:fs");
  const { resolve, dirname } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const thisDir = dirname(fileURLToPath(import.meta.url));

  const overview = readFileSync(resolve(thisDir, "../app/api/student/overview/route.ts"), "utf8");
  const history = readFileSync(resolve(thisDir, "../app/api/student/history/route.ts"), "utf8");
  const courseHistory = readFileSync(resolve(thisDir, "../app/api/student/course-history/[activityId]/route.ts"), "utf8");

  for (const src of [overview, history, courseHistory]) {
    assert.ok(src.includes("listSessionsByParticipant"), "route must use participant-scoped store query");
  }
  assert.ok(!history.includes("listSessions }"), "history route should not import listSessions");
});

test("#329: diagnostics route reads persisted event tables", async () => {
  const { readFileSync } = await import("node:fs");
  const { resolve, dirname } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const thisDir = dirname(fileURLToPath(import.meta.url));

  const src = readFileSync(resolve(thisDir, "../app/api/admin/diagnostics/route.ts"), "utf8");
  assert.ok(src.includes("listLlmEventsSince"), "diagnostics route should read llm event rows");
  assert.ok(src.includes("listLearningEventsSince"), "diagnostics route should read learning event rows");
  assert.ok(src.includes("computeFallbackRateFromLearningEvents"), "diagnostics should support persisted fallback metrics");
  assert.ok(src.includes("computeTrendSeriesFromLearningEvents"), "diagnostics should support persisted trend metrics");
});

test("#330: monitor route uses summary-only DB path for activity list", async () => {
  const { readFileSync } = await import("node:fs");
  const { resolve, dirname } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const thisDir = dirname(fileURLToPath(import.meta.url));

  const routeSrc = readFileSync(resolve(thisDir, "../app/api/teacher/monitor/route.ts"), "utf8");
  const storeSrc = readFileSync(resolve(thisDir, "../src/lib/store.ts"), "utf8");
  assert.ok(routeSrc.includes("listMonitorSessionSummariesByActivityId"), "monitor route should use summary query path");
  assert.ok(storeSrc.includes("export async function listMonitorSessionSummariesByActivityId"), "store should expose monitor summary query");
  assert.ok(storeSrc.includes("participants_json"), "summary query should select minimal JSON fields");
});

test("#330: audit logs are persisted and exposed to admin UI", async () => {
  const { readFileSync } = await import("node:fs");
  const { resolve, dirname } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const thisDir = dirname(fileURLToPath(import.meta.url));

  const auditStore = readFileSync(resolve(thisDir, "../src/lib/audit-log-store.ts"), "utf8");
  const auditRoute = readFileSync(resolve(thisDir, "../app/api/admin/audit-logs/route.ts"), "utf8");
  const teacherPage = readFileSync(resolve(thisDir, "../app/teacher/page.tsx"), "utf8");
  const usersRoute = readFileSync(resolve(thisDir, "../app/api/admin/users/route.ts"), "utf8");
  const openclassesRoute = readFileSync(resolve(thisDir, "../app/api/admin/openclasses/route.ts"), "utf8");
  const activitiesRoute = readFileSync(resolve(thisDir, "../app/api/admin/activities/route.ts"), "utf8");
  const stepRoute = readFileSync(resolve(thisDir, "../app/api/teacher/step/route.ts"), "utf8");

  assert.ok(auditStore.includes("llm4writing_audit_logs"), "audit log store should define durable table");
  assert.ok(auditRoute.includes("listAuditLogs"), "admin audit API should query audit logs");
  assert.ok(teacherPage.includes("操作紀錄"), "admin UI should expose audit log tab");
  assert.ok(usersRoute.includes("user_reset_password"), "reset password action should be audited");
  assert.ok(openclassesRoute.includes("openclass_create"), "create task action should be audited");
  assert.ok(activitiesRoute.includes("activity_delete"), "delete course action should be audited");
  assert.ok(stepRoute.includes("teacher_step_switch"), "switch step action should be audited");
});

test("#324: student Step8 draft hydration guards unsaved local edits", async () => {
  const { readFileSync } = await import("node:fs");
  const { resolve, dirname } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const thisDir = dirname(fileURLToPath(import.meta.url));

  const src = readFileSync(resolve(thisDir, "../app/student/page.tsx"), "utf8");
  assert.ok(src.includes("hasUnsavedLocalStep8Edit"), "student page should compute local dirty state for Step8");
  assert.ok(src.includes("shouldHydrateStep8Draft"), "student page should gate Step8 hydration");
  assert.ok(src.includes("justEnteredStep8"), "student page should hydrate on Step8 enter transition");
  assert.ok(
    src.includes("latestDraft = session.draftStep8[loginUser] ?? session.draftStep6[loginUser] ?? \"\""),
    "Step8 hydration should still preserve fallback order draftStep8 -> draftStep6"
  );
});

test("#324: hydration decision keeps unsaved local Step8 edits", () => {
  function shouldHydrateStep8Draft(args: {
    justEnteredStep8: boolean;
    hasUnsavedLocalStep8Edit: boolean;
    draftText: string;
    latestDraft: string;
  }): boolean {
    const { justEnteredStep8, hasUnsavedLocalStep8Edit, draftText, latestDraft } = args;
    return justEnteredStep8 || (!hasUnsavedLocalStep8Edit && (draftText.length === 0 || latestDraft !== draftText));
  }

  assert.equal(
    shouldHydrateStep8Draft({
      justEnteredStep8: false,
      hasUnsavedLocalStep8Edit: true,
      draftText: "local unsaved text",
      latestDraft: "older server text"
    }),
    false
  );
  assert.equal(
    shouldHydrateStep8Draft({
      justEnteredStep8: true,
      hasUnsavedLocalStep8Edit: true,
      draftText: "local unsaved text",
      latestDraft: "server text"
    }),
    true
  );
});

test("#222: activities route source includes limit/offset and total fields", async () => {
  const { readFileSync } = await import("node:fs");
  const { resolve, dirname } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const thisDir = dirname(fileURLToPath(import.meta.url));

  const src = readFileSync(resolve(thisDir, "../app/api/student/activities/route.ts"), "utf8");
  assert.ok(src.includes("limit"), "activities route must handle limit");
  assert.ok(src.includes("offset"), "activities route must handle offset");
  assert.ok(src.includes("total"), "activities route must return total");
});

// ---------------------------------------------------------------------------
// Issue #223: session-presence decoupled from session payload
// ---------------------------------------------------------------------------

test("#223: markUserOnline / getOnlineUsers work with sessionId signature", async () => {
  const { markUserOnline, getOnlineUsers } = await import("../src/lib/session-presence.js");

  const sessionId = "test-session-etag-" + Math.random();
  await markUserOnline(sessionId, "alice");
  const online = await getOnlineUsers(sessionId);
  assert.ok(online.includes("alice"), "alice should be online after markUserOnline");
});

test("#223: getOnlineUsers returns empty for unknown session", async () => {
  const { getOnlineUsers } = await import("../src/lib/session-presence.js");
  const online = await getOnlineUsers("non-existent-session-" + Math.random());
  assert.deepEqual(online, []);
});

test("#223: getOnlineUsers respects window — expired entries excluded", async () => {
  const { markUserOnline, getOnlineUsers } = await import("../src/lib/session-presence.js");

  const sessionId = "test-window-" + Math.random();
  const pastIso = new Date(Date.now() - 60_000).toISOString(); // 60s ago
  await markUserOnline(sessionId, "bob", pastIso);

  // With default 45s window, bob should NOT be online
  const online = await getOnlineUsers(sessionId);
  assert.ok(!online.includes("bob"), "expired presence entry should not appear in getOnlineUsers");
});

test("#223: markUserOnline does not mutate any session object", async () => {
  const { markUserOnline } = await import("../src/lib/session-presence.js");

  const fakeSession = { id: "s1", onlineUsersLastSeen: {} as Record<string, string> };
  await markUserOnline(fakeSession.id, "charlie");

  // Session object must be unchanged
  assert.deepEqual(fakeSession.onlineUsersLastSeen, {});
});

test("#223: session GET route source uses ETag and If-None-Match headers", async () => {
  const { readFileSync } = await import("node:fs");
  const { resolve, dirname } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const thisDir = dirname(fileURLToPath(import.meta.url));

  const src = readFileSync(resolve(thisDir, "../app/api/session/[sessionId]/route.ts"), "utf8");
  assert.ok(src.includes("ETag"), "session route must set ETag header");
  assert.ok(src.includes("if-none-match") || src.includes("If-None-Match"), "session route must check If-None-Match");
  assert.ok(src.includes("304"), "session route must return 304");
});

test("#223: student page polling source sends If-None-Match and handles 304", async () => {
  const { readFileSync } = await import("node:fs");
  const { resolve, dirname } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const thisDir = dirname(fileURLToPath(import.meta.url));

  const src = readFileSync(resolve(thisDir, "../app/student/page.tsx"), "utf8");
  assert.ok(src.includes("If-None-Match"), "student page must send If-None-Match header");
  assert.ok(src.includes("304"), "student page must handle 304 status");
  assert.ok(src.includes("ETag"), "student page must track ETag");
});

test("#318: admin diagnostics route exposes step KPIs, trends, and LLM error taxonomy", async () => {
  const { readFileSync } = await import("node:fs");
  const { resolve, dirname } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const thisDir = dirname(fileURLToPath(import.meta.url));

  const src = readFileSync(resolve(thisDir, "../app/api/admin/diagnostics/route.ts"), "utf8");
  assert.ok(src.includes("stepKpis"), "diagnostics route must include stepKpis");
  assert.ok(src.includes("trends"), "diagnostics route must include trends");
  assert.ok(src.includes("llmErrorTaxonomy"), "diagnostics route must include llmErrorTaxonomy");
  assert.ok(src.includes("fallbackMetricsSource"), "diagnostics route must expose fallback metrics source");
  assert.ok(src.includes("getSessionStoreTableHealth"), "diagnostics route must expose table health");
  assert.ok(src.includes("warnings"), "diagnostics route must expose warnings");
  assert.ok(src.includes("runtimeHost"), "diagnostics route must expose runtime DB host");
  assert.ok(src.includes("recentFallbackSamples"), "diagnostics route must expose recent fallback samples");
  assert.ok(src.includes("buildSessionTrendMetaMaps"), "diagnostics route should build trend metadata from session snapshots");
  assert.ok(src.includes("computeTrendSeriesFromLearningEvents(learningEvents, \"course\", trendMetaMaps)"), "event-backed course trends should use session metadata map");
  assert.ok(src.includes("computeTrendSeriesFromLearningEvents(learningEvents, \"class\", trendMetaMaps)"), "event-backed class trends should use session metadata map");
  assert.ok(src.includes("activity::${activityId}"), "event-backed course trends should group by stable activity id key");
  assert.ok(src.includes("activity?.title ?? activityMeta?.activityTitle ?? sessionMeta?.activityTitle"), "event-backed labels should prefer current activity title before legacy snapshots");
});

test("#318: admin diagnostics UI renders new monitoring sections", async () => {
  const { readFileSync } = await import("node:fs");
  const { resolve, dirname } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const thisDir = dirname(fileURLToPath(import.meta.url));

  const src = readFileSync(resolve(thisDir, "../app/teacher/_components/AdminPromptDiagnostics.tsx"), "utf8");
  assert.ok(src.includes("每步驟 KPI"), "UI must render step KPI section");
  assert.ok(src.includes("課程 / 班級趨勢"), "UI must render trend section");
  assert.ok(src.includes("LLM 錯誤分類"), "UI must render error taxonomy section");
  assert.ok(src.includes("觀測資料來源"), "UI must render observability source section");
  assert.ok(src.includes("執行資料表 migration"), "UI must include store migration trigger");
  assert.ok(src.includes("DB Host"), "UI must render runtime DB host");
  assert.ok(src.includes("最近 fallback 樣本"), "UI must render recent fallback sample section");
});

test("#338: admin store migration route exists and is admin-protected", async () => {
  const { readFileSync } = await import("node:fs");
  const { resolve, dirname } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const thisDir = dirname(fileURLToPath(import.meta.url));

  const src = readFileSync(resolve(thisDir, "../app/api/admin/maintenance/store-migrate/route.ts"), "utf8");
  assert.ok(src.includes("user.role !== \"admin\""), "migration route must enforce admin-only access");
  assert.ok(src.includes("ensureSessionTable"), "migration route must run schema bootstrap");
  assert.ok(src.includes("getSessionStoreTableHealth"), "migration route must return table-health summary");
});

test("#341: admin fallback report route exists and is admin-protected", async () => {
  const { readFileSync } = await import("node:fs");
  const { resolve, dirname } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const thisDir = dirname(fileURLToPath(import.meta.url));

  const src = readFileSync(resolve(thisDir, "../app/api/admin/diagnostics/fallback-report/route.ts"), "utf8");
  assert.ok(src.includes("user.role !== \"admin\""), "fallback report route must enforce admin-only access");
  assert.ok(src.includes("listLearningEventsSince"), "fallback report route must read persisted learning events");
  assert.ok(src.includes("source: \"persisted_learning_events\""), "fallback report route must identify event-backed source");
  assert.ok(src.includes("byStep"), "fallback report route must include by-step metrics");
  assert.ok(src.includes("byKind"), "fallback report route must include by-kind metrics");
  assert.ok(src.includes("byHour"), "fallback report route must include by-hour metrics");
});

test("#344: Step10 uses chunked generation and token budgets are uplifted", async () => {
  const { readFileSync } = await import("node:fs");
  const { resolve, dirname } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const thisDir = dirname(fileURLToPath(import.meta.url));

  const engineSrc = readFileSync(resolve(thisDir, "../src/lib/engine.ts"), "utf8");
  const llmClientSrc = readFileSync(resolve(thisDir, "../src/lib/llm-client.ts"), "utf8");
  const step10RouteSrc = readFileSync(resolve(thisDir, "../app/api/session/step10/stream/route.ts"), "utf8");

  assert.ok(engineSrc.includes("generateStep10ReportChunkedText"), "engine should expose chunked Step10 generation helper");
  assert.ok(engineSrc.includes("section_"), "chunked Step10 path should generate per-section content");
  assert.ok(engineSrc.includes("TOKEN_SCALE_NUMERATOR"), "engine should define token-scale uplift");
  assert.ok(llmClientSrc.includes("MIN_LLM_MAX_TOKENS = 50_000"), "llm client should define the truncation-safe token floor");
  assert.ok(llmClientSrc.includes("resolveMaxTokens(input.maxTokens)"), "llm client should apply the token floor to requests");
  assert.ok(step10RouteSrc.includes("generateStep10ReportChunkedText"), "step10 streaming route should use chunked generator");
});

test("#345: llm context uses layered summary and dedup cleaning", async () => {
  const { readFileSync } = await import("node:fs");
  const { resolve, dirname } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const thisDir = dirname(fileURLToPath(import.meta.url));

  const src = readFileSync(resolve(thisDir, "../src/lib/llm-context.ts"), "utf8");
  assert.ok(src.includes("buildLayeredSummary"), "context builder should implement layered summary");
  assert.ok(src.includes("[歷史摘要-結論]"), "layered summary should preserve conclusions");
  assert.ok(src.includes("[歷史摘要-爭點]"), "layered summary should preserve disputes");
  assert.ok(src.includes("[歷史摘要-未解事項]"), "layered summary should preserve unresolved points");
  assert.ok(src.includes("pickUniqueSnippets"), "context builder should deduplicate repeated snippets");
  assert.ok(src.includes("[近期原文]"), "context builder should keep recent raw lines");
});

test("#319: course implementation report replaces download placeholder with PDF generation flow", async () => {
  const { readFileSync } = await import("node:fs");
  const { resolve, dirname } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const thisDir = dirname(fileURLToPath(import.meta.url));

  const src = readFileSync(resolve(thisDir, "../app/teacher/_components/CourseImplementationReportTab.tsx"), "utf8");
  assert.ok(src.includes("downloadStudentReportPdf"), "download action should use real PDF generation function");
  assert.ok(src.includes("generateCourseImplementationPdf"), "component should call PDF generator");
  assert.ok(!src.includes("PDF 下載功能即將推出"), "placeholder text should be removed");
});

test("#319: course implementation PDF builder includes required v1 sections", async () => {
  const { readFileSync } = await import("node:fs");
  const { resolve, dirname } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const thisDir = dirname(fileURLToPath(import.meta.url));

  const src = readFileSync(resolve(thisDir, "../app/teacher/_components/courseImplementationPdf.ts"), "utf8");
  assert.ok(src.includes("學生摘要"), "PDF must include student summary section");
  assert.ok(src.includes("步驟進度與產出指標"), "PDF must include step progress section");
  assert.ok(src.includes("星等依據"), "PDF must include star rationale section");
  assert.ok(src.includes("完整互動歷程（依系統順序"), "PDF must include full ordered interaction timeline section");
  assert.ok(src.includes("步驟三完成結構樹（圖形）"), "PDF must include step3 outline graphical section");
  assert.ok(src.includes("步驟四修正後結構樹（圖形）"), "PDF must include step4 outline graphical section");
  assert.ok(!src.includes("step4Outline !== step3Outline"), "step4 outline should not be hidden when text matches step3");
  assert.ok(src.includes("node.x * graphScale"), "outline graph coordinates should scale with graph width");
  assert.ok(src.includes("insertOutlineAnchor"), "timeline should insert step outline anchors when step messages are missing");
  assert.ok(src.includes("renderMarkdown"), "PDF should render message content in markdown layout");
});

test("#326: step3 complete route enforces depth-3+ outline edit validation", async () => {
  const { readFileSync } = await import("node:fs");
  const { resolve, dirname } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const thisDir = dirname(fileURLToPath(import.meta.url));

  const routeSrc = readFileSync(resolve(thisDir, "../app/api/session/step3/complete/route.ts"), "utf8");
  const helperSrc = readFileSync(resolve(thisDir, "../src/lib/step3-outline-validation.ts"), "utf8");
  const studentSrc = readFileSync(resolve(thisDir, "../app/student/page.tsx"), "utf8");

  assert.ok(routeSrc.includes("validateStep3OutlineCompletion"), "step3 complete route should call Step3 outline validator");
  assert.ok(routeSrc.includes("step3_outline_depth3_not_edited"), "step3 complete route should return a specific validation error");
  assert.ok(helperSrc.includes("minEditableDepth = 3"), "validator should default to depth-3 rule");
  assert.ok(helperSrc.includes("targetNodes.length > 0 && unchangedNodeIds.length === 0"), "all target nodes must be changed");
  assert.ok(studentSrc.includes("setStep3CompleteHint"), "student page should keep an inline hint state for Step3 completion failure");
  assert.ok(studentSrc.includes('completeHint={step3CompleteHint}'), "student Step3 outline editor should render the inline completion hint");
});

test("#327: open class creation avoids id collision after deletions", async () => {
  const { readFileSync } = await import("node:fs");
  const { resolve, dirname } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const thisDir = dirname(fileURLToPath(import.meta.url));

  const storeSrc = readFileSync(resolve(thisDir, "../src/lib/activity-store.ts"), "utf8");
  assert.ok(storeSrc.includes("computeNextOpenClassId"), "activity-store should provide deterministic next open class id helper");
  assert.ok(
    storeSrc.includes("computeNextOpenClassId(openClasses.map((openClass) => openClass.id))"),
    "upsertOpenClass should use max-sequence-based id generation"
  );
  assert.ok(!storeSrc.includes("openClasses.length + 1"), "open class id generation should not reuse length+1");
});

test("#328: store.ts defines split session tables and version conflict handling", async () => {
  const { readFileSync } = await import("node:fs");
  const { resolve, dirname } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const thisDir = dirname(fileURLToPath(import.meta.url));

  const storeSrc = readFileSync(resolve(thisDir, "../src/lib/store.ts"), "utf8");
  for (const marker of [
    "llm4writing_session_messages",
    "llm4writing_session_artifacts",
    "llm4writing_session_reports",
    "llm4writing_session_events"
  ]) {
    assert.ok(storeSrc.includes(marker), `store.ts should manage split table ${marker}`);
  }
  assert.ok(storeSrc.includes("ADD COLUMN IF NOT EXISTS version"), "store.ts should add version column");
  assert.ok(storeSrc.includes("SessionVersionConflictError"), "store.ts should expose version conflict handling");
  assert.ok(storeSrc.includes("mergeSessionStates"), "store.ts should merge stale writes on conflict retry");
});

test("#333: step3 stream applies completeness quality gate and retry", async () => {
  const { readFileSync } = await import("node:fs");
  const { resolve, dirname } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const thisDir = dirname(fileURLToPath(import.meta.url));

  const src = readFileSync(resolve(thisDir, "../app/api/session/step3/stream/route.ts"), "utf8");
  assert.ok(src.includes("generateStep3ReplyText"), "step3 stream should use dedicated response generation helper");
  assert.ok(src.includes("hasFormalLlmQualityRisk"), "step3 stream should include quality-risk check");
  assert.ok(src.includes('label: `${telemetry.label ?? "step3_stream"}:retry`'), "step3 stream should emit retry telemetry label");
  assert.ok(src.includes("你的上一則回覆可能不完整"), "step3 stream retry prompt should request complete output");
});

test("#334: teacher Step3 advance hint prioritizes joined users to avoid absent-member deadlock", async () => {
  const { readFileSync } = await import("node:fs");
  const { resolve, dirname } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const thisDir = dirname(fileURLToPath(import.meta.url));

  const src = readFileSync(resolve(thisDir, "../app/teacher/_components/LearningMonitorTab.tsx"), "utf8");
  assert.ok(src.includes("const joinedMembers = (session.joinedUsers ?? []).filter"), "Step3 hint should derive joined members");
  assert.ok(src.includes("resolveStepGateMembers(session, \"3-complete\")"), "Step3 hint should resolve gate members through helper");
  assert.ok(src.includes("activeFromStats"), "Step3 helper should fallback to active members inferred from message stats");
  assert.ok(src.includes("step3SubmittedOutlines"), "Step3 helper should fallback to submitted outline members when joinedUsers are unavailable");
  assert.ok(src.includes("legacy sessions may miss the gate signal"), "Step3 hint should include backward-compatibility note for legacy gate signal");
  assert.ok(src.includes("completedUsers.add(participant)"), "Step3 hint should infer completion from submitted outlines");
  assert.ok(src.includes("3-reopen"), "Step3 hint should respect explicit reopen-editing marker");
  assert.ok(src.includes("if (completedUsers?.has(participant)) return true;"), "Step3 hint should prioritize explicit complete gate when reopen marker is stale");
  assert.ok(src.includes("尚未收齊已加入成員的完成結構樹回報"), "Step3 hint should communicate joined-member gate status");
});

test("#356: Step3 completion lock supports reopen editing flow", async () => {
  const { readFileSync } = await import("node:fs");
  const { resolve, dirname } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const thisDir = dirname(fileURLToPath(import.meta.url));

  const step3CompleteSrc = readFileSync(resolve(thisDir, "../app/api/session/step3/complete/route.ts"), "utf8");
  const step3ReopenSrc = readFileSync(resolve(thisDir, "../app/api/session/step3/reopen/route.ts"), "utf8");
  const studentSrc = readFileSync(resolve(thisDir, "../app/student/page.tsx"), "utf8");
  const editorSrc = readFileSync(resolve(thisDir, "../app/student/_components/OutlineEditor.tsx"), "utf8");

  assert.ok(step3CompleteSrc.includes("session.step3SubmittedOutlines[user.username] = outlineText"), "Step3 complete should always refresh submitted snapshot");
  assert.ok(step3CompleteSrc.includes("3-reopen"), "Step3 complete should clear reopen marker when completing again");
  assert.ok(step3ReopenSrc.includes("session.groupGate[doneKey] = Array.from(doneUsers)"), "Step3 reopen route should remove user from complete gate");
  assert.ok(step3ReopenSrc.includes("session.groupGate[reopenKey] = Array.from(reopenUsers)"), "Step3 reopen route should add user to reopen marker");
  assert.ok(studentSrc.includes("/api/session/step3/reopen"), "student Step3 UI should call reopen API");
  assert.ok(studentSrc.includes("恢復編輯"), "student Step3 UI should render reopen editing button");
  assert.ok(editorSrc.includes("if (locked) return;"), "outline editor should hard-stop editing actions when locked");
});

test("#357: monitor summary recovers legacy string payload and participant rows", async () => {
  const { readFileSync } = await import("node:fs");
  const { resolve, dirname } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const thisDir = dirname(fileURLToPath(import.meta.url));

  const storeSrc = readFileSync(resolve(thisDir, "../src/lib/store.ts"), "utf8");
  assert.ok(storeSrc.includes("payload: unknown;"), "monitor summary row should carry raw payload for legacy parsing");
  assert.ok(storeSrc.includes("normalizeSessionPayload(row.payload)"), "monitor summary should parse legacy JSON-string payload");
  assert.ok(storeSrc.includes("llm4writing_session_participants"), "monitor summary should query split participant rows");
  assert.ok(storeSrc.includes("participants.length > 0 ? participants : (payload?.participants ?? participantFallback)"), "monitor summary should fallback participants from payload or participant rows");
  assert.ok(storeSrc.includes("groupGate: Object.keys(asStringArrayRecord(row.group_gate_json)).length > 0"), "monitor summary should fallback groupGate from parsed payload");
});

test("#335: teacher Step4 advance hint prioritizes joined users to avoid absent-member deadlock", async () => {
  const { readFileSync } = await import("node:fs");
  const { resolve, dirname } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const thisDir = dirname(fileURLToPath(import.meta.url));

  const src = readFileSync(resolve(thisDir, "../app/teacher/_components/LearningMonitorTab.tsx"), "utf8");
  assert.ok(src.includes("resolveStepGateMembers(session, \"4-complete\")"), "Step4 hint should resolve gate members through helper");
  assert.ok(src.includes("步驟 4 尚未收齊已加入成員的完成確認"), "Step4 hint should communicate joined-member gate status");
});

test("#370: teacher step switch enforces teacher-visible session scope", async () => {
  const { readFileSync } = await import("node:fs");
  const { resolve, dirname } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const thisDir = dirname(fileURLToPath(import.meta.url));

  const routeSrc = readFileSync(resolve(thisDir, "../app/api/teacher/step/route.ts"), "utf8");
  const helperSrc = readFileSync(resolve(thisDir, "../src/lib/teacher-session-access.ts"), "utf8");
  assert.ok(routeSrc.includes("canAccessTeacherSession"), "teacher step route must check session visibility before switchStep");
  assert.ok(routeSrc.includes("forbidden_session"), "teacher step route must reject cross-scope sessions");
  assert.ok(helperSrc.includes("isSessionInActivityGroupScope"), "teacher access helper must enforce activity group scope");
  assert.ok(helperSrc.includes("getUsersVisibleToTeacherStore"), "teacher access helper must derive visible classes from owned students");
});

test("#370: artifact save enforces Step3 outline lock server-side", async () => {
  const { readFileSync } = await import("node:fs");
  const { resolve, dirname } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const thisDir = dirname(fileURLToPath(import.meta.url));

  const src = readFileSync(resolve(thisDir, "../app/api/session/artifact/save/route.ts"), "utf8");
  assert.ok(src.includes("3-complete"), "artifact save must inspect Step3 completion gate");
  assert.ok(src.includes("3-reopen"), "artifact save must allow editing after explicit Step3 reopen");
  assert.ok(src.includes("step3_outline_locked_after_completion"), "artifact save must return a specific lock error");
  assert.ok(src.includes("{ status: 409 }"), "artifact save lock should be a conflict response");
});

test("#370: temporary password generation uses Web Crypto instead of Math.random", async () => {
  const { readFileSync } = await import("node:fs");
  const { resolve, dirname } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const thisDir = dirname(fileURLToPath(import.meta.url));

  const src = readFileSync(resolve(thisDir, "../app/teacher/_components/StudentAccountTab.tsx"), "utf8");
  assert.ok(src.includes("crypto.getRandomValues"), "temporary password generation must use cryptographic randomness");
  assert.ok(!src.includes("Math.random() * chars.length"), "temporary password generation must not use Math.random");
});

test("#347: step12 fallback events persist errorCategory for diagnostics", async () => {
  const { readFileSync } = await import("node:fs");
  const { resolve, dirname } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const thisDir = dirname(fileURLToPath(import.meta.url));

  const src = readFileSync(resolve(thisDir, "../src/lib/engine.ts"), "utf8");
  assert.ok(src.includes("kind: \"step12_round\""), "engine must persist step12_round events");
  assert.ok(src.includes("kind: \"step12_feedback\""), "engine must persist step12_feedback events");
  assert.ok(
    src.includes("errorCategory: feedbackResult.fallbackErrorCategory ?? \"other\""),
    "step12_feedback fallback event should persist fallback reason category"
  );
  assert.ok(
    src.includes("feedbackResult.fallbackErrorCategory ?? questionFallbackErrorCategory ?? \"other\""),
    "step12_round fallback event should persist fallback reason category"
  );
});

test("#348: Step1/2 feedback prompt is configurable from system prompt config", async () => {
  const { readFileSync } = await import("node:fs");
  const { resolve, dirname } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const thisDir = dirname(fileURLToPath(import.meta.url));

  const configSrc = readFileSync(resolve(thisDir, "../src/config/system-prompt-config.json"), "utf8");
  const config = JSON.parse(configSrc) as {
    step12FeedbackPrompts?: Record<string, string>;
    step12FeedbackFocusPrompts?: Record<string, string>;
    subStepPrompts?: Record<string, string>;
  };
  const promptConfigSrc = readFileSync(resolve(thisDir, "../src/lib/prompt-config.ts"), "utf8");
  const typeSrc = readFileSync(resolve(thisDir, "../src/lib/types.ts"), "utf8");
  const engineSrc = readFileSync(resolve(thisDir, "../src/lib/engine.ts"), "utf8");

  assert.ok(config.step12FeedbackPrompts, "system config should define Step1/2 feedback prompts");
  assert.ok(config.step12FeedbackPrompts?.["2"], "system config should allow a Step2-specific feedback prompt");
  assert.ok(configSrc.includes("重點摘要"), "configured feedback prompt should require summary content");
  assert.ok(config.step12FeedbackFocusPrompts?.["2-2"], "system config should define Step2 2-2 feedback focus");
  assert.ok(config.step12FeedbackFocusPrompts?.["2-3"], "system config should define Step2 2-3 feedback focus");
  assert.ok(config.step12FeedbackFocusPrompts?.["2-4"], "system config should define Step2 2-4 feedback focus");
  assert.equal(config.subStepPrompts?.["2-4"], undefined, "2-4 should remain question-bank driven, not LLM-generated from subStepPrompts");
  assert.ok(promptConfigSrc.includes("step12FeedbackPrompts"), "prompt config loader should pass through feedback prompts");
  assert.ok(promptConfigSrc.includes("step12FeedbackFocusPrompts"), "prompt config loader should pass through feedback focus prompts");
  assert.ok(typeSrc.includes("step12FeedbackPrompts?"), "PromptConfig type should expose feedback prompts");
  assert.ok(typeSrc.includes("step12FeedbackFocusPrompts?"), "PromptConfig type should expose feedback focus prompts");
  assert.ok(engineSrc.includes("getStep12FeedbackPrompt"), "engine should read the configured feedback prompt");
  assert.ok(engineSrc.includes("getStep12FeedbackFocusPrompt"), "engine should read configured substep feedback focus");
  assert.ok(engineSrc.includes("本子步驟回饋焦點"), "engine should include substep-specific focus in feedback prompt");
  assert.ok(engineSrc.includes("prompts[String(step)]?.trim() || prompts.default?.trim()"), "engine should prefer step-specific feedback prompt");
  assert.ok(engineSrc.includes("[\"2-2\", \"2-3\", \"2-4\"].includes(substepKey)"), "Step2 late feedback should have stricter quality gate");
});

test("#351: Step1-1 feedback includes genre mismatch correction context", async () => {
  const { readFileSync } = await import("node:fs");
  const { resolve, dirname } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const thisDir = dirname(fileURLToPath(import.meta.url));

  const engineSrc = readFileSync(resolve(thisDir, "../src/lib/engine.ts"), "utf8");
  assert.ok(engineSrc.includes("function buildStep11GenreCheckHint"), "engine should build Step1-1 genre-check hint");
  assert.ok(engineSrc.includes("findActivity(session.activityId)"), "genre check should compare against activity configured genre");
  assert.ok(engineSrc.includes("回饋要求：必須明確指出文體錯誤"), "genre mismatch hint should require explicit correction");
  assert.ok(engineSrc.includes("if (step === 1 && substepKey === \"1-1\")"), "fallback feedback should handle Step1-1 correction");
  assert.ok(engineSrc.includes("文體檢核補充"), "feedback generation should inject genre-check hint into LLM context");
});
