# Vaults Implementation README (Admin Panel)

This README explains how Vaults are implemented in this app and what your Admin panel should read, display, and manage.

## Scope

- Vault core model (creation, funding, spending lifecycle)
- Vault scheduled payouts
- How vault schedules are routed into the main payout pipeline
- Realtime behavior your Admin UI should expect
- Recommended admin queries and filters

---

## 1) Core Vault Model

Vaults are stored in `public.budget_plans` (canonical table).

Related data:

- `plan_wallets`: live vault balance ledger wallet
- `plan_transactions`: vault ledger entries (`manual_topup`, `withdrawal`, `spending`, etc.)
- `expense_plan_topups`: top-up records

For admin listing, treat each `budget_plans` row as one vault and enrich it with:

- `plan_wallets.balance` (if needed)
- aggregate top-up and transaction history

---

## 2) Vault Scheduled Payout Model

Scheduled payout rows are stored in:

- `public.vault_payout_schedules`

Key fields:

- `user_id`, `budget_plan_id`, `payout_account_id`
- `total_amount`, `payout_amount`, `net_payout_amount`
- `fee_amount`, `fee_percentage`
- `frequency`, `duration`, `start_date`, `next_payout_date`
- `status` (`active`, `paused`, `completed`, `cancelled`)
- `metadata`

Creation entrypoint:

- RPC: `public.create_vault_payout_schedule(...)`

What this RPC does (current behavior):

1. Validates ownership of vault and payout account.
2. Computes fee math using `compute_payout_schedule_fees(...)`.
3. Deducts committed amount upfront from vault (`plan_transactions` withdrawal).
4. Creates `vault_payout_schedules` row.
5. Creates a corresponding `payout_plans` row for main payout processing.
6. Records fee audit via `record_user_fee(...)`.

Important:

- Vault schedule metadata includes `source_kind = 'vault_schedule'`.
- This is used to avoid double-fee deduction in the payout trigger.

---

## 3) Integration into Main Payout Pipeline

Vault schedules are intentionally routed into `public.payout_plans` so they appear with regular payout plans and are processed by the existing payout execution pipeline.

Implementation detail:

- Trigger function `deduct_plan_fee_on_insert()` skips rows where:
  - `NEW.metadata->>'source_kind' = 'vault_schedule'`

This prevents charging fees twice for vault-origin schedules.

---

## 4) Realtime / Refresh Behavior (Admin Expectations)

Client vault list realtime is tied to:

- table: `budget_plans` (not `expense_plans`)

If your Admin panel needs immediate updates after vault create/fund/spend:

- Subscribe to `budget_plans` changes
- Optionally subscribe to `plan_transactions` and `expense_plan_topups` for detailed activity feed

---

## 5) Vault Totals Rules (for dashboard metrics)

For “Funded / Total plans” style metrics, use the same rule now used in app:

- Exclude non-`active` vaults
- Exclude vaults that are both:
  - started, and
  - fully spent (`current_balance <= 0`)

This avoids counting already exhausted vaults in total plans denominator.

---

## 6) Recommended Admin Queries

### A) Vault list (with wallet balance)

```sql
SELECT
  bp.id,
  bp.user_id,
  bp.name,
  bp.status,
  bp.start_date,
  bp.end_date,
  bp.total_budget,
  bp.current_balance,
  bp.created_at,
  bp.updated_at,
  pw.balance AS plan_wallet_balance
FROM public.budget_plans bp
LEFT JOIN public.plan_wallets pw
  ON pw.plan_id = bp.id
ORDER BY bp.created_at DESC;
```

### B) Vault schedule list

```sql
SELECT
  vps.*,
  pp.id AS payout_plan_id,
  pp.status AS payout_plan_status
FROM public.vault_payout_schedules vps
LEFT JOIN public.payout_plans pp
  ON pp.id = (vps.metadata->>'payout_plan_id')::uuid
ORDER BY vps.created_at DESC;
```

### C) Vault ledger

```sql
SELECT *
FROM public.plan_transactions
WHERE plan_id = $1
ORDER BY created_at DESC;
```

### D) Top-up history

```sql
SELECT *
FROM public.expense_plan_topups
WHERE budget_plan_id = $1
ORDER BY created_at DESC;
```

### E) Vault schedule fee audit

```sql
SELECT *
FROM public.user_fees
WHERE metadata->>'kind' = 'vault_payout_schedule'
ORDER BY created_at DESC;
```

---

## 7) Admin UI Suggested Sections

For each vault detail page:

1. **Vault Summary**
   - Name, owner, status, dates, total budget, current balance
2. **Funding**
   - Top-up history (`expense_plan_topups`)
3. **Ledger**
   - `plan_transactions` timeline
4. **Scheduled Payouts**
   - Linked `vault_payout_schedules`
   - Linked `payout_plans` status
5. **Fees**
   - `fee_amount`, fee breakdown (from metadata/audit)

---

## 8) Security Notes

- Do not use client anon keys for admin operations.
- Run Admin panel read/write via server-side service role or privileged backend APIs.
- Keep any service role secrets off frontend clients.

---

## 9) Source Files (Implementation References)

- `supabase/migrations/20260326120000_vault_payout_schedules.sql`
- `supabase/migrations/20260326150000_route_vault_schedules_into_main_payouts.sql`
- `hooks/useExpensePlans.ts`
- `hooks/useCreateVaultPayoutSchedule.ts`
- `supabase/functions/process-vault-payout-schedules/index.ts` (stub)

