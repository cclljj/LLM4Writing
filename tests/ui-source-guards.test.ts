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

test("source-guard: learning management renders course diagnostics status", async () => {
  const uiSrc = await read("../app/teacher/_components/LearningMonitorTab.tsx");
  const routeSrc = await read("../app/api/teacher/course-diagnostics/route.ts");
  assert.ok(uiSrc.includes("課程診斷摘要"), "learning management should render a course diagnostics card");
  assert.ok(uiSrc.includes("/api/teacher/course-diagnostics?activityId="), "learning management should load course diagnostics by activity");
  assert.ok(uiSrc.includes("Fallback"), "course diagnostics UI should surface fallback stats");
  assert.ok(uiSrc.includes("拒答"), "course diagnostics UI should surface rejection stats");
  assert.ok(uiSrc.includes("每步平均停留時間"), "course diagnostics UI should surface step dwell-time stats");
  assert.ok(routeSrc.includes("getUsersVisibleToTeacherStore"), "course diagnostics route should enforce teacher visibility scope");
  assert.ok(routeSrc.includes("isSessionInActivityGroupScope"), "course diagnostics route should scope sessions to the activity groups");
});
