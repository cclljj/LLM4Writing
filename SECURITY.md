# Security Policy

本文件適用於 `llm4writing_fork`（LLM4Writing 教學系統，Next.js App Router）。

## Supported Versions

目前僅保證 `main` 分支持續接收安全性修補。

| Version | Supported |
| ------- | --------- |
| `main` | ✅ |
| 其他分支、舊 commit、個人 fork | ❌ |

說明：
- 安全修補會先進入 `main`。
- 不承諾回補到歷史版本或外部分支。

## How to Report a Vulnerability

請優先使用 GitHub 的私密通報機制（Private Vulnerability Reporting）：

1. 進入本 repo 的 **Security** 分頁
2. 點選 **Report a vulnerability**
3. 提交弱點細節

若你無法使用私密通報，請先開一般 issue 並只描述不敏感資訊（不要貼 exploit、token、帳密、可識別學生資料），再請維護者改用私下管道追蹤。

## What to Include in Report

請盡量提供：

- 弱點類型（例如：權限繞過、資料外洩、注入、認證失效）
- 影響範圍（角色：student/teacher/admin；端點；資料表或功能）
- 重現步驟（最小可重現案例）
- PoC（request/response、截圖、log，請先遮罩敏感資訊）
- 可能衝擊（是否可讀取他班資料、是否可跨角色操作）
- 建議修補方向（若有）

## Response Timeline

- 3 個工作天內：收到回報並確認受理狀態
- 7 個工作天內：完成初步分級（嚴重度/影響面）
- 修補時程：依嚴重度與修補風險安排

重大弱點（例如可造成跨班資料外洩、未授權存取）會優先處理。

## Coordinated Disclosure

在修補上線前，請勿公開揭露漏洞細節。
維護者會在修補完成後與回報者協調揭露時間與內容。

## Project-Specific Security Scope

### In Scope

- 認證與授權：`/api/auth/*`、角色權限（student/teacher/admin）
- 課程與進度 API：`/api/student/*`、`/api/teacher/*`、`/api/session/*`
- 多租戶/資料隔離：學校、班級、分組、個人歷程資料可見性
- 伺服器端敏感設定：資料庫連線、LLM 金鑰、部署環境變數
- Session payload 與課程互動歷程（含草稿、回饋、報告）

### Out of Scope

- 純文字建議或程式風格建議，未形成可利用弱點者
- 上游第三方服務本身漏洞（非本專案整合設定導致）
- 僅限本機開發環境、無實際安全影響的設定問題

## Data Handling Expectations

請避免在公開管道張貼：
- 學生姓名、帳號、學校/班級可識別資訊
- token、cookie、API key、資料庫連線字串
- 可直接重放的完整攻擊請求

若必須提供，請先遮罩後再提交。
