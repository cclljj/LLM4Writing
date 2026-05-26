"use client";

import { useEffect, useMemo, useState } from "react";
import OutlineSvg from "@/app/_components/OutlineSvg";
import { renderMessageHtml } from "@/app/student/_components/renderMessageHtml";
import { deferStateUpdate } from "@/src/lib/defer-state-update";
import { ActivityRow, MonitorSession, OpenClassRow, UserRow } from "./types";
import { generateCourseImplementationPdf } from "@/src/lib/courseImplementationPdf";

type CourseImplementationReportTabProps = {
  loginRole: "teacher" | "admin";
  users: UserRow[];
  activities: ActivityRow[];
  openClasses: OpenClassRow[];
  setError: (error: string) => void;
};

type EndedCourseRow = {
  activityId: string;
  school: string;
  classNumber: string;
  title: string;
  ownerTeacherUsername: string;
  ownerTeacherName: string;
};

type StudentReportMetric = {
  classNumber: string;
  username: string;
  name: string;
  stars: number;
  stepText: string;
  sessionId: string;
  maxStep: number;
  messageCount: number;
  rejectedCount: number;
  step3OutlineChars: number;
  draftStep6Chars: number;
  joined: boolean;
};

type PersonalMessage = {
  id: string;
  role: string;
  userId?: string;
  step: number;
  text: string;
  at: string;
};

function injectStep8DraftTimeline(
  timelineMessages: Array<{ role: string; step: number; text: string; at: string }>,
  step8DraftRaw: string
): Array<{ role: string; step: number; text: string; at: string }> {
  const step8Draft = (step8DraftRaw ?? "").trim();
  if (!step8Draft) return timelineMessages;
  const duplicated = timelineMessages.some((message) => message.step === 8 && message.text.trim() === step8Draft);
  if (duplicated) return timelineMessages;
  const anchorAt = timelineMessages[timelineMessages.length - 1]?.at ?? new Date().toISOString();
  return [
    ...timelineMessages,
    {
      role: "system",
      step: 8,
      text: `## 步驟八最終稿\n${step8Draft}`,
      at: anchorAt,
    },
  ];
}

type ClassExportJob = {
  id: string;
  totalStudents: number;
  completedStudents: number;
  failedStudents: number;
  currentStudent: string;
  currentAttempt: number;
  maxAttempts: number;
  status: "queued" | "running" | "retrying" | "packaging" | "succeeded" | "failed" | "canceled";
  zipFileName: string;
  error?: string;
};

const PAGE_SIZE = 10;

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

function formatStepText(step: number): string {
  if (!Number.isFinite(step) || step <= 0) return "尚未加入";
  if (step > 10) return "Step 10";
  return `Step ${step}`;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function renderStars(stars: number): string {
  const safe = clamp(Math.round(stars), 1, 5);
  return "★".repeat(safe) + "☆".repeat(5 - safe);
}

function getStepsFromMessages(
  messages: PersonalMessage[],
  options?: { includeStep3?: boolean; includeStep4?: boolean }
): number[] {
  const set = new Set(messages.map((m) => m.step));
  if (options?.includeStep3) set.add(3);
  if (options?.includeStep4) set.add(4);
  return Array.from(set).sort((a, b) => a - b);
}

function buildStarRationales(metric: StudentReportMetric): string[] {
  const reasons: string[] = [];
  reasons.push(`基礎分：1 星。`);
  if (metric.joined || metric.messageCount > 0) reasons.push(`有加入/互動紀錄（+1）。`);
  if (metric.maxStep >= 4) reasons.push(`完成到 Step 4（+1）。`);
  if (metric.maxStep >= 8) reasons.push(`完成到 Step 8（+1）。`);
  if (metric.maxStep >= 10) reasons.push(`完成到 Step 10（+1）。`);
  if (metric.step3OutlineChars >= 60) reasons.push(`Step3 結構樹內容充足（>=60 字，+1）。`);
  if (metric.draftStep6Chars < 80 && metric.maxStep >= 6) reasons.push(`Step6 初稿偏短（<80 字，-1）。`);
  if (metric.rejectedCount >= 3) reasons.push(`回答品質拒答次數偏高（>=3 次，-1）。`);
  reasons.push(`最終星等：${renderStars(metric.stars)}。`);
  return reasons;
}

export default function CourseImplementationReportTab({
  loginRole,
  users,
  activities,
  openClasses,
  setError,
}: CourseImplementationReportTabProps) {
  const [schoolFilter, setSchoolFilter] = useState<string>("all");
  const [teacherFilter, setTeacherFilter] = useState<string>("all");
  const [page, setPage] = useState(1);

  const [selectedActivityId, setSelectedActivityId] = useState("");
  const [loadingReport, setLoadingReport] = useState(false);
  const [reportSessions, setReportSessions] = useState<MonitorSession[]>([]);

  const [selectedStudent, setSelectedStudent] = useState("");
  const [loadingStudentLog, setLoadingStudentLog] = useState(false);
  const [downloadingStudent, setDownloadingStudent] = useState("");
  const [classExportJobId, setClassExportJobId] = useState("");
  const [classExportJob, setClassExportJob] = useState<ClassExportJob | null>(null);
  const [startingClassExport, setStartingClassExport] = useState(false);
  const [personalMessages, setPersonalMessages] = useState<PersonalMessage[]>([]);
  const [userOutline, setUserOutline] = useState("");
  const [userStep3SubmittedOutline, setUserStep3SubmittedOutline] = useState("");
  const [personalStepExpanded, setPersonalStepExpanded] = useState<Record<number, boolean>>({});

  const teacherNameMap = useMemo(() => {
    const map = new Map<string, string>();
    users
      .filter((user) => user.role === "teacher")
      .forEach((teacher) => {
        map.set(teacher.username, teacher.name || teacher.username);
      });
    return map;
  }, [users]);

  const endedCourses = useMemo<EndedCourseRow[]>(() => {
    const openClassMap = new Map(openClasses.map((row) => [row.id, row]));

    return activities
      .filter((activity) => (activity.courseStatus ?? "not_started") === "ended")
      .map((activity) => {
        const openClass = openClassMap.get(activity.id);
        const ownerTeacherUsername = openClass?.ownerTeacherUsername ?? "";
        const ownerTeacherName = ownerTeacherUsername
          ? (teacherNameMap.get(ownerTeacherUsername) ?? ownerTeacherUsername)
          : "未指派";
        return {
          activityId: activity.id,
          school: activity.school,
          classNumber: activity.classNumber,
          title: activity.title,
          ownerTeacherUsername,
          ownerTeacherName,
        };
      })
      .sort((a, b) => b.activityId.localeCompare(a.activityId));
  }, [activities, openClasses, teacherNameMap]);

  const schoolOptions = useMemo(() => {
    return Array.from(new Set(endedCourses.map((course) => course.school).filter(Boolean))).sort((a, b) => a.localeCompare(b, "zh-Hant"));
  }, [endedCourses]);

  const teacherOptions = useMemo(() => {
    return Array.from(new Set(
      endedCourses
        .map((course) => course.ownerTeacherUsername)
        .filter((username) => Boolean(username))
    )).sort((a, b) => a.localeCompare(b, "zh-Hant"));
  }, [endedCourses]);

  const filteredCourses = useMemo(() => {
    return endedCourses.filter((course) => {
      if (loginRole === "admin") {
        if (schoolFilter !== "all" && course.school !== schoolFilter) return false;
        if (teacherFilter !== "all" && course.ownerTeacherUsername !== teacherFilter) return false;
      }
      return true;
    });
  }, [endedCourses, loginRole, schoolFilter, teacherFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredCourses.length / PAGE_SIZE));

  const pagedCourses = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredCourses.slice(start, start + PAGE_SIZE);
  }, [filteredCourses, page]);

  const selectedCourse = useMemo(() => {
    return endedCourses.find((course) => course.activityId === selectedActivityId) ?? null;
  }, [endedCourses, selectedActivityId]);

  const studentsInCourse = useMemo(() => {
    if (!selectedCourse) return [];
    return users
      .filter((user) => user.role === "student" && user.school === selectedCourse.school && user.classNumber === selectedCourse.classNumber)
      .sort((a, b) => a.username.localeCompare(b.username, "zh-Hant"));
  }, [users, selectedCourse]);

  const metricsByUser = useMemo(() => {
    const metrics = new Map<string, StudentReportMetric>();

    for (const student of studentsInCourse) {
      const sessions = reportSessions.filter((session) => session.participants.includes(student.username));
      const primarySession = sessions.slice().sort((a, b) => {
        const aAt = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
        const bAt = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
        return bAt - aAt;
      })[0];

      let maxStep = 0;
      let messageCount = 0;
      let rejectedCount = 0;
      let step3OutlineChars = 0;
      let draftStep6Chars = 0;
      let joined = false;

      for (const session of sessions) {
        const personalStep = session.personalSteps?.[student.username] ?? session.currentStep;
        if (personalStep > maxStep) maxStep = personalStep;

        const ownMessageCount = session.studentMessageStats?.[student.username]?.count ?? 0;
        messageCount += ownMessageCount;

        if ((session.joinedUsers ?? []).includes(student.username) || ownMessageCount > 0) {
          joined = true;
        }

        rejectedCount += session.qualitySignals?.rejectedAnswerCounts?.[student.username] ?? 0;
        step3OutlineChars = Math.max(step3OutlineChars, session.artifactDiagnostics?.step3OutlineChars?.[student.username] ?? 0);
        draftStep6Chars = Math.max(draftStep6Chars, session.artifactDiagnostics?.draftStep6Chars?.[student.username] ?? 0);
      }

      let stars = 1;
      if (joined || messageCount > 0) stars = 2;
      if (maxStep >= 4) stars += 1;
      if (maxStep >= 8) stars += 1;
      if (maxStep >= 10) stars += 1;
      if (step3OutlineChars >= 60) stars += 1;
      if (draftStep6Chars < 80 && maxStep >= 6) stars -= 1;
      if (rejectedCount >= 3) stars -= 1;
      stars = clamp(stars, 1, 5);

      metrics.set(student.username, {
        classNumber: student.classNumber ?? selectedCourse?.classNumber ?? "",
        username: student.username,
        name: student.name || student.username,
        stars,
        stepText: formatStepText(maxStep),
        sessionId: primarySession?.sessionId ?? "",
        maxStep,
        messageCount,
        rejectedCount,
        step3OutlineChars,
        draftStep6Chars,
        joined,
      });
    }

    return metrics;
  }, [studentsInCourse, reportSessions, selectedCourse]);

  async function viewCourse(activityId: string) {
    setError("");
    setSelectedActivityId(activityId);
    setSelectedStudent("");
    setPersonalMessages([]);
    setUserOutline("");
    setUserStep3SubmittedOutline("");
    setPersonalStepExpanded({});
    setClassExportJobId("");
    setClassExportJob(null);
    setReportSessions([]);
    setLoadingReport(true);
    try {
      const response = await fetch(`/api/teacher/monitor?activityId=${encodeURIComponent(activityId)}&limit=500`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "report_load_failed");
        setReportSessions([]);
        return;
      }
      setReportSessions((data.sessions ?? []) as MonitorSession[]);
    } catch {
      setError("report_load_failed");
      setReportSessions([]);
    } finally {
      setLoadingReport(false);
    }
  }

  async function viewStudentRecord(username: string) {
    setError("");
    const metric = metricsByUser.get(username);
    if (!metric?.sessionId || !selectedActivityId) {
      setError("此學生目前沒有可查看的課程紀錄。\n（可能尚未加入課程，或該課程暫無 session）");
      return;
    }

    setLoadingStudentLog(true);
    setSelectedStudent(username);
    setPersonalMessages([]);
    setPersonalStepExpanded({});

    try {
      const q = new URLSearchParams({
        sessionId: metric.sessionId,
        activityId: selectedActivityId,
        username,
      });
      const response = await fetch(`/api/teacher/personal-progress?${q.toString()}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "personal_progress_failed");
        return;
      }
      setPersonalMessages((data.personalMessages ?? []) as PersonalMessage[]);
      setUserOutline(data.userOutline ?? "");
      setUserStep3SubmittedOutline(data.userStep3SubmittedOutline ?? "");
    } catch {
      setError("personal_progress_failed");
    } finally {
      setLoadingStudentLog(false);
    }
  }

  async function downloadStudentReportPdf(username: string) {
    setError("");
    if (!selectedCourse || !selectedActivityId) {
      setError("尚未選擇課程，無法下載課程實施報告。");
      return;
    }

    const metric = metricsByUser.get(username);
    if (!metric?.sessionId) {
      setError("此學生目前沒有可下載的課程紀錄（可能尚未加入課程）。");
      return;
    }

    setDownloadingStudent(username);
    try {
      const q = new URLSearchParams({
        sessionId: metric.sessionId,
        activityId: selectedActivityId,
        username,
      });
      const response = await fetch(`/api/teacher/personal-progress?${q.toString()}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "personal_progress_failed");
        return;
      }

      const allMessages = (data.personalMessages ?? []) as PersonalMessage[];
      const scopedMessages = allMessages.filter((message) => {
        if (message.role === "student") return message.userId === username;
        if (message.role === "ai") return !message.userId || message.userId === username;
        if (message.role === "system") return !message.userId || message.userId === username;
        return false;
      });

      const timelineMessagesBase = scopedMessages
        .filter((message) => Boolean(message.text?.trim()))
        .map((message) => ({
          role: message.role,
          step: message.step,
          text: message.text,
          at: message.at,
        }));
      const timelineMessages = injectStep8DraftTimeline(timelineMessagesBase, data.userDraftStep8 ?? "");

      const blob = await generateCourseImplementationPdf({
        activityId: selectedCourse.activityId,
        school: selectedCourse.school,
        classNumber: selectedCourse.classNumber,
        title: selectedCourse.title,
        username,
        name: metric.name,
        metric: {
          stars: metric.stars,
          stepText: metric.stepText,
          maxStep: metric.maxStep,
          messageCount: metric.messageCount,
          rejectedCount: metric.rejectedCount,
          step3OutlineChars: metric.step3OutlineChars,
          draftStep6Chars: metric.draftStep6Chars,
          joined: metric.joined,
        },
        starLabel: renderStars(metric.stars),
        starRationales: buildStarRationales(metric),
        timelineMessages,
        step3SubmittedOutline: data.userStep3SubmittedOutline ?? "",
        step4RevisedOutline: data.userOutline ?? "",
        generatedAtIso: new Date().toISOString(),
      });

      const filename = `${selectedCourse.activityId}_${selectedCourse.classNumber}_${username}_course-report-v1.pdf`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      const message = error instanceof Error ? error.message : "report_pdf_generate_failed";
      if (message === "pdf_font_load_failed") {
        setError("PDF 下載失敗：中文字型載入失敗，請確認網路後重試。");
      } else {
        setError("PDF 下載失敗，請稍後再試。");
      }
    } finally {
      setDownloadingStudent("");
    }
  }

  async function startClassExport() {
    setError("");
    if (!selectedCourse) {
      setError("尚未選擇課程，無法下載全班報告。");
      return;
    }
    setStartingClassExport(true);
    try {
      const response = await fetch("/api/teacher/course-report-exports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activityId: selectedCourse.activityId, classNumber: selectedCourse.classNumber }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "class_export_start_failed");
        return;
      }
      setClassExportJobId(data.jobId ?? "");
    } catch {
      setError("class_export_start_failed");
    } finally {
      setStartingClassExport(false);
    }
  }

  async function downloadClassZip() {
    if (!classExportJobId || classExportJob?.status !== "succeeded") return;
    const url = `/api/teacher/course-report-exports/${encodeURIComponent(classExportJobId)}/download`;
    const response = await fetch(url, { cache: "no-store" });
    const contentType = response.headers.get("content-type") ?? "";
    if (!response.ok || !contentType.includes("application/zip")) {
      const data = await response.json().catch(() => null);
      setError(data?.error ?? "class_export_download_failed");
      return;
    }
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = classExportJob.zipFileName || `${selectedCourse?.activityId ?? "course"}_${selectedCourse?.classNumber ?? "class"}_course-report-v1.zip`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(objectUrl);
  }

  useEffect(() => {
    if (!classExportJobId) return;
    let cancelled = false;
    const timer = setInterval(() => {
      fetch(`/api/teacher/course-report-exports/${encodeURIComponent(classExportJobId)}`, { cache: "no-store" })
        .then((response) => response.json().then((data) => ({ ok: response.ok, data })))
        .then(({ ok, data }) => {
          if (cancelled || !ok) return;
          const job = (data.job ?? null) as ClassExportJob | null;
          setClassExportJob(job);
          const done = job && ["succeeded", "failed", "canceled"].includes(job.status);
          if (done) {
            clearInterval(timer);
          }
        })
        .catch(() => undefined);
    }, 1200);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [classExportJobId]);

  useEffect(() => {
    if (page > totalPages) {
      deferStateUpdate(() => setPage(totalPages));
    }
  }, [page, totalPages]);

  const scopedPersonalMessages = selectedStudent
    ? personalMessages.filter((message) => {
        if (message.role === "student") return message.userId === selectedStudent;
        if (message.role === "ai") return !message.userId || message.userId === selectedStudent;
        if (message.role === "system") return !message.userId || message.userId === selectedStudent;
        return false;
      })
    : personalMessages;

  const personalSteps = getStepsFromMessages(scopedPersonalMessages, {
    includeStep3: Boolean(userStep3SubmittedOutline),
    includeStep4: Boolean(userOutline),
  });

  return (
    <>
      <div className="card">
        <h2>課程實施報告 - 已完成課程清單</h2>
        {loginRole === "admin" ? (
          <div className="row" style={{ marginBottom: 10 }}>
            <div className="col">
              <label>學校</label>
              <select value={schoolFilter} onChange={(e) => {
                setSchoolFilter(e.target.value);
                setPage(1);
              }}>
                <option value="all">全部</option>
                {schoolOptions.map((school) => (
                  <option key={school} value={school}>{school}</option>
                ))}
              </select>
            </div>
            <div className="col">
              <label>教師</label>
              <select value={teacherFilter} onChange={(e) => {
                setTeacherFilter(e.target.value);
                setPage(1);
              }}>
                <option value="all">全部</option>
                {teacherOptions.map((teacherUsername) => (
                  <option key={teacherUsername} value={teacherUsername}>
                    {(teacherNameMap.get(teacherUsername) ?? teacherUsername)} ({teacherUsername})
                  </option>
                ))}
              </select>
            </div>
          </div>
        ) : null}

        <div style={{ overflowX: "auto" }}>
          <table className="pro-table">
            <thead>
              <tr>
                <th>課程 ID</th>
                <th>學校</th>
                <th>班級</th>
                <th>作文題目</th>
                {loginRole === "admin" ? <th>教師</th> : null}
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {pagedCourses.map((course) => (
                <tr key={course.activityId}>
                  <td>{course.activityId}</td>
                  <td>{course.school}</td>
                  <td>{course.classNumber}</td>
                  <td>{course.title}</td>
                  {loginRole === "admin" ? (
                    <td>{course.ownerTeacherUsername ? `${course.ownerTeacherName} (${course.ownerTeacherUsername})` : "未指派"}</td>
                  ) : null}
                  <td>
                    <button
                      type="button"
                      className="secondary"
                      style={{ width: "auto" }}
                      disabled={loadingReport && selectedActivityId === course.activityId}
                      onClick={() => {
                        viewCourse(course.activityId).catch(() => undefined);
                      }}
                    >
                      {loadingReport && selectedActivityId === course.activityId ? "載入中..." : "查看"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredCourses.length === 0 ? <small style={{ display: "block", marginTop: 8 }}>目前沒有可查看的已結束課程。</small> : null}

        {filteredCourses.length > 0 ? (
          <div className="row" style={{ marginTop: 10, alignItems: "center", gap: 8 }}>
            <div style={{ width: 100 }}>
              <button
                type="button"
                className="secondary"
                disabled={page <= 1}
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              >
                上一頁
              </button>
            </div>
            <small>第 {page} / {totalPages} 頁（共 {filteredCourses.length} 筆）</small>
            <div style={{ width: 100 }}>
              <button
                type="button"
                className="secondary"
                disabled={page >= totalPages}
                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
              >
                下一頁
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {selectedCourse ? (
        <div className="card">
          <h2>課程實施報告內容</h2>
          <small style={{ display: "block", marginBottom: 10 }}>
            {selectedCourse.school} / {selectedCourse.classNumber} / {selectedCourse.title}
          </small>
          <div className="row" style={{ alignItems: "center", gap: 8, marginBottom: 10 }}>
            <div style={{ width: 210 }}>
              <button type="button" className="secondary" onClick={() => startClassExport().catch(() => undefined)} disabled={startingClassExport}>
                {startingClassExport ? "建立匯出作業中..." : "一鍵下載全班 ZIP"}
              </button>
            </div>
            {classExportJob?.status === "succeeded" ? (
              <div style={{ width: 100 }}>
                <button type="button" className="secondary" onClick={() => downloadClassZip().catch(() => undefined)}>下載 ZIP</button>
              </div>
            ) : null}
          </div>
          {classExportJob ? (
            <small style={{ display: "block", marginBottom: 10 }}>
              {classExportJob.status === "queued" ? "已加入佇列，準備開始..." : null}
              {classExportJob.status === "running" ? `正在產生報告：${classExportJob.completedStudents}/${classExportJob.totalStudents}` : null}
              {classExportJob.status === "retrying"
                ? `重試中：${classExportJob.currentStudent || "—"}（第 ${classExportJob.currentAttempt}/${classExportJob.maxAttempts} 次）`
                : null}
              {classExportJob.status === "packaging" ? "正在壓縮 ZIP，請稍候..." : null}
              {classExportJob.status === "succeeded" ? `匯出完成，可下載 ${classExportJob.zipFileName}` : null}
              {classExportJob.status === "failed"
                ? `匯出失敗：${classExportJob.failedStudents} 位學生未成功產出，請重新執行。`
                : null}
              {classExportJob.status === "canceled" ? "匯出已取消。" : null}
            </small>
          ) : null}

          <div style={{ overflowX: "auto" }}>
            <table className="pro-table">
              <thead>
                <tr>
                  <th>班級</th>
                  <th>帳號</th>
                  <th>姓名</th>
                  <th>完成度</th>
                  <th>目前進度</th>
                  <th>課程紀錄</th>
                  <th>下載</th>
                </tr>
              </thead>
              <tbody>
                {studentsInCourse.map((student) => {
                  const metric = metricsByUser.get(student.username);
                  const canViewRecord = Boolean(metric?.sessionId);
                  return (
                    <tr key={student.username}>
                      <td>{metric?.classNumber ?? student.classNumber ?? selectedCourse.classNumber}</td>
                      <td>{student.username}</td>
                      <td>{student.name}</td>
                      <td title="系統依互動步驟、輸入品質與產出完整度評估">{renderStars(metric?.stars ?? 1)}</td>
                      <td>{metric?.stepText ?? "尚未加入"}</td>
                      <td>
                        <button
                          type="button"
                          className="secondary"
                          style={{ width: "auto" }}
                          disabled={!canViewRecord || loadingStudentLog}
                          onClick={() => {
                            viewStudentRecord(student.username).catch(() => undefined);
                          }}
                        >
                          {loadingStudentLog && selectedStudent === student.username ? "載入中..." : "查看"}
                        </button>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="secondary"
                          style={{ width: "auto" }}
                          disabled={downloadingStudent === student.username}
                          onClick={() => {
                            downloadStudentReportPdf(student.username).catch(() => undefined);
                          }}
                        >
                          {downloadingStudent === student.username ? "產生中..." : "下載"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {loadingReport ? <small style={{ display: "block", marginTop: 8 }}>正在載入課程實施資料...</small> : null}
          {!loadingReport && studentsInCourse.length === 0 ? <small style={{ display: "block", marginTop: 8 }}>此課程尚無可顯示的學生名單。</small> : null}
        </div>
      ) : null}

      {selectedCourse && selectedStudent ? (
        <div className="card">
          <h2>個人課程紀錄 - {selectedStudent}</h2>

          {loadingStudentLog ? <small>正在載入該生課程紀錄...</small> : null}

          {!loadingStudentLog && personalSteps.length === 0 ? <small>目前沒有可顯示的個人對話紀錄。</small> : null}

          {!loadingStudentLog && personalSteps.length > 0 ? (
            <>
              {personalSteps.map((step) => {
                const stepMessages = scopedPersonalMessages.filter((message) => message.step === step);
                const isExpanded = personalStepExpanded[step] ?? false;

                const step3Block = step === 3 && userStep3SubmittedOutline ? (
                  <div style={{ borderTop: "2px solid #cbd5e1", padding: "12px 0", marginTop: 4 }}>
                    <strong style={{ fontSize: 13, color: "#334155" }}>步驟三完成結構樹</strong>
                    <OutlineSvg mermaidText={userStep3SubmittedOutline} label="步驟三完成結構樹" />
                  </div>
                ) : null;

                const step4Block = step === 4 && userOutline ? (
                  <div style={{ borderTop: "2px solid #cbd5e1", padding: "12px 0", marginTop: 4 }}>
                    <strong style={{ fontSize: 13, color: "#334155" }}>步驟四對比修正後結構樹</strong>
                    <OutlineSvg mermaidText={userOutline} label="步驟四對比修正後" />
                  </div>
                ) : null;

                return (
                  <div key={`personal-step-${step}`} className="card">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                      <h3 style={{ margin: 0 }}>
                        Step {step} {stepNameMap[step] ? `- ${stepNameMap[step]}` : ""}
                      </h3>
                      <button
                        type="button"
                        className="secondary"
                        aria-expanded={isExpanded}
                        onClick={() => setPersonalStepExpanded((prev) => ({ ...prev, [step]: !isExpanded }))}
                        style={{ width: "fit-content", padding: "3px 6px", whiteSpace: "nowrap" }}
                      >
                        {isExpanded ? "▾ 閉合" : "▸ 展開"}
                      </button>
                    </div>

                    {isExpanded ? (
                      <>
                        <hr style={{ border: 0, borderTop: "1px solid #e5e7eb", margin: "10px 0" }} />
                        {stepMessages.map((message) => (
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
                        {step3Block}
                        {step4Block}
                      </>
                    ) : null}
                  </div>
                );
              })}
            </>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
