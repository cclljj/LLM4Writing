# LLM4Writing 現行系統規格書（Implementation Spec）

- 文件版本：`2026-05-09`
- 對齊程式：目前 `main` 分支（Next.js 16 App Router 版本）
- 文件用途：供工程師與 AI agent 在不閱讀完整程式碼的前提下，理解並重建現行系統行為
- 規格性質：以現行實作為準；本文件描述「已實作或必須維持的行為」，不是未來願景文件

## 0. 文件導覽

| 章節 | 主題 |
|---|---|
| 1 | 系統定位、角色、核心範圍 |
| 2 | 技術架構、儲存策略、Remote LLM |
| 3 | 權限與資料邊界 |
| 4 | 核心資料模型 |
| 5 | 學習流程引擎與 10 步驟規格 |
| 6 | 前端架構與 UI/UX 規格 |
| 7 | API 契約 |
| 8 | Prompt 與 LLM 配置 |
| 9 | 預設資料與 bootstrap |
| 10 | 安全設定 |
| 11 | 不變量 |
| 12 | 已知限制 |
| 13 | 資料庫遷移與維運 |
| 14 | 重建指引 |

## 1. 系統定位與角色

LLM4Writing 是 AI 輔助寫作教學平台，支援教師建立寫作任務、學生依 10 步驟進行寫作學習，以及教師即時監控課堂進度與學習歷程。

### 1.1 角色

| 角色 | 權限範圍 |
|---|---|
| `student` | 加入寫作任務、進行 10 步驟學習互動、儲存結構樹與草稿、查詢個人歷史紀錄 |
| `teacher` | 管理自己名下學生與班級任務、設定分組、控制課程狀態、切換步驟、檢視學習監控 |
| `admin` | 跨教師全域管理帳號、任務、課程與診斷資訊 |

### 1.2 核心組成

- 前端：Next.js App Router 頁面與 React 19 元件。
- 後端：Next.js Route Handlers（`app/api/**`）。
- 主要資料：`Session`、`User`、`Essay/OpenClass/Groups`、`PromptConfig`。
- AI 供應：可選 Remote LLM；未設定時使用內建 fallback/stub，確保流程可運作。

## 2. 技術架構

### 2.1 執行環境

- Node.js + Next.js 16
- React 19
- TypeScript 5
- `postgres` npm 套件
- Vercel production deployment

### 2.2 儲存策略總覽

系統採雙模式儲存：有 DB 時使用 Postgres；無 DB 時退回 memory/file fallback，讓本機與測試環境仍可執行。

| 資料 | 模組 | DB 表 / fallback |
|---|---|---|
| Session | `src/lib/store.ts` | `llm4writing_sessions` / `globalThis` memory map |
| User | `src/lib/user-store.ts` | `llm4writing_users` / `globalThis` memory map |
| Domain data | `src/lib/activity-store.ts` | `llm4writing_domain` singleton / `.data/domain-state.json` + memory |
| Prompt config | `src/lib/prompt-config.ts` | 檔案系統 `src/config/system-prompt-config.json` |

### 2.3 Session Store

- 啟用條件：`SUPABASE_DB_URL` 優先；否則使用 `POSTGRES_URL` / `DATABASE_URL` fallback。
- Supabase serverless 情境建議使用 transaction pooler（常見 port `6543`）；可用 `SUPABASE_POOL_MODE=transaction` 強制模式。
- Postgres 表：`llm4writing_sessions`。
- 欄位：`id TEXT PRIMARY KEY`、`payload JSONB`、`created_at`、`updated_at`。
- `getSessionWithMeta` 使用 React `cache()`，同一 request 生命週期內查同一 sessionId 僅打一次 DB（#232）。

### 2.4 User Store

- 啟用條件同 Session Store。
- Postgres 表：`llm4writing_users`。
- 欄位：`username TEXT PRIMARY KEY`、`payload JSONB`、`password TEXT`、`created_at`、`updated_at`。
- 啟動時會 backfill 預設帳號，使用 `ON CONFLICT DO NOTHING`。
- 若 DB 不可用，退回 `globalThis` memory map。

### 2.5 Domain Store

Domain store 拆分為以下模組（#231）：

| 模組 | 責任 |
|---|---|
| `src/lib/activity-store.ts` | Domain 狀態單例、hydrate/flush、users/essays/openClasses/groups/courseStatus CRUD |
| `src/lib/genre-resolver.ts` | 依文體解析結構樹範本路徑，讀取範本並替換題目佔位符 |
| `src/lib/prompt-config.ts` | 載入步驟開場白、組裝 `resolvePromptConfigForActivity` |
| `src/lib/mock-data.ts` | re-export barrel，保留舊 import 路徑相容 |

Postgres 啟用時：

- 表：`llm4writing_domain`。
- 主鍵固定 `id='singleton'`，`payload` 儲存整體 domain JSON。
- 讀取時 hydrate；變更後 flush。
- hydrate 不可強制 flush；DB 寫入受限時，讀取仍需可退回記憶體快照。
- DDL 權限不足（如 `permission denied`）不得阻斷讀取 API。

無 DB 時：

- 優先使用 `.data/domain-state.json` 檔案持久化。
- 同步維持 `globalThis` memory state。

### 2.6 Remote LLM

Remote LLM 用於在 production 以環境變數切換 OpenAI-compatible 供應商。

必填環境變數（三者皆存在才啟用）：

| 變數 | 說明 |
|---|---|
| `LLM_URL` | OpenAI-compatible Chat Completions API URL |
| `LLM_KEY` | API key，不得出現在前端程式碼 |
| `LLM_MODEL` | 模型名稱 |

行為要求：

- 已設定時，`src/lib/engine.ts` 經由 `src/lib/llm-client.ts` 呼叫遠端 LLM，並將 AI 回覆寫入 session messages。
- 缺任一設定時使用內建 stub 回覆，讓 UI 流程可跑通。
- 遠端 LLM 回傳格式不符、請求失敗或 timeout 時，最多進行 3 次短暫退避重試；仍失敗則 fallback，不中斷課程。
- 若 OpenAI-compatible `finish_reason` 顯示 token/length 截斷，系統會要求模型續寫並合併文字（含 Step1/2），以避免學生端顯示不完整回覆。

LLM 上下文規則：

- 會帶入作文題目（`activityTitle`）。
- Step1~4：帶入同組全員於 Step1~目前步驟的必要歷史互動。
- Step5 之後：帶入 Step1~4 小組共同歷史，加上 Step5~目前步驟該學生本人歷史。
- Step5+ 不得混入其他學生的個人訊息。
- 上下文需以最近訊息數與字數上限裁切，避免 prompt 過長。

## 3. 權限與資料邊界

### 3.1 基本原則

- `student` 只能操作自己參與的 session 與 artifact。
- `teacher` 只能管理自己名下學生、自己可見班級的任務與分組。
- `admin` 可管理全域資料。

### 3.2 教師可見範圍

教師可見學生：

- `role = student`
- `ownerTeacherUsername = 教師 username`

教師可見班級：

- 由可見學生集合的 `(school, classNumber)` 推導。

教師可見寫作任務：

- 任務的 `(school, classNumber)` 必須落在教師可見班級集合。

教師可操作分組候選學生：

- `student.school == activity.school`
- `student.classNumber == activity.classNumber`
- 且學生在教師可見學生集合中。

### 3.3 班級歸屬規則

同一學校 + 同一班級號碼不可同時掛在不同教師名下。

- 建立或更新 student 時必須檢查 `class_owner_teacher_conflict`。
- 寫作任務建立時需推導並綁定 owner teacher，避免 admin 協助設定後課程歸屬不明。

## 4. 核心資料模型

資料型別來源以 `src/lib/types.ts` 與 `app/teacher/_components/types.ts` 為準。

### 4.1 UserAccount

```ts
{
  username: string;
  name: string;
  school: string;
  role: "student" | "teacher" | "admin";
  ownerTeacherUsername?: string;
  classNumber?: string;
}
```

### 4.2 Essay

```ts
{
  id: string;
  title: string;
  genre: string;
  description: string;
  enabled: boolean;
}
```

### 4.3 OpenClassTask / OpenClassView

Task 儲存主體：

```ts
{
  id: string;
  school: string;
  classNumber: string;
  essayId: string;
  durationMinutes: number;
  supplemental: string;
}
```

View 補充欄位：

```ts
{
  essayTitle: string;
  essayGenre: string;
}
```

### 4.4 Activity

API 輸出給學習與分組流程使用：

```ts
{
  id: string;
  school: string;
  classNumber: string;
  essayId: string;
  title: string;
  genre: string;
  essayDescription?: string;
  durationMinutes: number;
  supplemental: string;
  groups: ActivityGroup[];
  courseStatus?: "not_started" | "in_progress" | "paused" | "ended";
}
```

### 4.5 ChatMessage

```ts
interface ChatMessage {
  id: string;
  role: "student" | "teacher" | "system" | "ai";
  userId?: string;
  text: string;
  at: string;
  step: number;
}
```

### 4.6 SessionState

```ts
{
  id: string;
  createdAt: string;
  currentStep: number;
  personalSteps?: Record<string, number>;
  participants: string[];
  messages: ChatMessage[];
  groupGate: Record<string, string[]>;
  reflectionIndex: Record<string, number>;
  workflow: "spec10" | "legacy_phase";
  phaseMax: number;
  activityId?: string;
  activityTitle?: string;
  activityEssayDescription?: string;
  activitySupplemental?: string;
  groupId?: string;
  groupName?: string;
  promptConfig: PromptConfig;
  stepState: {
    step1Substep: number;
    step2Substep: number;
    step1Substep3Question?: number;
    step1Substep4Question?: number;
    step2Substep1Question?: number;
  };
  outlines: Record<string, string>;
  step3SubmittedOutlines?: Record<string, string>;
  draftStep6: Record<string, string>;
  draftStep8: Record<string, string>;
  reports: {
    step5?: string;
    step7: Record<string, string>;
    step10: Record<string, string>;
  };
}
```

### 4.7 Artifact Signals 與 Diagnostics

Artifact 類型：

| type | 寫入位置 |
|---|---|
| `outline` | `session.outlines[username]` |
| `draft6` | `session.draftStep6[username]` |
| `draft8` | `session.draftStep8[username]` |

儲存 artifact 時同步更新 `artifactSignals`：

- `outlineUpdatedAt[username]`
- `draftStep6UpdatedAt[username]`
- `draftStep8UpdatedAt[username]`

教師端 monitor API 回傳 artifact diagnostics：

- Step3 結構樹字數與更新時間。
- Step6/8 草稿字數與更新時間。
- 初稿與潤飾稿完整內容不暴露給教師端 monitor；僅回傳診斷摘要。

## 5. 學習流程引擎

來源：`src/lib/engine.ts`、`src/lib/spec.ts` 與 workflow helper modules。

### 5.1 10 步驟與模式

| Step | 名稱 | 模式 | 說明 |
|---|---|---|---|
| 1 | 審視題目 | `group_interaction` | 小組共同回答子步驟題目 |
| 2 | 蒐集資料 | `group_interaction` | 小組共同回答資料與觀點題目 |
| 3 | 生成論點 | `personal_interaction` | 個人與 AI 互動並完成結構樹 |
| 4 | 對比修正 | `group_interaction` | 瀏覽同組結構樹、修正自己的結構樹、小組討論 |
| 5 | 摘要報告 | `non_interactive` | 系統彙整 Step1~4 摘要 |
| 6 | 撰寫初稿 | `personal_interaction` | 個人撰寫初稿並請 AI 建議 |
| 7 | 分析回饋 | `non_interactive` | AI 產生 Step6 分析回饋 |
| 8 | 修改潤飾 | `personal_interaction` | 個人修改最終稿 |
| 9 | 個人反思 | `personal_reflection` | 一次送出四題反思 |
| 10 | 總結報告 | `non_interactive` | AI 產生個人總結報告 |

### 5.2 Step1/2 子步驟與題目來源

Step1 有 5 個子步驟，Step2 有 4 個子步驟。每個子步驟需所有 participants 都回覆至少一次，AI 才回覆並進入下一子步。

Gate key 範例：

- `1-1`
- `1-3-1`
- `1-4-2`
- `2-1-3`
- `2-4`

題目來源優先序：

| Step/Substep | 題目來源 |
|---|---|
| `1-1`、`1-2`、`1-5` | `questionBanks` 隨機抽題 |
| `1-3-x`、`1-4-x` | LLM 依 `subStepPrompts` 產生 `nextQuestion`；缺失時 fallback |
| `2-1-x`、`2-2`、`2-3` | LLM 依 `subStepPrompts` 產生 `nextQuestion`；缺失時 fallback |
| `2-4` | `questionBanks` 隨機抽題 |

強制規則：

- `1-2`、`1-5`、`2-4` 不得被 AI 回覆中的下一題覆蓋。
- `questionBanks` 主要來源為 `writingTasks[essayId].questionBanks`。
- `PromptConfig.subStepPrompts` 中部分內容是給 LLM 的指示，不可直接顯示給學生。
- 首題或 fallback 題目若缺失，必須使用短、安全、學生可讀的保底問句，不得回退成 prompt 原文。

### 5.3 Step1/2 Group Gate 與等待狀態

- 學生在尚未完成當前 gate 前，不可看到同組其他同學在當前 gate 的 student 訊息。
- 第一位學生提交後，其餘尚未提交者仍可輸入；已提交者進入等待狀態。
- 最後一位學生送出後，全組已作答同學顯示「等待遠端 AI 回答中...」。
- 若全員已完成但 AI 或 system 下一題沒有出現，學生端輪詢 `/api/session/[sessionId]` 需在安全等待時間後補推進，避免永久卡住。
- 自動補推進需涵蓋子題邊界，如 `1-3-3 -> 1-4-1`、`1-4-3 -> 1-5`、`2-1-3 -> 2-2`。

### 5.4 LLM Prompt 組裝與輸出契約

Prompt 組裝順序：

1. 全域 `systemPrompt`
2. 當前步驟 `stepPrompts[String(step)]`
3. Step1/2 額外附加目前子步驟 key 對應的 `subStepPrompts[key]` 與 `questionBanks[key]`

Step1/2 遠端 LLM 優先輸出 JSON：

```json
{
  "feedback": "給全組的簡短回饋",
  "nextQuestion": "下一題要問學生的一句完整問題"
}
```

契約：

- LLM 應只輸出 JSON object，不加 Markdown code fence 或額外說明。
- `feedback` 與 `nextQuestion` 必須為繁體中文。
- `nextQuestion` 不可空白、不可照抄 prompt、不可寫「請依上一則 AI 提問作答」。
- 後端先解析 JSON；若不是 JSON，仍相容舊格式「請回答以下問題」。
- 若 3 次重試後仍沒有可用 `nextQuestion`，使用 `subStepPromptsFallbacks`；若仍缺漏，使用內建安全 fallback。
- Step1/2 單次遠端 LLM 嘗試需使用較短 timeout，避免課堂互動長時間卡住。

### 5.5 學生可讀文字淨化

所有會顯示給學生的 AI 文字都必須先淨化，避免洩漏開發格式。

適用範圍：

- Step1/2 回饋
- Step3/4 一般互動
- Step6 修改建議
- Step7 分析回饋
- Step10 總結報告

需移除：

- Markdown code fence，例如 ```` ```json ````。
- JSON 欄位包裝，例如 `{"feedback":...,"nextQuestion":...}`。
- 其他非學生可讀的結構化欄位名或 prompt 殘留。

### 5.6 學生回答品質檢查

在 `sendStudentMessage` 寫入有效訊息前，系統先做品質檢查。目標是允許答錯，但拒絕明顯敷衍、惡搞或不符合最低要求的回覆。

一般互動回答檢查：

- 過短內容。
- 明顯敷衍詞，如「不知道 / 隨便 / 沒意見」。
- 隨機字串。
- 與題目關聯性不足。
- 直接貼題。
- 題目要求多項目時，答案項目數不足。

Step1/2 的簡化檢查：

- 使用較簡化的檢查邏輯，例如 `validateStudentAnswer_simple` 或等價命名。
- 先檢查最小有效長度（目前實作門檻：至少 8 字），允許短但明確的一句主張。
- 檢查隨機字串與敷衍詞，明顯無效回答直接拒絕。
- 關聯性採「語意型通過 + 輕量關聯確認」：命中任一語意結構即可視為有效作答，語意結構包含「條件關係」「分類/界線」「比較/取捨」「立場主張」「因果/理由」「舉例/情境化」。
- 輕量關聯確認採弱匹配：題目核心詞（含英文/數字）命中、至少 2 個非停用中文字重疊、或一般作答關聯詞（如重點、理由、例子、條件、定義）命中其一即可。
- 補強提示僅在「非常短且語意不足」才觸發；目前實作為「長度 < 12 且未命中語意結構」時提示補上理由、例子或經驗。
- 目標是只擋「亂碼、敷衍、完全離題」，避免誤擋有認真作答但關鍵詞重疊不高的回答。

Step6/8 草稿與最終稿檢查：

- 中文字數少於 50 個需拒絕。
- 僅使用隨機字串需拒絕。
- 敷衍詞過多需拒絕。
- 直接抄題目需拒絕。
- 與題目關聯性不足需拒絕。
- 拒絕時需給予提示與修改方向，引導學生補強。

Step6「完成文章撰寫」額外前後端驗證（#235）：

- 去除首尾空白後總長度需 >= 100 字元。
- 中文字（CJK U+3400–U+9FFF）需 >= 50 個。
- 去除連續重複模式後長度需 >= 原長度 40%。
- 不可為單一低品質詞，如「不知道」「隨便」「test」。
- 後端位於 `POST /api/session/step6/complete`，錯誤回傳 `{ error: "draft_insufficient", hint: "..." }`。
- 共用驗證函式：`validateDraftContent(draft)` 於 `src/lib/answer-validation.ts`。

驗證失敗行為：

- HTTP 400。
- 回傳 `error` 與 `hint`。
- 流程不前進。
- 不保存被拒絕的學生原文。
- 被拒內容不可進入後續 LLM 歷史背景。
- 僅更新 `qualitySignals.rejectedAnswerCounts` / `qualitySignals.rejectedAnswerLastAt`，供教師端卡關偵測。

### 5.7 非互動與個人步調

非互動步驟：

- Step5：彙整 Step1~4 最近訊息，寫入 `reports.step5`。
- Step7：為每位 participant 生成 `reports.step7[user]`。
- Step10：為每位 participant 生成 `reports.step10[user]`。

自 Step5 起改為個人步調：

- 同組成員可各自推進 Step5~10。
- 學生端渲染與 Step5/6/8/9 API 判定以 `personalSteps[username]` 為準。
- 學生端 Step5+ 互動內容僅顯示該學生本人、AI 與必要個人系統提示。
- 教師端需顯示 Step5~10 人數分布，例如 `S5:x / S6:y / ... / S10:z`。

### 5.8 Step9 個人反思

- 題目來源：`promptConfig.step9Questions`（key: `"1"~"4"`）。
- 若缺漏或不完整，fallback 到內建 4 題預設值。
- 進入 Step9 時，系統一次顯示 4 題。
- 學生需一次送出四題答案（`Q1~Q4`）。
- 後端逐題驗證作答品質。
- 任一題太短、敷衍或貼題，整份拒收並指出第 N 題需要補強。
- 全部通過後，系統送「個人反思完成」，並將 `personalSteps[user]` 推進到 Step10。
- 相容性修復：舊 session 若 `reflectionIndex` 已達完成門檻但 `personalSteps[user]` 仍停在 Step9，讀取 session 時需補推進到 Step10 並補齊報告。

### 5.9 Streaming 行為

| 功能 | Endpoint | 行為 |
|---|---|---|
| Step3 AI 回覆 | `/api/session/step3/stream` | SSE streaming，完成後寫入學生訊息與 AI 回覆，並以 `done` 回傳最新 session（#268） |
| Step6 AI 修改建議 | `/api/session/step6/suggest` | SSE streaming，`Step68Panel` 即時累加顯示 chunk（#238） |
| Step7 分析回饋 | `/api/session/step6/complete` | SSE streaming，Step6 完成時即時顯示 Step7 preview（#240） |
| Step10 總結報告 | `/api/session/step10/stream` | 學生端偵測空報告後自動觸發，完成後寫入 report 與 AI 訊息（#241） |

SSE 事件格式：

- `data: {"type":"chunk","text":"..."}`
- `data: {"type":"done","session":{...}}`
- `data: {"type":"error","error":"..."}`

LLM 未設定或串流失敗時需提供可讀 fallback，避免學生停留在無限 loading。

### 5.10 流程引擎模組邊界

| 模組 | 責任 |
|---|---|
| `src/lib/engine.ts` | 對外 API：`createSession`、`switchStep`、`sendStudentMessage` 等 |
| `src/lib/answer-validation.ts` | 學生回答與草稿品質檢查 |
| `src/lib/llm-response.ts` | Step1/2 JSON 與舊格式解析、`nextQuestion` 可用性檢查 |
| `src/lib/llm-openai-response.ts` | OpenAI-compatible 回覆文字與 `finish_reason` 解析 |
| `src/lib/workflow-questions.ts` | 題庫、子步驟、fallback 題目、group gate key、Step9 題目組裝 |
| `src/lib/workflow-step1-2.ts` | Step1/2 group gate 與子步驟推進 |
| `src/lib/learning-diagnostics.ts` | 教師端卡關偵測、回答品質拒絕訊號、artifact 診斷 |
| `src/lib/student-next-action.ts` | 學生端下一步任務卡判斷 |
| `src/lib/outline-utils.ts` | Mermaid 結構樹解析與 preview 共用函式 |
| `src/lib/api-helpers.ts` | student step API 共用驗證骨架 |
| `app/_components/OutlineSvg.tsx` | 共用結構樹 SVG 元件 |

驗證命令：

- `npm test`
- `npm run build`

## 6. 前端架構與 UI/UX 規格

### 6.1 元件拆分原則

- 大型頁面保留資料讀取、流程控制與 API 協調。
- 可重用或可獨立閱讀的純 UI 區塊放在同層 `_components` 目錄。
- 元件拆分不得改變既有 session polling、API 呼叫、流程推進與資料儲存行為。

學生端已拆出（#234）：

| 元件 | 責任 |
|---|---|
| `renderMessageHtml.ts` | Markdown/HTML 渲染工具 |
| `OutlineEditor.tsx` | SVG 拖拉結構樹編輯器，管理 outline nodes 與 sync guard |
| `StudentLobby.tsx` | 無 session 時的課程清單與入口 |
| `HistoryReview.tsx` | 可折疊前序步驟回顧，含 Step3/4 結構樹快照 |
| `InteractionPanel.tsx` | 通用互動面板，含訊息列表、送出表單、Step9 批次回答等 |
| `Step68Panel.tsx` | Step6/8 草稿編輯器，含參考結構樹、儲存、AI 建議、完成按鈕 |
| `StudentProgressRail.tsx` | Step1~10 進度軌 |
| `GroupWaitingStatus.tsx` | 小組等待狀態 |
| `Step3ToolHint.tsx` | Step3 工具提示 |
| `StudentTopHeader.tsx` | 學生端共用頂部名片 |
| `NextActionCard.tsx` | 下一步任務卡 |

教師端已拆出（#237）：

| 元件 | 責任 |
|---|---|
| `types.ts` | 教師端共享型別與常數 |
| `StudentAccountTab.tsx` | 帳號管理分頁 |
| `CourseManagementTab.tsx` | 課程管理分頁 |
| `LearningMonitorTab.tsx` | 學習管理分頁、監控、儀表板、對話紀錄 |
| `TeacherDashboard.tsx` | 課堂儀表板 |
| `AdminPromptDiagnostics.tsx` | Prompt / LLM 診斷面板 |

### 6.2 全域前端 UX 規格

- 錯誤訊息需使用 `src/lib/error-messages.ts`（#272），將 API error code 轉為使用者可理解的中文提示。
- 錯誤提示需包含下一步，例如「請稍後再試」「請重新整理」「請確認課程是否已開始」「請聯繫教師或管理員」。
- 若 API 回傳自然語言驗證訊息或 `hint`，前端需保留並顯示「建議修改」。
- 未知技術錯誤不得直接顯示裸露 `xxx_failed`。
- 載入狀態應優先採局部 loading，不以全頁鎖定取代可瀏覽內容。

### 6.3 E2E 測試

- 使用 Playwright：`playwright.config.ts`。
- 指令：`npm run test:e2e`。
- E2E dev server 固定以記憶體資料源執行，避免本機 `.env.local` / DB 狀態影響預設測試帳號。
- 初始覆蓋：student、teacher、admin 登入導向；admin 可見診斷面板；teacher 不可見診斷面板。

### 6.4 首頁與登入

- 首頁整合登入表單，不再需要使用者先選三種身份入口。
- 登入成功後依角色導向：student -> `/student`，teacher -> `/teacher`，admin -> `/admin`。
- 登入寫入 HTTP-only cookie：`llm4w_user`、`llm4w_role`。
- 登入後首頁或管理頁右上角顯示身分格式：`學校 – 姓名 (帳號)`。
- 首頁不得直接顯示預設帳號密碼。

### 6.5 學生端 `/student`

#### 6.5.1 課程入口

學生首頁顯示：

- 進行中課程（本班）。
- 尚未開始課程（本班）。
- 暫停中課程（本班）。
- 自己參與過的課程清單，依最近參與時間排序。

入口規則：

- 課程列需顯示分組狀態：`尚未分組` / `未分配` / `第 X 組`。
- 學生資料缺漏 `school` / `classNumber` / `ownerTeacherUsername` 時顯示警告。
- 進行中課程的「進入課程」直接呼叫 `/api/student/join`。
- 尚未開始課程可進入準備階段；按「檢查並進入討論」才呼叫 `/api/student/join`。
- 課程尚未開始、暫停或結束時，join API 回傳錯誤，前端需顯示友善提示。
- 已參與課程的「查詢紀錄」導向 `/student/history/[activityId]`，按鈕置於課程文字右側且寬度精簡。
- 已參與課程的「最近步驟」以該學生個人步驟 `personalSteps[username]` 為準。
- 課程清單載入中需顯示顯眼載入提示，避免學生誤判資料遺失。

#### 6.5.2 Session 通用版面

- 進入 session 後切換到課程內容視圖，提供「返回學生端課程首頁」。
- 學生端不提供重複的返回上一層按鈕。
- 學生端頂部名片由 `/student` layout 提供，至少出現在 `/student` 與 `/student/history/[activityId]`。
- 課程資訊卡固定包含：題目、文體/時長、班級/組別、組員名單。
- 題目卡需顯示引導說明與補充資料，並以 HTML 保留換行與段落。
- Step1 互動內容不顯示引導說明與補充資料；`stepPrompts["1"]` 不得寫入學生可見對話。
- 子步驟與模式合併同列顯示，例如 `目前子步驟：1-1 ｜ 模式：小組互動`。
- 訊息內容需以 HTML 排版渲染，支援標題、粗體、段落、清單。
- 開發除錯模式可在互動內容下方以 `<hr>` 分隔列出原始完整對話。

#### 6.5.3 互動區與等待狀態

- 「互動內容」僅列學生可理解的系統提問、學生回答與 AI 回覆。
- 不得顯示 internal system prompt。
- 若系統提問來源為內部 prompt，前端需改顯示學生可理解替代文案。
- 只有當互動內容最後一則為系統提問時，顯示回答輸入框。
- 小組互動提示文案需置於輸入框下方並以較小字體呈現。
- 若等待同組成員或遠端 AI，顯示等待提示，完成後自動消失。
- Step1/2 完成等待教師切換時需隱藏輸入區，並顯示等待老師切換提示。
- 學生端需定期同步課程狀態，老師切換狀態時不得要求 reload。
- Polling 採單一 interval：無 session 時每 15s `refreshOverview()`；有 session 時每 5s 拉 `/api/session/{id}`，含 ETag/304，且每 3 tick 才呼叫 `refreshActivityStatuses()`。

#### 6.5.4 進度軌與下一步任務卡

- 進入 session 後顯示 Step1~10 學習進度軌。
- 進度以學生個人目前步驟 `personalSteps[user] ?? session.currentStep` 標示。
- Step1/2/4 小組互動階段需顯示小組等待狀態卡，包含目前 gate、已完成人數、未完成組員、等待 AI/老師提示。
- 進度軌下方顯示 `NextActionCard`（#269）。
- 任務卡每一步只突出一個主要行動，例如「回答這一題」「等待組員」「完成結構樹」「送出初稿」「送出最終稿」。
- 任務卡以 status pill 標示「輪到你 / 等待中 / 已保存 / 已完成」等狀態。
- 卡片可有一句輔助說明，但不得同時突出多個競爭性主要操作。

#### 6.5.5 Step3 生成論點

結構樹編輯器：

- 初始預設樹依課程文體決定，透過 `src/config/structure-tree.json` 對應 `src/config/structure-tree/*.map`。
- 預設樹最上層若含「作文題目」，需替換為當前課程題目。
- 學生載入時若結構樹為空樹，需自動套用文體預設結構樹。
- 第一層與第二層固定，不可改名、拖曳或刪除。
- 第一層不顯示新增/刪除控制；第二層只顯示新增控制。
- 第三層以下可新增、編輯、拖曳；無子節點時可刪除。
- 節點可雙擊或長按編輯。
- 超出可視範圍時需提供水平與垂直捲軸。
- 新增、刪除與完成文字編輯需自動儲存到 `outline`。
- Step3 不提供「儲存變更」按鈕。
- 已有 Mermaid 存檔時重新載入需優先還原，不得重置為預設樹。
- Auto-save 後若 polling 暫回舊 outline，不得覆蓋剛完成的本地編輯。
- 完成時需先自動儲存當前結構樹，再寫入 `groupGate["3-complete"]`。
- 完成時需寫入 `step3SubmittedOutlines` 快照，供後續回顧固定顯示。
- 編輯器需顯示工具提示與輕量儲存狀態。

互動規則：

- Step3 互動內容區在結構樹編輯器上方。
- 直接顯示結構樹編輯畫面，不需額外開啟按鈕。
- AI 依 `stepPrompts["3"]` 引導，但僅回覆學生提問，不主動提出新問題。
- 無歷史訊息時仍顯示起始引導文案與輸入區。
- Step3 AI 回覆使用 SSE streaming（#268）。
- 同組學生不得共享彼此 Step3 與 AI 的個人互動內容。
- 學生畫面不得顯示 system 提示原文。

#### 6.5.6 前序步驟回顧與歷史頁

- 進入當前步驟時，在課程內容下方、當前步驟說明上方顯示前序步驟回顧。
- 回顧逐步列出 Step1 到前一個步驟的步驟名稱與個人互動紀錄。
- 僅顯示該學生本人訊息與 AI 回覆，不顯示同組其他同學、教師或 internal system prompt。
- 回顧卡片預設閉合；展開後才顯示步驟說明與互動內容。
- 每個回顧步驟提供展開/閉合切換。
- Step4 含之後，Step3 回顧底部需顯示完成提交當下的個人結構樹快照。
- 舊 session 若缺少 `step3SubmittedOutlines`，進入 Step4 後需回補快照。
- 進行中課程的前序回顧中，Step4 也需顯示修正後結構樹。
- `/student/history/[activityId]` 沿用課程首頁卡片風格，包含課程內容卡與歷史步驟互動內容。
- 歷史頁每個步驟以獨立卡片呈現，預設閉合。
- 歷史頁 Step3 與 Step4 分別顯示結構樹圖片。

#### 6.5.7 Step4 對比修正

- Step4 拆成三段：同組結構樹瀏覽、自己的結構樹編修、小組討論。
- 「我的結構樹」預設直接展開編修介面。
- 載入時使用該學生目前最新版 `outline`。
- 本地編修尚未自動儲存完成時，polling 不得覆蓋本地內容。
- 編修規則與 Step3 相同。
- 同組瀏覽區需即時反映同學最新 outline。
- 小組討論採持續發言模式，不使用單回合 `4-1` gate。
- 學生訊息格式為「學生名：內容（時間）」。
- 有成員已按完成時，討論區顯示「{同學} 已確認完成此步驟」。
- 「確認完成此步驟」需先自動儲存當前結構樹，再完成鎖定並寫入 `groupGate["4-complete"]`。
- 鎖定後不可再發言或編修。
- 確認完成後，以 SVG 顯示自己的結構樹，不顯示 Mermaid 原始碼。
- 僅當 `groupGate["4-complete"]` 包含全組 participants 時，教師端狀態顯示可切換 Step5。

#### 6.5.8 Step5~Step10 個人步調 UI

- Step5 僅顯示摘要卡片，不顯示互動內容卡片。
- Step5 摘要產生後學生端自動推進 Step6。
- Step6 顯示同組結構樹（唯讀 SVG），可切換組員，預設自己。
- Step6 若已有 `draftStep6[username]`，輸入區自動載入草稿。
- Step6 作文編輯區為大尺寸 textarea，提供「儲存文章」「AI 修改建議」。
- Step6/8 草稿區顯示保存狀態（#271）：正在儲存、已保存於 HH:mm、尚有 N 字未保存、儲存失敗。
- 保存狀態顯示在草稿按鈕附近，不增加頻繁 API 呼叫。
- Step6 AI 修改建議可多次累積。
- Step6 完成文章後自動連續推進 Step8（6 -> 7 -> 8），不等待同學或教師。
- Step6 互動內容卡僅顯示 AI 回覆，不顯示學生發話列。
- Step6 觸發完成後需在按鈕附近顯示「AI 正在產生步驟 7 分析回饋」。
- Step8 編輯區顯示保存狀態，提供「完成潤飾步驟」。
- Step8 不顯示互動內容卡片。
- Step9 完成後自動進入 Step10。
- Step10 不另顯示獨立互動內容卡；在 Step10 說明卡中以分隔線後顯示總結報告。
- Step10 總結報告使用 HTML 渲染，結尾需包含「整個課程操作結束，請等待老師的下一步指示」。
- Step10 額外顯示課程結束提醒卡。

### 6.6 教師端 `/teacher`

教師端包含三大分頁：帳號管理、課程管理、學習管理。

#### 6.6.1 帳號管理

- 支援帳號 CRUD、reset password、CSV 批次建帳。
- teacher/admin 依權限限制可操作資料。
- student 帳號必填 `classNumber`。
- 使用者清單角色顯示中文：學生、教師、管理員。
- 搜尋區塊位於使用者清單上方。
- CSV 欄位順序固定 `classnumber` 第一欄。
- 刪除 UX（#257）：確認後該列按鈕變灰顯示「處理中...」，頁面上方顯示藍底處理中 banner；成功後顯示綠底成功提示 5 秒。

CSV 格式：

```csv
classnumber,username,name,school,role,password
classnumber,username,name,school,role,password,ownerTeacherUsername
```

#### 6.6.2 學習管理：課程清單

課程清單欄位：學校、班級、課程、目前狀態、操作。

每列操作：

- 開始上課
- 暫停/繼續上課
- 結束上課
- 查看狀態
- 重新整理
- 刪除（admin only）

清單規則：

- 每頁固定最多 10 筆。
- 提供上一頁、下一頁、跳到第 N 頁。
- 篩選選單：學校、班級、課程、狀態，預設全部。
- 進入分頁時主動刷新資料。
- 課程清單載入不得被 monitor/session 查詢阻塞。

課程狀態按鈕：

| 狀態 | 可用操作 |
|---|---|
| `not_started` | 開始上課 |
| `in_progress` | 暫停上課、結束上課、查看狀態 |
| `paused` | 繼續上課、結束上課、查看狀態 |
| `ended` | 查看狀態 |

課程控制呼叫 `/api/teacher/course-control`。

#### 6.6.3 學習管理：監控與儀表板

- 「查看狀態」可查看即時或歷史 session 內容。
- 第一次點擊「查看狀態」即需完成載入並帶出課程詳細資料；若有 session，預設選中第一筆。
- Monitor 採摘要先載入、詳情後載入（#267）。
- `/api/teacher/monitor` 預設只回傳儀表板與加入狀態所需摘要。
- 完整 `messages`、`outlines`、`step3SubmittedOutlines` 僅在選取小組對話時以 `?sessionId=...&detail=full` 延遲載入。
- 輪詢只使用摘要 payload，降低 loading 與網路成本。
- 課堂儀表板、全班加入狀態、小組對話紀錄、個人對話紀錄四個 h2 標題後附加「— 學校 / 班級 / 文章題目」（#258）。

課堂儀表板（#244）：

- 顯示所有 sessions，不只卡關或可推進小組。
- 排序：高風險 -> 留意 -> 可推進 -> 正常。
- 欄位：狀態、小組、成員、目前進度、Step5~10 分布、提醒/步驟切換、動作。
- 目前進度顯示 `min(personalSteps[member])`，避免 Step5 後停在 `session.currentStep`。
- 一鍵推進 Step N 呼叫既有步驟切換流程。
- 查看對話會選取 session、展開小組對話紀錄並 scrollIntoView。
- 個人進度按鈕已移除，整併到全班加入狀態表格。
- 推進成功後，對應 session 的按鈕需立即消失。

Loading 規則（#270）：

- 學習管理操作需顯示 processing，但僅鎖相關按鈕或區塊。
- 開始、暫停、結束、重新整理、刪除只鎖該課程列對應按鈕。
- 一鍵切換 Step 只鎖該小組推進按鈕。
- 查看對話只鎖該小組查看按鈕並局部載入詳情。
- 查看個人紀錄只鎖該學生查看按鈕與個人紀錄區塊。
- 不得因單一操作讓整個學習管理頁不可瀏覽。

輪詢規則（#239）：

- 課堂儀表板觀察狀態需自動輪詢 monitor。
- 起始 3 秒。
- payload 無變化時延遲翻倍，上限 30 秒。
- 偵測到變化立即重置 3 秒。
- payload hash 使用 sessionId/currentStep/訊息數/最後訊息時間/personalSteps。

#### 6.6.4 學習管理：加入狀態與對話紀錄

全班加入狀態（#247）：

- 人數統計依實際已加入課程者，不得直接以 group participants 視為已加入。
- 欄位：序號、姓名（帳號）、加入狀態、所在組別、目前進度、發言數、最後發言時間、動作。
- 查看按鈕呼叫 `loadProgress(sessionId, username)` 載入個人對話紀錄。
- 原獨立個人進度表已移除。

小組/個人對話紀錄（#236、#245、#246、#249）：

- 訊息依步驟編號分組。
- 每個步驟顯示為獨立可展開/收起卡片。
- 步驟卡預設全部關閉。
- 區塊標題右側提供整體展開/關閉按鈕，整體預設關閉。
- 切換按鈕固定 3em 寬度，深色文字，文字為「展開」或「關閉」。
- 訊息需以 HTML 渲染 Markdown。
- 小組對話紀錄內建小組選擇器，選項格式 `小組 N: 姓名1 (帳號1), ...`。
- 個人對話紀錄內建學生選擇器，選項格式 `小組 N: 姓名 (帳號)`。
- 未選擇時顯示提示文字。
- 小組對話紀錄：Step3 完成結構樹顯示於步驟 2 卡片末尾；Step4 修正後結構樹顯示於步驟 4 卡片末尾。
- 個人對話紀錄：Step3 完成結構樹顯示於步驟 3 卡片末尾；Step4 修正後結構樹顯示於步驟 4 卡片末尾。
- 結構樹 SVG 不可置於整個對話面板頂部，須依步驟順序與訊息穿插顯示。
- 對話訊息若含 Mermaid 結構樹，需於訊息下方同步渲染 SVG。

#### 6.6.5 學習管理：卡關偵測

卡關偵測由 `src/lib/learning-diagnostics.ts` 支援：

- `getStepAdvanceHint(session).ready` 為 true 時標示可推進並提供一鍵推進。
- 目前 group gate 有未完成組員且最後事件距今 >= 10 分鐘，標示高風險。
- 有未完成組員但未達高風險門檻，標示留意。
- 無未完成組員但最後事件距今 >= 10 分鐘，標示留意。
- 同一學生多次被回答品質檢查拒絕時標示留意；3 次以上可升高風險。
- Step3 未完成且結構樹過少，依字數與閒置時間標示留意或高風險。
- Step3 長時間未更新結構樹時標示留意。
- Step6 個人步驟停在 Step6 且初稿字數偏低時標示留意或高風險。
- 儀表板提醒欄需顯示主要原因、其他原因、需關注學生與至少一項老師可採取的建議。

#### 6.6.6 課程管理

課程管理分頁包含子分頁（#253）：

- 寫作主題設定（admin only）。
- 寫作任務設定（teacher/admin）。

教師端僅顯示寫作任務設定；admin 預設選中寫作主題設定。

寫作主題管理（admin only）：

- 管理 title、genre、引導說明、enabled。
- 文體選項：議論文、記敘文、說明文、抒情文、其他。
- 引導說明使用較大 textarea。
- 主題清單含編輯與啟用/停用按鈕。
- 啟用中僅停用可按；停用中僅啟用可按。

增修寫作任務（#251、#252、#254、#255）：

- 卡片內分為「文章設定」與「小組分配」。
- 教師班級選單列出該教師所屬學校班級，格式 `${學校} ${班級號碼}`。
- admin 先選學校，再依學校選班級。
- admin 選班級後顯示綁定教師：`${name} (${username})`。
- 寫作任務儲存時 ownerTeacherUsername 一併寫入。
- 時長輸入正整數。
- 主題下拉顯示 `essayId / title`；新任務僅可選啟用主題。
- 補充資料使用較大 textarea。
- 選定班級後顯示分組區，含小組數量、隨機平均分組、先建空組、未分配學生與各小組拖拉區。
- 調整小組數量時動態增刪小組；刪除小組成員回到未分配。
- 提交按鈕依模式顯示新增班級任務或儲存班級任務。
- 儲存流程：POST `/api/admin/openclasses` -> POST `/api/admin/groups` -> `refreshAll()`。
- 驗證：學校（admin）、班級、主題、時長必填；至少一組；未分配學生必須為 0。
- 儲存 UX：按鈕 disabled 顯示「處理中...」，下方顯示藍底進度提示，成功後綠底提示 5 秒。

寫作任務管理（#251、#254、#256、#257）：

- 教師只看自己所屬學校任務。
- admin 提供學校、班級篩選。
- 排序依 openClass id 序號由新到舊。
- 每頁 10 筆。
- 欄位：ID、學校、班級、主題、時長、補充資料、操作。
- 編輯按鈕載入任務與分組並 scrollIntoView 到增修卡。
- 刪除按鈕僅在 `hasStudentActivity === false` 時顯示。
- DELETE 權限：admin 不限制；teacher 只能刪除自己擁有且尚無學生訊息的任務；legacy 任務退回 class-scope 檢查。
- 刪除 UX 同帳號管理。

### 6.7 Admin `/admin`

- 與教師端共用帳號管理、課程管理與學習管理能力，但權限為全域。
- 主標題固定為「系統管理員控制台」。
- admin 需提供 Prompt / LLM 診斷面板；教師端 `/teacher` 不顯示。

診斷面板需顯示（#250）：

- LLM 設定狀態，只顯示 URL/key/model 是否存在，不顯示 secret。
- Prompt config key counts。
- 近期 spec10 session 摘要。
- Streaming 端點呼叫統計：`step6_suggest`、`step6_complete`、`step10_stream` 的總呼叫、錯誤數、錯誤率、平均/中位數/P95 耗時、樣本數。
- LLM 回應時間（依步驟），過大閒置間隔需濾除。
- LLM fallback 觸發率；> 5% 紅燈，1~5% 黃燈，< 1% 綠燈。
- 作品 artifact 健康度：Step3 結構樹、Step6 初稿、Step8 潤飾稿、Step10 報告完成率與平均字元數。
- 不得回傳 `LLM_KEY`、DB URL 或其他 secret。

## 7. API 契約

### 7.1 Auth

#### `POST /api/auth/login`

Request:

```json
{ "username": "teacher", "password": "teacher123" }
```

Response:

```json
{ "ok": true, "user": { "username": "teacher", "role": "teacher" }, "redirectTo": "/teacher" }
```

Error:

- `401 { error: "invalid_credentials" }`
- `429 { error: "rate_limit_exceeded", retryAfterSeconds: N }`
- `503 { error: "auth_service_unavailable", detail: string, hint: string }`

登入實作要求：

- 資料表初始化首次失敗不可永久快取失敗狀態；後續請求必須可重試。
- 既有使用者資料表存在時，登入不得強依賴 `CREATE TABLE` 權限。
- 初始化遇 DDL/DML 權限不足不得直接造成登入不可用。
- transaction pooler 模式需停用 prepared statements，並採短 idle timeout，避免 `MaxClientsInSessionMode`。

#### `GET /api/auth/me`

- 已登入：`{ authenticated: true, user }`。
- 未登入：`401 { authenticated: false }`。
- Cookie 身份與使用者資料不一致時，也回傳 `401 { authenticated: false }`。

#### `POST /api/auth/logout`

- 清除 cookie。

#### `GET /api/health`

- 回傳基礎服務狀態與儲存模式。
- DB 欄位：`db.enabled`、`db.ok`、`db.detail`。
- `db.detail` 不可含敏感憑證。

### 7.2 Student APIs

#### `GET /api/student/activities`

- 權限：student。
- 回傳自己可參與 activities。
- 支援 `?limit=N&offset=N`，預設 `limit=50`、`offset=0`。
- 回應：`{ activities: [...], total: N, limit: N, offset: N }`。

#### `GET /api/student/overview`

回傳：

- `profile`
- `missingFields`
- `classCourses`，含 `groupStatus`
- `upcomingCourses`
- `activeCourses`
- `pausedCourses`
- `participatedCourses`

#### `POST /api/student/join`

Request:

```json
{ "activityId": "oc-001" }
```

行為：

- 找 activity 與自己所在 group。
- 有分組但找不到學生分組時回 `403 not_group_member`。
- 有舊 session 則回舊 session。
- 否則建立 `workflow: "spec10"` session。

Error:

- `403 forbidden`
- `404 activity_not_found`
- `403 not_group_member`
- `400 course_not_started`
- `400 course_paused`
- `400 course_ended`
- `500 student_join_failed`

#### `GET /api/student/history?activityId=...`

- 回傳該 student 參與過的 sessions，可選 activity 過濾。

#### `GET /api/student/course-history/[activityId]`

回傳指定課程：

- `summary`
- `latestWork`
- `sessions`

### 7.3 Session & Chat APIs

#### `POST /api/session/start`

- 建立通用 session，需 participants。

#### `GET /api/session/:sessionId`

- 讀 session payload。
- 支援 conditional GET。
- 回應包含 `ETag: "updated_at"`。
- 若 `If-None-Match` 相符，回傳 304 無 body。
- Presence 為 in-process 側記，不寫入 session payload。

#### `POST /api/chat/send`

Request:

```json
{ "sessionId": "...", "userId": "student", "text": "..." }
```

行為：

- 以 server cookie 驗證學生身份，忽略前端 `userId`。
- 僅允許 `student` 身份。
- 學生回答品質檢查失敗時，回傳 `error` 與 `hint`。

常見 error：

- `unknown_participant`
- `step_non_interactive`

#### `POST /api/session/artifact/save`

Request:

```json
{ "sessionId": "...", "type": "outline|draft6|draft8", "content": "..." }
```

限制：

- 需 student。
- 需為 session participant。

#### `POST /api/session/step3/complete`

Request:

```json
{ "sessionId": "...", "outline": "..." }
```

行為：

- 權限：student 且需為 session participant。
- 僅允許 Step3。
- 寫入 `groupGate["3-complete"]`，名單去重。
- 寫入 Step3 完成快照。

#### `POST /api/session/step3/stream`

- 權限：student 且需為 session participant。
- 僅允許在學生個人 Step3 呼叫。
- 以 SSE streaming 回傳 AI 回覆 chunk。
- 完成時後端需寫入學生提問與 AI 回覆，並在 `done` event 回傳最新 session。
- 失敗時需回傳可讀 fallback 或 `error` event，不得讓前端無限 loading。

#### `POST /api/session/step4/complete`

Request:

```json
{ "sessionId": "...", "outline": "..." }
```

行為：

- 權限：student 且需為 session participant。
- 僅允許 Step4。
- 完成前保存學生目前結構樹。
- 寫入 `groupGate["4-complete"]`，名單去重。
- 完成後該學生 Step4 編修與發言鎖定。

#### `POST /api/session/step5/continue`

- 權限：student 且需為 session participant。
- 用於 Step5 摘要顯示後，將該學生個人步驟推進到 Step6。
- 不要求同組其他學生同步前進。

#### `POST /api/session/step6/suggest`

Request:

```json
{ "sessionId": "...", "draft": "..." }
```

行為：

- 權限：student 且需為 session participant。
- 僅允許個人 Step6。
- 以 `stepPrompts["6"]` 與學生草稿呼叫 LLM。
- 以 SSE streaming 回傳修改建議。
- 完成後將 AI 建議追加到 session messages。

#### `POST /api/session/step6/complete`

Request:

```json
{ "sessionId": "...", "draft": "..." }
```

行為：

- 權限：student 且需為 session participant。
- 僅允許個人 Step6。
- 前後端皆需使用草稿品質檢查。
- 通過後保存 `draftStep6[username]`。
- 以 SSE streaming 產生 Step7 分析回饋。
- 完成後將該學生個人步驟推進到 Step8。

Error:

- `400 { "error": "draft_insufficient", "hint": "..." }`

#### `POST /api/session/step8/complete`

Request:

```json
{ "sessionId": "...", "draft": "..." }
```

行為：

- 權限：student 且需為 session participant。
- 僅允許個人 Step8。
- 需檢查最終稿品質，拒絕過短、隨機字串、敷衍詞過多、抄題或關聯性不足。
- 通過後保存 `draftStep8[username]`。
- 完成後將該學生個人步驟推進到 Step9。

#### `POST /api/session/step10/stream`

Request:

```json
{ "sessionId": "..." }
```

行為：

- 權限：student 且需為 session participant。
- 僅在學生個人 Step10 且 `reports.step10[username]` 尚未存在時觸發。
- 以 SSE streaming 回傳個人總結報告。
- 完成後寫入 `reports.step10[username]` 與 AI 訊息。

#### `POST /api/session/advance-phase`

- legacy phase workflow 相容路由。
- 現行 `spec10` 流程以 step-specific routes 與 `switchStep` 為主。

### 7.4 Teacher Learning APIs

#### `POST /api/teacher/step`

Request:

```json
{ "sessionId": "...", "step": 6 }
```

- 權限：teacher/admin。
- 使用 `switchStep`。

#### `GET /api/teacher/monitor`

- 回傳 `workflow === "spec10"` session 摘要。
- 預設不回傳完整對話內容。
- 支援 `?limit=N&offset=N`，預設 `limit=50`、`offset=0`。
- 回應：`{ sessions: [...], total: N, limit: N, offset: N }`。
- 摘要包含 `messageCount`、`lastMessageAt`、`studentMessageStats`、`stepReadyHints`、`artifactDiagnostics`。
- 完整小組詳情使用 `?sessionId=...&detail=full`。
- detail 模式才回傳完整 `messages`、`outlines`、`step3SubmittedOutlines`。
- 目前分頁為應用層分頁；DB 層分頁是後續優化。

#### `GET /api/teacher/personal-progress?sessionId=...&username=...`

- 權限：teacher/admin。
- 回傳 participant 個人進度統計。
- `username` 有值時回傳個人訊息、`userOutline`、`userStep3SubmittedOutline`。

#### `POST /api/teacher/course-control`

Request:

```json
{ "activityId": "oc-001", "action": "start|pause_resume|end" }
```

狀態轉移：

- `start`：`not_started -> in_progress`
- `pause_resume`：`in_progress -> paused`、`paused -> in_progress`、`ended -> in_progress`
- `end`：`in_progress|paused -> ended`

### 7.5 Admin / Course APIs

#### `GET /api/admin/diagnostics`

- 權限：admin only。
- 回傳非敏感診斷摘要。
- 不得回傳 secret。

#### `GET/POST /api/admin/essays`

- 權限：teacher/admin。
- 管理寫作主題主資料。
- 可透過 `enabled` 切換啟用狀態。

#### `GET/POST /api/admin/prompts/essay`

- 權限：teacher/admin。
- 唯讀檢視系統參數 JSON。
- `POST` 不允許寫入，回傳 `prompt_config_readonly_use_filesystem_json`。

#### `GET/POST /api/admin/openclasses`

- 權限：teacher/admin。
- GET：admin 看全部，teacher 僅看可見班級任務。
- POST 欄位：`id? classNumber essayId durationMinutes supplemental school?`。
- teacher 僅可對可見班級操作。
- 停用主題不可建立新任務（`essay_disabled`）。
- 既有任務若已綁定停用主題，仍可維持與編輯。

#### `GET/POST /api/admin/prompts/openclass`

- 權限：teacher/admin。
- 唯讀檢視系統參數 JSON。
- `POST` 不允許寫入，回傳 `prompt_config_readonly_use_filesystem_json`。

#### `GET /api/admin/activities`

- 權限：teacher/admin。
- 回傳可見範圍 activities 與 `studentCandidates`。

#### `POST /api/admin/groups`

Request:

```json
{ "activityId": "oc-001", "groups": [{ "groupId": "g1", "groupName": "1", "members": ["student"] }] }
```

行為：

- 依活動班級推導 `allowedStudents`。
- 只保留允許學生並去重。
- `groupName` 正規化為數字字串。

#### `GET/POST/PUT/DELETE /api/admin/users`

- 權限：teacher/admin。
- teacher 只能管理自己與自己學生。
- student 必須有 `ownerTeacherUsername` 與 `classNumber`。
- 禁止自刪。
- 禁止不合法角色變更。
- 支援 CSV 批次建立，6/7 欄，且 `classnumber` 必為第一欄。

## 8. Prompt 與 LLM 配置

### 8.1 PromptConfig 結構

```ts
{
  systemPrompt?: string;
  stepPrompts: Record<string, string>;
  subStepPrompts: Record<string, string>;
  subStepPromptsFallbacks?: Record<string, string>;
  questionBanks: Record<string, string[]>;
  step9Questions?: Record<string, string>;
  stepOpenings?: Record<string, string>;
}
```

套用規則：

- 全系統統一使用 `src/config/system-prompt-config.json`。
- 不再依主題或任務做 prompt 覆蓋。
- 若 JSON 有 `writingTasks`，依目前活動 `essayId` 或 `title` 匹配題目專屬 `questionBanks`。
- 開發團隊透過修改 JSON 並 CI/CD 部署到 production。
- 實作函式：`resolvePromptConfigForActivity(activityId)`。

### 8.2 Step Opening

- 步驟名片介紹詞僅在 Step `1/2/3/4/6/8/9` 顯示。
- Step `5/7` 不顯示。
- 內容讀取 `src/config/step-opening/{step}.md`。
- 需以 HTML 呈現 Markdown 格式。
- 原先 `任務：xxx / Session: xxx` 顯示需移除。

### 8.3 LLM Token 預算

| 步驟 | maxTokens | 備註 |
|---|---|---|
| 1, 2 | 500 | 群組對話短 JSON，啟用截斷續寫避免殘句 |
| 3 | 600 | 結構樹輔導短回覆 |
| 4 | 800 | 群組討論引導，`continueOnTruncation: false` |
| 5~10 | 1200 | 長文輸出 |

Continuation 策略：

- Step4：`continuationMaxRounds = 0`。
- Step1/2/3/6/7/8/10：`continuationMaxRounds = 1`。

### 8.4 System Prompt Cache

- `session.systemPromptCache: Record<string, string>`。
- Key 為 `${step}` 或 `${step}:${substepKey}`。
- 第一次呼叫 `generateAiTextForStep` 時組裝並寫入快取。
- 後續呼叫直接讀取，避免重複拼接。
- Cache 隨 session 持久化；`promptConfig` 建立 session 時固定，無需失效。

## 9. 預設資料（Bootstrap）

預設帳號（開發與初始化用途）：

- `admin / admin123`
- `teacher / teacher123`
- `student / student123`（班級 701，綁 teacher）
- `s1 / student123`（班級 701，綁 teacher）
- `s2 / student123`（班級 701，綁 teacher）
- `s3 / student123`（班級 702，綁 teacher）

預設 essays：

- 開發期重設後預設為空。

預設 openClasses：

- 開發期重設後預設為空。

## 10. 安全設定

### 10.1 API Rate Limiting

所有 `/api/*` 路由在 `middleware.ts` 中以 in-process sliding window 限速。

| 路徑前綴 | 上限 | 視窗 |
|---|---|---|
| `/api/auth/login` | 10 次 | 每 IP / 60 秒 |
| `/api/chat/send` | 30 次 | 每 IP / 60 秒 |
| 其他 `/api/*` | 120 次 | 每 IP / 60 秒 |

超過限制：

```http
HTTP 429
Retry-After: <秒數>
```

```json
{ "error": "rate_limit_exceeded", "retryAfterSeconds": N }
```

注意：

- 狀態儲存於 process memory `Map`，不跨 Edge 副本共享。
- IP 從 `x-forwarded-for` 第一個值或 `x-real-ip` 取得。

### 10.2 Session Cookie

| 屬性 | 值 |
|---|---|
| `httpOnly` | `true` |
| `sameSite` | `"strict"` |
| `secure` | production 為 `true` |
| `path` | `/` |
| `maxAge` | 43200 秒（12 小時） |

`sameSite: "strict"` 確保 cookie 不隨跨站請求傳送，以降低 CSRF 風險。

## 11. 不變量

未來修改或 AI 生成程式碼時必須維持：

1. 同校同班只能對應單一教師。
2. teacher 的任務與分組操作必須受可見班級限制。
3. 建立寫作任務時，班級與主題必須來自可選清單。
4. Prompt 僅能來自 `src/config/system-prompt-config.json`，不可由 UI/API 寫入 DB。
5. Step1/2 必須維持所有組員回覆才 AI 回覆的 group gate。
6. Step5/7/10 必須是 non-interactive。
7. student artifact 只能存到自己參與的 session。
8. store 必須維持有 DB 用 DB、無 DB 用 memory/file fallback 的雙模式。
9. `/api/student/join` 必須遵守課程狀態限制。
10. 停用主題不可建立新寫作任務，但既有任務不受影響。
11. 學生端不得顯示 internal prompt 或 system prompt 原文。
12. Step5+ 個人步調不得混入其他學生個人訊息。
13. 教師端 monitor 不得暴露學生 Step6/8 草稿全文。

## 12. 已知限制

1. 無 DB 環境下，domain 依賴 `.data/domain-state.json`；檔案不可寫或被清空會回預設。
2. 群組隨機分配採前端簡單亂數，不含 seed，無法保證可重現。
3. Prompt 變更需改檔案並重新部署，不支援線上即時編輯。
4. Rate limiting 為 in-process，不跨 Edge 副本共享。
5. `/api/teacher/monitor` 分頁目前為應用層分頁；大規模部署需改 DB 層查詢。
6. Presence 為 in-process Map，不持久化也不跨副本共享，重啟後重置。

## 13. 資料庫遷移與維運

- Postgres 遷移到 Supabase 的標準流程文件：`SUPABASE_MIGRATION.md`。
- 標準腳本：
  - `scripts/supabase/migrate_to_supabase.sh`：備份、還原、row count 比對。
  - `scripts/supabase/verify_migration.sh`：關鍵表/JSON 檢查、可選 API smoke test。
- 環境變數切換時，應以 `SUPABASE_DB_URL` 為唯一主來源。
- 若保留 `POSTGRES_URL` / `DATABASE_URL`，三者必須同步指向同一 Supabase DB。
- 遷移完成後必須執行驗證與手動 smoke test，再切 production 流量。

## 14. 重建指引

若要重建相同行為系統，至少需完整實作：

1. `types.ts` 的核心型別，特別是 `UserAccount.classNumber`、`Activity.classNumber/essayId`。
2. `engine.ts` 的 10 步驟模式、group gate、personalSteps、reflection 行為。
3. `user-store.ts` 的衝突檢查與 role-based CRUD。
4. `activity-store.ts` / `mock-data.ts` 的 open class、course status、groups、prompt config 載入與 sanitizer。
5. `admin/users`、`admin/openclasses`、`admin/activities`、`admin/groups` 的可見範圍過濾。
6. `/student` 的課程入口、進度軌、下一步任務卡、Step3/4 結構樹、Step6/8 草稿與保存狀態。
7. `/teacher` 的帳號管理、課程管理、學習管理、課堂儀表板、分步驟對話紀錄。
8. `/admin` 的全域管理與 Prompt / LLM 診斷面板。
9. Remote LLM fallback、SSE streaming、文字淨化與錯誤訊息轉譯。
10. `npm test` 與 `npm run build` 必須通過。
