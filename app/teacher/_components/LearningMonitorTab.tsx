"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArtifactDiagnostics, buildAdvancedStuckRisk, QualitySignals } from "@/src/lib/learning-diagnostics";
import { formatUserError } from "@/src/lib/error-messages";
import {
  getActivityGroupScopedSessions,
  getActivityScopedSessions,
  isSessionInActivityGroupScope,
  isSessionInActivityScope
} from "@/src/lib/monitor-session-scope";
import OutlineSvg from "@/app/_components/OutlineSvg";
import { renderMessageHtml } from "@/app/student/_components/renderMessageHtml";
import TeacherDashboard, { TeacherDashboardData } from "./TeacherDashboard";
import { ActivityRow, MonitorSession, PersonalProgressRow, UserRow } from "./types";

// Re-export QualitySignals/ArtifactDiagnostics usage via types import
type _QS = QualitySignals;
type _AD = ArtifactDiagnostics;
void (null as unknown as _QS);
void (null as unknown as _AD);

type MonitorMessage = { id: string; role: string; userId?: string; step: number; text: string; at: string };

const stepNameMap: Record<number, string> = {
  1: "審視題目",
  2: "蒐集資料",
  3: "生成論點",
  4: "對比修正",
  5: "摘要報告",
  6: "撰寫初稿",
  7: "分析回饋",
  8: "修改潤飾",
  9: "個人反思",
  10: "總結報告"
};

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
  const [groupViewStep, setGroupViewStep] = useState<string>("all");
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
  const [progressRows, setProgressRows] = useState<PersonalProgressRow[]>([]);
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
      return {
        username,
        displayName: userRecord?.name?.trim() || username,
        joined: onlineUserSet.has(username),
        step: latestPersonalStep ?? latestSession?.currentStep ?? null,
        groupName: latestSession?.groupName ?? null,
        sessionId: latestSession?.sessionId ?? null,
        messageCount,
        lastMessageAt
      };
    });
  }, [selectedLearningActivity, filteredMonitorSessions, users]);

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
      const signature = `${session.currentStep}:${session.messageCount ?? session.messages.length}:${session.lastMessageAt ?? last?.at ?? ""}:${session.groupGate ? Object.keys(session.groupGate).length : 0}:${personalStepsKey}`;
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
        session: row.session,
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

  useEffect(() => {
    if (!monitorSelected) return;
    const latest = filteredMonitorSessions.find((session) => session.sessionId === monitorSelected.sessionId);
    if (!latest) {
      setMonitorSelected(null);
      return;
    }
    setMonitorSelected(latest);
  }, [filteredMonitorSessions, monitorSelected?.sessionId]);

  useEffect(() => {
    monitorSessionsRef.current = monitorSessions;
  }, [monitorSessions]);

  useEffect(() => {
    setMonitorSelected(null);
    setProgressRows([]);
    setPersonalMessages([]);
    setSelectedProgressUser("");
    setProgressSessionId("");
    setUserOutline("");
    setUserStep3SubmittedOutline("");
  }, [selectedLearningActivityId]);

  // Auto-load the first student when the personal log card is first expanded with
  // no current selection (#249).
  useEffect(() => {
    if (!personalLogExpanded) return;
    if (selectedProgressUser) return;
    if (personalLogOptions.length === 0) return;
    const first = personalLogOptions[0]!;
    setProgressSessionId(first.sessionId);
    loadProgress(first.sessionId, first.username).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [personalLogExpanded, selectedProgressUser, personalLogOptions]);

  useEffect(() => {
    if (!showCourseStatusView || !selectedLearningActivityId) return;
    refreshMonitor().catch(() => undefined);
  }, [showCourseStatusView, selectedLearningActivityId]);

  useEffect(() => {
    if (!showCourseStatusView || !selectedLearningActivityId) return;
    let cancelled = false;
    let timerId: number | null = null;
    // Reset backoff on (re)entering the polling effect.
    monitorPollDelayRef.current = 3000;
    monitorPayloadHashRef.current = "";

    const MIN_DELAY = 3000;
    const MAX_DELAY = 30000;

    const tick = async () => {
      if (cancelled) return;
      if (monitorPollingBusyRef.current) {
        // Try again soon without changing backoff.
        timerId = window.setTimeout(tick, MIN_DELAY);
        return;
      }
      monitorPollingBusyRef.current = true;
      const beforeHash = monitorPayloadHashRef.current;
      try {
        await refreshMonitor();
      } finally {
        monitorPollingBusyRef.current = false;
      }
      // If refreshMonitor saw no change it leaves the hash untouched; double the delay.
      // If it saw change it already reset the delay to MIN_DELAY.
      if (!cancelled) {
        if (monitorPayloadHashRef.current === beforeHash) {
          monitorPollDelayRef.current = Math.min(MAX_DELAY, monitorPollDelayRef.current * 2);
        }
        timerId = window.setTimeout(tick, monitorPollDelayRef.current);
      }
    };

    // Kick off immediately, then schedule subsequent ticks.
    tick().catch(() => undefined);

    return () => {
      cancelled = true;
      if (timerId !== null) window.clearTimeout(timerId);
    };
  }, [showCourseStatusView, selectedLearningActivityId]);

  useEffect(() => {
    setLearningPage(1);
  }, [learningSchoolFilter, learningClassFilter, learningCourseFilter, learningStatusFilter]);

  useEffect(() => {
    setProgressStatsPage(1);
  }, [selectedLearningActivityId, filteredMonitorSessions.length]);

  useEffect(() => {
    if (progressStatsPage > personalProgressStatsTotalPages) {
      setProgressStatsPage(personalProgressStatsTotalPages);
    }
  }, [progressStatsPage, personalProgressStatsTotalPages]);

  useEffect(() => {
    if (learningPage > totalLearningPages) {
      setLearningPage(totalLearningPages);
    }
  }, [learningPage, totalLearningPages]);

  useEffect(() => {
    setLearningJumpPage(String(learningPage));
  }, [learningPage]);

  // Load data on mount (replaces the tab === "learning" guard)
  useEffect(() => {
    runLearningAction("initial", "系統正在載入學習管理資料，請稍候...", async () => {
      await onRefreshData();
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function computeMonitorPayloadHash(sessions: MonitorSession[]): string {
    // Cheap signature: per-session id + currentStep + last message timestamp + message count.
    return sessions
      .map((s) => {
        const last = s.messages[s.messages.length - 1];
        return `${s.sessionId}:${s.currentStep}:${s.messageCount ?? s.messages.length}:${s.lastMessageAt ?? last?.at ?? ""}`;
      })
      .join("|");
  }

  async function refreshMonitor(activityIdOverride?: string): Promise<MonitorSession[]> {
    const targetActivityId = activityIdOverride ?? selectedLearningActivityId;
    const monitorUrl = targetActivityId
      ? `/api/teacher/monitor?activityId=${encodeURIComponent(targetActivityId)}`
      : "/api/teacher/monitor";
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
    const nextHash = computeMonitorPayloadHash(mergedSessions);
    if (nextHash !== monitorPayloadHashRef.current) {
      monitorPayloadHashRef.current = nextHash;
      monitorPollDelayRef.current = 3000; // reset on activity
    }
    return mergedSessions;
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

  function getCourseStatusLabel(status?: "not_started" | "in_progress" | "paused" | "ended") {
    if (status === "in_progress") return "進行中";
    if (status === "paused") return "暫停中";
    if (status === "ended") return "已結束";
    return "尚未開始";
  }

  function formatSessionLabel(session: MonitorSession): string {
    const school = session.school?.trim() || selectedLearningActivity?.school || "unknown-school";
    const classNumber = session.classNumber?.trim() || selectedLearningActivity?.classNumber || "unknown-class";
    const groupNumber = (session.groupName || session.groupId || "unknown-group").toString();
    return `${school} + ${classNumber} + ${groupNumber}`;
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
    if (joinedMembers.length > 0) return joinedMembers;

    const activeFromStats = session.participants.filter((participant) => {
      const stats = session.studentMessageStats?.[participant];
      return (stats?.count ?? 0) > 0;
    });
    if (activeFromStats.length > 0) return activeFromStats;

    if (gateKey === "3-complete") {
      const submittedUsers = session.participants.filter((participant) => {
        return hasStep3CompletionEvidence(session, participant);
      });
      if (submittedUsers.length > 0) return submittedUsers;
    }

    return session.participants;
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
            text: `步驟 1 進行中（目前子步驟 1-${session.stepState?.step1Substep ?? 1}），等待全部組員完成。`
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
            text: `步驟 2 進行中（目前子步驟 2-${session.stepState?.step2Substep ?? 1}），等待全部組員完成。`
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
      const sessions = await refreshMonitor(activityId);
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
    if (action === "pause_resume") {
      const activity = activities.find((item) => item.id === activityId);
      const isPausing = (activity?.courseStatus ?? "not_started") === "in_progress";
      const confirmed = window.confirm(
        isPausing
          ? "確定要暫停上課嗎？暫停後學生將無法繼續互動，直到恢復上課。"
          : "確定要繼續上課嗎？"
      );
      if (!confirmed) return;
    }
    if (action === "end") {
      const confirmed = window.confirm("確定要結束上課嗎？結束後此課程將停止互動。");
      if (!confirmed) return;
    }
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
      if (showCourseStatusView) await refreshMonitor(selectedLearningActivityId);
    });
  }

  async function deleteActivityTask(activityId: string, title: string) {
    if (!isAdminConsole || loginRole !== "admin") return;
    const confirmed = window.confirm(`是否要刪除「${title}」的所有資料？\n\n此操作會刪除寫作任務、分組資料與學生參與過程，且無法復原。`);
    if (!confirmed) return;
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
      if (showCourseStatusView) await refreshMonitor(selectedLearningActivityId);
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
      setGroupViewStep("all");
      await onRefreshData();
      await refreshMonitor(selectedLearningActivityId);
    });
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
      const response = await fetch(`/api/teacher/personal-progress?${q.toString()}`);
      const data = await response.json();
      if (!response.ok) {
        setError(formatUserError(data.error ?? "progress_failed"));
        return;
      }
      setProgressRows(data.progress ?? []);
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

  function getStepsFromMessages(messages: Array<{ step: number }>): number[] {
    return Array.from(new Set(messages.map((m) => m.step))).sort((a, b) => a - b);
  }

  function getPersonalScopedMessagesForStudentHistory(
    messages: MonitorMessage[],
    username: string
  ): MonitorMessage[] {
    return messages.filter((m) => {
      if (m.role === "student") return m.userId === username;
      if (m.role === "ai") return !m.userId || m.userId === username;
      if (m.role === "system") return !m.userId || m.userId === username;
      return false;
    });
  }

  // suppress unused var warnings for functions that are defined but referenced only via void
  void getMonitorGateKey;

  return (
    <>
      <div className="card">
        <h2>學習管理</h2>
        {isLearningProcessing && learningActionKey === "initial" ? (
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
                const startKey = `course:${activity.id}:start`;
                const pauseResumeKey = `course:${activity.id}:pause_resume`;
                const endKey = `course:${activity.id}:end`;
                const viewKey = `course:${activity.id}:view`;
                const refreshKey = `course:${activity.id}:refresh`;
                const deleteKey = `course:${activity.id}:delete`;
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
                          disabled={startDisabled || learningActionKey === startKey}
                          onClick={() => handleCourseLifecycle(activity.id, "start")}
                        >
                          {learningActionKey === startKey ? "開始中..." : "開始上課"}
                        </button>
                        <button
                          type="button"
                          className={pauseResumeDisabled ? "secondary" : ""}
                          style={pauseResumeDisabled ? disabledButtonStyle : enabledButtonStyle}
                          disabled={pauseResumeDisabled || learningActionKey === pauseResumeKey}
                          onClick={() => handleCourseLifecycle(activity.id, "pause_resume")}
                        >
                          {learningActionKey === pauseResumeKey ? "更新中..." : status === "in_progress" ? "暫停上課" : "繼續上課"}
                        </button>
                        <button
                          type="button"
                          className={endDisabled ? "secondary" : ""}
                          style={endDisabled ? disabledButtonStyle : enabledButtonStyle}
                          disabled={endDisabled || learningActionKey === endKey}
                          onClick={() => handleCourseLifecycle(activity.id, "end")}
                        >
                          {learningActionKey === endKey ? "結束中..." : "結束上課"}
                        </button>
                        <button
                          type="button"
                          className="secondary"
                          style={viewDisabled ? disabledButtonStyle : enabledButtonStyle}
                          disabled={viewDisabled || learningActionKey === viewKey}
                          onClick={() => {
                            openCourseStatus(activity.id).catch(() => undefined);
                          }}
                        >
                          {learningActionKey === viewKey ? "載入中..." : "查看狀態"}
                        </button>
                        <button
                          type="button"
                          className="secondary"
                          style={{ width: "auto" }}
                          disabled={learningActionKey === refreshKey}
                          onClick={() => {
                            setSelectedLearningActivityId(activity.id);
                            runLearningAction(`course:${activity.id}:refresh`, "系統正在重新整理課程資料，請稍候...", async () => {
                              await onRefreshData();
                              if (showCourseStatusView) await refreshMonitor(activity.id);
                            });
                          }}
                        >
                          {learningActionKey === refreshKey ? "整理中..." : "重新整理"}
                        </button>
                        {isAdminConsole ? (
                          <button
                            type="button"
                            className="secondary"
                            style={{ width: "auto", background: "#ffe4e6", color: "#9f1239", borderColor: "#fecdd3" }}
                            disabled={learningActionKey === deleteKey}
                            onClick={() => {
                              deleteActivityTask(activity.id, activity.title).catch(() => undefined);
                            }}
                          >
                            {learningActionKey === deleteKey ? "刪除中..." : "刪除"}
                          </button>
                        ) : null}
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
          {isLearningProcessing && (learningActionKey === "initial" || learningActionKey.endsWith(":view")) ? (
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
          <TeacherDashboard
            dashboard={teacherDashboard}
            processingActionKey={learningActionKey}
            inspectingSessionId={detailLoadingSessionId}
            headerSuffix={contextLabel}
            onAdvanceStep={(sessionId, step) => applyStepSwitch(sessionId, step)}
            onInspectDialogue={(session) => {
              setMonitorSelected(session);
              setGroupViewStep("all");
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

          <div className="card">
            <h2>
              全班加入狀態
              {contextLabel ? <span style={{ fontSize: 14, color: "#64748b", fontWeight: 400, marginLeft: 8 }}>— {contextLabel}</span> : null}
            </h2>
            <div style={{ overflowX: "auto" }}>
              <table className="pro-table">
                <thead>
                  <tr>
                    <th>序號</th>
                    <th>姓名 (帳號)</th>
                    <th>加入狀態</th>
                    <th>所在組別</th>
                    <th>目前進度</th>
                    <th>發言數</th>
                    <th>最後發言時間</th>
                    <th>動作</th>
                  </tr>
                </thead>
                <tbody>
                  {classJoinRows.map((row, idx) => {
                    const progressKey = row.sessionId ? `progress:${row.sessionId}:${row.username}` : "";
                    const isProgressLoading = learningActionKey === progressKey;
                    return (
                    <tr key={row.username}>
                      <td>{idx + 1}</td>
                      <td>{row.displayName} ({row.username})</td>
                      <td>{row.joined ? "已加入" : "未加入"}</td>
                      <td>{row.groupName ?? "—"}</td>
                      <td>{row.step ? `Step ${row.step}` : "—"}</td>
                      <td>{row.messageCount}</td>
                      <td>{row.lastMessageAt ? new Date(row.lastMessageAt).toLocaleString("zh-TW") : "—"}</td>
                      <td>
                        <button
                          type="button"
                          className="secondary"
                          style={{ width: "auto" }}
                          disabled={isProgressLoading || !row.sessionId}
                          onClick={() => {
                            if (!row.sessionId) return;
                            setProgressSessionId(row.sessionId);
                            loadProgress(row.sessionId, row.username);
                            // Auto-expand personal log section and scroll into view (#249).
                            setPersonalLogExpanded(true);
                            window.setTimeout(() => {
                              personalLogRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                            }, 0);
                          }}
                        >
                          {isProgressLoading ? "載入中..." : "查看"}
                        </button>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {classJoinRows.length === 0 ? <small>此課程目前沒有可見學生名單。</small> : null}
            {selectedProgressUser ? <small style={{ display: "block", marginTop: 8 }}>目前檢視個人對話：{selectedProgressUser}</small> : null}
          </div>

          <div className="card">
            <h2>
              課堂進度統計
              {contextLabel ? <span style={{ fontSize: 14, color: "#64748b", fontWeight: 400, marginLeft: 8 }}>— {contextLabel}</span> : null}
            </h2>

            <h3 style={{ marginTop: 8 }}>小組進度統計</h3>
            <div style={{ overflowX: "auto" }}>
              <table className="pro-table">
                <thead>
                  <tr>
                    <th>小組組別</th>
                    <th>成員</th>
                    <th>目前進度</th>
                    <th>各步驟停留時間</th>
                    <th>總發言數</th>
                  </tr>
                </thead>
                <tbody>
                  {groupProgressRows.map((row) => (
                    <tr key={`group-progress-${row.sessionId}`}>
                      <td>{row.groupName}</td>
                      <td>{row.membersText}</td>
                      <td>Step {row.currentStep}</td>
                      <td>{row.stepDurationsText}</td>
                      <td>{row.totalSpeechCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {groupProgressRows.length === 0 ? <small>目前沒有可統計的小組資料。</small> : null}

            <h3 style={{ marginTop: 14 }}>個人進度統計</h3>
            <div style={{ overflowX: "auto" }}>
              <table className="pro-table">
                <thead>
                  <tr>
                    <th>帳號姓名</th>
                    <th>所屬組別</th>
                    <th>目前進度</th>
                    <th>各步驟停留時間</th>
                    <th>總發言數</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedPersonalProgressStatsRows.map((row) => (
                    <tr key={`personal-progress-${row.sessionId}-${row.username}`}>
                      <td>{row.displayName} ({row.username})</td>
                      <td>{row.groupName}</td>
                      <td>Step {row.currentStep}</td>
                      <td>{row.stepDurationsText}</td>
                      <td>{row.totalSpeechCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {personalProgressStatsRows.length === 0 ? (
              <small>目前沒有可統計的個人資料。</small>
            ) : (
              <div className="row" style={{ gap: 8, marginTop: 8 }}>
                <small style={{ alignSelf: "center" }}>
                  第 {progressStatsPage} / {personalProgressStatsTotalPages} 頁，共 {personalProgressStatsRows.length} 位學生（每頁 10 位）
                </small>
                <button
                  type="button"
                  className="secondary"
                  style={{ width: "auto" }}
                  disabled={progressStatsPage <= 1}
                  onClick={() => setProgressStatsPage((p) => Math.max(1, p - 1))}
                >
                  上一頁
                </button>
                <button
                  type="button"
                  className="secondary"
                  style={{ width: "auto" }}
                  disabled={progressStatsPage >= personalProgressStatsTotalPages}
                  onClick={() => setProgressStatsPage((p) => Math.min(personalProgressStatsTotalPages, p + 1))}
                >
                  下一頁
                </button>
              </div>
            )}
          </div>

          {filteredMonitorSessions.length > 0 ? (
            <div className="card" ref={groupLogRef}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: groupLogExpanded ? 12 : 0 }}>
                <h2 style={{ margin: 0 }}>
                  小組對話紀錄
                  {contextLabel ? <span style={{ fontSize: 14, color: "#64748b", fontWeight: 400, marginLeft: 8 }}>— {contextLabel}</span> : null}
                </h2>
                <button
                  style={{ width: "3em", padding: "4px 0", fontSize: 13, color: "#1e293b", cursor: "pointer", borderRadius: 6, border: "1px solid #cbd5e1", background: "#f8fafc", textAlign: "center" }}
                  onClick={() => setGroupLogExpanded((v) => !v)}
                >
                  {groupLogExpanded ? "關閉" : "展開"}
                </button>
              </div>
              {groupLogExpanded ? (
                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>選擇小組</label>
                  <select
                    value={monitorSelected?.sessionId ?? ""}
                    onChange={(e) => {
                      const sid = e.target.value;
                      if (!sid) {
                        setMonitorSelected(null);
                        return;
                      }
                      const next = groupLogOptions.find((opt) => opt.sessionId === sid);
                      if (next) {
                        setMonitorSelected(next.session);
                        setGroupViewStep("all");
                        setProgressSessionId(next.sessionId);
                        if (next.session.messages.length === 0) {
                          loadMonitorSessionDetail(next.sessionId).catch(() => undefined);
                        }
                      }
                    }}
                  >
                    <option value="">請選擇小組...</option>
                    {groupLogOptions.map((opt) => (
                      <option key={opt.sessionId} value={opt.sessionId}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
              {groupLogExpanded && monitorSelected ? (() => {
                const allGroupMsgs = monitorSelected.messages;
                const groupSteps = getStepsFromMessages(allGroupMsgs);

                const hasStep3 = monitorSelected.participants.some((p) => monitorSelected.step3SubmittedOutlines?.[p]);
                const hasStep4Revised = monitorSelected.participants.some((p) => {
                  const s = monitorSelected.step3SubmittedOutlines?.[p];
                  const c = monitorSelected.outlines?.[p];
                  return c && c !== s;
                });

                const step3Block = hasStep3 ? (
                  <div style={{ borderTop: "2px solid #cbd5e1", padding: "12px 0", marginTop: 4 }}>
                    <strong style={{ fontSize: 13, color: "#334155" }}>步驟三 各組員完成結構樹</strong>
                    {monitorSelected.participants.map((p) => {
                      const submitted = monitorSelected.step3SubmittedOutlines?.[p];
                      if (!submitted) return null;
                      return (
                        <div key={p} style={{ marginTop: 8 }}>
                          <small style={{ fontWeight: 600 }}>{p}</small>
                          <OutlineSvg mermaidText={submitted} label="步驟三完成結構樹" />
                        </div>
                      );
                    })}
                  </div>
                ) : null;

                const step4Block = hasStep4Revised ? (
                  <div style={{ borderTop: "2px solid #cbd5e1", padding: "12px 0", marginTop: 4 }}>
                    <strong style={{ fontSize: 13, color: "#334155" }}>步驟四 各組員修正後結構樹</strong>
                    {monitorSelected.participants.map((p) => {
                      const s = monitorSelected.step3SubmittedOutlines?.[p];
                      const c = monitorSelected.outlines?.[p];
                      if (!c || c === s) return null;
                      return (
                        <div key={p} style={{ marginTop: 8 }}>
                          <small style={{ fontWeight: 600 }}>{p}</small>
                          <OutlineSvg mermaidText={c} label="步驟四對比修正後" />
                        </div>
                      );
                    })}
                  </div>
                ) : null;

                const anyMsgs = allGroupMsgs.length > 0;
                return (
                  <>
                    {groupSteps.map((step) => {
                      const stepMsgs = allGroupMsgs.filter((m) => m.step === step);
                      if (stepMsgs.length === 0) return null;
                      // Per-step cards default to closed (#245).
                      const isExpanded = groupLogStepExpanded[step] ?? false;
                      return (
                        <div key={step} className="card">
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                            <h3 style={{ margin: 0 }}>
                              Step {step} {stepNameMap[step] ? `- ${stepNameMap[step]}` : ""}
                            </h3>
                            <button
                              type="button"
                              className="secondary"
                              aria-expanded={isExpanded}
                              onClick={() => setGroupLogStepExpanded((prev) => ({ ...prev, [step]: !isExpanded }))}
                              style={{ width: "fit-content", padding: "3px 6px", whiteSpace: "nowrap" }}
                            >
                              {isExpanded ? "▾ 閉合" : "▸ 展開"}
                            </button>
                          </div>
                          {isExpanded ? (
                            <>
                              <hr style={{ border: 0, borderTop: "1px solid #e5e7eb", margin: "10px 0" }} />
                              {stepMsgs.map((message) => (
                                <div key={message.id} style={{ borderTop: "1px solid #e5e7eb", padding: "8px 0" }}>
                                  <strong>
                                    {message.role === "student"
                                      ? `學生${message.userId ? `（${message.userId}）` : ""}`
                                      : message.role === "ai"
                                        ? "AI 回覆"
                                        : message.role === "system"
                                          ? "系統訊息"
                                          : message.role}
                                  </strong>
                                  <div dangerouslySetInnerHTML={{ __html: renderMessageHtml(message.text) }} />
                                  <small>{message.at}</small>
                                </div>
                              ))}
                              {step === 2 && step3Block}
                              {step === 4 && step4Block}
                            </>
                          ) : null}
                        </div>
                      );
                    })}
                    {!anyMsgs && <small>目前沒有可顯示的對話內容。</small>}
                  </>
                );
              })() : groupLogExpanded ? (
                <small style={{ color: "#64748b" }}>請從上方下拉選單選擇要查看的小組。</small>
              ) : null}
            </div>
          ) : null}

          {filteredMonitorSessions.length > 0 ? (
            <div className="card" ref={personalLogRef}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: personalLogExpanded ? 12 : 0 }}>
                <h2 style={{ margin: 0 }}>
                  個人對話紀錄
                  {contextLabel ? <span style={{ fontSize: 14, color: "#64748b", fontWeight: 400, marginLeft: 8 }}>— {contextLabel}</span> : null}
                </h2>
                <button
                  style={{ width: "3em", padding: "4px 0", fontSize: 13, color: "#1e293b", cursor: "pointer", borderRadius: 6, border: "1px solid #cbd5e1", background: "#f8fafc", textAlign: "center" }}
                  onClick={() => setPersonalLogExpanded((v) => !v)}
                >
                  {personalLogExpanded ? "關閉" : "展開"}
                </button>
              </div>
              {personalLogExpanded ? (
                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>選擇學生</label>
                  <select
                    value={selectedProgressUser}
                    onChange={(e) => {
                      const username = e.target.value;
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
                  >
                    <option value="">請選擇學生...</option>
                    {personalLogOptions.map((opt) => (
                      <option key={opt.username} value={opt.username}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
              {personalLogExpanded && personalMessages.length > 0 ? (() => {
                const scopedPersonalMessages = selectedProgressUser
                  ? getPersonalScopedMessagesForStudentHistory(personalMessages, selectedProgressUser)
                  : personalMessages;
                const personalSteps = getStepsFromMessages(scopedPersonalMessages);
                const hasStep4Revised = Boolean(userOutline && userOutline !== userStep3SubmittedOutline);

                const step3Block = userStep3SubmittedOutline ? (
                  <div style={{ borderTop: "2px solid #cbd5e1", padding: "12px 0", marginTop: 4 }}>
                    <strong style={{ fontSize: 13, color: "#334155" }}>步驟三完成結構樹</strong>
                    <OutlineSvg mermaidText={userStep3SubmittedOutline} label="步驟三完成結構樹" />
                  </div>
                ) : null;

                const step4Block = hasStep4Revised ? (
                  <div style={{ borderTop: "2px solid #cbd5e1", padding: "12px 0", marginTop: 4 }}>
                    <strong style={{ fontSize: 13, color: "#334155" }}>步驟四對比修正後結構樹</strong>
                    <OutlineSvg mermaidText={userOutline} label="步驟四對比修正後" />
                  </div>
                ) : null;

                return (
                  <>
                    {personalSteps.map((step) => {
                      const stepMsgs = scopedPersonalMessages.filter((m) => m.step === step);
                      // Per-step cards default to closed (#245).
                      const isExpanded = personalLogStepExpanded[step] ?? false;
                      return (
                        <div key={step} className="card">
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                            <h3 style={{ margin: 0 }}>
                              Step {step} {stepNameMap[step] ? `- ${stepNameMap[step]}` : ""}
                            </h3>
                            <button
                              type="button"
                              className="secondary"
                              aria-expanded={isExpanded}
                              onClick={() => setPersonalLogStepExpanded((prev) => ({ ...prev, [step]: !isExpanded }))}
                              style={{ width: "fit-content", padding: "3px 6px", whiteSpace: "nowrap" }}
                            >
                              {isExpanded ? "▾ 閉合" : "▸ 展開"}
                            </button>
                          </div>
                          {isExpanded ? (
                            <>
                              <hr style={{ border: 0, borderTop: "1px solid #e5e7eb", margin: "10px 0" }} />
                              {stepMsgs.map((message) => (
                                <div key={message.id} style={{ borderTop: "1px solid #e5e7eb", padding: "8px 0" }}>
                                  <strong>
                                    {message.role === "student"
                                      ? "你"
                                      : message.role === "ai"
                                        ? "AI 回覆"
                                        : message.role === "system"
                                          ? "系統訊息"
                                          : message.role}
                                  </strong>
                                  <div dangerouslySetInnerHTML={{ __html: renderMessageHtml(message.text) }} />
                                  <small>{message.at}</small>
                                </div>
                              ))}
                              {step === 3 && step3Block}
                              {step === 4 && step4Block}
                            </>
                          ) : null}
                        </div>
                      );
                    })}
                  </>
                );
              })() : personalLogExpanded && selectedProgressUser ? (
                <small style={{ color: "#64748b" }}>正在載入該學生的對話紀錄…</small>
              ) : personalLogExpanded ? (
                <small style={{ color: "#64748b" }}>請從上方下拉選單選擇要查看的學生。</small>
              ) : null}
            </div>
          ) : null}
        </>
      ) : null}
    </>
  );
}
