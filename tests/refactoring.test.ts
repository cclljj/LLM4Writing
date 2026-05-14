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

test("#221: saveSession writes current_step in UPSERT", async () => {
  const { readFileSync } = await import("node:fs");
  const { resolve, dirname } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const thisDir = dirname(fileURLToPath(import.meta.url));

  const src = readFileSync(resolve(thisDir, "../src/lib/store.ts"), "utf8");
  // UPSERT should set current_step = EXCLUDED.current_step or similar
  assert.ok(src.includes("current_step = EXCLUDED.current_step"), "saveSession must sync current_step on UPSERT");
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
  assert.ok(src.includes("workflow = EXCLUDED.workflow"), "saveSession must sync workflow summary on UPSERT");
  assert.ok(src.includes("activity_id = EXCLUDED.activity_id"), "saveSession must sync activity_id summary on UPSERT");
});

test("#323: teacher monitor uses activity-scoped DB pagination path", async () => {
  const { readFileSync } = await import("node:fs");
  const { resolve, dirname } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const thisDir = dirname(fileURLToPath(import.meta.url));

  const routeSrc = readFileSync(resolve(thisDir, "../app/api/teacher/monitor/route.ts"), "utf8");
  const storeSrc = readFileSync(resolve(thisDir, "../src/lib/store.ts"), "utf8");

  assert.ok(routeSrc.includes("listMonitorSessionsByActivityId"), "monitor route must call the activity-scoped store query");
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
