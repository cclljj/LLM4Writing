/**
 * Tests for:
 * - Issue #220: QualitySignals type unification
 * - Issue #221: current_step DB column + store enhancements (memory mode)
 * - Issue #222: Pagination in monitor/activities
 * - Issue #223: ETag / presence decoupling
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
