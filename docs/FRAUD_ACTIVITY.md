# Fraud check + user activity (v1)

**Detect → alert → restrict (PND).** No auto wallet credits, refunds, or payout mutations.

## Components

| Piece | Role |
|-------|------|
| `user_risk_events` | Deduped signals |
| `fraud_scan_runs` | Cron run log |
| `collect_user_risk_signals()` | SQL rule scan |
| `list_open_fraud_signals()` | Ops listing |
| Edge `scan-user-risk` | Upsert + email + critical → `post_no_debit` |
| Cron `scan-user-risk-1h` | Minute 20 every hour |

## Signals (v1)

| Signal | Severity | Action |
|--------|----------|--------|
| `PASS_THROUGH_DEPOSIT_PAYOUT` | critical | Auto PND |
| `LOCKED_BALANCE_MISMATCH` | critical | Auto PND |
| `DESTINATION_VELOCITY` | warning | Email only |
| `SUSPICIOUS_SESSION_HIGH_PAYOUT` | warning | Email only |
| `DEPOSIT_RECON_*` | warning/critical | Critical → PND |

Thresholds (defaults): deposit ≥ ₦100,000 then plan within 6h; ≥3 payout accounts / 24h; locked delta ≥ ₦100; high payout ≥ ₦100,000.

## Deploy

```bash
npx supabase db push
# or run migration 20260915150000_user_risk_fraud_scan.sql

npx supabase functions deploy scan-user-risk
```

Manual run:

```bash
curl -X POST "$SUPABASE_URL/functions/v1/scan-user-risk" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{}'
```

## Ops review

```sql
-- Open signals
SELECT * FROM list_open_fraud_signals(50);

-- Drill-down
SELECT jsonb_pretty(monitor_user('USER_UUID'));

-- Clear auto-PND after review (manual only)
UPDATE profiles
SET
  post_no_debit = false,
  post_no_debit_reason = NULL,
  post_no_debit_at = NULL,
  post_no_debit_by = NULL
WHERE id = 'USER_UUID';

-- Resolve a signal
UPDATE user_risk_events
SET resolved_at = now()
WHERE id = 'EVENT_UUID';
```

See also [POST_NO_DEBIT.md](./POST_NO_DEBIT.md).

## Adding a rule

1. Extend `collect_user_risk_signals` in a new migration (stable `dedupe_key`).
2. Redeploy is not required for SQL-only rules; edge function already upserts whatever the RPC returns.
3. Prefer **warning** until the rule is trusted; use **critical** only when auto-PND is appropriate.

## Non-goals (v1)

- ML / device fingerprint SDKs
- Auto-pause existing payout plans
- Blocking deposits
- Auto-refund / auto-retry payouts
