# LLM4Writing

[![Deploy to Vercel](https://github.com/cclljj/llm4writing_fork/actions/workflows/vercel-deploy.yml/badge.svg)](https://github.com/cclljj/llm4writing_fork/actions/workflows/vercel-deploy.yml)
[![Next.js](https://img.shields.io/badge/Next.js-16.2.6-000000?logo=nextdotjs)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.2.0-149ECA?logo=react&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8.3-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node](https://img.shields.io/badge/Node.js-20%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Security Policy](https://img.shields.io/badge/Security-Policy-blue)](./SECURITY.md)

LLM4Writing 是一個 AI 輔助寫作教學平台，包含學生端 10 步驟學習流程與教師/管理端課程管理能力，採 Next.js App Router + Serverless API 架構。

`main` 為唯一持續維護分支。系統規格與行為以 [`docs/SPEC.md`](./docs/SPEC.md) 為準。

## Core Capabilities

- 學生端 Step1~Step10 寫作學習流程（含 Step3/4 結構樹、Step6/8 草稿、Step10 總結報告）
- Step1/2 小組 gate 與兩段式 AI 流程（先回饋，再下一題）
- 教師端課程管理、分組、切步驟、學習監控與課堂儀表板
- 管理端診斷面板（KPI、fallback、錯誤分類、趨勢）
- 管理端操作審計日誌（新增任務、刪除課程、切步驟、重設密碼）
- 課程實施報告與學生個人 PDF 匯出

## Architecture

- Frontend: Next.js 16 + React 19
- Backend: Next.js Route Handlers (`app/api/**`)
- Language: TypeScript
- Storage:
  - Primary: PostgreSQL
  - Fallback: memory / file fallback（依資料模組而定）
- LLM:
  - OpenAI-compatible provider（`LLM_URL` / `LLM_KEY` / `LLM_MODEL`）
  - 未設定時維持可運作 fallback 路徑

## Quick Start

```bash
cp .env.example .env.local
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Environment Variables

### LLM (optional)

- `LLM_URL`
- `LLM_KEY`
- `LLM_MODEL`

### Database

- `SUPABASE_DB_URL`（優先）
- `POSTGRES_URL` / `DATABASE_URL`（fallback）
- `SUPABASE_POOL_MODE=transaction|session`（optional）

### Auth / Security

- `AUTH_SECRET`（production 必填）

登入使用 server-signed `llm4w_session` cookie。密碼以 bcrypt hash 儲存，舊明文資料在成功登入後自動升級。

## Project Structure

```text
app/                 Next.js pages + API routes
app/*/_components/   Page-scoped UI components
src/lib/             Engine, auth, store, diagnostics, utilities
src/config/          Prompt and workflow configuration
tests/               Node tests + Playwright E2E
docs/SPEC.md         Implementation specification (source of truth)
```

## Main Routes

- `/login`
- `/student`
- `/student/history/[activityId]`
- `/teacher`
- `/admin`

## API Surface (Selected)

### Auth

- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`

### Student

- `GET /api/student/overview`
- `GET /api/student/activities`
- `POST /api/student/join`
- `GET /api/student/history`
- `GET /api/student/course-history/[activityId]`

### Session / Learning

- `POST /api/session/start`
- `GET /api/session/[sessionId]`
- `POST /api/chat/send`
- `POST /api/session/artifact/save`
- `POST /api/session/step3/stream`
- `POST /api/session/step3/complete`
- `POST /api/session/step4/complete`
- `POST /api/session/step5/continue`
- `POST /api/session/step6/suggest`
- `POST /api/session/step6/complete`
- `POST /api/session/step8/complete`
- `POST /api/session/step10/stream`

### Teacher / Admin

- `POST /api/teacher/step`
- `GET /api/teacher/monitor`
- `GET /api/teacher/personal-progress`
- `POST /api/teacher/course-control`
- `GET /api/admin/diagnostics`
- `GET /api/admin/audit-logs`
- `GET/POST/PUT/DELETE /api/admin/users`
- `GET/POST /api/admin/essays`
- `GET/POST /api/admin/openclasses`
- `GET/DELETE /api/admin/activities`
- `POST /api/admin/groups`
- `GET/POST /api/admin/prompts/essay`
- `GET/POST /api/admin/prompts/openclass`

## Prompt Configuration

Prompt source file: [`src/config/system-prompt-config.json`](./src/config/system-prompt-config.json)

主要欄位：

- `systemPrompt`
- `stepPrompts`
- `stepPrompts_old`
- `subStepPrompts`
- `subStepPrompts_fallbacks`（runtime 對應 `subStepPromptsFallbacks`）
- `questionBanks`
- `writingTasks[essayId].questionBanks`
- `step9Questions`
- `stepOpenings`

## Quality Gates

```bash
npm run test
npm run test:e2e
npm run build
```

CI (`.github/workflows/vercel-deploy.yml`) 會先通過 quality gate 再進行 Vercel preview/production deploy。

## Documentation

- Spec: [`docs/SPEC.md`](./docs/SPEC.md)
- Security: [`SECURITY.md`](./SECURITY.md)
- Task workflow: [`TASK.md`](./TASK.md)
- Supabase migration: [`SUPABASE_MIGRATION.md`](./SUPABASE_MIGRATION.md)
- Vercel migration notes: [`VERCEL_MIGRATION.md`](./VERCEL_MIGRATION.md)

## Collaboration Baseline

- 先開 issue，再實作
- 功能變更需同步更新 `docs/SPEC.md`
- 使用 `.github/` 下的 issue/PR 模板

## Local Dev Accounts

僅供本機開發與測試：

- Student: `student / student123`
- Teacher: `teacher / teacher123`

可由環境變數覆寫：

- `DEFAULT_STUDENT_USER`
- `DEFAULT_STUDENT_PASS`
- `DEFAULT_TEACHER_USER`
- `DEFAULT_TEACHER_PASS`
