# LLM4Writing 現行系統規格書（Implementation Spec）

- 文件版本：`2026-04-18`
- 對齊程式：目前 `main` 分支（Next.js 16 App Router 版本）
- 文件用途：讓其他 AI / 工程師可依本文件重建「相同行為」系統
- 規格性質：**以現行實作為準**（非產品理想狀態）

---

## 1. 系統定位與範圍

本系統是 AI 輔助寫作教學平台，包含三種角色：

- `student`：加入寫作任務、進行 10 步驟學習互動、儲存草稿與大綱
- `teacher`：管理自己管轄的學生/任務、控制課程狀態（開始/結束）、切換步驟、檢視進度、分組
- `admin`：跨教師全域管理帳號與任務

核心組成：

- 前端：Next.js App Router 頁面
- 後端：Next.js Route Handlers (`app/api/**`)
- 狀態/資料：
  - `Session` 儲存在 Postgres（若無 DB 退回 memory）
  - `User` 儲存在 Postgres（若無 DB 退回 memory）
  - `Essay/OpenClass/Groups` 儲存在 Domain Store（Postgres 啟用時持久化；否則退回 memory）
  - `PromptConfig` 由檔案系統 `src/config/system-prompt-config.json` 載入
  - （可選）`Remote LLM` 由環境變數啟用，供 engine 產生 AI 回覆（未設定時使用 stub）

---

## 2. 技術架構

## 2.1 執行環境

- Node.js + Next.js 16
- React 19
- TypeScript 5
- `postgres` npm 套件

## 2.2 儲存策略

### Session Store

- 檔案：`src/lib/store.ts`
- 啟用條件：`SUPABASE_DB_URL`（優先）或 `POSTGRES_URL` / `DATABASE_URL`（相容 fallback）有值
- Supabase 連線建議：serverless 情境優先 transaction pooler（常見 port `6543`）；可用 `SUPABASE_POOL_MODE=transaction` 強制模式
- Postgres 表：`llm4writing_sessions`
  - `id TEXT PRIMARY KEY`
  - `payload JSONB`
  - `created_at`
  - `updated_at`
- 無 DB 時：使用 `globalThis` memory map（重啟即遺失）

## 2.3 Remote LLM（可選）

目的：讓部署到 Vercel 的環境可透過環境變數切換不同 LLM 供應商（OpenRouter/OpenAI/Gemini 轉接服務等），不需要改程式碼。

- 設定位置：Vercel Project Settings -> Environment Variables
- 環境變數（全部都要有值才會啟用）：
  - `LLM_URL`：OpenAI-compatible Chat Completions API URL
  - `LLM_KEY`：API key（不可出現在前端程式碼）
  - `LLM_MODEL`：模型名稱
- 程式行為：
- 若三者皆有：`src/lib/engine.ts` 在需要 AI 回覆時，會呼叫 `src/lib/llm-client.ts` 對遠端 LLM 送出請求並將回覆寫入 session messages
- 若缺任一：使用內建 stub 回覆文字（讓 UI 流程可跑，但不代表真實 LLM）
- 若遠端 LLM 回傳格式不符或請求失敗：先進行最多 3 次短暫退避重試；仍失敗時自動 fallback 為內建回覆，不中斷課程流程

### User Store

- 檔案：`src/lib/user-store.ts`
- 啟用條件同 Session
- Postgres 表：`llm4writing_users`
  - `username TEXT PRIMARY KEY`
  - `payload JSONB`
  - `password TEXT`
  - `created_at`
  - `updated_at`
- 啟動時會 backfill 預設帳號（`ON CONFLICT DO NOTHING`）
- 無 DB 時：使用 `globalThis` memory map

### Domain Mock Store

- 檔案：`src/lib/mock-data.ts`
- 內容：`users`、`userPasswords`、`essays`、`openClasses`、`activityGroupMap`、`courseStatusMap`
- Postgres 啟用時：
  - 表：`llm4writing_domain`
  - 主鍵固定 `id='singleton'`，`payload` 存整體 domain JSON
  - 相關 API 會先 hydrate 再操作，變更後 flush 回 DB
  - hydrate 讀取路徑不得強制觸發 flush；當 DB 寫入受限時，讀取仍需可降級為記憶體快照（避免課程清單整體 500）
  - 若遇 DDL 權限不足（如 `permission denied`），建表流程需容錯，不能阻斷讀取 API
- 無 DB 時：
  - 優先使用檔案持久化：`.data/domain-state.json`
  - 並同步維持 `globalThis` memory state

---

## 3. 核心資料模型

來源：`src/lib/types.ts`

## 3.1 UserAccount

```ts
{
  username: string;
  name: string;
  school: string;
  role: "student" | "teacher" | "admin";
  ownerTeacherUsername?: string; // student 才有
  classNumber?: string; // student 才有
}
```

## 3.2 Essay（在 mock-data 中）

```ts
{
  id: string;
  title: string;
  genre: string;
  description: string;
  enabled: boolean;
}
```

## 3.3 OpenClassTask / OpenClassView（在 mock-data 中）

儲存主體（Task）：

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

對外顯示（View）會補：

```ts
{
  essayTitle: string;
  essayGenre: string;
}
```

## 3.4 Activity

API 輸出給學習/分組流程使用：

```ts
{
  id: string; // 對應 openClass id
  school: string;
  classNumber: string;
  essayId: string;
  title: string; // essay title
  genre: string; // essay genre
  essayDescription?: string; // essay 引導說明
  durationMinutes: number;
  supplemental: string;
  groups: ActivityGroup[];
  courseStatus?: "not_started" | "in_progress" | "paused" | "ended";
}
```

## 3.5 SessionState

```ts
{
  id: string;
  createdAt: string;
  currentStep: number;
  participants: string[];
  messages: ChatMessage[];
  groupGate: Record<string, string[]>;
  reflectionIndex: Record<string, number>;
  workflow: "spec10" | "legacy_phase";
  phaseMax: number;
  activityId?: string;
  activityTitle?: string;
  groupId?: string;
  groupName?: string;
  promptConfig: PromptConfig;
  stepState: { step1Substep: number; step2Substep: number };
  outlines: Record<string, string>;
  draftStep6: Record<string, string>;
  draftStep8: Record<string, string>;
  reports: {
    step5?: string;
    step7: Record<string, string>;
    step10: Record<string, string>;
  };
}
```

---

## 4. 權限與資料邊界

## 4.1 角色

- `student`：只能操作自己參與的 session 與 artifact
- `teacher`：僅可管理自己名下學生、自己可見班級的任務與分組
- `admin`：可管理全域

## 4.2 教師可見範圍定義

教師可見學生：

- 條件：`role = student` 且 `ownerTeacherUsername = 教師username`

教師可見班級：

- 由上述學生集合的 `(school, classNumber)` 推導

教師可見寫作任務（open classes）：

- 任務的 `(school, classNumber)` 必須落在教師可見班級集合

教師可操作分組候選學生：

- 可見學生中，`student.school == activity.school && student.classNumber == activity.classNumber`

## 4.3 班級歸屬規則（重要）

同一學校 + 同一班級號碼，不可同時掛在不同教師名下：

- 建立/更新 student 都會檢查 `class_owner_teacher_conflict`

---

## 5. 學習步驟引擎規格

來源：`src/lib/engine.ts` + `src/lib/spec.ts`

## 5.1 步驟與模式

- 1 審視題目：`group_interaction`
- 2 蒐集資料：`group_interaction`
- 3 生成論點：`personal_interaction`
- 4 對比修正：`group_interaction`
- 5 摘要報告：`non_interactive`
- 6 撰寫初稿：`personal_interaction`
- 7 分析回饋：`non_interactive`
- 8 修改潤飾：`personal_interaction`
- 9 個人反思：`personal_reflection`
- 10 總結報告：`non_interactive`

## 5.2 Step 1 / Step 2 子步驟門檻

- Step1 有 5 個子步驟
- Step2 有 4 個子步驟
- 每個子步驟需「全部 participants 都回覆至少一次」，AI 才回覆並進入下一子步
- Gate key 格式：`"{step}-{substep}"`

## 5.3 問題來源優先序

依 `SPEC_yunchieh.md` 對應規則：

1. Step 1
- `1-1`、`1-2`、`1-5`：取 `questionBanks["1-1"|"1-2"|"1-5"]` 隨機抽題
- `1-3`、`1-4`：取 `subStepPrompts["1-3"|"1-4"]`（無值時 fallback）
2. Step 2
- `2-1`、`2-2`、`2-3`：取 `subStepPrompts["2-1"|"2-2"|"2-3"]`（無值時 fallback）
- `2-4`：取 `questionBanks["2-4"]` 隨機抽題

`questionBanks` 的主要來源為 `writingTasks[essayId].questionBanks`（依任務 `essayId` 取用）。

子步驟轉接規則：
- 在 Step1/2 的 AI 回覆中，若包含「請回答以下問題」段落，系統會將該段落內容抽出，作為「下一子步驟」的系統提問。
- 同時，該段落不再保留於當前 AI 回覆，避免重複顯示。

## 5.4 LLM Prompt 組裝

課程進行中（有啟用遠端 LLM）時，`system` 訊息組裝規則：

1. 全域 `systemPrompt`
2. 當前步驟 `stepPrompts[String(step)]`
3. 若為 Step 1/2，附加目前子步驟 key（例如 `1-3`）對應的：
- `subStepPrompts[key]`（若存在）
- `questionBanks[key]`（若存在）

也就是 Step 1 會使用 `systemPrompt + stepPrompts["1"]`，Step 2 會使用 `systemPrompt + stepPrompts["2"]`，餘依此類推。

## 5.5 非互動步驟行為

教師切到非互動步驟時即生成：

- Step5：彙整步驟 1~4 最近訊息，寫入 `reports.step5`
- Step7：為每位 participant 生成 `reports.step7[user]`
- Step10：為每位 participant 生成 `reports.step10[user]`

## 5.6 個人反思（Step9）

- 固定 4 題反思題
- student 每送一次訊息，`reflectionIndex[user] + 1`
- 未達 4 題：系統送下一題
- 完成：系統送「個人反思完成」

## 5.7 Artifact 儲存

student 可儲存三種內容：

- `outline` -> `session.outlines[username]`
- `draft6` -> `session.draftStep6[username]`
- `draft8` -> `session.draftStep8[username]`

---

## 6. 前端頁面規格

## 6.1 `/login`

- 帳密登入，寫入 HTTP-only cookie：
  - `llm4w_user`
  - `llm4w_role`
- 依角色導向：
  - student -> `/student`
  - teacher/admin -> `/teacher`
- 登入後首頁右上角顯示身分格式：
  - `學校 – 姓名 (帳號)`

## 6.2 `/student`

主要能力：

1. 首頁顯示四類清單：
   - 「進行中課程（本班）」
   - 「尚未開始課程（本班）」（來自 `/api/student/overview`，條件為同校同班且 `courseStatus=not_started`）
   - 「暫停中課程（本班）」
   - 「自己參與過的課程清單」（依最近參與時間排序）
   - 各課程列顯示分組狀態（`尚未分組` / `未分配` / `第 X 組`）
2. 若學生資料缺漏（`school` / `classNumber` / `ownerTeacherUsername`），顯示警告訊息提醒向老師反映。
3. 點進行中課程的「進入課程」會直接呼叫 `/api/student/join` 進入討論，不需二次確認。
4. 點尚未開始課程的「進入課程」可進入準備階段；在準備階段按「檢查並進入討論」才呼叫 `/api/student/join`。
5. 若課程尚未開始、暫停中或已結束，`/api/student/join` 會回傳錯誤，前端顯示對應提示。
6. 點已參與課程的「查詢紀錄」導向 `/student/history/[activityId]`，顯示該課參與摘要、歷次 session 與個人最後作品/回饋。
7. 進入 session 後顯示「精簡課程資訊列」：同一卡整併題目、班級、文體、時長、小組、組員，並在下方補充引導說明與補充資料，盡量縮小上方區塊空間，主要畫面保留給課程互動內容。
8. 一旦進入 session，學生頁會切換到課程內容視圖（提供「返回課程清單」按鈕）。
9. 步驟資訊區中，`子步驟` 與 `模式` 需合併同列顯示（例如：`目前子步驟：1-1 ｜ 模式：小組互動`）。
10. 對話紀錄區要用 HTML 排版渲染訊息內容（可顯示標題、粗體、段落、清單），不可只用純文字平鋪。
11. 學生端「互動區」僅在「互動內容最後一則為系統提問」時顯示回答輸入框（標籤為「你的回答」）。
12. 學生端「互動區」中的小組互動提示文案需放在文字輸入框下方，並以較小字體顯示。
13. 學生端課程頁上方「題目／引導說明／補充資料」需使用一般正文字級（不可縮小成 `small` 樣式）。
14. 學生端課程頁中段需顯示「互動內容」：只列系統提問、學生回答（含同組成員）、AI 回覆；不得顯示 system prompt 內容。
14.1 系統提問若來源為內部 prompt（例如 `請討論：...` 類型），互動內容須以非 prompt 原文的學生可理解文案呈現，不得外露 prompt 指令全文。
15. 若互動內容最後一則為提問，顯示文字輸入區；若正在等待同組成員或等待遠端 AI，顯示等待提示，待完成後自動消失。
15.1 Step 1 若已出現「步驟 1 子步驟已完成，等待教師切換下一步。」訊息，需隱藏發送輸入區，並顯示「步驟 1 已完成，請等待老師切換到步驟 2。」提示。
15.2 Step 2 若已出現「步驟 2 子步驟已完成，等待教師切換下一步。」訊息，需隱藏發送輸入區，並顯示「步驟 2 子步驟已完成，請等待老師切換下一步。」提示。
16. 開發除錯模式下，於互動內容下方以 `<hr>` 分隔，另列完整對話紀錄（含原始訊息）供檢查。
17. 小組互動模式下，同一題需允許每位組員各自提交一次：第 1 位提交後，其餘尚未提交者仍可輸入；僅已提交者進入等待狀態。
18. 小組互動模式下，使用者在「自己尚未提交當題答案」前，不顯示其他組員「當前題目回合」回答（前面已完成題目仍可顯示），以避免互相影響。
19. Step3 的「文章結構樹」需支援視覺化節點編輯：
  - 初始僅一個根節點
  - 每個節點可用 `➕` 新增下一層子節點並自動建立連線
  - 第二層以下且無子節點者可用 `➖` 刪除節點
  - 雙擊節點可直接編輯節點文字
  - 所有節點可拖曳調整位置；放到其他節點上可改變隸屬層次（連線同步更新）
  - 當結構樹超出可視範圍時，編輯區需提供水平與垂直捲軸（scroll bar）以支援左右/上下檢視
  - 需提供「儲存變更」按鈕，將目前結構轉為 Mermaid 格式儲存到 `outline`
  - 若 `outline` 已有 Mermaid 存檔，重新載入或重開編輯器時需優先還原該內容，不可重置為預設單一節點
  - 需提供「完成結構樹」按鈕；學生按下後需先自動儲存當前結構樹，再標記該學生已完成 Step3。若同組尚未全員完成，顯示等待其他同學完成提示
  - Step3 完成時需寫入「提交快照」（每位學生獨立），供後續步驟回顧固定顯示，且不受後續修改 `outline` 影響
20. Step3 版面規則：互動內容區需顯示在結構樹編輯器上方。
21. Step3 AI 引導規則：依 `stepPrompts["3"]` 進行可來回的問答引導，直到學生按下「完成結構樹」；引導過程需帶入步驟1/2 對話脈絡。
22. Step3 互動區在無歷史訊息時仍需顯示起始引導文案與輸入區，允許學生直接提問並進入多輪回覆。
23. Step3 互動模式中，AI 僅回覆學生提問，不可主動提出新問題；每次回覆後回到等待學生下一次提問狀態。
24. Step3 學生送出提問後，回覆返回前需顯示「AI 處理中」提示，回覆完成後自動消失。
25. Step3 互動資料隔離：同組學生間不得共享彼此在 Step3 與 AI 的互動內容；每位學生僅可見自己與 AI 的對話與系統提示。
26. Step3 AI 生成上下文需以「該學生個人歷程」為主，帶入該學生自步驟1到當前步驟的互動內容（含必要系統提示），不得混入其他同組學生訊息。
27. Step3 學生端互動區不得顯示 system 提示原文；system 訊息僅供 AI 內部理解，學生畫面只呈現學生與 AI 的自然對話。
28. 學生端進入當前步驟時，需在「課程內容」下方、當前步驟說明上方顯示「前序步驟回顧」：逐步列出步驟 1 到前一個步驟的步驟名稱與個人互動紀錄；紀錄僅顯示該學生本人訊息與 AI 回覆，且不得顯示同組其他同學、教師或 system 內部提問內容。
29. 前序步驟回顧版面需仿照當前步驟：每個回顧步驟以兩張卡片呈現（步驟說明卡、互動內容卡）。
30. 當學生位於 Step4（含之後）時，前序步驟回顧中的 Step3 互動卡底部需以圖片方式顯示「Step3 完成提交當下」的個人結構樹快照，不得改用後續步驟修改後版本。
30.1 舊 session 若缺少 `step3SubmittedOutlines` 快照，進入 Step4（含之後）時需從「Step3 已完成學生」的既有 `outlines` 一次性回補快照，避免回顧區圖形空白。
31. Step4（對比修正）學生端流程需拆成三段卡片：先瀏覽同組同學結構樹（可切換同學）、再編修自己的結構樹（可存檔）、最後進行小組討論。
31.1 Step4「我的結構樹（可編修）」需預設直接展開編修介面，不需額外點擊切換按鈕。
31.2 Step4「我的結構樹（可編修）」載入時需使用該學生目前最新版 `outline`；session 輪詢同步時，若使用者正在本地編修（未存檔）則不得覆蓋本地內容。
32. Step4 同組瀏覽區需即時反映同學最新 `outline`（由 session 輪詢同步）。
33. Step4 小組討論採持續發言模式：同組學生訊息會累積顯示於討論區，不使用單回合 `4-1` 收齊回覆門檻。
33.1 Step4 小組討論的學生訊息呈現格式為「學生名：內容（時間）」；時間使用淺色字體並置於內容後方。
33.2 Step4 若有同組成員已按「確認完成此步驟」，討論區需顯示「{同學} 已確認完成此步驟」提示，並隨完成名單即時更新。
34. Step4 討論區需提供「確認完成此步驟」按鈕；按下時需先自動儲存該學生當前結構樹（含未手動存檔變更）再完成鎖定（不可再發言/編修），並寫入 `groupGate[\"4-complete\"]`。
35. 僅當 `groupGate[\"4-complete\"]` 包含全組 participants 時，教師端狀態提示顯示「可切換到 Step5」。

## 6.3 `/teacher`

三大分頁（目前順序）：

- 帳號管理
- 課程管理
- 學習管理

### 帳號管理

- 帳號 CRUD（teacher/admin 依權限限制）
- reset password
- CSV 批次建帳
- student 帳號必填 `classNumber`
- 使用者清單角色顯示統一中文（學生/教師/管理員）
- 搜尋區塊位於使用者清單上方
- CSV 欄位順序為 `classnumber` 第一欄：
  - `classnumber,username,name,school,role,password`
  - `classnumber,username,name,school,role,password,ownerTeacherUsername`

### 學習管理

- 以課程清單表格顯示所有可見課程（學校 / 班級 / 課程 / 目前狀態），每列提供：
  - `開始上課`
  - `暫停/繼續上課`
  - `結束上課`
  - `查看狀態`
  - `重新整理`
- 依 `courseStatus` 控制按鈕可用狀態：
  - `not_started`：
    - `開始上課` 可按
    - `暫停/繼續上課`、`結束上課`、`查看狀態` disabled（灰色）
  - `in_progress`：
    - `開始上課` disabled（灰色）
    - `暫停/繼續上課` 可按（顯示為「暫停上課」，點擊後狀態轉 `paused`）
    - `結束上課`、`查看狀態` 可按
  - `paused`：
    - `開始上課` disabled（灰色）
    - `暫停/繼續上課` 可按（顯示為「繼續上課」，點擊後狀態轉 `in_progress`）
    - `結束上課`、`查看狀態` 可按
  - `ended`：
    - `開始上課` disabled（灰色）
    - `暫停/繼續上課` disabled（灰色）
    - `結束上課` disabled（灰色）
    - `查看狀態` 可按
- 「開始上課 / 暫停或繼續 / 結束上課」呼叫 `/api/teacher/course-control`
- 「查看狀態」可查看該課程即時或歷史 session 內容，並可繼續使用：
  - 步驟切換（`/api/teacher/step`），僅保留在課程狀態內容中的「步驟切換提示」欄（不另提供獨立切換區塊）
  - 小組訊息檢視（1/2/4）
  - 個人進度與個人互動訊息（完整步驟紀錄，不限 3/6/8）
  - 小組對話紀錄與個人對話紀錄需用 HTML 排版渲染 Markdown 訊息（可顯示標題、粗體、段落、清單）
- 「全班加入狀態」與「分組狀態總覽」的人數統計需依「實際已加入課程者」計算，不得以分組 participants 名單直接視為已加入
- 學習管理操作（課程狀態切換、載入狀態、載入個人進度、切換步驟等）需顯示 processing 提示，完成或失敗後自動結束提示；處理期間相關按鈕 disabled
- 學習管理進入分頁時需主動刷新資料；課程清單載入不得被 monitor/session 查詢阻塞
- 在「步驟切換提示」按下套用下一步且切換成功後，對應 session 的套用按鈕需立即消失（以前端最新 step 狀態即時更新為準）

### 課程管理

- 寫作主題管理：
  - 「說明」欄位文案為「引導說明」
  - 新增/編輯僅維護主題資料（title / genre / 引導說明 / enabled）
  - 「引導說明」使用較大文字輸入區（textarea）
  - 主題清單含「編輯」按鈕，可載入並編輯主題完整內容
  - 主題清單含「啟用 / 停用」按鈕，且按鈕互斥可用：
    - 啟用中：`停用` 可按、`啟用` disabled
    - 停用中：`啟用` 可按、`停用` disabled
- 寫作任務管理（open class）：
  - 班級下拉：來自可見 student 的 classNumber 清單
  - 主題下拉：顯示 `essayId / title`（僅可選啟用主題；編輯既有任務時可保留既有停用主題）
  - 支援新增與編輯
  - 「補充資料」使用較大文字輸入區（textarea）
  - 不提供任務層 prompt 覆蓋欄位
- 組別管理：
  - 先選任務（顯示為「班級 + 任務 + id」）
  - 若該任務「尚未分組」：
    - 顯示「小組數量」（預設 2，最少 1）
    - 可按 `隨機平均分組` 或 `先建空組`
    - 全部學生先顯示於「未分配學生」
    - `儲存分組` 初始為 disabled（灰色）
  - 若該任務「已有分組」：
    - 直接載入既有組數與分組結果
    - 可拖曳調整學生
    - `隨機平均分組` / `先建空組` 仍可按；按下時會先把所有學生重設回「未分配學生」，再依選定模式重建分組
  - 共同儲存條件：
    - 僅當「未分配學生 = 0」時，`儲存分組` 變為可按
    - 儲存後分組結果須落地保存
  - `取消` 按鈕：
    - 放棄目前未儲存的所有分組變更
    - 還原為該任務上次已儲存的組數與成員分配

---

## 7. API 契約（現行）

以下為重點 API，完整路由可參考 `README.md`。

## 7.1 Auth

### `POST /api/auth/login`

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
- `503 { error: "auth_service_unavailable" }`
- 實作要求：資料表初始化若首次失敗，不可將失敗狀態永久快取；後續請求必須可重試初始化
- 實作要求：若使用者資料表已存在，登入流程不得強依賴 `CREATE TABLE` 權限
- 實作要求：初始化過程中若遇 DDL/DML 權限不足（例如 `permission denied`），不得直接造成登入不可用；應容錯並繼續使用既有資料表/資料
- 實作要求：為避免 `MaxClientsInSessionMode`，DB client 在 transaction pooler 模式需停用 prepared statements，並採短 idle timeout

### `GET /api/auth/me`

- 已登入：`{ authenticated: true, user }`
- 未登入：`401 { authenticated: false }`

### `POST /api/auth/logout`

- 清除 cookie

## 7.2 Student

### `GET /api/student/activities`

- 權限：student
- 回傳自己可參與 activities

### `GET /api/student/overview`

- 權限：student
- 回傳：
  - `profile`（含 name/school/classNumber/ownerTeacherUsername）
  - `missingFields`（學生資料缺漏欄位）
  - `classCourses`（同校同班全部課程）
    - 內含每堂課的 `groupStatus`（分組狀態字串）
  - `upcomingCourses`（同校同班且 `courseStatus=not_started`）
  - `activeCourses`（同校同班且 `courseStatus=in_progress`）
  - `pausedCourses`（同校同班且 `courseStatus=paused`）
  - `participatedCourses`（自己曾參與過課程，依最近參與時間排序）

### `POST /api/student/join`

Request:

```json
{ "activityId": "oc-001" }
```

Behavior:

- 找 activity + 自己所在 group
- 有分組時，若找不到學生分組，直接回 `403 not_group_member`
- 有舊 session 則回舊 session
- 否則建立新 session（workflow: `spec10`）

Error:

- `403 forbidden`
- `404 activity_not_found`
- `403 not_group_member`
- `400 course_not_started`
- `400 course_paused`
- `400 course_ended`
- `500 student_join_failed`（含 `detail` 便於偵錯）

### `GET /api/student/history?activityId=...`

- 回傳該 student 參與過的 sessions（可選 activity 過濾）

### `GET /api/student/course-history/[activityId]`

- 權限：student
- 回傳指定課程的：
  - `summary`（參與次數、最近參與時間、最高步驟、個人發言統計）
  - `latestWork`（outline / draft6 / draft8 / step7Report / step10Report）
  - `sessions`（歷次參與紀錄）

## 7.3 Session & Chat

### `POST /api/session/start`

- 通用 session 建立（需 participants）

### `GET /api/session/:sessionId`

- 讀 session payload

### `POST /api/chat/send`

Request:

```json
{ "sessionId": "...", "userId": "student", "text": "..." }
```

Behavior:

- 以 server 端登入 cookie 驗證學生身份，忽略前端傳入 `userId` 欄位
- 僅允許 `student` 身份送出

Error（400）：

- `unknown_participant`
- `step_non_interactive`

### `POST /api/session/artifact/save`

Request:

```json
{ "sessionId": "...", "type": "outline|draft6|draft8", "content": "..." }
```

限制：

- 需 student
- 需為 session participant

### `POST /api/session/step3/complete`

Request:

```json
{ "sessionId": "..." }
```

Behavior:

- 權限：student 且需為 session participant
- 僅允許在 Step3 呼叫
- 於 `groupGate["3-complete"]` 記錄完成者名單（去重）

## 7.4 Teacher Learning APIs

### `POST /api/teacher/step`

Request:

```json
{ "sessionId": "...", "step": 6 }
```

- 權限：teacher/admin
- 使用 `switchStep`

### `GET /api/teacher/monitor`

- 回傳 `workflow === spec10` 的 session 列表與訊息

### `GET /api/teacher/personal-progress?sessionId=...&username=...`

- 權限：teacher/admin
- 回傳 participant 的個人進度統計
- `username` 有值時回傳個人訊息串

### `POST /api/teacher/course-control`

Request:

```json
{ "activityId": "oc-001", "action": "start|pause_resume|end" }
```

- 權限：teacher/admin
- 需在可見課程範圍內
- `start`：`not_started -> in_progress`
- `pause_resume`：
  - `in_progress -> paused`
  - `paused -> in_progress`
  - `ended -> in_progress`
- `end`：`in_progress|paused -> ended`

## 7.5 Admin/Course APIs

### `GET/POST /api/admin/essays`

- 權限：teacher/admin
- 管理寫作主題主資料（title/genre/引導說明）
- 可透過 `enabled` 切換主題啟用狀態

### `GET/POST /api/admin/prompts/essay`

- 權限：teacher/admin
- 改為唯讀檢視系統參數 JSON
- `POST` 不允許寫入（回傳 `prompt_config_readonly_use_filesystem_json`）

### `GET/POST /api/admin/openclasses`

- 權限：teacher/admin
- GET：
  - admin 看全部
  - teacher 僅看可見班級任務
- POST（新增/編輯任務）：
  - 欄位：`id? classNumber essayId durationMinutes supplemental school?`
  - teacher 僅可對可見班級操作
  - 停用中的主題不可建立新任務（`essay_disabled`）
  - 既有任務若已綁定停用主題，仍可維持與編輯

### `GET/POST /api/admin/prompts/openclass`

- 權限：teacher/admin
- 改為唯讀檢視系統參數 JSON
- `POST` 不允許寫入（回傳 `prompt_config_readonly_use_filesystem_json`）

### `GET /api/admin/activities`

- 權限：teacher/admin
- 回傳可見範圍 activities + `studentCandidates`

### `POST /api/admin/groups`

Request:

```json
{ "activityId": "oc-001", "groups": [{ "groupId": "g1", "groupName": "1", "members": ["student"] }] }
```

Behavior:

- 依活動班級推導 `allowedStudents`
- 只保留允許學生，且自動去重
- `groupName` 正規化為數字字串

### `GET/POST/PUT/DELETE /api/admin/users`

- 權限：teacher/admin
- 規則：
  - teacher 只能管理自己與自己學生
  - student 必須有 `ownerTeacherUsername` + `classNumber`
  - 禁止自刪、禁止不合法角色變更
  - 支援 CSV 批次建立（6/7 欄，且 `classnumber` 必為第一欄）

---

## 8. Prompt 配置規格

`PromptConfig` 結構：

```ts
{
  stepPrompts: Record<string, string>;
  subStepPrompts: Record<string, string>;
  questionBanks: Record<string, string[]>;
}
```

套用規則：

1. 全系統統一使用檔案系統 JSON：`src/config/system-prompt-config.json`
2. 不再依主題或任務做 prompt 覆蓋
3. 若 JSON 具有 `writingTasks`，則依目前活動的 `essayId` 或 `title` 匹配題目專屬 `questionBanks`
4. 開發團隊透過修改該 JSON 並經 CI/CD 部署到 production

實作函式：`resolvePromptConfigForActivity(activityId)`

---

## 9. 目前預設資料（Bootstrap）

預設帳號（user-store & mock-data 對齊）：

- `admin / admin123`
- `teacher / teacher123`
- `student / student123`（班級 701，綁 teacher）
- `s1 / student123`（班級 701，綁 teacher）
- `s2 / student123`（班級 701，綁 teacher）
- `s3 / student123`（班級 702，綁 teacher）

預設 essays：

- （開發期重設後預設為空）

預設 openClasses：

- （開發期重設後預設為空）

---

## 10. 不變量（AI 生成時必須遵守）

1. 同校同班只能對應單一教師（student 建立與更新都要檢查）
2. teacher 的任務與分組操作必須受可見班級限制
3. 建立寫作任務時，班級與主題必須來自可選清單（非自由文字）
4. Prompt 僅能來自 `src/config/system-prompt-config.json`（不可由 UI/API 寫入 DB）
5. Step1/2 必須維持「所有組員回覆才 AI 回覆」的 group gate
6. Step5/7/10 必須是 non-interactive（學生送訊息會報錯）
7. student artifact 只能存到自己參與的 session
8. session/user/domain store 必須維持「有 DB 用 DB，無 DB 用 memory」雙模式
9. student 透過 `/api/student/join` 加入時必須遵守課程狀態限制（未開始/暫停/已結束不可加入）
10. 停用主題不可建立新寫作任務，但既有任務不受影響

---

## 11. 已知限制（現況）

1. 無 DB 環境下，domain 依賴本機檔案 `.data/domain-state.json`；若檔案不可寫或被清空，會回預設
2. 群組隨機分配採前端簡單亂數，不含種子與可重現性
3. Prompt 變更需改檔案並重新部署，不支援線上即時編輯

---

## 12. 資料庫遷移與維運

1. Postgres 遷移到 Supabase 的標準流程文件：`SUPABASE_MIGRATION.md`
2. 標準腳本：
   - `scripts/supabase/migrate_to_supabase.sh`（備份、還原、row count 比對）
   - `scripts/supabase/verify_migration.sh`（關鍵表/JSON 檢查、可選 API smoke test）
3. 環境變數切換時，應以 `SUPABASE_DB_URL` 為唯一主來源；若保留 `POSTGRES_URL` / `DATABASE_URL`，三者必須同步指向同一個 Supabase DB
4. 任何遷移作業完成後，必須執行驗證步驟與手動 smoke test，再切 production 流量

---

## 13. 重建指引（給未來 AI）

若要生成相同行為系統，請至少完整實作：

1. `types.ts` 的資料型別（特別是 `UserAccount.classNumber`、`Activity.classNumber/essayId`）
2. `engine.ts` 的 10 步驟模式與 gate / reflection 行為
3. `user-store.ts` 的衝突檢查與 role-based CRUD 規則
4. `mock-data.ts` 的 open class + system prompt config 載入 + group sanitizer
5. `admin/users`, `admin/openclasses`, `admin/activities`, `admin/groups` 路由的可見範圍過濾
6. `/teacher` UI 的：
   - 任務下拉（班級/主題）
   - 任務編輯（無 prompt 覆蓋）
   - 分組兩種方式（隨機、拖曳）

只要上述 6 點一致，系統核心行為即可與目前版本對齊。
