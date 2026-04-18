import { Activity, UserAccount } from "@/src/lib/types";

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

export function getUsers(): UserAccount[] {
  return users;
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
