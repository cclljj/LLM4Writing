import postgres, { Sql } from "postgres";
import { SessionState } from "@/src/lib/types";
import { getDatabaseUrl, getPostgresClientOptions, isDatabaseEnabled } from "@/src/lib/db-config";

type MemoryStore = Map<string, SessionState>;

const KEY = "__llm4writing_sessions__";
// Side-map tracking updatedAt for memory mode (ephemeral, not persisted)
const memoryUpdatedAt = new Map<string, string>();

function getMemoryStore(): MemoryStore {
  const globalScope = globalThis as unknown as Record<string, MemoryStore | undefined>;
  if (!globalScope[KEY]) {
    globalScope[KEY] = new Map<string, SessionState>();
  }
  return globalScope[KEY] as MemoryStore;
}

let sqlClient: Sql | undefined;

function getSqlClient(): Sql {
  if (!sqlClient) {
    const url = getDatabaseUrl();
    if (!url) {
      throw new Error("postgres_url_missing");
    }
    sqlClient = postgres(url, getPostgresClientOptions(url));
  }
  return sqlClient;
}

let initPromise: Promise<void> | undefined;

function normalizeSessionPayload(payload: unknown): SessionState | undefined {
  if (typeof payload === "string") {
    try {
      return normalizeSessionPayload(JSON.parse(payload));
    } catch {
      return undefined;
    }
  }
  if (payload && typeof payload === "object") {
    return payload as SessionState;
  }
  return undefined;
}

async function ensureSessionTable(): Promise<void> {
  if (!isDatabaseEnabled()) {
    return;
  }

  if (!initPromise) {
    initPromise = (async () => {
      const sql = getSqlClient();
      await sql`
        CREATE TABLE IF NOT EXISTS llm4writing_sessions (
          id TEXT PRIMARY KEY,
          payload JSONB NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;
      // Additive migration: current_step column for indexed queries / monitoring.
      // IF NOT EXISTS makes this safe to run against existing tables.
      await sql`
        ALTER TABLE llm4writing_sessions
        ADD COLUMN IF NOT EXISTS current_step INTEGER
      `;
    })().catch((error) => {
      initPromise = undefined;
      throw error;
    });
  }

  await initPromise;
}

export async function saveSession(session: SessionState): Promise<SessionState> {
  if (!isDatabaseEnabled()) {
    getMemoryStore().set(session.id, session);
    memoryUpdatedAt.set(session.id, new Date().toISOString());
    return session;
  }

  await ensureSessionTable();
  const sql = getSqlClient();

  await sql`
    INSERT INTO llm4writing_sessions (id, payload, current_step)
    VALUES (${session.id}, ${JSON.stringify(session)}::jsonb, ${session.currentStep})
    ON CONFLICT (id)
    DO UPDATE SET
      payload = EXCLUDED.payload,
      current_step = EXCLUDED.current_step,
      updated_at = NOW()
  `;

  return session;
}

export type SessionWithMeta = {
  session: SessionState;
  updatedAt: string;
};

/** Like getSession but also returns the DB-level updatedAt for ETag computation. */
export async function getSessionWithMeta(sessionId: string): Promise<SessionWithMeta | undefined> {
  if (!isDatabaseEnabled()) {
    const session = getMemoryStore().get(sessionId);
    if (!session) return undefined;
    return { session, updatedAt: memoryUpdatedAt.get(sessionId) ?? session.createdAt };
  }

  await ensureSessionTable();
  const sql = getSqlClient();

  const rows = await sql<{ payload: unknown; updated_at: Date }[]>`
    SELECT payload, updated_at
    FROM llm4writing_sessions
    WHERE id = ${sessionId}
    LIMIT 1
  `;

  if (!rows[0]) return undefined;
  const session = normalizeSessionPayload(rows[0].payload);
  if (!session) return undefined;
  return { session, updatedAt: rows[0].updated_at.toISOString() };
}

export async function getSession(sessionId: string): Promise<SessionState | undefined> {
  const meta = await getSessionWithMeta(sessionId);
  return meta?.session;
}

export async function listSessions(opts?: { limit?: number; offset?: number }): Promise<SessionState[]> {
  const limit = typeof opts?.limit === "number" && opts.limit > 0 ? opts.limit : undefined;
  const offset = typeof opts?.offset === "number" && opts.offset >= 0 ? opts.offset : 0;

  if (!isDatabaseEnabled()) {
    const all = Array.from(getMemoryStore().values());
    return limit !== undefined ? all.slice(offset, offset + limit) : all.slice(offset);
  }

  await ensureSessionTable();
  const sql = getSqlClient();

  if (limit !== undefined) {
    const rows = await sql<{ payload: unknown }[]>`
      SELECT payload
      FROM llm4writing_sessions
      ORDER BY updated_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
    return rows
      .map((row) => normalizeSessionPayload(row.payload))
      .filter((item): item is SessionState => Boolean(item));
  }

  const rows = await sql<{ payload: unknown }[]>`
    SELECT payload
    FROM llm4writing_sessions
    ORDER BY updated_at DESC
    OFFSET ${offset}
  `;
  return rows
    .map((row) => normalizeSessionPayload(row.payload))
    .filter((item): item is SessionState => Boolean(item));
}

export async function countSessions(): Promise<number> {
  if (!isDatabaseEnabled()) {
    return getMemoryStore().size;
  }
  await ensureSessionTable();
  const sql = getSqlClient();
  const rows = await sql<{ count: string }[]>`SELECT COUNT(*)::text AS count FROM llm4writing_sessions`;
  return parseInt(rows[0]?.count ?? "0", 10);
}

export async function deleteSessionsByActivityId(activityId: string): Promise<number> {
  if (!activityId.trim()) return 0;
  if (!isDatabaseEnabled()) {
    let count = 0;
    const memory = getMemoryStore();
    Array.from(memory.entries()).forEach(([id, session]) => {
      if (session.activityId === activityId) {
        memory.delete(id);
        memoryUpdatedAt.delete(id);
        count += 1;
      }
    });
    return count;
  }

  await ensureSessionTable();
  const sql = getSqlClient();
  const rows = await sql<{ id: string }[]>`
    DELETE FROM llm4writing_sessions
    WHERE payload->>'activityId' = ${activityId}
    RETURNING id
  `;
  return rows.length;
}

export function getStorageMode(): "postgres" | "memory" {
  return isDatabaseEnabled() ? "postgres" : "memory";
}
