#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage:
  scripts/supabase/harden_security.sh --target-url <postgres://...>

Description:
  Applies minimal Supabase security hardening:
  - Restricts public execution of `public.rls_auto_enable()`
  - Converts function to SECURITY INVOKER when present
USAGE
}

TARGET_URL=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --target-url)
      TARGET_URL="${2:-}"
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

if ! command -v psql >/dev/null 2>&1; then
  echo "[ERROR] Required command not found: psql" >&2
  exit 1
fi

echo "[1/1] Apply SECURITY DEFINER hardening for public.rls_auto_enable()"
psql "$TARGET_URL" -v ON_ERROR_STOP=1 <<'SQL'
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'rls_auto_enable'
      AND pg_get_function_identity_arguments(p.oid) = ''
  ) THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated';
    EXECUTE 'ALTER FUNCTION public.rls_auto_enable() SECURITY INVOKER';
  END IF;
END
$$;
SQL

echo "[DONE] Security hardening applied."
