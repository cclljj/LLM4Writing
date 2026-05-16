import postgres, { Sql } from "postgres";
import { getDatabaseUrl, getPostgresClientOptions, isDatabaseEnabled } from "@/src/lib/db-config";

export type AuditLogEntry = {
  id: string;
  createdAt: string;
  actorUsername: string;
  actorRole: string;
  action: string;
  targetType: string;
  targetId: string;
  targetLabel: string;
  details: Record<string, unknown>;
};

type AuditLogRow = {
  id: string;
  created_at: Date;
  actor_username: string;
  actor_role: string;
  action: string;
  target_type: string;
  target_id: string;
  target_label: string;
  details: unknown;
};

const KEY = "__llm4writing_audit_logs__";

function getMemoryLogs(): AuditLogEntry[] {
  const globalScope = globalThis as unknown as Record<string, AuditLogEntry[] | undefined>;
  if (!globalScope[KEY]) globalScope[KEY] = [];
  return globalScope[KEY]!;
}

let sqlClient: Sql | undefined;
let initPromise: Promise<void> | undefined;

function getSqlClient(): Sql {
  if (!sqlClient) {
    const url = getDatabaseUrl();
    if (!url) throw new Error("postgres_url_missing");
    sqlClient = postgres(url, getPostgresClientOptions(url));
  }
  return sqlClient;
}

async function ensureAuditTable(): Promise<void> {
  if (!isDatabaseEnabled()) return;
  if (!initPromise) {
    initPromise = (async () => {
      const sql = getSqlClient();
      await sql`
        CREATE TABLE IF NOT EXISTS llm4writing_audit_logs (
          id BIGSERIAL PRIMARY KEY,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          actor_username TEXT NOT NULL,
          actor_role TEXT NOT NULL,
          action TEXT NOT NULL,
          target_type TEXT NOT NULL,
          target_id TEXT NOT NULL DEFAULT '',
          target_label TEXT NOT NULL DEFAULT '',
          details JSONB NOT NULL DEFAULT '{}'::jsonb
        )
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS idx_llm4writing_audit_logs_created
        ON llm4writing_audit_logs (created_at DESC)
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS idx_llm4writing_audit_logs_action_created
        ON llm4writing_audit_logs (action, created_at DESC)
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS idx_llm4writing_audit_logs_actor_created
        ON llm4writing_audit_logs (actor_username, created_at DESC)
      `;
    })().catch((error) => {
      initPromise = undefined;
      throw error;
    });
  }
  await initPromise;
}

function normalizeIso(input?: string): string {
  if (!input) return new Date().toISOString();
  const parsed = new Date(input);
  if (!Number.isFinite(parsed.getTime())) return new Date().toISOString();
  return parsed.toISOString();
}

function toEntry(row: AuditLogRow): AuditLogEntry {
  return {
    id: row.id,
    createdAt: row.created_at.toISOString(),
    actorUsername: row.actor_username,
    actorRole: row.actor_role,
    action: row.action,
    targetType: row.target_type,
    targetId: row.target_id,
    targetLabel: row.target_label,
    details:
      row.details && typeof row.details === "object" && !Array.isArray(row.details)
        ? (row.details as Record<string, unknown>)
        : {}
  };
}

export async function recordAuditLog(input: {
  actorUsername: string;
  actorRole: string;
  action: string;
  targetType?: string;
  targetId?: string;
  targetLabel?: string;
  details?: Record<string, unknown>;
  createdAt?: string;
}): Promise<void> {
  const actorUsername = input.actorUsername.trim();
  if (!actorUsername) return;
  const entry: AuditLogEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: normalizeIso(input.createdAt),
    actorUsername,
    actorRole: input.actorRole.trim() || "unknown",
    action: input.action.trim() || "unknown_action",
    targetType: input.targetType?.trim() || "unknown_target",
    targetId: input.targetId?.trim() || "",
    targetLabel: input.targetLabel?.trim() || "",
    details: input.details ?? {}
  };

  if (!isDatabaseEnabled()) {
    const memory = getMemoryLogs();
    memory.unshift(entry);
    if (memory.length > 2000) memory.splice(2000);
    return;
  }

  await ensureAuditTable();
  const sql = getSqlClient();
  await sql`
    INSERT INTO llm4writing_audit_logs (
      created_at,
      actor_username,
      actor_role,
      action,
      target_type,
      target_id,
      target_label,
      details
    ) VALUES (
      ${entry.createdAt}::timestamptz,
      ${entry.actorUsername},
      ${entry.actorRole},
      ${entry.action},
      ${entry.targetType},
      ${entry.targetId},
      ${entry.targetLabel},
      ${JSON.stringify(entry.details)}::jsonb
    )
  `;
}

export async function listAuditLogs(input: {
  fromIso?: string;
  toIso?: string;
  limit?: number;
  offset?: number;
}): Promise<{ logs: AuditLogEntry[]; total: number }> {
  const fromIso = input.fromIso ? normalizeIso(input.fromIso) : undefined;
  const toIso = input.toIso ? normalizeIso(input.toIso) : undefined;
  const limit = typeof input.limit === "number" && input.limit > 0 ? Math.min(input.limit, 500) : 200;
  const offset = typeof input.offset === "number" && input.offset >= 0 ? input.offset : 0;

  if (!isDatabaseEnabled()) {
    const memory = getMemoryLogs();
    const scoped = memory.filter((item) => {
      const at = new Date(item.createdAt).getTime();
      if (!Number.isFinite(at)) return false;
      if (fromIso && at < new Date(fromIso).getTime()) return false;
      if (toIso && at > new Date(toIso).getTime()) return false;
      return true;
    });
    return {
      logs: scoped.slice(offset, offset + limit),
      total: scoped.length
    };
  }

  await ensureAuditTable();
  const sql = getSqlClient();
  const rows = await sql<AuditLogRow[]>`
    SELECT id::text, created_at, actor_username, actor_role, action, target_type, target_id, target_label, details
    FROM llm4writing_audit_logs
    WHERE (${fromIso ?? null}::timestamptz IS NULL OR created_at >= ${fromIso ?? null}::timestamptz)
      AND (${toIso ?? null}::timestamptz IS NULL OR created_at <= ${toIso ?? null}::timestamptz)
    ORDER BY created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `;
  const countRows = await sql<{ count: string }[]>`
    SELECT COUNT(*)::text AS count
    FROM llm4writing_audit_logs
    WHERE (${fromIso ?? null}::timestamptz IS NULL OR created_at >= ${fromIso ?? null}::timestamptz)
      AND (${toIso ?? null}::timestamptz IS NULL OR created_at <= ${toIso ?? null}::timestamptz)
  `;
  return {
    logs: rows.map(toEntry),
    total: parseInt(countRows[0]?.count ?? "0", 10)
  };
}
