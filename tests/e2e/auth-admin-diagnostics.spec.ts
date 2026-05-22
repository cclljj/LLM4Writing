import { expect, test } from "@playwright/test";

test.describe.configure({ mode: "serial" });

async function login(page: import("@playwright/test").Page, username: string, password: string) {
  await page.goto("/");
  await page.getByPlaceholder("請輸入帳號").fill(username);
  await page.getByPlaceholder("請輸入密碼").fill(password);
  await page.getByRole("button", { name: "登入系統" }).click();
}

test("student login routes to student home", async ({ page }) => {
  await login(page, "student", "student123");
  await expect(page).toHaveURL(/\/student(\?.*)?$/);
  await expect(page.getByRole("heading", { name: "學生端課程首頁" })).toBeVisible();
  await expect(page.getByRole("button", { name: "登出" })).toBeVisible();
});

test("teacher login routes to teacher console without admin diagnostics", async ({ page }) => {
  await login(page, "teacher", "teacher123");
  await expect(page).toHaveURL(/\/teacher(\?.*)?$/);
  await expect(page.getByRole("heading", { name: "教師端管理台" })).toBeVisible();
  await expect(page.getByRole("button", { name: "診斷面板" })).toHaveCount(0);
  await expect(page.getByTestId("admin-prompt-diagnostics")).toHaveCount(0);
});

test("admin login routes to admin console with prompt diagnostics", async ({ page }) => {
  await login(page, "admin", "admin123");
  await expect(page).toHaveURL(/\/admin(\?.*)?$/);
  await expect(page.getByRole("heading", { name: "系統管理員控制台" })).toBeVisible();
  await page.getByRole("button", { name: "診斷面板" }).click();
  await expect(page.getByTestId("admin-prompt-diagnostics")).toBeVisible();
  await expect(page.getByText("Prompt / LLM 診斷面板")).toBeVisible();
  await expect(page.getByText("LLM 環境檢查")).toBeVisible();
  await expect(page.getByText("Prompt 設定檢查")).toBeVisible();
});
