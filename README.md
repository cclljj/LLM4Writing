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
- Data (current MVP): in-memory session store (`src/lib/store.ts`)

## 對應 SPEC 核心規則

目前已在 API 引擎實作以下不變量：

1. 教師端可切換全班步驟（`POST /api/teacher/step`）
2. 四種互動模式（小組互動、個人互動、無互動、個人反思）
3. 小組互動步驟需所有組員回覆後，AI 才回覆
4. 無互動步驟會自動產生一次性報告
5. 個人反思步驟採系統固定題，不觸發 AI 回覆

## 本機開發

```bash
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

## API 一覽

- `GET /api/health`
- `GET /api/spec`
- `POST /api/session/start`
- `GET /api/session/:sessionId`
- `POST /api/chat/send`
- `POST /api/teacher/step`

## 重要限制（目前版本）

- 目前 session 儲存為 in-memory，適合 MVP 與流程驗證，不適合正式 production（無持久化、多實例不同步）
- 若要 production-grade，下一步建議接 Vercel Postgres/Neon 或外部 Redis/KV

## 版本

- `1.0`：無 `SPEC*.md` 的基準版本（已加註 fork 訊息）
- `2.0`：Vercel-native 架構起始版本（本次改造）
