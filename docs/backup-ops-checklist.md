# Backup Ops Checklist

## Daily

- [ ] DB backup completed
- [ ] Checksum generated and verified
- [ ] Backup uploaded to primary + secondary storage
- [ ] Vercel env snapshot exported and encrypted
- [ ] GitHub mirror sync completed
- [ ] Daily report delivered
- [ ] No unresolved backup alert

## Weekly

- [ ] Perform staging restore drill from latest daily backup
- [ ] Validate core app smoke tests after restore
- [ ] Review backup duration and size trend
- [ ] Verify retention cleanup executed correctly

## Monthly

- [ ] Full DR simulation (DB + Vercel env + redeploy)
- [ ] Measure and record RTO
- [ ] Review access logs for backup artifacts
- [ ] Rotate any expiring credentials/keys
- [ ] Review and update runbook if architecture changed

## Quarterly

- [ ] Security review of backup IAM policies
- [ ] Test cross-region recovery scenario
- [ ] Audit backup encryption and key management settings
