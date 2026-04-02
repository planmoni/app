# Notifications Runbook

## Staged Validation

1. Apply migrations:
   - `20260330110000_notifications_overhaul_foundation.sql`
   - `20260330111000_extend_get_active_tokens_for_expo.sql`
   - `20260330113000_add_vault_retention_cron.sql`
   - `20260330120000_add_retention_reminder_tracking.sql`
   - `20260330121000_add_retention_reminder_crons.sql`
2. Deploy functions:
   - `send-push-notification`
   - `send-push-notifications`
   - `send-vault-retention-push`
   - `send-zero-balance-reminder`
   - `send-unfunded-vault-reminder`
   - updated transactional functions (`verify-paystack-payment`, `mono-webhook`, `safehaven-webhook`, payout processors)
3. QA checks:
   - Deposit success (Paystack, Mono, SafeHaven) -> push + `events`
   - Payout success/failure -> push + `events`
   - Vault due / low-balance reminders -> push + `events`
   - Zero-balance retention reminder (inactive >= 3 days, weekly cooldown)
   - Unfunded-vault reminder (active + current_balance <= 0, weekly cooldown)
   - Cold-start and background tap routes

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

## Cutover Checklist

- Confirm `send-push-notifications` queue worker only delegates to canonical sender.
- Confirm no direct FCM sender remains in edge functions.
- Confirm app routes notification taps through `app/_layout.tsx` + `lib/notificationRouting.ts`.
- Confirm `events` is the source for feed + badge counts.

