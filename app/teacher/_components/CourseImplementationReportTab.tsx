"use client";

import { useEffect, useMemo, useState } from "react";
import OutlineSvg from "@/app/_components/OutlineSvg";
import { renderMessageHtml } from "@/app/student/_components/renderMessageHtml";
import { deferStateUpdate } from "@/src/lib/defer-state-update";
import { ActivityRow, MonitorSession, OpenClassRow, UserRow } from "./types";
import { generateCourseImplementationPdf, type CourseImplementationPdfInput } from "@/src/lib/courseImplementationPdf";
import { injectStep8DraftTimeline } from "@/src/lib/course-report-pdf-timeline";
import { shouldTreatAsZipDownload } from "@/src/lib/course-report-download";
import { resolveStudentReportCompletedAtIso } from "@/src/lib/course-report-completion-time";
import { stepNameMap } from "@/src/lib/step-names";
import { COURSE_REPORT_FILE_VERSION } from "@/src/lib/course-report-version";
import { getSessionWorkflowSteps, getWorkflowStepByCapability, getWorkflowStepName } from "@/src/lib/course-workflow";
import type { CourseWorkflowStep, WorkflowCapability } from "@/src/lib/types";

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
  academicYear: string;
  academicYearTerm: string;
  title: string;
  ownerTeacherUsername: string;
  ownerTeacherName: string;
  courseEndedAt?: string;
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

type ClassExportJob = {
  id: string;
  format?: "pdf" | "json";
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


function formatStepText(step: number): string {
  if (!Number.isFinite(step) || step <= 0) return "尚未加入";
  return `Step ${step}`;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function renderStars(stars: number): string {
  const safe = clamp(Math.round(stars), 1, 5);
  return "★".repeat(safe) + "☆".repeat(5 - safe);
}

function classExportStatusText(format: "pdf" | "json", job: ClassExportJob): string {
  const label = format.toUpperCase();
  if (job.status === "queued") return `全班 ${label} 已加入佇列，準備開始...`;
  if (job.status === "running") return `正在產生全班 ${label}：${job.completedStudents}/${job.totalStudents}`;
  if (job.status === "retrying") return `全班 ${label} 重試中：${job.currentStudent || "—"}（第 ${job.currentAttempt}/${job.maxAttempts} 次）`;
  if (job.status === "packaging") return `正在打包全班 ${label}，請稍候...`;
  if (job.status === "succeeded") return `全班 ${label} 匯出完成，可下載 ${job.zipFileName}`;
  if (job.status === "failed") return `全班 ${label} 匯出失敗：${job.failedStudents} 位學生未成功產出，請重新執行。`;
  return `全班 ${label} 匯出已取消。`;
}

function getStepsFromMessages(
  messages: PersonalMessage[],
  options?: { includeSteps?: number[] }
): number[] {
  const set = new Set(messages.map((m) => m.step));
  (options?.includeSteps ?? []).forEach((step) => set.add(step));
  return Array.from(set).sort((a, b) => a - b);
}

function getWorkflowOwner(workflowSteps?: CourseWorkflowStep[]): { workflowSteps: CourseWorkflowStep[] } {
  return { workflowSteps: workflowSteps && workflowSteps.length > 0 ? workflowSteps : [] };
}

function getCapabilityRuntimeStep(workflowSteps: CourseWorkflowStep[] | undefined, capability: WorkflowCapability, fallbackStep: number): number {
  return getWorkflowStepByCapability(getWorkflowOwner(workflowSteps), capability)?.step ?? fallbackStep;
}

function getStepOrderIndex(workflowSteps: CourseWorkflowStep[] | undefined, step: number): number {
  const steps = getSessionWorkflowSteps(getWorkflowOwner(workflowSteps));
  const index = steps.findIndex((item) => item.step === step);
  return index >= 0 ? index : Math.max(0, step - 1);
}

function addReachedCapabilities(
  reached: Set<WorkflowCapability>,
  workflowSteps: CourseWorkflowStep[] | undefined,
  currentStep: number
) {
  const steps = getSessionWorkflowSteps(getWorkflowOwner(workflowSteps));
  const index = steps.findIndex((item) => item.step === currentStep);
  if (index >= 0) {
    steps.slice(0, index + 1).forEach((item) => reached.add(item.capability));
    return;
  }

  // Legacy sessions before workflow snapshots still use numeric Step IDs.
  if (currentStep >= 1) reached.add("topic_discussion");
  if (currentStep >= 2) reached.add("research_discussion");
  if (currentStep >= 3) reached.add("outline");
  if (currentStep >= 4) reached.add("peer_outline");
  if (currentStep >= 5) reached.add("summary_report");
  if (currentStep >= 6) reached.add("draft");
  if (currentStep >= 7) reached.add("feedback_report");
  if (currentStep >= 8) reached.add("revision");
  if (currentStep >= 9) reached.add("reflection");
  if (currentStep >= 10) reached.add("final_report");
}

function buildStarRationales(metric: StudentReportMetric): string[] {
  const reasons: string[] = [];
  reasons.push(`基礎分：1 星。`);
  if (metric.joined || metric.messageCount > 0) reasons.push(`有加入/互動紀錄（+1）。`);
  reasons.push(`進度越接近課程後段，星等越高。`);
  if (metric.step3OutlineChars >= 60) reasons.push(`結構樹內容充足（>=60 字，+1）。`);
  if (metric.draftStep6Chars < 80 && metric.maxStep > 0) reasons.push(`初稿偏短時會扣分（<80 字，-1）。`);
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
  const [downloadingStudentJson, setDownloadingStudentJson] = useState("");
  const [classPdfExportJobId, setClassPdfExportJobId] = useState("");
  const [classPdfExportJob, setClassPdfExportJob] = useState<ClassExportJob | null>(null);
  const [classPdfExportCourse, setClassPdfExportCourse] = useState<EndedCourseRow | null>(null);
  const [classJsonExportJobId, setClassJsonExportJobId] = useState("");
  const [classJsonExportJob, setClassJsonExportJob] = useState<ClassExportJob | null>(null);
  const [classJsonExportCourse, setClassJsonExportCourse] = useState<EndedCourseRow | null>(null);
  const [startingClassPdfExport, setStartingClassPdfExport] = useState(false);
  const [startingClassJsonExport, setStartingClassJsonExport] = useState(false);
  const [researchIdentityMode, setResearchIdentityMode] = useState<"anonymous" | "account">("anonymous");
  const [downloadingResearchExport, setDownloadingResearchExport] = useState(false);
  const [personalMessages, setPersonalMessages] = useState<PersonalMessage[]>([]);
  const [personalWorkflowSteps, setPersonalWorkflowSteps] = useState<CourseWorkflowStep[]>([]);
  const [userOutline, setUserOutline] = useState("");
  const [userStep3SubmittedOutline, setUserStep3SubmittedOutline] = useState("");
  const [userDraftStep8, setUserDraftStep8] = useState("");
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
          academicYear: activity.academicYear,
          academicYearTerm: activity.academicYearTerm,
          title: activity.title,
          ownerTeacherUsername,
          ownerTeacherName,
          courseEndedAt: activity.courseEndedAt,
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
      let maxStepOrderIndex = -1;
      let maxStepWorkflowSteps: CourseWorkflowStep[] | undefined = primarySession?.workflowSteps;
      const reachedCapabilities = new Set<WorkflowCapability>();

      for (const session of sessions) {
        const personalStep = session.personalSteps?.[student.username] ?? session.currentStep;
        const stepOrderIndex = getStepOrderIndex(session.workflowSteps, personalStep);
        if (stepOrderIndex > maxStepOrderIndex) {
          maxStepOrderIndex = stepOrderIndex;
          maxStep = personalStep;
          maxStepWorkflowSteps = session.workflowSteps;
        }
        addReachedCapabilities(reachedCapabilities, session.workflowSteps, personalStep);

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
      if (reachedCapabilities.has("peer_outline")) stars += 1;
      if (reachedCapabilities.has("revision")) stars += 1;
      if (reachedCapabilities.has("final_report")) stars += 1;
      if (step3OutlineChars >= 60) stars += 1;
      if (draftStep6Chars < 80 && reachedCapabilities.has("draft")) stars -= 1;
      if (rejectedCount >= 3) stars -= 1;
      stars = clamp(stars, 1, 5);

      metrics.set(student.username, {
        classNumber: student.classNumber ?? selectedCourse?.classNumber ?? "",
        username: student.username,
        name: student.name || student.username,
        stars,
        stepText: maxStep > 0
          ? `Step ${maxStep}${getWorkflowStepName(getWorkflowOwner(maxStepWorkflowSteps), maxStep) ? ` - ${getWorkflowStepName(getWorkflowOwner(maxStepWorkflowSteps), maxStep)}` : ""}`
          : formatStepText(maxStep),
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
    setPersonalWorkflowSteps([]);
    setUserOutline("");
    setUserStep3SubmittedOutline("");
    setUserDraftStep8("");
    setPersonalStepExpanded({});
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
    setPersonalWorkflowSteps([]);
    setUserOutline("");
    setUserStep3SubmittedOutline("");
    setUserDraftStep8("");
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
      setPersonalWorkflowSteps((data.workflowSteps ?? []) as CourseWorkflowStep[]);
      setUserOutline(data.userOutline ?? "");
      setUserStep3SubmittedOutline(data.userStep3SubmittedOutline ?? "");
      setUserDraftStep8(data.userDraftStep8 ?? "");
    } catch {
      setError("personal_progress_failed");
    } finally {
      setLoadingStudentLog(false);
    }
  }

  async function loadStudentReportInput(username: string): Promise<CourseImplementationPdfInput | null> {
    setError("");
    if (!selectedCourse || !selectedActivityId) {
      setError("尚未選擇課程，無法下載課程實施報告。");
      return null;
    }

    const metric = metricsByUser.get(username);
    if (!metric?.sessionId) {
      setError("此學生目前沒有可下載的課程紀錄（可能尚未加入課程）。");
      return null;
    }

    const q = new URLSearchParams({
      sessionId: metric.sessionId,
      activityId: selectedActivityId,
      username,
    });
    const response = await fetch(`/api/teacher/personal-progress?${q.toString()}`, { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error ?? "personal_progress_failed");
      return null;
    }

    const allMessages = (data.personalMessages ?? []) as PersonalMessage[];
    const workflowSteps = (data.workflowSteps ?? []) as CourseWorkflowStep[];
    const revisionStep = getCapabilityRuntimeStep(workflowSteps, "revision", 8);
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
    const timelineMessages = injectStep8DraftTimeline(
      timelineMessagesBase,
      data.userDraftStep8 ?? "",
      new Date().toISOString(),
      revisionStep
    );
    const legacyCompletedAtIso = scopedMessages.at(-1)?.at;
    const completedAtIso = resolveStudentReportCompletedAtIso({
      messages: scopedMessages,
      username,
      courseEndedAt: selectedCourse.courseEndedAt,
      legacyFallbackAt: legacyCompletedAtIso,
    });
    const privacyPeerUsernames = ((data.progress ?? []) as Array<{ username?: string }>)
      .map((item) => item.username ?? "")
      .filter((peerUsername) => peerUsername && peerUsername !== username);

    return {
      activityId: selectedCourse.activityId,
      school: selectedCourse.school,
      classNumber: selectedCourse.classNumber,
      academicYear: selectedCourse.academicYear,
      academicYearTerm: selectedCourse.academicYearTerm,
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
      workflowSteps,
      step3SubmittedOutline: data.userStep3SubmittedOutline ?? "",
      step4RevisedOutline: data.userOutline ?? "",
      privacyPeerUsernames,
      generatedAtIso: new Date().toISOString(),
      completedAtIso,
    };
  }

  async function downloadStudentReportPdf(username: string) {
    setDownloadingStudent(username);
    try {
      const input = await loadStudentReportInput(username);
      if (!input) return;
      const blob = await generateCourseImplementationPdf(input);

      const filename = `${input.activityId}_${input.classNumber}_${username}_course-report-${COURSE_REPORT_FILE_VERSION}.pdf`;
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

  async function downloadStudentReportJson(username: string) {
    setDownloadingStudentJson(username);
    try {
      if (!selectedCourse) return;
      const query = new URLSearchParams({
        activityId: selectedCourse.activityId,
        classNumber: selectedCourse.classNumber,
        username,
      });
      const response = await fetch(`/api/teacher/course-report-exports/student?${query.toString()}`, { cache: "no-store" });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        setError(data?.error ?? "student_report_json_failed");
        return;
      }
      const blob = await response.blob();
      const filename = `${selectedCourse.activityId}_${selectedCourse.classNumber}_${username}_course-report-${COURSE_REPORT_FILE_VERSION}.json`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError("JSON 下載失敗，請稍後再試。");
    } finally {
      setDownloadingStudentJson("");
    }
  }

  async function startClassExport(course: EndedCourseRow, format: "pdf" | "json") {
    setError("");
    const hasActiveExport = [classPdfExportJob, classJsonExportJob].some(
      (job) => job && !["succeeded", "failed", "canceled"].includes(job.status)
    );
    if (startingClassPdfExport || startingClassJsonExport || hasActiveExport) {
      setError("目前正在產製合併檔，請等待完成後再產製其他合併檔。");
      return;
    }
    if (format === "json") {
      setClassJsonExportCourse(course);
      setClassJsonExportJob(null);
      setStartingClassJsonExport(true);
    } else {
      setClassPdfExportCourse(course);
      setClassPdfExportJob(null);
      setStartingClassPdfExport(true);
    }
    try {
      const response = await fetch("/api/teacher/course-report-exports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activityId: course.activityId, classNumber: course.classNumber, format }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "class_export_start_failed");
        return;
      }
      if (format === "json") {
        setClassJsonExportCourse(course);
        setClassJsonExportJobId(data.jobId ?? "");
      } else {
        setClassPdfExportCourse(course);
        setClassPdfExportJobId(data.jobId ?? "");
      }
    } catch {
      setError("class_export_start_failed");
    } finally {
      if (format === "json") setStartingClassJsonExport(false);
      else setStartingClassPdfExport(false);
    }
  }

  async function downloadClassExport(format: "pdf" | "json") {
    const jobId = format === "json" ? classJsonExportJobId : classPdfExportJobId;
    const job = format === "json" ? classJsonExportJob : classPdfExportJob;
    const course = format === "json" ? classJsonExportCourse : classPdfExportCourse;
    if (!jobId || job?.status !== "succeeded") return;
    const url = `/api/teacher/course-report-exports/${encodeURIComponent(jobId)}/download`;
    const response = await fetch(url, { cache: "no-store" });
    const contentType = response.headers.get("content-type") ?? "";
    if (!shouldTreatAsZipDownload({ ok: response.ok, contentType })) {
      const data = await response.json().catch(() => null);
      setError(data?.error ?? "class_export_download_failed");
      return;
    }
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = job.zipFileName || `${course?.activityId ?? "course"}_${course?.classNumber ?? "class"}_course-report-${format}-${COURSE_REPORT_FILE_VERSION}.zip`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(objectUrl);
  }

  async function downloadResearchJson() {
    setError("");
    if (!selectedCourse) {
      setError("尚未選擇課程，無法下載研究資料。");
      return;
    }
    setDownloadingResearchExport(true);
    try {
      const q = new URLSearchParams({
        activityId: selectedCourse.activityId,
        identity: researchIdentityMode
      });
      const response = await fetch(`/api/teacher/research-export?${q.toString()}`, { cache: "no-store" });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        setError(data?.error ?? "research_export_failed");
        return;
      }
      const blob = await response.blob();
      const filenameFromHeader = response.headers
        .get("content-disposition")
        ?.match(/filename="([^"]+)"/)?.[1];
      const filename =
        filenameFromHeader ||
        `${selectedCourse.activityId}_${selectedCourse.classNumber}_research-student-inputs-${researchIdentityMode}.json`;
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
    } catch {
      setError("research_export_failed");
    } finally {
      setDownloadingResearchExport(false);
    }
  }

  useEffect(() => {
    if (!classPdfExportJobId) return;
    let cancelled = false;
    const timer = setInterval(() => {
      fetch(`/api/teacher/course-report-exports/${encodeURIComponent(classPdfExportJobId)}`, { cache: "no-store" })
        .then((response) => response.json().then((data) => ({ ok: response.ok, data })))
        .then(({ ok, data }) => {
          if (cancelled || !ok) return;
          const job = (data.job ?? null) as ClassExportJob | null;
          setClassPdfExportJob(job);
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
  }, [classPdfExportJobId]);

  useEffect(() => {
    if (!classJsonExportJobId) return;
    let cancelled = false;
    const timer = setInterval(() => {
      fetch(`/api/teacher/course-report-exports/${encodeURIComponent(classJsonExportJobId)}`, { cache: "no-store" })
        .then((response) => response.json().then((data) => ({ ok: response.ok, data })))
        .then(({ ok, data }) => {
          if (cancelled || !ok) return;
          const job = (data.job ?? null) as ClassExportJob | null;
          setClassJsonExportJob(job);
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
  }, [classJsonExportJobId]);

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

  const selectedStudentMetric = selectedStudent ? metricsByUser.get(selectedStudent) : undefined;
  const selectedMetricSession = selectedStudentMetric?.sessionId
    ? reportSessions.find((session) => session.sessionId === selectedStudentMetric.sessionId)
    : undefined;
  const selectedWorkflowSteps = personalWorkflowSteps.length > 0
    ? personalWorkflowSteps
    : selectedMetricSession?.workflowSteps ?? [];
  const selectedWorkflowOwner = getWorkflowOwner(selectedWorkflowSteps);
  const outlineStep = getCapabilityRuntimeStep(selectedWorkflowSteps, "outline", 3);
  const peerOutlineStep = getCapabilityRuntimeStep(selectedWorkflowSteps, "peer_outline", 4);
  const revisionStep = getCapabilityRuntimeStep(selectedWorkflowSteps, "revision", 8);

  const personalSteps = getStepsFromMessages(scopedPersonalMessages, {
    includeSteps: [
      userStep3SubmittedOutline ? outlineStep : undefined,
      userOutline ? peerOutlineStep : undefined,
      userDraftStep8 ? revisionStep : undefined,
    ].filter((step): step is number => typeof step === "number"),
  });
  const classPdfExportIsActive = Boolean(classPdfExportJob && !["succeeded", "failed", "canceled"].includes(classPdfExportJob.status));
  const classJsonExportIsActive = Boolean(classJsonExportJob && !["succeeded", "failed", "canceled"].includes(classJsonExportJob.status));
  const classExportInProgress = startingClassPdfExport || startingClassJsonExport || classPdfExportIsActive || classJsonExportIsActive;
  const classExportWaitingNotice = startingClassPdfExport || classPdfExportIsActive
    ? "正在產製 PDF 合併檔，請等待完成後再產製其他合併檔。"
    : startingClassJsonExport || classJsonExportIsActive
      ? "正在產製 JSON 合併檔，請等待完成後再產製其他合併檔。"
      : "";

  return (
    <>
      <div className="card">
        <h2>課程實施報告 - 已完成課程清單</h2>
        {classExportWaitingNotice ? (
          <small style={{ display: "block", marginBottom: 10, color: "var(--warning-text)" }}>
            {classExportWaitingNotice}
          </small>
        ) : null}
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

        <div className="table-scroll">
          <table className="pro-table">
            <thead>
              <tr>
                <th>課程 ID</th>
                <th>學年／學期</th>
                <th>學校</th>
                <th>班級</th>
                <th>作文題目</th>
                {loginRole === "admin" ? <th>教師</th> : null}
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {pagedCourses.map((course) => {
                const isPdfExportCourse = classPdfExportCourse?.activityId === course.activityId;
                const isJsonExportCourse = classJsonExportCourse?.activityId === course.activityId;
                const pdfButtonLabel = isPdfExportCourse && classPdfExportJob?.status === "succeeded"
                  ? "下載PDF合併檔"
                  : isPdfExportCourse && (startingClassPdfExport || classPdfExportIsActive)
                    ? "正在產製PDF合併檔..."
                    : "產製PDF合併檔";
                const jsonButtonLabel = isJsonExportCourse && classJsonExportJob?.status === "succeeded"
                  ? "下載JSON合併檔"
                  : isJsonExportCourse && (startingClassJsonExport || classJsonExportIsActive)
                    ? "正在產製JSON合併檔..."
                    : "產製JSON合併檔";
                return (
                <tr key={course.activityId}>
                  <td>{course.activityId}</td>
                  <td>{course.academicYear}／{course.academicYearTerm}</td>
                  <td>{course.school}</td>
                  <td>{course.classNumber}</td>
                  <td>{course.title}</td>
                  {loginRole === "admin" ? (
                    <td>{course.ownerTeacherUsername ? `${course.ownerTeacherName} (${course.ownerTeacherUsername})` : "未指派"}</td>
                  ) : null}
                  <td>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
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
                      <button
                        type="button"
                        className="secondary"
                        style={{ width: "auto" }}
                        disabled={classExportInProgress}
                        onClick={() => {
                          if (isPdfExportCourse && classPdfExportJob?.status === "succeeded") {
                            downloadClassExport("pdf").catch(() => undefined);
                            return;
                          }
                          startClassExport(course, "pdf").catch(() => undefined);
                        }}
                      >
                        {pdfButtonLabel}
                      </button>
                      <button
                        type="button"
                        className="secondary"
                        style={{ width: "auto" }}
                        disabled={classExportInProgress}
                        onClick={() => {
                          if (isJsonExportCourse && classJsonExportJob?.status === "succeeded") {
                            downloadClassExport("json").catch(() => undefined);
                            return;
                          }
                          startClassExport(course, "json").catch(() => undefined);
                        }}
                      >
                        {jsonButtonLabel}
                      </button>
                    </div>
                    {isPdfExportCourse && classPdfExportJob ? (
                      <small style={{ display: "block", marginTop: 6 }}>{classExportStatusText("pdf", classPdfExportJob)}</small>
                    ) : null}
                    {isJsonExportCourse && classJsonExportJob ? (
                      <small style={{ display: "block", marginTop: 6 }}>{classExportStatusText("json", classJsonExportJob)}</small>
                    ) : null}
                  </td>
                </tr>
                );
              })}
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
            {selectedCourse.school} / {selectedCourse.classNumber} / {selectedCourse.academicYear} 學年第 {selectedCourse.academicYearTerm} 學期 / {selectedCourse.title}
          </small>
          <div className="row" style={{ alignItems: "center", gap: 8, marginBottom: 10 }}>
            <div style={{ width: 170 }}>
              <select value={researchIdentityMode} onChange={(e) => setResearchIdentityMode(e.target.value as "anonymous" | "account")}>
                <option value="anonymous">匿名化研究資料</option>
                <option value="account">包含學生帳號</option>
              </select>
            </div>
            <div style={{ width: 180 }}>
              <button
                type="button"
                className="secondary"
                onClick={() => downloadResearchJson().catch(() => undefined)}
                disabled={downloadingResearchExport}
              >
                {downloadingResearchExport ? "下載中..." : "下載系統 Log JSON"}
              </button>
            </div>
          </div>
          {researchIdentityMode === "account" ? (
            <small style={{ display: "block", marginBottom: 10, color: "var(--warning-text)" }}>
              目前匯出會包含學生帳號，請確認符合 IRB/同意書使用範圍。
            </small>
          ) : null}
          <div className="table-scroll">
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
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          <button
                            type="button"
                            className="secondary"
                            style={{ width: "auto" }}
                            disabled={downloadingStudent === student.username}
                            onClick={() => {
                              downloadStudentReportPdf(student.username).catch(() => undefined);
                            }}
                          >
                            {downloadingStudent === student.username ? "產生中..." : "PDF"}
                          </button>
                          <button
                            type="button"
                            className="secondary"
                            style={{ width: "auto" }}
                            disabled={downloadingStudentJson === student.username}
                            onClick={() => {
                              downloadStudentReportJson(student.username).catch(() => undefined);
                            }}
                          >
                            {downloadingStudentJson === student.username ? "產生中..." : "JSON"}
                          </button>
                        </div>
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
                const stepName = getWorkflowStepName(selectedWorkflowOwner, step) ?? stepNameMap[step] ?? "";

                const step3Block = step === outlineStep && userStep3SubmittedOutline ? (
                  <div style={{ borderTop: "2px solid var(--line)", padding: "12px 0", marginTop: 4 }}>
                    <strong style={{ fontSize: 13, color: "var(--muted-strong)" }}>{`Step ${outlineStep} ${getWorkflowStepName(selectedWorkflowOwner, outlineStep) ?? "生成論點"}原始輸入架構圖`}</strong>
                    <OutlineSvg mermaidText={userStep3SubmittedOutline} label={`Step ${outlineStep} 原始輸入架構圖`} />
                  </div>
                ) : null;

                const step4Block = step === peerOutlineStep && userOutline ? (
                  <div style={{ borderTop: "2px solid var(--line)", padding: "12px 0", marginTop: 4 }}>
                    <strong style={{ fontSize: 13, color: "var(--muted-strong)" }}>{`Step ${peerOutlineStep} ${getWorkflowStepName(selectedWorkflowOwner, peerOutlineStep) ?? "對比修正"}修正後結構樹`}</strong>
                    <OutlineSvg mermaidText={userOutline} label={`Step ${peerOutlineStep} 修正後結構樹`} />
                  </div>
                ) : null;

                const step8Block = step === revisionStep && userDraftStep8 ? (
                  <div style={{ borderTop: "2px solid var(--line)", padding: "12px 0", marginTop: 4 }}>
                    <strong style={{ fontSize: 13, color: "var(--muted-strong)" }}>{`Step ${revisionStep} ${getWorkflowStepName(selectedWorkflowOwner, revisionStep) ?? "修正文稿"}潤飾稿`}</strong>
                    <div dangerouslySetInnerHTML={{ __html: renderMessageHtml(userDraftStep8) }} />
                  </div>
                ) : null;

                return (
                  <div key={`personal-step-${step}`} className="card">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                      <h3 style={{ margin: 0 }}>
                        Step {step} {stepName ? `- ${stepName}` : ""}
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
                        <hr style={{ border: 0, borderTop: "1px solid var(--line-soft)", margin: "10px 0" }} />
                        {stepMessages.map((message) => (
                          <div key={message.id} style={{ borderTop: "1px solid var(--line-soft)", padding: "8px 0" }}>
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
                        {step8Block}
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
