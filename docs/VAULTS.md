# Vaults (Expense Plans) — Admin & backend reference

This document describes how **Vaults** are implemented in Planmoni: the product name in the app for **budget-based expense plans**. Use it when wiring an **admin panel**, support tooling, or reporting against Supabase.

---

## Terminology

| User-facing | Backend |
|-------------|---------|
| Vault | Row in `budget_plans` (and related satellite tables) |
| Funding / top-up | `expense_plan_topups` + `plan_transactions` (types below) + user `wallets` when debited |

Legacy name **expense plan** still appears in table names (`expense_plan_topups`, older `expense_plans`) for historical reasons; **new vaults use `budget_plans` as the canonical plan table.**

---

## High-level data model

```
users (auth) ──► profiles
                    │
                    ▼
              budget_plans ◄──────┐
                    │             │
         ┌──────────┼──────────┐  │
         ▼          ▼          ▼  │
   plan_wallets  plan_rules  plan_allocations  plan_health
         │
         ▼
   plan_transactions

   expense_plan_topups ──► (budget_plan_id OR expense_plan_id) + optional plan_transaction_id

   wallets (user main wallet) ◄── RPCs / Paystack flows debit here when funding a vault
```

---

## Core tables

### `budget_plans`

Primary table for each vault. Key fields (non-exhaustive; see migrations for full schema):

| Column / area | Purpose |
|----------------|---------|
| `id` | UUID primary key; referenced as `plan_id` elsewhere |
| `user_id` | Owner (`profiles.id` / `auth.users`) |
| `name` | Display name |
| `total_budget`, `current_balance`, `total_spent` | Aggregates for the plan period |
| `start_date`, `end_date` | Plan window |
| `status` | e.g. `active`, `completed`, `cancelled` |
| `categories`, `subcategories` | JSONB structure for budget breakdown |
| `funding_method` | e.g. `manual`, `auto`, `hybrid` |
| Auto top-up | `auto_fund_minimum`, `auto_fund_amount`, `next_auto_fund_at`, `last_auto_fund_at`, `auto_fund_timezone`, `auto_fund_bank_account_id` |
| `start_action` | How the vault should start (e.g. fund now vs later) |
| Payout / bank | `payout_bank_account_id`, `payout_bank_name`, `payout_account_number`, `payout_account_name` |
| Alerts | `alert_on_low_balance`, `low_balance_threshold`, `alert_on_overspend` |
| `metadata` | Extra JSON |
| Timestamps | `created_at`, `updated_at` |

**Admin tip:** List vaults with `SELECT * FROM budget_plans WHERE user_id = $1 ORDER BY created_at DESC`.

---

### `plan_wallets`

One virtual wallet per plan (`plan_id` → `budget_plans.id`, unique).

| Column | Purpose |
|--------|---------|
| `balance` | Current plan wallet balance |
| `spending_permission` | e.g. `open`, `restricted` |
| `lock_type` | e.g. `none`, `instant`, `24h_delay`, `pin_required` |
| `pin_hash` | Hashed PIN when required |

Triggers on `plan_transactions` keep this balance in sync with ledger activity.

---

### `plan_transactions`

Ledger **inside** the plan wallet. FK: `plan_id` → `budget_plans`, `wallet_id` → `plan_wallets`.

**`type` values** (check constraint from migrations):

- `auto_allocation` — automated allocation into the plan  
- `manual_topup` — user-initiated top-up  
- `spending` — spend against the plan  
- `withdrawal` — money leaving the plan wallet  

**Note:** Funding events are also recorded in **`expense_plan_topups`** (dedicated top-up table). Do not assume every naira of funding appears only here; reconcile with `expense_plan_topups` for support.

---

### `plan_rules`

Per-plan alert / lock configuration (one row per plan, `plan_id` unique): e.g. `alert_at_70_percent`, `alert_risk_failure`, `alert_weekly_progress`.

---

### `plan_allocations`

Scheduled / completed auto-allocation rows: `allocation_date`, `amount`, `status` (`scheduled`, `completed`, `failed`), optional `payout_cycle_id`.

---

### `plan_health`

Time-series health snapshots: `status` (`on_track`, `slightly_behind`, `at_risk`, `unachievable`), `percentage_behind`, `recommended_action`, `required_adjustment` (JSONB).

---

### `expense_plan_topups`

**Dedicated table for vault funding / top-ups** (replaces relying on main `transactions.type = 'expense_plan_topup'` for plan funding).

| Column | Purpose |
|--------|---------|
| `budget_plan_id` | Target vault (`budget_plans.id`) when using the new model |
| `expense_plan_id` | Legacy target; **exactly one** of `budget_plan_id` or `expense_plan_id` should be set (enforced in DB) |
| `plan_transaction_id` | Optional link to the corresponding `plan_transactions` row |
| `amount`, `currency` | Funding amount |
| `source` | e.g. `wallet`, `paystack`, `manual` |
| `reference` | Idempotency / payment reference |
| `status` | e.g. `pending`, `completed`, `failed` |
| `metadata` | Extra JSON |

**Admin tip:** For a given vault, `SELECT * FROM expense_plan_topups WHERE budget_plan_id = $1 ORDER BY created_at DESC`.

---

### `vault_email_logs`

Idempotent log for **scheduled vault emails** so the same milestone email is not sent twice.

| Column | Purpose |
|--------|---------|
| `plan_id` | `budget_plans.id` |
| `user_id` | Recipient |
| `type` | `vault_fully_funded` or `vault_started` |
| `sent_at` | When the email was sent |

**Unique constraint:** `(plan_id, type)` — one row per event type per plan.

**Automation:** Hourly pg_cron job calls Edge Function `send-vault-emails`, which inserts here after successful sends. RLS is oriented to `service_role` for writes; use **service role** or a server-side admin path to read in internal tools.

---

## User wallet (outside the vault)

Vault funding often **debits** the user’s main wallet (`wallets`) via RPCs such as:

- `transfer_wallet_to_plan` — move funds from user wallet into a plan  
- `process_expense_plan_topup` — complete a wallet-based top-up and create `expense_plan_topups` + ledger entries  
- `process_paystack_plan_deposit` — Paystack card funding into a plan  

Exact signatures live in `supabase/migrations/` (search for these function names).

---

## Legacy: `expense_plans`

Older migrations created `expense_plans` and pointed `plan_wallets` / `plan_transactions` at it. Later migrations **reparent** those FKs to **`budget_plans`**. You may still see `expense_plan_id` on historical `expense_plan_topups` rows; new vaults should use `budget_plan_id`.

---

## Row Level Security (RLS)

Vault-related tables use RLS: users see only rows for their own `user_id` / plan ownership. **Admin panels** should:

- Use the **Supabase service role** from a trusted backend only, **or**  
- Expose a **Supabase Edge Function / RPC** with explicit admin checks, **or**  
- Add dedicated **admin RLS policies** (restricted to your admin JWT claim).

Never embed the service role key in a client app.

---

## Suggested admin queries

**Vault overview for a user**

```sql
SELECT bp.*, pw.balance AS plan_wallet_balance
FROM budget_plans bp
LEFT JOIN plan_wallets pw ON pw.plan_id = bp.id
WHERE bp.user_id = $user_id
ORDER BY bp.created_at DESC;
```

**Funding history for a vault**

```sql
SELECT *
FROM expense_plan_topups
WHERE budget_plan_id = $plan_id
ORDER BY created_at DESC;
```

**In-plan ledger**

```sql
SELECT *
FROM plan_transactions
WHERE plan_id = $plan_id
ORDER BY created_at DESC;
```

**Email automation audit**

```sql
SELECT *
FROM vault_email_logs
WHERE plan_id = $plan_id;
```

---

## Related app code (for engineers)

- Client data loading: `hooks/useExpensePlans.ts` (queries `budget_plans`)  
- Migrations: `supabase/migrations/` — search `budget_plans`, `expense_plan_topups`, `vault_email_logs`, `transfer_wallet_to_plan`, `process_expense_plan_topup`, `send-vault-emails`

---

*Last updated to match migrations as of the `vault_email_logs` / cron addition. If you add columns, update this doc or generate a schema snapshot from Supabase.*
