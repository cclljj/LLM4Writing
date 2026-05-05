import { Activity, ActivityGroup, PromptConfig, UserAccount } from "@/src/lib/types";
import postgres, { Sql } from "postgres";
import { existsSync, promises as fs, readFileSync } from "node:fs";
import path from "node:path";
import systemPromptConfig from "@/src/config/system-prompt-config.json";
import structureTreeConfig from "@/src/config/structure-tree.json";
import { getDatabaseUrl, getPostgresClientOptions, isDatabaseEnabled } from "@/src/lib/db-config";

type Essay = {
  id: string;
  title: string;
  genre: string;
  description: string;
  enabled: boolean;
};

type OpenClassTask = {
  id: string;
  school: string;
  classNumber: string;
  essayId: string;
  durationMinutes: number;
  supplemental: string;
};

type OpenClassView = OpenClassTask & {
  essayTitle: string;
  essayGenre: string;
};

type RawSystemPromptConfig = {
  systemPrompt?: string;
  stepPrompts?: Record<string, string>;
  subStepPrompts?: Record<string, string>;
  subStepPrompts_fallbacks?: Record<string, string>;
  questionBanks?: Record<string, string[]>;
  step9Questions?: Record<string, string>;
  writingTasks?: Record<string, { questionBanks?: Record<string, string[]> }>;
};

function loadStepOpeningTexts(): Record<string, string> {
  const steps = ["1", "2", "3", "4", "6", "8", "9"];
  const baseDir = path.join(process.cwd(), "src", "config", "step-opening");
  const result: Record<string, string> = {};
  steps.forEach((step) => {
    const filePath = path.join(baseDir, `${step}.md`);
    if (!existsSync(filePath)) return;
    try {
      result[step] = readFileSync(filePath, "utf8");
    } catch {
      // Ignore per-file read errors to avoid breaking prompt config generation.
    }
  });
  return result;
}

const stepOpeningTexts = loadStepOpeningTexts();

const structureTreeMapByGenre = structureTreeConfig as Record<string, string>;

const defaultStructureTreePath = "structure-tree/1.map";

function resolveStructureTreePathByGenre(genre: string): { path: string; matchedGenre: string; fallbackUsed: boolean } {
  const normalized = genre.trim();
  if (!normalized) return { path: defaultStructureTreePath, matchedGenre: "議論文", fallbackUsed: true };
  if (structureTreeMapByGenre[normalized]) {
    return { path: structureTreeMapByGenre[normalized]!, matchedGenre: normalized, fallbackUsed: false };
  }

  const compact = normalized.replace(/\s+/g, "");
  const directCompactKey = Object.keys(structureTreeMapByGenre).find((key) => key.replace(/\s+/g, "") === compact);
  if (directCompactKey) {
    return { path: structureTreeMapByGenre[directCompactKey]!, matchedGenre: directCompactKey, fallbackUsed: false };
  }

  if (compact.includes("議論")) return { path: structureTreeMapByGenre["議論文"] ?? defaultStructureTreePath, matchedGenre: "議論文", fallbackUsed: false };
  if (compact.includes("記敘")) return { path: structureTreeMapByGenre["記敘文"] ?? defaultStructureTreePath, matchedGenre: "記敘文", fallbackUsed: false };
  if (compact.includes("抒情")) return { path: structureTreeMapByGenre["抒情文"] ?? defaultStructureTreePath, matchedGenre: "抒情文", fallbackUsed: false };
  if (compact.includes("說明")) return { path: structureTreeMapByGenre["說明文"] ?? defaultStructureTreePath, matchedGenre: "說明文", fallbackUsed: false };

  return { path: defaultStructureTreePath, matchedGenre: "議論文", fallbackUsed: true };
}

function replaceEssayTitleInTemplate(template: string, essayTitle: string): string {
  const normalizedTitle = essayTitle.trim() || "未命名題目";
  return template.replaceAll("作文題目", normalizedTitle);
}

export function resolveStructureTreeTemplate(genre: string, essayTitle: string): string {
  const relPath = resolveStructureTreePathByGenre(genre).path.trim();
  if (!relPath) return "";
  const filePath = path.join(process.cwd(), "src", "config", relPath);
  if (!existsSync(filePath)) return "";
  try {
    const raw = readFileSync(filePath, "utf8");
    return replaceEssayTitleInTemplate(raw, essayTitle);
  } catch {
    return "";
  }
}

type DomainState = {
  users: UserAccount[];
  userPasswords: Record<string, string>;
  essays: Essay[];
  openClasses: OpenClassTask[];
  activityGroupMap: Record<string, ActivityGroup[]>;
  courseStatusMap: Record<string, "not_started" | "in_progress" | "paused" | "ended">;
};

const KEY = "__llm4writing_domain_state__";
const REMOVED_ESSAY_IDS = new Set(["essay-1", "essay-2", "essay-3"]);

const defaultUsers: UserAccount[] = [
  { username: "admin", name: "System Admin", school: "Demo High", role: "admin" },
  { username: "teacher", name: "Teacher One", school: "Demo High", role: "teacher" },
  {
    username: "student",
    name: "Student One",
    school: "Demo High",
    role: "student",
    ownerTeacherUsername: "teacher",
    classNumber: "701"
  },
  {
    username: "s1",
    name: "S1",
    school: "Demo High",
    role: "student",
    ownerTeacherUsername: "teacher",
    classNumber: "701"
  },
  {
    username: "s2",
    name: "S2",
    school: "Demo High",
    role: "student",
    ownerTeacherUsername: "teacher",
    classNumber: "701"
  },
  {
    username: "s3",
    name: "S3",
    school: "Demo High",
    role: "student",
    ownerTeacherUsername: "teacher",
    classNumber: "702"
  }
];

const defaultUserPasswords: Record<string, string> = {
  admin: "admin123",
  student: "student123",
  s1: "student123",
  s2: "student123",
  s3: "student123",
  teacher: "teacher123"
};

const defaultEssays: Essay[] = [];

const defaultOpenClasses: OpenClassTask[] = [];

const defaultActivityGroupMap: Record<string, ActivityGroup[]> = {};

const defaultCourseStatusMap: Record<string, "not_started" | "in_progress" | "paused" | "ended"> = {};

function cloneState(): DomainState {
  return {
    users: defaultUsers.map((user) => ({ ...user })),
    userPasswords: { ...defaultUserPasswords },
    essays: defaultEssays.map((essay) => ({ ...essay })),
    openClasses: defaultOpenClasses.map((openClass) => ({ ...openClass })),
    activityGroupMap: JSON.parse(JSON.stringify(defaultActivityGroupMap)) as Record<string, ActivityGroup[]>,
    courseStatusMap: { ...defaultCourseStatusMap }
  };
}

function normalizeDomainState(input: unknown): DomainState {
  if (typeof input === "string") {
    try {
      return normalizeDomainState(JSON.parse(input));
    } catch {
      return cloneState();
    }
  }

  const base = cloneState();
  if (!input || typeof input !== "object") {
    return base;
  }

  const raw = input as Partial<DomainState>;

  const usersFromPayload = Array.isArray(raw.users)
    ? raw.users.filter((user): user is UserAccount => Boolean(user && typeof user.username === "string"))
    : [];
  const mergedUsers = [...base.users];
  usersFromPayload.forEach((user) => {
    const idx = mergedUsers.findIndex((item) => item.username === user.username);
    if (idx >= 0) mergedUsers[idx] = { ...mergedUsers[idx], ...user };
    else mergedUsers.push({ ...user });
  });

  const userPasswordsFromPayload = raw.userPasswords && typeof raw.userPasswords === "object" ? raw.userPasswords : {};
  const mergedUserPasswords = { ...base.userPasswords, ...(userPasswordsFromPayload as Record<string, string>) };

  const essaysFromPayload = Array.isArray(raw.essays)
    ? raw.essays.filter((essay): essay is Essay => Boolean(essay && typeof essay.id === "string"))
    : [];
  const mergedEssays = [...base.essays];
  essaysFromPayload.forEach((essay) => {
    const idx = mergedEssays.findIndex((item) => item.id === essay.id);
    if (idx >= 0) mergedEssays[idx] = { ...mergedEssays[idx], ...essay };
    else mergedEssays.push({ ...essay });
  });

  const openClassesFromPayload = Array.isArray(raw.openClasses)
    ? raw.openClasses.filter((openClass): openClass is OpenClassTask => Boolean(openClass && typeof openClass.id === "string"))
    : [];
  const mergedOpenClasses = [...base.openClasses];
  openClassesFromPayload.forEach((openClass) => {
    const idx = mergedOpenClasses.findIndex((item) => item.id === openClass.id);
    if (idx >= 0) mergedOpenClasses[idx] = { ...mergedOpenClasses[idx], ...openClass };
    else mergedOpenClasses.push({ ...openClass });
  });

  const filteredEssays = mergedEssays.filter((essay) => !REMOVED_ESSAY_IDS.has(essay.id));
  const filteredOpenClasses = mergedOpenClasses.filter((openClass) => !REMOVED_ESSAY_IDS.has(openClass.essayId));
  const allowedOpenClassIds = new Set(filteredOpenClasses.map((openClass) => openClass.id));

  const rawGroups = raw.activityGroupMap && typeof raw.activityGroupMap === "object" ? raw.activityGroupMap : {};
  const mergedActivityGroupMap: Record<string, ActivityGroup[]> = { ...base.activityGroupMap };
  Object.entries(rawGroups as Record<string, ActivityGroup[]>).forEach(([key, groups]) => {
    if (!allowedOpenClassIds.has(key)) return;
    mergedActivityGroupMap[key] = Array.isArray(groups)
      ? groups.map((group) => ({
          groupId: group.groupId,
          groupName: group.groupName,
          members: Array.isArray(group.members) ? group.members.filter((m) => typeof m === "string") : []
        }))
      : [];
  });
  Object.keys(mergedActivityGroupMap).forEach((key) => {
    if (!allowedOpenClassIds.has(key)) {
      delete mergedActivityGroupMap[key];
    }
  });

  const rawCourseStatus = raw.courseStatusMap && typeof raw.courseStatusMap === "object" ? raw.courseStatusMap : {};
  const mergedCourseStatusMap = {
    ...base.courseStatusMap,
    ...(rawCourseStatus as Record<string, "not_started" | "in_progress" | "paused" | "ended">)
  };
  Object.keys(mergedCourseStatusMap).forEach((key) => {
    if (!allowedOpenClassIds.has(key)) {
      delete mergedCourseStatusMap[key];
    }
  });

  return {
    users: mergedUsers,
    userPasswords: mergedUserPasswords,
    essays: filteredEssays,
    openClasses: filteredOpenClasses,
    activityGroupMap: mergedActivityGroupMap,
    courseStatusMap: mergedCourseStatusMap
  };
}

function getState(): DomainState {
  const globalScope = globalThis as unknown as Record<string, DomainState | undefined>;
  if (!globalScope[KEY]) {
    globalScope[KEY] = cloneState();
  }
  return globalScope[KEY] as DomainState;
}

const state = getState();
const users = state.users;
const userPasswords = state.userPasswords;
const essays = state.essays;
const openClasses = state.openClasses;
const activityGroupMap = state.activityGroupMap;
const courseStatusMap = state.courseStatusMap;
const DOMAIN_FILE = path.join(process.cwd(), ".data", "domain-state.json");

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

let domainInitPromise: Promise<void> | undefined;

function isPermissionLikeError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const record = error as { code?: unknown; message?: unknown };
  const code = typeof record.code === "string" ? record.code : "";
  const message = typeof record.message === "string" ? record.message.toLowerCase() : "";
  return code === "42501" || message.includes("permission denied");
}

async function ensureDomainTable(): Promise<void> {
  if (!isDatabaseEnabled()) return;
  if (!domainInitPromise) {
    domainInitPromise = (async () => {
      const sql = getSqlClient();
      const existing = await sql<{ regclass: string | null }[]>`
        SELECT COALESCE(to_regclass('llm4writing_domain')::text, to_regclass('public.llm4writing_domain')::text) AS regclass
      `;
      if (existing[0]?.regclass) return;
      try {
        await sql`
          CREATE TABLE IF NOT EXISTS llm4writing_domain (
            id TEXT PRIMARY KEY,
            payload JSONB NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          )
        `;
      } catch (error) {
        if (!isPermissionLikeError(error)) throw error;
      }
    })().catch((error) => {
      domainInitPromise = undefined;
      throw error;
    });
  }
  await domainInitPromise;
}

function applyState(next: DomainState) {
  users.splice(0, users.length, ...next.users.map((item) => ({ ...item })));

  Object.keys(userPasswords).forEach((key) => delete userPasswords[key]);
  Object.entries(next.userPasswords).forEach(([key, value]) => {
    userPasswords[key] = value;
  });

  essays.splice(0, essays.length, ...next.essays.map((item) => ({ ...item })));
  openClasses.splice(0, openClasses.length, ...next.openClasses.map((item) => ({ ...item })));

  Object.keys(activityGroupMap).forEach((key) => delete activityGroupMap[key]);
  Object.entries(next.activityGroupMap).forEach(([key, value]) => {
    activityGroupMap[key] = value.map((group) => ({ ...group, members: [...group.members] }));
  });

  Object.keys(courseStatusMap).forEach((key) => delete courseStatusMap[key]);
  Object.entries(next.courseStatusMap).forEach(([key, value]) => {
    courseStatusMap[key] = value;
  });

}

function snapshotState(): DomainState {
  return {
    users: users.map((item) => ({ ...item })),
    userPasswords: { ...userPasswords },
    essays: essays.map((item) => ({ ...item })),
    openClasses: openClasses.map((item) => ({ ...item })),
    activityGroupMap: JSON.parse(JSON.stringify(activityGroupMap)) as Record<string, ActivityGroup[]>,
    courseStatusMap: { ...courseStatusMap }
  };
}

export async function hydrateDomainState(): Promise<void> {
  if (!isDatabaseEnabled()) {
    try {
      const raw = await fs.readFile(DOMAIN_FILE, "utf8");
      const payload = JSON.parse(raw) as unknown;
      const normalized = normalizeDomainState(payload);
      applyState(normalized);
      return;
    } catch {
      await flushDomainState();
      return;
    }
  }
  await ensureDomainTable();
  const sql = getSqlClient();
  const rows = await sql<{ payload: unknown }[]>`
    SELECT payload
    FROM llm4writing_domain
    WHERE id = 'singleton'
    LIMIT 1
  `;
  const row = rows[0];
  if (!row?.payload) {
    // Keep bootstrapped in-memory defaults; do not force-write DB during read path.
    return;
  }
  const normalized = normalizeDomainState(row.payload);
  applyState(normalized);
  if (typeof row.payload === "string") {
    // Migrate legacy double-encoded JSON payload to proper JSON object format.
    try {
      await flushDomainState();
    } catch {
      // Best-effort migration only; never block read path.
    }
  }
}

export async function flushDomainState(): Promise<void> {
  if (!isDatabaseEnabled()) {
    await fs.mkdir(path.dirname(DOMAIN_FILE), { recursive: true });
    await fs.writeFile(DOMAIN_FILE, JSON.stringify(snapshotState(), null, 2), "utf8");
    return;
  }
  await ensureDomainTable();
  const sql = getSqlClient();
  const snapshotJson = JSON.stringify(snapshotState());
  await sql`
    INSERT INTO llm4writing_domain (id, payload)
    VALUES ('singleton', ${snapshotJson}::jsonb)
    ON CONFLICT (id)
    DO UPDATE SET
      payload = EXCLUDED.payload,
      updated_at = NOW()
  `;
}

function findEssay(essayId: string): Essay | undefined {
  return essays.find((essay) => essay.id === essayId);
}

function toOpenClassView(openClass: OpenClassTask): OpenClassView {
  const essay = findEssay(openClass.essayId);
  return {
    ...openClass,
    essayTitle: essay?.title ?? "未知主題",
    essayGenre: essay?.genre ?? "未知文體"
  };
}

function toActivity(openClass: OpenClassTask): Activity {
  const detail = toOpenClassView(openClass);
  const essay = findEssay(openClass.essayId);
  const groups = activityGroupMap[openClass.id] ?? [];

  return {
    id: openClass.id,
    school: openClass.school,
    classNumber: openClass.classNumber,
    essayId: openClass.essayId,
    title: detail.essayTitle,
    genre: detail.essayGenre,
    essayDescription: essay?.description ?? "",
    durationMinutes: openClass.durationMinutes,
    supplemental: openClass.supplemental,
    groups: groups.map((group) => ({ ...group, members: [...group.members] })),
    courseStatus: getCourseStatus(openClass.id)
  };
}

export function getCourseStatus(activityId: string): "not_started" | "in_progress" | "paused" | "ended" {
  return courseStatusMap[activityId] ?? "not_started";
}

export function startCourse(activityId: string): { ok: true; status: "in_progress" } | { ok: false; error: string } {
  const activity = findActivity(activityId);
  if (!activity) {
    return { ok: false, error: "activity_not_found" };
  }

  const current = getCourseStatus(activityId);
  if (current !== "not_started") {
    return { ok: false, error: "course_already_started" };
  }

  courseStatusMap[activityId] = "in_progress";
  return { ok: true, status: "in_progress" };
}

export function togglePauseOrResumeCourse(
  activityId: string
): { ok: true; status: "in_progress" | "paused" } | { ok: false; error: string } {
  const activity = findActivity(activityId);
  if (!activity) {
    return { ok: false, error: "activity_not_found" };
  }

  const current = getCourseStatus(activityId);
  if (current === "not_started") {
    return { ok: false, error: "course_not_started" };
  }

  if (current === "in_progress") {
    courseStatusMap[activityId] = "paused";
    return { ok: true, status: "paused" };
  }

  courseStatusMap[activityId] = "in_progress";
  return { ok: true, status: "in_progress" };
}

export function endCourse(activityId: string): { ok: true; status: "ended" } | { ok: false; error: string } {
  const activity = findActivity(activityId);
  if (!activity) {
    return { ok: false, error: "activity_not_found" };
  }

  const current = getCourseStatus(activityId);
  if (current === "not_started") {
    return { ok: false, error: "course_not_started" };
  }
  if (current === "ended") {
    return { ok: false, error: "course_already_ended" };
  }
  courseStatusMap[activityId] = "ended";
  return { ok: true, status: "ended" };
}

function getTeacherProfile(teacherUsername: string): UserAccount | undefined {
  return users.find((user) => user.username === teacherUsername && user.role === "teacher");
}

function getStudentsBySchoolAndClass(school: string, classNumber: string): UserAccount[] {
  return users.filter((user) => user.role === "student" && user.school === school && user.classNumber === classNumber);
}

export function getStudentUsernamesForActivityClass(activityId: string): string[] {
  const activity = findActivity(activityId);
  if (!activity) return [];
  return getStudentsBySchoolAndClass(activity.school, activity.classNumber).map((student) => student.username);
}

export function resolvePromptConfigForActivity(activityId: string): PromptConfig {
  const activity = findActivity(activityId);
  if (!activity) {
    return {
      systemPrompt: undefined,
      stepPrompts: {},
      subStepPrompts: {},
      subStepPromptsFallbacks: {},
      questionBanks: {},
      step9Questions: {}
    };
  }

  const raw = systemPromptConfig as RawSystemPromptConfig;
  const systemPrompt = typeof raw.systemPrompt === "string" ? raw.systemPrompt : undefined;
  const stepPrompts = { ...(raw.stepPrompts ?? {}) };
  const subStepPrompts = { ...(raw.subStepPrompts ?? {}) };
  const subStepPromptsFallbacks = { ...(raw.subStepPrompts_fallbacks ?? {}) };
  const baseQuestionBanks = Object.fromEntries(
    Object.entries(raw.questionBanks ?? {}).map(([key, value]) => [
      key,
      Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []
    ])
  ) as Record<string, string[]>;
  const step9Questions = Object.fromEntries(
    Object.entries(raw.step9Questions ?? {})
      .filter(([key, value]) => ["1", "2", "3", "4"].includes(key) && typeof value === "string")
      .map(([key, value]) => [key, value])
  ) as Record<string, string>;

  const taskBanks = raw.writingTasks ?? {};
  const matchedTask =
    taskBanks[activity.essayId] ??
    taskBanks[activity.title] ??
    Object.entries(taskBanks).find(([key]) => key.trim() === activity.title.trim())?.[1];
  const scopedQuestionBanks = Object.fromEntries(
    Object.entries(matchedTask?.questionBanks ?? {}).map(([key, value]) => [
      key,
      Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []
    ])
  ) as Record<string, string[]>;

  return {
    systemPrompt,
    stepPrompts,
    subStepPrompts,
    subStepPromptsFallbacks,
    questionBanks: { ...baseQuestionBanks, ...scopedQuestionBanks },
    step9Questions,
    stepOpenings: stepOpeningTexts
  };
}

export function getUsers(): UserAccount[] {
  return users;
}

export function getStudentUsers(): UserAccount[] {
  return users.filter((user) => user.role === "student");
}

export function getTeacherUsers(): UserAccount[] {
  return users.filter((user) => user.role === "teacher");
}

export function getUsersVisibleToTeacher(teacherUsername: string): UserAccount[] {
  return users.filter((user) => {
    if (user.username === teacherUsername && user.role === "teacher") return true;
    return user.role === "student" && user.ownerTeacherUsername === teacherUsername;
  });
}

export function getClassNumbersForTeacher(teacherUsername: string): string[] {
  return Array.from(
    new Set(
      users
        .filter((user) => user.role === "student" && user.ownerTeacherUsername === teacherUsername)
        .map((user) => user.classNumber)
        .filter((value): value is string => Boolean(value))
    )
  ).sort();
}

export function getClassStudentsForTeacher(teacherUsername: string, classNumber: string): UserAccount[] {
  return users.filter(
    (user) => user.role === "student" && user.ownerTeacherUsername === teacherUsername && user.classNumber === classNumber
  );
}

export function getUser(username: string): UserAccount | undefined {
  return users.find((user) => user.username === username);
}

export function validateUserCredential(username: string, password: string): UserAccount | undefined {
  const user = getUser(username);
  if (!user) return undefined;
  if (userPasswords[username] !== password) return undefined;
  return user;
}

export function getEssays() {
  return essays;
}

export function getOpenClasses() {
  return openClasses.map((openClass) => toOpenClassView(openClass));
}

export function getOpenClassesVisibleToTeacher(teacherUsername: string) {
  const teacher = getTeacherProfile(teacherUsername);
  if (!teacher) return [];

  const allowedClassNumbers = new Set(getClassNumbersForTeacher(teacherUsername));
  return getOpenClasses().filter(
    (item) => item.school === teacher.school && allowedClassNumbers.has(item.classNumber)
  );
}

export function getActivitiesForStudent(username: string): Activity[] {
  return getAllActivities().filter((activity) => activity.groups.some((group) => group.members.includes(username)));
}

export function getAllActivities(): Activity[] {
  return openClasses.map((openClass) => toActivity(openClass));
}

export function getActivitiesVisibleToTeacher(teacherUsername: string): Activity[] {
  const teacher = getTeacherProfile(teacherUsername);
  if (!teacher) return [];

  const allowedClassNumbers = new Set(getClassNumbersForTeacher(teacherUsername));
  return getAllActivities().filter(
    (activity) => activity.school === teacher.school && allowedClassNumbers.has(activity.classNumber)
  );
}

export function findActivity(activityId: string): Activity | undefined {
  const openClass = openClasses.find((item) => item.id === activityId);
  if (!openClass) return undefined;
  return toActivity(openClass);
}

export function getGroupCandidatesForActivity(activityId: string, requester: { role: "teacher" | "admin"; username: string }): UserAccount[] {
  const activity = findActivity(activityId);
  if (!activity) return [];

  if (requester.role === "admin") {
    return getStudentsBySchoolAndClass(activity.school, activity.classNumber);
  }

  return getClassStudentsForTeacher(requester.username, activity.classNumber).filter(
    (student) => student.school === activity.school
  );
}

export function updateActivityGroups(activityId: string, groups: ActivityGroup[], allowedStudents?: string[]): Activity | undefined {
  const activity = findActivity(activityId);
  if (!activity) {
    return undefined;
  }

  const validStudents = new Set(allowedStudents ?? getStudentUsers().map((student) => student.username));
  const seen = new Set<string>();

  const sanitizedGroups = groups.map((group, idx) => {
    const uniqueMembers = group.members.filter((member) => {
      if (!validStudents.has(member)) return false;
      if (seen.has(member)) return false;
      seen.add(member);
      return true;
    });

    const parsed = Number.parseInt((group.groupName ?? "").replace(/\D+/g, ""), 10);
    const numericName = Number.isFinite(parsed) && parsed > 0 ? String(parsed) : String(idx + 1);

    return {
      groupId: group.groupId || `g${idx + 1}`,
      groupName: numericName,
      members: uniqueMembers
    };
  });

  activityGroupMap[activityId] = sanitizedGroups;
  return findActivity(activityId);
}

export function upsertEssay(input: {
  id?: string;
  title: string;
  genre: string;
  description: string;
  enabled: boolean;
}) {
  if (input.id) {
    const existing = essays.find((essay) => essay.id === input.id);
    if (existing) {
      existing.title = input.title;
      existing.genre = input.genre;
      existing.description = input.description;
      existing.enabled = input.enabled;
      return existing;
    }
  }

  const nextEssayId = (() => {
    const maxId = essays.reduce((max, essay) => {
      const match = /^essay-(\d+)$/.exec(essay.id);
      if (!match) return max;
      const parsed = Number.parseInt(match[1] ?? "0", 10);
      return Number.isFinite(parsed) ? Math.max(max, parsed) : max;
    }, 0);
    return `essay-${maxId + 1}`;
  })();

  const created = {
    id: nextEssayId,
    title: input.title,
    genre: input.genre,
    description: input.description,
    enabled: input.enabled
  };
  essays.push(created);
  return created;
}

export function upsertOpenClass(input: {
  id?: string;
  school: string;
  classNumber: string;
  essayId: string;
  durationMinutes: number;
  supplemental: string;
}) {
  const essay = findEssay(input.essayId);
  if (!essay) {
    return { ok: false as const, error: "essay_not_found" };
  }

  const existing = input.id ? openClasses.find((openClass) => openClass.id === input.id) : undefined;
  const canReuseDisabledEssay = Boolean(existing && existing.essayId === input.essayId);
  if (!essay.enabled && !canReuseDisabledEssay) {
    return { ok: false as const, error: "essay_disabled" };
  }

  if (input.id) {
    if (existing) {
      existing.school = input.school;
      existing.classNumber = input.classNumber;
      existing.essayId = input.essayId;
      existing.durationMinutes = input.durationMinutes;
      existing.supplemental = input.supplemental;
      return { ok: true as const, saved: toOpenClassView(existing) };
    }
  }

  const created: OpenClassTask = {
    id: `oc-${String(openClasses.length + 1).padStart(3, "0")}`,
    school: input.school,
    classNumber: input.classNumber,
    essayId: input.essayId,
    durationMinutes: input.durationMinutes,
    supplemental: input.supplemental
  };
  openClasses.push(created);
  activityGroupMap[created.id] = activityGroupMap[created.id] ?? [];
  courseStatusMap[created.id] = "not_started";
  return { ok: true as const, saved: toOpenClassView(created) };
}

export function resetUserPassword(username: string, newPassword: string) {
  if (!users.some((user) => user.username === username)) {
    return false;
  }
  userPasswords[username] = newPassword;
  return true;
}

export function createUserAccount(input: {
  username: string;
  name: string;
  school: string;
  role: "student" | "teacher" | "admin";
  password: string;
  ownerTeacherUsername?: string;
  classNumber?: string;
}) {
  if (users.some((user) => user.username === input.username)) {
    return { ok: false as const, error: "username_exists" };
  }

  if (input.role === "student") {
    if (!input.ownerTeacherUsername) {
      return { ok: false as const, error: "missing_owner_teacher" };
    }
    if (!input.classNumber) {
      return { ok: false as const, error: "missing_class_number" };
    }
    const owner = users.find((user) => user.username === input.ownerTeacherUsername && user.role === "teacher");
    if (!owner) {
      return { ok: false as const, error: "owner_teacher_not_found" };
    }
    const hasTeacherConflict = users.some(
      (user) =>
        user.role === "student" &&
        user.school === input.school &&
        user.classNumber === input.classNumber &&
        user.ownerTeacherUsername &&
        user.ownerTeacherUsername !== input.ownerTeacherUsername
    );
    if (hasTeacherConflict) {
      return { ok: false as const, error: "class_owner_teacher_conflict" };
    }
  }

  users.push({
    username: input.username,
    name: input.name,
    school: input.school,
    role: input.role,
    ownerTeacherUsername: input.role === "student" ? input.ownerTeacherUsername : undefined,
    classNumber: input.role === "student" ? input.classNumber : undefined
  });
  userPasswords[input.username] = input.password;

  return { ok: true as const };
}

export function updateUserAccount(
  username: string,
  patch: {
    name?: string;
    school?: string;
    role?: "student" | "teacher" | "admin";
    password?: string;
    ownerTeacherUsername?: string;
    classNumber?: string;
  }
) {
  const user = users.find((item) => item.username === username);
  if (!user) {
    return { ok: false as const, error: "user_not_found" };
  }

  if (patch.role === "student" || user.role === "student") {
    const nextRole = patch.role ?? user.role;
    const nextOwnerTeacherUsername =
      patch.ownerTeacherUsername !== undefined ? patch.ownerTeacherUsername : user.ownerTeacherUsername;
    const nextClassNumber = patch.classNumber !== undefined ? patch.classNumber : user.classNumber;

    if (nextRole === "student") {
      if (!nextOwnerTeacherUsername) {
        return { ok: false as const, error: "missing_owner_teacher" };
      }
      if (!nextClassNumber) {
        return { ok: false as const, error: "missing_class_number" };
      }
      const owner = users.find((item) => item.username === nextOwnerTeacherUsername && item.role === "teacher");
      if (!owner) {
        return { ok: false as const, error: "owner_teacher_not_found" };
      }
      const targetSchool = patch.school ?? user.school;
      const hasTeacherConflict = users.some(
        (item) =>
          item.username !== username &&
          item.role === "student" &&
          item.school === targetSchool &&
          item.classNumber === nextClassNumber &&
          item.ownerTeacherUsername &&
          item.ownerTeacherUsername !== nextOwnerTeacherUsername
      );
      if (hasTeacherConflict) {
        return { ok: false as const, error: "class_owner_teacher_conflict" };
      }
      user.ownerTeacherUsername = nextOwnerTeacherUsername;
      user.classNumber = nextClassNumber;
    } else {
      user.ownerTeacherUsername = undefined;
      user.classNumber = undefined;
    }
  }

  if (patch.name !== undefined) user.name = patch.name;
  if (patch.school !== undefined) user.school = patch.school;
  if (patch.role !== undefined) user.role = patch.role;
  if (patch.password !== undefined) userPasswords[username] = patch.password;
  if (patch.ownerTeacherUsername !== undefined && user.role === "student") {
    user.ownerTeacherUsername = patch.ownerTeacherUsername;
  }
  if (patch.classNumber !== undefined && user.role === "student") {
    user.classNumber = patch.classNumber;
  }

  if (user.role !== "student") {
    Object.keys(activityGroupMap).forEach((activityId) => {
      activityGroupMap[activityId] = (activityGroupMap[activityId] ?? []).map((group) => ({
        ...group,
        members: group.members.filter((member) => member !== username)
      }));
    });
  }

  return { ok: true as const };
}

export function deleteUserAccount(username: string) {
  const index = users.findIndex((user) => user.username === username);
  if (index < 0) {
    return { ok: false as const, error: "user_not_found" };
  }

  const target = users[index]!;
  if (target.role === "teacher") {
    const hasStudents = users.some((user) => user.role === "student" && user.ownerTeacherUsername === target.username);
    if (hasStudents) {
      return { ok: false as const, error: "teacher_has_students" };
    }
  }

  users.splice(index, 1);
  delete userPasswords[username];

  Object.keys(activityGroupMap).forEach((activityId) => {
    activityGroupMap[activityId] = (activityGroupMap[activityId] ?? []).map((group) => ({
      ...group,
      members: group.members.filter((member) => member !== username)
    }));
  });

  return { ok: true as const };
}
