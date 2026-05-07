import postgres, { Sql } from "postgres";
import { UserAccount } from "@/src/lib/types";
import { getDatabaseUrl, getPostgresClientOptions, isDatabaseEnabled } from "@/src/lib/db-config";

type StoredUser = UserAccount & { password: string };
type MemoryUserStore = Map<string, StoredUser>;

const KEY = "__llm4writing_users__";

const defaultUsers: StoredUser[] = [
  { username: "admin", name: "System Admin", school: "Demo High", role: "admin", password: "admin123" },
  { username: "teacher", name: "Teacher One", school: "Demo High", role: "teacher", password: "teacher123" },
  {
    username: "student",
    name: "Student One",
    school: "Demo High",
    role: "student",
    ownerTeacherUsername: "teacher",
    classNumber: "701",
    password: "student123"
  },
  {
    username: "s1",
    name: "S1",
    school: "Demo High",
    role: "student",
    ownerTeacherUsername: "teacher",
    classNumber: "701",
    password: "student123"
  },
  {
    username: "s2",
    name: "S2",
    school: "Demo High",
    role: "student",
    ownerTeacherUsername: "teacher",
    classNumber: "701",
    password: "student123"
  },
  {
    username: "s3",
    name: "S3",
    school: "Demo High",
    role: "student",
    ownerTeacherUsername: "teacher",
    classNumber: "702",
    password: "student123"
  }
];

function getMemoryStore(): MemoryUserStore {
  const globalScope = globalThis as unknown as Record<string, MemoryUserStore | undefined>;
  if (!globalScope[KEY]) {
    const seeded = new Map<string, StoredUser>();
    defaultUsers.forEach((user) => seeded.set(user.username, { ...user }));
    globalScope[KEY] = seeded;
  }
  return globalScope[KEY] as MemoryUserStore;
}

let sqlClient: Sql | undefined;

function getSqlClient(): Sql {
  if (!sqlClient) {
    const url = getDatabaseUrl();
    if (!url) throw new Error("postgres_url_missing");
    sqlClient = postgres(url, getPostgresClientOptions(url));
  }
  return sqlClient;
}

let initPromise: Promise<void> | undefined;

function isPermissionLikeError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const record = error as { code?: unknown; message?: unknown };
  const code = typeof record.code === "string" ? record.code : "";
  const message = typeof record.message === "string" ? record.message.toLowerCase() : "";
  return code === "42501" || message.includes("permission denied");
}

async function retryOnce<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch {
    await new Promise((resolve) => setTimeout(resolve, 120));
    return fn();
  }
}

async function ensureUserTable(): Promise<void> {
  if (!isDatabaseEnabled()) return;

  if (!initPromise) {
    initPromise = (async () => {
      const sql = getSqlClient();
      const existing = await sql<{ regclass: string | null }[]>`
        SELECT COALESCE(to_regclass('llm4writing_users')::text, to_regclass('public.llm4writing_users')::text) AS regclass
      `;
      if (existing[0]?.regclass) {
        return;
      }
      try {
        await sql`
          CREATE TABLE IF NOT EXISTS llm4writing_users (
            username TEXT PRIMARY KEY,
            payload JSONB NOT NULL,
            password TEXT NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          )
        `;
      } catch (error) {
        // Production DB roles may be read-only for DDL; do not fail login flow for that.
        if (!isPermissionLikeError(error)) {
          throw error;
        }
        return;
      }

      // Backfill default bootstrap accounts if they are missing.
      // Use ON CONFLICT DO NOTHING so existing data is never overwritten.
      for (const user of defaultUsers) {
        const { password, ...payload } = user;
        try {
          await sql`
            INSERT INTO llm4writing_users (username, payload, password)
            VALUES (${user.username}, ${JSON.stringify(payload)}::jsonb, ${password})
            ON CONFLICT (username) DO NOTHING
          `;
        } catch (error) {
          // Production DB roles may be read-only for DML; do not fail login flow for that.
          if (!isPermissionLikeError(error)) {
            throw error;
          }
        }
      }
    })().catch((error) => {
      initPromise = undefined;
      throw error;
    });
  }

  await initPromise;
}

function stripPassword(user: StoredUser): UserAccount {
  const { password: _password, ...safe } = user;
  return safe;
}

function normalizePayload(payload: unknown, fallbackUsername?: string): UserAccount {
  let parsed: unknown = payload;
  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed) as unknown;
    } catch {
      parsed = {};
    }
  }

  if (!parsed || typeof parsed !== "object") {
    return fallbackUsername ? ({ username: fallbackUsername } as UserAccount) : ({} as UserAccount);
  }

  const raw = parsed as Record<string, unknown>;
  const wrapped = raw.payload && typeof raw.payload === "object" ? (raw.payload as Record<string, unknown>) : raw;
  const candidate = wrapped.user && typeof wrapped.user === "object" ? (wrapped.user as Record<string, unknown>) : wrapped;
  const username =
    typeof candidate.username === "string" && candidate.username.trim()
      ? candidate.username.trim()
      : fallbackUsername ?? "";
  const roleRaw = typeof candidate.role === "string" ? candidate.role.trim().toLowerCase() : "";
  const role = roleRaw === "student" || roleRaw === "teacher" || roleRaw === "admin" ? roleRaw : undefined;

  return {
    ...((candidate as unknown) as Partial<UserAccount>),
    username,
    ...(role ? { role } : {})
  } as UserAccount;
}

export async function listUsersStore(): Promise<UserAccount[]> {
  if (!isDatabaseEnabled()) {
    return Array.from(getMemoryStore().values()).map(stripPassword);
  }

  await ensureUserTable();
  const sql = getSqlClient();
  const rows = await sql<{ payload: unknown; password: string }[]>`
    SELECT payload, password
    FROM llm4writing_users
    ORDER BY username ASC
  `;

  return rows.map((row) => normalizePayload(row.payload));
}

export async function getUserStore(username: string): Promise<UserAccount | undefined> {
  if (!isDatabaseEnabled()) {
    const row = getMemoryStore().get(username);
    return row ? stripPassword(row) : undefined;
  }

  const rows = await retryOnce(async () => {
    await ensureUserTable();
    const sql = getSqlClient();
    return sql<{ payload: unknown }[]>`
      SELECT payload
      FROM llm4writing_users
      WHERE username = ${username}
      LIMIT 1
    `;
  });

  return rows[0] ? normalizePayload(rows[0].payload, username) : undefined;
}

export async function validateUserCredentialStore(username: string, password: string): Promise<UserAccount | undefined> {
  if (!isDatabaseEnabled()) {
    const row = getMemoryStore().get(username);
    if (!row || row.password !== password) return undefined;
    return stripPassword(row);
  }

  const rows = await retryOnce(async () => {
    await ensureUserTable();
    const sql = getSqlClient();
    return sql<{ payload: unknown; password: string }[]>`
      SELECT payload, password
      FROM llm4writing_users
      WHERE username = ${username}
      LIMIT 1
    `;
  });

  const row = rows[0];
  if (!row || row.password !== password) return undefined;
  return normalizePayload(row.payload, username);
}

export async function resetUserPasswordStore(username: string, newPassword: string): Promise<boolean> {
  if (!isDatabaseEnabled()) {
    const existing = getMemoryStore().get(username);
    if (!existing) return false;
    existing.password = newPassword;
    getMemoryStore().set(username, existing);
    return true;
  }

  await ensureUserTable();
  const sql = getSqlClient();
  const result = await sql`
    UPDATE llm4writing_users
    SET password = ${newPassword}, updated_at = NOW()
    WHERE username = ${username}
  `;

  return (result.count ?? 0) > 0;
}

export async function createUserStore(input: {
  username: string;
  name: string;
  school: string;
  role: "student" | "teacher" | "admin";
  password: string;
  ownerTeacherUsername?: string;
  classNumber?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const exists = await getUserStore(input.username);
  if (exists) return { ok: false, error: "username_exists" };

  if (input.role === "student") {
    if (!input.ownerTeacherUsername) return { ok: false, error: "missing_owner_teacher" };
    if (!input.classNumber) return { ok: false, error: "missing_class_number" };
    const owner = await getUserStore(input.ownerTeacherUsername);
    if (!owner || owner.role !== "teacher") return { ok: false, error: "owner_teacher_not_found" };

    const users = await listUsersStore();
    const hasTeacherConflict = users.some(
      (user) =>
        user.role === "student" &&
        user.school === input.school &&
        user.classNumber === input.classNumber &&
        user.ownerTeacherUsername &&
        user.ownerTeacherUsername !== input.ownerTeacherUsername
    );
    if (hasTeacherConflict) return { ok: false, error: "class_owner_teacher_conflict" };
  }

  const safePayload: UserAccount = {
    username: input.username,
    name: input.name,
    school: input.school,
    role: input.role,
    ownerTeacherUsername: input.role === "student" ? input.ownerTeacherUsername : undefined,
    classNumber: input.role === "student" ? input.classNumber : undefined
  };

  if (!isDatabaseEnabled()) {
    getMemoryStore().set(input.username, { ...safePayload, password: input.password });
    return { ok: true };
  }

  await ensureUserTable();
  const sql = getSqlClient();
  await sql`
    INSERT INTO llm4writing_users (username, payload, password)
    VALUES (${input.username}, ${JSON.stringify(safePayload)}::jsonb, ${input.password})
  `;

  return { ok: true };
}

export async function updateUserStore(
  username: string,
  patch: {
    name?: string;
    school?: string;
    role?: "student" | "teacher" | "admin";
    password?: string;
    ownerTeacherUsername?: string;
    classNumber?: string;
  }
): Promise<{ ok: true } | { ok: false; error: string }> {
  const existing = await getUserStore(username);
  if (!existing) return { ok: false, error: "user_not_found" };

  const nextRole = patch.role ?? existing.role;
  const nextOwnerTeacherUsername =
    patch.ownerTeacherUsername !== undefined ? patch.ownerTeacherUsername : existing.ownerTeacherUsername;
  const nextClassNumber = patch.classNumber !== undefined ? patch.classNumber : existing.classNumber;

  if (nextRole === "student") {
    if (!nextOwnerTeacherUsername) return { ok: false, error: "missing_owner_teacher" };
    if (!nextClassNumber) return { ok: false, error: "missing_class_number" };
    const owner = await getUserStore(nextOwnerTeacherUsername);
    if (!owner || owner.role !== "teacher") return { ok: false, error: "owner_teacher_not_found" };

    const users = await listUsersStore();
    const hasTeacherConflict = users.some(
      (user) =>
        user.username !== username &&
        user.role === "student" &&
        user.school === (patch.school ?? existing.school) &&
        user.classNumber === nextClassNumber &&
        user.ownerTeacherUsername &&
        user.ownerTeacherUsername !== nextOwnerTeacherUsername
    );
    if (hasTeacherConflict) return { ok: false, error: "class_owner_teacher_conflict" };
  }

  const nextPayload: UserAccount = {
    username,
    name: patch.name ?? existing.name,
    school: patch.school ?? existing.school,
    role: nextRole,
    ownerTeacherUsername: nextRole === "student" ? nextOwnerTeacherUsername : undefined,
    classNumber: nextRole === "student" ? nextClassNumber : undefined
  };

  if (!isDatabaseEnabled()) {
    const existingRaw = getMemoryStore().get(username);
    if (!existingRaw) return { ok: false, error: "user_not_found" };
    getMemoryStore().set(username, {
      ...nextPayload,
      password: patch.password ?? existingRaw.password
    });
    return { ok: true };
  }

  await ensureUserTable();
  const sql = getSqlClient();
  if (patch.password !== undefined && patch.password.length > 0) {
    await sql`
      UPDATE llm4writing_users
      SET payload = ${JSON.stringify(nextPayload)}::jsonb,
          password = ${patch.password},
          updated_at = NOW()
      WHERE username = ${username}
    `;
  } else {
    await sql`
      UPDATE llm4writing_users
      SET payload = ${JSON.stringify(nextPayload)}::jsonb,
          updated_at = NOW()
      WHERE username = ${username}
    `;
  }

  return { ok: true };
}

export async function deleteUserStore(username: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const existing = await getUserStore(username);
  if (!existing) return { ok: false, error: "user_not_found" };

  if (existing.role === "teacher") {
    const users = await listUsersStore();
    const hasStudents = users.some((user) => user.role === "student" && user.ownerTeacherUsername === existing.username);
    if (hasStudents) return { ok: false, error: "teacher_has_students" };
  }

  if (!isDatabaseEnabled()) {
    getMemoryStore().delete(username);
    return { ok: true };
  }

  await ensureUserTable();
  const sql = getSqlClient();
  await sql`DELETE FROM llm4writing_users WHERE username = ${username}`;
  return { ok: true };
}

export async function getTeacherUsersStore(): Promise<UserAccount[]> {
  const users = await listUsersStore();
  return users.filter((user) => user.role === "teacher");
}

export async function getUsersVisibleToTeacherStore(teacherUsername: string): Promise<UserAccount[]> {
  const users = await listUsersStore();
  return users.filter((user) => {
    if (user.username === teacherUsername && user.role === "teacher") return true;
    return user.role === "student" && user.ownerTeacherUsername === teacherUsername;
  });
}
