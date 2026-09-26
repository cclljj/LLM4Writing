import bcrypt from "bcryptjs";
import postgres, { Sql } from "postgres";
import { UserAccount } from "@/src/lib/types";
import { getDatabaseUrl, getPostgresClientOptions, isDatabaseEnabled } from "@/src/lib/db-config";

type StoredUser = UserAccount & { password: string };
type MemoryUserStore = Map<string, StoredUser>;

const KEY = "__llm4writing_users__";
const BCRYPT_ROUNDS = 12;
const DEFAULT_SESSION_VERSION = 1;
const STAFF_ACADEMIC_YEAR = "999";
const DEFAULT_STUDENT_ACADEMIC_YEAR = "115";
const LEGACY_STUDENT_CUTOFF = new Date("2026-09-01T00:00:00.000Z");

function userKey(username: string, academicYear: string): string {
  return `${username}\u0000${academicYear}`;
}

function normalizeAcademicYear(value: unknown, role?: string, createdAt?: unknown): string {
  if (role === "teacher" || role === "admin") return STAFF_ACADEMIC_YEAR;
  if (typeof value === "string" && value.trim()) return value.trim();
  if (createdAt && new Date(String(createdAt)) < LEGACY_STUDENT_CUTOFF) return "114";
  return DEFAULT_STUDENT_ACADEMIC_YEAR;
}

const defaultUsers: StoredUser[] = [
  { username: "admin", academicYear: "999", name: "System Admin", school: "Demo High", role: "admin", password: "admin123", sessionVersion: 1 },
  { username: "teacher", academicYear: "999", name: "Teacher One", school: "Demo High", role: "teacher", password: "teacher123", sessionVersion: 1 },
  {
    username: "student",
    academicYear: "115",
    name: "Student One",
    school: "Demo High",
    role: "student",
    ownerTeacherUsername: "teacher",
    classNumber: "701",
    password: "student123",
    sessionVersion: 1
  },
  {
    username: "s1",
    academicYear: "115",
    name: "S1",
    school: "Demo High",
    role: "student",
    ownerTeacherUsername: "teacher",
    classNumber: "701",
    password: "student123",
    sessionVersion: 1
  },
  {
    username: "s2",
    academicYear: "115",
    name: "S2",
    school: "Demo High",
    role: "student",
    ownerTeacherUsername: "teacher",
    classNumber: "701",
    password: "student123",
    sessionVersion: 1
  },
  {
    username: "s3",
    academicYear: "115",
    name: "S3",
    school: "Demo High",
    role: "student",
    ownerTeacherUsername: "teacher",
    classNumber: "702",
    password: "student123",
    sessionVersion: 1
  }
];

function shouldSeedDefaultUsersForDb(): boolean {
  const explicit = process.env.ALLOW_DB_DEFAULT_USERS?.trim().toLowerCase();
  if (explicit === "true") return true;
  if (explicit === "false") return false;
  return process.env.NODE_ENV !== "production";
}

function getMemoryStore(): MemoryUserStore {
  const globalScope = globalThis as unknown as Record<string, MemoryUserStore | undefined>;
  if (!globalScope[KEY]) {
    const seeded = new Map<string, StoredUser>();
    defaultUsers.forEach((user) => seeded.set(userKey(user.username, user.academicYear), { ...user, password: hashPasswordSync(user.password) }));
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
        try {
          await sql`ALTER TABLE llm4writing_users ADD COLUMN IF NOT EXISTS academic_year TEXT NOT NULL DEFAULT '999'`;
          // Legacy records may wrap the user object in payload and/or user. Read
          // all supported shapes so staff are always stored under academic year
          // 999, including rows that a prior migration incorrectly classified as
          // a student academic year.
          await sql`
            UPDATE llm4writing_users
            SET academic_year = CASE
              WHEN LOWER(COALESCE(payload->>'role', payload->'payload'->>'role', payload->'payload'->'user'->>'role', payload->'user'->>'role', '')) IN ('teacher', 'admin') THEN '999'
              WHEN created_at < '2026-09-01T00:00:00.000Z'::timestamptz THEN '114'
              ELSE '115'
            END
            WHERE academic_year = '999'
              OR academic_year IS NULL
              OR LOWER(COALESCE(payload->>'role', payload->'payload'->>'role', payload->'payload'->'user'->>'role', payload->'user'->>'role', '')) IN ('teacher', 'admin')
          `;
          // The oldest rows store an entire JSON document inside a JSON string.
          // PostgreSQL cannot inspect its role directly, but normalizePayload can;
          // correct only the staff rows without rewriting their legacy payload.
          const scalarPayloadRows = await sql<{ username: string; payload: unknown; academic_year: string }[]>`
            SELECT username, payload, academic_year
            FROM llm4writing_users
            WHERE jsonb_typeof(payload) = 'string' AND academic_year <> '999'
          `;
          for (const row of scalarPayloadRows) {
            const legacyUser = normalizePayload(row.payload, row.username);
            if (legacyUser.role !== "teacher" && legacyUser.role !== "admin") continue;
            await sql`
              UPDATE llm4writing_users
              SET academic_year = '999'
              WHERE username = ${row.username} AND academic_year = ${row.academic_year}
            `;
          }
          // Some legacy rows stored payload as a JSON scalar. jsonb_set only accepts
          // an object when writing the academicYear path, so leave those payloads
          // intact; normalizePayload can still deserialize them when they are read.
          await sql`UPDATE llm4writing_users SET payload = jsonb_set(payload, '{academicYear}', to_jsonb(academic_year), true) WHERE jsonb_typeof(payload) = 'object' AND COALESCE(payload->>'academicYear', '') <> academic_year`;

          // A serverless instance may initialize this store many times. Only replace
          // the legacy username-only primary key when it is not already composite.
          const primaryKey = await sql<{ definition: string }[]>`
            SELECT pg_get_constraintdef(oid) AS definition
            FROM pg_constraint
            WHERE conrelid = 'llm4writing_users'::regclass AND contype = 'p'
            LIMIT 1
          `;
          const primaryKeyDefinition = primaryKey[0]?.definition.replace(/\s+/g, " ").toLowerCase() ?? "";
          if (primaryKeyDefinition !== "primary key (username, academic_year)") {
            await sql`ALTER TABLE llm4writing_users DROP CONSTRAINT IF EXISTS llm4writing_users_pkey`;
            await sql`ALTER TABLE llm4writing_users ADD PRIMARY KEY (username, academic_year)`;
          }
        } catch (error) {
          if (!isPermissionLikeError(error)) throw error;
        }
        return;
      }
      try {
        await sql`
          CREATE TABLE IF NOT EXISTS llm4writing_users (
            username TEXT NOT NULL,
            academic_year TEXT NOT NULL,
            payload JSONB NOT NULL,
            password TEXT NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            PRIMARY KEY (username, academic_year)
          )
        `;
      } catch (error) {
        // Production DB roles may be read-only for DDL; do not fail login flow for that.
        if (!isPermissionLikeError(error)) {
          throw error;
        }
        return;
      }

      // #393: In production, do not auto-backfill default credentials.
      // Explicit override is available only when operators intentionally set
      // ALLOW_DB_DEFAULT_USERS=true.
      if (shouldSeedDefaultUsersForDb()) {
        // Backfill default bootstrap accounts if they are missing.
        // Use ON CONFLICT DO NOTHING so existing data is never overwritten.
        for (const user of defaultUsers) {
          const { password, ...payload } = user;
          const passwordHash = await hashPassword(password);
          try {
            await sql`
              INSERT INTO llm4writing_users (username, academic_year, payload, password)
              VALUES (${user.username}, ${user.academicYear}, ${JSON.stringify(payload)}::jsonb, ${passwordHash})
              ON CONFLICT (username, academic_year) DO NOTHING
            `;
          } catch (error) {
            // Production DB roles may be read-only for DML; do not fail login flow for that.
            if (!isPermissionLikeError(error)) {
              throw error;
            }
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
  const safe: Partial<StoredUser> = { ...user };
  delete safe.password;
  safe.sessionVersion = normalizeSessionVersion(user.sessionVersion);
  return safe as UserAccount;
}

function isPasswordHash(value: string): boolean {
  return /^\$2[aby]\$\d{2}\$/.test(value);
}

function normalizeSessionVersion(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return DEFAULT_SESSION_VERSION;
  const asInt = Math.trunc(value);
  return asInt > 0 ? asInt : DEFAULT_SESSION_VERSION;
}

function hashPasswordSync(password: string): string {
  return bcrypt.hashSync(password, BCRYPT_ROUNDS);
}

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

async function verifyPasswordAndUpgradeStatus(
  storedPassword: string,
  candidatePassword: string
): Promise<{ ok: boolean; needsUpgrade: boolean }> {
  if (isPasswordHash(storedPassword)) {
    return { ok: await bcrypt.compare(candidatePassword, storedPassword), needsUpgrade: false };
  }

  return {
    ok: storedPassword === candidatePassword,
    needsUpgrade: storedPassword === candidatePassword
  };
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
    academicYear: normalizeAcademicYear(candidate.academicYear, role, candidate.createdAt),
    ...(role ? { role } : {}),
    sessionVersion: normalizeSessionVersion(candidate.sessionVersion)
  } as UserAccount;
}

export async function listUsersStore(): Promise<UserAccount[]> {
  if (!isDatabaseEnabled()) {
    return Array.from(getMemoryStore().values()).map(stripPassword);
  }

  await ensureUserTable();
  const sql = getSqlClient();
  const rows = await sql<{ payload: unknown; password: string; academic_year: string; created_at: string }[]>`
    SELECT payload, password, academic_year, created_at
    FROM llm4writing_users
    ORDER BY username ASC
  `;

  return rows.map((row) => ({ ...normalizePayload(row.payload), academicYear: normalizeAcademicYear(row.academic_year, normalizePayload(row.payload).role, row.created_at) }));
}

export async function getUserStore(username: string, academicYear = STAFF_ACADEMIC_YEAR): Promise<UserAccount | undefined> {
  if (!isDatabaseEnabled()) {
    const row = getMemoryStore().get(userKey(username, academicYear));
    return row ? stripPassword(row) : undefined;
  }

  const rows = await retryOnce(async () => {
    await ensureUserTable();
    const sql = getSqlClient();
    return sql<{ payload: unknown }[]>`
      SELECT payload
      FROM llm4writing_users
      WHERE username = ${username} AND academic_year = ${academicYear}
      LIMIT 1
    `;
  });

  if (rows[0]) return { ...normalizePayload(rows[0].payload, username), academicYear };

  // Preserve staff lookup for legacy scalar payloads while their academic-year
  // correction is being applied. Student lookups remain strictly composite.
  if (academicYear !== STAFF_ACADEMIC_YEAR) return undefined;
  const legacyRows = await retryOnce(async () => {
    const sql = getSqlClient();
    return sql<{ payload: unknown }[]>`
      SELECT payload
      FROM llm4writing_users
      WHERE username = ${username}
    `;
  });
  const legacyStaff = legacyRows
    .map((row) => normalizePayload(row.payload, username))
    .find((user) => user.role === "teacher" || user.role === "admin");
  return legacyStaff ? { ...legacyStaff, academicYear: STAFF_ACADEMIC_YEAR } : undefined;
}

export async function validateUserCredentialStore(username: string, password: string): Promise<UserAccount | undefined> {
  if (!isDatabaseEnabled()) {
    const candidates = Array.from(getMemoryStore().values())
      .filter((row) => row.username === username)
      .sort((a, b) => {
        const roleOrder = Number(a.role !== "student") - Number(b.role !== "student");
        return roleOrder || b.academicYear.localeCompare(a.academicYear, undefined, { numeric: true });
      });
    for (const row of candidates) {
      const verification = await verifyPasswordAndUpgradeStatus(row.password, password);
      if (!verification.ok) continue;
      if (verification.needsUpgrade) {
        row.password = await hashPassword(password);
        getMemoryStore().set(userKey(username, row.academicYear), row);
      }
      return stripPassword(row);
    }
    return undefined;
  }

  const rows = await retryOnce(async () => {
    await ensureUserTable();
    const sql = getSqlClient();
    return sql<{ payload: unknown; password: string; academic_year: string }[]>`
      SELECT payload, password, academic_year
      FROM llm4writing_users
      WHERE username = ${username}
      ORDER BY CASE WHEN payload->>'role' = 'student' THEN 0 ELSE 1 END, academic_year DESC
    `;
  });

  for (const row of rows) {
    const verification = await verifyPasswordAndUpgradeStatus(row.password, password);
    if (!verification.ok) continue;
    if (verification.needsUpgrade) {
      const sql = getSqlClient();
      await sql`
        UPDATE llm4writing_users
        SET password = ${await hashPassword(password)}, updated_at = NOW()
        WHERE username = ${username} AND academic_year = ${row.academic_year}
      `;
    }
    return { ...normalizePayload(row.payload, username), academicYear: row.academic_year };
  }
  return undefined;
}

export async function resetUserPasswordStore(username: string, newPassword: string, academicYear = STAFF_ACADEMIC_YEAR): Promise<boolean> {
  const passwordHash = await hashPassword(newPassword);

  if (!isDatabaseEnabled()) {
    const existing = getMemoryStore().get(userKey(username, academicYear));
    if (!existing) return false;
    existing.password = passwordHash;
    existing.sessionVersion = normalizeSessionVersion(existing.sessionVersion) + 1;
    getMemoryStore().set(userKey(username, academicYear), existing);
    return true;
  }

  await ensureUserTable();
  const sql = getSqlClient();
  const rows = await sql<{ payload: unknown }[]>`
    SELECT payload
    FROM llm4writing_users
    WHERE username = ${username} AND academic_year = ${academicYear}
    LIMIT 1
  `;
  const row = rows[0];
  if (!row) return false;
  const currentPayload = { ...normalizePayload(row.payload, username), academicYear };
  const nextPayload: UserAccount = {
    ...currentPayload,
    username,
    sessionVersion: normalizeSessionVersion(currentPayload.sessionVersion) + 1
  };
  await sql`
    UPDATE llm4writing_users
    SET payload = ${JSON.stringify(nextPayload)}::jsonb,
        password = ${passwordHash},
        updated_at = NOW()
    WHERE username = ${username} AND academic_year = ${academicYear}
  `;
  return true;
}

export async function createUserStore(input: {
  username: string;
  name: string;
  school: string;
  role: "student" | "teacher" | "admin";
  password: string;
  ownerTeacherUsername?: string;
  classNumber?: string;
  academicYear?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const academicYear = normalizeAcademicYear(input.academicYear, input.role);
  const exists = await getUserStore(input.username, academicYear);
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
        user.academicYear === academicYear &&
        user.school === input.school &&
        user.classNumber === input.classNumber &&
        user.ownerTeacherUsername &&
        user.ownerTeacherUsername !== input.ownerTeacherUsername
    );
    if (hasTeacherConflict) return { ok: false, error: "class_owner_teacher_conflict" };
  }

  const safePayload: UserAccount = {
    username: input.username,
    academicYear,
    name: input.name,
    school: input.school,
    role: input.role,
    ownerTeacherUsername: input.role === "student" ? input.ownerTeacherUsername : undefined,
    classNumber: input.role === "student" ? input.classNumber : undefined,
    sessionVersion: DEFAULT_SESSION_VERSION
  };
  const passwordHash = await hashPassword(input.password);

  if (!isDatabaseEnabled()) {
    getMemoryStore().set(userKey(input.username, academicYear), { ...safePayload, password: passwordHash });
    return { ok: true };
  }

  await ensureUserTable();
  const sql = getSqlClient();
  await sql`
    INSERT INTO llm4writing_users (username, academic_year, payload, password)
    VALUES (${input.username}, ${academicYear}, ${JSON.stringify(safePayload)}::jsonb, ${passwordHash})
  `;

  return { ok: true };
}

export async function updateUserStore(
  username: string,
  academicYear: string,
  patch: {
    name?: string;
    school?: string;
    role?: "student" | "teacher" | "admin";
    password?: string;
    ownerTeacherUsername?: string;
    classNumber?: string;
  }
): Promise<{ ok: true } | { ok: false; error: string }> {
  const existing = await getUserStore(username, academicYear);
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
        (user.username !== username || user.academicYear !== academicYear) &&
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
    academicYear: existing.academicYear,
    name: patch.name ?? existing.name,
    school: patch.school ?? existing.school,
    role: nextRole,
    ownerTeacherUsername: nextRole === "student" ? nextOwnerTeacherUsername : undefined,
    classNumber: nextRole === "student" ? nextClassNumber : undefined
  };
  const currentVersion = normalizeSessionVersion(existing.sessionVersion);
  const shouldRevokeExistingSessions =
    (patch.password !== undefined && patch.password.length > 0) || (patch.role !== undefined && patch.role !== existing.role);
  nextPayload.sessionVersion = shouldRevokeExistingSessions ? currentVersion + 1 : currentVersion;

  if (!isDatabaseEnabled()) {
    const existingRaw = getMemoryStore().get(userKey(username, academicYear));
    if (!existingRaw) return { ok: false, error: "user_not_found" };
    const passwordHash =
      patch.password !== undefined && patch.password.length > 0 ? await hashPassword(patch.password) : existingRaw.password;
    getMemoryStore().set(userKey(username, academicYear), {
      ...nextPayload,
      password: passwordHash
    });
    return { ok: true };
  }

  await ensureUserTable();
  const sql = getSqlClient();
  if (patch.password !== undefined && patch.password.length > 0) {
    const passwordHash = await hashPassword(patch.password);
    await sql`
      UPDATE llm4writing_users
      SET payload = ${JSON.stringify(nextPayload)}::jsonb,
          password = ${passwordHash},
          updated_at = NOW()
      WHERE username = ${username} AND academic_year = ${academicYear}
    `;
  } else {
    await sql`
      UPDATE llm4writing_users
      SET payload = ${JSON.stringify(nextPayload)}::jsonb,
          updated_at = NOW()
      WHERE username = ${username} AND academic_year = ${academicYear}
    `;
  }

  return { ok: true };
}

export async function deleteUserStore(username: string, academicYear: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const existing = await getUserStore(username, academicYear);
  if (!existing) return { ok: false, error: "user_not_found" };

  if (existing.role === "teacher") {
    const users = await listUsersStore();
    const hasStudents = users.some((user) => user.role === "student" && user.ownerTeacherUsername === existing.username);
    if (hasStudents) return { ok: false, error: "teacher_has_students" };
  }

  if (!isDatabaseEnabled()) {
    getMemoryStore().delete(userKey(username, academicYear));
    return { ok: true };
  }

  await ensureUserTable();
  const sql = getSqlClient();
  await sql`DELETE FROM llm4writing_users WHERE username = ${username} AND academic_year = ${academicYear}`;
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
