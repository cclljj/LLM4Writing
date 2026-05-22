import { expect, test, type Browser, type Page } from "@playwright/test";

test.describe.configure({ mode: "serial" });

type LoggedInActors = {
  adminCtx: import("@playwright/test").BrowserContext;
  teacherCtx: import("@playwright/test").BrowserContext;
  studentCtx: import("@playwright/test").BrowserContext;
  adminPage: Page;
  teacherPage: Page;
  studentPage: Page;
};

let loggedInActors: LoggedInActors | null = null;

async function login(page: Page, username: string, password: string) {
  const response = await page.request.post("/api/auth/login", { data: { username, password } });
  let data: { redirectTo?: string; error?: string } = {};
  try {
    data = (await response.json()) as { redirectTo?: string; error?: string };
  } catch {
    data = {};
  }
  expect(response.status(), `login failed for ${username}: ${JSON.stringify(data)}`).toBe(200);
  const redirectTo = data.redirectTo ?? "/";
  await page.goto(redirectTo);
}

async function postFromPage<T = Record<string, unknown>>(page: Page, url: string, data: unknown): Promise<{ status: number; body: T }> {
  const baseOrigin = "http://127.0.0.1:3000";
  const response = await page.request.post(url, {
    data,
    headers: {
      origin: baseOrigin,
      referer: `${baseOrigin}/`
    }
  });
  let body: unknown = {};
  try {
    body = (await response.json()) as unknown;
  } catch {
    body = {};
  }
  return { status: response.status(), body: body as T };
}

function mutateOutlineForCompletion(outline: string): string {
  return outline.replace(/\["([^"]+)"\]/g, (_full, label: string) => `["${label}（已修訂）"]`);
}

async function setupInProgressCourse(adminPage: Page, suffix: string, classNumber: string): Promise<{ activityId: string; title: string }> {
  const title = `E2E-${suffix}-${Date.now()}`;
  const essayTitle = `${title}-essay`;
  const requestedEssayId = `essay-e2e-${Date.now()}-${Math.floor(Math.random() * 10_000)}`;
  const essayRes = await postFromPage(adminPage, "/api/admin/essays", {
    id: requestedEssayId,
    title: essayTitle,
    genre: "議論文",
    description: "seed for e2e",
    enabled: true
  });
  expect(essayRes.status, `essay create failed: ${JSON.stringify(essayRes.body)}`).toBe(200);
  let essayId = "";
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const essaysRes = await adminPage.request.get("/api/admin/essays");
    expect(essaysRes.ok()).toBeTruthy();
    const essaysJson = (await essaysRes.json()) as { essays?: Array<Record<string, unknown>> };
    const foundEssay = (essaysJson.essays ?? []).find((essay) => essay.title === essayTitle);
    if (foundEssay && typeof foundEssay.id === "string" && foundEssay.id.trim().length > 0) {
      essayId = foundEssay.id;
      break;
    }
    await adminPage.waitForTimeout(120);
  }
  expect(essayId, `essay id resolve failed for ${essayTitle}`).toBeTruthy();

  const openClassRes = await postFromPage(adminPage, "/api/admin/openclasses", {
      classNumber,
      essayId,
      durationMinutes: 40,
      supplemental: "E2E supplemental"
  });
  expect(openClassRes.status, `openclass failed: ${JSON.stringify(openClassRes.body)}`).toBe(200);
  const openClassData = openClassRes.body as Record<string, unknown>;
  const savedData = openClassData.saved as Record<string, unknown> | undefined;
  const activityId = savedData?.id as string;
  expect(activityId).toBeTruthy();

  const groupsRes = await postFromPage(adminPage, "/api/admin/groups", {
    activityId,
    groups: [{ groupId: "g1", groupName: "1", members: ["student"] }]
  });
  expect(groupsRes.status).toBe(200);

  const startRes = await postFromPage(adminPage, "/api/teacher/course-control", {
    activityId,
    action: "start"
  });
  expect(startRes.status).toBe(200);

  const activityTitle = (savedData?.title as string) || title;
  return { activityId, title: activityTitle };
}

async function loginAsAdminTeacherAndStudent(browser: Browser) {
  if (!loggedInActors) {
    const adminCtx = await browser.newContext();
    const teacherCtx = await browser.newContext();
    const studentCtx = await browser.newContext();
    const adminPage = await adminCtx.newPage();
    const teacherPage = await teacherCtx.newPage();
    const studentPage = await studentCtx.newPage();

    await login(adminPage, "admin", "admin123");
    await expect(adminPage).toHaveURL(/\/admin(\?.*)?$/);
    await login(teacherPage, "teacher", "teacher123");
    await expect(teacherPage).toHaveURL(/\/teacher(\?.*)?$/);
    await login(studentPage, "student", "student123");
    await expect(studentPage).toHaveURL(/\/student(\?.*)?$/);

    loggedInActors = { adminCtx, teacherCtx, studentCtx, adminPage, teacherPage, studentPage };
  }

  const { adminCtx, teacherCtx, studentCtx, adminPage, teacherPage, studentPage } = loggedInActors;
  await adminPage.goto("/admin");
  await expect(adminPage).toHaveURL(/\/admin(\?.*)?$/);
  await teacherPage.goto("/teacher");
  await expect(teacherPage).toHaveURL(/\/teacher(\?.*)?$/);
  await studentPage.goto("/student");
  await expect(studentPage).toHaveURL(/\/student(\?.*)?$/);
  return { adminCtx, teacherCtx, studentCtx, adminPage, teacherPage, studentPage };
}

test("學生 Step3 完成後，教師端出現推進 Step4 按鈕", async ({ browser }) => {
  const { adminPage, teacherPage, studentPage } = await loginAsAdminTeacherAndStudent(browser);
    const overview = await studentPage.request.get("/api/student/overview");
    const overviewJson = await overview.json();
    const classNumber = (overviewJson.profile?.classNumber as string) ?? "701";
    const { activityId } = await setupInProgressCourse(adminPage, "step3-advance", classNumber);

    const joinRes = await postFromPage(studentPage, "/api/student/join", { activityId });
    expect(joinRes.status).toBe(201);
    const joined = joinRes.body as Record<string, unknown>;
    const sessionId = joined.id as string;
    expect(sessionId).toBeTruthy();

    const step3Res = await postFromPage(teacherPage, "/api/teacher/step", { sessionId, step: 3 });
    expect(step3Res.status).toBe(200);

    const sessionRes = await studentPage.request.get(`/api/session/${sessionId}`);
    expect(sessionRes.ok()).toBeTruthy();
    const session = await sessionRes.json();
    const originalOutline = (session.outlines?.student ?? "") as string;
    expect(originalOutline.length).toBeGreaterThan(0);

    const completeRes = await postFromPage(studentPage, "/api/session/step3/complete", {
      sessionId,
      outline: mutateOutlineForCompletion(originalOutline)
    });
    expect(completeRes.status).toBe(200);

    const monitorRes = await adminPage.request.get(`/api/teacher/monitor?activityId=${encodeURIComponent(activityId)}&detail=full`);
    expect(monitorRes.ok()).toBeTruthy();
    const monitorData = await monitorRes.json();
    const sessions = (monitorData.sessions ?? []) as Array<Record<string, unknown>>;
    const current = sessions.find((item) => item.sessionId === sessionId);
    expect(current).toBeTruthy();
    expect(current?.currentStep).toBe(3);
    const gate = (current?.groupGate ?? {}) as Record<string, string[]>;
    expect(gate["3-complete"]?.includes("student")).toBeTruthy();

    const advanceRes = await postFromPage(adminPage, "/api/teacher/step", { sessionId, step: 4 });
    expect(advanceRes.status).toBe(200);
});

test("Step4 討論過濾：離題阻擋、課堂相關內容允許", async ({ browser }) => {
  const { adminPage, teacherPage, studentPage } = await loginAsAdminTeacherAndStudent(browser);
    const overview = await studentPage.request.get("/api/student/overview");
    const overviewJson = await overview.json();
    const classNumber = (overviewJson.profile?.classNumber as string) ?? "701";
    const { activityId } = await setupInProgressCourse(adminPage, "step4-filter", classNumber);

    const joinRes = await postFromPage(studentPage, "/api/student/join", { activityId });
    expect(joinRes.status).toBe(201);
    const joined = joinRes.body as Record<string, unknown>;
    const sessionId = joined.id as string;

    const step4Res = await postFromPage(teacherPage, "/api/teacher/step", { sessionId, step: 4 });
    expect(step4Res.status).toBe(200);

    const blockedRes = await postFromPage(studentPage, "/api/chat/send", {
      sessionId,
      userId: "student",
      text: "晚上一起玩 robolx"
    });
    expect(blockedRes.status).toBe(400);
    const blockedData = blockedRes.body as Record<string, unknown>;
    const blockedHint = `${blockedData.error ?? ""} ${blockedData.hint ?? ""}`;
    expect(blockedHint).toMatch(/不適合課堂|不要離題|關聯比較低/);

    const allowedRes = await postFromPage(studentPage, "/api/chat/send", {
      sessionId,
      userId: "student",
      text: "我們可以用遊戲闖關當比喻，補強文章論點與例子。"
    });
    expect(allowedRes.status).toBe(200);
});

test("Step10 報告顯示：Markdown 正常渲染且不顯示雙重標題前綴", async ({ browser }) => {
  const { adminPage, teacherPage, studentPage } = await loginAsAdminTeacherAndStudent(browser);
    const overview = await studentPage.request.get("/api/student/overview");
    const overviewJson = await overview.json();
    const classNumber = (overviewJson.profile?.classNumber as string) ?? "701";
    const { activityId, title } = await setupInProgressCourse(adminPage, "step10-render", classNumber);

    const joinRes = await postFromPage(studentPage, "/api/student/join", { activityId });
    expect(joinRes.status).toBe(201);
    const joined = joinRes.body as Record<string, unknown>;
    const sessionId = joined.id as string;

    const step10Res = await postFromPage(teacherPage, "/api/teacher/step", { sessionId, step: 10 });
    expect(step10Res.status).toBe(200);

    await studentPage.goto("/student");
    const activeCard = studentPage.locator("div.card", {
      has: studentPage.getByRole("heading", { name: "進行中課程（本班）" })
    });
    const targetCourseRow = activeCard.locator("div", {
      has: studentPage.locator("strong", { hasText: title })
    }).first();
    await expect(targetCourseRow).toBeVisible();
    await targetCourseRow.getByRole("button", { name: "進入課程" }).first().click();

    await expect(studentPage.getByRole("heading", { name: "Step 10 - 總結報告" })).toBeVisible();
    const reportCard = studentPage.locator("div.card", { has: studentPage.getByRole("heading", { name: "總結報告" }) }).first();
    await expect(reportCard).toBeVisible();

    const reportText = await reportCard.innerText();
    expect(reportText.includes("## ")).toBeFalsy();
    expect(reportText.includes("### **")).toBeFalsy();
});

test.afterAll(async () => {
  if (!loggedInActors) return;
  await loggedInActors.adminCtx.close();
  await loggedInActors.teacherCtx.close();
  await loggedInActors.studentCtx.close();
  loggedInActors = null;
});
