"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { deferStateUpdate } from "@/src/lib/defer-state-update";
import { formatUserError } from "@/src/lib/error-messages";
import { fetchJsonWithRetry } from "@/src/lib/client-retry-fetch";
import {
  getActivityGroupScopedSessions,
  getActivityScopedSessions,
  isSessionInActivityGroupScope,
  isSessionInActivityScope
} from "@/src/lib/monitor-session-scope";
import {
  computeTeacherMonitorPayloadHash,
  hasLowLatencyStepAdvanceGate,
  resolveTeacherMonitorNextPollDelay,
  TEACHER_MONITOR_FAST_POLL_MS,
  TEACHER_MONITOR_MIN_POLL_MS
} from "@/src/lib/teacher-monitor-polling";
import { ActivityRow, CourseDiagnosticsPayload, MonitorSession } from "../_components/types";

const TEACHER_MONITOR_ACTIVITY_STORAGE_KEY = "teacher:monitor:selectedActivityId";
const ADMIN_MONITOR_ACTIVITY_STORAGE_KEY = "admin:monitor:selectedActivityId";

// Monitor data layer extracted from LearningMonitorTab (#460): session list
// with adaptive polling (#239), course diagnostics, personal progress and
// course lifecycle actions. Rendering and filter/pagination state stay in
// the component.
export function useMonitorData(input: {
  loginRole: "teacher" | "admin";
  isAdminConsole: boolean;
  activities: ActivityRow[];
  setError: (message: string) => void;
  onRefreshData: () => Promise<void>;
}) {
  const { loginRole, isAdminConsole, activities, setError, onRefreshData } = input;

  const [monitorSessions, setMonitorSessions] = useState<MonitorSession[]>([]);
  const [monitorSelected, setMonitorSelected] = useState<MonitorSession | null>(null);
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
  const [pendingLifecycleAction, setPendingLifecycleAction] = useState<{ activityId: string; action: "start" | "pause_resume" | "end"; title: string } | null>(null);
  const [pendingDeleteActivity, setPendingDeleteActivity] = useState<{ activityId: string; title: string } | null>(null);
  const monitorPollingBusyRef = useRef(false);
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



  return {
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
    progressSessionId,
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
  };
}
