import postgres, { Sql } from "postgres";
import { SessionState } from "@/src/lib/types";

type MemoryStore = Map<string, SessionState>;

const KEY = "__llm4writing_sessions__";

function getMemoryStore(): MemoryStore {
  const globalScope = globalThis as unknown as Record<string, MemoryStore | undefined>;
  if (!globalScope[KEY]) {
    globalScope[KEY] = new Map<string, SessionState>();
  }
  return globalScope[KEY] as MemoryStore;
}

function getPostgresUrl(): string | undefined {
  return process.env.POSTGRES_URL ?? process.env.DATABASE_URL;
}

function isPostgresEnabled(): boolean {
  return Boolean(getPostgresUrl());
}

let sqlClient: Sql | undefined;

function getSqlClient(): Sql {
  if (!sqlClient) {
    const url = getPostgresUrl();
    if (!url) {
      throw new Error("postgres_url_missing");
    }
    sqlClient = postgres(url, {
      prepare: true,
      max: 1
    });
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
  if (!isPostgresEnabled()) {
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
    })();
  }

  await initPromise;
}

export async function saveSession(session: SessionState): Promise<SessionState> {
  if (!isPostgresEnabled()) {
    getMemoryStore().set(session.id, session);
    return session;
  }

  await ensureSessionTable();
  const sql = getSqlClient();

  await sql`
    INSERT INTO llm4writing_sessions (id, payload)
    VALUES (${session.id}, ${JSON.stringify(session)}::jsonb)
    ON CONFLICT (id)
    DO UPDATE SET
      payload = EXCLUDED.payload,
      updated_at = NOW()
  `;

  return session;
}

export async function getSession(sessionId: string): Promise<SessionState | undefined> {
  if (!isPostgresEnabled()) {
    return getMemoryStore().get(sessionId);
  }

  await ensureSessionTable();
  const sql = getSqlClient();

  const rows = await sql<{ payload: unknown }[]>`
    SELECT payload
    FROM llm4writing_sessions
    WHERE id = ${sessionId}
    LIMIT 1
  `;

  return rows[0] ? normalizeSessionPayload(rows[0].payload) : undefined;
}

export async function listSessions(): Promise<SessionState[]> {
  if (!isPostgresEnabled()) {
    return Array.from(getMemoryStore().values());
  }

  await ensureSessionTable();
  const sql = getSqlClient();
  const rows = await sql<{ payload: unknown }[]>`
    SELECT payload
    FROM llm4writing_sessions
    ORDER BY updated_at DESC
  `;

  return rows
    .map((row) => normalizeSessionPayload(row.payload))
    .filter((item): item is SessionState => Boolean(item));
}

export function getStorageMode(): "postgres" | "memory" {
  return isPostgresEnabled() ? "postgres" : "memory";
}
