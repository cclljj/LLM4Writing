# Changelog

本文件記錄 LLM4Writing 的產品發行版本。完整程式提交歷程請參閱每個版本的 GitHub 比較連結。

## [v1.1] - 2026-08-30

### 發行摘要

v1.1 完成 LLM4Writing 的 Next.js 平台化、10 步驟寫作流程、教師課程管理與可追溯的學生學習成果報告。相較於 v1.0，系統加入完整的 PDF／JSON 匯出、隱私去識別化、安全防護、診斷工具與穩定性改善。

### 學生學習與寫作流程

- 完整支援 Step 1 至 Step 10 的引導式寫作流程，以及 Step 3 原始架構圖、Step 4 修正版架構圖、Step 6 初稿、Step 8 潤飾稿與 Step 10 總結報告。
- 改善 Step 1／2 的小組等待 gate、兩段式 AI 回饋與題目流程、短答驗證、問題庫與 HTML／換行呈現。
- 強化 Step 3 編輯完成驗證、鎖定／重新開啟流程，以及 Step 4 討論的課堂適切性檢查。
- 改善 Step 5 至 Step 10 的草稿驗證、AI 回饋、串流完成度、Markdown 正規化與總結報告分段呈現。
- 學生歷史頁可回顧 Step 3／4 架構圖、Step 6／8 草稿與 Step 10 報告。

### 教師與管理功能

- 提供課程、開放課程、帳號、分組、學生加入狀態與個人／小組互動紀錄管理。
- 新增教師學習監控、完成度、步驟停留時間、課程診斷、趨勢、LLM fallback trace 與管理員 audit log。
- 支援已結束課程清單、課程實施報告、學生個人紀錄與系統 Log JSON 匯出。
- 改善列表篩選、排序、分頁、平板表格、載入與錯誤狀態等日常操作體驗。

### 學生成果報告與匯出

- 產生具備 Markdown／HTML 排版、粗體、清單、換行與多頁自然流動的學生 PDF 課程實施報告。
- PDF 正確區分 Step 3 原始架構圖與 Step 4 討論後修正版，並以可讀圖形呈現；長內容可跨頁延續，避免不必要留白與重複／錯序步驟。
- 網頁與 PDF 報告補齊 Step 8，改善 Step 10 標題與內文分段，以及 Step 10 完成時間優先判定。
- 提供個別 PDF／JSON，以及全班 PDF／JSON ZIP 合併檔；已完成課程清單可直接產製與下載合併檔，並顯示進度與避免並行產製。
- 學生成果 JSON 包含 Step 1／2 討論、Step 3 原始架構 Mermaid、Step 4 討論與修正版 Mermaid、Step 5／6／7／8／10 成果與時間軸。
- 統一 PDF 與 JSON 的共同 report version；目前為 `1.4`，並同步反映在 PDF 封面、JSON `reportVersion`、JSON schema 與匯出檔名。

### 隱私與資料保護

- PDF 與學生成果 JSON 遮蔽其他組員帳號為「有一位組員」。
- 學生成果 JSON 保留學生帳號作為歷史識別，但以 `***` 遮蔽學生姓名，以 `*****` 遮蔽學校與班級。
- 系統 Log JSON 維持獨立定位；預設匿名化，僅在明確選擇帳號模式時保留學生帳號，且不揭露同組成員帳號。

### 安全、可靠性與維運

- 強化登入限流、可撤銷 session、密碼與權限控制、CSRF origin 檢查、CSP nonce、DOM sanitization、請求大小限制與敏感錯誤資訊遮蔽。
- 修補 Dependabot 與 Code Scanning 發現，升級 Next.js、React、ESLint、esbuild 等相依套件。
- 導入 PostgreSQL／Supabase 導向的摘要優先查詢、交易式版本寫入、活動範圍驗證與大型資料輪詢退避策略。
- 補齊備份、還原、資料庫遷移與健康檢查文件，並持續擴充回歸、E2E、security 與 source guard 測試。

### 相容性與升級注意事項

- `main` 是持續維護分支；本版產品 tag 為 `v1.1`，前一版基線 tag 為 `1.0`。
- 學生成果 JSON 的目前 schema 為 `student-portfolio-report-v1.4`。使用舊 JSON reader 時，請處理新增的 `stepArtifacts`、`timelineMessages` artifact event 與去識別化欄位值。
- PDF／JSON report version 目前為 `1.4`，與產品 release `v1.1` 為不同層級的版本識別。

### 驗證

- `npm run test`：194 項通過。
- `npm run lint`、`npm run typecheck`、`npm run build` 通過。

### 完整提交記錄

- [比較 `1.0...v1.1`](https://github.com/cclljj/LLM4Writing/compare/1.0...v1.1)（543 個提交）。

[v1.1]: https://github.com/cclljj/LLM4Writing/releases/tag/v1.1
