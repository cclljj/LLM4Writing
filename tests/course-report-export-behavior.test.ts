import test from "node:test";
import assert from "node:assert/strict";
import { resolveStudentReportCompletedAtIso } from "../src/lib/course-report-completion-time";
import { shouldTreatAsZipDownload } from "../src/lib/course-report-download";
import { buildCourseReportTimelineItems, injectStep8DraftTimeline } from "../src/lib/course-report-pdf-timeline";
import { getDownloadBuffer, type ExportJob } from "../src/lib/course-report-export";
import { buildCourseImplementationPortfolioJson } from "../src/lib/courseImplementationPortfolioJson";

function makeJob(overrides: Partial<ExportJob> = {}): ExportJob {
  return {
    id: "exp_1",
    format: "pdf",
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
    zipFileName: "oc-001_701_course-report-v1.4.zip",
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

test("student portfolio JSON mirrors report input and masks peer accounts", () => {
  const payload = buildCourseImplementationPortfolioJson({
    activityId: "oc-001",
    school: "DemoSchool",
    classNumber: "701",
    title: "作文題目",
    username: "alice",
    name: "Alice",
    metric: {
      stars: 5,
      stepText: "Step 10",
      maxStep: 10,
      messageCount: 8,
      rejectedCount: 0,
      step3OutlineChars: 120,
      draftStep6Chars: 300,
      joined: true,
    },
    starLabel: "★★★★★",
    starRationales: ["完成到 Step 10。"],
    timelineMessages: [
      { role: "system", step: 1, text: "bob 的 Step1 提醒", at: "2026-05-26T09:40:00.000Z" },
      { role: "student", step: 2, text: "bob 的 Step2 資料", at: "2026-05-26T09:50:00.000Z" },
      { role: "student", step: 3, text: "bob 給我的提醒", at: "2026-05-26T10:00:00.000Z" },
      { role: "ai", step: 4, text: "bob 建議補上例子", at: "2026-05-26T10:10:00.000Z" },
      { role: "ai", step: 10, text: "## 總結報告\\n內容", at: "2026-05-26T10:30:00.000Z" },
    ],
    step3SubmittedOutline: "graph TD\nA[alice 原始想法]",
    step4RevisedOutline: "graph TD\nA[alice] --> B[bob 的建議]",
    step4ProcessMessages: [
      { role: "student", step: 4, text: "bob 讓我補上例子", at: "2026-05-26T10:05:00.000Z" },
    ],
    step5Report: "## Step5\nbob 的摘要",
    step6Draft: "alice 的初稿",
    step7Report: "bob 的 Step7 回饋",
    step8Draft: "alice 的潤飾稿",
    step10Report: "bob 的 Step10 總結",
    privacyPeerUsernames: ["bob"],
    generatedAtIso: "2026-05-26T11:00:00.000Z",
    completedAtIso: "2026-05-26T10:30:00.000Z",
  });

  assert.equal(payload.schemaVersion, "student-portfolio-report-v1.4");
  assert.equal(payload.reportVersion, "1.4");
  assert.equal(payload.student.username, "alice");
  assert.equal(payload.student.name, "***");
  assert.equal(JSON.stringify(payload).includes("Alice"), false);
  assert.equal(payload.course.activityId, "oc-001");
  assert.equal(payload.course.academicYear, "114");
  assert.equal(payload.course.academicYearTerm, "2");
  assert.equal(payload.course.school, "*****");
  assert.equal(payload.course.classNumber, "*****");
  assert.equal(JSON.stringify(payload).includes("DemoSchool"), false);
  assert.equal(JSON.stringify(payload).includes('"701"'), false);
  assert.equal(payload.summary.starLabel, "★★★★★");
  assert.equal(payload.timelineMessages[0]?.stepName, "審視題目");
  assert.equal(payload.timelineMessages[0]?.text, "有一位組員 的 Step1 提醒");
  assert.equal(payload.timelineMessages[0]?.entryType, "message");
  assert.equal("artifacts" in payload, false);
  assert.deepEqual(
    payload.stepArtifacts.map((artifact) => ({
      step: artifact.step,
      artifactType: artifact.artifactType,
      available: artifact.available,
      content: artifact.content,
    })),
    [
      {
        step: 1,
        artifactType: "step1_discussion",
        available: true,
        content: "### system · 2026-05-26T09:40:00.000Z\n有一位組員 的 Step1 提醒",
      },
      {
        step: 2,
        artifactType: "step2_discussion",
        available: true,
        content: "### student · 2026-05-26T09:50:00.000Z\n有一位組員 的 Step2 資料",
      },
      {
        step: 3,
        artifactType: "step3_submitted_outline",
        available: true,
        content: "graph TD\nA[alice 原始想法]",
      },
      {
        step: 4,
        artifactType: "step4_revised_outline",
        available: true,
        content: "graph TD\nA[alice] --> B[有一位組員 的建議]",
      },
      {
        step: 5,
        artifactType: "step5_summary_report",
        available: true,
        content: "## Step5\n有一位組員 的摘要",
      },
      {
        step: 6,
        artifactType: "step6_draft",
        available: true,
        content: "alice 的初稿",
      },
      {
        step: 7,
        artifactType: "step7_feedback_report",
        available: true,
        content: "有一位組員 的 Step7 回饋",
      },
      {
        step: 8,
        artifactType: "step8_revised_draft",
        available: true,
        content: "alice 的潤飾稿",
      },
      {
        step: 10,
        artifactType: "step10_final_report",
        available: true,
        content: "有一位組員 的 Step10 總結",
      },
    ]
  );
  assert.deepEqual(payload.stepArtifacts[3]?.processMessages, [
    {
      role: "student",
      step: 4,
      text: "有一位組員 讓我補上例子",
      at: "2026-05-26T10:05:00.000Z",
      stepName: "對比修正",
    },
  ]);
  assert.equal(payload.stepArtifacts[2]?.mermaid?.source, "graph TD\nA[alice 原始想法]");
  assert.equal(payload.stepArtifacts[2]?.mermaid?.fencedMarkdown, "```mermaid\ngraph TD\nA[alice 原始想法]\n```");
  assert.equal(payload.stepArtifacts[3]?.mermaid?.fencedMarkdown, "```mermaid\ngraph TD\nA[alice] --> B[有一位組員 的建議]\n```");
  assert.deepEqual(
    payload.timelineMessages
      .filter((message) => message.entryType === "artifact")
      .map((message) => ({ step: message.step, artifactType: message.artifactType, contentFormat: message.contentFormat })),
    [
      { step: 3, artifactType: "step3_submitted_outline", contentFormat: "mermaid" },
      { step: 4, artifactType: "step4_revised_outline", contentFormat: "mermaid" },
      { step: 5, artifactType: "step5_summary_report", contentFormat: "markdown" },
      { step: 6, artifactType: "step6_draft", contentFormat: "markdown" },
      { step: 7, artifactType: "step7_feedback_report", contentFormat: "markdown" },
      { step: 8, artifactType: "step8_revised_draft", contentFormat: "markdown" },
      { step: 10, artifactType: "step10_final_report", contentFormat: "markdown" },
    ]
  );
  assert.ok(payload.timelineMessages.some((message) => message.entryType === "artifact" && message.step === 3 && message.text.includes("```mermaid")));
  assert.ok(payload.timelineMessages.some((message) => message.entryType === "message" && message.step === 4 && message.text === "有一位組員 讓我補上例子"));
});

test("student portfolio JSON lists every saved learning artifact even when content is missing", () => {
  const payload = buildCourseImplementationPortfolioJson({
    activityId: "oc-001",
    school: "DemoSchool",
    classNumber: "701",
    title: "作文題目",
    username: "alice",
    name: "Alice",
    metric: {
      stars: 2,
      stepText: "Step 2",
      maxStep: 2,
      messageCount: 1,
      rejectedCount: 0,
      step3OutlineChars: 0,
      draftStep6Chars: 0,
      joined: true,
    },
    starLabel: "★★☆☆☆",
    starRationales: ["有加入/互動紀錄（+1）。"],
    timelineMessages: [],
    step3SubmittedOutline: "",
    step4RevisedOutline: "",
    privacyPeerUsernames: [],
    generatedAtIso: "2026-05-26T11:00:00.000Z",
  });

  assert.equal(payload.student.name, "***");
  assert.equal(JSON.stringify(payload).includes("Alice"), false);
  assert.equal(payload.course.school, "*****");
  assert.equal(payload.course.classNumber, "*****");
  assert.equal(JSON.stringify(payload).includes("DemoSchool"), false);
  assert.equal(JSON.stringify(payload).includes('"701"'), false);
  assert.deepEqual(
    payload.stepArtifacts.map((artifact) => ({
      step: artifact.step,
      stepName: artifact.stepName,
      contentFormat: artifact.contentFormat,
      available: artifact.available,
      content: artifact.content,
    })),
    [
      {
        step: 1,
        stepName: "審視題目",
        contentFormat: "conversation",
        available: false,
        content: "",
      },
      {
        step: 2,
        stepName: "蒐集資料",
        contentFormat: "conversation",
        available: false,
        content: "",
      },
      {
        step: 3,
        stepName: "生成論點",
        contentFormat: "mermaid",
        available: false,
        content: "",
      },
      {
        step: 4,
        stepName: "對比修正",
        contentFormat: "mermaid",
        available: false,
        content: "",
      },
      {
        step: 5,
        stepName: "摘要報告",
        contentFormat: "markdown",
        available: false,
        content: "",
      },
      {
        step: 6,
        stepName: "撰寫初稿",
        contentFormat: "markdown",
        available: false,
        content: "",
      },
      {
        step: 7,
        stepName: "分析回饋",
        contentFormat: "markdown",
        available: false,
        content: "",
      },
      {
        step: 8,
        stepName: "修改潤飾",
        contentFormat: "markdown",
        available: false,
        content: "",
      },
      {
        step: 10,
        stepName: "總結報告",
        contentFormat: "markdown",
        available: false,
        content: "",
      },
    ]
  );
  assert.equal(payload.stepArtifacts[2]?.mermaid?.fencedMarkdown, "");
  assert.equal(payload.stepArtifacts[3]?.mermaid?.fencedMarkdown, "");
  assert.equal(payload.timelineMessages.length, 0);
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
  assert.ok(injected[1]?.text.includes("最終稿"));

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
  assert.ok(injected[1]?.text.includes("最終稿"));
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

test("course report timeline behavior: configured workflow order overrides numeric step order", () => {
  const workflowSteps = [
    { step: 30, name: "先反思", mode: "personal_reflection" as const, capability: "reflection" as const },
    { step: 10, name: "再修正", mode: "personal_interaction" as const, capability: "revision" as const },
    { step: 20, name: "最後報告", mode: "non_interactive" as const, capability: "final_report" as const },
  ];
  const items = buildCourseReportTimelineItems({
    messages: [
      { role: "ai", step: 20, text: "報告", at: "2026-05-26T10:02:00.000Z" },
      { role: "system", step: 30, text: "反思", at: "2026-05-26T10:00:00.000Z" },
      { role: "student", step: 10, text: "修正稿", at: "2026-05-26T10:01:00.000Z" },
    ],
    hasStep3Outline: false,
    hasStep4Outline: false,
    workflowSteps,
  });

  assert.deepEqual(
    items.map((item) => item.type === "message" ? item.msg.step : item.step),
    [30, 10, 20]
  );
});

test("student portfolio JSON follows configured workflow order and omits deleted capabilities", () => {
  const payload = buildCourseImplementationPortfolioJson({
    activityId: "oc-001",
    school: "DemoSchool",
    classNumber: "701",
    title: "作文題目",
    username: "alice",
    name: "Alice",
    metric: {
      stars: 4,
      stepText: "Step 20",
      maxStep: 20,
      messageCount: 3,
      rejectedCount: 0,
      step3OutlineChars: 0,
      draftStep6Chars: 120,
      joined: true,
    },
    starLabel: "★★★★☆",
    starRationales: ["測試"],
    timelineMessages: [
      { role: "ai", step: 20, text: "報告", at: "2026-05-26T10:02:00.000Z" },
      { role: "system", step: 30, text: "反思", at: "2026-05-26T10:00:00.000Z" },
      { role: "student", step: 10, text: "修正稿", at: "2026-05-26T10:01:00.000Z" },
    ],
    step3SubmittedOutline: "graph TD\nA[已刪除能力，不應輸出]",
    step4RevisedOutline: "",
    step8Draft: "修正版全文",
    step10Report: "總結內容",
    workflowSteps: [
      { step: 30, name: "先反思", mode: "personal_reflection", capability: "reflection" },
      { step: 10, name: "再修正", mode: "personal_interaction", capability: "revision" },
      { step: 20, name: "最後報告", mode: "non_interactive", capability: "final_report" },
    ],
    generatedAtIso: "2026-05-26T11:00:00.000Z",
  });

  assert.deepEqual(payload.stepArtifacts.map((artifact) => artifact.artifactType), ["step8_revised_draft", "step10_final_report"]);
  assert.deepEqual(payload.stepArtifacts.map((artifact) => artifact.step), [10, 20]);
  assert.deepEqual(payload.timelineMessages.map((message) => message.step), [30, 10, 10, 20, 20]);
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
