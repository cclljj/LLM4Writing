import postgres, { Sql } from "postgres";
import { UserAccount } from "@/src/lib/types";

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
    password: "student123"
  },
  {
    username: "s1",
    name: "S1",
    school: "Demo High",
    role: "student",
    ownerTeacherUsername: "teacher",
    password: "student123"
  },
  {
    username: "s2",
    name: "S2",
    school: "Demo High",
    role: "student",
    ownerTeacherUsername: "teacher",
    password: "student123"
  },
  {
    username: "s3",
    name: "S3",
    school: "Demo High",
    role: "student",
    ownerTeacherUsername: "teacher",
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
    if (!url) throw new Error("postgres_url_missing");
    sqlClient = postgres(url, { prepare: true, max: 1 });
  }
  return sqlClient;
}

let initPromise: Promise<void> | undefined;

async function ensureUserTable(): Promise<void> {
  if (!isPostgresEnabled()) return;

  if (!initPromise) {
    initPromise = (async () => {
      const sql = getSqlClient();
      await sql`
        CREATE TABLE IF NOT EXISTS llm4writing_users (
          username TEXT PRIMARY KEY,
          payload JSONB NOT NULL,
          password TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;

      const rows = await sql<{ c: number }[]>`SELECT COUNT(*)::int as c FROM llm4writing_users`;
      if ((rows[0]?.c ?? 0) === 0) {
        for (const user of defaultUsers) {
          const { password, ...payload } = user;
          await sql`
            INSERT INTO llm4writing_users (username, payload, password)
            VALUES (${user.username}, ${JSON.stringify(payload)}::jsonb, ${password})
          `;
        }
      }
    })();
  }

  await initPromise;
}

function stripPassword(user: StoredUser): UserAccount {
  const { password: _password, ...safe } = user;
  return safe;
}

export async function listUsersStore(): Promise<UserAccount[]> {
  if (!isPostgresEnabled()) {
    return Array.from(getMemoryStore().values()).map(stripPassword);
  }

  await ensureUserTable();
  const sql = getSqlClient();
  const rows = await sql<{ payload: UserAccount; password: string }[]>`
    SELECT payload, password
    FROM llm4writing_users
    ORDER BY username ASC
  `;

  return rows.map((row) => ({ ...row.payload }));
}

export async function getUserStore(username: string): Promise<UserAccount | undefined> {
  if (!isPostgresEnabled()) {
    const row = getMemoryStore().get(username);
    return row ? stripPassword(row) : undefined;
  }

  await ensureUserTable();
  const sql = getSqlClient();
  const rows = await sql<{ payload: UserAccount }[]>`
    SELECT payload
    FROM llm4writing_users
    WHERE username = ${username}
    LIMIT 1
  `;

  return rows[0]?.payload;
}

export async function validateUserCredentialStore(username: string, password: string): Promise<UserAccount | undefined> {
  if (!isPostgresEnabled()) {
    const row = getMemoryStore().get(username);
    if (!row || row.password !== password) return undefined;
    return stripPassword(row);
  }

  await ensureUserTable();
  const sql = getSqlClient();
  const rows = await sql<{ payload: UserAccount; password: string }[]>`
    SELECT payload, password
    FROM llm4writing_users
    WHERE username = ${username}
    LIMIT 1
  `;

  const row = rows[0];
  if (!row || row.password !== password) return undefined;
  return row.payload;
}

export async function resetUserPasswordStore(username: string, newPassword: string): Promise<boolean> {
  if (!isPostgresEnabled()) {
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
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const exists = await getUserStore(input.username);
  if (exists) return { ok: false, error: "username_exists" };

  if (input.role === "student") {
    if (!input.ownerTeacherUsername) return { ok: false, error: "missing_owner_teacher" };
    const owner = await getUserStore(input.ownerTeacherUsername);
    if (!owner || owner.role !== "teacher") return { ok: false, error: "owner_teacher_not_found" };
  }

  const safePayload: UserAccount = {
    username: input.username,
    name: input.name,
    school: input.school,
    role: input.role,
    ownerTeacherUsername: input.role === "student" ? input.ownerTeacherUsername : undefined
  };

  if (!isPostgresEnabled()) {
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
  }
): Promise<{ ok: true } | { ok: false; error: string }> {
  const existing = await getUserStore(username);
  if (!existing) return { ok: false, error: "user_not_found" };

  const nextRole = patch.role ?? existing.role;
  const nextOwnerTeacherUsername =
    patch.ownerTeacherUsername !== undefined ? patch.ownerTeacherUsername : existing.ownerTeacherUsername;

  if (nextRole === "student") {
    if (!nextOwnerTeacherUsername) return { ok: false, error: "missing_owner_teacher" };
    const owner = await getUserStore(nextOwnerTeacherUsername);
    if (!owner || owner.role !== "teacher") return { ok: false, error: "owner_teacher_not_found" };
  }

  const nextPayload: UserAccount = {
    username,
    name: patch.name ?? existing.name,
    school: patch.school ?? existing.school,
    role: nextRole,
    ownerTeacherUsername: nextRole === "student" ? nextOwnerTeacherUsername : undefined
  };

  if (!isPostgresEnabled()) {
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

  if (!isPostgresEnabled()) {
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
