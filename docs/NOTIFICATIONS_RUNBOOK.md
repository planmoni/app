# Notifications Runbook

## Staged Validation

1. Apply migrations:
   - `20260330110000_notifications_overhaul_foundation.sql`
   - `20260330111000_extend_get_active_tokens_for_expo.sql`
   - `20260330113000_add_vault_retention_cron.sql`
   - `20260330120000_add_retention_reminder_tracking.sql`
   - `20260330121000_add_retention_reminder_crons.sql`
   - `20260401100000_lifecycle_events_and_notification_log.sql`
   - `20260401101000_lifecycle_retargeting_rpc.sql`
   - `20260401102000_process_lifecycle_retargeting_cron.sql`
2. Deploy functions:
   - `send-push-notification`
   - `send-push-notifications`
   - `send-vault-retention-push`
   - `send-zero-balance-reminder`
   - `send-unfunded-vault-reminder`
   - `process-lifecycle-retargeting`
   - updated transactional functions (`verify-paystack-payment`, `mono-webhook`, `safehaven-webhook`, payout processors)
3. QA checks:
   - Deposit success (Paystack, Mono, SafeHaven) -> push + `events`
   - Payout success/failure -> push + `events`
   - Vault due / low-balance reminders -> push + `events`
   - Zero-balance retention reminder (inactive >= 3 days, weekly cooldown)
   - Unfunded-vault reminder (active + current_balance <= 0, weekly cooldown)
   - Lifecycle retargeting (vault/payout abandon after 2h, 7-day cooldown per campaign; `re_engagement` preference; `vault_abandon_reminder` / `payout_abandon_reminder` deep links)
   - Cold-start and background tap routes

### Lifecycle retargeting (staging)

1. **Cron auth:** Ensure `app.settings.service_role_key` is set in the database (Dashboard → SQL) so `pg_cron` jobs can call Edge Functions with `Authorization` + `apikey`. Or invoke manually: `POST https://<project>.supabase.co/functions/v1/process-lifecycle-retargeting` with service role headers.
2. **Test user:** Complete `vault_flow_step_details` (or payout review step) then do **not** complete the flow. Wait \> 2 hours (or temporarily lower `p_min_age_hours` in RPC for testing).
3. **Expect:** At most one push per campaign per 7 days; `lifecycle_notification_log` row for `vault_abandon_after_details` or `payout_abandon_after_review`.

## Monitoring Queries

```sql
select status, notification_type, count(*)
from notification_delivery_logs
where created_at > now() - interval '24 hours'
group by 1,2
order by 1,2;
```

```sql
select *
from notification_delivery_logs
where status = 'failed'
order by created_at desc
limit 100;
```

```sql
select id, zero_balance_reminder_sent_at, unfunded_vault_reminder_sent_at
from profiles
where zero_balance_reminder_sent_at is not null
   or unfunded_vault_reminder_sent_at is not null
order by greatest(
  coalesce(zero_balance_reminder_sent_at, 'epoch'::timestamptz),
  coalesce(unfunded_vault_reminder_sent_at, 'epoch'::timestamptz)
) desc
limit 100;
```

```sql
-- Recent lifecycle funnel events (debug)
select user_id, event_name, created_at, properties
from lifecycle_events
order by created_at desc
limit 50;
```

```sql
-- Retargeting sends (dedupe log)
select user_id, campaign_key, sent_at
from lifecycle_notification_log
order by sent_at desc
limit 50;
```

```sql
-- Candidate preview (vault abandon; service role / SQL only)
select * from lifecycle_retargeting_candidates(
  'vault_flow_step_details',
  'vault_flow_completed',
  2,
  7,
  'vault_abandon_after_details'
);
```

## Cutover Checklist

- Confirm `send-push-notifications` queue worker only delegates to canonical sender.
- Confirm no direct FCM sender remains in edge functions.
- Confirm app routes notification taps through `app/_layout.tsx` + `lib/notificationRouting.ts`.
- Confirm `events` is the source for feed + badge counts.

