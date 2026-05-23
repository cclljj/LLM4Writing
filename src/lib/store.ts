import { cache } from "react";
import postgres, { Sql, TransactionSql } from "postgres";
import { ChatMessage, SessionState, Step12FallbackDebugTrace, Step12RoundLog } from "@/src/lib/types";
import { getDatabaseUrl, getPostgresClientOptions, isDatabaseEnabled } from "@/src/lib/db-config";

type MemoryStore = Map<string, SessionState>;
type SessionCorePayload = Omit<SessionState, "messages" | "outlines" | "step3SubmittedOutlines" | "draftStep6" | "draftStep8" | "reports" | "step12RoundLogs" | "step12FallbackDebugTraces">;
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
const memoryVersion = new Map<string, number>();
const STORE_VERSION_FIELD = "__storeVersion";
const STORE_UPDATED_AT_FIELD = "__storeUpdatedAt";

export class SessionVersionConflictError extends Error {
  constructor(message = "session_version_conflict") {
    super(message);
    this.name = "SessionVersionConflictError";
  }
}

export type PersistedEventKind =
  | "llm_chat"
  | "llm_stream"
  | "step12_feedback"
  | "step12_next_question"
  | "step12_round"
  | "student_rejection"
  | "fallback";

export type PersistedErrorCategory = "timeout" | "truncation" | "parse_fail" | "other";

export type PersistedEventInput = {
  sessionId?: string;
  activityId?: string;
  step?: number;
  kind: PersistedEventKind | string;
  latencyMs?: number;
  fallbackUsed?: boolean;
  errorCategory?: PersistedErrorCategory;
  createdAt?: string;
};

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

function asRecord(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  return input as Record<string, unknown>;
}

function asStringArray(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input.filter((value): value is string => typeof value === "string" && value.trim().length > 0);
}

function asNumberRecord(input: unknown): Record<string, number> {
  const source = asRecord(input);
  const result: Record<string, number> = {};
  for (const [key, value] of Object.entries(source)) {
    const num = typeof value === "number" ? value : Number(value);
    if (Number.isFinite(num)) result[key] = num;
  }
  return result;
}

function asStringRecord(input: unknown): Record<string, string> {
  const source = asRecord(input);
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(source)) {
    if (typeof value === "string" && value.trim().length > 0) result[key] = value;
  }
  return result;
}

function asStringArrayRecord(input: unknown): Record<string, string[]> {
  const source = asRecord(input);
  const result: Record<string, string[]> = {};
  for (const [key, value] of Object.entries(source)) {
    result[key] = asStringArray(value);
  }
  return result;
}

function attachSessionStoreMeta(session: SessionState, version: number, updatedAt: string): SessionState {
  Object.defineProperty(session, STORE_VERSION_FIELD, {
    value: version,
    writable: true,
    configurable: true,
    enumerable: false
  });
  Object.defineProperty(session, STORE_UPDATED_AT_FIELD, {
    value: updatedAt,
    writable: true,
    configurable: true,
    enumerable: false
  });
  return session;
}

function readSessionStoreVersion(session: SessionState): number | undefined {
  const value = (session as SessionState & Record<string, unknown>)[STORE_VERSION_FIELD];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function normalizeStep12RoundLogs(input: unknown): Step12RoundLog[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((item): item is Step12RoundLog => Boolean(item && typeof item === "object"))
    .map((item) => ({ ...item }));
}

function normalizeStep12FallbackDebugTraces(input: unknown): Step12FallbackDebugTrace[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((item): item is Step12FallbackDebugTrace => Boolean(item && typeof item === "object"))
    .map((item) => ({
      ...item,
      rejectionReasons: Array.isArray(item.rejectionReasons)
        ? item.rejectionReasons.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
        : []
    }));
}

function createEmptyReports() {
  return { step5: {}, step7: {}, step10: {} } as SessionState["reports"];
}

function buildSessionCorePayload(session: SessionState): SessionCorePayload {
  const rest = { ...session } as Partial<SessionState> & Record<string, unknown>;
  delete rest.messages;
  delete rest.outlines;
  delete rest.step3SubmittedOutlines;
  delete rest.draftStep6;
  delete rest.draftStep8;
  delete rest.reports;
  delete rest.step12RoundLogs;
  delete rest.step12FallbackDebugTraces;
  return rest as SessionCorePayload;
}

function mergeSessionParts(core: SessionCorePayload, parts: {
  messages: ChatMessage[];
  outlines: Record<string, string>;
  step3SubmittedOutlines: Record<string, string>;
  draftStep6: Record<string, string>;
  draftStep8: Record<string, string>;
  reports: SessionState["reports"];
  step12RoundLogs: Step12RoundLog[];
  step12FallbackDebugTraces: Step12FallbackDebugTrace[];
}): SessionState {
  return {
    ...core,
    messages: parts.messages,
    outlines: parts.outlines,
    step3SubmittedOutlines: parts.step3SubmittedOutlines,
    draftStep6: parts.draftStep6,
    draftStep8: parts.draftStep8,
    reports: parts.reports,
    step12RoundLogs: parts.step12RoundLogs,
    step12FallbackDebugTraces: parts.step12FallbackDebugTraces
  };
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

function uniqueByMessageId(messages: ChatMessage[]): ChatMessage[] {
  const map = new Map<string, ChatMessage>();
  for (const message of messages) {
    if (!message?.id) continue;
    if (!map.has(message.id)) {
      map.set(message.id, message);
    }
  }
  return Array.from(map.values()).sort((a, b) => a.at.localeCompare(b.at));
}

function mergeStringRecord(base: Record<string, string> | undefined, incoming: Record<string, string> | undefined): Record<string, string> {
  return { ...(base ?? {}), ...(incoming ?? {}) };
}

function mergeStringArrayRecord(base: Record<string, string[]> | undefined, incoming: Record<string, string[]> | undefined): Record<string, string[]> {
  const merged: Record<string, string[]> = {};
  const keys = new Set<string>([...Object.keys(base ?? {}), ...Object.keys(incoming ?? {})]);
  for (const key of keys) {
    const values = [...(base?.[key] ?? []), ...(incoming?.[key] ?? [])];
    merged[key] = Array.from(new Set(values));
  }
  return merged;
}

function mergeNumberRecord(base: Record<string, number> | undefined, incoming: Record<string, number> | undefined): Record<string, number> {
  const merged: Record<string, number> = {};
  const keys = new Set<string>([...Object.keys(base ?? {}), ...Object.keys(incoming ?? {})]);
  for (const key of keys) {
    merged[key] = Math.max(base?.[key] ?? Number.NEGATIVE_INFINITY, incoming?.[key] ?? Number.NEGATIVE_INFINITY);
    if (!Number.isFinite(merged[key])) merged[key] = 0;
  }
  return merged;
}

function mergeIsoRecord(base: Record<string, string> | undefined, incoming: Record<string, string> | undefined): Record<string, string> {
  const merged: Record<string, string> = {};
  const keys = new Set<string>([...Object.keys(base ?? {}), ...Object.keys(incoming ?? {})]);
  for (const key of keys) {
    const left = base?.[key];
    const right = incoming?.[key];
    if (!left) merged[key] = right ?? "";
    else if (!right) merged[key] = left;
    else merged[key] = left >= right ? left : right;
    if (!merged[key]) delete merged[key];
  }
  return merged;
}

function mergeStep12RoundLogs(base: Step12RoundLog[] | undefined, incoming: Step12RoundLog[] | undefined): Step12RoundLog[] {
  const all = [...(base ?? []), ...(incoming ?? [])];
  const seen = new Set<string>();
  const merged: Step12RoundLog[] = [];
  for (const item of all.sort((a, b) => a.at.localeCompare(b.at))) {
    const key = `${item.at}|${item.currentStep}|${item.currentSubStep}|${item.nextSubStep}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(item);
  }
  if (merged.length > 60) return merged.slice(merged.length - 60);
  return merged;
}

function mergeStep12FallbackDebugTraces(
  base: Step12FallbackDebugTrace[] | undefined,
  incoming: Step12FallbackDebugTrace[] | undefined
): Step12FallbackDebugTrace[] {
  const all = [...(base ?? []), ...(incoming ?? [])];
  const seen = new Set<string>();
  const merged: Step12FallbackDebugTrace[] = [];
  for (const item of all.sort((a, b) => a.at.localeCompare(b.at))) {
    const key = `${item.at}:${item.kind}:${item.step}:${item.substepKey}:${item.originalQuestion}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(item);
  }
  if (merged.length <= 120) return merged;
  return merged.slice(merged.length - 120);
}

function mergeReports(base: SessionState["reports"], incoming: SessionState["reports"]): SessionState["reports"] {
  return {
    step5: mergeStringRecord(base.step5, incoming.step5),
    step7: mergeStringRecord(base.step7, incoming.step7),
    step10: mergeStringRecord(base.step10, incoming.step10)
  };
}

function mergeSessionStates(latest: SessionState, incoming: SessionState): SessionState {
  return {
    ...latest,
    ...incoming,
    currentStep: Math.max(latest.currentStep, incoming.currentStep),
    participants: Array.from(new Set([...(latest.participants ?? []), ...(incoming.participants ?? [])])),
    personalSteps: { ...(latest.personalSteps ?? {}), ...(incoming.personalSteps ?? {}) },
    joinedUsers: Array.from(new Set([...(latest.joinedUsers ?? []), ...(incoming.joinedUsers ?? [])])),
    onlineUsersLastSeen: { ...(latest.onlineUsersLastSeen ?? {}), ...(incoming.onlineUsersLastSeen ?? {}) },
    messages: uniqueByMessageId([...(latest.messages ?? []), ...(incoming.messages ?? [])]),
    groupGate: mergeStringArrayRecord(latest.groupGate, incoming.groupGate),
    reflectionIndex: { ...(latest.reflectionIndex ?? {}), ...(incoming.reflectionIndex ?? {}) },
    promptConfig: incoming.promptConfig ?? latest.promptConfig,
    stepState: { ...(latest.stepState ?? {}), ...(incoming.stepState ?? {}) },
    outlines: mergeStringRecord(latest.outlines, incoming.outlines),
    step3SubmittedOutlines: mergeStringRecord(latest.step3SubmittedOutlines ?? {}, incoming.step3SubmittedOutlines ?? {}),
    draftStep6: mergeStringRecord(latest.draftStep6, incoming.draftStep6),
    draftStep8: mergeStringRecord(latest.draftStep8, incoming.draftStep8),
    reports: mergeReports(latest.reports ?? createEmptyReports(), incoming.reports ?? createEmptyReports()),
    step12FallbackDebugTraces: mergeStep12FallbackDebugTraces(latest.step12FallbackDebugTraces, incoming.step12FallbackDebugTraces),
    qualitySignals: {
      rejectedAnswerCounts: mergeNumberRecord(latest.qualitySignals?.rejectedAnswerCounts, incoming.qualitySignals?.rejectedAnswerCounts),
      rejectedAnswerLastAt: mergeIsoRecord(latest.qualitySignals?.rejectedAnswerLastAt, incoming.qualitySignals?.rejectedAnswerLastAt)
    },
    artifactSignals: {
      outlineUpdatedAt: mergeIsoRecord(latest.artifactSignals?.outlineUpdatedAt, incoming.artifactSignals?.outlineUpdatedAt),
      draftStep6UpdatedAt: mergeIsoRecord(latest.artifactSignals?.draftStep6UpdatedAt, incoming.artifactSignals?.draftStep6UpdatedAt),
      draftStep8UpdatedAt: mergeIsoRecord(latest.artifactSignals?.draftStep8UpdatedAt, incoming.artifactSignals?.draftStep8UpdatedAt)
    },
    step12RoundLogs: mergeStep12RoundLogs(latest.step12RoundLogs, incoming.step12RoundLogs)
  };
}

export async function ensureSessionTable(): Promise<void> {
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
          version BIGINT NOT NULL DEFAULT 1,
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
        ADD COLUMN IF NOT EXISTS version BIGINT NOT NULL DEFAULT 1
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
        CREATE TABLE IF NOT EXISTS llm4writing_session_messages (
          session_id TEXT NOT NULL REFERENCES llm4writing_sessions(id) ON DELETE CASCADE,
          message_id TEXT NOT NULL,
          idx INTEGER NOT NULL,
          role TEXT NOT NULL,
          user_id TEXT,
          step INTEGER NOT NULL,
          text TEXT NOT NULL,
          at TEXT NOT NULL,
          PRIMARY KEY (session_id, message_id)
        )
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS idx_llm4writing_session_messages_session_idx
        ON llm4writing_session_messages (session_id, idx)
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS llm4writing_session_artifacts (
          session_id TEXT NOT NULL REFERENCES llm4writing_sessions(id) ON DELETE CASCADE,
          user_id TEXT NOT NULL,
          outline TEXT NOT NULL DEFAULT '',
          step3_submitted_outline TEXT NOT NULL DEFAULT '',
          draft_step6 TEXT NOT NULL DEFAULT '',
          draft_step8 TEXT NOT NULL DEFAULT '',
          PRIMARY KEY (session_id, user_id)
        )
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS llm4writing_session_reports (
          session_id TEXT NOT NULL REFERENCES llm4writing_sessions(id) ON DELETE CASCADE,
          user_id TEXT NOT NULL,
          step5_report TEXT NOT NULL DEFAULT '',
          step7_report TEXT NOT NULL DEFAULT '',
          step10_report TEXT NOT NULL DEFAULT '',
          PRIMARY KEY (session_id, user_id)
        )
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS llm4writing_session_events (
          session_id TEXT NOT NULL REFERENCES llm4writing_sessions(id) ON DELETE CASCADE,
          event_type TEXT NOT NULL,
          event_key TEXT NOT NULL,
          payload JSONB NOT NULL,
          at TEXT NOT NULL,
          PRIMARY KEY (session_id, event_type, event_key)
        )
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS idx_llm4writing_session_events_session_type_at
        ON llm4writing_session_events (session_id, event_type, at)
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS llm4writing_session_participants (
          session_id TEXT NOT NULL REFERENCES llm4writing_sessions(id) ON DELETE CASCADE,
          username TEXT NOT NULL,
          activity_id TEXT,
          workflow TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          PRIMARY KEY (session_id, username)
        )
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS idx_llm4writing_session_participants_user_activity_created
        ON llm4writing_session_participants (username, activity_id, created_at DESC)
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS idx_llm4writing_session_participants_activity_created
        ON llm4writing_session_participants (activity_id, created_at DESC)
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS llm4writing_llm_events (
          id BIGSERIAL PRIMARY KEY,
          session_id TEXT,
          activity_id TEXT,
          step INTEGER,
          kind TEXT NOT NULL,
          latency_ms INTEGER,
          fallback_used BOOLEAN NOT NULL DEFAULT FALSE,
          error_category TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS idx_llm4writing_llm_events_created
        ON llm4writing_llm_events (created_at DESC)
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS idx_llm4writing_llm_events_activity_step_created
        ON llm4writing_llm_events (activity_id, step, created_at DESC)
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS llm4writing_learning_events (
          id BIGSERIAL PRIMARY KEY,
          session_id TEXT,
          activity_id TEXT,
          step INTEGER,
          kind TEXT NOT NULL,
          latency_ms INTEGER,
          fallback_used BOOLEAN NOT NULL DEFAULT FALSE,
          error_category TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS idx_llm4writing_learning_events_created
        ON llm4writing_learning_events (created_at DESC)
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS idx_llm4writing_learning_events_activity_step_created
        ON llm4writing_learning_events (activity_id, step, created_at DESC)
      `;
      await sql`
        INSERT INTO llm4writing_session_participants (session_id, username, activity_id, workflow, created_at)
        SELECT
          s.id,
          participant.username,
          COALESCE(s.activity_id, s.payload->>'activityId'),
          COALESCE(s.workflow, s.payload->>'workflow'),
          COALESCE(s.updated_at, s.created_at, NOW())
        FROM llm4writing_sessions s
        CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(s.payload->'participants', '[]'::jsonb)) AS participant(username)
        ON CONFLICT (session_id, username) DO UPDATE
        SET
          activity_id = EXCLUDED.activity_id,
          workflow = EXCLUDED.workflow
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

export async function getSessionStoreTableHealth(): Promise<{
  databaseEnabled: boolean;
  tables: Record<string, boolean>;
}> {
  if (!isDatabaseEnabled()) {
    return {
      databaseEnabled: false,
      tables: {
        llm4writing_sessions: false,
        llm4writing_session_messages: false,
        llm4writing_session_artifacts: false,
        llm4writing_session_reports: false,
        llm4writing_session_events: false,
        llm4writing_session_participants: false,
        llm4writing_llm_events: false,
        llm4writing_learning_events: false
      }
    };
  }
  await ensureSessionTable();
  const sql = getSqlClient();
  const rows = await sql<{ table_name: string }[]>`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN (
        'llm4writing_sessions',
        'llm4writing_session_messages',
        'llm4writing_session_artifacts',
        'llm4writing_session_reports',
        'llm4writing_session_events',
        'llm4writing_session_participants',
        'llm4writing_llm_events',
        'llm4writing_learning_events'
      )
  `;
  const present = new Set(rows.map((row) => row.table_name));
  return {
    databaseEnabled: true,
    tables: {
      llm4writing_sessions: present.has("llm4writing_sessions"),
      llm4writing_session_messages: present.has("llm4writing_session_messages"),
      llm4writing_session_artifacts: present.has("llm4writing_session_artifacts"),
      llm4writing_session_reports: present.has("llm4writing_session_reports"),
      llm4writing_session_events: present.has("llm4writing_session_events"),
      llm4writing_session_participants: present.has("llm4writing_session_participants"),
      llm4writing_llm_events: present.has("llm4writing_llm_events"),
      llm4writing_learning_events: present.has("llm4writing_learning_events")
    }
  };
}

type MessageRow = {
  session_id: string;
  message_id: string;
  idx: number;
  role: string;
  user_id: string | null;
  step: number;
  text: string;
  at: string;
};

type ArtifactRow = {
  session_id: string;
  user_id: string;
  outline: string;
  step3_submitted_outline: string;
  draft_step6: string;
  draft_step8: string;
};

type ReportRow = {
  session_id: string;
  user_id: string;
  step5_report: string;
  step7_report: string;
  step10_report: string;
};

type EventRow = {
  session_id: string;
  event_type: string;
  payload: unknown;
  at: string;
};

export type PersistedEventRow = {
  id: string;
  session_id: string | null;
  activity_id: string | null;
  step: number | null;
  kind: string;
  latency_ms: number | null;
  fallback_used: boolean;
  error_category: string | null;
  created_at: Date;
};

export type MonitorSessionSummary = {
  sessionId: string;
  activityId?: string;
  activityTitle?: string;
  groupId?: string;
  groupName?: string;
  participants: string[];
  joinedUsers: string[];
  currentStep: number;
  personalSteps: Record<string, number>;
  groupGate: Record<string, string[]>;
  stepState: {
    step1Substep: number;
    step2Substep: number;
    step1Substep3Question?: number;
    step1Substep4Question?: number;
    step2Substep1Question?: number;
  };
  reflectionIndex: Record<string, number>;
  qualitySignals: {
    rejectedAnswerCounts?: Record<string, number>;
    rejectedAnswerLastAt?: Record<string, string>;
  };
  artifactSignals: {
    outlineUpdatedAt?: Record<string, string>;
    draftStep6UpdatedAt?: Record<string, string>;
    draftStep8UpdatedAt?: Record<string, string>;
  };
  messageCount: number;
  lastMessageAt: string | null;
  studentMessageStats: Record<string, { count: number; lastMessageAt: string | null }>;
  artifactDiagnostics: {
    step3OutlineChars: Record<string, number>;
    draftStep6Chars: Record<string, number>;
  };
  stepReadyHints: {
    step1Ready: boolean;
    step2Ready: boolean;
  };
};

type MonitorSummaryBaseRow = {
  id: string;
  payload: unknown;
  activity_id: string | null;
  activity_title: string | null;
  group_id: string | null;
  group_name: string | null;
  current_step: number | null;
  message_count: number | null;
  last_message_at: Date | null;
  participants_json: unknown;
  joined_users_json: unknown;
  personal_steps_json: unknown;
  group_gate_json: unknown;
  step_state_json: unknown;
  reflection_index_json: unknown;
  quality_signals_json: unknown;
  artifact_signals_json: unknown;
};

type MonitorStudentMessageAggRow = {
  session_id: string;
  user_id: string;
  cnt: string;
  last_at: string | null;
};

type MonitorArtifactAggRow = {
  session_id: string;
  user_id: string;
  outline_len: number;
  draft6_len: number;
};

type MonitorStepReadyAggRow = {
  session_id: string;
  step1_ready: boolean;
  step2_ready: boolean;
};

type SessionPartsById = Record<string, {
  messages: ChatMessage[];
  outlines: Record<string, string>;
  step3SubmittedOutlines: Record<string, string>;
  draftStep6: Record<string, string>;
  draftStep8: Record<string, string>;
  reports: SessionState["reports"];
  step12RoundLogs: Step12RoundLog[];
  step12FallbackDebugTraces: Step12FallbackDebugTrace[];
}>;

function defaultSessionParts(): SessionPartsById[string] {
  return {
    messages: [],
    outlines: {},
    step3SubmittedOutlines: {},
    draftStep6: {},
    draftStep8: {},
    reports: createEmptyReports(),
    step12RoundLogs: [],
    step12FallbackDebugTraces: []
  };
}

async function replaceSessionSplitRows(sql: Sql | TransactionSql, session: SessionState): Promise<void> {
  await sql`DELETE FROM llm4writing_session_messages WHERE session_id = ${session.id}`;
  if (session.messages.length > 0) {
    const rows = session.messages.map((message, idx) => ({
      session_id: session.id,
      message_id: message.id,
      idx,
      role: message.role,
      user_id: message.userId ?? null,
      step: message.step,
      text: message.text,
      at: message.at
    }));
    await sql`INSERT INTO llm4writing_session_messages ${sql(rows)}`;
  }

  await sql`DELETE FROM llm4writing_session_artifacts WHERE session_id = ${session.id}`;
  const artifactUsers = new Set<string>([
    ...Object.keys(session.outlines ?? {}),
    ...Object.keys(session.step3SubmittedOutlines ?? {}),
    ...Object.keys(session.draftStep6 ?? {}),
    ...Object.keys(session.draftStep8 ?? {})
  ]);
  if (artifactUsers.size > 0) {
    const rows = Array.from(artifactUsers).map((userId) => ({
      session_id: session.id,
      user_id: userId,
      outline: session.outlines?.[userId] ?? "",
      step3_submitted_outline: session.step3SubmittedOutlines?.[userId] ?? "",
      draft_step6: session.draftStep6?.[userId] ?? "",
      draft_step8: session.draftStep8?.[userId] ?? ""
    }));
    await sql`INSERT INTO llm4writing_session_artifacts ${sql(rows)}`;
  }

  await sql`DELETE FROM llm4writing_session_reports WHERE session_id = ${session.id}`;
  const reportUsers = new Set<string>([
    ...Object.keys(session.reports?.step5 ?? {}),
    ...Object.keys(session.reports?.step7 ?? {}),
    ...Object.keys(session.reports?.step10 ?? {})
  ]);
  if (reportUsers.size > 0) {
    const rows = Array.from(reportUsers).map((userId) => ({
      session_id: session.id,
      user_id: userId,
      step5_report: session.reports?.step5?.[userId] ?? "",
      step7_report: session.reports?.step7?.[userId] ?? "",
      step10_report: session.reports?.step10?.[userId] ?? ""
    }));
    await sql`INSERT INTO llm4writing_session_reports ${sql(rows)}`;
  }

  await sql`
    DELETE FROM llm4writing_session_events
    WHERE session_id = ${session.id}
      AND event_type IN ('step12_round_log', 'step12_fallback_debug_trace')
  `;
  const logs = normalizeStep12RoundLogs(session.step12RoundLogs);
  if (logs.length > 0) {
    const rows = logs.map((log, idx) => ({
      session_id: session.id,
      event_type: "step12_round_log",
      event_key: `${idx}:${log.at}`,
      payload: JSON.stringify(log),
      at: log.at
    }));
    await sql`INSERT INTO llm4writing_session_events ${sql(rows)}`;
  }

  const fallbackDebugTraces = normalizeStep12FallbackDebugTraces(session.step12FallbackDebugTraces);
  if (fallbackDebugTraces.length > 0) {
    const rows = fallbackDebugTraces.map((trace, idx) => ({
      session_id: session.id,
      event_type: "step12_fallback_debug_trace",
      event_key: `${idx}:${trace.at}:${trace.kind}:${trace.step}`,
      payload: JSON.stringify(trace),
      at: trace.at
    }));
    await sql`INSERT INTO llm4writing_session_events ${sql(rows)}`;
  }
}

async function replaceSessionParticipantRows(sql: Sql | TransactionSql, session: SessionState): Promise<void> {
  await sql`DELETE FROM llm4writing_session_participants WHERE session_id = ${session.id}`;
  const participants = Array.from(new Set((session.participants ?? []).map((value) => value.trim()).filter(Boolean)));
  if (participants.length === 0) return;
  const rows = participants.map((username) => ({
    session_id: session.id,
    username,
    activity_id: session.activityId ?? null,
    workflow: session.workflow ?? null,
    created_at: session.createdAt
  }));
  await sql`INSERT INTO llm4writing_session_participants ${sql(rows)}`;
}

function mergeLegacyPayloadParts(session: SessionState, parts: SessionPartsById[string]): SessionPartsById[string] {
  return {
    messages: parts.messages.length > 0 ? parts.messages : (session.messages ?? []),
    outlines: Object.keys(parts.outlines).length > 0 ? parts.outlines : (session.outlines ?? {}),
    step3SubmittedOutlines: Object.keys(parts.step3SubmittedOutlines).length > 0
      ? parts.step3SubmittedOutlines
      : (session.step3SubmittedOutlines ?? {}),
    draftStep6: Object.keys(parts.draftStep6).length > 0 ? parts.draftStep6 : (session.draftStep6 ?? {}),
    draftStep8: Object.keys(parts.draftStep8).length > 0 ? parts.draftStep8 : (session.draftStep8 ?? {}),
    reports:
      Object.keys(parts.reports.step5).length > 0 ||
      Object.keys(parts.reports.step7).length > 0 ||
      Object.keys(parts.reports.step10).length > 0
        ? parts.reports
        : (session.reports ?? createEmptyReports()),
    step12RoundLogs: parts.step12RoundLogs.length > 0 ? parts.step12RoundLogs : normalizeStep12RoundLogs(session.step12RoundLogs),
    step12FallbackDebugTraces:
      parts.step12FallbackDebugTraces.length > 0
        ? parts.step12FallbackDebugTraces
        : normalizeStep12FallbackDebugTraces(session.step12FallbackDebugTraces)
  };
}

async function fetchSessionPartsByIds(sql: Sql | TransactionSql, sessionIds: string[]): Promise<SessionPartsById> {
  const result: SessionPartsById = {};
  if (sessionIds.length === 0) return result;
  for (const id of sessionIds) result[id] = defaultSessionParts();

  const messageRows = await sql<MessageRow[]>`
    SELECT session_id, message_id, idx, role, user_id, step, text, at
    FROM llm4writing_session_messages
    WHERE session_id IN ${sql(sessionIds)}
    ORDER BY session_id ASC, idx ASC
  `;
  for (const row of messageRows) {
    result[row.session_id] ??= defaultSessionParts();
    result[row.session_id].messages.push({
      id: row.message_id,
      role: (row.role as ChatMessage["role"]) ?? "system",
      userId: row.user_id ?? undefined,
      text: row.text,
      at: row.at,
      step: row.step
    });
  }

  const artifactRows = await sql<ArtifactRow[]>`
    SELECT session_id, user_id, outline, step3_submitted_outline, draft_step6, draft_step8
    FROM llm4writing_session_artifacts
    WHERE session_id IN ${sql(sessionIds)}
  `;
  for (const row of artifactRows) {
    result[row.session_id] ??= defaultSessionParts();
    if (row.outline) result[row.session_id].outlines[row.user_id] = row.outline;
    if (row.step3_submitted_outline) result[row.session_id].step3SubmittedOutlines[row.user_id] = row.step3_submitted_outline;
    if (row.draft_step6) result[row.session_id].draftStep6[row.user_id] = row.draft_step6;
    if (row.draft_step8) result[row.session_id].draftStep8[row.user_id] = row.draft_step8;
  }

  const reportRows = await sql<ReportRow[]>`
    SELECT session_id, user_id, step5_report, step7_report, step10_report
    FROM llm4writing_session_reports
    WHERE session_id IN ${sql(sessionIds)}
  `;
  for (const row of reportRows) {
    result[row.session_id] ??= defaultSessionParts();
    if (row.step5_report) result[row.session_id].reports.step5[row.user_id] = row.step5_report;
    if (row.step7_report) result[row.session_id].reports.step7[row.user_id] = row.step7_report;
    if (row.step10_report) result[row.session_id].reports.step10[row.user_id] = row.step10_report;
  }

  const eventRows = await sql<EventRow[]>`
    SELECT session_id, event_type, payload, at
    FROM llm4writing_session_events
    WHERE session_id IN ${sql(sessionIds)} AND event_type IN ('step12_round_log', 'step12_fallback_debug_trace')
    ORDER BY session_id ASC, at ASC
  `;
  for (const row of eventRows) {
    result[row.session_id] ??= defaultSessionParts();
    const payload = typeof row.payload === "string" ? JSON.parse(row.payload) : row.payload;
    if (!payload || typeof payload !== "object") continue;
    if (row.event_type === "step12_round_log") {
      result[row.session_id].step12RoundLogs.push(payload as Step12RoundLog);
      continue;
    }
    if (row.event_type === "step12_fallback_debug_trace") {
      result[row.session_id].step12FallbackDebugTraces.push(payload as Step12FallbackDebugTrace);
    }
  }

  return result;
}

export async function saveSession(session: SessionState): Promise<SessionState> {
  if (!isDatabaseEnabled()) {
    getMemoryStore().set(session.id, session);
    const nextVersion = (memoryVersion.get(session.id) ?? 0) + 1;
    const nextUpdatedAt = new Date().toISOString();
    memoryVersion.set(session.id, nextVersion);
    memoryUpdatedAt.set(session.id, nextUpdatedAt);
    return attachSessionStoreMeta(session, nextVersion, nextUpdatedAt);
  }

  await ensureSessionTable();
  const client = getSqlClient();
  let expectedVersion = readSessionStoreVersion(session);
  let candidate = session;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const result = await client.begin(async (sql) => {
        const existingRows = await sql<{ version: number; payload: unknown; updated_at: Date }[]>`
          SELECT version, payload, updated_at
          FROM llm4writing_sessions
          WHERE id = ${candidate.id}
          FOR UPDATE
        `;
        const existing = existingRows[0];
        if (!existing) {
          const summary = buildSessionSummaryColumns(candidate);
          const corePayload = buildSessionCorePayload(candidate);
          const insertedRows = await sql<{ version: number; updated_at: Date }[]>`
            INSERT INTO llm4writing_sessions (
              id,
              payload,
              version,
              current_step,
              workflow,
              activity_id,
              group_id,
              message_count,
              last_message_at,
              participant_count
            )
            VALUES (
              ${candidate.id},
              ${JSON.stringify(corePayload)}::jsonb,
              1,
              ${summary.currentStep},
              ${summary.workflow},
              ${summary.activityId},
              ${summary.groupId},
              ${summary.messageCount},
              ${summary.lastMessageAt},
              ${summary.participantCount}
            )
            RETURNING version, updated_at
          `;
          await replaceSessionSplitRows(sql, candidate);
          await replaceSessionParticipantRows(sql, candidate);
          return {
            version: insertedRows[0]?.version ?? 1,
            updatedAt: insertedRows[0]?.updated_at?.toISOString() ?? new Date().toISOString()
          };
        }

        if (typeof expectedVersion === "number" && existing.version !== expectedVersion) {
          throw new SessionVersionConflictError();
        }

        const summary = buildSessionSummaryColumns(candidate);
        const corePayload = buildSessionCorePayload(candidate);
        const updatedRows = await sql<{ version: number; updated_at: Date }[]>`
          UPDATE llm4writing_sessions
          SET
            payload = ${JSON.stringify(corePayload)}::jsonb,
            current_step = ${summary.currentStep},
            workflow = ${summary.workflow},
            activity_id = ${summary.activityId},
            group_id = ${summary.groupId},
            message_count = ${summary.messageCount},
            last_message_at = ${summary.lastMessageAt},
            participant_count = ${summary.participantCount},
            version = version + 1,
            updated_at = NOW()
          WHERE id = ${candidate.id}
          RETURNING version, updated_at
        `;
        await replaceSessionSplitRows(sql, candidate);
        await replaceSessionParticipantRows(sql, candidate);
        return {
          version: updatedRows[0]?.version ?? existing.version + 1,
          updatedAt: updatedRows[0]?.updated_at?.toISOString() ?? new Date().toISOString()
        };
      });
      return attachSessionStoreMeta(candidate, result.version, result.updatedAt);
    } catch (error) {
      if (!(error instanceof SessionVersionConflictError) || attempt > 0) {
        throw error;
      }
      const latest = await getSession(candidate.id);
      if (!latest) {
        throw error;
      }
      candidate = mergeSessionStates(latest, candidate);
      expectedVersion = readSessionStoreVersion(latest);
    }
  }

  return candidate;
}

export type SessionWithMeta = {
  session: SessionState;
  updatedAt: string;
  version: number;
};

/** Like getSession but also returns the DB-level updatedAt for ETag computation.
 *  Wrapped with React cache() for request-level memoization — same sessionId
 *  only hits the DB once per request even if called from multiple code paths. */
export const getSessionWithMeta = cache(async (sessionId: string): Promise<SessionWithMeta | undefined> => {
  if (!isDatabaseEnabled()) {
    const session = getMemoryStore().get(sessionId);
    if (!session) return undefined;
    const version = memoryVersion.get(sessionId) ?? 1;
    const updatedAt = memoryUpdatedAt.get(sessionId) ?? session.createdAt;
    return { session: attachSessionStoreMeta(session, version, updatedAt), updatedAt, version };
  }

  await ensureSessionTable();
  const sql = getSqlClient();

  const rows = await sql<{ payload: unknown; updated_at: Date; version: number }[]>`
    SELECT payload, updated_at, version
    FROM llm4writing_sessions
    WHERE id = ${sessionId}
    LIMIT 1
  `;

  if (!rows[0]) return undefined;
  const core = normalizeSessionPayload(rows[0].payload);
  if (!core) return undefined;
  const partsMap = await fetchSessionPartsByIds(sql, [sessionId]);
  const mergedParts = mergeLegacyPayloadParts(core, partsMap[sessionId] ?? defaultSessionParts());
  const session = mergeSessionParts(buildSessionCorePayload(core) as SessionCorePayload, mergedParts);
  const updatedAt = rows[0].updated_at.toISOString();
  const version = rows[0].version ?? 1;
  return { session: attachSessionStoreMeta(session, version, updatedAt), updatedAt, version };
});

export async function getSession(sessionId: string): Promise<SessionState | undefined> {
  return (await getSessionWithMeta(sessionId))?.session;
}

export async function listSessions(opts?: { limit?: number; offset?: number }): Promise<SessionState[]> {
  const limit = typeof opts?.limit === "number" && opts.limit > 0 ? opts.limit : undefined;
  const offset = typeof opts?.offset === "number" && opts.offset >= 0 ? opts.offset : 0;

  if (!isDatabaseEnabled()) {
    const all = Array.from(getMemoryStore().values());
    const sliced = limit !== undefined ? all.slice(offset, offset + limit) : all.slice(offset);
    return sliced.map((session) =>
      attachSessionStoreMeta(
        session,
        memoryVersion.get(session.id) ?? 1,
        memoryUpdatedAt.get(session.id) ?? session.createdAt
      )
    );
  }

  await ensureSessionTable();
  const sql = getSqlClient();

  if (limit !== undefined) {
    const rows = await sql<{ id: string; payload: unknown; updated_at: Date; version: number }[]>`
      SELECT id, payload, updated_at, version
      FROM llm4writing_sessions
      ORDER BY updated_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
    const sessionIds = rows.map((row) => row.id);
    const partsById = await fetchSessionPartsByIds(sql, sessionIds);
    return rows
      .map((row) => {
        const core = normalizeSessionPayload(row.payload);
        if (!core) return undefined;
        const mergedParts = mergeLegacyPayloadParts(core, partsById[row.id] ?? defaultSessionParts());
        const rebuilt = mergeSessionParts(buildSessionCorePayload(core) as SessionCorePayload, mergedParts);
        return attachSessionStoreMeta(rebuilt, row.version ?? 1, row.updated_at.toISOString());
      })
      .filter((item): item is SessionState => Boolean(item));
  }

  const rows = await sql<{ id: string; payload: unknown; updated_at: Date; version: number }[]>`
    SELECT id, payload, updated_at, version
    FROM llm4writing_sessions
    ORDER BY updated_at DESC
    OFFSET ${offset}
  `;
  const sessionIds = rows.map((row) => row.id);
  const partsById = await fetchSessionPartsByIds(sql, sessionIds);
  return rows
    .map((row) => {
      const core = normalizeSessionPayload(row.payload);
      if (!core) return undefined;
      const mergedParts = mergeLegacyPayloadParts(core, partsById[row.id] ?? defaultSessionParts());
      const rebuilt = mergeSessionParts(buildSessionCorePayload(core) as SessionCorePayload, mergedParts);
      return attachSessionStoreMeta(rebuilt, row.version ?? 1, row.updated_at.toISOString());
    })
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
    return {
      sessions: scoped.slice(offset, offset + limit).map((session) =>
        attachSessionStoreMeta(
          session,
          memoryVersion.get(session.id) ?? 1,
          memoryUpdatedAt.get(session.id) ?? session.createdAt
        )
      ),
      total: scoped.length
    };
  }

  await ensureSessionTable();
  const sql = getSqlClient();
  const rows = await sql<{ id: string; payload: unknown; updated_at: Date; version: number }[]>`
    SELECT id, payload, updated_at, version
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

  const sessionIds = rows.map((row) => row.id);
  const partsById = await fetchSessionPartsByIds(sql, sessionIds);
  return {
    sessions: rows
      .map((row) => {
        const core = normalizeSessionPayload(row.payload);
        if (!core) return undefined;
        const mergedParts = mergeLegacyPayloadParts(core, partsById[row.id] ?? defaultSessionParts());
        const rebuilt = mergeSessionParts(buildSessionCorePayload(core) as SessionCorePayload, mergedParts);
        return attachSessionStoreMeta(rebuilt, row.version ?? 1, row.updated_at.toISOString());
      })
      .filter((item): item is SessionState => Boolean(item)),
    total: parseInt(countRows[0]?.count ?? "0", 10)
  };
}

export async function listMonitorSessionSummariesByActivityId(
  activityId: string,
  opts?: { limit?: number; offset?: number }
): Promise<{ sessions: MonitorSessionSummary[]; total: number }> {
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
    const sessions = scoped.slice(offset, offset + limit).map((session) => {
      const studentMessageStats: Record<string, { count: number; lastMessageAt: string | null }> = {};
      session.participants.forEach((participant) => {
        const own = session.messages.filter((message) => message.role === "student" && message.userId === participant);
        studentMessageStats[participant] = {
          count: own.length,
          lastMessageAt: own.at(-1)?.at ?? null
        };
      });
      return {
        sessionId: session.id,
        activityId: session.activityId,
        activityTitle: session.activityTitle,
        groupId: session.groupId,
        groupName: session.groupName,
        participants: session.participants,
        joinedUsers: session.joinedUsers ?? [],
        currentStep: session.currentStep,
        personalSteps: session.personalSteps ?? {},
        groupGate: session.groupGate ?? {},
        stepState: session.stepState ?? { step1Substep: 1, step2Substep: 1 },
        reflectionIndex: session.reflectionIndex ?? {},
        qualitySignals: session.qualitySignals ?? { rejectedAnswerCounts: {}, rejectedAnswerLastAt: {} },
        artifactSignals: session.artifactSignals ?? { outlineUpdatedAt: {}, draftStep6UpdatedAt: {}, draftStep8UpdatedAt: {} },
        messageCount: session.messages.length,
        lastMessageAt: session.messages.at(-1)?.at ?? session.createdAt ?? null,
        studentMessageStats,
        artifactDiagnostics: {
          step3OutlineChars: Object.fromEntries(
            Object.entries(session.outlines ?? {}).map(([userId, outline]) => [userId, outline.length])
          ),
          draftStep6Chars: Object.fromEntries(
            Object.entries(session.draftStep6 ?? {}).map(([userId, draft]) => [userId, draft.length])
          )
        },
        stepReadyHints: {
          step1Ready: session.messages.some(
            (message) => message.step === 1 && message.role === "system" && message.text.includes("步驟 1 子步驟已完成，等待教師切換下一步")
          ),
          step2Ready: session.messages.some(
            (message) => message.step === 2 && message.role === "system" && message.text.includes("步驟 2 子步驟已完成，等待教師切換下一步")
          )
        }
      };
    });
    return { sessions, total: scoped.length };
  }

  await ensureSessionTable();
  const sql = getSqlClient();
  const rows = await sql<MonitorSummaryBaseRow[]>`
    SELECT
      id,
      payload,
      activity_id,
      group_id,
      current_step,
      message_count,
      last_message_at,
      COALESCE(payload->>'activityTitle', payload->>'activityId') AS activity_title,
      COALESCE(payload->>'groupName', payload->>'groupId') AS group_name,
      COALESCE(payload->'participants', '[]'::jsonb) AS participants_json,
      COALESCE(payload->'joinedUsers', '[]'::jsonb) AS joined_users_json,
      COALESCE(payload->'personalSteps', '{}'::jsonb) AS personal_steps_json,
      COALESCE(payload->'groupGate', '{}'::jsonb) AS group_gate_json,
      COALESCE(payload->'stepState', '{}'::jsonb) AS step_state_json,
      COALESCE(payload->'reflectionIndex', '{}'::jsonb) AS reflection_index_json,
      COALESCE(payload->'qualitySignals', '{}'::jsonb) AS quality_signals_json,
      COALESCE(payload->'artifactSignals', '{}'::jsonb) AS artifact_signals_json
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

  const sessionIds = rows.map((row) => row.id);
  const participantsMap = new Map<string, string[]>();
  const studentMessageStatsMap = new Map<string, Record<string, { count: number; lastMessageAt: string | null }>>();
  const artifactDiagnosticsMap = new Map<string, { step3OutlineChars: Record<string, number>; draftStep6Chars: Record<string, number> }>();
  const stepReadyHintsMap = new Map<string, { step1Ready: boolean; step2Ready: boolean }>();

  if (sessionIds.length > 0) {
    const participantRows = await sql<{ session_id: string; username: string }[]>`
      SELECT session_id, username
      FROM llm4writing_session_participants
      WHERE session_id IN ${sql(sessionIds)}
      ORDER BY created_at ASC, username ASC
    `;
    for (const row of participantRows) {
      const bucket = participantsMap.get(row.session_id) ?? [];
      if (!bucket.includes(row.username)) bucket.push(row.username);
      participantsMap.set(row.session_id, bucket);
    }

    const messageAggRows = await sql<MonitorStudentMessageAggRow[]>`
      SELECT session_id, user_id, COUNT(*)::text AS cnt, MAX(at) AS last_at
      FROM llm4writing_session_messages
      WHERE session_id IN ${sql(sessionIds)}
        AND role = 'student'
        AND user_id IS NOT NULL
      GROUP BY session_id, user_id
    `;
    for (const row of messageAggRows) {
      const bucket = studentMessageStatsMap.get(row.session_id) ?? {};
      bucket[row.user_id] = {
        count: parseInt(row.cnt, 10) || 0,
        lastMessageAt: row.last_at ?? null
      };
      studentMessageStatsMap.set(row.session_id, bucket);
    }

    const artifactAggRows = await sql<MonitorArtifactAggRow[]>`
      SELECT session_id, user_id, LENGTH(outline) AS outline_len, LENGTH(draft_step6) AS draft6_len
      FROM llm4writing_session_artifacts
      WHERE session_id IN ${sql(sessionIds)}
    `;
    for (const row of artifactAggRows) {
      const bucket = artifactDiagnosticsMap.get(row.session_id) ?? { step3OutlineChars: {}, draftStep6Chars: {} };
      bucket.step3OutlineChars[row.user_id] = Math.max(0, row.outline_len ?? 0);
      bucket.draftStep6Chars[row.user_id] = Math.max(0, row.draft6_len ?? 0);
      artifactDiagnosticsMap.set(row.session_id, bucket);
    }

    const readyAggRows = await sql<MonitorStepReadyAggRow[]>`
      SELECT
        session_id,
        BOOL_OR(step = 1 AND role = 'system' AND text LIKE '%步驟 1 子步驟已完成，等待教師切換下一步%') AS step1_ready,
        BOOL_OR(step = 2 AND role = 'system' AND text LIKE '%步驟 2 子步驟已完成，等待教師切換下一步%') AS step2_ready
      FROM llm4writing_session_messages
      WHERE session_id IN ${sql(sessionIds)}
      GROUP BY session_id
    `;
    for (const row of readyAggRows) {
      stepReadyHintsMap.set(row.session_id, {
        step1Ready: Boolean(row.step1_ready),
        step2Ready: Boolean(row.step2_ready)
      });
    }
  }

  const sessions: MonitorSessionSummary[] = rows.map((row) => {
    const payload = normalizeSessionPayload(row.payload);
    const participants = asStringArray(row.participants_json);
    const joinedUsers = asStringArray(row.joined_users_json);
    const participantFallback = participantsMap.get(row.id) ?? [];
    const stepStateRaw = asRecord(row.step_state_json);
    const payloadStepState = asRecord(payload?.stepState);
    const effectiveStepStateRaw = Object.keys(stepStateRaw).length > 0 ? stepStateRaw : payloadStepState;
    const stepState: MonitorSessionSummary["stepState"] = {
      step1Substep: Math.max(1, Number(effectiveStepStateRaw.step1Substep ?? 1) || 1),
      step2Substep: Math.max(1, Number(effectiveStepStateRaw.step2Substep ?? 1) || 1)
    };
    if (Number.isFinite(Number(effectiveStepStateRaw.step1Substep3Question))) stepState.step1Substep3Question = Number(effectiveStepStateRaw.step1Substep3Question);
    if (Number.isFinite(Number(effectiveStepStateRaw.step1Substep4Question))) stepState.step1Substep4Question = Number(effectiveStepStateRaw.step1Substep4Question);
    if (Number.isFinite(Number(effectiveStepStateRaw.step2Substep1Question))) stepState.step2Substep1Question = Number(effectiveStepStateRaw.step2Substep1Question);

    const qualitySignalsJson = asRecord(row.quality_signals_json);
    const payloadQualitySignals = asRecord(payload?.qualitySignals);
    const qualitySignalsRaw = Object.keys(qualitySignalsJson).length > 0 ? qualitySignalsJson : payloadQualitySignals;
    const artifactSignalsJson = asRecord(row.artifact_signals_json);
    const payloadArtifactSignals = asRecord(payload?.artifactSignals);
    const artifactSignalsRaw = Object.keys(artifactSignalsJson).length > 0 ? artifactSignalsJson : payloadArtifactSignals;

    return {
      sessionId: row.id,
      activityId: row.activity_id ?? payload?.activityId ?? undefined,
      activityTitle: row.activity_title ?? payload?.activityTitle ?? payload?.activityId ?? undefined,
      groupId: row.group_id ?? payload?.groupId ?? undefined,
      groupName: row.group_name ?? payload?.groupName ?? payload?.groupId ?? undefined,
      participants: participants.length > 0 ? participants : (payload?.participants ?? participantFallback),
      joinedUsers: joinedUsers.length > 0 ? joinedUsers : (payload?.joinedUsers ?? participantFallback),
      currentStep: row.current_step ?? payload?.currentStep ?? 1,
      personalSteps: Object.keys(asNumberRecord(row.personal_steps_json)).length > 0 ? asNumberRecord(row.personal_steps_json) : asNumberRecord(payload?.personalSteps),
      groupGate: Object.keys(asStringArrayRecord(row.group_gate_json)).length > 0 ? asStringArrayRecord(row.group_gate_json) : asStringArrayRecord(payload?.groupGate),
      stepState,
      reflectionIndex: Object.keys(asNumberRecord(row.reflection_index_json)).length > 0 ? asNumberRecord(row.reflection_index_json) : asNumberRecord(payload?.reflectionIndex),
      qualitySignals: {
        rejectedAnswerCounts: asNumberRecord(qualitySignalsRaw.rejectedAnswerCounts),
        rejectedAnswerLastAt: asStringRecord(qualitySignalsRaw.rejectedAnswerLastAt)
      },
      artifactSignals: {
        outlineUpdatedAt: asStringRecord(artifactSignalsRaw.outlineUpdatedAt),
        draftStep6UpdatedAt: asStringRecord(artifactSignalsRaw.draftStep6UpdatedAt),
        draftStep8UpdatedAt: asStringRecord(artifactSignalsRaw.draftStep8UpdatedAt)
      },
      messageCount: row.message_count ?? 0,
      lastMessageAt: row.last_message_at?.toISOString() ?? null,
      studentMessageStats: studentMessageStatsMap.get(row.id) ?? {},
      artifactDiagnostics: artifactDiagnosticsMap.get(row.id) ?? { step3OutlineChars: {}, draftStep6Chars: {} },
      stepReadyHints: stepReadyHintsMap.get(row.id) ?? { step1Ready: false, step2Ready: false }
    };
  });

  return {
    sessions,
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

function normalizeEventLatency(latencyMs: number | undefined): number | null {
  if (typeof latencyMs !== "number" || !Number.isFinite(latencyMs)) return null;
  if (latencyMs < 0) return 0;
  return Math.round(latencyMs);
}

function normalizeEventStep(step: number | undefined): number | null {
  if (typeof step !== "number" || !Number.isFinite(step)) return null;
  return Math.max(0, Math.round(step));
}

function normalizeEventCreatedAt(createdAt?: string): string {
  if (!createdAt) return new Date().toISOString();
  const parsed = new Date(createdAt);
  if (!Number.isFinite(parsed.getTime())) return new Date().toISOString();
  return parsed.toISOString();
}

export async function recordLlmEvent(input: PersistedEventInput): Promise<void> {
  const createdAt = normalizeEventCreatedAt(input.createdAt);
  if (!isDatabaseEnabled()) return;
  await ensureSessionTable();
  const sql = getSqlClient();
  await sql`
    INSERT INTO llm4writing_llm_events (
      session_id,
      activity_id,
      step,
      kind,
      latency_ms,
      fallback_used,
      error_category,
      created_at
    )
    VALUES (
      ${input.sessionId ?? null},
      ${input.activityId ?? null},
      ${normalizeEventStep(input.step)},
      ${input.kind},
      ${normalizeEventLatency(input.latencyMs)},
      ${Boolean(input.fallbackUsed)},
      ${input.errorCategory ?? null},
      ${createdAt}::timestamptz
    )
  `;
}

export async function recordLearningEvent(input: PersistedEventInput): Promise<void> {
  const createdAt = normalizeEventCreatedAt(input.createdAt);
  if (!isDatabaseEnabled()) return;
  await ensureSessionTable();
  const sql = getSqlClient();
  await sql`
    INSERT INTO llm4writing_learning_events (
      session_id,
      activity_id,
      step,
      kind,
      latency_ms,
      fallback_used,
      error_category,
      created_at
    )
    VALUES (
      ${input.sessionId ?? null},
      ${input.activityId ?? null},
      ${normalizeEventStep(input.step)},
      ${input.kind},
      ${normalizeEventLatency(input.latencyMs)},
      ${Boolean(input.fallbackUsed)},
      ${input.errorCategory ?? null},
      ${createdAt}::timestamptz
    )
  `;
}

export async function listLlmEventsSince(cutoffIso: string): Promise<PersistedEventRow[]> {
  if (!isDatabaseEnabled()) return [];
  await ensureSessionTable();
  const sql = getSqlClient();
  return sql<PersistedEventRow[]>`
    SELECT id::text, session_id, activity_id, step, kind, latency_ms, fallback_used, error_category, created_at
    FROM llm4writing_llm_events
    WHERE created_at >= ${cutoffIso}::timestamptz
    ORDER BY created_at ASC
  `;
}

export async function listLearningEventsSince(cutoffIso: string): Promise<PersistedEventRow[]> {
  if (!isDatabaseEnabled()) return [];
  await ensureSessionTable();
  const sql = getSqlClient();
  return sql<PersistedEventRow[]>`
    SELECT id::text, session_id, activity_id, step, kind, latency_ms, fallback_used, error_category, created_at
    FROM llm4writing_learning_events
    WHERE created_at >= ${cutoffIso}::timestamptz
    ORDER BY created_at ASC
  `;
}

export async function listSessionsByParticipant(
  username: string,
  opts?: { activityId?: string; workflow?: string; limit?: number; offset?: number }
): Promise<SessionState[]> {
  const trimmedUsername = username.trim();
  if (!trimmedUsername) return [];

  const activityId = opts?.activityId?.trim();
  const workflow = opts?.workflow?.trim();
  const limit = typeof opts?.limit === "number" && opts.limit > 0 ? opts.limit : undefined;
  const offset = typeof opts?.offset === "number" && opts.offset >= 0 ? opts.offset : 0;

  if (!isDatabaseEnabled()) {
    return Array.from(getMemoryStore().values())
      .filter((session) => session.participants.includes(trimmedUsername))
      .filter((session) => (activityId ? session.activityId === activityId : true))
      .filter((session) => (workflow ? session.workflow === workflow : true))
      .sort((a, b) => {
        const aLast = memoryUpdatedAt.get(a.id) ?? a.messages.at(-1)?.at ?? a.createdAt;
        const bLast = memoryUpdatedAt.get(b.id) ?? b.messages.at(-1)?.at ?? b.createdAt;
        return bLast.localeCompare(aLast);
      })
      .slice(offset, limit !== undefined ? offset + limit : undefined)
      .map((session) =>
        attachSessionStoreMeta(
          session,
          memoryVersion.get(session.id) ?? 1,
          memoryUpdatedAt.get(session.id) ?? session.createdAt
        )
      );
  }

  await ensureSessionTable();
  const sql = getSqlClient();
  const rows =
    limit !== undefined
      ? await sql<{ id: string; payload: unknown; updated_at: Date; version: number }[]>`
          SELECT s.id, s.payload, s.updated_at, s.version
          FROM llm4writing_session_participants p
          INNER JOIN llm4writing_sessions s ON s.id = p.session_id
          WHERE p.username = ${trimmedUsername}
            AND (${activityId ?? null}::text IS NULL OR p.activity_id = ${activityId ?? null})
            AND (${workflow ?? null}::text IS NULL OR p.workflow = ${workflow ?? null})
          ORDER BY s.updated_at DESC
          LIMIT ${limit} OFFSET ${offset}
        `
      : await sql<{ id: string; payload: unknown; updated_at: Date; version: number }[]>`
          SELECT s.id, s.payload, s.updated_at, s.version
          FROM llm4writing_session_participants p
          INNER JOIN llm4writing_sessions s ON s.id = p.session_id
          WHERE p.username = ${trimmedUsername}
            AND (${activityId ?? null}::text IS NULL OR p.activity_id = ${activityId ?? null})
            AND (${workflow ?? null}::text IS NULL OR p.workflow = ${workflow ?? null})
          ORDER BY s.updated_at DESC
          OFFSET ${offset}
        `;

  // Backward-compatible DB fallback:
  // Some legacy rows may miss participant-index entries even though payload/messages
  // indicate the student has participated. When index query returns empty, fallback
  // to a direct session scan scoped to this user.
  const recoveredRows =
    rows.length > 0
      ? rows
      : limit !== undefined
        ? await sql<{ id: string; payload: unknown; updated_at: Date; version: number }[]>`
            SELECT s.id, s.payload, s.updated_at, s.version
            FROM llm4writing_sessions s
            WHERE (
              COALESCE(s.payload->'participants', '[]'::jsonb) ? ${trimmedUsername}
              OR EXISTS (
                SELECT 1
                FROM llm4writing_session_messages m
                WHERE m.session_id = s.id
                  AND m.role = 'student'
                  AND m.user_id = ${trimmedUsername}
              )
              OR EXISTS (
                SELECT 1
                FROM jsonb_array_elements(COALESCE(s.payload->'messages', '[]'::jsonb)) AS msg
                WHERE msg->>'role' = 'student'
                  AND msg->>'userId' = ${trimmedUsername}
              )
            )
              AND (${activityId ?? null}::text IS NULL OR COALESCE(s.activity_id, s.payload->>'activityId') = ${activityId ?? null})
              AND (${workflow ?? null}::text IS NULL OR COALESCE(s.workflow, s.payload->>'workflow') = ${workflow ?? null})
            ORDER BY s.updated_at DESC
            LIMIT ${limit} OFFSET ${offset}
          `
        : await sql<{ id: string; payload: unknown; updated_at: Date; version: number }[]>`
            SELECT s.id, s.payload, s.updated_at, s.version
            FROM llm4writing_sessions s
            WHERE (
              COALESCE(s.payload->'participants', '[]'::jsonb) ? ${trimmedUsername}
              OR EXISTS (
                SELECT 1
                FROM llm4writing_session_messages m
                WHERE m.session_id = s.id
                  AND m.role = 'student'
                  AND m.user_id = ${trimmedUsername}
              )
              OR EXISTS (
                SELECT 1
                FROM jsonb_array_elements(COALESCE(s.payload->'messages', '[]'::jsonb)) AS msg
                WHERE msg->>'role' = 'student'
                  AND msg->>'userId' = ${trimmedUsername}
              )
            )
              AND (${activityId ?? null}::text IS NULL OR COALESCE(s.activity_id, s.payload->>'activityId') = ${activityId ?? null})
              AND (${workflow ?? null}::text IS NULL OR COALESCE(s.workflow, s.payload->>'workflow') = ${workflow ?? null})
            ORDER BY s.updated_at DESC
            OFFSET ${offset}
          `;

  const sessionIds = recoveredRows.map((row) => row.id);
  const partsById = await fetchSessionPartsByIds(sql, sessionIds);
  return recoveredRows
    .map((row) => {
      const core = normalizeSessionPayload(row.payload);
      if (!core) return undefined;
      const mergedParts = mergeLegacyPayloadParts(core, partsById[row.id] ?? defaultSessionParts());
      const rebuilt = mergeSessionParts(buildSessionCorePayload(core) as SessionCorePayload, mergedParts);
      return attachSessionStoreMeta(rebuilt, row.version ?? 1, row.updated_at.toISOString());
    })
    .filter((item): item is SessionState => Boolean(item));
}

export function getStorageMode(): "postgres" | "memory" {
  return isDatabaseEnabled() ? "postgres" : "memory";
}
