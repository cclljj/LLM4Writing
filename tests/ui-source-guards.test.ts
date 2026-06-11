import test from "node:test";
import assert from "node:assert/strict";

async function read(relativePath: string): Promise<string> {
  const { readFileSync } = await import("node:fs");
  const { resolve, dirname } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const thisDir = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(thisDir, relativePath), "utf8");
}

test("source-guard: student course-history page includes Step6/7/8/10 latestWork artifacts", async () => {
  const src = await read("../app/student/history/[activityId]/page.tsx");
  assert.ok(src.includes("history.latestWork.draftStep6"), "history page should include Step6 draft artifact");
  assert.ok(src.includes("history.latestWork.step7Report"), "history page should include Step7 report artifact");
  assert.ok(src.includes("history.latestWork.draftStep8"), "history page should include Step8 draft artifact");
  assert.ok(src.includes("history.latestWork.step10Report"), "history page should include Step10 report artifact");
});

test("source-guard: monitor route includes outlines and step3SubmittedOutlines fields", async () => {
  const src = await read("../app/api/teacher/monitor/route.ts");
  assert.ok(src.includes("outlines:"), "monitor route must include outlines field");
  assert.ok(src.includes("step3SubmittedOutlines:"), "monitor route must include step3SubmittedOutlines field");
});

test("source-guard: personal-progress route includes outline + step8 artifact fields", async () => {
  const src = await read("../app/api/teacher/personal-progress/route.ts");
  assert.ok(src.includes("userOutline:"), "personal-progress route must include userOutline field");
  assert.ok(src.includes("userStep3SubmittedOutline:"), "personal-progress route must include userStep3SubmittedOutline field");
  assert.ok(src.includes("userDraftStep8:"), "personal-progress route must include userDraftStep8 field");
});

test("source-guard: monitor session type includes outline fields", async () => {
  const src = await read("../app/teacher/_components/types.ts");
  assert.ok(src.includes("outlines?: Record<string, string>"), "MonitorSession type must include outlines field");
  assert.ok(src.includes("step3SubmittedOutlines?: Record<string, string>"), "MonitorSession type must include step3SubmittedOutlines field");
});

test("source-guard: learning monitor uses outline labels and participant mapping", async () => {
  const src = await read("../app/teacher/_components/LearningMonitorTab.tsx");
  assert.ok(src.includes("步驟三完成結構樹"), "learning monitor should render step3 submitted outline label");
  assert.ok(src.includes("步驟四對比修正後"), "learning monitor should render step4 revised outline label");
  assert.ok(
    src.includes("step3SubmittedOutlines?.[p]") || src.includes("step3SubmittedOutlines?.[participant]"),
    "learning monitor should read per-participant step3 submitted outlines"
  );
  assert.ok(
    src.includes("outlines?.[p]") || src.includes("outlines?.[participant]"),
    "learning monitor should read per-participant revised outlines"
  );
  assert.ok(src.includes("setUserOutline"), "learning monitor should track userOutline state updates");
  assert.ok(src.includes("setUserStep3SubmittedOutline"), "learning monitor should track userStep3SubmittedOutline state updates");
});

test("source-guard: student route keeps classroom bootstrap failures recoverable", async () => {
  const src = await read("../app/student/page.tsx");
  assert.ok(src.includes("fetchStudentJson"), "student page should use a retrying JSON fetch helper");
  assert.ok(src.includes("STUDENT_FETCH_TIMEOUT_MS"), "student page should bound classroom bootstrap fetches with a timeout");
  assert.ok(src.includes("StudentFetchError"), "student page should classify retryable student fetch failures");
  assert.ok(src.includes("setAuthError(getStudentRetryableMessage(\"auth\"))"), "auth bootstrap failures should show recoverable UI");
  assert.ok(src.includes("error.status === 401"), "only confirmed unauthenticated auth responses should redirect to login");
  assert.ok(src.includes("重新確認登入"), "student page should expose a retry action when auth bootstrap is transiently unavailable");
  assert.ok(src.includes("重新整理課程清單"), "student overview failures should expose a retry action");
});

test("source-guard: student session polling uses adaptive backoff helpers", async () => {
  const src = await read("../app/student/page.tsx");
  const pollingHelper = await read("../src/lib/student-session-polling.ts");
  assert.ok(src.includes("resolveStudentSessionNextPollDelay"), "student session polling should resolve adaptive delays");
  assert.ok(src.includes("computeStudentSessionPayloadHash"), "student session polling should hash payload changes");
  assert.ok(src.includes("window.setTimeout(tick"), "student session polling should schedule a timeout loop");
  assert.ok(!src.includes("fetch(`/api/session/${sessionId}`, { headers })\n        .then"), "student session polling should not use the old fixed interval promise chain");
  assert.ok(pollingHelper.includes("Pick<SessionState"), "student polling hash input should be derived from SessionState");
  assert.ok(pollingHelper.includes("STUDENT_SESSION_MAX_POLL_MS = 30000"), "student session polling should cap quiet-period backoff at 30s");
});

test("source-guard: heavy student panels are memoized", async () => {
  const interaction = await read("../app/student/_components/InteractionPanel.tsx");
  const step68 = await read("../app/student/_components/Step68Panel.tsx");
  const history = await read("../app/student/_components/HistoryReview.tsx");
  assert.ok(interaction.includes("export default memo(InteractionPanel)"), "InteractionPanel should be memoized");
  assert.ok(step68.includes("export default memo(Step68Panel)"), "Step68Panel should be memoized");
  assert.ok(history.includes("export default memo(HistoryReview)"), "HistoryReview should be memoized");
});

test("source-guard: teacher/admin route keeps management bootstrap failures recoverable", async () => {
  const teacherSrc = await read("../app/teacher/page.tsx");
  const adminSrc = await read("../app/admin/page.tsx");
  const helperSrc = await read("../src/lib/client-retry-fetch.ts");
  assert.ok(adminSrc.includes("@/app/teacher/page"), "admin should continue to share teacher/admin bootstrap logic");
  assert.ok(teacherSrc.includes("fetchJsonWithRetry<AuthMeResponse>"), "teacher/admin auth bootstrap should use retrying JSON fetch");
  assert.ok(teacherSrc.includes("error.status === 401"), "teacher/admin bootstrap should redirect only after explicit unauthenticated status");
  assert.ok(teacherSrc.includes("getManagementRetryableMessage(\"auth\")"), "teacher/admin auth failures should show recoverable UI");
  assert.ok(teacherSrc.includes("getManagementRetryableMessage(\"data\")"), "teacher/admin data failures should be user-actionable");
  assert.ok(teacherSrc.includes("重新確認登入"), "teacher/admin auth failure UI should expose a retry action");
  assert.ok(teacherSrc.includes("重新整理"), "teacher/admin data failure UI should expose a retry action");
  assert.ok(helperSrc.includes("CLIENT_FETCH_TIMEOUT_MS"), "shared client fetch helper should bound requests with a timeout");
  assert.ok(helperSrc.includes("status === 429 || error.status >= 500"), "shared client fetch helper should retry transient HTTP failures");
});

test("source-guard: app router has user-facing fallback surfaces and production metadata", async () => {
  const layoutSrc = await read("../app/layout.tsx");
  const errorSrc = await read("../app/error.tsx");
  const loadingSrc = await read("../app/loading.tsx");
  const notFoundSrc = await read("../app/not-found.tsx");
  const globalsSrc = await read("../app/globals.css");
  assert.ok(layoutSrc.includes("LLM4Writing 寫作學習平台"), "root metadata should use the production-facing product name");
  assert.ok(!layoutSrc.includes("Vercel Native"), "metadata should not expose internal deployment wording");
  assert.ok(!layoutSrc.includes("rewrite"), "metadata should not expose rewrite wording");
  assert.ok(errorSrc.includes("頁面暫時無法顯示"), "app error boundary should show a recoverable message");
  assert.ok(loadingSrc.includes("正在載入"), "app loading boundary should show loading feedback");
  assert.ok(notFoundSrc.includes("找不到這個頁面"), "app not-found boundary should show a friendly not-found page");
  assert.ok(globalsSrc.includes(":focus-visible"), "global CSS should provide visible keyboard focus styling");
});

test("source-guard: design system primitives cover buttons, tables, and tablet breakpoints", async () => {
  const globalsSrc = await read("../app/globals.css");
  const teacherSrc = await read("../app/teacher/_components/LearningMonitorTab.tsx");
  const accountSrc = await read("../app/teacher/_components/StudentAccountTab.tsx");
  assert.ok(globalsSrc.includes("button {\n  width: auto;"), "buttons should default to content width");
  assert.ok(globalsSrc.includes(".full-width"), "full-width controls should be opt-in via utility class");
  assert.ok(globalsSrc.includes(".table-scroll"), "table scroll wrappers should use a reusable class");
  assert.ok(globalsSrc.includes("@media (max-width: 1024px)"), "tablet landscape breakpoint should be present");
  assert.ok(globalsSrc.includes("@media (max-width: 768px)"), "tablet portrait breakpoint should be present");
  assert.ok(teacherSrc.includes("className=\"table-scroll\""), "learning monitor tables should use table-scroll class");
  assert.ok(accountSrc.includes("className=\"table-scroll\""), "account tables should use table-scroll class");
});

test("source-guard: destructive actions use explicit confirmation dialogs", async () => {
  const confirmSrc = await read("../app/teacher/_components/ConfirmDialog.tsx");
  const accountSrc = await read("../app/teacher/_components/StudentAccountTab.tsx");
  const courseSrc = await read("../app/teacher/_components/CourseManagementTab.tsx");
  const monitorSrc = await read("../app/teacher/_components/LearningMonitorTab.tsx");
  const combined = `${accountSrc}\n${courseSrc}\n${monitorSrc}`;
  assert.ok(confirmSrc.includes("requiredText"), "confirmation dialog should support typed confirmation");
  assert.ok(accountSrc.includes("requiredText={deleteUserTarget?.username}"), "account deletion should require typing the username");
  assert.ok(courseSrc.includes("requiredText={deleteTaskTarget?.essayTitle}"), "task deletion should require typing the task title");
  assert.ok(monitorSrc.includes("requiredText={pendingDeleteActivity?.title}"), "course-data deletion should require typing the course title");
  assert.ok(!combined.includes("window.confirm"), "destructive UI flows should not use native confirm");
});

test("source-guard: learning management renders course diagnostics status", async () => {
  const uiSrc = await read("../app/teacher/_components/LearningMonitorTab.tsx");
  const panelSrc = await read("../app/teacher/_components/CourseDiagnosticsPanel.tsx");
  const routeSrc = await read("../app/api/teacher/course-diagnostics/route.ts");
  assert.ok(uiSrc.includes("CourseDiagnosticsPanel"), "learning management should delegate course diagnostics rendering");
  assert.ok(panelSrc.includes("課程診斷摘要"), "course diagnostics panel should render a course diagnostics card");
  assert.ok(uiSrc.includes("/api/teacher/course-diagnostics?activityId="), "learning management should load course diagnostics by activity");
  assert.ok(panelSrc.includes("Fallback"), "course diagnostics UI should surface fallback stats");
  assert.ok(panelSrc.includes("拒答"), "course diagnostics UI should surface rejection stats");
  assert.ok(panelSrc.includes("每步平均停留時間"), "course diagnostics UI should surface step dwell-time stats");
  assert.ok(panelSrc.includes("session.runId"), "course diagnostics UI should render grouped run rows");
  assert.ok(panelSrc.includes("session.sessionIds.length"), "course diagnostics UI should expose aggregated session count per run");
  assert.ok(uiSrc.includes("pagedCourseDiagnosticsRows"), "course diagnostics UI should paginate grouped run rows");
  assert.ok(panelSrc.includes("每頁 10 列"), "course diagnostics pagination should disclose the 10-row page size");
  assert.ok(panelSrc.includes("export default memo(CourseDiagnosticsPanel)"), "course diagnostics panel should be memoized");
  assert.ok(routeSrc.includes("getUsersVisibleToTeacherStore"), "course diagnostics route should enforce teacher visibility scope");
  assert.ok(routeSrc.includes("isSessionInActivityGroupScope"), "course diagnostics route should scope sessions to the activity groups");
});

test("source-guard: research export is scoped, ended-only, and audited", async () => {
  const routeSrc = await read("../app/api/teacher/research-export/route.ts");
  const uiSrc = await read("../app/teacher/_components/CourseImplementationReportTab.tsx");
  assert.ok(routeSrc.includes("isSessionInActivityGroupScope"), "research export should enforce activity group scope");
  assert.ok(routeSrc.includes("course_not_ended"), "research export should reject non-ended courses");
  assert.ok(routeSrc.includes("recordAuditLog"), "research export should write an audit log");
  assert.ok(routeSrc.includes("research_data_export"), "research export audit action should be explicit");
  assert.ok(uiSrc.includes("/api/teacher/research-export?"), "course report UI should call research export API");
  assert.ok(uiSrc.includes("下載研究資料 JSON"), "course report UI should expose research JSON download");
  assert.ok(uiSrc.includes("包含學生帳號"), "course report UI should expose explicit account identity mode");
});
