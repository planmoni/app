# Post no debit (PND)

Ops can restrict a user so they **cannot create new payout plans** or **lock funds** (vault/expense locks that use `lock_funds`). **Deposits still work.** Existing active payout plans are **not** auto-paused.

Enforcement is server-side:

- `profiles.post_no_debit`
- `create_payout_plan_atomic` → `code: POST_NO_DEBIT`
- `lock_funds` → `code: POST_NO_DEBIT`

## Enable (SQL editor)

```sql
UPDATE profiles
SET
  post_no_debit = true,
  post_no_debit_reason = 'ops note — replace me',
  post_no_debit_at = now(),
  post_no_debit_by = 'support@planmoni.com'
WHERE email = 'user@example.com';
```

Or by user id:

```sql
UPDATE profiles
SET
  post_no_debit = true,
  post_no_debit_reason = 'ops note',
  post_no_debit_at = now(),
  post_no_debit_by = 'support@planmoni.com'
WHERE id = '00000000-0000-0000-0000-000000000000';
```

## Clear

```sql
UPDATE profiles
SET
  post_no_debit = false,
  post_no_debit_reason = NULL,
  post_no_debit_at = NULL,
  post_no_debit_by = NULL
WHERE id = '00000000-0000-0000-0000-000000000000';
```

## List restricted users

```sql
SELECT id, email, post_no_debit_reason, post_no_debit_at, post_no_debit_by
FROM profiles
WHERE post_no_debit = true
ORDER BY post_no_debit_at DESC NULLS LAST;
```

## Notes

- App shows: “Account restricted — you cannot create payout plans. Please contact support.”
- To also stop **existing** scheduled payouts, pause those plans or set `manual_hold` separately — PND alone does not stop due payouts.
- Migration: `supabase/migrations/20260914170000_post_no_debit.sql`
- Related: auto-PND from fraud scan — see [FRAUD_ACTIVITY.md](./FRAUD_ACTIVITY.md)
