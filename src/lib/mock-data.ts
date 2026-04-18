import { Activity, ActivityGroup, PromptConfig, UserAccount } from "@/src/lib/types";

const users: UserAccount[] = [
  { username: "student", name: "Student One", school: "Demo High", role: "student" },
  { username: "s1", name: "S1", school: "Demo High", role: "student" },
  { username: "s2", name: "S2", school: "Demo High", role: "student" },
  { username: "s3", name: "S3", school: "Demo High", role: "student" },
  { username: "teacher", name: "Teacher One", school: "Demo High", role: "teacher" }
];

const activities: Activity[] = [
  {
    id: "oc-001",
    className: "701",
    title: "科技與生活",
    genre: "議論文",
    durationMinutes: 45,
    supplemental: "聚焦 AI 對日常生活的改變，先盤點正反觀點。",
    groups: [
      { groupId: "g1", groupName: "第一組", members: ["student", "s1", "s2"] },
      { groupId: "g2", groupName: "第二組", members: ["s3"] }
    ]
  },
  {
    id: "oc-002",
    className: "702",
    title: "我最想改變的校園角落",
    genre: "說明文",
    durationMinutes: 40,
    supplemental: "描述問題、提出可行方案、評估影響。",
    groups: [{ groupId: "g1", groupName: "觀察組", members: ["student", "s3"] }]
  }
];

const userPasswords: Record<string, string> = {
  student: "student123",
  s1: "student123",
  s2: "student123",
  s3: "student123",
  teacher: "teacher123"
};

const essays = [
  { id: "essay-1", title: "科技與生活", genre: "議論文", description: "科技改變生活的利弊分析", enabled: true },
  { id: "essay-2", title: "我的校園角落", genre: "說明文", description: "校園問題觀察與改善", enabled: true }
];

const openClasses = [
  { id: "oc-001", className: "701", essayTitle: "科技與生活", durationMinutes: 45, supplemental: "AI 與日常" },
  { id: "oc-002", className: "702", essayTitle: "我的校園角落", durationMinutes: 40, supplemental: "觀察與提案" }
];

const essayPromptConfigs: Record<string, PromptConfig> = {
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

const openClassPromptConfigs: Record<string, PromptConfig> = {
  "oc-001": {
    stepPrompts: {
      "1": "701 班專用：先釐清科技影響面向（學習/社交/生活）。"
    },
    subStepPrompts: {},
    questionBanks: {}
  }
};

function mergePromptConfig(base: PromptConfig, override: PromptConfig): PromptConfig {
  return {
    stepPrompts: { ...base.stepPrompts, ...override.stepPrompts },
    subStepPrompts: { ...base.subStepPrompts, ...override.subStepPrompts },
    questionBanks: { ...base.questionBanks, ...override.questionBanks }
  };
}

export function resolvePromptConfigForActivity(activityId: string): PromptConfig {
  const openClass = openClasses.find((item) => item.id === activityId);
  const essay = essays.find((item) => item.title === openClass?.essayTitle);

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
  return openClasses;
}

export function getActivitiesForStudent(username: string): Activity[] {
  return activities.filter((activity) => activity.groups.some((group) => group.members.includes(username)));
}

export function getAllActivities(): Activity[] {
  return activities;
}

export function findActivity(activityId: string): Activity | undefined {
  return activities.find((activity) => activity.id === activityId);
}

export function updateActivityGroups(activityId: string, groups: ActivityGroup[]): Activity | undefined {
  const activity = findActivity(activityId);
  if (!activity) {
    return undefined;
  }

  const studentSet = new Set(getStudentUsers().map((student) => student.username));
  const seen = new Set<string>();

  const sanitizedGroups = groups.map((group, idx) => {
    const uniqueMembers = group.members.filter((member) => {
      if (!studentSet.has(member)) return false;
      if (seen.has(member)) return false;
      seen.add(member);
      return true;
    });

    return {
      groupId: group.groupId || `g${idx + 1}`,
      groupName: group.groupName || `第${idx + 1}組`,
      members: uniqueMembers
    };
  });

  activity.groups = sanitizedGroups;
  return activity;
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
  className: string;
  essayTitle: string;
  durationMinutes: number;
  supplemental: string;
}) {
  if (input.id) {
    const existing = openClasses.find((openClass) => openClass.id === input.id);
    if (existing) {
      existing.className = input.className;
      existing.essayTitle = input.essayTitle;
      existing.durationMinutes = input.durationMinutes;
      existing.supplemental = input.supplemental;
      return existing;
    }
  }

  const created = {
    id: `oc-${String(openClasses.length + 1).padStart(3, "0")}`,
    className: input.className,
    essayTitle: input.essayTitle,
    durationMinutes: input.durationMinutes,
    supplemental: input.supplemental
  };
  openClasses.push(created);
  return created;
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
  role: "student" | "teacher";
  password: string;
}) {
  if (users.some((user) => user.username === input.username)) {
    return { ok: false as const, error: "username_exists" };
  }

  users.push({
    username: input.username,
    name: input.name,
    school: input.school,
    role: input.role
  });
  userPasswords[input.username] = input.password;

  return { ok: true as const };
}

export function updateUserAccount(
  username: string,
  patch: {
    name?: string;
    school?: string;
    role?: "student" | "teacher";
    password?: string;
  }
) {
  const user = users.find((item) => item.username === username);
  if (!user) {
    return { ok: false as const, error: "user_not_found" };
  }

  if (patch.name !== undefined) user.name = patch.name;
  if (patch.school !== undefined) user.school = patch.school;
  if (patch.role !== undefined) user.role = patch.role;
  if (patch.password !== undefined) userPasswords[username] = patch.password;

  if (user.role !== "student") {
    activities.forEach((activity) => {
      activity.groups.forEach((group) => {
        group.members = group.members.filter((member) => member !== username);
      });
    });
  }

  return { ok: true as const };
}

export function deleteUserAccount(username: string) {
  const index = users.findIndex((user) => user.username === username);
  if (index < 0) {
    return { ok: false as const, error: "user_not_found" };
  }

  users.splice(index, 1);
  delete userPasswords[username];

  activities.forEach((activity) => {
    activity.groups.forEach((group) => {
      group.members = group.members.filter((member) => member !== username);
    });
  });

  return { ok: true as const };
}
