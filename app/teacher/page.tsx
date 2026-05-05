"use client";

import { DragEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";

type UserRow = { username: string; name: string; school: string; role: string; ownerTeacherUsername?: string; classNumber?: string };
type EssayRow = {
  id: string;
  title: string;
  genre: string;
  description: string;
  enabled: boolean;
};
type OpenClassRow = {
  id: string;
  school: string;
  classNumber: string;
  essayId: string;
  essayTitle: string;
  durationMinutes: number;
  supplemental: string;
};
type ActivityGroup = { groupId: string; groupName: string; members: string[] };
type ActivityRow = {
  id: string;
  school: string;
  classNumber: string;
  essayId: string;
  title: string;
  genre: string;
  durationMinutes: number;
  supplemental: string;
  groups: ActivityGroup[];
  studentCandidates?: string[];
  courseStatus?: "not_started" | "in_progress" | "paused" | "ended";
};

type MonitorSession = {
  sessionId: string;
  activityId?: string;
  activityTitle?: string;
  school?: string;
  classNumber?: string;
  groupId?: string;
  groupName?: string;
  participants: string[];
  joinedUsers?: string[];
  onlineUsers?: string[];
  currentStep: number;
  personalSteps?: Record<string, number>;
  groupGate?: Record<string, string[]>;
  stepState?: { step1Substep: number; step2Substep: number };
  reflectionIndex?: Record<string, number>;
  messages: Array<{ id: string; role: string; userId?: string; text: string; at: string; step: number }>;
};

type PersonalProgressRow = {
  username: string;
  currentStep: number;
  messageCount: number;
  lastMessageAt: string | null;
};

type OutlineNode = {
  id: string;
  parentId: string | null;
  text: string;
  x: number;
  y: number;
};

type OutlinePreview = {
  nodes: OutlineNode[];
  width: number;
  height: number;
};

const genreOptions = ["議論文", "記敘文", "說明文", "抒情文", "其他"];
const groupInteractionSteps = [1, 2, 4];
type CourseTab = "essay" | "openclass" | "group";

function escapeHtml(input: string): string {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function applyInlineMarkdown(input: string): string {
  return input
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/__(.+?)__/g, "<strong>$1</strong>")
    .replace(/_(.+?)_/g, "<em>$1</em>");
}

function renderMessageHtml(text: string): string {
  const lines = text.split(/\r?\n/);
  const htmlParts: string[] = [];
  let unorderedListBuffer: string[] = [];
  let orderedListBuffer: string[] = [];

  const flushLists = () => {
    if (unorderedListBuffer.length > 0) {
      htmlParts.push(`<ul>${unorderedListBuffer.join("")}</ul>`);
      unorderedListBuffer = [];
    }
    if (orderedListBuffer.length > 0) {
      htmlParts.push(`<ol>${orderedListBuffer.join("")}</ol>`);
      orderedListBuffer = [];
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      flushLists();
      continue;
    }

    const escaped = applyInlineMarkdown(escapeHtml(line));
    if (escaped.startsWith("- ") || escaped.startsWith("* ")) {
      orderedListBuffer = [];
      unorderedListBuffer.push(`<li>${escaped.slice(2)}</li>`);
      continue;
    }
    const ordered = escaped.match(/^\d+\.\s+(.+)$/);
    if (ordered) {
      unorderedListBuffer = [];
      orderedListBuffer.push(`<li>${ordered[1]}</li>`);
      continue;
    }

    flushLists();

    const h1 = escaped.match(/^#\s+(.+)$/);
    if (h1) {
      htmlParts.push(`<h2 style="margin:10px 0 6px;">${h1[1]}</h2>`);
      continue;
    }
    const h2 = escaped.match(/^##\s+(.+)$/);
    if (h2) {
      htmlParts.push(`<h3 style="margin:9px 0 5px;">${h2[1]}</h3>`);
      continue;
    }

    const h3 = escaped.match(/^###\s+(.+)$/);
    if (h3) {
      htmlParts.push(`<h4 style="margin:8px 0 4px;">${h3[1]}</h4>`);
      continue;
    }
    const h4 = escaped.match(/^####\s+(.+)$/);
    if (h4) {
      htmlParts.push(`<h5 style="margin:8px 0 4px;">${h4[1]}</h5>`);
      continue;
    }
    const quote = escaped.match(/^>\s?(.+)$/);
    if (quote) {
      htmlParts.push(`<blockquote style="margin:6px 0; padding-left:10px; border-left:3px solid #cbd5e1;">${quote[1]}</blockquote>`);
      continue;
    }

    htmlParts.push(`<p style="margin:6px 0;">${escaped}</p>`);
  }

  flushLists();
  return htmlParts.join("");
}

function extractMermaidText(text: string): string | null {
  const fenced = text.match(/```mermaid\s*([\s\S]*?)```/i);
  if (fenced?.[1]?.trim()) return fenced[1].trim();
  const trimmed = text.trim();
  if ((trimmed.includes("graph ") || trimmed.includes("flowchart ")) && trimmed.includes("-->")) {
    return trimmed;
  }
  return null;
}

function fromMermaid(text: string): OutlineNode[] {
  const raw = text.trim();
  if (!raw) return [];
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !line.startsWith("graph "))
    .filter((line) => !line.startsWith("flowchart "))
    .filter((line) => !line.startsWith("```"));

  const nodeTextMap = new Map<string, string>();
  const parentMap = new Map<string, string | null>();

  for (const line of lines) {
    const nodeMatch = line.match(/^([A-Za-z0-9_-]+)\s*\["([\s\S]*)"\]$/);
    if (nodeMatch) {
      const [, id, label] = nodeMatch;
      nodeTextMap.set(id, label.replaceAll('\\"', '"').replace(/<br\s*\/?>/gi, "\n"));
      if (!parentMap.has(id)) parentMap.set(id, null);
      continue;
    }
    const edgeWithLabelMatch = line.match(/^([A-Za-z0-9_-]+)\s*-->\s*([A-Za-z0-9_-]+)\s*\["([\s\S]*)"\]$/);
    if (edgeWithLabelMatch) {
      const [, parentId, childId, childLabel] = edgeWithLabelMatch;
      parentMap.set(childId, parentId);
      if (!parentMap.has(parentId)) parentMap.set(parentId, null);
      if (!nodeTextMap.has(parentId)) nodeTextMap.set(parentId, parentId);
      nodeTextMap.set(childId, childLabel.replaceAll('\\"', '"').replace(/<br\s*\/?>/gi, "\n"));
      continue;
    }
    const edgeMatch = line.match(/^([A-Za-z0-9_-]+)\s*-->\s*([A-Za-z0-9_-]+)$/);
    if (edgeMatch) {
      const [, parentId, childId] = edgeMatch;
      parentMap.set(childId, parentId);
      if (!parentMap.has(parentId)) parentMap.set(parentId, null);
      if (!nodeTextMap.has(parentId)) nodeTextMap.set(parentId, parentId);
      if (!nodeTextMap.has(childId)) nodeTextMap.set(childId, childId);
    }
  }

  const ids = Array.from(nodeTextMap.keys());
  if (ids.length === 0) return [];

  const depthMap = new Map<string, number>();
  const getDepth = (id: string): number => {
    const cached = depthMap.get(id);
    if (cached) return cached;
    const parent = parentMap.get(id);
    const depth = parent ? getDepth(parent) + 1 : 1;
    depthMap.set(id, depth);
    return depth;
  };
  ids.forEach((id) => getDepth(id));

  const groups = new Map<number, string[]>();
  ids.forEach((id) => {
    const depth = depthMap.get(id) ?? 1;
    const arr = groups.get(depth) ?? [];
    arr.push(id);
    groups.set(depth, arr);
  });

  const nodes: OutlineNode[] = [];
  Array.from(groups.keys())
    .sort((a, b) => a - b)
    .forEach((depth) => {
      const levelIds = groups.get(depth) ?? [];
      levelIds.sort();
      levelIds.forEach((id, idx) => {
        nodes.push({
          id,
          parentId: parentMap.get(id) ?? null,
          text: nodeTextMap.get(id) ?? id,
          x: 120 + idx * 170,
          y: 40 + (depth - 1) * 120
        });
      });
    });
  return nodes;
}

function buildOutlinePreview(mermaidText: string): OutlinePreview | null {
  const nodes = fromMermaid(mermaidText).map((node) => ({ ...node }));
  if (nodes.length === 0) return null;
  const minX = Math.min(...nodes.map((node) => node.x));
  const minY = Math.min(...nodes.map((node) => node.y));
  const normalized = nodes.map((node) => ({ ...node, x: node.x - minX + 20, y: node.y - minY + 20 }));
  const maxX = Math.max(...normalized.map((node) => node.x + 130));
  const maxY = Math.max(...normalized.map((node) => node.y + 80));
  return { nodes: normalized, width: Math.max(520, maxX + 20), height: Math.max(240, maxY + 20) };
}

export default function TeacherPage() {
  const [loginUser, setLoginUser] = useState("");
  const [loginName, setLoginName] = useState("");
  const [loginSchool, setLoginSchool] = useState("");
  const [loginRole, setLoginRole] = useState<"teacher" | "admin">("teacher");
  const [tab, setTab] = useState<"system" | "learning" | "course">("system");
  const [courseTab, setCourseTab] = useState<CourseTab>("essay");
  const [users, setUsers] = useState<UserRow[]>([]);
  const [essays, setEssays] = useState<EssayRow[]>([]);
  const [openClasses, setOpenClasses] = useState<OpenClassRow[]>([]);
  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [monitorSessions, setMonitorSessions] = useState<MonitorSession[]>([]);
  const [monitorSelected, setMonitorSelected] = useState<MonitorSession | null>(null);
  const [groupViewStep, setGroupViewStep] = useState<string>("all");
  const [error, setError] = useState("");
  const [userQuery, setUserQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "teacher" | "student" | "admin">("all");
  const [schoolFilter, setSchoolFilter] = useState<string>("all");
  const [classFilter, setClassFilter] = useState<string>("");
  const [userSortBy, setUserSortBy] = useState<"username" | "name" | "classNumber">("username");
  const [userSortDirection, setUserSortDirection] = useState<"asc" | "desc">("asc");
  const [userPage, setUserPage] = useState(1);
  const [accountError, setAccountError] = useState("");
  const [accountSuccess, setAccountSuccess] = useState("");
  const [editingUser, setEditingUser] = useState<{
    username: string;
    name: string;
    school: string;
    role: "student" | "teacher";
    ownerTeacherUsername: string;
    classNumber: string;
    password: string;
  } | null>(null);
  const [newUserForm, setNewUserForm] = useState({
    username: "",
    name: "",
    school: "",
    role: "student" as "student" | "teacher",
    ownerTeacherUsername: "",
    classNumber: "",
    password: ""
  });
  const [csvInput, setCsvInput] = useState("");
  const [csvPreviewErrors, setCsvPreviewErrors] = useState<string[]>([]);
  const [resetTargetUser, setResetTargetUser] = useState("");
  const [resetMode, setResetMode] = useState<"system" | "manual">("system");
  const [generatedPassword, setGeneratedPassword] = useState("");
  const [manualResetPassword, setManualResetPassword] = useState("");

  const [essayForm, setEssayForm] = useState({
    id: "",
    title: "",
    genre: "議論文",
    description: "",
    enabled: true
  });
  const [openClassForm, setOpenClassForm] = useState({
    id: "",
    classNumber: "",
    essayId: "",
    durationMinutes: 40,
    supplemental: ""
  });

  const [selectedActivityId, setSelectedActivityId] = useState("");
  const [editableGroups, setEditableGroups] = useState<ActivityGroup[]>([]);
  const [unassignedStudents, setUnassignedStudents] = useState<string[]>([]);
  const [groupCount, setGroupCount] = useState(2);

  const [progressSessionId, setProgressSessionId] = useState("");
  const [selectedLearningActivityId, setSelectedLearningActivityId] = useState("");
  const [learningSchoolFilter, setLearningSchoolFilter] = useState("all");
  const [learningClassFilter, setLearningClassFilter] = useState("all");
  const [learningCourseFilter, setLearningCourseFilter] = useState("all");
  const [learningStatusFilter, setLearningStatusFilter] = useState("all");
  const [learningPage, setLearningPage] = useState(1);
  const [learningJumpPage, setLearningJumpPage] = useState("1");
  const [showCourseStatusView, setShowCourseStatusView] = useState(false);
  const [isLearningProcessing, setIsLearningProcessing] = useState(false);
  const [learningProcessingText, setLearningProcessingText] = useState("");
  const [learningWarning, setLearningWarning] = useState("");
  const [progressRows, setProgressRows] = useState<PersonalProgressRow[]>([]);
  const [selectedProgressUser, setSelectedProgressUser] = useState("");
  const [personalMessages, setPersonalMessages] = useState<
    Array<{ id: string; role: string; userId?: string; text: string; at: string; step: number }>
  >([]);
  const refreshTokenRef = useRef(0);
  const monitorPollingBusyRef = useRef(false);

  const classOptions = useMemo(
    () =>
      Array.from(
        new Set(
          users
            .filter((user) => user.role === "student")
            .map((user) => user.classNumber)
            .filter((value): value is string => Boolean(value))
        )
      ).sort(),
    [users]
  );

  const schoolOptions = useMemo(
    () => Array.from(new Set(users.map((user) => user.school).filter(Boolean))).sort((a, b) => a.localeCompare(b, "zh-Hant")),
    [users]
  );

  const classFilterOptions = useMemo(() => {
    if (schoolFilter === "all") return [];
    const uniqClassNumbers = Array.from(
      new Set(
        users
          .filter((user) => user.role === "student" && user.school === schoolFilter)
          .map((user) => user.classNumber)
          .filter((value): value is string => Boolean(value))
      )
    );

    return uniqClassNumbers.sort((a, b) => {
      const nA = Number(a);
      const nB = Number(b);
      if (Number.isFinite(nA) && Number.isFinite(nB)) return nB - nA;
      return b.localeCompare(a, "zh-Hant");
    });
  }, [users, schoolFilter]);

  const filteredUsers = useMemo(() => {
    const keyword = userQuery.trim().toLowerCase();

    return users.filter((user) => {
      if (roleFilter !== "all" && user.role !== roleFilter) return false;
      if (schoolFilter !== "all" && user.school !== schoolFilter) return false;

      if (roleFilter === "student" && schoolFilter !== "all") {
        if (classFilter && (user.classNumber ?? "") !== classFilter) return false;
      }

      if (!keyword) return true;
      return (
        user.username.toLowerCase().includes(keyword) ||
        user.name.toLowerCase().includes(keyword) ||
        user.school.toLowerCase().includes(keyword)
      );
    });
  }, [users, roleFilter, schoolFilter, classFilter, userQuery]);

  const learningSchoolOptions = useMemo(
    () => Array.from(new Set(activities.map((item) => item.school).filter(Boolean))).sort((a, b) => a.localeCompare(b, "zh-Hant")),
    [activities]
  );

  const learningClassOptions = useMemo(() => {
    const scoped = learningSchoolFilter === "all" ? activities : activities.filter((item) => item.school === learningSchoolFilter);
    return Array.from(new Set(scoped.map((item) => item.classNumber).filter(Boolean))).sort((a, b) => b.localeCompare(a, "zh-Hant"));
  }, [activities, learningSchoolFilter]);

  const learningCourseOptions = useMemo(() => {
    let scoped = activities;
    if (learningSchoolFilter !== "all") scoped = scoped.filter((item) => item.school === learningSchoolFilter);
    if (learningClassFilter !== "all") scoped = scoped.filter((item) => item.classNumber === learningClassFilter);
    return scoped.map((item) => ({ id: item.id, label: item.title }));
  }, [activities, learningSchoolFilter, learningClassFilter]);

  const filteredLearningActivities = useMemo(() => {
    return activities.filter((item) => {
      if (learningSchoolFilter !== "all" && item.school !== learningSchoolFilter) return false;
      if (learningClassFilter !== "all" && item.classNumber !== learningClassFilter) return false;
      if (learningCourseFilter !== "all" && item.id !== learningCourseFilter) return false;
      if (learningStatusFilter !== "all" && (item.courseStatus ?? "not_started") !== learningStatusFilter) return false;
      return true;
    });
  }, [activities, learningSchoolFilter, learningClassFilter, learningCourseFilter, learningStatusFilter]);

  const learningPageSize = 10;
  const totalLearningPages = Math.max(1, Math.ceil(filteredLearningActivities.length / learningPageSize));
  const pagedLearningActivities = useMemo(() => {
    const start = (learningPage - 1) * learningPageSize;
    return filteredLearningActivities.slice(start, start + learningPageSize);
  }, [filteredLearningActivities, learningPage]);

  const sortedUsers = useMemo(() => {
    const getSortValue = (user: UserRow): string => {
      if (userSortBy === "username") return user.username;
      if (userSortBy === "name") return user.name;
      return user.classNumber ?? "";
    };

    const sorted = [...filteredUsers].sort((a, b) => {
      const aValue = getSortValue(a);
      const bValue = getSortValue(b);

      if (userSortBy === "classNumber") {
        const aNum = Number(aValue);
        const bNum = Number(bValue);
        if (Number.isFinite(aNum) && Number.isFinite(bNum)) {
          return userSortDirection === "asc" ? aNum - bNum : bNum - aNum;
        }
      }

      const base = aValue.localeCompare(bValue, "zh-Hant");
      return userSortDirection === "asc" ? base : -base;
    });

    return sorted;
  }, [filteredUsers, userSortBy, userSortDirection]);

  const totalUserPages = useMemo(() => Math.max(1, Math.ceil(sortedUsers.length / 20)), [sortedUsers.length]);

  const pagedUsers = useMemo(() => {
    const start = (userPage - 1) * 20;
    return sortedUsers.slice(start, start + 20);
  }, [sortedUsers, userPage]);

  const userPageStartIndex = useMemo(() => (userPage - 1) * 20, [userPage]);

  function toggleUserSort(field: "username" | "name" | "classNumber") {
    if (userSortBy === field) {
      setUserSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setUserSortBy(field);
    setUserSortDirection("asc");
  }

  function getSortIndicator(field: "username" | "name" | "classNumber") {
    if (userSortBy !== field) return "↕";
    return userSortDirection === "asc" ? "↑" : "↓";
  }

  const teacherUsers = useMemo(
    () => users.filter((item) => item.role === "teacher"),
    [users]
  );
  const loginTeacherProfile = useMemo(
    () => teacherUsers.find((item) => item.username === loginUser),
    [teacherUsers, loginUser]
  );

  const groupMessages = useMemo(() => {
    if (!monitorSelected) return [];
    const base = monitorSelected.messages.filter((message) => groupInteractionSteps.includes(message.step));
    if (groupViewStep === "all") return base;
    return base.filter((message) => message.step === Number(groupViewStep));
  }, [monitorSelected, groupViewStep]);

  const selectedLearningActivity = useMemo(
    () => activities.find((activity) => activity.id === selectedLearningActivityId),
    [activities, selectedLearningActivityId]
  );
  const selectedGroupActivity = useMemo(
    () => activities.find((activity) => activity.id === selectedActivityId),
    [activities, selectedActivityId]
  );
  const hasExistingGrouping = useMemo(
    () => (selectedGroupActivity?.groups.length ?? 0) > 0,
    [selectedGroupActivity]
  );
  const canSaveGroups = useMemo(
    () => Boolean(selectedActivityId) && editableGroups.length > 0 && unassignedStudents.length === 0,
    [selectedActivityId, editableGroups.length, unassignedStudents.length]
  );

  const filteredMonitorSessions = useMemo(
    () =>
      selectedLearningActivityId
        ? monitorSessions.filter((session) => session.activityId === selectedLearningActivityId)
        : [],
    [monitorSessions, selectedLearningActivityId]
  );

  function formatSessionLabel(session: MonitorSession): string {
    const school = session.school?.trim() || selectedLearningActivity?.school || "unknown-school";
    const classNumber = session.classNumber?.trim() || selectedLearningActivity?.classNumber || "unknown-class";
    const groupNumber = (session.groupName || session.groupId || "unknown-group").toString();
    return `${school} + ${classNumber} + ${groupNumber}`;
  }

  const classJoinRows = useMemo(() => {
    if (!selectedLearningActivity) return [];
    const students = selectedLearningActivity.studentCandidates ?? [];
    const onlineUserSet = new Set(
      filteredMonitorSessions.flatMap((session) => {
        if (session.onlineUsers && session.onlineUsers.length > 0) return session.onlineUsers;
        return session.messages
          .filter((message) => message.role === "student" && Boolean(message.userId))
          .map((message) => message.userId as string);
      })
    );
    return students.map((username) => {
      const joinedSessions = filteredMonitorSessions.filter((session) => {
        const joinedUsers = session.joinedUsers ?? [];
        if (joinedUsers.includes(username)) return true;
        return session.messages.some((message) => message.role === "student" && message.userId === username);
      });
      const latestSession = joinedSessions[0];
      const latestPersonalStep = joinedSessions
        .map((s) => s.personalSteps?.[username] ?? null)
        .find((step) => typeof step === "number");
      return {
        username,
        joined: onlineUserSet.has(username),
        step: latestPersonalStep ?? latestSession?.currentStep ?? null,
        groupName: latestSession?.groupName ?? null
      };
    });
  }, [selectedLearningActivity, filteredMonitorSessions]);

  const groupStatusRows = useMemo(() => {
    if (!selectedLearningActivity) return [];

    const groups = selectedLearningActivity.groups.length
      ? selectedLearningActivity.groups
      : [{ groupId: "g-auto", groupName: "未分組", members: selectedLearningActivity.studentCandidates ?? [] }];
    const onlineUserSet = new Set(
      filteredMonitorSessions.flatMap((session) => {
        if (session.onlineUsers && session.onlineUsers.length > 0) return session.onlineUsers;
        return session.messages
          .filter((message) => message.role === "student" && Boolean(message.userId))
          .map((message) => message.userId as string);
      })
    );

    return groups.map((group) => {
      const joinedMembers = group.members.filter((member) =>
        onlineUserSet.has(member)
      );
      const groupSession = filteredMonitorSessions.find(
        (session) =>
          (session.groupId && session.groupId === group.groupId) ||
          (session.groupName && session.groupName === group.groupName)
      );
      return {
        groupId: group.groupId,
        groupName: group.groupName,
        totalMembers: group.members.length,
        joinedCount: joinedMembers.length,
        pendingCount: group.members.length - joinedMembers.length,
        currentStep: groupSession?.currentStep ?? null
      };
    });
  }, [selectedLearningActivity, filteredMonitorSessions]);

  useEffect(() => {
    if (!monitorSelected) return;
    const latest = monitorSessions.find((session) => session.sessionId === monitorSelected.sessionId);
    if (!latest) return;
    setMonitorSelected(latest);
  }, [monitorSessions, monitorSelected?.sessionId]);

  function getStepAdvanceHint(session: MonitorSession): { ready: boolean; text: string; nextStep?: number } {
    const step = session.currentStep;
    const nextStep = step < 10 ? step + 1 : undefined;
    const stepMessages = session.messages.filter((m) => m.step === step);
    const studentUsers = new Set(stepMessages.filter((m) => m.role === "student" && m.userId).map((m) => m.userId as string));

    if (step === 1) {
      const ready = stepMessages.some(
        (m) => m.role === "system" && m.text.includes("步驟 1 子步驟已完成，等待教師切換下一步")
      );
      return ready
        ? { ready: true, text: "全部組員已完成步驟 1，建議切換到 Step 2。", nextStep }
        : {
            ready: false,
            text: `步驟 1 進行中（目前子步驟 1-${session.stepState?.step1Substep ?? 1}），等待全部組員完成。`
          };
    }

    if (step === 2) {
      const ready = stepMessages.some(
        (m) => m.role === "system" && m.text.includes("步驟 2 子步驟已完成，等待教師切換下一步")
      );
      return ready
        ? { ready: true, text: "全部組員已完成步驟 2，建議切換到 Step 3。", nextStep }
        : {
            ready: false,
            text: `步驟 2 進行中（目前子步驟 2-${session.stepState?.step2Substep ?? 1}），等待全部組員完成。`
          };
    }

    if (step === 4) {
      const completedUsers = session.groupGate?.["4-complete"] ?? [];
      const ready =
        session.participants.length > 0 &&
        session.participants.every((participant) => completedUsers.includes(participant));
      return ready
        ? { ready: true, text: "步驟 4 已全員確認完成，建議切換到 Step 5。", nextStep }
        : { ready: false, text: "步驟 4 尚未全員確認完成。" };
    }

    if (step === 3) {
      const ready =
        session.participants.length > 0 &&
        session.participants.every((participant) => (session.groupGate?.["3-complete"] ?? []).includes(participant));
      return ready
        ? { ready: true, text: `步驟 ${step} 已收齊完成條件，建議切換到 Step ${nextStep}。`, nextStep }
        : {
            ready: false,
            text: "步驟 3 尚未全員完成結構樹。"
          };
    }

    if (step >= 5 && step <= 10) {
      return {
        ready: false,
        text: `步驟 ${step} 為個人步調階段，無需收齊全班回覆。各步驟人數：${getPersonalStepCountText(session)}`
      };
    }

    return { ready: false, text: "目前已是最後步驟或無下一步建議。" };
  }

  function getPersonalStepCountText(session: MonitorSession): string {
    const counts = new Map<number, number>();
    session.participants.forEach((participant) => {
      const step = session.personalSteps?.[participant] ?? session.currentStep;
      if (step < 5 || step > 10) return;
      counts.set(step, (counts.get(step) ?? 0) + 1);
    });
    return [5, 6, 7, 8, 9, 10]
      .map((step) => `S${step}:${counts.get(step) ?? 0}`)
      .join(" / ");
  }

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        if (data?.authenticated) {
          setLoginUser(data.user.username);
          setLoginName(data.user.name ?? "");
          setLoginSchool(data.user.school ?? "");
          if (data.user.role === "admin") {
            setLoginRole("admin");
          } else {
            setLoginRole("teacher");
          }
        }
      })
      .catch(() => undefined);

    refreshAll();
  }, []);

  useEffect(() => {
    if (!selectedActivityId || activities.length === 0) return;
    const activity = activities.find((item) => item.id === selectedActivityId);
    if (!activity) return;
    resetGroupDraft(activity);
  }, [selectedActivityId, activities]);

  useEffect(() => {
    setMonitorSelected(null);
    setProgressRows([]);
    setPersonalMessages([]);
    setSelectedProgressUser("");
    setProgressSessionId("");
  }, [selectedLearningActivityId]);

  useEffect(() => {
    if (!showCourseStatusView || !selectedLearningActivityId) return;
    refreshMonitor().catch(() => undefined);
  }, [showCourseStatusView, selectedLearningActivityId]);

  useEffect(() => {
    if (tab !== "learning" || !showCourseStatusView || !selectedLearningActivityId) return;
    let cancelled = false;

    const pollMonitor = async () => {
      if (cancelled || monitorPollingBusyRef.current || isLearningProcessing) return;
      monitorPollingBusyRef.current = true;
      try {
        await refreshMonitor();
      } finally {
        monitorPollingBusyRef.current = false;
      }
    };

    pollMonitor().catch(() => undefined);
    const timer = window.setInterval(() => {
      pollMonitor().catch(() => undefined);
    }, 3000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [tab, showCourseStatusView, selectedLearningActivityId, isLearningProcessing]);

  useEffect(() => {
    setClassFilter("");
    setUserPage(1);
  }, [roleFilter, schoolFilter]);

  useEffect(() => {
    setUserPage(1);
  }, [classFilter, userSortBy, userSortDirection, userQuery]);

  useEffect(() => {
    if (userPage > totalUserPages) {
      setUserPage(totalUserPages);
    }
  }, [userPage, totalUserPages]);

  useEffect(() => {
    setLearningPage(1);
  }, [learningSchoolFilter, learningClassFilter, learningCourseFilter, learningStatusFilter]);

  useEffect(() => {
    if (learningPage > totalLearningPages) {
      setLearningPage(totalLearningPages);
    }
  }, [learningPage, totalLearningPages]);

  useEffect(() => {
    setLearningJumpPage(String(learningPage));
  }, [learningPage]);

  useEffect(() => {
    if (tab !== "learning") return;
    runLearningAction("系統正在載入學習管理資料，請稍候...", async () => {
      await refreshAll(showCourseStatusView);
    });
  }, [tab]);

  async function refreshMonitor(): Promise<MonitorSession[]> {
    const fetchOpts: RequestInit = { cache: "no-store" };
    let response: Response | null = null;
    try {
      response = await fetch("/api/teacher/monitor", fetchOpts);
      if (!response.ok) {
        response = await fetch("/api/teacher/monitor", fetchOpts);
      }
    } catch {
      response = null;
    }
    if (!response?.ok) {
      setLearningWarning("monitor_load_failed");
      return [];
    }
    const data = await response.json();
    const sessions = data.sessions ?? [];
    setMonitorSessions(sessions);
    setLearningWarning("");
    return sessions;
  }

  async function openCourseStatus(activityId: string) {
    setSelectedLearningActivityId(activityId);
    setShowCourseStatusView(true);
    await runLearningAction("系統正在載入課程狀態，請稍候...", async () => {
      const sessions = await refreshMonitor();
      const targetSessions = sessions.filter((item: MonitorSession) => item.activityId === activityId);
      if (targetSessions.length > 0) {
        const first = targetSessions[0]!;
        setMonitorSelected(first);
        setProgressSessionId(first.sessionId);
      } else {
        setMonitorSelected(null);
        setProgressSessionId("");
      }
    });
  }

  async function refreshAll(includeMonitor = false) {
    const token = Date.now();
    refreshTokenRef.current = token;
    const fetchOpts: RequestInit = { cache: "no-store" };

    const fetchActivitiesWithRetry = async (): Promise<Response | null> => {
      try {
        const first = await fetch("/api/admin/activities", fetchOpts);
        if (first.ok) return first;
      } catch {
        // Ignore and retry once below.
      }
      try {
        return await fetch("/api/admin/activities", fetchOpts);
      } catch {
        return null;
      }
    };

    const [uRes, eRes, oRes, activitiesRes] = await Promise.all([
      fetch("/api/admin/users", fetchOpts).catch(() => null),
      fetch("/api/admin/essays", fetchOpts).catch(() => null),
      fetch("/api/admin/openclasses", fetchOpts).catch(() => null),
      fetchActivitiesWithRetry()
    ]);

    if (refreshTokenRef.current !== token) return;

    if (uRes?.ok) setUsers((await uRes.json()).users ?? []);
    if (eRes?.ok) {
      const list = (await eRes.json()).essays ?? [];
      setEssays(list);
    }
    if (oRes?.ok) {
      const list = (await oRes.json()).openClasses ?? [];
      setOpenClasses(list);
    }

    if (activitiesRes?.ok) {
      const list = (await activitiesRes.json()).activities ?? [];
      setActivities(list);
      setError("");
      setLearningWarning("");
      if (!list.some((item: ActivityRow) => item.id === selectedActivityId)) {
        setSelectedActivityId(list[0]?.id ?? "");
      }
      if (!list.some((item: ActivityRow) => item.id === selectedLearningActivityId)) {
        setSelectedLearningActivityId(list[0]?.id ?? "");
      }
    } else {
      setError("activities_load_failed");
      return;
    }

    if (includeMonitor) {
      await refreshMonitor();
    }
  }

  async function runLearningAction<T>(processingText: string, action: () => Promise<T>): Promise<T | undefined> {
    setIsLearningProcessing(true);
    setLearningProcessingText(processingText);
    try {
      return await action();
    } finally {
      setIsLearningProcessing(false);
      setLearningProcessingText("");
    }
  }

  function getCourseStatusLabel(status?: "not_started" | "in_progress" | "paused" | "ended") {
    if (status === "in_progress") return "進行中";
    if (status === "paused") return "暫停中";
    if (status === "ended") return "已結束";
    return "尚未開始";
  }

  async function handleCourseLifecycle(activityId: string, action: "start" | "pause_resume" | "end") {
    const processingText =
      action === "start" ? "系統正在開始上課，請稍候..." : action === "end" ? "系統正在結束上課，請稍候..." : "系統正在更新課程狀態，請稍候...";
    await runLearningAction(processingText, async () => {
      const response = await fetch("/api/teacher/course-control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activityId, action })
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "course_lifecycle_failed");
        return;
      }

      setError("");
      await refreshAll(showCourseStatusView);
    });
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  async function applyStepSwitch(sessionId: string, step: number) {
    await runLearningAction(`系統正在切換到 Step ${step}，請稍候...`, async () => {
      setError("");

      const response = await fetch("/api/teacher/step", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, step })
      });

      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "switch_failed");
        return;
      }

      setMonitorSessions((prev) =>
        prev.map((session) =>
          session.sessionId === data.id
            ? {
                ...session,
                currentStep: data.currentStep,
                messages: data.messages,
                groupGate: data.groupGate,
                stepState: data.stepState,
                reflectionIndex: data.reflectionIndex
              }
            : session
        )
      );

      setMonitorSelected({
        sessionId: data.id,
        activityId: data.activityId,
        activityTitle: data.activityTitle,
        school: data.school,
        classNumber: data.classNumber,
        groupId: data.groupId,
        groupName: data.groupName,
        participants: data.participants,
        currentStep: data.currentStep,
        messages: data.messages
      });
      setGroupViewStep("all");

      await refreshAll(true);
    });
  }

  async function loadProgress(sessionTarget?: string, username?: string) {
    const sid = sessionTarget ?? progressSessionId;
    if (!sid) return;
    await runLearningAction("系統正在載入個人進度，請稍候...", async () => {
      const q = new URLSearchParams({ sessionId: sid });
      if (username) {
        q.set("username", username);
      }

      const response = await fetch(`/api/teacher/personal-progress?${q.toString()}`);
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "progress_failed");
        return;
      }

      setProgressRows(data.progress ?? []);
      setPersonalMessages(data.personalMessages ?? []);
      if (username) {
        setSelectedProgressUser(username);
      }
    });
  }

  function openResetPassword(username: string) {
    const newGenerated = createRandomPassword();
    setResetTargetUser(username);
    setResetMode("system");
    setGeneratedPassword(newGenerated);
    setManualResetPassword("");
    setAccountError("");
    setAccountSuccess("");
  }

  function createRandomPassword(length = 12): string {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%";
    let result = "";
    for (let i = 0; i < length; i += 1) {
      result += chars[Math.floor(Math.random() * chars.length)]!;
    }
    return result;
  }

  async function copyResetPasswordValue() {
    const value = resetMode === "system" ? generatedPassword : manualResetPassword;
    if (!value) return;
    await navigator.clipboard.writeText(value);
    setAccountSuccess("密碼已複製到剪貼簿。");
  }

  async function resetPassword() {
    if (!resetTargetUser) return;
    const nextPassword = resetMode === "system" ? generatedPassword : manualResetPassword;
    if (!nextPassword || nextPassword.length < 6) {
      setAccountError("password_too_short");
      setAccountSuccess("");
      return;
    }

    const response = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reset_password", username: resetTargetUser, newPassword: nextPassword })
    });
    if (!response.ok) {
      const data = await response.json();
      setAccountError(data.error ?? "reset_password_failed");
      setAccountSuccess("");
      return;
    }
    setAccountSuccess(`已重設 ${resetTargetUser} 密碼。`);
    setResetTargetUser("");
    setManualResetPassword("");
    setAccountError("");
  }

  async function createUser() {
    setAccountError("");
    setAccountSuccess("");
    const validationErrors = validateCsvRows(
      [
        `${newUserForm.classNumber},${newUserForm.username},${newUserForm.name},${newUserForm.school},${newUserForm.role},${newUserForm.password},${newUserForm.ownerTeacherUsername}`
      ],
      { isAdmin: loginRole === "admin" }
    );
    if (validationErrors.length > 0) {
      setAccountError(validationErrors[0]!);
      return;
    }

    if (loginRole !== "admin" && newUserForm.role !== "student") {
      setAccountError("teacher_can_only_create_students");
      return;
    }

    const userPayload = {
      ...newUserForm,
      ownerTeacherUsername:
        newUserForm.role === "student"
          ? loginRole === "admin"
            ? newUserForm.ownerTeacherUsername
            : loginUser
          : "",
      classNumber: newUserForm.role === "student" ? newUserForm.classNumber : ""
    };

    const response = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "create", user: userPayload })
    });
    const data = await response.json();
    if (!response.ok) {
      setAccountError(data.error ?? "create_user_failed");
      return;
    }

    setNewUserForm({
      username: "",
      name: "",
      school: "",
      role: "student",
      ownerTeacherUsername: "",
      classNumber: "",
      password: ""
    });
    setAccountSuccess("已新增帳號。");
    await refreshAll();
  }

  function handleNewUserRoleChange(role: "student" | "teacher") {
    if (role === "student") {
      if (loginRole === "admin") {
        setNewUserForm((prev) => ({ ...prev, role, ownerTeacherUsername: "", school: "", classNumber: "" }));
      } else {
        setNewUserForm((prev) => ({
          ...prev,
          role,
          ownerTeacherUsername: loginUser,
          school: loginTeacherProfile?.school ?? "",
          classNumber: prev.classNumber
        }));
      }
      return;
    }

    setNewUserForm((prev) => ({ ...prev, role, ownerTeacherUsername: "", classNumber: "" }));
  }

  function handleNewStudentTeacherChange(teacherUsername: string) {
    const teacher = teacherUsers.find((item) => item.username === teacherUsername);
    setNewUserForm((prev) => ({
      ...prev,
      ownerTeacherUsername: teacherUsername,
      school: teacher?.school ?? ""
    }));
  }

  useEffect(() => {
    if (newUserForm.role !== "student") return;
    if (loginRole === "teacher") {
      const school = loginTeacherProfile?.school ?? "";
      if (newUserForm.ownerTeacherUsername !== loginUser || newUserForm.school !== school) {
        setNewUserForm((prev) => ({
          ...prev,
          ownerTeacherUsername: loginUser,
          school
        }));
      }
    }
  }, [newUserForm.role, loginRole, loginUser, loginTeacherProfile?.school, newUserForm.ownerTeacherUsername, newUserForm.school]);

  async function saveEditedUser() {
    if (!editingUser) return;

    setAccountError("");
    setAccountSuccess("");
    const row = `${editingUser.classNumber},${editingUser.username},${editingUser.name},${editingUser.school},${editingUser.role},${
      editingUser.password || "placeholder123"
    },${editingUser.ownerTeacherUsername}`;
    const validationErrors = validateCsvRows([row], {
      skipPasswordLength: !editingUser.password,
      isAdmin: loginRole === "admin",
      skipUsernameFormat: true
    });
    if (validationErrors.length > 0) {
      setAccountError(validationErrors[0]!);
      return;
    }

    const patch: {
      name: string;
      school: string;
      role: "student" | "teacher";
      ownerTeacherUsername?: string;
      classNumber?: string;
      password?: string;
    } = {
      name: editingUser.name,
      school: editingUser.school,
      role: editingUser.role
    };
    if (editingUser.role === "student") {
      patch.ownerTeacherUsername = loginRole === "admin" ? editingUser.ownerTeacherUsername : loginUser;
      patch.classNumber = editingUser.classNumber;
    }
    if (editingUser.password) {
      patch.password = editingUser.password;
    }

    const response = await fetch("/api/admin/users", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: editingUser.username, patch })
    });
    const data = await response.json();
    if (!response.ok) {
      setAccountError(data.error ?? "update_user_failed");
      return;
    }

    setEditingUser(null);
    setAccountSuccess("已更新帳號資料。");
    await refreshAll();
  }

  async function deleteUser(username: string) {
    const confirmed = window.confirm(`確定刪除帳號 ${username} 嗎？`);
    if (!confirmed) return;

    setAccountError("");
    setAccountSuccess("");
    const response = await fetch("/api/admin/users", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username })
    });
    const data = await response.json();
    if (!response.ok) {
      setAccountError(data.error ?? "delete_user_failed");
      return;
    }
    setAccountSuccess(`已刪除 ${username}。`);
    await refreshAll();
  }

  async function importUsersFromCsv() {
    setAccountError("");
    setAccountSuccess("");

    const parsedLines = csvInput
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    if (parsedLines.length === 0) {
      setAccountError("csv_empty");
      return;
    }

    const headerLine = parsedLines[0]!.toLowerCase();
    const hasHeader =
      headerLine === "classnumber,username,name,school,role,password" ||
      headerLine === "classnumber,username,name,school,role,password,ownerteacherusername" ||
      parsedLines[0] === "班級號碼,帳號,姓名,學校,角色,密碼" ||
      parsedLines[0] === "班級號碼,帳號,姓名,學校,角色,密碼,綁定教師";
    const dataLines = hasHeader ? parsedLines.slice(1) : parsedLines;
    const previewErrors = validateCsvRows(dataLines, { isAdmin: loginRole === "admin" });
    setCsvPreviewErrors(previewErrors);
    if (previewErrors.length > 0) {
      setAccountError("csv_validation_failed");
      return;
    }

    const response = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "bulk_create_from_csv", csv: csvInput })
    });
    const data = await response.json();
    if (!response.ok) {
      const detail = Array.isArray(data.details)
        ? data.details.map((d: { line: number; message: string }) => `line ${d.line}: ${d.message}`).join("; ")
        : data.error;
      setAccountError(detail ?? "bulk_create_failed");
      return;
    }

    setCsvInput("");
    setCsvPreviewErrors([]);
    setAccountSuccess(`已批次新增 ${data.createdCount ?? 0} 筆帳號。`);
    await refreshAll();
  }

  function validateCsvRows(
    lines: string[],
    options?: { skipPasswordLength?: boolean; isAdmin?: boolean; skipUsernameFormat?: boolean }
  ): string[] {
    const errors: string[] = [];
    const seen = new Set<string>();
    const teacherUsernames = users.filter((item) => item.role === "teacher").map((item) => item.username);

    lines.forEach((line, idx) => {
      const cols = splitCsvLine(line);
      if (cols.length !== 6 && cols.length !== 7) {
        errors.push(`第 ${idx + 1} 列欄位數錯誤（需 6 或 7 欄）`);
        return;
      }
      const [classNumberRaw = "", username, name, school, role, password, ownerTeacherUsernameRaw = ""] = cols.map((v) => v.trim());
      const classNumber = classNumberRaw.trim();
      const ownerTeacherUsername = ownerTeacherUsernameRaw.trim();
      if (!username || !name || !school || !role || !password) {
        errors.push(`第 ${idx + 1} 列有必填欄位為空`);
        return;
      }
      if (!options?.skipUsernameFormat && !/^[A-Za-z0-9._-]{2,32}$/.test(username)) {
        errors.push(`第 ${idx + 1} 列 username 格式錯誤`);
      }
      if (!["student", "teacher"].includes(role)) {
        errors.push(`第 ${idx + 1} 列 role 必須是 student 或 teacher（不可為 admin）`);
      }
      if (options?.isAdmin === false && role === "teacher") {
        errors.push(`第 ${idx + 1} 列教師帳號只能由 admin 建立`);
      }
      if (!options?.skipPasswordLength && password.length < 6) {
        errors.push(`第 ${idx + 1} 列 password 至少 6 碼`);
      }
      if (role === "student") {
        if (!classNumber) {
          errors.push(`第 ${idx + 1} 列 student 必填班級號碼`);
        }
        if (options?.isAdmin) {
          if (!ownerTeacherUsername) {
            errors.push(`第 ${idx + 1} 列 student 必填綁定教師 username`);
          } else if (!teacherUsernames.includes(ownerTeacherUsername)) {
            errors.push(`第 ${idx + 1} 列綁定教師不存在`);
          }
        }
      }
      if (seen.has(username)) {
        errors.push(`第 ${idx + 1} 列 username 重複`);
      }
      seen.add(username);
    });
    return errors;
  }

  function splitCsvLine(line: string): string[] {
    const cells: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i += 1) {
      const char = line[i]!;
      if (char === "\"") {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        cells.push(current);
        current = "";
      } else {
        current += char;
      }
    }
    cells.push(current);
    return cells;
  }

  async function saveEssay(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (!essayForm.title.trim() || !essayForm.genre.trim() || !essayForm.description.trim()) {
      setError("寫作主題基本欄位未填完整");
      return;
    }

    try {
      const essayResponse = await fetch("/api/admin/essays", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: essayForm.id || undefined,
          title: essayForm.title,
          genre: essayForm.genre,
          description: essayForm.description,
          enabled: essayForm.enabled
        })
      });
      const essayData = await essayResponse.json();
      if (!essayResponse.ok) {
        setError(essayData.error ?? "save_essay_failed");
        return;
      }

      const savedEssay = essayData?.saved as EssayRow | undefined;
      if (!savedEssay?.id) {
        setError("save_essay_failed");
        return;
      }

      // 先本地更新，確保使用者儲存後立刻看得到結果
      setEssays((prev) => {
        const idx = prev.findIndex((item) => item.id === savedEssay.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = savedEssay;
          return next;
        }
        return [...prev, savedEssay];
      });

      setEssayForm({
        id: "",
        title: "",
        genre: "議論文",
        description: "",
        enabled: true
      });

      // 再背景同步全部資料，若失敗不影響剛剛新增的顯示
      refreshAll().catch(() => undefined);
    } catch {
      setError("save_essay_failed");
    }
  }

  async function startEditEssay(essay: EssayRow) {
    setError("");
    setEssayForm({
      id: essay.id,
      title: essay.title,
      genre: essay.genre,
      description: essay.description,
      enabled: essay.enabled
    });
  }

  async function saveOpenClass(e: FormEvent) {
    e.preventDefault();
    setError("");

    const response = await fetch("/api/admin/openclasses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: openClassForm.id || undefined,
        classNumber: openClassForm.classNumber,
        essayId: openClassForm.essayId,
        durationMinutes: openClassForm.durationMinutes,
        supplemental: openClassForm.supplemental
      })
    });
    const data = await response.json();
    if (!response.ok) {
      if (data.error === "essay_disabled") {
        setError("此主題已停用，無法建立新的寫作任務。");
      } else {
        setError(data.error ?? "save_openclass_failed");
      }
      return;
    }

    setOpenClassForm({
      id: "",
      classNumber: "",
      essayId: "",
      durationMinutes: 40,
      supplemental: ""
    });
    await refreshAll();
  }

  async function toggleEssayEnabled(essay: EssayRow, enabled: boolean) {
    setError("");
    const response = await fetch("/api/admin/essays", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: essay.id,
        title: essay.title,
        genre: essay.genre,
        description: essay.description,
        enabled
      })
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error ?? "toggle_essay_enabled_failed");
      return;
    }
    await refreshAll();
  }

  function onDragStart(username: string, sourceGroupId: string) {
    return (event: DragEvent) => {
      event.dataTransfer.setData("application/json", JSON.stringify({ username, sourceGroupId }));
      event.dataTransfer.effectAllowed = "move";
    };
  }

  function removeFromSource(username: string, sourceGroupId: string) {
    if (sourceGroupId === "unassigned") {
      setUnassignedStudents((prev) => prev.filter((item) => item !== username));
      return;
    }
    setEditableGroups((prev) =>
      prev.map((group) =>
        group.groupId === sourceGroupId ? { ...group, members: group.members.filter((item) => item !== username) } : group
      )
    );
  }

  function dropToGroup(targetGroupId: string) {
    return (event: DragEvent) => {
      event.preventDefault();
      const raw = event.dataTransfer.getData("application/json");
      if (!raw) return;

      const { username, sourceGroupId } = JSON.parse(raw) as { username: string; sourceGroupId: string };
      removeFromSource(username, sourceGroupId);

      setEditableGroups((prev) =>
        prev.map((group) => {
          if (group.groupId !== targetGroupId) return group;
          if (group.members.includes(username)) return group;
          return { ...group, members: [...group.members, username] };
        })
      );
    };
  }

  function dropToUnassigned(event: DragEvent) {
    event.preventDefault();
    const raw = event.dataTransfer.getData("application/json");
    if (!raw) return;

    const { username, sourceGroupId } = JSON.parse(raw) as { username: string; sourceGroupId: string };
    removeFromSource(username, sourceGroupId);
    setUnassignedStudents((prev) => (prev.includes(username) ? prev : [...prev, username]));
  }

  async function saveGroups() {
    if (!selectedActivityId) return;
    if (unassignedStudents.length > 0) {
      setError("尚有未分配學生，無法儲存分組。");
      return;
    }
    const response = await fetch("/api/admin/groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activityId: selectedActivityId, groups: editableGroups })
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error ?? "save_groups_failed");
      return;
    }

    const updated = data.updated as ActivityRow;
    setActivities((prev) =>
      prev.map((activity) =>
        activity.id === updated.id ? { ...updated, studentCandidates: activity.studentCandidates ?? [] } : activity
      )
    );
    setEditableGroups(updated.groups.map((group) => ({ ...group, members: [...group.members] })));
    setError("");
  }

  function buildEmptyGroups(count: number): ActivityGroup[] {
    const safeCount = Math.max(1, count);
    return Array.from({ length: safeCount }, (_, idx) => ({
      groupId: `g${idx + 1}`,
      groupName: String(idx + 1),
      members: []
    }));
  }

  function resetGroupDraft(activity: ActivityRow) {
    const nextGroups = activity.groups.map((group) => ({ ...group, members: [...group.members] }));
    setEditableGroups(nextGroups);
    setGroupCount(activity.groups.length > 0 ? Math.max(1, activity.groups.length) : 2);
    const assigned = new Set(nextGroups.flatMap((group) => group.members));
    const candidates = activity.studentCandidates ?? [];
    setUnassignedStudents(candidates.filter((username) => !assigned.has(username)));
  }

  function resetAllStudentsToUnassigned() {
    if (!selectedGroupActivity) return [];
    const candidates = selectedGroupActivity.studentCandidates ?? [];
    setUnassignedStudents(candidates);
    return candidates;
  }

  function initializeGroupsForDrag() {
    const candidates = resetAllStudentsToUnassigned();
    if (!selectedGroupActivity) return;
    setEditableGroups(buildEmptyGroups(groupCount));
    if (candidates.length === 0) {
      setError("此任務沒有可分配的學生。");
      return;
    }
    setError("");
  }

  function randomAssignGroups() {
    const candidates = resetAllStudentsToUnassigned();
    if (!selectedGroupActivity) return;
    const safeCount = Math.max(1, groupCount);
    const pool = [...candidates].sort(() => Math.random() - 0.5);
    const nextGroups = buildEmptyGroups(safeCount);
    pool.forEach((username, idx) => {
      nextGroups[idx % safeCount]?.members.push(username);
    });
    setEditableGroups(nextGroups);
    setUnassignedStudents([]);
    setError("");
  }

  function cancelGroupEdits() {
    if (!selectedGroupActivity) return;
    resetGroupDraft(selectedGroupActivity);
    setError("");
  }

  function removeGroup(groupId: string) {
    setEditableGroups((prev) => prev.filter((group) => group.groupId !== groupId));
  }

  async function startEditOpenClass(openClass: OpenClassRow) {
    setOpenClassForm({
      id: openClass.id,
      classNumber: openClass.classNumber,
      essayId: openClass.essayId,
      durationMinutes: openClass.durationMinutes,
      supplemental: openClass.supplemental
    });
  }

  const displaySchool = loginTeacherProfile?.school || loginSchool;
  const displayName = loginTeacherProfile?.name || loginName;
  const identityLabel =
    loginUser && displaySchool && displayName ? `${displaySchool} – ${displayName} (${loginUser})` : loginUser || "管理端";

  return (
    <main>
      <div className="card">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <h1 style={{ marginBottom: 0 }}>教師端管理台</h1>
          <div>
            <span className="badge" style={{ marginRight: 8 }}>
              {identityLabel}
            </span>
            <button type="button" className="secondary" style={{ width: "auto" }} onClick={logout}>
              登出
            </button>
          </div>
        </div>
      </div>

      <div className="card row">
        <div style={{ width: 180 }}>
          <button type="button" className={tab === "system" ? "" : "secondary"} onClick={() => setTab("system")}>帳號管理</button>
        </div>
        <div style={{ width: 180 }}>
          <button type="button" className={tab === "course" ? "" : "secondary"} onClick={() => setTab("course")}>課程管理</button>
        </div>
        <div style={{ width: 180 }}>
          <button type="button" className={tab === "learning" ? "" : "secondary"} onClick={() => setTab("learning")}>學習管理</button>
        </div>
      </div>

      {tab === "system" ? (
        <div className="card">
          <h2>帳號管理</h2>
          <div className="row" style={{ marginBottom: 10 }}>
            <div className="col card" style={{ marginBottom: 0, padding: 12 }}>
              <small>總帳號數</small>
              <div style={{ fontSize: 22, fontWeight: 700 }}>{users.length}</div>
            </div>
            <div className="col card" style={{ marginBottom: 0, padding: 12 }}>
              <small>教師帳號</small>
              <div style={{ fontSize: 22, fontWeight: 700 }}>{users.filter((user) => user.role === "teacher").length}</div>
            </div>
            {loginRole === "admin" ? (
              <div className="col card" style={{ marginBottom: 0, padding: 12 }}>
                <small>管理員帳號</small>
                <div style={{ fontSize: 22, fontWeight: 700 }}>{users.filter((user) => user.role === "admin").length}</div>
              </div>
            ) : null}
            <div className="col card" style={{ marginBottom: 0, padding: 12 }}>
              <small>學生帳號</small>
              <div style={{ fontSize: 22, fontWeight: 700 }}>{users.filter((user) => user.role === "student").length}</div>
            </div>
          </div>

          <div className="card" style={{ marginBottom: 10 }}>
            <h3 style={{ marginBottom: 8 }}>新增單一帳號</h3>
            <div className="row">
              <div className="col">
                <label>角色</label>
                <select
                  value={newUserForm.role}
                  onChange={(e) => handleNewUserRoleChange(e.target.value as "student" | "teacher")}
                >
                  <option value="student">學生</option>
                  {loginRole === "admin" ? <option value="teacher">教師</option> : null}
                </select>
              </div>
              {loginRole === "admin" && newUserForm.role === "student" ? (
                <div className="col">
                  <label>綁定教師（username）</label>
                  <select
                    value={newUserForm.ownerTeacherUsername}
                    onChange={(e) => handleNewStudentTeacherChange(e.target.value)}
                  >
                    <option value="">請選擇教師</option>
                    {teacherUsers
                      .map((teacher) => (
                        <option key={teacher.username} value={teacher.username}>
                          {teacher.username} / {teacher.name}
                        </option>
                      ))}
                  </select>
                </div>
              ) : null}
              {newUserForm.role === "student" ? (
                <div className="col">
                  <label>學校（自動帶入）</label>
                  <input value={newUserForm.school} readOnly />
                </div>
              ) : (
                <div className="col">
                  <label>學校</label>
                  <input
                    value={newUserForm.school}
                    onChange={(e) => setNewUserForm((prev) => ({ ...prev, school: e.target.value }))}
                  />
                </div>
              )}
            </div>

            <div className="row" style={{ marginTop: 8 }}>
              <div className="col">
                <label>帳號（username）</label>
                <input
                  value={newUserForm.username}
                  onChange={(e) => setNewUserForm((prev) => ({ ...prev, username: e.target.value }))}
                  placeholder="例如 student01"
                />
              </div>
              <div className="col">
                <label>姓名</label>
                <input value={newUserForm.name} onChange={(e) => setNewUserForm((prev) => ({ ...prev, name: e.target.value }))} />
              </div>
              {newUserForm.role === "student" ? (
                <div className="col">
                  <label>班級號碼</label>
                  <input
                    value={newUserForm.classNumber}
                    onChange={(e) => setNewUserForm((prev) => ({ ...prev, classNumber: e.target.value }))}
                    placeholder="例如 701"
                  />
                </div>
              ) : null}
              <div className="col">
                <label>密碼（至少 6 碼）</label>
                <input
                  type="password"
                  value={newUserForm.password}
                  onChange={(e) => setNewUserForm((prev) => ({ ...prev, password: e.target.value }))}
                />
              </div>
              <div className="col" style={{ alignSelf: "end" }}>
                <button type="button" onClick={createUser}>
                  新增帳號
                </button>
              </div>
            </div>
          </div>

          <div className="card" style={{ marginBottom: 10 }}>
            <h3 style={{ marginBottom: 8 }}>CSV 貼上批次新增</h3>
            <div style={{ marginBottom: 8 }}>
              <small style={{ display: "block" }}>
                請使用逗號分隔，欄位順序固定為：
                <code style={{ marginLeft: 6 }}>
                  classnumber,username,name,school,role,password[,ownerTeacherUsername]
                </code>
              </small>
              <small style={{ display: "block", marginTop: 4 }}>
                role 僅可填 <code>student</code> 或 <code>teacher</code>（不可填 <code>admin</code>）。
              </small>
              <small style={{ display: "block", marginTop: 4 }}>
                username 規則：2~32 字元，可用英數字與 <code>.</code>、<code>_</code>、<code>-</code>。
              </small>
              <small style={{ display: "block", marginTop: 4 }}>
                password 至少 6 碼；student 必填 classnumber。
              </small>
              <small style={{ display: "block", marginTop: 4 }}>
                teacher 的 classnumber 與 ownerTeacherUsername 可填任意字串（可留空）。
              </small>
              <small style={{ display: "block", marginTop: 4 }}>
                {loginRole === "admin"
                  ? "admin 批次建立 student 時，必填 ownerTeacherUsername，且需為既有教師 username。"
                  : "teacher 批次建立時僅可建立 student；ownerTeacherUsername 會自動綁定為目前登入教師。"}
              </small>
            </div>
            <textarea
              style={{ marginTop: 8 }}
              value={csvInput}
              onChange={(e) => setCsvInput(e.target.value)}
              placeholder={
                loginRole === "admin"
                  ? "classnumber,username,name,school,role,password,ownerTeacherUsername\n701,student10,王小明,Demo High,student,abc12345,teacher"
                  : "classnumber,username,name,school,role,password\n701,student10,王小明,Demo High,student,abc12345"
              }
            />
            <div className="row" style={{ marginTop: 10 }}>
              <div style={{ width: 220 }}>
                <button type="button" onClick={importUsersFromCsv}>
                  驗證並批次新增
                </button>
              </div>
              <div style={{ width: 220 }}>
                <button
                  type="button"
                  className="secondary"
                  onClick={() =>
                    setCsvInput(
                      loginRole === "admin"
                        ? "classnumber,username,name,school,role,password,ownerTeacherUsername"
                        : "classnumber,username,name,school,role,password"
                    )
                  }
                >
                  載入範例表頭
                </button>
              </div>
            </div>
            {csvPreviewErrors.length > 0 ? (
              <div style={{ marginTop: 8 }}>
                {csvPreviewErrors.map((item, idx) => (
                  <small key={`${item}-${idx}`} style={{ display: "block" }}>
                    {item}
                  </small>
                ))}
              </div>
            ) : null}
          </div>

          {resetTargetUser ? (
            <div className="card" style={{ marginBottom: 10, borderColor: "#bfdbfe", background: "#eff6ff" }}>
              <h3 style={{ marginBottom: 8 }}>重設密碼：{resetTargetUser}</h3>
              <div className="row">
                <div className="col">
                  <label>密碼來源</label>
                  <select value={resetMode} onChange={(e) => setResetMode(e.target.value as "system" | "manual")}>
                    <option value="system">系統產生密碼</option>
                    <option value="manual">手動輸入新密碼</option>
                  </select>
                </div>
                {resetMode === "system" ? (
                  <>
                    <div className="col">
                      <label>系統產生密碼</label>
                      <input value={generatedPassword} readOnly />
                    </div>
                    <div className="col" style={{ alignSelf: "end" }}>
                      <button type="button" className="secondary" onClick={() => setGeneratedPassword(createRandomPassword())}>
                        重新產生
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="col">
                    <label>手動輸入新密碼（至少 6 碼）</label>
                    <input
                      type="text"
                      value={manualResetPassword}
                      onChange={(e) => setManualResetPassword(e.target.value)}
                      placeholder="輸入新密碼"
                    />
                  </div>
                )}
              </div>
              <div className="row" style={{ marginTop: 8 }}>
                <div style={{ width: 180 }}>
                  <button type="button" className="secondary" onClick={copyResetPasswordValue}>
                    複製密碼
                  </button>
                </div>
                <div style={{ width: 180 }}>
                  <button type="button" onClick={resetPassword}>
                    確認重設
                  </button>
                </div>
                <div style={{ width: 180 }}>
                  <button type="button" className="secondary" onClick={() => setResetTargetUser("")}>
                    取消
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {accountError ? <small style={{ color: "#b91c1c", display: "block", marginBottom: 8 }}>{accountError}</small> : null}
          {accountSuccess ? <small style={{ color: "#166534", display: "block", marginBottom: 8 }}>{accountSuccess}</small> : null}

          <div className="row" style={{ marginBottom: 10 }}>
            <div className="col">
              <label>搜尋（帳號 / 姓名 / 學校）</label>
              <input value={userQuery} onChange={(e) => setUserQuery(e.target.value)} placeholder="輸入關鍵字" />
            </div>
            <div className="col">
              <label>角色篩選</label>
              <select
                value={roleFilter}
                onChange={(e) => {
                  setRoleFilter(e.target.value as "all" | "teacher" | "student" | "admin");
                }}
              >
                <option value="all">全部</option>
                {loginRole === "admin" ? <option value="admin">管理員</option> : null}
                <option value="teacher">教師</option>
                <option value="student">學生</option>
              </select>
            </div>
            <div className="col">
              <label>學校篩選</label>
              <select value={schoolFilter} onChange={(e) => setSchoolFilter(e.target.value)}>
                <option value="all">全部學校</option>
                {schoolOptions.map((school) => (
                  <option key={school} value={school}>
                    {school}
                  </option>
                ))}
              </select>
            </div>
            {roleFilter === "student" && schoolFilter !== "all" ? (
              <div className="col">
                <label>班級篩選（由大到小）</label>
                <select value={classFilter} onChange={(e) => setClassFilter(e.target.value)}>
                  <option value="">全部班級</option>
                  {classFilterOptions.map((classNumber) => (
                    <option key={classNumber} value={classNumber}>
                      {classNumber}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
          </div>

          <div style={{ overflowX: "auto" }}>
            <table className="pro-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>
                    帳號
                    <button type="button" className="secondary" style={{ width: "auto", marginLeft: 6, padding: "2px 6px" }} onClick={() => toggleUserSort("username")}>
                      {getSortIndicator("username")}
                    </button>
                  </th>
                  <th>
                    姓名
                    <button type="button" className="secondary" style={{ width: "auto", marginLeft: 6, padding: "2px 6px" }} onClick={() => toggleUserSort("name")}>
                      {getSortIndicator("name")}
                    </button>
                  </th>
                  <th>學校</th>
                  <th>
                    班級號碼
                    <button type="button" className="secondary" style={{ width: "auto", marginLeft: 6, padding: "2px 6px" }} onClick={() => toggleUserSort("classNumber")}>
                      {getSortIndicator("classNumber")}
                    </button>
                  </th>
                  <th>角色</th>
                  <th>綁定教師</th>
                  <th style={{ width: 360 }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {pagedUsers.map((user, idx) => (
                  <tr key={user.username}>
                    <td>{userPageStartIndex + idx + 1}</td>
                    <td>{user.username}</td>
                    {editingUser?.username === user.username ? (
                      <>
                        <td>
                          <input
                            value={editingUser.name}
                            onChange={(e) => setEditingUser((prev) => (prev ? { ...prev, name: e.target.value } : prev))}
                          />
                        </td>
                        <td>
                          <input
                            value={editingUser.school}
                            onChange={(e) => setEditingUser((prev) => (prev ? { ...prev, school: e.target.value } : prev))}
                          />
                        </td>
                        <td>
                          {editingUser.role === "student" ? (
                            <input
                              value={editingUser.classNumber}
                              onChange={(e) => setEditingUser((prev) => (prev ? { ...prev, classNumber: e.target.value } : prev))}
                              placeholder="班級號碼"
                            />
                          ) : (
                            <small>—</small>
                          )}
                        </td>
                        <td>
                          <select
                            value={editingUser.role}
                            onChange={(e) =>
                              setEditingUser((prev) =>
                                prev ? { ...prev, role: e.target.value as "student" | "teacher" } : prev
                              )
                            }
                          >
                            <option value="student">學生</option>
                            {loginRole === "admin" || editingUser.username === loginUser ? (
                              <option value="teacher">教師</option>
                            ) : null}
                          </select>
                        </td>
                        <td>
                          {editingUser.role === "student" ? (
                            loginRole === "admin" ? (
                              <select
                                value={editingUser.ownerTeacherUsername}
                                onChange={(e) =>
                                  setEditingUser((prev) =>
                                    prev ? { ...prev, ownerTeacherUsername: e.target.value } : prev
                                  )
                                }
                              >
                                <option value="">請選擇教師</option>
                                {users
                                  .filter((item) => item.role === "teacher")
                                  .map((teacher) => (
                                    <option key={teacher.username} value={teacher.username}>
                                      {teacher.username}
                                    </option>
                                  ))}
                              </select>
                            ) : (
                              <small>{loginUser}</small>
                            )
                          ) : (
                            <small>—</small>
                          )}
                        </td>
                        <td>
                          <div style={{ display: "grid", gap: 6 }}>
                            <div>
                              <input
                                type="password"
                                placeholder="新密碼（選填）"
                                value={editingUser.password}
                                onChange={(e) =>
                                  setEditingUser((prev) => (prev ? { ...prev, password: e.target.value } : prev))
                                }
                              />
                            </div>
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                              <button type="button" style={{ width: "auto", minWidth: 72 }} onClick={saveEditedUser}>
                                儲存
                              </button>
                              <button
                                type="button"
                                className="secondary"
                                style={{ width: "auto", minWidth: 72 }}
                                onClick={() => setEditingUser(null)}
                              >
                                取消
                              </button>
                            </div>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td>{user.name}</td>
                        <td>{user.school}</td>
                        <td>{user.role === "student" ? user.classNumber ?? "—" : "—"}</td>
                        <td>
                          <span className="badge">
                            {user.role === "teacher" ? "教師" : user.role === "admin" ? "管理員" : "學生"}
                          </span>
                        </td>
                        <td>{user.role === "student" ? user.ownerTeacherUsername ?? "—" : "—"}</td>
                        <td>
                          {user.role === "admin" ? (
                            <small>系統保留帳號</small>
                          ) : (
                            <div className="row" style={{ gap: 8 }}>
                              <button
                                type="button"
                                className="secondary"
                                style={{ width: "auto" }}
                                onClick={() =>
                                  setEditingUser({
                                    username: user.username,
                                    name: user.name,
                                    school: user.school,
                                    role: user.role === "teacher" ? "teacher" : "student",
                                    ownerTeacherUsername: user.ownerTeacherUsername ?? "",
                                    classNumber: user.classNumber ?? "",
                                    password: ""
                                  })
                                }
                              >
                                修改
                              </button>
                              <button
                                type="button"
                                className="secondary"
                                style={{ width: "auto" }}
                                onClick={() => openResetPassword(user.username)}
                              >
                                重設密碼
                              </button>
                              <button
                                type="button"
                                className="secondary"
                                style={{ width: "auto", color: "#b91c1c", borderColor: "#fecaca", background: "#fef2f2" }}
                                onClick={() => deleteUser(user.username)}
                              >
                                刪除
                              </button>
                            </div>
                          )}
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="row" style={{ marginTop: 10, alignItems: "center" }}>
            <small>
              第 {userPage} / {totalUserPages} 頁，共 {sortedUsers.length} 筆（每頁 20 筆）
            </small>
            <div style={{ width: 120 }}>
              <button type="button" className="secondary" disabled={userPage <= 1} onClick={() => setUserPage((prev) => prev - 1)}>
                上一頁
              </button>
            </div>
            <div style={{ width: 120 }}>
              <button
                type="button"
                className="secondary"
                disabled={userPage >= totalUserPages}
                onClick={() => setUserPage((prev) => prev + 1)}
              >
                下一頁
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {tab === "learning" ? (
        <>
          <div className="card">
            <h2>學習管理</h2>
            {isLearningProcessing ? (
              <div
                style={{
                  marginBottom: 12,
                  padding: "12px 14px",
                  border: "1px solid #60a5fa",
                  background: "#dbeafe",
                  color: "#1e40af",
                  borderRadius: 8
                }}
              >
                <strong style={{ fontSize: 16 }}>資料載入中...</strong>
                <div style={{ marginTop: 4 }}>{learningProcessingText}</div>
              </div>
            ) : null}
            <div className="row" style={{ marginBottom: 10, gap: 8 }}>
              <div className="col">
                <label>學校篩選</label>
                <select value={learningSchoolFilter} onChange={(e) => setLearningSchoolFilter(e.target.value)}>
                  <option value="all">全部</option>
                  {learningSchoolOptions.map((school) => (
                    <option key={school} value={school}>
                      {school}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col">
                <label>班級篩選</label>
                <select value={learningClassFilter} onChange={(e) => setLearningClassFilter(e.target.value)}>
                  <option value="all">全部</option>
                  {learningClassOptions.map((classNumber) => (
                    <option key={classNumber} value={classNumber}>
                      {classNumber}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col">
                <label>課程篩選</label>
                <select value={learningCourseFilter} onChange={(e) => setLearningCourseFilter(e.target.value)}>
                  <option value="all">全部</option>
                  {learningCourseOptions.map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col">
                <label>狀態篩選</label>
                <select value={learningStatusFilter} onChange={(e) => setLearningStatusFilter(e.target.value)}>
                  <option value="all">全部</option>
                  <option value="not_started">尚未開始</option>
                  <option value="in_progress">進行中</option>
                  <option value="paused">暫停中</option>
                  <option value="ended">已結束</option>
                </select>
              </div>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table className="pro-table">
                <thead>
                  <tr>
                    <th>學校</th>
                    <th>班級</th>
                    <th>課程</th>
                    <th>目前狀態</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedLearningActivities.map((activity) => {
                    const status = activity.courseStatus;
                    const startDisabled = status !== "not_started";
                    const pauseResumeDisabled = status === "not_started" || status === "ended";
                    const endDisabled = status === "not_started" || status === "ended";
                    const viewDisabled = status === "not_started";
                    const disabledButtonStyle = {
                      width: "auto",
                      background: "#f3f4f6",
                      color: "#9ca3af",
                      borderColor: "#e5e7eb",
                      cursor: "not-allowed"
                    } as const;
                    const enabledButtonStyle = { width: "auto" } as const;
                    return (
                      <tr key={activity.id}>
                        <td>{activity.school}</td>
                        <td>{activity.classNumber}</td>
                        <td>{activity.title}</td>
                        <td>{getCourseStatusLabel(status)}</td>
                        <td>
                          <div className="row" style={{ gap: 8 }}>
                            <button
                              type="button"
                              style={startDisabled ? disabledButtonStyle : enabledButtonStyle}
                              className={startDisabled ? "secondary" : ""}
                              disabled={startDisabled || isLearningProcessing}
                              onClick={() => handleCourseLifecycle(activity.id, "start")}
                            >
                              開始上課
                            </button>
                            <button
                              type="button"
                              className={pauseResumeDisabled ? "secondary" : ""}
                              style={pauseResumeDisabled ? disabledButtonStyle : enabledButtonStyle}
                              disabled={pauseResumeDisabled || isLearningProcessing}
                              onClick={() => handleCourseLifecycle(activity.id, "pause_resume")}
                            >
                              {status === "in_progress" ? "暫停上課" : "繼續上課"}
                            </button>
                            <button
                              type="button"
                              className={endDisabled ? "secondary" : ""}
                              style={endDisabled ? disabledButtonStyle : enabledButtonStyle}
                              disabled={endDisabled || isLearningProcessing}
                              onClick={() => handleCourseLifecycle(activity.id, "end")}
                            >
                              結束上課
                            </button>
                            <button
                              type="button"
                              className="secondary"
                              style={viewDisabled ? disabledButtonStyle : enabledButtonStyle}
                              disabled={viewDisabled || isLearningProcessing}
                              onClick={() => {
                                openCourseStatus(activity.id).catch(() => undefined);
                              }}
                            >
                              查看狀態
                            </button>
                            <button
                              type="button"
                              className="secondary"
                              style={{ width: "auto" }}
                              disabled={isLearningProcessing}
                              onClick={() => {
                                setSelectedLearningActivityId(activity.id);
                                runLearningAction("系統正在重新整理課程資料，請稍候...", async () => {
                                  await refreshAll(showCourseStatusView);
                                });
                              }}
                            >
                              重新整理
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="row" style={{ marginTop: 10, alignItems: "center", gap: 8 }}>
              <small>
                第 {learningPage} / {totalLearningPages} 頁，共 {filteredLearningActivities.length} 筆（每頁 10 筆）
              </small>
              <button
                type="button"
                className="secondary"
                style={{ width: "auto" }}
                disabled={learningPage <= 1}
                onClick={() => setLearningPage((prev) => Math.max(1, prev - 1))}
              >
                上一頁
              </button>
              <button
                type="button"
                className="secondary"
                style={{ width: "auto" }}
                disabled={learningPage >= totalLearningPages}
                onClick={() => setLearningPage((prev) => Math.min(totalLearningPages, prev + 1))}
              >
                下一頁
              </button>
              <label style={{ marginLeft: 8 }}>跳到第</label>
              <input
                type="number"
                min={1}
                max={totalLearningPages}
                value={learningJumpPage}
                onChange={(e) => setLearningJumpPage(e.target.value)}
                style={{ width: 90 }}
              />
              <span>頁</span>
              <button
                type="button"
                className="secondary"
                style={{ width: "auto" }}
                onClick={() => {
                  const parsed = Number(learningJumpPage);
                  if (!Number.isFinite(parsed)) return;
                  const target = Math.min(totalLearningPages, Math.max(1, Math.trunc(parsed)));
                  setLearningPage(target);
                }}
              >
                前往
              </button>
            </div>
            {filteredLearningActivities.length === 0 ? (
              <small>目前此篩選條件下沒有課程資料。</small>
            ) : activities.length === 0 ? (
              <small>目前沒有可顯示的課程資料。請按「重新整理」或確認此帳號是否有可見課程。</small>
            ) : null}
            {learningWarning ? <small>{learningWarning}</small> : null}
            {error ? <small>{error}</small> : null}
          </div>

          {showCourseStatusView ? (
            <>
              {isLearningProcessing ? (
                <div
                  className="card"
                  style={{
                    borderColor: "#60a5fa",
                    background: "#dbeafe"
                  }}
                >
                  <h2 style={{ marginBottom: 6 }}>系統處理中</h2>
                  <p style={{ margin: 0, color: "#1e40af" }}>{learningProcessingText || "正在載入課程狀態資料，請稍候..."}</p>
                </div>
              ) : null}
              <div className="card">
                <h2>全班加入狀態</h2>
                <div style={{ overflowX: "auto" }}>
                  <table className="pro-table">
                    <thead>
                      <tr>
                        <th>序號</th>
                        <th>學生帳號</th>
                        <th>加入狀態</th>
                        <th>所在組別</th>
                        <th>目前進度</th>
                      </tr>
                    </thead>
                    <tbody>
                      {classJoinRows.map((row, idx) => (
                        <tr key={row.username}>
                          <td>{idx + 1}</td>
                          <td>{row.username}</td>
                          <td>{row.joined ? "已加入" : "未加入"}</td>
                          <td>{row.groupName ?? "—"}</td>
                          <td>{row.step ? `Step ${row.step}` : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {classJoinRows.length === 0 ? <small>此課程目前沒有可見學生名單。</small> : null}
              </div>

              <div className="card">
                <h2>分組狀態總覽</h2>
                <div style={{ overflowX: "auto" }}>
                  <table className="pro-table">
                    <thead>
                      <tr>
                        <th>組別</th>
                        <th>組員總數</th>
                        <th>已加入人數</th>
                        <th>未加入人數</th>
                        <th>小組目前進度</th>
                      </tr>
                    </thead>
                    <tbody>
                      {groupStatusRows.map((row) => (
                        <tr key={row.groupId}>
                          <td>{row.groupName}</td>
                          <td>{row.totalMembers}</td>
                          <td>{row.joinedCount}</td>
                          <td>{row.pendingCount}</td>
                          <td>{row.currentStep ? `Step ${row.currentStep}` : "尚未建立 session"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {groupStatusRows.length === 0 ? <small>此課程目前沒有分組資料。</small> : null}
              </div>

              <div className="card">
                <h2>課程狀態內容（即時 / 歷史）</h2>
                <div style={{ overflowX: "auto" }}>
                  <table className="pro-table">
                    <thead>
                      <tr>
                        <th>序號</th>
                        <th>寫作任務</th>
                        <th>小組名稱</th>
                        <th>成員名單</th>
                        <th>小組進度</th>
                        <th>Step5-10 人數</th>
                        <th>步驟切換提示</th>
                        <th>動作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredMonitorSessions.map((session, idx) => (
                        <tr key={session.sessionId}>
                          <td>{idx + 1}</td>
                          <td>{session.activityTitle ?? session.activityId}</td>
                          <td>{session.groupName ?? session.groupId ?? "未命名組"}</td>
                          <td>{session.participants.join(", ")}</td>
                          <td>Step {session.currentStep}</td>
                          <td>
                            <small>{getPersonalStepCountText(session)}</small>
                          </td>
                          <td>
                            {(() => {
                              const hint = getStepAdvanceHint(session);
                              return (
                                <>
                                  <small style={{ color: hint.ready ? "#166534" : "#6b7280" }}>{hint.text}</small>
                                  {hint.ready && hint.nextStep ? (
                                    <div style={{ marginTop: 6 }}>
                                      <button
                                        type="button"
                                        className="secondary"
                                        style={{ width: "auto" }}
                                        disabled={isLearningProcessing}
                                        onClick={() => applyStepSwitch(session.sessionId, hint.nextStep!)}
                                      >
                                        套用 Step {hint.nextStep}
                                      </button>
                                    </div>
                                  ) : null}
                                </>
                              );
                            })()}
                          </td>
                          <td>
                            <div className="row" style={{ gap: 8 }}>
                              <button
                                type="button"
                                className="secondary"
                                style={{ width: "auto" }}
                                disabled={isLearningProcessing}
                                onClick={() => {
                                  setMonitorSelected(session);
                                  setGroupViewStep("all");
                                  setProgressSessionId(session.sessionId);
                                }}
                              >
                                查看小組對話
                              </button>
                              <button
                                type="button"
                                className="secondary"
                                style={{ width: "auto" }}
                                disabled={isLearningProcessing}
                                onClick={() => {
                                  setProgressSessionId(session.sessionId);
                                  loadProgress(session.sessionId);
                                }}
                              >
                                查看個人進度
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {filteredMonitorSessions.length === 0 ? (
                  <small>此課程目前沒有 session。開始上課後，學生加入討論即會出現即時或歷史內容。</small>
                ) : null}
              </div>

              <div className="card">
                <h2>個人進度表</h2>
                <div className="row">
                  <div className="col">
                    <label>個人進度對象</label>
                    <select value={progressSessionId} onChange={(e) => setProgressSessionId(e.target.value)}>
                      <option value="">請選擇課程/班級/組別</option>
                      {filteredMonitorSessions.map((session) => (
                        <option key={session.sessionId} value={session.sessionId}>
                          {formatSessionLabel(session)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col" style={{ alignSelf: "end" }}>
                    <button type="button" className="secondary" disabled={isLearningProcessing} onClick={() => loadProgress()}>
                      載入個人進度
                    </button>
                  </div>
                </div>
                <div style={{ overflowX: "auto", marginTop: 10 }}>
                  <table className="pro-table">
                    <thead>
                      <tr>
                        <th>序號</th>
                        <th>姓名</th>
                        <th>個人進度</th>
                        <th>發言數</th>
                        <th>最後發言時間</th>
                        <th>動作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {progressRows.map((row, idx) => (
                        <tr key={row.username}>
                          <td>{idx + 1}</td>
                          <td>{row.username}</td>
                          <td>Step {row.currentStep}</td>
                          <td>{row.messageCount}</td>
                          <td>{row.lastMessageAt ? new Date(row.lastMessageAt).toLocaleString("zh-TW") : "—"}</td>
                          <td>
                            <button
                              type="button"
                              className="secondary"
                              style={{ width: "auto" }}
                              disabled={isLearningProcessing}
                              onClick={() => loadProgress(progressSessionId, row.username)}
                            >
                              查看
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {selectedProgressUser ? <small>目前檢視：{selectedProgressUser}</small> : null}
              </div>

              {monitorSelected ? (
                <div className="card">
                  <h2>小組對話紀錄</h2>
                  <div className="row" style={{ marginBottom: 8 }}>
                    <div className="col">
                      <label>步驟篩選（僅小組互動步驟）</label>
                      <select value={groupViewStep} onChange={(e) => setGroupViewStep(e.target.value)}>
                        <option value="all">全部（1/2/4）</option>
                        <option value="1">Step 1</option>
                        <option value="2">Step 2</option>
                        <option value="4">Step 4</option>
                      </select>
                    </div>
                  </div>
                  {groupMessages.map((message) => (
                    <div key={message.id} style={{ borderTop: "1px solid #e5e7eb", padding: "8px 0" }}>
                      <strong>
                        [S{message.step}] {message.role}
                        {message.userId ? `(${message.userId})` : ""}
                      </strong>
                      <div dangerouslySetInnerHTML={{ __html: renderMessageHtml(message.text) }} />
                      {([3, 4].includes(message.step) && extractMermaidText(message.text)) ? (() => {
                        const preview = buildOutlinePreview(extractMermaidText(message.text) ?? "");
                        if (!preview) return null;
                        return (
                          <div style={{ marginTop: 8, overflow: "auto", border: "1px solid #e5e7eb", borderRadius: 8, padding: 8, background: "#f8fafc" }}>
                            <svg width={preview.width} height={preview.height} role="img" aria-label={`S${message.step} 結構樹`}>
                              {preview.nodes
                                .filter((node) => node.parentId)
                                .map((node) => {
                                  const parent = preview.nodes.find((item) => item.id === node.parentId);
                                  if (!parent) return null;
                                  return (
                                    <line
                                      key={`${parent.id}-${node.id}`}
                                      x1={parent.x + 65}
                                      y1={parent.y + 40}
                                      x2={node.x + 65}
                                      y2={node.y}
                                      stroke="#94a3b8"
                                      strokeWidth="2"
                                    />
                                  );
                                })}
                              {preview.nodes.map((node) => (
                                <g key={node.id}>
                                  <rect x={node.x} y={node.y} width="130" height="80" rx="12" fill="#fff" stroke="#64748b" />
                                  <text x={node.x + 65} y={node.y + 28} textAnchor="middle" fontSize="12" fill="#0f172a">
                                    {node.text.split("\n").map((line, idx) => (
                                      <tspan key={`${node.id}-${idx}`} x={node.x + 65} dy={idx === 0 ? 0 : 16}>
                                        {line}
                                      </tspan>
                                    ))}
                                  </text>
                                </g>
                              ))}
                            </svg>
                          </div>
                        );
                      })() : null}
                    </div>
                  ))}
                  {groupMessages.length === 0 ? <small>目前此篩選條件下沒有 1/2/4 步驟對話。</small> : null}
                </div>
              ) : null}

              {personalMessages.length > 0 ? (
                <div className="card">
                  <h2>個人對話紀錄</h2>
                  {personalMessages.map((message) => (
                    <div key={message.id} style={{ borderTop: "1px solid #e5e7eb", padding: "8px 0" }}>
                      <strong>
                        [S{message.step}] {message.role}
                        {message.userId ? `(${message.userId})` : ""}
                      </strong>
                      <div dangerouslySetInnerHTML={{ __html: renderMessageHtml(message.text) }} />
                      {([3, 4].includes(message.step) && extractMermaidText(message.text)) ? (() => {
                        const preview = buildOutlinePreview(extractMermaidText(message.text) ?? "");
                        if (!preview) return null;
                        return (
                          <div style={{ marginTop: 8, overflow: "auto", border: "1px solid #e5e7eb", borderRadius: 8, padding: 8, background: "#f8fafc" }}>
                            <svg width={preview.width} height={preview.height} role="img" aria-label={`S${message.step} 結構樹`}>
                              {preview.nodes
                                .filter((node) => node.parentId)
                                .map((node) => {
                                  const parent = preview.nodes.find((item) => item.id === node.parentId);
                                  if (!parent) return null;
                                  return (
                                    <line
                                      key={`${parent.id}-${node.id}`}
                                      x1={parent.x + 65}
                                      y1={parent.y + 40}
                                      x2={node.x + 65}
                                      y2={node.y}
                                      stroke="#94a3b8"
                                      strokeWidth="2"
                                    />
                                  );
                                })}
                              {preview.nodes.map((node) => (
                                <g key={node.id}>
                                  <rect x={node.x} y={node.y} width="130" height="80" rx="12" fill="#fff" stroke="#64748b" />
                                  <text x={node.x + 65} y={node.y + 28} textAnchor="middle" fontSize="12" fill="#0f172a">
                                    {node.text.split("\n").map((line, idx) => (
                                      <tspan key={`${node.id}-${idx}`} x={node.x + 65} dy={idx === 0 ? 0 : 16}>
                                        {line}
                                      </tspan>
                                    ))}
                                  </text>
                                </g>
                              ))}
                            </svg>
                          </div>
                        );
                      })() : null}
                    </div>
                  ))}
                  {personalMessages.length === 0 ? <small>目前此學生沒有可顯示對話。</small> : null}
                </div>
              ) : null}
            </>
          ) : null}
        </>
      ) : null}

      {tab === "course" ? (
        <>
          <div className="card">
            <h2>課程管理</h2>
            <small>以下為第二層分頁，先選擇管理模組，再編輯對應內容。</small>
            <div className="row" style={{ marginTop: 10 }}>
              <div style={{ width: 210 }}>
              <button type="button" className={courseTab === "essay" ? "" : "secondary"} onClick={() => setCourseTab("essay")}>寫作主題管理</button>
              </div>
              <div style={{ width: 210 }}>
              <button type="button" className={courseTab === "openclass" ? "" : "secondary"} onClick={() => setCourseTab("openclass")}>寫作任務管理</button>
              </div>
              <div style={{ width: 210 }}>
              <button type="button" className={courseTab === "group" ? "" : "secondary"} onClick={() => setCourseTab("group")}>組別管理</button>
              </div>
            </div>
          </div>

          {courseTab === "essay" ? (
            <div className="card">
              <h2>寫作主題管理</h2>
              <small>Prompt 與問題庫改由系統參數 JSON 管理；此處僅維護主題資料。</small>
              <form onSubmit={saveEssay} className="row">
                <div className="col">
                  <label>標題</label>
                  <input value={essayForm.title} onChange={(e) => setEssayForm({ ...essayForm, title: e.target.value })} />
                </div>
                <div className="col">
                  <label>文體</label>
                  <select value={essayForm.genre} onChange={(e) => setEssayForm({ ...essayForm, genre: e.target.value })}>
                    {genreOptions.map((genre) => (
                      <option key={genre} value={genre}>
                        {genre}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col">
                  <label>引導說明</label>
                  <textarea
                    rows={6}
                    value={essayForm.description}
                    onChange={(e) => setEssayForm({ ...essayForm, description: e.target.value })}
                  />
                </div>
                <div className="col" style={{ alignSelf: "end" }}>
                  <button type="submit">{essayForm.id ? "儲存主題" : "新增主題"}</button>
                </div>
                {essayForm.id ? (
                  <div className="col" style={{ alignSelf: "end" }}>
                    <button
                      type="button"
                      className="secondary"
                      onClick={() =>
                        setEssayForm({
                          id: "",
                          title: "",
                          genre: "議論文",
                          description: "",
                          enabled: true
                        })
                      }
                    >
                      取消編輯
                    </button>
                  </div>
                ) : null}
                {error ? (
                  <div className="col" style={{ width: "100%" }}>
                    <small>{error}</small>
                  </div>
                ) : null}
              </form>
              {essayForm.id ? (
                <small>
                  目前正在編輯：{essayForm.id}
                </small>
              ) : null}
              <div style={{ overflowX: "auto", marginTop: 10 }}>
                <table className="pro-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>主題</th>
                      <th>文體</th>
                      <th>引導說明</th>
                      <th style={{ width: 140 }}>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {essays.map((essay) => (
                      <tr key={essay.id}>
                        <td>{essay.id}</td>
                        <td>{essay.title}</td>
                        <td>{essay.genre}</td>
                        <td>{essay.description || "—"}</td>
                        <td>
                          <div className="row" style={{ gap: 8 }}>
                            <button type="button" className="secondary" style={{ width: "auto" }} onClick={() => startEditEssay(essay)}>
                              編輯
                            </button>
                            <button
                              type="button"
                              className="secondary"
                              style={{
                                width: "auto",
                                background: essay.enabled ? "#f3f4f6" : undefined,
                                color: essay.enabled ? "#9ca3af" : undefined,
                                borderColor: essay.enabled ? "#e5e7eb" : undefined,
                                cursor: essay.enabled ? "not-allowed" : undefined
                              }}
                              disabled={essay.enabled}
                              onClick={() => toggleEssayEnabled(essay, true)}
                            >
                              啟用
                            </button>
                            <button
                              type="button"
                              className="secondary"
                              style={{
                                width: "auto",
                                background: !essay.enabled ? "#f3f4f6" : undefined,
                                color: !essay.enabled ? "#9ca3af" : undefined,
                                borderColor: !essay.enabled ? "#e5e7eb" : undefined,
                                cursor: !essay.enabled ? "not-allowed" : undefined
                              }}
                              disabled={!essay.enabled}
                              onClick={() => toggleEssayEnabled(essay, false)}
                            >
                              停用
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {courseTab === "openclass" ? (
            <div className="card">
              <h2>寫作任務管理</h2>
              <form onSubmit={saveOpenClass} className="row">
                <div className="col">
                  <label>班級號碼（由學生名單帶入）</label>
                  <select
                    value={openClassForm.classNumber}
                    onChange={(e) => setOpenClassForm({ ...openClassForm, classNumber: e.target.value })}
                  >
                    <option value="">請選擇</option>
                    {classOptions.map((classNumber) => (
                      <option key={classNumber} value={classNumber}>
                        {classNumber}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col">
                  <label>主題（含 ID）</label>
                  <select
                    value={openClassForm.essayId}
                    onChange={(e) => setOpenClassForm({ ...openClassForm, essayId: e.target.value })}
                  >
                    <option value="">請選擇</option>
                    {essays
                      .filter((essay) => essay.enabled || essay.id === openClassForm.essayId)
                      .map((essay) => (
                      <option key={essay.id} value={essay.id}>
                        {essay.id} / {essay.title}
                      </option>
                      ))}
                  </select>
                </div>
                <div className="col">
                  <label>時長</label>
                  <input
                    type="number"
                    value={openClassForm.durationMinutes}
                    onChange={(e) => setOpenClassForm({ ...openClassForm, durationMinutes: Number(e.target.value) || 0 })}
                  />
                </div>
                <div className="col">
                  <label>補充資料</label>
                  <textarea
                    rows={6}
                    value={openClassForm.supplemental}
                    onChange={(e) => setOpenClassForm({ ...openClassForm, supplemental: e.target.value })}
                  />
                </div>
                <div className="col" style={{ alignSelf: "end" }}>
                  <button type="submit">{openClassForm.id ? "儲存任務編輯" : "新增班級任務"}</button>
                </div>
                {error ? (
                  <div className="col" style={{ width: "100%" }}>
                    <small>{error}</small>
                  </div>
                ) : null}
              </form>
              <div style={{ overflowX: "auto", marginTop: 10 }}>
                <table className="pro-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>學校</th>
                      <th>班級</th>
                      <th>主題</th>
                      <th>時長</th>
                      <th>補充資料</th>
                      <th>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {openClasses.map((openClass) => (
                      <tr key={openClass.id}>
                        <td>{openClass.id}</td>
                        <td>{openClass.school}</td>
                        <td>{openClass.classNumber}</td>
                        <td>{openClass.essayTitle}</td>
                        <td>{openClass.durationMinutes} 分鐘</td>
                        <td>{openClass.supplemental || "—"}</td>
                        <td>
                          <button type="button" className="secondary" style={{ width: "auto" }} onClick={() => startEditOpenClass(openClass)}>
                            編輯
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {courseTab === "group" ? (
            <div className="card">
              <h2>組別管理</h2>
              <div className="row">
                <div className="col">
                  <label>選擇任務</label>
                  <select value={selectedActivityId} onChange={(e) => setSelectedActivityId(e.target.value)}>
                    <option value="">請選擇</option>
                    {activities.map((activity) => (
                      <option key={activity.id} value={activity.id}>
                        {activity.classNumber} 班 / {activity.title} ({activity.id})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col">
                  <label>小組數量</label>
                  <input type="number" min={1} value={groupCount} onChange={(e) => setGroupCount(Number(e.target.value) || 1)} />
                </div>
                <div className="col" style={{ alignSelf: "end" }}>
                  <div className="row">
                    <div style={{ width: 140 }}>
                      <button
                        type="button"
                        className="secondary"
                        onClick={randomAssignGroups}
                        disabled={!selectedActivityId}
                      >
                        隨機平均分組
                      </button>
                    </div>
                    <div style={{ width: 140 }}>
                      <button
                        type="button"
                        className="secondary"
                        onClick={initializeGroupsForDrag}
                        disabled={!selectedActivityId}
                      >
                        先建空組
                      </button>
                    </div>
                    <div style={{ width: 140 }}>
                      <button
                        type="button"
                        onClick={saveGroups}
                        disabled={!canSaveGroups}
                        style={{
                          background: !canSaveGroups ? "#f3f4f6" : undefined,
                          color: !canSaveGroups ? "#9ca3af" : undefined,
                          borderColor: !canSaveGroups ? "#e5e7eb" : undefined,
                          cursor: !canSaveGroups ? "not-allowed" : undefined
                        }}
                      >
                        儲存分組
                      </button>
                    </div>
                    <div style={{ width: 140 }}>
                      <button type="button" className="secondary" onClick={cancelGroupEdits} disabled={!selectedActivityId}>
                        取消
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              <small>
                {hasExistingGrouping
                  ? "此任務已有既有分組，可直接拖曳調整；若按初始化按鈕會先將所有學生重設為未分配。"
                  : "此任務尚未分組，請先設定組數並執行隨機分組或先建空組後拖曳。"}
              </small>
              <small>
                目前未分配學生：{unassignedStudents.length} 人（為 0 時才可儲存分組）
              </small>

              <div className="row" style={{ marginTop: 12 }}>
                <div
                  className="col"
                  style={{ minHeight: 120, border: "1px dashed #94a3b8", borderRadius: 8, padding: 10 }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={dropToUnassigned}
                >
                  <strong>未分配學生</strong>
                  {unassignedStudents.map((username) => (
                    <div
                      key={username}
                      draggable
                      onDragStart={onDragStart(username, "unassigned")}
                      style={{ padding: "6px 8px", marginTop: 6, border: "1px solid #cbd5e1", borderRadius: 6 }}
                    >
                      {username}
                    </div>
                  ))}
                </div>

                {editableGroups.map((group) => (
                  <div
                    key={group.groupId}
                    className="col"
                    style={{ minHeight: 120, border: "1px dashed #94a3b8", borderRadius: 8, padding: 10 }}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={dropToGroup(group.groupId)}
                  >
                    <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                      <strong>組別 {group.groupName}</strong>
                      {group.members.length === 0 ? (
                        <button
                          type="button"
                          className="secondary"
                          style={{ width: "auto", minWidth: 36, padding: "4px 8px" }}
                          onClick={() => removeGroup(group.groupId)}
                        >
                          x
                        </button>
                      ) : null}
                    </div>
                    {group.members.map((username) => (
                      <div
                        key={username}
                        draggable
                        onDragStart={onDragStart(username, group.groupId)}
                        style={{ padding: "6px 8px", marginTop: 6, border: "1px solid #cbd5e1", borderRadius: 6 }}
                      >
                        {username}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </main>
  );
}
