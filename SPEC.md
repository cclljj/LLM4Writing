# LLM4Writing 現行系統規格書（Implementation Spec）

- 文件版本：`2026-04-18`
- 對齊程式：目前 `main` 分支（Next.js 16 App Router 版本）
- 文件用途：讓其他 AI / 工程師可依本文件重建「相同行為」系統
- 規格性質：**以現行實作為準**（非產品理想狀態）

---

## 1. 系統定位與範圍

本系統是 AI 輔助寫作教學平台，包含三種角色：

- `student`：加入寫作任務、進行 10 步驟學習互動、儲存草稿與大綱
- `teacher`：管理自己管轄的學生/任務、切換步驟、檢視進度、分組
- `admin`：跨教師全域管理帳號與任務

核心組成：

- 前端：Next.js App Router 頁面
- 後端：Next.js Route Handlers (`app/api/**`)
- 狀態/資料：
  - `Session` 儲存在 Postgres（若無 DB 退回 memory）
  - `User` 儲存在 Postgres（若無 DB 退回 memory）
  - `Essay/OpenClass/Groups/PromptConfig` 為 process memory mock store（`src/lib/mock-data.ts`）

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
- 啟用條件：`POSTGRES_URL` 或 `DATABASE_URL` 有值
- Postgres 表：`llm4writing_sessions`
  - `id TEXT PRIMARY KEY`
  - `payload JSONB`
  - `created_at`
  - `updated_at`
- 無 DB 時：使用 `globalThis` memory map（重啟即遺失）

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
- 內容：`essays`、`openClasses`、`activityGroupMap`、`essayPromptConfigs`、`openClassPromptConfigs`
- 注意：此區資料目前不持久化到 DB

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
  durationMinutes: number;
  supplemental: string;
  groups: ActivityGroup[];
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

每個子步驟問題產生邏輯：

1. 先看 `questionBanks[key]`（若有題目則隨機抽）
2. 否則看 `subStepPrompts[key]`（包成 `請討論：...`）
3. 否則用內建 fallback 文案

## 5.4 非互動步驟行為

教師切到非互動步驟時即生成：

- Step5：彙整步驟 1~4 最近訊息，寫入 `reports.step5`
- Step7：為每位 participant 生成 `reports.step7[user]`
- Step10：為每位 participant 生成 `reports.step10[user]`

## 5.5 個人反思（Step9）

- 固定 4 題反思題
- student 每送一次訊息，`reflectionIndex[user] + 1`
- 未達 4 題：系統送下一題
- 完成：系統送「個人反思完成」

## 5.6 Artifact 儲存

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

## 6.2 `/student`

主要能力：

1. 顯示可加入的活動列表（只會看到自己所屬 group 的任務）
2. 點「加入討論」：
   - 若已有同 activity 的 `spec10` session 且自己在 participants，直接回傳舊 session
   - 否則建立新 session（participants = 自己所在 group members）
3. 顯示聊天訊息、步驟資訊、寫作主題資訊
4. 可儲存 outline/draft6/draft8
5. 可查歷史 session

畫面文案目前用「班級號碼」顯示任務班級。

## 6.3 `/teacher`

三大分頁：

- 系統管理
- 學習管理
- 課程管理

### 系統管理

- 帳號 CRUD（teacher/admin 依權限限制）
- reset password
- CSV 批次建帳
- student 帳號必填 `classNumber`

### 學習管理

- 監看 `spec10` sessions
- 教師可切換步驟（`/api/teacher/step`）
- 看小組訊息（1/2/4）
- 看個人互動訊息（3/6/8）與個人進度

### 課程管理

- 寫作主題管理（essay CRUD）
- 主題 Prompt/問題庫編輯（essay prompt config）
- 寫作任務管理（open class）：
  - 班級下拉：來自可見 student 的 classNumber 清單
  - 主題下拉：顯示 `essayId / title`
  - 支援新增與編輯
  - 在同一編輯表單可寫 `步驟1` / `子步驟2-1` 的任務 prompt 覆蓋
- 組別管理：
  - 先選任務（顯示為「班級 + 任務 + id」）
  - 設定組數
  - `隨機平均分組`
  - 或 `先建空組拖曳`
  - 儲存分組

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

### `GET /api/auth/me`

- 已登入：`{ authenticated: true, user }`
- 未登入：`401 { authenticated: false }`

### `POST /api/auth/logout`

- 清除 cookie

## 7.2 Student

### `GET /api/student/activities`

- 權限：student
- 回傳自己可參與 activities

### `POST /api/student/join`

Request:

```json
{ "activityId": "oc-001" }
```

Behavior:

- 找 activity + 自己所在 group
- 有舊 session 則回舊 session
- 否則建立新 session（workflow: `spec10`）

Error:

- `403 forbidden`
- `404 activity_not_found`
- `403 not_group_member`

### `GET /api/student/history?activityId=...`

- 回傳該 student 參與過的 sessions（可選 activity 過濾）

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

## 7.5 Admin/Course APIs

### `GET/POST /api/admin/essays`

- 權限：teacher/admin
- 管理寫作主題

### `GET/POST /api/admin/prompts/essay`

- 權限：teacher/admin
- 管理 essay 層級 prompt config

### `GET/POST /api/admin/openclasses`

- 權限：teacher/admin
- GET：
  - admin 看全部
  - teacher 僅看可見班級任務
- POST（新增/編輯任務）：
  - 欄位：`id? classNumber essayId durationMinutes supplemental school? promptOverride?`
  - teacher 僅可對可見班級操作
  - `promptOverride` 寫入 open class prompt config

### `GET/POST /api/admin/prompts/openclass`

- 權限：teacher/admin
- 管理任務層級 prompt config

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
  - 支援 CSV 批次建立（5/6/7 欄格式）

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

1. 先取 essay config
2. 再 merge openClass config（同 key 覆蓋）

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

- `essay-1 科技與生活`
- `essay-2 我的校園角落`

預設 openClasses：

- `oc-001`：Demo High / 701 / essay-1
- `oc-002`：Demo High / 702 / essay-2

---

## 10. 不變量（AI 生成時必須遵守）

1. 同校同班只能對應單一教師（student 建立與更新都要檢查）
2. teacher 的任務與分組操作必須受可見班級限制
3. 建立寫作任務時，班級與主題必須來自可選清單（非自由文字）
4. 任務編輯必須可同時維護任務 prompt 覆蓋
5. Step1/2 必須維持「所有組員回覆才 AI 回覆」的 group gate
6. Step5/7/10 必須是 non-interactive（學生送訊息會報錯）
7. student artifact 只能存到自己參與的 session
8. session/user store 必須維持「有 DB 用 DB，無 DB 用 memory」雙模式

---

## 11. 已知限制（現況）

1. essays/openClasses/groups/prompt configs 仍為 in-memory，尚未持久化 DB
2. `mock-data` 與 `user-store` 分層共存，重啟後 domain 資料會回預設
3. 群組隨機分配採前端簡單亂數，不含種子與可重現性
4. 提示詞編輯 UI 目前僅暴露部分 key（step1 / 2-1 / 1-3 / 1-1 等）

---

## 12. 重建指引（給未來 AI）

若要生成相同行為系統，請至少完整實作：

1. `types.ts` 的資料型別（特別是 `UserAccount.classNumber`、`Activity.classNumber/essayId`）
2. `engine.ts` 的 10 步驟模式與 gate / reflection 行為
3. `user-store.ts` 的衝突檢查與 role-based CRUD 規則
4. `mock-data.ts` 的 open class + prompt merge + group sanitizer
5. `admin/users`, `admin/openclasses`, `admin/activities`, `admin/groups` 路由的可見範圍過濾
6. `/teacher` UI 的：
   - 任務下拉（班級/主題）
   - 任務編輯（含 prompt 覆蓋）
   - 分組兩種方式（隨機、拖曳）

只要上述 6 點一致，系統核心行為即可與目前版本對齊。
