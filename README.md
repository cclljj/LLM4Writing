# LLM4Writing (Vercel-native)

LLM4Writing 已改造成可直接部署於 Vercel 的原生架構版本。

## 專案定位

- 來源：Fork from https://github.com/Shengche/llm4rwiting
- 既有 Java/Wicket 程式碼仍保留於 `libs/` 與 `llm4class-web/`（作為歷史參考）
- 現行可部署主應用為 root 的 Next.js App Router + Serverless API
- 目前功能對齊基準：`SPEC.md`（現況版）

## 協作流程

- 所有需求必須先開 GitHub Issue 再實作
- 每次任務都要先檢查是否需要更新 `SPEC.md`
- 完整流程請見 [`TASK.md`](TASK.md)
- GitHub 模板：
  - Issue: `.github/ISSUE_TEMPLATE/task_change.yml`
  - PR: `.github/pull_request_template.md`

## 架構

- Frontend: Next.js (`app/`)
- Backend: Next.js Route Handlers (`app/api/**`)
- Runtime: Vercel Serverless Functions
- Storage: Postgres（支援 Vercel/Neon 連線字串；無 DB 時 fallback `.data/domain-state.json` + memory）

## 已回補流程（依 SPEC_generated_by_AI）

1. 學生端活動列表（ActivityPage）
2. 任務加入討論 + 歷史紀錄（含 CourseDetailModal 詳情確認）
3. Phase1~5 聊天流程（含 Phase5 仍可輸入）
4. 教師端三大模組入口：帳號管理 / 課程管理 / 學習管理
5. 課堂觀察（小組進度與對話檢視）與步驟切換
6. 寫作主題與開課管理（Vercel-native 版 CRUD）
7. Prompt / 問題庫改為系統參數 JSON（檔案版）
8. 學生端課程視圖精簡：課程資訊改為單行整併顯示，子步驟與模式同列，對話紀錄以 HTML 排版渲染
9. 學生端互動區：小組互動提示移至輸入框下方小字，依「最後一則系統提問」才顯示回答輸入框
10. 學生端課程進行畫面：上方題目/引導說明/補充資料改為正常字級；中段顯示過濾後互動內容（含系統提問、學生作答、AI 回覆，不顯示 system prompt）；底部提供 `<hr>` 後完整對話紀錄除錯區

## 本機開發

```bash
cp .env.example .env.local
npm install
npm run dev
```

開啟 `http://localhost:3000`

## Vercel 部署

```bash
npx --yes vercel --prod
```

已設定/可用頁面：

- `/` 首頁
- `/login` 登入頁
- `/student` 學生端
- `/teacher` 教師端

## 登入流程

- 預設測試帳號：
  - 學生：`student / student123`
  - 教師：`teacher / teacher123`
- 可透過環境變數覆寫：`DEFAULT_STUDENT_USER`、`DEFAULT_STUDENT_PASS`、`DEFAULT_TEACHER_USER`、`DEFAULT_TEACHER_PASS`

## API 一覽

- Auth
  - `POST /api/auth/login`
  - `POST /api/auth/logout`
  - `GET /api/auth/me`
- Student
  - `GET /api/student/activities`
  - `POST /api/student/join`
  - `GET /api/student/history`
- Session
  - `POST /api/session/start`
  - `GET /api/session/:sessionId`
  - `POST /api/chat/send`
  - `POST /api/session/advance-phase`
- Teacher/Admin
  - `POST /api/teacher/step`
  - `GET /api/teacher/monitor`
  - `GET/POST /api/admin/users`
  - `GET/POST /api/admin/essays`
  - `GET/POST /api/admin/openclasses`
  - `GET /api/admin/activities`
  - `POST /api/admin/groups`
  - `GET /api/teacher/personal-progress`
  - `GET/POST /api/admin/prompts/essay`（唯讀，POST 不可寫）
  - `GET/POST /api/admin/prompts/openclass`（唯讀，POST 不可寫）

## 系統參數（Prompt）

- 檔案：`src/config/system-prompt-config.json`
- 說明：全系統統一使用，不再依主題或任務做覆蓋
- 維護方式：由開發人員修改檔案後，透過 CI/CD 重新部署
- 課程進行中 LLM 組裝規則：
  - `systemPrompt + stepPrompts[步驟編號]`
  - Step1/2 另會帶入目前子步驟對應的 `subStepPrompts[x-y]` 與 `questionBanks[x-y]`（若存在）
  - 子步驟問題庫以 `writingTasks[essayId].questionBanks` 為主要來源

## Remote LLM（環境變數）

系統可透過環境變數改用遠端 LLM（供應商無綁定，採 OpenAI-compatible Chat Completions 介面）。

- `LLM_URL`：Chat Completions API URL（例如 OpenRouter：`https://openrouter.ai/api/v1/chat/completions`）
- `LLM_KEY`：API Key（請勿 commit）
- `LLM_MODEL`：模型名稱（例如 OpenRouter free model）

若三個變數都未設定，系統會使用內建 stub 回覆（可讓 UI 跑起來，但不是真正 LLM）。
若遠端 LLM 回應格式異常或暫時失敗，系統也會自動 fallback 回覆，避免中斷課堂流程。

## Postgres 注意事項

- 首次使用時，系統會自動建立 `llm4writing_sessions` table
- `payload` 以 `JSONB` 儲存完整 session 狀態
- 若未設定 `POSTGRES_URL` 或 `DATABASE_URL`，會自動使用 in-memory store（重啟即遺失）

## 版本

- `1.0`：無 `SPEC*.md` 的基準版本（已加註 fork 訊息）
- `2.0`：Vercel-native 架構起始版本
- `2.1`：加入 Postgres 持久化與現況版流程回補
