# Repository Task Workflow

本文件是本 repository 的標準作業流程。所有協作者（人類與 AI）都應遵守。

## 1. 標準流程（必須）

1. 任何功能/修正開始前，先建立 GitHub Issue。
2. 在 Issue 描述中寫明：
   - 背景與目標
   - 交付範圍
   - 驗收條件
3. 實作前先檢查是否需要更新 `SPEC.md`，並在 Issue 註明：
   - `SPEC 需更新：Yes/No`
   - 若 `Yes`，列出要更新章節
4. 開始實作（程式碼、文件、測試）。
5. 完成後在 Issue 留言「實作摘要 + 驗證結果」。
6. 若有更新規格，`SPEC.md` 必須與程式碼同次提交。
7. 確認完成後關閉 Issue。

## 2. SPEC.md 更新判斷規則

出現以下任一情況，`SPEC.md` 必須更新：

- 新增或修改 API 路由、參數、回傳欄位、錯誤碼
- 調整角色權限或資料可見範圍
- 調整主要頁面流程、操作順序、狀態機規則
- 新增/修改關鍵資料模型欄位或不變量

僅限 UI 純文案、CSS 樣式微調，且不影響行為，可不更新 `SPEC.md`。

## 3. Pull Request 要求

PR 內必須包含：

- 關聯 Issue（`Closes #<id>` 或 `Refs #<id>`）
- `SPEC.md` 檢查結論（更新 / 不更新 + 理由）
- 驗證方式（至少 `npm run build` 或等效檢查）

## 4. 分支與推送規範

- 只允許推送到本 fork：`cclljj/llm4writing_fork`
- 不可推送到上游原始 repo：`Shengche/llm4rwiting`

