"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArtifactDiagnostics, buildAdvancedStuckRisk, QualitySignals } from "@/src/lib/learning-diagnostics";
import { formatUserError } from "@/src/lib/error-messages";
import { deferStateUpdate } from "@/src/lib/defer-state-update";
import {
  getActivityGroupScopedSessions,
  getActivityScopedSessions,
  isSessionInActivityGroupScope,
  isSessionInActivityScope
} from "@/src/lib/monitor-session-scope";
import { excludeWaitingMembers, isWaitingExcluded } from "@/src/lib/session-attendance";
import {
  computeTeacherMonitorPayloadHash,
  hasLowLatencyStepAdvanceGate,
  resolveTeacherMonitorNextPollDelay,
  TEACHER_MONITOR_FAST_POLL_MS,
  TEACHER_MONITOR_MIN_POLL_MS
} from "@/src/lib/teacher-monitor-polling";
import { fetchJsonWithRetry } from "@/src/lib/client-retry-fetch";
import TeacherDashboard, { TeacherDashboardData } from "./TeacherDashboard";
import CourseDiagnosticsPanel from "./CourseDiagnosticsPanel";
import { ActivityRow, CourseDiagnosticsPayload, MonitorSession, UserRow } from "./types";
import ConfirmDialog from "./ConfirmDialog";
import MonitorFilterBar from "./MonitorFilterBar";
import CourseLifecycleTable from "./CourseLifecycleTable";
import ClassJoinStatusTable from "./ClassJoinStatusTable";
import ProgressStatsPanel from "./ProgressStatsPanel";
import GroupLogPanel from "./GroupLogPanel";
import PersonalLogPanel from "./PersonalLogPanel";

// Re-export QualitySignals/ArtifactDiagnostics usage via types import
type _QS = QualitySignals;
type _AD = ArtifactDiagnostics;
void (null as unknown as _QS);
void (null as unknown as _AD);

type ClassJoinSortColumn = "username" | "groupName" | "step" | "messageCount";
type SortDirection = "asc" | "desc";


const TEACHER_MONITOR_ACTIVITY_STORAGE_KEY = "teacher:monitor:selectedActivityId";
const ADMIN_MONITOR_ACTIVITY_STORAGE_KEY = "admin:monitor:selectedActivityId";

interface LearningMonitorTabProps {
  loginRole: "teacher" | "admin";
  isAdminConsole: boolean;
  activities: ActivityRow[];
  users: UserRow[];
  error: string;
  setError: (e: string) => void;
  onRefreshData: () => Promise<void>;
}

export default function LearningMonitorTab({
  loginRole,
  isAdminConsole,
  activities,
  users,
  error,
  setError,
  onRefreshData,
}: LearningMonitorTabProps) {
  const [monitorSessions, setMonitorSessions] = useState<MonitorSession[]>([]);
  const [monitorSelected, setMonitorSelected] = useState<MonitorSession | null>(null);
  // Default to collapsed (#245): teachers usually scan the dashboard first; logs are
  // opt-in details. Section-level and per-step cards both default to closed.
  const [groupLogExpanded, setGroupLogExpanded] = useState(false);
  const [personalLogExpanded, setPersonalLogExpanded] = useState(false);
  const [groupLogStepExpanded, setGroupLogStepExpanded] = useState<Record<number, boolean>>({});
  const [personalLogStepExpanded, setPersonalLogStepExpanded] = useState<Record<number, boolean>>({});
  const [selectedLearningActivityId, setSelectedLearningActivityId] = useState("");
  const [showCourseStatusView, setShowCourseStatusView] = useState(false);
  const [isLearningProcessing, setIsLearningProcessing] = useState(false);
  const [learningProcessingText, setLearningProcessingText] = useState("");
  const [learningActionKey, setLearningActionKey] = useState("");
  const [detailLoadingSessionId, setDetailLoadingSessionId] = useState("");
  const [learningWarning, setLearningWarning] = useState("");
  const [courseDiagnostics, setCourseDiagnostics] = useState<CourseDiagnosticsPayload | null>(null);
  const [courseDiagnosticsLoading, setCourseDiagnosticsLoading] = useState(false);
  const [courseDiagnosticsError, setCourseDiagnosticsError] = useState("");
  const [courseDiagnosticsPage, setCourseDiagnosticsPage] = useState(1);
  const [selectedProgressUser, setSelectedProgressUser] = useState("");
  const [personalMessages, setPersonalMessages] = useState<{ id: string; role: string; userId?: string; step: number; text: string; at: string }[]>([]);
  const [userOutline, setUserOutline] = useState("");
  const [userStep3SubmittedOutline, setUserStep3SubmittedOutline] = useState("");
  const [progressSessionId, setProgressSessionId] = useState("");
  const [learningSchoolFilter, setLearningSchoolFilter] = useState("all");
  const [learningClassFilter, setLearningClassFilter] = useState("all");
  const [learningCourseFilter, setLearningCourseFilter] = useState("all");
  const [learningStatusFilter, setLearningStatusFilter] = useState("all");
  const [learningPage, setLearningPage] = useState(1);
  const [learningJumpPage, setLearningJumpPage] = useState("1");
  const [progressStatsPage, setProgressStatsPage] = useState(1);
  const [pendingLifecycleAction, setPendingLifecycleAction] = useState<{ activityId: string; action: "start" | "pause_resume" | "end"; title: string } | null>(null);
  const [pendingDeleteActivity, setPendingDeleteActivity] = useState<{ activityId: string; title: string } | null>(null);
  const [classJoinSort, setClassJoinSort] = useState<{ column: ClassJoinSortColumn; direction: SortDirection }>({
    column: "username",
    direction: "asc"
  });
  const monitorPollingBusyRef = useRef(false);
  // Anchor for "查看對話" jump-to-section behavior (#246).
  const groupLogRef = useRef<HTMLDivElement | null>(null);
  // Anchor for "查看" (per-student) jump-to-section behavior (#249).
  const personalLogRef = useRef<HTMLDivElement | null>(null);
  // Exponential-backoff state for monitor polling (#239).
  // We hash the sessions payload to detect quiescent periods and stretch the interval.
  const monitorPayloadHashRef = useRef<string>("");
  const monitorPollDelayRef = useRef<number>(3000);
  const monitorSessionsRef = useRef<MonitorSession[]>([]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (selectedLearningActivityId) return;
    const storageKey = isAdminConsole ? ADMIN_MONITOR_ACTIVITY_STORAGE_KEY : TEACHER_MONITOR_ACTIVITY_STORAGE_KEY;
    const url = new URL(window.location.href);
    const fromQuery = url.searchParams.get("activityId")?.trim() ?? "";
    const fromStorage = window.localStorage.getItem(storageKey)?.trim() ?? "";
    const candidate = fromQuery || fromStorage;
    if (!candidate) return;
    const exists = activities.some((activity) => activity.id === candidate);
    if (!exists) {
      window.localStorage.removeItem(storageKey);
      if (fromQuery) {
        url.searchParams.delete("activityId");
        window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
      }
      return;
    }
    deferStateUpdate(() => setSelectedLearningActivityId(candidate));
  }, [activities, isAdminConsole, selectedLearningActivityId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const storageKey = isAdminConsole ? ADMIN_MONITOR_ACTIVITY_STORAGE_KEY : TEACHER_MONITOR_ACTIVITY_STORAGE_KEY;
    const url = new URL(window.location.href);
    if (!selectedLearningActivityId) {
      window.localStorage.removeItem(storageKey);
      if (url.searchParams.get("activityId")) {
        url.searchParams.delete("activityId");
        window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
      }
      return;
    }
    window.localStorage.setItem(storageKey, selectedLearningActivityId);
    url.searchParams.set("activityId", selectedLearningActivityId);
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  }, [isAdminConsole, selectedLearningActivityId]);

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

  const selectedLearningActivity = useMemo(
    () => activities.find((activity) => activity.id === selectedLearningActivityId),
    [activities, selectedLearningActivityId]
  );
  const teacherNameByUsername = useMemo(
    () => new Map(users.filter((user) => user.role === "teacher").map((user) => [user.username, user.name])),
    [users]
  );

  // 各區塊 header 的上下文後綴 (#258)：「學校 / 班級 / 文章題目」
  const contextLabel = useMemo(() => {
    if (!selectedLearningActivity) return "";
    const { school, classNumber, title } = selectedLearningActivity;
    return `${school} / ${classNumber} / ${title}`;
  }, [selectedLearningActivity]);

  const filteredMonitorSessions = useMemo(
    () => getActivityGroupScopedSessions(monitorSessions, selectedLearningActivity),
    [monitorSessions, selectedLearningActivity]
  );

  /**
   * Group selector options for "小組對話紀錄" card (#246).
   * Format: `小組 N: 姓名1 (帳號1), 姓名2 (帳號2), ...`
   * Built from filteredMonitorSessions; member names are looked up from `users` prop
   * with fallback to the username when the user record is missing.
   */
  const groupLogOptions = useMemo(() => {
    const userMap = new Map(users.map((u) => [u.username, u]));
    return filteredMonitorSessions.map((session) => {
      const groupLabel = session.groupName ?? session.groupId ?? "未命名組";
      const members = (session.participants ?? [])
        .map((username) => {
          const u = userMap.get(username);
          const displayName = u?.name?.trim() || username;
          return `${displayName} (${username})`;
        })
        .join(", ");
      const label = members ? `小組 ${groupLabel}: ${members}` : `小組 ${groupLabel}`;
      return { sessionId: session.sessionId, label, session };
    });
  }, [filteredMonitorSessions, users]);

  /**
   * Student selector options for "個人對話紀錄" card (#249).
   * Format: `小組 N: 姓名 (帳號)` for every participant across all sessions of the
   * current activity. Each entry carries `sessionId` so the 查看 click can call
   * loadProgress(sessionId, username) directly.
   */
  const personalLogOptions = useMemo(() => {
    const userMap = new Map(users.map((u) => [u.username, u]));
    const options: Array<{ sessionId: string; username: string; label: string }> = [];
    for (const session of filteredMonitorSessions) {
      const groupLabel = session.groupName ?? session.groupId ?? "未命名組";
      for (const username of session.participants ?? []) {
        const u = userMap.get(username);
        const displayName = u?.name?.trim() || username;
        options.push({
          sessionId: session.sessionId,
          username,
          label: `小組 ${groupLabel}: ${displayName} (${username})`
        });
      }
    }
    return options;
  }, [filteredMonitorSessions, users]);

  /**
   * Returns the current step for a group based on the slowest member's personal step (#244).
   * Falls back to `session.currentStep` only when no personal step data is available.
   * This is needed because `session.currentStep` stops advancing past the last
   * teacher-set step (often Step 5) once Step 5-10 personal pacing kicks in.
   */
  function getGroupCurrentStep(session: MonitorSession): number {
    const participants = session.participants ?? [];
    if (participants.length === 0 || !session.personalSteps) {
      return session.currentStep;
    }
    let minStep: number | null = null;
    for (const p of participants) {
      const step = session.personalSteps[p];
      if (typeof step === "number") {
        minStep = minStep === null ? step : Math.min(minStep, step);
      }
    }
    return minStep ?? session.currentStep;
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
    const userMap = new Map(users.map((u) => [u.username, u]));
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
      // Aggregate this student's messages across all joined sessions (#247).
      let messageCount = 0;
      let lastMessageAt: string | null = null;
      for (const s of joinedSessions) {
        const summary = s.studentMessageStats?.[username];
        if (summary) {
          messageCount += summary.count;
          if (summary.lastMessageAt && (!lastMessageAt || summary.lastMessageAt > lastMessageAt)) {
            lastMessageAt = summary.lastMessageAt;
          }
          continue;
        }
        for (const m of s.messages) {
          if (m.role === "student" && m.userId === username) {
            messageCount += 1;
            if (!lastMessageAt || (m.at && m.at > lastMessageAt)) {
              lastMessageAt = m.at ?? lastMessageAt;
            }
          }
        }
      }
      const userRecord = userMap.get(username);
      const waitingExcluded = Boolean(latestSession && isWaitingExcluded(latestSession, username));
      const makeupPending = Boolean(
        latestSession &&
        (latestSession.makeupWork?.outlineRequiredUsernames ?? []).includes(username) &&
        !(latestSession.makeupWork?.outlineCompletedUsernames ?? []).includes(username)
      );
      const makeupCompleted = Boolean(latestSession && (latestSession.makeupWork?.outlineCompletedUsernames ?? []).includes(username));
      const hasActivityWhileExcluded = waitingExcluded && messageCount > 0;
      return {
        username,
        displayName: userRecord?.name?.trim() || username,
        joined: onlineUserSet.has(username),
        step: latestPersonalStep ?? latestSession?.currentStep ?? null,
        stepLabel:
          latestSession && (latestPersonalStep ?? latestSession.currentStep)
            ? getDetailedStepCode(latestSession, latestPersonalStep ?? latestSession.currentStep)
            : null,
        groupName: latestSession?.groupName ?? null,
        sessionId: latestSession?.sessionId ?? null,
        waitingExcluded,
        makeupPending,
        makeupCompleted,
        hasActivityWhileExcluded,
        messageCount,
        lastMessageAt
      };
    });
  }, [selectedLearningActivity, filteredMonitorSessions, users]);

  const sortedClassJoinRows = useMemo(() => {
    const rows = classJoinRows.slice();
    const dir = classJoinSort.direction === "asc" ? 1 : -1;
    const keyOf = (row: (typeof classJoinRows)[number]): string | number => {
      if (classJoinSort.column === "username") return row.username;
      if (classJoinSort.column === "groupName") return row.groupName ?? "";
      if (classJoinSort.column === "step") return row.stepLabel ?? "";
      return row.messageCount;
    };
    rows.sort((a, b) => {
      const av = keyOf(a);
      const bv = keyOf(b);
      if (typeof av === "number" && typeof bv === "number") {
        return (av - bv) * dir;
      }
      return String(av).localeCompare(String(bv), "zh-Hant") * dir;
    });
    return rows;
  }, [classJoinRows, classJoinSort]);

  function setClassJoinSortBy(column: ClassJoinSortColumn, direction: SortDirection) {
    setClassJoinSort({ column, direction });
  }

  // Per-session analytics cache (#242): each session's hint+risk only depend on its
  // own content; cache keyed by a cheap content signature so unchanged sessions skip
  // recomputation across polls. Bounded by number of active sessions.
  type SessionAnalytics = {
    session: MonitorSession;
    hint: ReturnType<typeof getStepAdvanceHint>;
    risk: ReturnType<typeof getStuckRisk>;
    /** Slowest member's personal step (#244). */
    groupCurrentStep: number;
    /** "S5:1 / S6:2 / ..." text or empty if no personal-step data. */
    step5To10Text: string;
    membersText: string;
  };
  const sessionAnalyticsCacheRef = useRef<Map<string, { signature: string; value: SessionAnalytics }>>(
    new Map()
  );

  const sessionsWithAnalytics = useMemo<SessionAnalytics[]>(() => {
    const cache = sessionAnalyticsCacheRef.current;
    const seen = new Set<string>();
    const result = filteredMonitorSessions.map((session) => {
      const last = session.messages[session.messages.length - 1];
      const personalStepsKey = session.personalSteps
        ? Object.entries(session.personalSteps).sort().map(([k, v]) => `${k}=${v}`).join(",")
        : "";
      const groupGateKey = session.groupGate
        ? Object.entries(session.groupGate)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([key, values]) => `${key}=${[...values].sort().join(",")}`)
          .join(";")
        : "";
      const signature = `${session.currentStep}:${session.messageCount ?? session.messages.length}:${session.lastMessageAt ?? last?.at ?? ""}:${groupGateKey}:${personalStepsKey}`;
      seen.add(session.sessionId);
      const cached = cache.get(session.sessionId);
      if (cached && cached.signature === signature && cached.value.session === session) {
        return cached.value;
      }
      const groupCurrentStep = getGroupCurrentStep(session);
      const step5To10Text =
        groupCurrentStep >= 5 ? getPersonalStepCountText(session) : "";
      const value: SessionAnalytics = {
        session,
        hint: getStepAdvanceHint(session),
        risk: getStuckRisk(session),
        groupCurrentStep,
        step5To10Text,
        membersText: (session.participants ?? []).join(", ")
      };
      cache.set(session.sessionId, { signature, value });
      return value;
    });
    // Drop entries for sessions no longer present.
    if (cache.size > seen.size) {
      for (const key of cache.keys()) {
        if (!seen.has(key)) cache.delete(key);
      }
    }
    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredMonitorSessions]);

  const joinedUsersCount = useMemo(() => {
    const set = new Set<string>();
    for (const session of filteredMonitorSessions) {
      const joined = session.joinedUsers ?? [];
      for (const u of joined) set.add(u);
      // Include any student message author as joined (legacy fallback for sessions
      // that don't populate joinedUsers).
      if (joined.length === 0) {
        for (const m of session.messages) {
          if (m.role === "student" && m.userId) set.add(m.userId);
        }
      }
    }
    return set.size;
  }, [filteredMonitorSessions]);

  const onlineUsersCount = useMemo(() => {
    const set = new Set<string>();
    for (const session of filteredMonitorSessions) {
      for (const u of session.onlineUsers ?? []) set.add(u);
    }
    return set.size;
  }, [filteredMonitorSessions]);

  /**
   * All sessions presented in dashboard row format (#244).
   * Sorted with "ready to advance" first so teachers can immediately act.
   */
  const riskRows = useMemo(() => {
    return sessionsWithAnalytics.slice().sort((a, b) => {
      const rankFor = (row: SessionAnalytics): number => {
        if (row.hint.ready) return 0;
        if (row.risk.level === "stuck") return 1;
        if (row.risk.level === "watch") return 2;
        return 3;
      };
      return rankFor(a) - rankFor(b);
    });
  }, [sessionsWithAnalytics]);

  const teacherDashboard = useMemo<TeacherDashboardData<MonitorSession>>(() => {
    let readyCount = 0;
    let stuckCount = 0;
    let watchCount = 0;
    for (const row of sessionsWithAnalytics) {
      if (row.hint.ready) readyCount += 1;
      if (row.risk.level === "stuck") stuckCount += 1;
      else if (row.risk.level === "watch") watchCount += 1;
    }
    return {
      sessionCount: filteredMonitorSessions.length,
      joinedCount: joinedUsersCount,
      onlineCount: onlineUsersCount,
      readyCount,
      stuckCount,
      watchCount,
      riskRows: riskRows.map((row) => ({
        session: {
          ...row.session,
          currentStepLabel: getDetailedStepCode(row.session, row.groupCurrentStep)
        },
        risk: row.risk,
        hint: row.hint,
        groupCurrentStep: row.groupCurrentStep,
        step5To10Text: row.step5To10Text,
        membersText: row.membersText,
        activityLabel: row.session.activityTitle ?? row.session.activityId
      }))
    };
  }, [filteredMonitorSessions.length, sessionsWithAnalytics, riskRows, joinedUsersCount, onlineUsersCount]);

  function formatStepDurationsText(entries: Array<{ step: number; minutes: number }>): string {
    if (entries.length === 0) return "—";
    return entries
      .sort((a, b) => a.step - b.step)
      .map((entry) => `S${entry.step}:${entry.minutes}分`)
      .join(" / ");
  }

  function computeSessionStepDurations(session: MonitorSession): Array<{ step: number; minutes: number }> {
    const byStep = new Map<number, { start: number; end: number }>();
    for (const message of session.messages) {
      const ts = new Date(message.at).getTime();
      if (!Number.isFinite(ts)) continue;
      const prev = byStep.get(message.step);
      if (!prev) {
        byStep.set(message.step, { start: ts, end: ts });
      } else {
        prev.start = Math.min(prev.start, ts);
        prev.end = Math.max(prev.end, ts);
      }
    }
    const now = Date.now();
    const result: Array<{ step: number; minutes: number }> = [];
    for (const [step, range] of byStep.entries()) {
      const end = step === session.currentStep ? now : range.end;
      const minutes = Math.max(0, Math.floor((end - range.start) / 60000));
      result.push({ step, minutes });
    }
    return result;
  }

  function computeUserStepDurations(session: MonitorSession, username: string): Array<{ step: number; minutes: number }> {
    const personalStep = session.personalSteps?.[username] ?? session.currentStep;
    const byStep = new Map<number, { start: number; end: number }>();
    for (const message of session.messages) {
      if (message.userId !== username) continue;
      const ts = new Date(message.at).getTime();
      if (!Number.isFinite(ts)) continue;
      const prev = byStep.get(message.step);
      if (!prev) {
        byStep.set(message.step, { start: ts, end: ts });
      } else {
        prev.start = Math.min(prev.start, ts);
        prev.end = Math.max(prev.end, ts);
      }
    }
    const now = Date.now();
    const result: Array<{ step: number; minutes: number }> = [];
    for (const [step, range] of byStep.entries()) {
      const end = step === personalStep ? now : range.end;
      const minutes = Math.max(0, Math.floor((end - range.start) / 60000));
      result.push({ step, minutes });
    }
    return result;
  }

  const groupProgressRows = useMemo(() => {
    return filteredMonitorSessions.map((session) => ({
      sessionId: session.sessionId,
      groupName: session.groupName ?? session.groupId ?? "未命名組",
      membersText: (session.participants ?? []).join("、") || "—",
      currentStep: getGroupCurrentStep(session),
      currentStepLabel: getDetailedStepCode(session, getGroupCurrentStep(session)),
      stepDurationsText: formatStepDurationsText(computeSessionStepDurations(session)),
      totalSpeechCount: session.messages.filter((m) => m.role === "student").length
    }));
  }, [filteredMonitorSessions]);

  const personalProgressStatsRows = useMemo(() => {
    const userMap = new Map(users.map((u) => [u.username, u]));
    const rows: Array<{
      sessionId: string;
      username: string;
      displayName: string;
      groupName: string;
      currentStep: number;
      currentStepLabel: string;
      stepDurationsText: string;
      totalSpeechCount: number;
    }> = [];
    for (const session of filteredMonitorSessions) {
      const groupName = session.groupName ?? session.groupId ?? "未命名組";
      for (const username of session.participants ?? []) {
        const user = userMap.get(username);
        const ownMessages = session.messages.filter((m) => m.role === "student" && m.userId === username);
        rows.push({
          sessionId: session.sessionId,
          username,
          displayName: user?.name?.trim() || username,
          groupName,
          currentStep: session.personalSteps?.[username] ?? session.currentStep,
          currentStepLabel: getDetailedStepCode(session, session.personalSteps?.[username] ?? session.currentStep),
          stepDurationsText: formatStepDurationsText(computeUserStepDurations(session, username)),
          totalSpeechCount: ownMessages.length
        });
      }
    }
    return rows.sort((a, b) => a.username.localeCompare(b.username, "zh-Hant"));
  }, [filteredMonitorSessions, users]);

  const personalProgressStatsPageSize = 10;
  const personalProgressStatsTotalPages = Math.max(1, Math.ceil(personalProgressStatsRows.length / personalProgressStatsPageSize));
  const pagedPersonalProgressStatsRows = useMemo(() => {
    const start = (progressStatsPage - 1) * personalProgressStatsPageSize;
    return personalProgressStatsRows.slice(start, start + personalProgressStatsPageSize);
  }, [personalProgressStatsRows, progressStatsPage]);
  const courseDiagnosticsPageSize = 10;
  const courseDiagnosticsRows = useMemo(() => courseDiagnostics?.sessions ?? [], [courseDiagnostics]);
  const courseDiagnosticsTotalPages = Math.max(1, Math.ceil(courseDiagnosticsRows.length / courseDiagnosticsPageSize));
  const pagedCourseDiagnosticsRows = useMemo(() => {
    const start = (courseDiagnosticsPage - 1) * courseDiagnosticsPageSize;
    return courseDiagnosticsRows.slice(start, start + courseDiagnosticsPageSize);
  }, [courseDiagnosticsRows, courseDiagnosticsPage]);
  const goToPreviousCourseDiagnosticsPage = useCallback(() => {
    setCourseDiagnosticsPage((page) => Math.max(1, page - 1));
  }, []);
  const goToNextCourseDiagnosticsPage = useCallback(() => {
    setCourseDiagnosticsPage((page) => Math.min(courseDiagnosticsTotalPages, page + 1));
  }, [courseDiagnosticsTotalPages]);

  useEffect(() => {
    if (!monitorSelected) return;
    const latest = filteredMonitorSessions.find((session) => session.sessionId === monitorSelected.sessionId);
    if (!latest) {
      deferStateUpdate(() => setMonitorSelected(null));
      return;
    }
    deferStateUpdate(() => setMonitorSelected(latest));
  }, [filteredMonitorSessions, monitorSelected]);

  useEffect(() => {
    monitorSessionsRef.current = monitorSessions;
  }, [monitorSessions]);

  useEffect(() => {
    deferStateUpdate(() => {
      setMonitorSelected(null);
      setPersonalMessages([]);
      setSelectedProgressUser("");
      setProgressSessionId("");
      setUserOutline("");
      setUserStep3SubmittedOutline("");
      setCourseDiagnostics(null);
      setCourseDiagnosticsError("");
      setCourseDiagnosticsPage(1);
    });
  }, [selectedLearningActivityId]);

  // Auto-load the first student when the personal log card is first expanded with
  // no current selection (#249).
  useEffect(() => {
    if (!personalLogExpanded) return;
    if (selectedProgressUser) return;
    if (personalLogOptions.length === 0) return;
    const first = personalLogOptions[0]!;
    deferStateUpdate(() => {
      setProgressSessionId(first.sessionId);
      loadProgress(first.sessionId, first.username).catch(() => undefined);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [personalLogExpanded, selectedProgressUser, personalLogOptions]);

  useEffect(() => {
    if (!showCourseStatusView || !selectedLearningActivityId) return;
    refreshMonitor().catch(() => undefined);
    // refreshMonitor is a page action that closes over current filters and setters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showCourseStatusView, selectedLearningActivityId]);

  useEffect(() => {
    if (!showCourseStatusView || !selectedLearningActivityId) return;
    let cancelled = false;
    let timerId: number | null = null;
    // Reset backoff on (re)entering the polling effect.
    monitorPollDelayRef.current = TEACHER_MONITOR_MIN_POLL_MS;
    monitorPayloadHashRef.current = "";

    const tick = async () => {
      if (cancelled) return;
      if (monitorPollingBusyRef.current) {
        // Try again soon without changing backoff.
        timerId = window.setTimeout(tick, TEACHER_MONITOR_FAST_POLL_MS);
        return;
      }
      monitorPollingBusyRef.current = true;
      const beforeHash = monitorPayloadHashRef.current;
      let latestSessions: MonitorSession[] = [];
      try {
        latestSessions = await refreshMonitor();
      } finally {
        monitorPollingBusyRef.current = false;
      }
      if (!cancelled) {
        monitorPollDelayRef.current = resolveTeacherMonitorNextPollDelay({
          currentDelayMs: monitorPollDelayRef.current,
          unchanged: monitorPayloadHashRef.current === beforeHash,
          hasLowLatencyGate: hasLowLatencyStepAdvanceGate(latestSessions)
        });
        timerId = window.setTimeout(tick, monitorPollDelayRef.current);
      }
    };

    // Kick off immediately, then schedule subsequent ticks.
    tick().catch(() => undefined);

    return () => {
      cancelled = true;
      if (timerId !== null) window.clearTimeout(timerId);
    };
    // refreshMonitor is intentionally read from the current render when polling starts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showCourseStatusView, selectedLearningActivityId]);

  useEffect(() => {
    deferStateUpdate(() => setLearningPage(1));
  }, [learningSchoolFilter, learningClassFilter, learningCourseFilter, learningStatusFilter]);

  useEffect(() => {
    deferStateUpdate(() => setProgressStatsPage(1));
  }, [selectedLearningActivityId, filteredMonitorSessions.length]);

  useEffect(() => {
    if (progressStatsPage > personalProgressStatsTotalPages) {
      deferStateUpdate(() => setProgressStatsPage(personalProgressStatsTotalPages));
    }
  }, [progressStatsPage, personalProgressStatsTotalPages]);

  useEffect(() => {
    if (courseDiagnosticsPage > courseDiagnosticsTotalPages) {
      deferStateUpdate(() => setCourseDiagnosticsPage(courseDiagnosticsTotalPages));
    }
  }, [courseDiagnosticsPage, courseDiagnosticsTotalPages]);

  useEffect(() => {
    if (learningPage > totalLearningPages) {
      deferStateUpdate(() => setLearningPage(totalLearningPages));
    }
  }, [learningPage, totalLearningPages]);

  useEffect(() => {
    deferStateUpdate(() => setLearningJumpPage(String(learningPage)));
  }, [learningPage]);

  // Load data on mount (replaces the tab === "learning" guard)
  useEffect(() => {
    runLearningAction("initial", "系統正在載入學習管理資料，請稍候...", async () => {
      await onRefreshData();
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function refreshMonitor(activityIdOverride?: string): Promise<MonitorSession[]> {
    const targetActivityId = activityIdOverride ?? selectedLearningActivityId;
    if (!targetActivityId) {
      setMonitorSessions([]);
      setMonitorSelected(null);
      setLearningWarning("");
      return [];
    }
    const monitorUrl = `/api/teacher/monitor?activityId=${encodeURIComponent(targetActivityId)}`;
    const fetchOpts: RequestInit = { cache: "no-store" };
    let response: Response | null = null;
    try {
      response = await fetch(monitorUrl, fetchOpts);
      if (!response.ok) {
        response = await fetch(monitorUrl, fetchOpts);
      }
    } catch {
      response = null;
    }
    if (!response?.ok) {
      setLearningWarning(formatUserError("monitor_load_failed"));
      return [];
    }
    const data = await response.json();
    const rawSessions: MonitorSession[] = data.sessions ?? [];
    const targetActivity = activities.find((activity) => activity.id === targetActivityId);
    const sessions = targetActivityId
      ? targetActivity
        ? getActivityGroupScopedSessions(rawSessions, targetActivity)
        : getActivityScopedSessions(rawSessions, targetActivityId)
      : rawSessions;
    const mergedSessions = sessions.map((session) => {
      const existing = monitorSessionsRef.current.find((item) => item.sessionId === session.sessionId);
      if (!existing || existing.messages.length === 0 || session.messages.length > 0) return session;
      return {
        ...session,
        messages: existing.messages,
        outlines: existing.outlines,
        step3SubmittedOutlines: existing.step3SubmittedOutlines
      };
    });
    setMonitorSessions(mergedSessions);
    setLearningWarning("");

    // Track payload changes for exponential-backoff polling (#239).
    const nextHash = computeTeacherMonitorPayloadHash(mergedSessions);
    if (nextHash !== monitorPayloadHashRef.current) {
      monitorPayloadHashRef.current = nextHash;
      monitorPollDelayRef.current = hasLowLatencyStepAdvanceGate(mergedSessions)
        ? TEACHER_MONITOR_FAST_POLL_MS
        : TEACHER_MONITOR_MIN_POLL_MS; // reset on activity
    }
    return mergedSessions;
  }

  async function loadCourseDiagnostics(activityIdOverride?: string): Promise<CourseDiagnosticsPayload | null> {
    const targetActivityId = activityIdOverride ?? selectedLearningActivityId;
    if (!targetActivityId) return null;
    setCourseDiagnosticsLoading(true);
    setCourseDiagnosticsError("");
    try {
      const { data } = await fetchJsonWithRetry<CourseDiagnosticsPayload>(
        `/api/teacher/course-diagnostics?activityId=${encodeURIComponent(targetActivityId)}`,
        { cache: "no-store" }
      );
      setCourseDiagnostics(data);
      setCourseDiagnosticsPage(1);
      return data;
    } catch {
      setCourseDiagnosticsError("課程診斷摘要載入失敗，請稍後再試。");
      setCourseDiagnostics(null);
      return null;
    } finally {
      setCourseDiagnosticsLoading(false);
    }
  }

  async function syncSelectedRecordsAfterMonitorRefresh(latestSessions: MonitorSession[]) {
    const selectedSessionId = monitorSelected?.sessionId;
    if (selectedSessionId && latestSessions.some((session) => session.sessionId === selectedSessionId)) {
      await loadMonitorSessionDetail(selectedSessionId);
    }

    if (progressSessionId && selectedProgressUser) {
      const progressSessionExists = latestSessions.some((session) => session.sessionId === progressSessionId);
      if (progressSessionExists) {
        await loadProgress(progressSessionId, selectedProgressUser);
      } else {
        setPersonalMessages([]);
      }
    }
  }

  async function loadMonitorSessionDetail(sessionId: string): Promise<MonitorSession | null> {
    setDetailLoadingSessionId(sessionId);
    try {
      const q = new URLSearchParams({ sessionId, detail: "full" });
      if (selectedLearningActivityId) q.set("activityId", selectedLearningActivityId);
      const response = await fetch(`/api/teacher/monitor?${q.toString()}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) {
        setLearningWarning(formatUserError(data.error ?? "monitor_detail_load_failed"));
        return null;
      }
      const detail = data.session as MonitorSession;
      if (selectedLearningActivityId && !isSessionInActivityScope(detail, selectedLearningActivityId)) {
        setLearningWarning(formatUserError("monitor_detail_load_failed"));
        return null;
      }
      if (selectedLearningActivity && !isSessionInActivityGroupScope(detail, selectedLearningActivity)) {
        setLearningWarning(formatUserError("monitor_detail_load_failed"));
        return null;
      }
      setMonitorSessions((prev) => prev.map((session) => (session.sessionId === detail.sessionId ? detail : session)));
      setMonitorSelected((prev) => (prev?.sessionId === detail.sessionId ? detail : prev));
      setLearningWarning("");
      return detail;
    } finally {
      setDetailLoadingSessionId("");
    }
  }

  async function runLearningAction<T>(actionKey: string, processingText: string, action: () => Promise<T>): Promise<T | undefined> {
    setIsLearningProcessing(true);
    setLearningActionKey(actionKey);
    setLearningProcessingText(processingText);
    try {
      return await action();
    } finally {
      setIsLearningProcessing(false);
      setLearningActionKey("");
      setLearningProcessingText("");
    }
  }

  function getMonitorGateKey(session: MonitorSession): string | null {
    if (session.currentStep === 1) {
      const sub = session.stepState?.step1Substep ?? 1;
      if (sub === 3) return `1-3-${session.stepState?.step1Substep3Question ?? 1}`;
      if (sub === 4) return `1-4-${session.stepState?.step1Substep4Question ?? 1}`;
      return `1-${sub}`;
    }
    if (session.currentStep === 2) {
      const sub = session.stepState?.step2Substep ?? 1;
      if (sub === 1) return `2-1-${session.stepState?.step2Substep1Question ?? 1}`;
      return `2-${sub}`;
    }
    if (session.currentStep === 3) return "3-complete";
    if (session.currentStep === 4) return "4-complete";
    return null;
  }

  function getDetailedStepCode(session: MonitorSession, step: number = session.currentStep): string {
    if (step !== session.currentStep) return String(step);
    if (step === 1) {
      const sub = session.stepState?.step1Substep ?? 1;
      if (sub === 3) return `1-3-${session.stepState?.step1Substep3Question ?? 1}`;
      if (sub === 4) return `1-4-${session.stepState?.step1Substep4Question ?? 1}`;
      return `1-${sub}`;
    }
    if (step === 2) {
      const sub = session.stepState?.step2Substep ?? 1;
      if (sub === 1) return `2-1-${session.stepState?.step2Substep1Question ?? 1}`;
      return `2-${sub}`;
    }
    return String(step);
  }

  function getSessionLastEventAt(session: MonitorSession): Date | null {
    if (session.lastMessageAt) {
      const parsed = new Date(session.lastMessageAt);
      if (Number.isFinite(parsed.getTime())) return parsed;
    }
    const latest = session.messages
      .map((message) => new Date(message.at).getTime())
      .filter((time) => Number.isFinite(time))
      .sort((a, b) => b - a)[0];
    return typeof latest === "number" ? new Date(latest) : null;
  }

  function resolveStepGateMembers(session: MonitorSession, gateKey: "3-complete" | "4-complete"): string[] {
    const joinedMembers = (session.joinedUsers ?? []).filter((user) => session.participants.includes(user));
    if (joinedMembers.length > 0) return excludeWaitingMembers(joinedMembers, session);

    const activeFromStats = session.participants.filter((participant) => {
      const stats = session.studentMessageStats?.[participant];
      return (stats?.count ?? 0) > 0;
    });
    if (activeFromStats.length > 0) return excludeWaitingMembers(activeFromStats, session);

    if (gateKey === "3-complete") {
      const submittedUsers = session.participants.filter((participant) => {
        return hasStep3CompletionEvidence(session, participant);
      });
      if (submittedUsers.length > 0) return excludeWaitingMembers(submittedUsers, session);
    }

    return excludeWaitingMembers(session.participants, session);
  }

  function hasStep3CompletionEvidence(
    session: MonitorSession,
    participant: string,
    completedUsers?: ReadonlySet<string>
  ): boolean {
    if (completedUsers?.has(participant)) return true;
    const reopenedUsers = new Set(session.groupGate?.["3-reopen"] ?? []);
    if (reopenedUsers.has(participant)) return false;
    const submitted = session.step3SubmittedOutlines?.[participant]?.trim() ?? "";
    if (submitted.length > 0) return true;
    const outlineChars = session.artifactDiagnostics?.step3OutlineChars?.[participant] ?? 0;
    if (outlineChars > 0) return true;
    const outlineUpdatedAt = session.artifactDiagnostics?.step3OutlineUpdatedAt?.[participant] ?? "";
    return outlineUpdatedAt.trim().length > 0;
  }

  function getStepAdvanceHint(session: MonitorSession): { ready: boolean; text: string; nextStep?: number } {
    const step = session.currentStep;
    const nextStep = step < 10 ? step + 1 : undefined;
    const stepMessages = session.messages.filter((m) => m.step === step);

    if (step === 1) {
      const ready = Boolean(session.stepReadyHints?.step1Ready) || stepMessages.some(
        (m) => m.role === "system" && m.text.includes("步驟 1 子步驟已完成，等待教師切換下一步")
      );
      return ready
        ? { ready: true, text: "全部組員已完成步驟 1，建議切換到 Step 2。", nextStep }
        : {
            ready: false,
            text: `步驟 1 進行中（目前子步驟 ${getDetailedStepCode(session, 1)}），等待全部組員完成。`
          };
    }

    if (step === 2) {
      const ready = Boolean(session.stepReadyHints?.step2Ready) || stepMessages.some(
        (m) => m.role === "system" && m.text.includes("步驟 2 子步驟已完成，等待教師切換下一步")
      );
      return ready
        ? { ready: true, text: "全部組員已完成步驟 2，建議切換到 Step 3。", nextStep }
        : {
            ready: false,
            text: `步驟 2 進行中（目前子步驟 ${getDetailedStepCode(session, 2)}），等待全部組員完成。`
          };
    }

    if (step === 4) {
      const completedUsers = session.groupGate?.["4-complete"] ?? [];
      const step4GateMembers = resolveStepGateMembers(session, "4-complete");
      const ready =
        step4GateMembers.length > 0 &&
        step4GateMembers.every((participant) => completedUsers.includes(participant));
      return ready
        ? { ready: true, text: "步驟 4 已全員確認完成，建議切換到 Step 5。", nextStep }
        : { ready: false, text: "步驟 4 尚未收齊已加入成員的完成確認。" };
    }

    if (step === 3) {
      const completedUsers = new Set(session.groupGate?.["3-complete"] ?? []);
      // Backward-compatibility: legacy sessions may miss the gate signal even though
      // students already submitted Step3 snapshots before the newer gate logic landed.
      session.participants.forEach((participant) => {
        if (hasStep3CompletionEvidence(session, participant, completedUsers)) completedUsers.add(participant);
      });
      const step3GateMembers = resolveStepGateMembers(session, "3-complete");
      const ready =
        step3GateMembers.length > 0 &&
        step3GateMembers.every((participant) => completedUsers.has(participant));
      return ready
        ? { ready: true, text: `步驟 ${step} 已收齊完成條件，建議切換到 Step ${nextStep}。`, nextStep }
        : {
            ready: false,
            text: "步驟 3 尚未收齊已加入成員的完成結構樹回報。"
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

  function getStuckRisk(session: MonitorSession): {
    level: "ok" | "watch" | "stuck";
    text: string;
    pendingMembers: string[];
    affectedUsers: string[];
    reasons: string[];
    suggestions: string[];
    minutesSinceLastEvent: number | null;
  } {
    const isReady = getStepAdvanceHint(session).ready;
    if (isReady) {
      const latest = getSessionLastEventAt(session);
      const minutesSinceLastEvent = latest ? Math.floor((Date.now() - latest.getTime()) / 60000) : null;
      return {
        level: "ok",
        text: "已達切換條件，可一鍵推進。",
        pendingMembers: [],
        affectedUsers: [],
        reasons: ["已達切換條件，可一鍵推進。"],
        suggestions: ["可使用儀表板的一鍵推進按鈕切換到下一步。"],
        minutesSinceLastEvent
      };
    }
    return buildAdvancedStuckRisk(session);
  }

  async function openCourseStatus(activityId: string) {
    setSelectedLearningActivityId(activityId);
    setShowCourseStatusView(true);
    await runLearningAction(`course:${activityId}:view`, "系統正在載入課程狀態，請稍候...", async () => {
      const [sessions] = await Promise.all([
        refreshMonitor(activityId),
        loadCourseDiagnostics(activityId)
      ]);
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

  async function handleCourseLifecycle(activityId: string, action: "start" | "pause_resume" | "end") {
    setPendingLifecycleAction(null);
    const processingText =
      action === "start" ? "系統正在開始上課，請稍候..." : action === "end" ? "系統正在結束上課，請稍候..." : "系統正在更新課程狀態，請稍候...";
    await runLearningAction(`course:${activityId}:${action}`, processingText, async () => {
      const response = await fetch("/api/teacher/course-control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activityId, action })
      });
      const data = await response.json();
      if (!response.ok) {
        setError(formatUserError(data.error ?? "course_lifecycle_failed"));
        return;
      }
      setError("");
      await onRefreshData();
      if (showCourseStatusView) {
        await refreshMonitor(selectedLearningActivityId);
        await loadCourseDiagnostics(selectedLearningActivityId);
      }
    });
  }

  async function deleteActivityTask(activityId: string) {
    if (!isAdminConsole || loginRole !== "admin") return;
    setPendingDeleteActivity(null);
    await runLearningAction(`course:${activityId}:delete`, "系統正在刪除寫作任務課程資料，請稍候...", async () => {
      const response = await fetch("/api/admin/activities", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activityId })
      });
      const data = await response.json();
      if (!response.ok) {
        setError(formatUserError(data.error ?? "delete_activity_failed"));
        return;
      }
      await onRefreshData();
      if (showCourseStatusView) {
        await refreshMonitor(selectedLearningActivityId);
        await loadCourseDiagnostics(selectedLearningActivityId);
      }
      if (selectedLearningActivityId === activityId) {
        setShowCourseStatusView(false);
        setSelectedLearningActivityId("");
        setMonitorSelected(null);
      }
    });
  }

  async function applyStepSwitch(sessionId: string, step: number) {
    await runLearningAction(`step:${sessionId}:${step}`, `系統正在切換到 Step ${step}，請稍候...`, async () => {
      setError("");
      const response = await fetch("/api/teacher/step", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, step })
      });
      const data = await response.json();
      if (!response.ok) {
        setError(formatUserError(data.error ?? "switch_failed"));
        return;
      }
      if (selectedLearningActivityId && data.activityId && data.activityId !== selectedLearningActivityId) {
        setLearningWarning(formatUserError("monitor_detail_load_failed"));
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
      await onRefreshData();
      await refreshMonitor(selectedLearningActivityId);
    });
  }

  async function toggleWaitingExclusion(sessionId: string, username: string, excluded: boolean) {
    await runLearningAction(
      `attendance:${sessionId}:${username}`,
      excluded ? "正在標記本次不列入等待..." : "正在取消本次不列入等待...",
      async () => {
        setError("");
        const response = await fetch("/api/teacher/session-attendance", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, username, excluded })
        });
        const data = await response.json();
        if (!response.ok) {
          setError(formatUserError(data.error ?? "session_attendance_failed"));
          return;
        }
        await refreshMonitor(selectedLearningActivityId);
      }
    );
  }

  async function loadProgress(sessionTarget?: string, username?: string) {
    const sid = sessionTarget ?? progressSessionId;
    if (!sid) return;
    const targetSession = filteredMonitorSessions.find((session) => session.sessionId === sid);
    if (!targetSession) {
      setLearningWarning(formatUserError("monitor_detail_load_failed"));
      return;
    }
    await runLearningAction(`progress:${sid}:${username ?? ""}`, "系統正在載入個人進度，請稍候...", async () => {
      const q = new URLSearchParams({ sessionId: sid });
      if (selectedLearningActivityId) q.set("activityId", selectedLearningActivityId);
      if (username) {
        q.set("username", username);
      }
      const response = await fetch(`/api/teacher/personal-progress?${q.toString()}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) {
        setError(formatUserError(data.error ?? "progress_failed"));
        return;
      }
      setPersonalMessages(data.personalMessages ?? []);
      if (username) {
        setSelectedProgressUser(username);
        setUserOutline(data.userOutline ?? "");
        setUserStep3SubmittedOutline(data.userStep3SubmittedOutline ?? "");
      } else {
        setUserOutline("");
        setUserStep3SubmittedOutline("");
      }
    });
  }

  // suppress unused var warnings for functions that are defined but referenced only via void
  void getMonitorGateKey;

  const pendingLifecycleActivity = pendingLifecycleAction
    ? activities.find((item) => item.id === pendingLifecycleAction.activityId)
    : undefined;
  const pendingLifecycleIsPausing =
    pendingLifecycleAction?.action === "pause_resume" &&
    (pendingLifecycleActivity?.courseStatus ?? "not_started") === "in_progress";
  const pendingLifecycleTitle =
    pendingLifecycleAction?.action === "start"
      ? "開始上課"
      : pendingLifecycleAction?.action === "end"
        ? "結束上課"
        : pendingLifecycleIsPausing
          ? "暫停上課"
          : "繼續上課";
  const pendingLifecycleBody =
    pendingLifecycleAction?.action === "start"
      ? `確定要開始「${pendingLifecycleAction.title}」嗎？學生將可以進入課程互動。`
      : pendingLifecycleAction?.action === "end"
        ? `確定要結束「${pendingLifecycleAction.title}」嗎？結束後此課程將停止互動。`
        : pendingLifecycleIsPausing
          ? `確定要暫停「${pendingLifecycleAction?.title}」嗎？暫停後學生將無法繼續互動，直到恢復上課。`
          : `確定要繼續「${pendingLifecycleAction?.title}」嗎？學生將可以繼續互動。`;

  return (
    <>
      <div className="card">
        <h2>學習管理</h2>
        {isLearningProcessing && learningActionKey === "initial" ? (
          <div
            role="status"
            aria-live="polite"
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
        <MonitorFilterBar
          schoolFilter={learningSchoolFilter}
          classFilter={learningClassFilter}
          courseFilter={learningCourseFilter}
          statusFilter={learningStatusFilter}
          schoolOptions={learningSchoolOptions}
          classOptions={learningClassOptions}
          courseOptions={learningCourseOptions}
          onSchoolChange={setLearningSchoolFilter}
          onClassChange={setLearningClassFilter}
          onCourseChange={setLearningCourseFilter}
          onStatusChange={setLearningStatusFilter}
        />
        <CourseLifecycleTable
          rows={pagedLearningActivities}
          teacherNameByUsername={teacherNameByUsername}
          isAdminConsole={isAdminConsole}
          learningActionKey={learningActionKey}
          page={learningPage}
          totalPages={totalLearningPages}
          totalCount={filteredLearningActivities.length}
          jumpValue={learningJumpPage}
          onJumpValueChange={setLearningJumpPage}
          onPageChange={setLearningPage}
          onLifecycleAction={(activityId, action, title) => setPendingLifecycleAction({ activityId, action, title })}
          onView={(activityId) => {
            openCourseStatus(activityId).catch(() => undefined);
          }}
          onRefresh={(activityId) => {
            setSelectedLearningActivityId(activityId);
            runLearningAction(`course:${activityId}:refresh`, "系統正在重新整理課程資料，請稍候...", async () => {
              await onRefreshData();
              if (showCourseStatusView) {
                const latestSessions = await refreshMonitor(activityId);
                await loadCourseDiagnostics(activityId);
                await syncSelectedRecordsAfterMonitorRefresh(latestSessions);
              }
            });
          }}
          onDelete={(activityId, title) => setPendingDeleteActivity({ activityId, title })}
        />
        {filteredLearningActivities.length === 0 ? (
          <small>目前此篩選條件下沒有課程資料。</small>
        ) : activities.length === 0 ? (
          <small>目前沒有可顯示的課程資料。請按「重新整理」或確認此帳號是否有可見課程。</small>
        ) : null}
        {learningWarning ? <small role="status" aria-live="polite">{learningWarning}</small> : null}
        {error ? <small role="alert" aria-live="assertive">{error}</small> : null}
      </div>

      {showCourseStatusView ? (
        <>
          {isLearningProcessing && (learningActionKey === "initial" || learningActionKey.endsWith(":view")) ? (
            <div
              className="card"
              role="status"
              aria-live="polite"
              style={{
                borderColor: "#60a5fa",
                background: "#dbeafe"
              }}
            >
              <h2 style={{ marginBottom: 6 }}>系統處理中</h2>
              <p style={{ margin: 0, color: "#1e40af" }}>{learningProcessingText || "正在載入課程狀態資料，請稍候..."}</p>
            </div>
          ) : null}
          <TeacherDashboard
            dashboard={teacherDashboard}
            processingActionKey={learningActionKey}
            inspectingSessionId={detailLoadingSessionId}
            headerSuffix={contextLabel}
            onAdvanceStep={(sessionId, step) => applyStepSwitch(sessionId, step)}
            onInspectDialogue={(session) => {
              setMonitorSelected(session);
              setProgressSessionId(session.sessionId);
              if (session.messages.length === 0) {
                loadMonitorSessionDetail(session.sessionId).catch(() => undefined);
              }
              // Auto-expand section and scroll into view (#246).
              setGroupLogExpanded(true);
              window.setTimeout(() => {
                groupLogRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
              }, 0);
            }}
          />

          <CourseDiagnosticsPanel
            diagnostics={courseDiagnostics}
            loading={courseDiagnosticsLoading}
            error={courseDiagnosticsError}
            contextLabel={contextLabel}
            page={courseDiagnosticsPage}
            totalPages={courseDiagnosticsTotalPages}
            pagedRows={pagedCourseDiagnosticsRows}
            onRefresh={() => loadCourseDiagnostics(selectedLearningActivityId)}
            onPreviousPage={goToPreviousCourseDiagnosticsPage}
            onNextPage={goToNextCourseDiagnosticsPage}
          />

          <ClassJoinStatusTable
            rows={sortedClassJoinRows}
            contextLabel={contextLabel}
            sort={classJoinSort}
            onSortBy={setClassJoinSortBy}
            learningActionKey={learningActionKey}
            selectedProgressUser={selectedProgressUser}
            onViewProgress={(sessionId, username) => {
              setProgressSessionId(sessionId);
              loadProgress(sessionId, username);
              // Auto-expand personal log section and scroll into view (#249).
              setPersonalLogExpanded(true);
              window.setTimeout(() => {
                personalLogRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
              }, 0);
            }}
            onToggleWaitingExclusion={toggleWaitingExclusion}
          />

          <ProgressStatsPanel
            contextLabel={contextLabel}
            groupRows={groupProgressRows}
            pagedPersonalRows={pagedPersonalProgressStatsRows}
            personalRowCount={personalProgressStatsRows.length}
            page={progressStatsPage}
            totalPages={personalProgressStatsTotalPages}
            onPageChange={setProgressStatsPage}
          />

          {filteredMonitorSessions.length > 0 ? (
            <GroupLogPanel
              panelRef={groupLogRef}
              contextLabel={contextLabel}
              expanded={groupLogExpanded}
              onToggleExpanded={() => setGroupLogExpanded((v) => !v)}
              monitorSelected={monitorSelected}
              options={groupLogOptions}
              onSelectSession={(sid) => {
                if (!sid) {
                  setMonitorSelected(null);
                  return;
                }
                const next = groupLogOptions.find((opt) => opt.sessionId === sid);
                if (next) {
                  setMonitorSelected(next.session);
                  setProgressSessionId(next.sessionId);
                  if (next.session.messages.length === 0) {
                    loadMonitorSessionDetail(next.sessionId).catch(() => undefined);
                  }
                }
              }}
              stepExpanded={groupLogStepExpanded}
              onToggleStep={(step) => setGroupLogStepExpanded((prev) => ({ ...prev, [step]: !(prev[step] ?? false) }))}
            />
          ) : null}

          {filteredMonitorSessions.length > 0 ? (
            <PersonalLogPanel
              panelRef={personalLogRef}
              contextLabel={contextLabel}
              expanded={personalLogExpanded}
              onToggleExpanded={() => setPersonalLogExpanded((v) => !v)}
              selectedProgressUser={selectedProgressUser}
              options={personalLogOptions}
              onSelectStudent={(username) => {
                if (!username) {
                  setSelectedProgressUser("");
                  setPersonalMessages([]);
                  setUserOutline("");
                  setUserStep3SubmittedOutline("");
                  return;
                }
                const opt = personalLogOptions.find((o) => o.username === username);
                if (opt) {
                  setProgressSessionId(opt.sessionId);
                  loadProgress(opt.sessionId, opt.username);
                }
              }}
              personalMessages={personalMessages}
              userOutline={userOutline}
              userStep3SubmittedOutline={userStep3SubmittedOutline}
              stepExpanded={personalLogStepExpanded}
              onToggleStep={(step) => setPersonalLogStepExpanded((prev) => ({ ...prev, [step]: !(prev[step] ?? false) }))}
            />
          ) : null}
        </>
      ) : null}
      <ConfirmDialog
        open={Boolean(pendingLifecycleAction)}
        title={pendingLifecycleTitle}
        body={pendingLifecycleBody}
        confirmLabel={pendingLifecycleTitle}
        busy={Boolean(pendingLifecycleAction && learningActionKey === `course:${pendingLifecycleAction.activityId}:${pendingLifecycleAction.action}`)}
        onCancel={() => setPendingLifecycleAction(null)}
        onConfirm={() => {
          if (pendingLifecycleAction) {
            void handleCourseLifecycle(pendingLifecycleAction.activityId, pendingLifecycleAction.action);
          }
        }}
      />
      <ConfirmDialog
        open={Boolean(pendingDeleteActivity)}
        title="刪除課程所有資料"
        body={
          pendingDeleteActivity
            ? `這會刪除「${pendingDeleteActivity.title}」的寫作任務、分組資料與學生參與過程，且無法復原。`
            : ""
        }
        requiredText={pendingDeleteActivity?.title}
        confirmLabel="刪除所有資料"
        busy={Boolean(pendingDeleteActivity && learningActionKey === `course:${pendingDeleteActivity.activityId}:delete`)}
        onCancel={() => setPendingDeleteActivity(null)}
        onConfirm={() => {
          if (pendingDeleteActivity) {
            deleteActivityTask(pendingDeleteActivity.activityId).catch(() => undefined);
          }
        }}
      />
    </>
  );
}
