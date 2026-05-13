import { cache } from "react";
import postgres, { Sql } from "postgres";
import { SessionState } from "@/src/lib/types";
import { getDatabaseUrl, getPostgresClientOptions, isDatabaseEnabled } from "@/src/lib/db-config";

type MemoryStore = Map<string, SessionState>;
type SessionSummaryColumns = {
  workflow: string | null;
  activityId: string | null;
  groupId: string | null;
  currentStep: number;
  messageCount: number;
  lastMessageAt: string | null;
  participantCount: number;
};

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

function buildSessionSummaryColumns(session: SessionState): SessionSummaryColumns {
  const lastMessage = session.messages.at(-1);
  return {
    workflow: session.workflow,
    activityId: session.activityId ?? null,
    groupId: session.groupId ?? null,
    currentStep: session.currentStep,
    messageCount: session.messages.length,
    lastMessageAt: lastMessage?.at ?? session.createdAt ?? null,
    participantCount: session.participants.length
  };
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
      await sql`
        ALTER TABLE llm4writing_sessions
        ADD COLUMN IF NOT EXISTS workflow TEXT,
        ADD COLUMN IF NOT EXISTS activity_id TEXT,
        ADD COLUMN IF NOT EXISTS group_id TEXT,
        ADD COLUMN IF NOT EXISTS message_count INTEGER,
        ADD COLUMN IF NOT EXISTS last_message_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS participant_count INTEGER
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS idx_llm4writing_sessions_activity_updated
        ON llm4writing_sessions (activity_id, updated_at DESC)
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS idx_llm4writing_sessions_workflow_activity_updated
        ON llm4writing_sessions (workflow, activity_id, updated_at DESC)
      `;
      await sql`
        UPDATE llm4writing_sessions
        SET
          workflow = COALESCE(workflow, payload->>'workflow'),
          activity_id = COALESCE(activity_id, payload->>'activityId'),
          group_id = COALESCE(group_id, payload->>'groupId'),
          current_step = COALESCE(current_step, NULLIF(payload->>'currentStep', '')::integer),
          message_count = COALESCE(message_count, jsonb_array_length(COALESCE(payload->'messages', '[]'::jsonb))),
          last_message_at = COALESCE(
            last_message_at,
            NULLIF(payload->'messages'->-1->>'at', '')::timestamptz,
            NULLIF(payload->>'createdAt', '')::timestamptz
          ),
          participant_count = COALESCE(participant_count, jsonb_array_length(COALESCE(payload->'participants', '[]'::jsonb)))
        WHERE workflow IS NULL
           OR activity_id IS NULL
           OR group_id IS NULL
           OR current_step IS NULL
           OR message_count IS NULL
           OR last_message_at IS NULL
           OR participant_count IS NULL
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
  const summary = buildSessionSummaryColumns(session);

  await sql`
    INSERT INTO llm4writing_sessions (
      id,
      payload,
      current_step,
      workflow,
      activity_id,
      group_id,
      message_count,
      last_message_at,
      participant_count
    )
    VALUES (
      ${session.id},
      ${JSON.stringify(session)}::jsonb,
      ${summary.currentStep},
      ${summary.workflow},
      ${summary.activityId},
      ${summary.groupId},
      ${summary.messageCount},
      ${summary.lastMessageAt},
      ${summary.participantCount}
    )
    ON CONFLICT (id)
    DO UPDATE SET
      payload = EXCLUDED.payload,
      current_step = EXCLUDED.current_step,
      workflow = EXCLUDED.workflow,
      activity_id = EXCLUDED.activity_id,
      group_id = EXCLUDED.group_id,
      message_count = EXCLUDED.message_count,
      last_message_at = EXCLUDED.last_message_at,
      participant_count = EXCLUDED.participant_count,
      updated_at = NOW()
  `;

  return session;
}

export type SessionWithMeta = {
  session: SessionState;
  updatedAt: string;
};

/** Like getSession but also returns the DB-level updatedAt for ETag computation.
 *  Wrapped with React cache() for request-level memoization — same sessionId
 *  only hits the DB once per request even if called from multiple code paths. */
export const getSessionWithMeta = cache(async (sessionId: string): Promise<SessionWithMeta | undefined> => {
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
});

export async function getSession(sessionId: string): Promise<SessionState | undefined> {
  return (await getSessionWithMeta(sessionId))?.session;
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

export async function listMonitorSessionsByActivityId(
  activityId: string,
  opts?: { limit?: number; offset?: number }
): Promise<{ sessions: SessionState[]; total: number }> {
  const trimmedActivityId = activityId.trim();
  const limit = typeof opts?.limit === "number" && opts.limit > 0 ? opts.limit : 50;
  const offset = typeof opts?.offset === "number" && opts.offset >= 0 ? opts.offset : 0;

  if (!trimmedActivityId) {
    return { sessions: [], total: 0 };
  }

  if (!isDatabaseEnabled()) {
    const scoped = Array.from(getMemoryStore().values())
      .filter((session) => session.workflow === "spec10" && session.activityId === trimmedActivityId)
      .sort((a, b) => {
        const aLast = memoryUpdatedAt.get(a.id) ?? a.messages.at(-1)?.at ?? a.createdAt;
        const bLast = memoryUpdatedAt.get(b.id) ?? b.messages.at(-1)?.at ?? b.createdAt;
        return bLast.localeCompare(aLast);
      });
    return { sessions: scoped.slice(offset, offset + limit), total: scoped.length };
  }

  await ensureSessionTable();
  const sql = getSqlClient();
  const rows = await sql<{ payload: unknown }[]>`
    SELECT payload
    FROM llm4writing_sessions
    WHERE (workflow = 'spec10' OR (workflow IS NULL AND payload->>'workflow' = 'spec10'))
      AND (activity_id = ${trimmedActivityId} OR (activity_id IS NULL AND payload->>'activityId' = ${trimmedActivityId}))
    ORDER BY updated_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `;
  const countRows = await sql<{ count: string }[]>`
    SELECT COUNT(*)::text AS count
    FROM llm4writing_sessions
    WHERE (workflow = 'spec10' OR (workflow IS NULL AND payload->>'workflow' = 'spec10'))
      AND (activity_id = ${trimmedActivityId} OR (activity_id IS NULL AND payload->>'activityId' = ${trimmedActivityId}))
  `;

  return {
    sessions: rows
      .map((row) => normalizeSessionPayload(row.payload))
      .filter((item): item is SessionState => Boolean(item)),
    total: parseInt(countRows[0]?.count ?? "0", 10)
  };
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
    WHERE activity_id = ${activityId}
       OR (activity_id IS NULL AND payload->>'activityId' = ${activityId})
    RETURNING id
  `;
  return rows.length;
}

export function getStorageMode(): "postgres" | "memory" {
  return isDatabaseEnabled() ? "postgres" : "memory";
}
