# LLM4Writing Restore Runbook

## 1. Restore Triggers

- Data corruption
- Accidental deletion
- Environment misconfiguration
- Full production disaster recovery

## 2. Pre-restore Checklist

- Confirm restore scope:
  - DB only / Vercel env only / full stack
- Confirm target timepoint (backup timestamp)
- Freeze risky writes if needed
- Notify stakeholders

## 3. DB Restore Procedure

1. Provision target Postgres instance (staging first; production only after validation).
2. Download encrypted backup + checksum.
3. Verify checksum.
4. Decrypt and restore:
   - `pg_restore` or `psql` (depending on dump format).
5. Run post-restore validation:
   - key table existence (`llm4writing_*`)
   - row counts sanity
   - app health endpoint
   - basic teacher/student flow smoke test

## 4. Vercel Restore Procedure

1. Recreate/validate project settings.
2. Restore env vars from encrypted snapshot.
3. Redeploy known good commit from GitHub.
4. Validate:
   - login/auth
   - DB connectivity
   - core API routes

## 5. Recovery Acceptance Criteria

- App reachable
- Auth works
- DB reads/writes normal
- Key workflows pass smoke tests
- No critical errors in logs (15 min observation)

## 6. Rollback

- If restore validation fails:
  - stop rollout
  - revert to prior known-good deployment
  - open incident report with failure reason

## 7. Post-incident

- Record RTO actual
- Record data gap (actual RPO)
- Capture lessons and update runbook
