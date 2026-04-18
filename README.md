# LLM4Writing (Vercel-native)

LLM4Writing 已改造成可直接部署於 Vercel 的原生架構版本。

## 專案定位

- 來源：Fork from https://github.com/Shengche/llm4rwiting
- 既有 Java/Wicket 程式碼仍保留於 `libs/` 與 `llm4class-web/`（作為歷史參考）
- 現行可部署主應用為 root 的 Next.js App Router + Serverless API

## 架構

- Frontend: Next.js (`app/`)
- Backend: Next.js Route Handlers (`app/api/**`)
- Runtime: Vercel Serverless Functions
- Storage: Postgres（支援 Vercel/Neon 連線字串；無 DB 環境時自動 fallback memory）

## 對應 SPEC 核心規則

目前已在 API 引擎實作以下不變量：

1. 教師端可切換全班步驟（`POST /api/teacher/step`）
2. 四種互動模式（小組互動、個人互動、無互動、個人反思）
3. 小組互動步驟需所有組員回覆後，AI 才回覆
4. 無互動步驟會自動產生一次性報告
5. 個人反思步驟採系統固定題，不觸發 AI 回覆

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
- `/student` 學生端操作頁
- `/teacher` 教師端操作頁


## 登入流程

- 登入頁：`/login`
- 預設測試帳號：
  - 學生：`student / student123`
  - 教師：`teacher / teacher123`
- 可透過環境變數覆寫：`DEFAULT_STUDENT_USER`、`DEFAULT_STUDENT_PASS`、`DEFAULT_TEACHER_USER`、`DEFAULT_TEACHER_PASS`

## API 一覽

- `GET /api/health`
- `GET /api/spec`
- `POST /api/session/start`
- `GET /api/session/:sessionId`
- `POST /api/chat/send`
- `POST /api/teacher/step`

## Postgres 注意事項

- 首次使用時，系統會自動建立 `llm4writing_sessions` table
- `payload` 以 `JSONB` 儲存完整 session 狀態
- 若未設定 `POSTGRES_URL` 或 `DATABASE_URL`，會自動使用 in-memory store（重啟即遺失）

## 版本

- `1.0`：無 `SPEC*.md` 的基準版本（已加註 fork 訊息）
- `2.0`：Vercel-native 架構起始版本
- `2.1`：加入 Postgres 持久化
