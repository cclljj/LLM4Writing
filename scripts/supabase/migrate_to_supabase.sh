#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage:
  scripts/supabase/migrate_to_supabase.sh \
    --source-url <postgres://...> \
    --target-url <postgres://...> \
    [--out-dir <path>] \
    [--skip-target-backup]

Description:
  Full migration helper for PostgreSQL -> Supabase Postgres.
  Steps:
  1) Validate connections
  2) Backup source DB
  3) (Optional) Backup current target DB for rollback
  4) Restore source dump into target DB (clean replace)
  5) Compare row counts across public tables
USAGE
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "[ERROR] Required command not found: $1" >&2
    exit 1
  fi
}

SOURCE_URL=""
TARGET_URL=""
OUT_DIR=""
SKIP_TARGET_BACKUP="false"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --source-url)
      SOURCE_URL="${2:-}"
      shift 2
      ;;
    --target-url)
      TARGET_URL="${2:-}"
      shift 2
      ;;
    --out-dir)
      OUT_DIR="${2:-}"
      shift 2
      ;;
    --skip-target-backup)
      SKIP_TARGET_BACKUP="true"
      shift
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

if [[ -z "$SOURCE_URL" || -z "$TARGET_URL" ]]; then
  echo "[ERROR] --source-url and --target-url are required." >&2
  usage
  exit 1
fi

require_cmd psql
require_cmd pg_dump
require_cmd pg_restore
require_cmd awk
require_cmd sed
require_cmd diff

TS="$(date +%Y%m%d-%H%M%S)"
if [[ -z "$OUT_DIR" ]]; then
  OUT_DIR=".migration-artifacts/supabase-${TS}"
fi
mkdir -p "$OUT_DIR"

SOURCE_DUMP="$OUT_DIR/source.dump"
TARGET_BACKUP_DUMP="$OUT_DIR/target-pre-migration.dump"
SOURCE_COUNTS="$OUT_DIR/source-counts.csv"
TARGET_COUNTS="$OUT_DIR/target-counts.csv"
COUNT_DIFF="$OUT_DIR/count-diff.txt"
SUMMARY="$OUT_DIR/summary.txt"

collect_counts() {
  local db_url="$1"
  local out_file="$2"

  : > "$out_file"
  while IFS= read -r tbl; do
    if [[ -z "$tbl" ]]; then
      continue
    fi
    cnt="$(psql "$db_url" -At -c "SELECT COUNT(*) FROM ${tbl};")"
    echo "${tbl},${cnt}" >> "$out_file"
  done < <(
    psql "$db_url" -At -c "
      SELECT quote_ident(schemaname) || '.' || quote_ident(tablename)
      FROM pg_tables
      WHERE schemaname='public'
      ORDER BY tablename;
    "
  )
}

echo "[1/7] Validate source DB connection"
psql "$SOURCE_URL" -v ON_ERROR_STOP=1 -c 'SELECT 1;' >/dev/null

echo "[2/7] Validate target DB connection"
psql "$TARGET_URL" -v ON_ERROR_STOP=1 -c 'SELECT 1;' >/dev/null

echo "[3/7] Backup source DB -> $SOURCE_DUMP"
pg_dump \
  --format=custom \
  --no-owner \
  --no-privileges \
  --file "$SOURCE_DUMP" \
  "$SOURCE_URL"

if [[ "$SKIP_TARGET_BACKUP" == "false" ]]; then
  echo "[4/7] Backup target DB (rollback safety) -> $TARGET_BACKUP_DUMP"
  pg_dump \
    --format=custom \
    --no-owner \
    --no-privileges \
    --file "$TARGET_BACKUP_DUMP" \
    "$TARGET_URL"
else
  echo "[4/7] Skip target backup (--skip-target-backup enabled)"
fi

echo "[5/7] Collect source table counts"
collect_counts "$SOURCE_URL" "$SOURCE_COUNTS"

echo "[6/7] Restore source dump into target (clean replace)"
pg_restore \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges \
  --dbname "$TARGET_URL" \
  "$SOURCE_DUMP"

echo "[7/7] Collect target table counts + compare"
collect_counts "$TARGET_URL" "$TARGET_COUNTS"

if diff -u "$SOURCE_COUNTS" "$TARGET_COUNTS" > "$COUNT_DIFF"; then
  rm -f "$COUNT_DIFF"
  COUNT_RESULT="OK"
else
  COUNT_RESULT="MISMATCH"
fi

{
  echo "Migration completed at: $(date)"
  echo "Artifacts directory: $OUT_DIR"
  echo "Source dump: $SOURCE_DUMP"
  if [[ "$SKIP_TARGET_BACKUP" == "false" ]]; then
    echo "Target pre-migration backup: $TARGET_BACKUP_DUMP"
  fi
  echo "Source counts: $SOURCE_COUNTS"
  echo "Target counts: $TARGET_COUNTS"
  echo "Count comparison: $COUNT_RESULT"
  if [[ "$COUNT_RESULT" == "MISMATCH" ]]; then
    echo "Count diff: $COUNT_DIFF"
  fi
} | tee "$SUMMARY"

if [[ "$COUNT_RESULT" == "MISMATCH" ]]; then
  echo "[WARN] Table row counts differ. Check $COUNT_DIFF before switching production traffic." >&2
  exit 2
fi

echo "[DONE] Migration and row-count verification passed."
