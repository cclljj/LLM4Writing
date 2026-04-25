# Supabase 遷移手冊（完整腳本 + 環境切換 + 驗證）

本手冊適用於目前 `llm4writing`（Next.js + Postgres driver）專案，目標是把既有 Postgres 資料安全搬到 Supabase。

## 1. 前置準備

1. 安裝 PostgreSQL CLI 工具（`psql`、`pg_dump`、`pg_restore`）。
2. 取得兩組連線字串：
- `SOURCE_DB_URL`：目前舊資料庫
- `TARGET_DB_URL`：Supabase Postgres（建議使用 session mode 連線字串）
3. 確認可以從本機連上兩邊資料庫。

## 2. 完整遷移腳本

### 2.1 一次完成遷移（含備份、還原、筆數比對）

```bash
scripts/supabase/migrate_to_supabase.sh \
  --source-url "$SOURCE_DB_URL" \
  --target-url "$TARGET_DB_URL"
```

腳本會自動執行：
1. 檢查 source/target 連線
2. 匯出 source dump
3. 匯出 target 既有資料備份（rollback 用）
4. 以 `pg_restore --clean --if-exists` 覆蓋 target
5. 比對 source/target 的 `public` schema 所有 table row counts

輸出位置：`.migration-artifacts/supabase-<timestamp>/`

### 2.2 僅在特殊情境才跳過 target 備份

```bash
scripts/supabase/migrate_to_supabase.sh \
  --source-url "$SOURCE_DB_URL" \
  --target-url "$TARGET_DB_URL" \
  --skip-target-backup
```

## 3. 環境變數切換清單

系統 DB 讀取優先順序：`POSTGRES_URL`，若無則 `DATABASE_URL`。

### 3.1 本機（`.env.local`）

把以下兩個都設為 Supabase 連線字串（建議一致，避免環境差異）：

```env
POSTGRES_URL=postgres://...
DATABASE_URL=postgres://...
```

### 3.2 Vercel（Production / Preview / Development）

在 Vercel Project Settings -> Environment Variables 設定：

1. `POSTGRES_URL` = Supabase 連線字串
2. `DATABASE_URL` = Supabase 連線字串
3. 重新部署（Redeploy）

可選：若你有使用遠端 LLM，也一併確認：
- `LLM_URL`
- `LLM_KEY`
- `LLM_MODEL`

## 4. 驗證步驟

### 4.1 資料庫驗證（建議）

```bash
scripts/supabase/verify_migration.sh \
  --source-url "$SOURCE_DB_URL" \
  --target-url "$TARGET_DB_URL"
```

會檢查：
1. 關鍵表是否存在：
- `llm4writing_sessions`
- `llm4writing_users`
- `llm4writing_domain`
2. `llm4writing_sessions.payload` 是否為合法 JSON object
3. source/target table row counts 是否一致

### 4.2 部署後 API smoke test（建議）

```bash
scripts/supabase/verify_migration.sh \
  --target-url "$TARGET_DB_URL" \
  --base-url "https://<your-vercel-domain>"
```

會加驗：`GET /api/health` 回傳 HTTP 200。

### 4.3 手動功能 smoke test（必做）

1. 教師登入 -> 打開「課程狀態內容」可正常讀取。
2. 學生登入 -> 可看到課程列表。
3. 選一堂課進入互動 -> 可送出訊息、可看到回覆或等待提示。
4. 帳號管理新增/編輯使用者 -> 可成功儲存。
5. 寫作主題與寫作任務列表 -> 可正常載入。

## 5. Rollback（回復）

如果切換後異常，使用遷移腳本產生的 `target-pre-migration.dump` 回復：

```bash
pg_restore \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges \
  --dbname "$TARGET_DB_URL" \
  .migration-artifacts/supabase-<timestamp>/target-pre-migration.dump
```

回復後：
1. 再跑一次 `scripts/supabase/verify_migration.sh --target-url "$TARGET_DB_URL"`
2. 確認 Vercel 環境變數是否需切回舊 DB
3. Redeploy

## 6. 風險提醒

1. `pg_restore --clean` 會覆蓋 target 既有資料，請務必保留 target backup。
2. 遷移期間請先凍結寫入，避免 source 在 dump 後仍持續變動造成不一致。
3. 若資料量大，建議先在 staging 全流程演練一次。
