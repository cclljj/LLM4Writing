# LLM4Writing (Vercel-native)

[![Deploy to Vercel](https://github.com/cclljj/llm4writing_fork/actions/workflows/vercel-deploy.yml/badge.svg)](https://github.com/cclljj/llm4writing_fork/actions/workflows/vercel-deploy.yml)
[![Next.js](https://img.shields.io/badge/Next.js-16.2.4-000000?logo=nextdotjs)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.2.0-149ECA?logo=react&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8.3-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node](https://img.shields.io/badge/Node.js-20%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Security Policy](https://img.shields.io/badge/Security-Policy-blue)](./SECURITY.md)

LLM4Writing 是一個以 **Next.js App Router + Serverless API** 為核心的 AI 寫作教學系統，支援學生端（10 步驟寫作流程）與教師端（課程管理、分組、進度監控）。

目前 `main` 分支為唯一持續維護版本，系統行為以 [`SPEC.md`](./SPEC.md) 為準。

## Features

- 學生端完整學習流程：Step1~Step10
- 教師端課程管理、分組、切步驟與監控
- 學生端進度軌、小組等待狀態與 Step3 結構樹工具提示
- 教師端課堂儀表板、卡關偵測與一鍵推進/檢視入口
- Prompt 配置外部化：`src/config/system-prompt-config.json`
- Step1/2 子步驟 fallback 題庫（LLM 抽題失敗時不中斷）
- 選配遠端 LLM（OpenAI-compatible），未設定時可 fallback
- Postgres 儲存（未配置時 fallback 到本地檔案 + memory）

## Tech Stack

- Frontend: Next.js 16, React 19
- Backend: Next.js Route Handlers (`app/api/**`)
- Runtime: Vercel Serverless Functions
- Storage: Postgres (`SUPABASE_DB_URL` / `POSTGRES_URL` / `DATABASE_URL`)
- Language: TypeScript

## Quick Start

```bash
cp .env.example .env.local
npm install
npm run dev
```

Open: [http://localhost:3000](http://localhost:3000)

## Verification

```bash
npm test
npm run build
```

`npm test` runs focused workflow tests for answer validation, Step1/2 group gates, fallback questions, and LLM response parsing.

## Environment Variables

### Remote LLM (optional)

- `LLM_URL` - OpenAI-compatible chat completions URL
- `LLM_KEY` - API key
- `LLM_MODEL` - model name

若三者任一缺漏，系統會使用內建 fallback 回覆，保障流程可持續。

### Database

- `SUPABASE_DB_URL`（建議優先）
- `POSTGRES_URL` / `DATABASE_URL`（相容 fallback）
- `SUPABASE_POOL_MODE=transaction|session`（可選）

## Project Structure

```text
app/                Next.js pages + API routes
src/lib/            engine, workflow helpers, LLM parsing, store, auth, types
src/config/         prompt config and step openings
scripts/            migration/utility scripts
tests/              Node test runner workflow tests
SPEC.md             implementation spec (source of truth)
```

## Main Pages

- `/login`
- `/student`
- `/student/history/[activityId]`
- `/teacher`
- `/admin`

## API Overview

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

### Session / Chat
- `POST /api/session/start`
- `GET /api/session/[sessionId]`
- `POST /api/chat/send`
- `POST /api/session/advance-phase`
- `POST /api/session/step3/complete`
- `POST /api/session/step4/complete`
- `POST /api/session/step5/continue`
- `POST /api/session/step6/suggest`
- `POST /api/session/step6/complete`
- `POST /api/session/step8/complete`

### Teacher/Admin
- `POST /api/teacher/step`
- `GET /api/teacher/monitor`
- `GET /api/teacher/personal-progress`
- `POST /api/teacher/course-control`
- `GET/POST /api/admin/users`
- `GET/POST /api/admin/essays`
- `GET/POST /api/admin/openclasses`
- `GET /api/admin/activities`
- `POST /api/admin/groups`
- `GET/POST /api/admin/prompts/essay`
- `GET/POST /api/admin/prompts/openclass`

## Prompt Configuration

Prompt config file: [`src/config/system-prompt-config.json`](./src/config/system-prompt-config.json)

Key fields:

- `systemPrompt`
- `stepPrompts`
- `stepPrompts_old` (for reference)
- `subStepPrompts`
- `subStepPrompts_fallbacks`（程式內映射為 `subStepPromptsFallbacks`）
- `questionBanks`
- `writingTasks[essayId].questionBanks`
- `step9Questions`

Step1/2 remote LLM calls prefer structured JSON output with `feedback` and `nextQuestion`. If parsing fails after retry, the engine falls back to `subStepPrompts_fallbacks` or built-in safe questions so the lesson flow can continue.

## Deployment

### Vercel

```bash
npx --yes vercel --prod
```

CI workflow: [`.github/workflows/vercel-deploy.yml`](./.github/workflows/vercel-deploy.yml)

## Documentation Index

- Spec: [`SPEC.md`](./SPEC.md)
- Security policy: [`SECURITY.md`](./SECURITY.md)
- Task workflow: [`TASK.md`](./TASK.md)
- Supabase migration: [`SUPABASE_MIGRATION.md`](./SUPABASE_MIGRATION.md)
- Vercel migration notes: [`VERCEL_MIGRATION.md`](./VERCEL_MIGRATION.md)

## Collaboration Rules

- 需求先開 Issue 再實作
- 功能變更需檢查並同步 `SPEC.md`
- PR/Issue 模板位於 `.github/`

## Test Accounts

- Student: `student / student123`
- Teacher: `teacher / teacher123`

可由環境變數覆寫：
- `DEFAULT_STUDENT_USER`
- `DEFAULT_STUDENT_PASS`
- `DEFAULT_TEACHER_USER`
- `DEFAULT_TEACHER_PASS`
