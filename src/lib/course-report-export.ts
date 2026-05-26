import JSZip from "jszip";
import { SessionState } from "@/src/lib/types";
import { getAllActivities, hydrateDomainState } from "@/src/lib/activity-store";
import { getSession, listMonitorSessionSummariesByActivityId } from "@/src/lib/store";
import { getUsersVisibleToTeacherStore, listUsersStore } from "@/src/lib/user-store";
import { isSessionInActivityGroupScope } from "@/src/lib/monitor-session-scope";
import { generateCourseImplementationPdfBytes, type CourseImplementationPdfInput } from "@/src/lib/courseImplementationPdf";
import { recordAuditLog } from "@/src/lib/audit-log-store";

export type ExportJobStatus = "queued" | "running" | "retrying" | "packaging" | "succeeded" | "failed" | "canceled";

export type ExportJob = {
  id: string;
  ownerUsername: string;
  ownerRole: "teacher" | "admin";
  activityId: string;
  classNumber: string;
  school: string;
  totalStudents: number;
  completedStudents: number;
  failedStudents: number;
  currentStudent: string;
  currentAttempt: number;
  maxAttempts: number;
  status: ExportJobStatus;
  zipFileName: string;
  downloadToken: string;
  createdAt: string;
  startedAt: string;
  updatedAt: string;
  finishedAt?: string;
  error?: string;
  cancelRequested: boolean;
  zipBase64?: string;
};

type ExportJobStore = {
  jobs: Map<string, ExportJob>;
  dedupeMap: Map<string, string>;
};

const STORE_KEY = "__llm4writing_course_report_export_jobs__";
const MAX_ATTEMPTS = 3;
const MAX_CONCURRENCY = 3;
const DOWNLOAD_TTL_MS = 24 * 60 * 60 * 1000;

function store(): ExportJobStore {
  const g = globalThis as unknown as Record<string, ExportJobStore | undefined>;
  if (!g[STORE_KEY]) {
    g[STORE_KEY] = { jobs: new Map(), dedupeMap: new Map() };
  }
  return g[STORE_KEY]!;
}

function nowIso(): string {
  return new Date().toISOString();
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableError(message: string): boolean {
  return message === "pdf_font_load_failed" || message === "personal_progress_failed" || message === "report_pdf_generate_failed";
}

function sanitizeFilename(value: string): string {
  return value.replace(/[\\/:*?"<>|]/g, "_").replace(/\s+/g, "_").trim();
}

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

function buildStarRationales(metric: {
  stars: number;
  maxStep: number;
  messageCount: number;
  rejectedCount: number;
  step3OutlineChars: number;
  draftStep6Chars: number;
  joined: boolean;
}): string[] {
  const reasons: string[] = [];
  reasons.push("基礎分：1 星。");
  if (metric.joined || metric.messageCount > 0) reasons.push("有加入/互動紀錄（+1）。");
  if (metric.maxStep >= 4) reasons.push("完成到 Step 4（+1）。");
  if (metric.maxStep >= 8) reasons.push("完成到 Step 8（+1）。");
  if (metric.maxStep >= 10) reasons.push("完成到 Step 10（+1）。");
  if (metric.step3OutlineChars >= 60) reasons.push("Step3 結構樹內容充足（>=60 字，+1）。");
  if (metric.draftStep6Chars < 80 && metric.maxStep >= 6) reasons.push("Step6 初稿偏短（<80 字，-1）。");
  if (metric.rejectedCount >= 3) reasons.push("回答品質拒答次數偏高（>=3 次，-1）。");
  reasons.push(`最終星等：${renderStars(metric.stars)}。`);
  return reasons;
}

async function resolveExportInput(
  owner: { username: string; role: "teacher" | "admin" },
  activityId: string,
  classNumber: string
): Promise<{
  school: string;
  title: string;
  students: Array<{
    username: string;
    name: string;
    metric: {
      stars: number;
      stepText: string;
      maxStep: number;
      messageCount: number;
      rejectedCount: number;
      step3OutlineChars: number;
      draftStep6Chars: number;
      joined: boolean;
    };
    sessionId: string;
  }>;
}> {
  await hydrateDomainState();
  const baseActivities = getAllActivities();
  const visibleUsers = owner.role === "admin" ? await listUsersStore() : await getUsersVisibleToTeacherStore(owner.username);
  const visibleStudents = visibleUsers.filter((u) => u.role === "student");
  const visibleClasses = new Set(visibleStudents.map((u) => `${u.school}::${u.classNumber ?? ""}`));
  const visibleActivities =
    owner.role === "admin"
      ? baseActivities
      : baseActivities.filter((activity) => visibleClasses.has(`${activity.school}::${activity.classNumber}`));
  const activity = visibleActivities.find((a) => a.id === activityId && a.classNumber === classNumber);
  if (!activity) throw new Error("forbidden_activity");

  const studentsInCourse = visibleStudents
    .filter((user) => user.school === activity.school && user.classNumber === activity.classNumber)
    .sort((a, b) => a.username.localeCompare(b.username, "zh-Hant"));
  const { sessions } = await listMonitorSessionSummariesByActivityId(activityId, { limit: 500, offset: 0 });
  const scopedSessions = sessions.filter((s) => isSessionInActivityGroupScope(s, activity));

  const students = studentsInCourse
    .map((student) => {
      const matched = scopedSessions.filter((session) => session.participants.includes(student.username));
      const primary = matched
        .slice()
        .sort((a, b) => {
          const aAt = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
          const bAt = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
          return bAt - aAt;
        })[0];
      if (!primary?.sessionId) return null;

      let maxStep = 0;
      let messageCount = 0;
      let rejectedCount = 0;
      let step3OutlineChars = 0;
      let draftStep6Chars = 0;
      let joined = false;
      for (const session of matched) {
        const personalStep = session.personalSteps?.[student.username] ?? session.currentStep;
        maxStep = Math.max(maxStep, personalStep);
        const ownMessageCount = session.studentMessageStats?.[student.username]?.count ?? 0;
        messageCount += ownMessageCount;
        if ((session.joinedUsers ?? []).includes(student.username) || ownMessageCount > 0) joined = true;
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
      return {
        username: student.username,
        name: student.name || student.username,
        sessionId: primary.sessionId,
        metric: {
          stars,
          stepText: formatStepText(maxStep),
          maxStep,
          messageCount,
          rejectedCount,
          step3OutlineChars,
          draftStep6Chars,
          joined,
        }
      };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row));

  return { school: activity.school, title: activity.title, students };
}

function toTimelineMessages(session: SessionState, username: string): CourseImplementationPdfInput["timelineMessages"] {
  return session.messages
    .filter((message) => {
      if (!message.text?.trim()) return false;
      if (message.role === "student") return message.userId === username;
      if (message.role === "ai") return !message.userId || message.userId === username;
      if (message.role === "system") return !message.userId || message.userId === username;
      return false;
    })
    .map((message) => ({ role: message.role, step: message.step, text: message.text, at: message.at }));
}

function injectStep8DraftTimeline(
  timelineMessages: CourseImplementationPdfInput["timelineMessages"],
  step8DraftRaw: string
): CourseImplementationPdfInput["timelineMessages"] {
  const step8Draft = (step8DraftRaw ?? "").trim();
  if (!step8Draft) return timelineMessages;
  const duplicated = timelineMessages.some((message) => message.step === 8 && message.text.trim() === step8Draft);
  if (duplicated) return timelineMessages;
  const anchorAt = timelineMessages[timelineMessages.length - 1]?.at ?? nowIso();
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

async function generateStudentPdfBytes(input: {
  activityId: string;
  school: string;
  classNumber: string;
  title: string;
  username: string;
  name: string;
  sessionId: string;
  metric: {
    stars: number;
    stepText: string;
    maxStep: number;
    messageCount: number;
    rejectedCount: number;
    step3OutlineChars: number;
    draftStep6Chars: number;
    joined: boolean;
  };
}): Promise<Uint8Array> {
  const session = await getSession(input.sessionId);
  if (!session) throw new Error("session_not_found");
  const timelineMessages = injectStep8DraftTimeline(
    toTimelineMessages(session, input.username),
    session.draftStep8?.[input.username] ?? ""
  );
  const step3SubmittedOutline = session.step3SubmittedOutlines?.[input.username] ?? "";
  const step4RevisedOutline = session.outlines?.[input.username] ?? "";
  const completedAtIso = session.messages
    .filter((message) => message.userId === input.username || (!message.userId && (message.role === "ai" || message.role === "system")))
    .at(-1)?.at;
  const payload: CourseImplementationPdfInput = {
    activityId: input.activityId,
    school: input.school,
    classNumber: input.classNumber,
    title: input.title,
    username: input.username,
    name: input.name,
    metric: input.metric,
    starLabel: renderStars(input.metric.stars),
    starRationales: buildStarRationales(input.metric),
    timelineMessages,
    step3SubmittedOutline,
    step4RevisedOutline,
    generatedAtIso: nowIso(),
    completedAtIso,
  };
  return generateCourseImplementationPdfBytes(payload);
}

async function runPool(tasks: Array<() => Promise<void>>, concurrency: number): Promise<void> {
  let index = 0;
  const workers = Array.from({ length: Math.max(1, concurrency) }, async () => {
    while (index < tasks.length) {
      const current = index;
      index += 1;
      await tasks[current]!();
    }
  });
  await Promise.all(workers);
}

function cleanupExpiredJobs(): void {
  const s = store();
  const now = Date.now();
  for (const [id, job] of s.jobs.entries()) {
    const updated = new Date(job.updatedAt).getTime();
    if (Number.isFinite(updated) && now - updated > DOWNLOAD_TTL_MS) {
      s.jobs.delete(id);
    }
  }
}

export function listJobsByOwner(ownerUsername: string): ExportJob[] {
  cleanupExpiredJobs();
  return Array.from(store().jobs.values())
    .filter((job) => job.ownerUsername === ownerUsername)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function getJob(jobId: string): ExportJob | null {
  cleanupExpiredJobs();
  return store().jobs.get(jobId) ?? null;
}

export function requestCancelJob(jobId: string, ownerUsername: string): ExportJob | null {
  const job = store().jobs.get(jobId);
  if (!job || job.ownerUsername !== ownerUsername) return null;
  if (job.status === "queued" || job.status === "running" || job.status === "retrying" || job.status === "packaging") {
    job.cancelRequested = true;
    job.updatedAt = nowIso();
  }
  return job;
}

export function getDownloadBuffer(job: ExportJob): Buffer | null {
  if (job.status !== "succeeded" || !job.zipBase64) return null;
  return Buffer.from(job.zipBase64, "base64");
}

export async function createExportJob(input: {
  ownerUsername: string;
  ownerRole: "teacher" | "admin";
  activityId: string;
  classNumber: string;
}): Promise<ExportJob> {
  cleanupExpiredJobs();
  const dedupeKey = `${input.ownerUsername}::${input.activityId}::${input.classNumber}`;
  const s = store();
  const existingId = s.dedupeMap.get(dedupeKey);
  if (existingId) {
    const existing = s.jobs.get(existingId);
    if (existing && ["queued", "running", "retrying", "packaging"].includes(existing.status)) {
      throw new Error("export_already_running");
    }
  }

  const bootstrap = await resolveExportInput(
    { username: input.ownerUsername, role: input.ownerRole },
    input.activityId,
    input.classNumber
  );
  if (bootstrap.students.length === 0) throw new Error("no_students_with_records");

  const id = `exp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const zipFileName = `${sanitizeFilename(input.activityId)}_${sanitizeFilename(input.classNumber)}_course-report-v1.zip`;
  const job: ExportJob = {
    id,
    ownerUsername: input.ownerUsername,
    ownerRole: input.ownerRole,
    activityId: input.activityId,
    classNumber: input.classNumber,
    school: bootstrap.school,
    totalStudents: bootstrap.students.length,
    completedStudents: 0,
    failedStudents: 0,
    currentStudent: "",
    currentAttempt: 0,
    maxAttempts: MAX_ATTEMPTS,
    status: "queued",
    zipFileName,
    downloadToken: `${id}_${Math.random().toString(36).slice(2, 10)}`,
    createdAt: nowIso(),
    startedAt: "",
    updatedAt: nowIso(),
    cancelRequested: false,
  };
  s.jobs.set(id, job);
  s.dedupeMap.set(dedupeKey, id);

  void recordAuditLog({
    actorUsername: input.ownerUsername,
    actorRole: input.ownerRole,
    action: "course_report_export_start",
    targetType: "activity_class",
    targetId: `${input.activityId}::${input.classNumber}`,
    targetLabel: `${bootstrap.school}/${input.classNumber}/${input.activityId}`,
    details: { jobId: id, totalStudents: bootstrap.students.length }
  }).catch(() => undefined);

  void runExportJob(job.id, bootstrap).catch(() => undefined);
  return job;
}

async function runExportJob(jobId: string, bootstrap: Awaited<ReturnType<typeof resolveExportInput>>): Promise<void> {
  const s = store();
  const job = s.jobs.get(jobId);
  if (!job) return;
  job.status = "running";
  job.startedAt = nowIso();
  job.updatedAt = nowIso();

  const zip = new JSZip();
  let failed = false;
  const tasks = bootstrap.students.map((student) => async () => {
    if (job.cancelRequested) return;
    job.currentStudent = student.username;
    job.currentAttempt = 0;
    job.status = "running";
    job.updatedAt = nowIso();
    let success = false;
    let lastError = "";
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      if (job.cancelRequested) return;
      job.currentAttempt = attempt;
      job.status = attempt > 1 ? "retrying" : "running";
      job.updatedAt = nowIso();
      try {
        const bytes = await generateStudentPdfBytes({
          activityId: job.activityId,
          school: bootstrap.school,
          classNumber: job.classNumber,
          title: bootstrap.title,
          username: student.username,
          name: student.name,
          sessionId: student.sessionId,
          metric: student.metric,
        });
        const fileName = `${sanitizeFilename(job.activityId)}_${sanitizeFilename(job.classNumber)}_${sanitizeFilename(student.username)}_course-report-v1.pdf`;
        zip.file(fileName, bytes);
        job.completedStudents += 1;
        job.updatedAt = nowIso();
        success = true;
        break;
      } catch (error) {
        lastError = error instanceof Error ? error.message : "report_pdf_generate_failed";
        const retryable = isRetryableError(lastError);
        if (!retryable || attempt >= MAX_ATTEMPTS) break;
        await wait(400 * attempt);
      }
    }
    if (!success) {
      failed = true;
      job.failedStudents += 1;
      job.error = lastError || "report_pdf_generate_failed";
      job.updatedAt = nowIso();
    }
  });

  await runPool(tasks, MAX_CONCURRENCY);
  if (job.cancelRequested) {
    job.status = "canceled";
    job.finishedAt = nowIso();
    job.updatedAt = nowIso();
    return;
  }
  if (failed || job.failedStudents > 0) {
    job.status = "failed";
    job.finishedAt = nowIso();
    job.updatedAt = nowIso();
    void recordAuditLog({
      actorUsername: job.ownerUsername,
      actorRole: job.ownerRole,
      action: "course_report_export_failed",
      targetType: "activity_class",
      targetId: `${job.activityId}::${job.classNumber}`,
      targetLabel: `${job.school}/${job.classNumber}/${job.activityId}`,
      details: { jobId: job.id, completedStudents: job.completedStudents, failedStudents: job.failedStudents, error: job.error ?? "" }
    }).catch(() => undefined);
    return;
  }

  job.status = "packaging";
  job.updatedAt = nowIso();
  const zipBytes = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE", compressionOptions: { level: 6 } });
  job.zipBase64 = Buffer.from(zipBytes).toString("base64");
  job.status = "succeeded";
  job.finishedAt = nowIso();
  job.updatedAt = nowIso();
  job.currentAttempt = 0;
  void recordAuditLog({
    actorUsername: job.ownerUsername,
    actorRole: job.ownerRole,
    action: "course_report_export_succeeded",
    targetType: "activity_class",
    targetId: `${job.activityId}::${job.classNumber}`,
    targetLabel: `${job.school}/${job.classNumber}/${job.activityId}`,
    details: { jobId: job.id, totalStudents: job.totalStudents }
  }).catch(() => undefined);
}
