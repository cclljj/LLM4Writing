#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage:
  scripts/supabase/verify_migration.sh \
    --target-url <postgres://...> \
    [--source-url <postgres://...>] \
    [--base-url <https://your-app.example.com>]

Description:
  Post-migration verification helper.
  - Verifies key tables and JSON payload validity on target DB
  - If --source-url is provided, compares row counts for all public tables
  - If --base-url is provided, performs basic API smoke check
USAGE
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "[ERROR] Required command not found: $1" >&2
    exit 1
  fi
}

TARGET_URL=""
SOURCE_URL=""
BASE_URL=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --target-url)
      TARGET_URL="${2:-}"
      shift 2
      ;;
    --source-url)
      SOURCE_URL="${2:-}"
      shift 2
      ;;
    --base-url)
      BASE_URL="${2:-}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "[ERROR] Unknown argument: $1" >&2
      usage
      exit 1
      ;;
  esac
done

if [[ -z "$TARGET_URL" ]]; then
  echo "[ERROR] --target-url is required." >&2
  usage
  exit 1
fi

require_cmd psql
require_cmd awk
require_cmd diff
if [[ -n "$BASE_URL" ]]; then
  require_cmd curl
fi

collect_counts() {
  local db_url="$1"
  local out_file="$2"

  : > "$out_file"
  mapfile -t tables < <(psql "$db_url" -At -c "
    SELECT quote_ident(schemaname) || '.' || quote_ident(tablename)
    FROM pg_tables
    WHERE schemaname='public'
    ORDER BY tablename;
  ")

  for tbl in "${tables[@]}"; do
    [[ -z "$tbl" ]] && continue
    cnt="$(psql "$db_url" -At -c "SELECT COUNT(*) FROM ${tbl};")"
    echo "${tbl},${cnt}" >> "$out_file"
  done
}

echo "[1/4] Validate target DB connection"
psql "$TARGET_URL" -v ON_ERROR_STOP=1 -c 'SELECT 1;' >/dev/null

echo "[2/4] Validate key tables and payload structure"
TABLES_OK="$(psql "$TARGET_URL" -At -c "
  SELECT COUNT(*)
  FROM information_schema.tables
  WHERE table_schema='public'
    AND table_name IN ('llm4writing_sessions','llm4writing_users','llm4writing_domain');
")"
if [[ "$TABLES_OK" -lt 3 ]]; then
  echo "[ERROR] Missing one or more key tables in target DB." >&2
  exit 2
fi

BAD_SESSION_PAYLOADS="$(psql "$TARGET_URL" -At -c "
  SELECT COUNT(*) FROM llm4writing_sessions
  WHERE payload IS NULL OR jsonb_typeof(payload) <> 'object';
")"
if [[ "$BAD_SESSION_PAYLOADS" != "0" ]]; then
  echo "[ERROR] Found invalid session payload rows: $BAD_SESSION_PAYLOADS" >&2
  exit 2
fi

DOMAIN_SINGLETON="$(psql "$TARGET_URL" -At -c "
  SELECT COUNT(*) FROM llm4writing_domain WHERE id='singleton';
")"
if [[ "$DOMAIN_SINGLETON" -lt 1 ]]; then
  echo "[WARN] llm4writing_domain singleton row not found. Domain store may fallback to file/memory." >&2
fi

echo "[3/4] Row-count check"
if [[ -n "$SOURCE_URL" ]]; then
  ARTIFACT_DIR=".migration-artifacts/verify-$(date +%Y%m%d-%H%M%S)"
  mkdir -p "$ARTIFACT_DIR"
  SRC_COUNTS="$ARTIFACT_DIR/source-counts.csv"
  TGT_COUNTS="$ARTIFACT_DIR/target-counts.csv"
  DIFF_FILE="$ARTIFACT_DIR/count-diff.txt"

  collect_counts "$SOURCE_URL" "$SRC_COUNTS"
  collect_counts "$TARGET_URL" "$TGT_COUNTS"

  if diff -u "$SRC_COUNTS" "$TGT_COUNTS" > "$DIFF_FILE"; then
    rm -f "$DIFF_FILE"
    echo "[OK] Source and target row counts match."
  else
    echo "[ERROR] Source and target row counts mismatch. See: $DIFF_FILE" >&2
    exit 2
  fi
else
  echo "[SKIP] --source-url not provided; skipped source/target count comparison."
fi

echo "[4/4] API smoke check"
if [[ -n "$BASE_URL" ]]; then
  HTTP_CODE="$(curl -sS -o /tmp/llm4writing_health.json -w "%{http_code}" "${BASE_URL%/}/api/health")"
  if [[ "$HTTP_CODE" != "200" ]]; then
    echo "[ERROR] /api/health returned HTTP $HTTP_CODE" >&2
    exit 2
  fi
  echo "[OK] ${BASE_URL%/}/api/health is reachable (HTTP 200)."
else
  echo "[SKIP] --base-url not provided; skipped API smoke check."
fi

echo "[DONE] Verification passed."
