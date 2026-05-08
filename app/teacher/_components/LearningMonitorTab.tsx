"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArtifactDiagnostics, buildAdvancedStuckRisk, QualitySignals } from "@/src/lib/learning-diagnostics";
import { extractMermaidText } from "@/src/lib/outline-utils";
import OutlineSvg from "@/app/_components/OutlineSvg";
import { renderMessageHtml } from "@/app/student/_components/renderMessageHtml";
import TeacherDashboard, { TeacherDashboardData } from "./TeacherDashboard";
import { ActivityRow, MonitorSession, PersonalProgressRow, UserRow, groupInteractionSteps } from "./types";

// Re-export QualitySignals/ArtifactDiagnostics usage via types import
type _QS = QualitySignals;
type _AD = ArtifactDiagnostics;
void (null as unknown as _QS);
void (null as unknown as _AD);

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
  error,
  setError,
  onRefreshData,
}: LearningMonitorTabProps) {
  const [monitorSessions, setMonitorSessions] = useState<MonitorSession[]>([]);
  const [monitorSelected, setMonitorSelected] = useState<MonitorSession | null>(null);
  const [groupViewStep, setGroupViewStep] = useState<string>("all");
  const [groupLogExpanded, setGroupLogExpanded] = useState(true);
  const [personalLogExpanded, setPersonalLogExpanded] = useState(true);
  const [groupLogStepExpanded, setGroupLogStepExpanded] = useState<Record<number, boolean>>({});
  const [personalLogStepExpanded, setPersonalLogStepExpanded] = useState<Record<number, boolean>>({});
  const [selectedLearningActivityId, setSelectedLearningActivityId] = useState("");
  const [showCourseStatusView, setShowCourseStatusView] = useState(false);
  const [isLearningProcessing, setIsLearningProcessing] = useState(false);
  const [learningProcessingText, setLearningProcessingText] = useState("");
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
  const monitorPollingBusyRef = useRef(false);

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

  const filteredMonitorSessions = useMemo(
    () =>
      selectedLearningActivityId
        ? monitorSessions.filter((session) => session.activityId === selectedLearningActivityId)
        : [],
    [monitorSessions, selectedLearningActivityId]
  );

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
      const joinedMembers = group.members.filter((member) => onlineUserSet.has(member));
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

  const teacherDashboard = useMemo<TeacherDashboardData<MonitorSession>>(() => {
    const sessions = filteredMonitorSessions;
    const readySessions = sessions.filter((session) => getStepAdvanceHint(session).ready);
    const riskRows = sessions
      .map((session) => ({ session, risk: getStuckRisk(session), hint: getStepAdvanceHint(session) }))
      .filter((row) => row.risk.level !== "ok" || row.hint.ready)
      .sort((a, b) => {
        const rank = { stuck: 0, watch: 1, ok: 2 } as const;
        return rank[a.risk.level] - rank[b.risk.level];
      });
    const joinedUsers = new Set(
      sessions.flatMap((session) => {
        const joined = session.joinedUsers && session.joinedUsers.length > 0 ? session.joinedUsers : [];
        const active = session.messages
          .filter((message) => message.role === "student" && Boolean(message.userId))
          .map((message) => message.userId as string);
        return [...joined, ...active];
      })
    );
    const onlineUsers = new Set(sessions.flatMap((session) => session.onlineUsers ?? []));
    return {
      sessionCount: sessions.length,
      joinedCount: joinedUsers.size,
      onlineCount: onlineUsers.size,
      readyCount: readySessions.length,
      stuckCount: riskRows.filter((row) => row.risk.level === "stuck").length,
      watchCount: riskRows.filter((row) => row.risk.level === "watch").length,
      riskRows
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredMonitorSessions]);

  useEffect(() => {
    if (!monitorSelected) return;
    const latest = monitorSessions.find((session) => session.sessionId === monitorSelected.sessionId);
    if (!latest) return;
    setMonitorSelected(latest);
  }, [monitorSessions, monitorSelected?.sessionId]);

  useEffect(() => {
    setMonitorSelected(null);
    setProgressRows([]);
    setPersonalMessages([]);
    setSelectedProgressUser("");
    setProgressSessionId("");
    setUserOutline("");
    setUserStep3SubmittedOutline("");
  }, [selectedLearningActivityId]);

  useEffect(() => {
    if (!showCourseStatusView || !selectedLearningActivityId) return;
    refreshMonitor().catch(() => undefined);
  }, [showCourseStatusView, selectedLearningActivityId]);

  useEffect(() => {
    if (!showCourseStatusView || !selectedLearningActivityId) return;
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
  }, [showCourseStatusView, selectedLearningActivityId, isLearningProcessing]);

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

  // Load data on mount (replaces the tab === "learning" guard)
  useEffect(() => {
    runLearningAction("系統正在載入學習管理資料，請稍候...", async () => {
      await onRefreshData();
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    const latest = session.messages
      .map((message) => new Date(message.at).getTime())
      .filter((time) => Number.isFinite(time))
      .sort((a, b) => b - a)[0];
    return typeof latest === "number" ? new Date(latest) : null;
  }

  function getStepAdvanceHint(session: MonitorSession): { ready: boolean; text: string; nextStep?: number } {
    const step = session.currentStep;
    const nextStep = step < 10 ? step + 1 : undefined;
    const stepMessages = session.messages.filter((m) => m.step === step);

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
      await onRefreshData();
      if (showCourseStatusView) await refreshMonitor();
    });
  }

  async function deleteActivityTask(activityId: string, title: string) {
    if (!isAdminConsole || loginRole !== "admin") return;
    const confirmed = window.confirm(`是否要刪除「${title}」的所有資料？\n\n此操作會刪除寫作任務、分組資料與學生參與過程，且無法復原。`);
    if (!confirmed) return;
    await runLearningAction("系統正在刪除寫作任務課程資料，請稍候...", async () => {
      const response = await fetch("/api/admin/activities", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activityId })
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "delete_activity_failed");
        return;
      }
      await onRefreshData();
      if (showCourseStatusView) await refreshMonitor();
      if (selectedLearningActivityId === activityId) {
        setShowCourseStatusView(false);
        setSelectedLearningActivityId("");
        setMonitorSelected(null);
      }
    });
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
      await onRefreshData();
      await refreshMonitor();
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

  return (
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
                              await onRefreshData();
                              if (showCourseStatusView) await refreshMonitor();
                            });
                          }}
                        >
                          重新整理
                        </button>
                        {isAdminConsole ? (
                          <button
                            type="button"
                            className="secondary"
                            style={{ width: "auto", background: "#ffe4e6", color: "#9f1239", borderColor: "#fecdd3" }}
                            disabled={isLearningProcessing}
                            onClick={() => {
                              deleteActivityTask(activity.id, activity.title).catch(() => undefined);
                            }}
                          >
                            刪除
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
          <TeacherDashboard
            dashboard={teacherDashboard}
            isProcessing={isLearningProcessing}
            onAdvanceStep={(sessionId, step) => applyStepSwitch(sessionId, step)}
            onInspectDialogue={(session) => {
              setMonitorSelected(session);
              setGroupViewStep("all");
              setProgressSessionId(session.sessionId);
            }}
            onLoadProgress={(sessionId) => {
              setProgressSessionId(sessionId);
              loadProgress(sessionId);
            }}
          />

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
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: groupLogExpanded ? 12 : 0 }}>
                <h2 style={{ margin: 0 }}>小組對話紀錄</h2>
                <button
                  style={{ padding: "4px 14px", fontSize: 13, cursor: "pointer", borderRadius: 6, border: "1px solid #cbd5e1", background: "#f8fafc" }}
                  onClick={() => setGroupLogExpanded((v) => !v)}
                >
                  {groupLogExpanded ? "▲ 收起" : "▼ 展開"}
                </button>
              </div>
              {groupLogExpanded && (() => {
                const allGroupMsgs = monitorSelected.messages.filter((m) => groupInteractionSteps.includes(m.step));
                const groupSteps = [1, 2, 4];

                const hasStep3 = monitorSelected.participants.some((p) => monitorSelected.step3SubmittedOutlines?.[p]);
                const hasStep4Revised = monitorSelected.participants.some((p) => {
                  const s = monitorSelected.step3SubmittedOutlines?.[p];
                  const c = monitorSelected.outlines?.[p];
                  return c && c !== s;
                });

                const step3Block = hasStep3 ? (
                  <div style={{ borderTop: "2px solid #cbd5e1", padding: "12px 0", marginTop: 4 }}>
                    <strong style={{ fontSize: 13, color: "#334155" }}>▶ 步驟三 各組員完成結構樹</strong>
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
                    <strong style={{ fontSize: 13, color: "#334155" }}>▶ 步驟四 各組員修正後結構樹</strong>
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
                      const isExpanded = groupLogStepExpanded[step] ?? true;
                      return (
                        <div key={step} style={{ border: "1px solid #e2e8f0", borderRadius: 8, marginBottom: 8, overflow: "hidden" }}>
                          <div
                            style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 14px", background: "#f1f5f9", cursor: "pointer", userSelect: "none" }}
                            onClick={() => setGroupLogStepExpanded((prev) => ({ ...prev, [step]: !isExpanded }))}
                          >
                            <strong style={{ fontSize: 14 }}>步驟 {step}</strong>
                            <span style={{ fontSize: 12, color: "#64748b" }}>{isExpanded ? "▲ 收起" : "▼ 展開"}</span>
                          </div>
                          {isExpanded && (
                            <div style={{ padding: "4px 12px 12px" }}>
                              {stepMsgs.map((message) => (
                                <div key={message.id} style={{ borderTop: "1px solid #e5e7eb", padding: "8px 0" }}>
                                  <strong>
                                    [S{message.step}] {message.role}
                                    {message.userId ? `(${message.userId})` : ""}
                                  </strong>
                                  <div dangerouslySetInnerHTML={{ __html: renderMessageHtml(message.text) }} />
                                  {[3, 4].includes(message.step) && (
                                    <OutlineSvg mermaidText={extractMermaidText(message.text) ?? ""} label={`S${message.step} 結構樹`} />
                                  )}
                                </div>
                              ))}
                              {step === 2 && step3Block}
                              {step === 4 && step4Block}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {!anyMsgs && <small>目前沒有 1/2/4 步驟對話。</small>}
                  </>
                );
              })()}
            </div>
          ) : null}

          {personalMessages.length > 0 ? (
            <div className="card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: personalLogExpanded ? 12 : 0 }}>
                <h2 style={{ margin: 0 }}>個人對話紀錄</h2>
                <button
                  style={{ padding: "4px 14px", fontSize: 13, cursor: "pointer", borderRadius: 6, border: "1px solid #cbd5e1", background: "#f8fafc" }}
                  onClick={() => setPersonalLogExpanded((v) => !v)}
                >
                  {personalLogExpanded ? "▲ 收起" : "▼ 展開"}
                </button>
              </div>
              {personalLogExpanded && (() => {
                const personalSteps = [...new Set(personalMessages.map((m) => m.step))].sort((a, b) => a - b);
                const hasStep4Revised = Boolean(userOutline && userOutline !== userStep3SubmittedOutline);

                const step3Block = userStep3SubmittedOutline ? (
                  <div style={{ borderTop: "2px solid #cbd5e1", padding: "12px 0", marginTop: 4 }}>
                    <strong style={{ fontSize: 13, color: "#334155" }}>▶ 步驟三完成結構樹</strong>
                    <OutlineSvg mermaidText={userStep3SubmittedOutline} label="步驟三完成結構樹" />
                  </div>
                ) : null;

                const step4Block = hasStep4Revised ? (
                  <div style={{ borderTop: "2px solid #cbd5e1", padding: "12px 0", marginTop: 4 }}>
                    <strong style={{ fontSize: 13, color: "#334155" }}>▶ 步驟四對比修正後結構樹</strong>
                    <OutlineSvg mermaidText={userOutline} label="步驟四對比修正後" />
                  </div>
                ) : null;

                return (
                  <>
                    {personalSteps.map((step) => {
                      const stepMsgs = personalMessages.filter((m) => m.step === step);
                      const isExpanded = personalLogStepExpanded[step] ?? true;
                      return (
                        <div key={step} style={{ border: "1px solid #e2e8f0", borderRadius: 8, marginBottom: 8, overflow: "hidden" }}>
                          <div
                            style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 14px", background: "#f1f5f9", cursor: "pointer", userSelect: "none" }}
                            onClick={() => setPersonalLogStepExpanded((prev) => ({ ...prev, [step]: !isExpanded }))}
                          >
                            <strong style={{ fontSize: 14 }}>步驟 {step}</strong>
                            <span style={{ fontSize: 12, color: "#64748b" }}>{isExpanded ? "▲ 收起" : "▼ 展開"}</span>
                          </div>
                          {isExpanded && (
                            <div style={{ padding: "4px 12px 12px" }}>
                              {stepMsgs.map((message) => (
                                <div key={message.id} style={{ borderTop: "1px solid #e5e7eb", padding: "8px 0" }}>
                                  <strong>
                                    [S{message.step}] {message.role}
                                    {message.userId ? `(${message.userId})` : ""}
                                  </strong>
                                  <div dangerouslySetInnerHTML={{ __html: renderMessageHtml(message.text) }} />
                                  {[3, 4].includes(message.step) && (
                                    <OutlineSvg mermaidText={extractMermaidText(message.text) ?? ""} label={`S${message.step} 結構樹`} />
                                  )}
                                </div>
                              ))}
                              {step === 3 && step3Block}
                              {step === 4 && step4Block}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </>
                );
              })()}
            </div>
          ) : null}
        </>
      ) : null}
    </>
  );
}
