# LLM4Writing

[![Deploy to Vercel](https://github.com/cclljj/llm4writing_fork/actions/workflows/vercel-deploy.yml/badge.svg)](https://github.com/cclljj/llm4writing_fork/actions/workflows/vercel-deploy.yml)
[![Next.js](https://img.shields.io/badge/Next.js-16.2.6-000000?logo=nextdotjs)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.2.0-149ECA?logo=react&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8.3-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node](https://img.shields.io/badge/Node.js-20%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Security Policy](https://img.shields.io/badge/Security-Policy-blue)](./SECURITY.md)

**LLM4Writing** 是一個 AI 輔助寫作教學平台，讓 AI 扮演課堂中的寫作引導老師。  
系統包含學生端 10 步驟學習流程與教師／管理端完整課程管理能力，採 Next.js App Router + Serverless API 架構。

`main` 為唯一持續維護分支。系統規格與行為以 [`docs/SPEC.md`](./docs/SPEC.md) 為準。

---

## 研究計畫資訊

本系統為下列研究計畫的教學工具：

| 項目 | 說明 |
|------|------|
| **計畫名稱** | 新世代兒少數位行為及價值觀研究計畫 |
| **計畫編號** | NSTC 113-2420-H-305-001-MY3 |
| **執行單位** | 中央研究院、國立台灣師範大學 |
| **倫理審查** | 已通過人體研究倫理審查委員會（IRB）審議；所有參與者已取得本人及家長同意 |

如有興趣加入本計畫參與實驗，請與計畫團隊聯繫。

---

## Core Capabilities

- 學生端 Step 1–10 完整寫作學習流程（Step 3/4 結構樹、Step 6/8 草稿、Step 10 總結報告）
- Step 1/2 小組 gate 與兩段式 AI 流程（先回饋、再出題，AI 回饋不得提前揭露後續課程步驟）
- 教師端課程管理、分組、切步驟、學習監控與課堂儀表板
- 管理端診斷面板（KPI、fallback 率、錯誤分類、趨勢）
- 管理端操作審計日誌（新增任務、刪除課程、切步驟、重設密碼）
- 課程實施報告與學生個人 PDF 匯出

---

## Architecture

| 層級 | 技術 |
|------|------|
| Frontend | Next.js 16 + React 19 |
| Backend | Next.js Route Handlers (`app/api/**`) |
| Language | TypeScript 5.8 |
| Storage — Primary | PostgreSQL（Supabase） |
| Storage — Fallback | In-memory / file fallback（依資料模組而定） |
| LLM | OpenAI-compatible provider（`LLM_URL` / `LLM_KEY` / `LLM_MODEL`），未設定時維持 fallback 路徑 |

---

## Quick Start

```bash
cp .env.example .env.local
# 填入 AUTH_SECRET、資料庫連線字串（可選）、LLM 設定（可選）
npm install
npm run dev
```

開啟 [http://localhost:3000](http://localhost:3000)

---

## Environment Variables

`.env.example` 包含完整說明，以下為重點摘要：

### 必填（Production）

| 變數 | 說明 |
|------|------|
| `AUTH_SECRET` | Session token 簽章金鑰，建議 32 字元以上隨機字串 |

### 資料庫

| 變數 | 說明 |
|------|------|
| `SUPABASE_DB_URL` | 優先使用，建議使用 Transaction Pooler（port 6543） |
| `POSTGRES_URL` / `DATABASE_URL` | Fallback |
| `SUPABASE_POOL_MODE` | `transaction` 或 `session`（可選，自動偵測） |
| `APP_ORIGIN` | CSRF 同源檢查的 canonical origin（建議設定，如 `https://your-domain.example.com`） |

### LLM（選填）

| 變數 | 說明 |
|------|------|
| `LLM_URL` | OpenAI-compatible API endpoint |
| `LLM_KEY` | API 金鑰 |
| `LLM_MODEL` | 模型名稱（如 `google/gemma-2-9b-it:free`） |

---

## Project Structure

```text
app/                      Next.js pages + API routes
app/*/_components/        Page-scoped UI components
src/lib/                  Engine、auth、store、diagnostics、utilities
src/config/               Prompt 與 workflow 設定
tests/                    Node unit tests + Playwright E2E
docs/SPEC.md              系統規格書（single source of truth）
proxy.ts                  Next.js middleware（auth guard、rate limit、nonce CSP）
```

---

## Main Routes

| 路徑 | 說明 |
|------|------|
| `/` / `/login` | 登入頁 |
| `/student` | 學生學習頁面 |
| `/student/history/[activityId]` | 學生學習歷程回顧 |
| `/teacher` | 教師管理台 |
| `/admin` | 系統管理員控制台 |

---

## API Surface

### Auth
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET  /api/auth/me`

### Student
- `GET  /api/student/overview`
- `GET  /api/student/activities`
- `POST /api/student/join`
- `GET  /api/student/history`
- `GET  /api/student/course-history/[activityId]`

### Session / Learning
- `POST /api/session/start`
- `GET  /api/session/[sessionId]`
- `POST /api/session/artifact/save`
- `POST /api/session/step3/stream`
- `POST /api/session/step3/complete`
- `POST /api/session/step3/reopen`
- `POST /api/session/step4/complete`
- `POST /api/session/step5/continue`
- `POST /api/session/step6/suggest`
- `POST /api/session/step6/complete`
- `POST /api/session/step8/complete`
- `POST /api/session/step10/stream`
- `POST /api/session/advance-phase`

### Teacher / Admin
- `POST /api/teacher/step`
- `GET  /api/teacher/monitor`
- `GET  /api/teacher/personal-progress`
- `POST /api/teacher/course-control`
- `GET  /api/admin/diagnostics`
- `GET  /api/admin/diagnostics/fallback-report`
- `GET  /api/admin/audit-logs`
- `GET/POST/PUT/DELETE /api/admin/users`
- `GET/POST /api/admin/essays`
- `GET/POST /api/admin/openclasses`
- `GET/DELETE /api/admin/activities`
- `POST /api/admin/groups`
- `GET/POST /api/admin/prompts/essay`
- `GET/POST /api/admin/prompts/openclass`
- `POST /api/admin/maintenance/store-migrate`

---

## Security

本系統實作了以下安全機制：

- **認證**：HMAC-SHA256 server-signed session token（`llm4w_session`），`httpOnly + sameSite=strict`
- **授權**：所有 API 路由皆有角色守門（student / teacher / admin），`/api/session/start` 要求 teacher/admin
- **CSRF**：`sameSite=strict` cookie + Origin/Referer 同源驗證（`proxy.ts`，建議搭配 `APP_ORIGIN`）
- **Rate Limit**：`/api/auth/login` 逐帳號失敗計數，10 次後鎖定 10 分鐘（HTTP 429）
- **CSP**：per-request nonce（`proxy.ts`），`script-src 'nonce-…' 'strict-dynamic'`，無 `unsafe-inline`
- **XSS 防護**：`renderMessageHtml()` 輸出通過 `isomorphic-dompurify` 白名單過濾
- **Input Size**：student 文字輸入上限 10,000 字元
- **密碼**：bcrypt（rounds=12）儲存，舊明文資料登入成功後自動升級

詳見 [`SECURITY.md`](./SECURITY.md)。

---

## Prompt Configuration

Prompt 來源檔案：[`src/config/system-prompt-config.json`](./src/config/system-prompt-config.json)

主要欄位：`systemPrompt`、`stepPrompts`、`subStepPrompts`、`subStepPromptsFallbacks`、`questionBanks`、`step9Questions`、`stepOpenings`

---

## Quality Gates

```bash
npm test          # Node unit tests（96 tests）
npm run test:e2e  # Playwright E2E
npm run build     # Next.js build validation
```

CI（`.github/workflows/vercel-deploy.yml`）先通過 quality gate 再進行 Vercel deploy。

---

## Documentation

| 文件 | 說明 |
|------|------|
| [`docs/SPEC.md`](./docs/SPEC.md) | 系統規格書（single source of truth） |
| [`SECURITY.md`](./SECURITY.md) | 資安政策與通報流程 |
| [`TASK.md`](./TASK.md) | 開發任務工作流程 |
| [`.env.example`](./.env.example) | 環境變數完整說明 |

---

## Collaboration Baseline

1. 先開 issue（Traditional Chinese 標題），再實作
2. 功能變更需同步更新 `docs/SPEC.md`
3. Commit 前須通過 `npx tsc --noEmit` 與 `npm test`
4. 確認完工後再 close issue，留下紀錄

---

## Local Dev Accounts

> ⚠️ 以下帳號僅供本機開發，**正式部署前請務必刪除**。

| 角色 | 帳號 | 密碼 |
|------|------|------|
| Student | `student` | `student123` |
| Teacher | `teacher` | `teacher123` |
| Admin | `admin` | `admin123` |
