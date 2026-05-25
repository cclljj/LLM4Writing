# LLM4Writing Backup Runbook

## 1. Scope

- Platform: Vercel
- Database: Supabase Postgres
- Repo: GitHub
- Optional runtime infra: Upstash Redis (config snapshot only)

## 2. Backup Objectives

- RPO: 24h
- RTO: 2-4h
- Retention:
  - Daily: 7 days
  - Weekly: 4 weeks
  - Monthly: 12 months

## 3. Daily Schedule (UTC+8)

- 02:00 DB full logical backup
- 02:30 backup integrity check
- 03:00 Vercel env snapshot (encrypted)
- 03:15 GitHub mirror sync
- 03:30 summary report + alerts

## 4. Required Secrets

- `SUPABASE_DB_URL` (or service role connection string)
- Backup storage credentials (Bucket A/B)
- Encryption key (KMS or managed secret)
- Vercel API token (read env)
- GitHub token (repo read/mirror)

## 5. Procedure

### Step A: Supabase Postgres backup

1. Run `pg_dump` for production DB.
2. Output file naming:
   - `db_YYYYMMDD_HHMM.sql.gz.enc`
3. Encrypt backup file (AES-256 or KMS envelope).
4. Upload to:
   - Primary bucket (region A)
   - Secondary bucket (region B)

### Step B: Integrity check

1. Generate checksum (`sha256`).
2. Store checksum alongside backup file.
3. Validate gzip/decrypt/readability test.
4. Mark job failed if any check fails.

### Step C: Vercel configuration backup

1. Export project env var metadata + values (encrypted artifact).
2. Include environment scopes: production/preview/development.
3. Save as:
   - `vercel_env_YYYYMMDD_HHMM.json.enc`
4. Upload to primary + secondary bucket.

### Step D: GitHub mirror backup

1. Fetch all branches/tags.
2. Push mirror to backup repo/org.
3. Verify latest commit hash on `main`.

### Step E: Reporting

- Report fields:
  - timestamp
  - db backup status
  - vercel env backup status
  - github mirror status
  - file sizes/checksums
  - total duration
- Send to Slack/Email.

## 6. Failure Policy

- Any failed step = overall failed.
- Auto-retry once after 10 minutes.
- If still failed: page owner + create incident ticket.

## 7. Security Rules

- Backup artifacts must be encrypted at rest and in transit.
- Access control: least privilege, backup role only.
- Never store raw secrets in plaintext logs.
- Rotate backup credentials every 90 days.
