import test from "node:test";
import assert from "node:assert/strict";
import { resolveStudentReportCompletedAtIso } from "../src/lib/course-report-completion-time";
import { shouldTreatAsZipDownload } from "../src/lib/course-report-download";
import { buildCourseReportTimelineItems, injectStep8DraftTimeline } from "../src/lib/course-report-pdf-timeline";
import { getDownloadBuffer, type ExportJob } from "../src/lib/course-report-export";

function makeJob(overrides: Partial<ExportJob> = {}): ExportJob {
  return {
    id: "exp_1",
    ownerUsername: "teacher1",
    ownerRole: "teacher",
    activityId: "oc-001",
    classNumber: "701",
    school: "DemoSchool",
    totalStudents: 2,
    completedStudents: 2,
    failedStudents: 0,
    currentStudent: "",
    currentAttempt: 0,
    maxAttempts: 3,
    status: "succeeded",
    zipFileName: "oc-001_701_course-report-v1.zip",
    downloadToken: "token_1",
    createdAt: "2026-05-26T00:00:00.000Z",
    startedAt: "2026-05-26T00:00:01.000Z",
    updatedAt: "2026-05-26T00:00:02.000Z",
    cancelRequested: false,
    zipBase64: Buffer.from("zip-content").toString("base64"),
    ...overrides,
  };
}

test("zip download guard behavior: only OK + zip content-type is downloadable", () => {
  assert.equal(shouldTreatAsZipDownload({ ok: true, contentType: "application/zip" }), true);
  assert.equal(shouldTreatAsZipDownload({ ok: true, contentType: "application/zip; charset=binary" }), true);
  assert.equal(shouldTreatAsZipDownload({ ok: true, contentType: "application/json" }), false);
  assert.equal(shouldTreatAsZipDownload({ ok: false, contentType: "application/zip" }), false);
});

test("class ZIP export behavior: getDownloadBuffer returns only for succeeded jobs with zip payload", () => {
  const okJob = makeJob();
  const buf = getDownloadBuffer(okJob);
  assert.ok(buf instanceof Buffer);
  assert.equal(buf?.toString("utf8"), "zip-content");

  const nonSucceeded = makeJob({ status: "failed" });
  assert.equal(getDownloadBuffer(nonSucceeded), null);

  const noPayload = makeJob({ zipBase64: undefined });
  assert.equal(getDownloadBuffer(noPayload), null);
});

test("step8 timeline injection behavior: include/skip by content and duplication", () => {
  const base = [{ role: "student", step: 8, text: "原本內容", at: "2026-05-26T10:00:00.000Z" }];
  const injected = injectStep8DraftTimeline(base, "這是 Step8 最終稿", "2026-05-26T10:01:00.000Z");
  assert.equal(injected.length, 2);
  assert.equal(injected[1]?.step, 8);
  assert.ok(injected[1]?.text.includes("步驟八最終稿"));

  const duplicated = injectStep8DraftTimeline(base, "原本內容", "2026-05-26T10:01:00.000Z");
  assert.equal(duplicated.length, 1);

  const empty = injectStep8DraftTimeline(base, "   ", "2026-05-26T10:01:00.000Z");
  assert.equal(empty.length, 1);
});

test("step8 timeline injection behavior: inserts final draft before Step9+ messages", () => {
  const base = [
    { role: "student", step: 8, text: "原本 Step8", at: "2026-05-26T10:00:00.000Z" },
    { role: "system", step: 9, text: "Step9 反思題", at: "2026-05-26T10:01:00.000Z" },
    { role: "student", step: 9, text: "Step9 回答", at: "2026-05-26T10:02:00.000Z" },
  ];
  const injected = injectStep8DraftTimeline(base, "這是 Step8 最終稿", "2026-05-26T10:03:00.000Z");
  assert.deepEqual(injected.map((message) => message.step), [8, 8, 9, 9]);
  assert.ok(injected[1]?.text.includes("步驟八最終稿"));
});

test("course report timeline behavior: groups repeated step messages into one section order", () => {
  const items = buildCourseReportTimelineItems({
    messages: [
      { role: "system", step: 9, text: "Step9 第一則", at: "2026-05-26T10:00:00.000Z" },
      { role: "ai", step: 10, text: "Step10 報告", at: "2026-05-26T10:01:00.000Z" },
      { role: "student", step: 9, text: "Step9 第二則", at: "2026-05-26T10:02:00.000Z" },
    ],
    hasStep3Outline: true,
    hasStep4Outline: false,
  });

  assert.deepEqual(
    items.map((item) => item.type === "outline" ? `outline:${item.step}` : `message:${item.msg.step}:${item.msg.text}`),
    ["outline:3", "message:9:Step9 第一則", "message:9:Step9 第二則", "message:10:Step10 報告"]
  );
});

test("course report timeline behavior: normalizes runtime step strings before ordering", () => {
  const items = buildCourseReportTimelineItems({
    messages: [
      { role: "ai", step: "Step 10" as unknown as number, text: "Step10 報告", at: "2026-05-26T10:00:00.000Z" },
      { role: "system", step: "8" as unknown as number, text: "Step8 最終稿", at: "2026-05-26T10:01:00.000Z" },
      { role: "student", step: "9" as unknown as number, text: "Step9 反思", at: "2026-05-26T10:02:00.000Z" },
    ],
    hasStep3Outline: false,
    hasStep4Outline: false,
  });

  assert.deepEqual(
    items.map((item) => item.type === "message" ? `${item.msg.step}:${item.msg.text}` : `outline:${item.step}`),
    ["8:Step8 最終稿", "9:Step9 反思", "10:Step10 報告"]
  );
});

test("step8 timeline injection behavior: runtime step strings still insert before Step9+", () => {
  const injected = injectStep8DraftTimeline(
    [
      { role: "ai", step: "Step 10" as unknown as number, text: "Step10 報告", at: "2026-05-26T10:00:00.000Z" },
      { role: "student", step: "Step 9" as unknown as number, text: "Step9 反思", at: "2026-05-26T10:01:00.000Z" },
    ],
    "Step8 最終稿",
    "2026-05-26T10:02:00.000Z"
  );

  assert.deepEqual(injected.map((message) => String(message.step)), ["8", "Step 10", "Step 9"]);
});

test("course report completion time prefers the student's Step10 completion message", () => {
  const completedAt = resolveStudentReportCompletedAtIso({
    username: "alice",
    courseEndedAt: "2026-05-26T12:00:00.000Z",
    legacyFallbackAt: "2026-05-26T11:00:00.000Z",
    messages: [
      { role: "ai", userId: "alice", step: 8, text: "Step8", at: "2026-05-26T09:00:00.000Z" },
      { role: "ai", userId: "bob", step: 10, text: "Bob Step10", at: "2026-05-26T09:30:00.000Z" },
      { role: "ai", userId: "alice", step: "Step 10", text: "Alice Step10", at: "2026-05-26T10:00:00.000Z" },
    ],
  });

  assert.equal(completedAt, "2026-05-26T10:00:00.000Z");
});

test("course report completion time falls back to course ended time, then legacy activity time", () => {
  const courseEndedAt = resolveStudentReportCompletedAtIso({
    username: "alice",
    courseEndedAt: "2026-05-26T12:00:00.000Z",
    legacyFallbackAt: "2026-05-26T11:00:00.000Z",
    messages: [
      { role: "student", userId: "alice", step: 10, text: "我看到報告了", at: "2026-05-26T10:00:00.000Z" },
    ],
  });
  assert.equal(courseEndedAt, "2026-05-26T12:00:00.000Z");

  const legacyFallbackAt = resolveStudentReportCompletedAtIso({
    username: "alice",
    legacyFallbackAt: "2026-05-26T11:00:00.000Z",
    messages: [],
  });
  assert.equal(legacyFallbackAt, "2026-05-26T11:00:00.000Z");
});
