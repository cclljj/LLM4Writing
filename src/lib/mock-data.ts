import { Activity, ActivityGroup, PromptConfig, UserAccount } from "@/src/lib/types";
import postgres, { Sql } from "postgres";

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

type DomainState = {
  users: UserAccount[];
  userPasswords: Record<string, string>;
  essays: Essay[];
  openClasses: OpenClassTask[];
  activityGroupMap: Record<string, ActivityGroup[]>;
  courseStatusMap: Record<string, "not_started" | "in_progress" | "ended">;
  essayPromptConfigs: Record<string, PromptConfig>;
  openClassPromptConfigs: Record<string, PromptConfig>;
};

const KEY = "__llm4writing_domain_state__";

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

const defaultEssays: Essay[] = [
  { id: "essay-1", title: "科技與生活", genre: "議論文", description: "科技改變生活的利弊分析", enabled: true },
  { id: "essay-2", title: "我的校園角落", genre: "說明文", description: "校園問題觀察與改善", enabled: true }
];

const defaultOpenClasses: OpenClassTask[] = [
  { id: "oc-001", school: "Demo High", classNumber: "701", essayId: "essay-1", durationMinutes: 45, supplemental: "AI 與日常" },
  { id: "oc-002", school: "Demo High", classNumber: "702", essayId: "essay-2", durationMinutes: 40, supplemental: "觀察與提案" }
];

const defaultActivityGroupMap: Record<string, ActivityGroup[]> = {
  "oc-001": [
    { groupId: "g1", groupName: "1", members: ["student", "s1", "s2"] },
    { groupId: "g2", groupName: "2", members: ["s3"] }
  ],
  "oc-002": [{ groupId: "g1", groupName: "1", members: ["student", "s3"] }]
};

const defaultCourseStatusMap: Record<string, "not_started" | "in_progress" | "ended"> = {
  "oc-001": "not_started",
  "oc-002": "not_started"
};

const defaultEssayPromptConfigs: Record<string, PromptConfig> = {
  "essay-1": {
    stepPrompts: {
      "1": "你是引導討論助教，請聚焦題意澄清。",
      "2": "引導蒐集論據，提醒資料來源。",
      "3": "協助產生可辯護的論點。",
      "4": "引導比較組員觀點並修正。",
      "5": "總結前四步重點並形成摘要。",
      "6": "引導學生完成作文初稿。",
      "7": "分析初稿的論點、結構、語言。",
      "8": "指導潤飾與修訂。",
      "9": "反思提問由系統執行。",
      "10": "輸出完整總結報告。"
    },
    subStepPrompts: {
      "1-3": "請從立場差異切入，提出追問。",
      "1-4": "請要求學生補足可驗證證據。",
      "2-1": "引導學生先列出可查證資料類型。",
      "2-2": "引導學生評估資料可信度。",
      "2-3": "引導學生整理支持/反對資料。"
    },
    questionBanks: {
      "1-1": ["題目中的關鍵詞有哪些？", "這個題目要解決什麼問題？"],
      "1-2": ["你目前最直覺的立場是什麼？", "有沒有可能的反方觀點？"],
      "1-5": ["請總結你們小組目前的共同結論。"],
      "2-4": ["請分享一則可支持你論點的具體案例。"]
    }
  }
};

const defaultOpenClassPromptConfigs: Record<string, PromptConfig> = {
  "oc-001": {
    stepPrompts: {
      "1": "701 班專用：先釐清科技影響面向（學習/社交/生活）。"
    },
    subStepPrompts: {},
    questionBanks: {}
  }
};

function cloneState(): DomainState {
  return {
    users: defaultUsers.map((user) => ({ ...user })),
    userPasswords: { ...defaultUserPasswords },
    essays: defaultEssays.map((essay) => ({ ...essay })),
    openClasses: defaultOpenClasses.map((openClass) => ({ ...openClass })),
    activityGroupMap: JSON.parse(JSON.stringify(defaultActivityGroupMap)) as Record<string, ActivityGroup[]>,
    courseStatusMap: { ...defaultCourseStatusMap },
    essayPromptConfigs: JSON.parse(JSON.stringify(defaultEssayPromptConfigs)) as Record<string, PromptConfig>,
    openClassPromptConfigs: JSON.parse(JSON.stringify(defaultOpenClassPromptConfigs)) as Record<string, PromptConfig>
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
const essayPromptConfigs = state.essayPromptConfigs;
const openClassPromptConfigs = state.openClassPromptConfigs;

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
    sqlClient = postgres(url, { prepare: true, max: 1 });
  }
  return sqlClient;
}

let domainInitPromise: Promise<void> | undefined;

async function ensureDomainTable(): Promise<void> {
  if (!isPostgresEnabled()) return;
  if (!domainInitPromise) {
    domainInitPromise = (async () => {
      const sql = getSqlClient();
      await sql`
        CREATE TABLE IF NOT EXISTS llm4writing_domain (
          id TEXT PRIMARY KEY,
          payload JSONB NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;
    })();
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

  Object.keys(essayPromptConfigs).forEach((key) => delete essayPromptConfigs[key]);
  Object.entries(next.essayPromptConfigs).forEach(([key, value]) => {
    essayPromptConfigs[key] = JSON.parse(JSON.stringify(value)) as PromptConfig;
  });

  Object.keys(openClassPromptConfigs).forEach((key) => delete openClassPromptConfigs[key]);
  Object.entries(next.openClassPromptConfigs).forEach(([key, value]) => {
    openClassPromptConfigs[key] = JSON.parse(JSON.stringify(value)) as PromptConfig;
  });
}

function snapshotState(): DomainState {
  return {
    users: users.map((item) => ({ ...item })),
    userPasswords: { ...userPasswords },
    essays: essays.map((item) => ({ ...item })),
    openClasses: openClasses.map((item) => ({ ...item })),
    activityGroupMap: JSON.parse(JSON.stringify(activityGroupMap)) as Record<string, ActivityGroup[]>,
    courseStatusMap: { ...courseStatusMap },
    essayPromptConfigs: JSON.parse(JSON.stringify(essayPromptConfigs)) as Record<string, PromptConfig>,
    openClassPromptConfigs: JSON.parse(JSON.stringify(openClassPromptConfigs)) as Record<string, PromptConfig>
  };
}

export async function hydrateDomainState(): Promise<void> {
  if (!isPostgresEnabled()) return;
  await ensureDomainTable();
  const sql = getSqlClient();
  const rows = await sql<{ payload: DomainState }[]>`
    SELECT payload
    FROM llm4writing_domain
    WHERE id = 'singleton'
    LIMIT 1
  `;
  const row = rows[0];
  if (!row?.payload) {
    await flushDomainState();
    return;
  }
  applyState(row.payload);
}

export async function flushDomainState(): Promise<void> {
  if (!isPostgresEnabled()) return;
  await ensureDomainTable();
  const sql = getSqlClient();
  await sql`
    INSERT INTO llm4writing_domain (id, payload)
    VALUES ('singleton', ${JSON.stringify(snapshotState())}::jsonb)
    ON CONFLICT (id)
    DO UPDATE SET
      payload = EXCLUDED.payload,
      updated_at = NOW()
  `;
}

function mergePromptConfig(base: PromptConfig, override: PromptConfig): PromptConfig {
  return {
    stepPrompts: { ...base.stepPrompts, ...override.stepPrompts },
    subStepPrompts: { ...base.subStepPrompts, ...override.subStepPrompts },
    questionBanks: { ...base.questionBanks, ...override.questionBanks }
  };
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
  const groups = activityGroupMap[openClass.id] ?? [];

  return {
    id: openClass.id,
    school: openClass.school,
    classNumber: openClass.classNumber,
    essayId: openClass.essayId,
    title: detail.essayTitle,
    genre: detail.essayGenre,
    durationMinutes: openClass.durationMinutes,
    supplemental: openClass.supplemental,
    groups: groups.map((group) => ({ ...group, members: [...group.members] })),
    courseStatus: getCourseStatus(openClass.id)
  };
}

export function getCourseStatus(activityId: string): "not_started" | "in_progress" | "ended" {
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

export function resolvePromptConfigForActivity(activityId: string): PromptConfig {
  const openClass = openClasses.find((item) => item.id === activityId);
  const essay = openClass ? findEssay(openClass.essayId) : undefined;

  const base: PromptConfig = essay ? getEssayPromptConfig(essay.id) : { stepPrompts: {}, subStepPrompts: {}, questionBanks: {} };
  const override: PromptConfig = openClass ? getOpenClassPromptConfig(openClass.id) : { stepPrompts: {}, subStepPrompts: {}, questionBanks: {} };

  return mergePromptConfig(base, override);
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

export function getEssayPromptConfig(essayId: string): PromptConfig {
  return (
    essayPromptConfigs[essayId] ?? {
      stepPrompts: {},
      subStepPrompts: {},
      questionBanks: {}
    }
  );
}

export function saveEssayPromptConfig(essayId: string, config: PromptConfig): PromptConfig {
  essayPromptConfigs[essayId] = config;
  return essayPromptConfigs[essayId];
}

export function getOpenClassPromptConfig(openClassId: string): PromptConfig {
  return (
    openClassPromptConfigs[openClassId] ?? {
      stepPrompts: {},
      subStepPrompts: {},
      questionBanks: {}
    }
  );
}

export function saveOpenClassPromptConfig(openClassId: string, config: PromptConfig): PromptConfig {
  openClassPromptConfigs[openClassId] = config;
  return openClassPromptConfigs[openClassId];
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

  const created = {
    id: `essay-${essays.length + 1}`,
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
