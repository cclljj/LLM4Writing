"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArtifactDiagnostics, QualitySignals } from "@/src/lib/learning-diagnostics";
import { deferStateUpdate } from "@/src/lib/defer-state-update";
import { isWaitingExcluded } from "@/src/lib/session-attendance";
import TeacherDashboard, { TeacherDashboardData } from "./TeacherDashboard";
import CourseDiagnosticsPanel from "./CourseDiagnosticsPanel";
import { ActivityRow, MonitorSession, UserRow } from "./types";
import ConfirmDialog from "./ConfirmDialog";
import { useMonitorData } from "../_hooks/useMonitorData";
import {
  computeSessionStepDurations,
  computeUserStepDurations,
  formatStepDurationsText,
  getDetailedStepCode,
  getGroupCurrentStep,
  getPersonalStepCountText,
  getStepAdvanceHint,
  getStuckRisk
} from "./monitor-utils";
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


type SessionAnalyticsCacheEntry = { signature: string; value: unknown };
// Per-session analytics cache (#242), module-scoped so render never touches a
// ref; entries are pruned on every recompute and keyed by content signature.
const sessionAnalyticsCache = new Map<string, SessionAnalyticsCacheEntry>();

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
  // Default to collapsed (#245): teachers usually scan the dashboard first; logs are
  // opt-in details. Section-level and per-step cards both default to closed.
  const [groupLogExpanded, setGroupLogExpanded] = useState(false);
  const [personalLogExpanded, setPersonalLogExpanded] = useState(false);
  const [groupLogStepExpanded, setGroupLogStepExpanded] = useState<Record<number, boolean>>({});
  const [personalLogStepExpanded, setPersonalLogStepExpanded] = useState<Record<number, boolean>>({});
  const [learningSchoolFilter, setLearningSchoolFilter] = useState("all");
  const [learningClassFilter, setLearningClassFilter] = useState("all");
  const [learningCourseFilter, setLearningCourseFilter] = useState("all");
  const [learningStatusFilter, setLearningStatusFilter] = useState("all");
  const [learningPage, setLearningPage] = useState(1);
  const [learningJumpPage, setLearningJumpPage] = useState("1");
  const [progressStatsPage, setProgressStatsPage] = useState(1);
  const [classJoinSort, setClassJoinSort] = useState<{ column: ClassJoinSortColumn; direction: SortDirection }>({
    column: "username",
    direction: "asc"
  });
  const {
    monitorSelected,
    setMonitorSelected,
    selectedLearningActivityId,
    setSelectedLearningActivityId,
    showCourseStatusView,
    isLearningProcessing,
    learningProcessingText,
    learningActionKey,
    detailLoadingSessionId,
    learningWarning,
    courseDiagnostics,
    courseDiagnosticsLoading,
    courseDiagnosticsError,
    courseDiagnosticsPage,
    setCourseDiagnosticsPage,
    personalMessages,
    setPersonalMessages,
    userOutline,
    setUserOutline,
    userStep3SubmittedOutline,
    setUserStep3SubmittedOutline,
    setProgressSessionId,
    selectedProgressUser,
    setSelectedProgressUser,
    pendingLifecycleAction,
    setPendingLifecycleAction,
    pendingDeleteActivity,
    setPendingDeleteActivity,
    pendingLifecycleTitle,
    pendingLifecycleBody,
    selectedLearningActivity,
    contextLabel,
    filteredMonitorSessions,
    refreshMonitor,
    loadCourseDiagnostics,
    syncSelectedRecordsAfterMonitorRefresh,
    loadMonitorSessionDetail,
    runLearningAction,
    openCourseStatus,
    handleCourseLifecycle,
    deleteActivityTask,
    applyStepSwitch,
    toggleWaitingExclusion,
    loadProgress
  } = useMonitorData({ loginRole, isAdminConsole, activities, setError, onRefreshData });

  // Anchor for "查看對話" jump-to-section behavior (#246).
  const groupLogRef = useRef<HTMLDivElement | null>(null);
  // Anchor for "查看" (per-student) jump-to-section behavior (#249).
  const personalLogRef = useRef<HTMLDivElement | null>(null);
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

  const teacherNameByUsername = useMemo(
    () => new Map(users.filter((user) => user.role === "teacher").map((user) => [user.username, user.name])),
    [users]
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
  const sessionsWithAnalytics = useMemo<SessionAnalytics[]>(() => {
    const cache = sessionAnalyticsCache;
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
      const cachedValue = cached?.signature === signature ? (cached.value as SessionAnalytics) : null;
      if (cachedValue && cachedValue.session === session) {
        return cachedValue;
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
  }, [setCourseDiagnosticsPage]);
  const goToNextCourseDiagnosticsPage = useCallback(() => {
    setCourseDiagnosticsPage((page) => Math.min(courseDiagnosticsTotalPages, page + 1));
  }, [courseDiagnosticsTotalPages, setCourseDiagnosticsPage]);

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
  }, [courseDiagnosticsPage, courseDiagnosticsTotalPages, setCourseDiagnosticsPage]);

  useEffect(() => {
    if (learningPage > totalLearningPages) {
      deferStateUpdate(() => setLearningPage(totalLearningPages));
    }
  }, [learningPage, totalLearningPages]);

  useEffect(() => {
    deferStateUpdate(() => setLearningJumpPage(String(learningPage)));
  }, [learningPage]);

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
              border: "1px solid var(--info-accent)",
              background: "var(--info-bg-strong)",
              color: "var(--info-text)",
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
                borderColor: "var(--info-accent)",
                background: "var(--info-bg-strong)"
              }}
            >
              <h2 style={{ marginBottom: 6 }}>系統處理中</h2>
              <p style={{ margin: 0, color: "var(--info-text)" }}>{learningProcessingText || "正在載入課程狀態資料，請稍候..."}</p>
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
