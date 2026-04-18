# AI 寫作學習平台（現況版）— AI 生成規格認知

> 版本時間：2026-04-18（依目前程式碼推導）
> 
> 本文件描述的是「目前系統已實作狀態」，不等同於 `SPEC.md` 的目標規格。

## 1. 系統定位與邊界

目前專案是以 **Java 17 + Apache Wicket** 為主的 Web 系統，主要提供：

- 學生端：查看自己可參與的寫作任務，進入分階段 AI 對話流程。
- 教師端：管理寫作主題、開課與班級分組；部分學習管理頁面目前是空殼。
- AI 對話：透過 OpenAI Responses API + WebSocket push 進行即時回覆。

## 2. 架構概覽

### 2.1 模組與技術棧

- `llm4class-web`
  - Wicket 頁面、Panel、Modal、前端資源（HTML/CSS/JS）
  - WAR 專案
- `libs`
  - Service/Repository/Entity/模型物件
  - OpenAI 整合、資料庫存取、通用工具

主要技術：

- Java 17
- Apache Wicket（含 websocket、auth-roles、cdi）
- JPA/Hibernate（MySQL）
- MongoDB（聊天紀錄）
- OpenAI Java client（async）

## 3. 主要資料與領域模型

### 3.1 MySQL（關聯資料）

核心表與用途：

- `essay`：寫作主題
- `openclass`：開課任務（班級、題目、討論時長、補充資料）
- `classgroup` / `classgroupmember`：分組與組員
- `stage`：階段定義（含 `llmtype`, `stagename`, `chattype`）
- `step`：子步驟定義（`stepsort`, `type`）
- `essayquestion`：題庫（掛在 `step`）
- `stagelog`：每階段對話鏈接與進度紀錄
- `stagerecord`：階段內容紀錄（如樹狀內容）

### 3.2 MongoDB（互動資料）

- `ChatLogs`：聊天訊息、事件型別、stage/cgid/cid/ocid、timestamp

## 4. 權限與導覽

角色導向側欄：

- 學生：活動列表（`/apps/st/activity`）
- 教師/主管：
  - 系統管理：帳號管理、日誌
  - 課程管理：作文主題、開課/分組
  - 學習管理：`MonitorPage`、`LearningPacePage`（目前空頁）

## 5. 學生端流程（現況）

### 5.1 進入流程

1. 學生進入 `ActivityPage`，看到可參與任務列表。
2. 點擊任務後開啟 `CourseDetailModal`。
3. 系統依 `stagelog` 找到目前階段，建立 `ChatPageModel`。
4. 透過 `WebUtils.getNextPage(stageId)` 跳到 `Phase{N}Page`。

### 5.2 階段頁面現況

目前實體頁面僅見：

- `Phase1Page`
- `Phase2Page`
- `Phase3Page`
- `Phase4Page`
- `Phase5Page`

共通特徵：

- 都是聊天室型 UI（`AudioChatFormPanel` + `StudentChatPanel` + `GPTPanel`）。
- 均保留文字輸入與送出按鈕（含第 5 階段）。
- 皆透過 WebSocket 收發訊息，並可觸發下一階段。

## 6. AI 對話機制（現況）

### 6.1 呼叫路徑

- 頁面（PhaseX）呼叫 `OpenAIClassChatUpdaterService`
- service 使用 `OpenAIClientAsync.responses().create(...)`
- 結果以 `WebSocketPushBroadcaster` 回推頁面

### 6.2 Prompt 來源

目前 Phase 頁面中的 system prompt 以「硬編碼模板字串」為主，包含：

- 角色設定描述
- 題目
- 補充資料

另有 `stage/classstageprompt/essayprompt` 與 `essayquestion` 相關 service/repository，但在主要學生流程中未看到完整串接。

## 7. 教師端功能（現況）

### 7.1 已有

- 帳號管理（可重設密碼）
- 作文主題 CRUD（標題、文體、補充說明、啟用狀態）
- 開課 CRUD（班級、題目、討論時長、補充資料）
- 分組管理頁（拖曳學生到組、批次儲存）

### 7.2 部分存在但未完整落地

- 小組/個人對話檢視 Modal（`ChatLogModal`, `ChatPersonalLogModal`）有實作，但整體教師「課堂觀察→進度控制」頁流未完整落地。
- Prompt 管理與題庫管理 service/repository 存在，但 UI 主流程未見可操作入口。

## 8. 系統已知不一致與風險（從程式直接觀察）

- `OpenAIClassChatUpdaterService` 內多個 WebSocket filter 目前直接 `return true`，等同廣播給所有連線。
- `WicketApplication` 中 `sameClassMemberIndex` 未見初始化，群組索引未實際參與過濾。
- `stage` 表 seed 為 `llm4writing`，而頁面多處使用 `llm4class` 查詢。
- `ProgressPanel.java` 建立 3 個 phase 元件，但對應 HTML 僅 2 個節點。
- `WebUtils.getNextPage(stageId)` 在缺少對應 `PhaseNPage` 類別時直接丟 RuntimeException。

## 9. 現況結論

目前系統可以視為：

- 已完成「學生端聊天流程」的前半實作（約 Phase1~5）
- 已完成「課程/分組管理」的大部分管理功能
- 「10 步驟完整學習規格、教師進度控制、互動模式嚴格約束」尚未完整落地

