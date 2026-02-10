# Payout: Webhook vs Retry & Production Impact

## 1. When SafeHaven doesn’t send the webhook

SafeHaven does **not** always send webhooks for every transfer. That’s why **retry-pending-safehaven-transfers** exists: it **does** update `automated_payouts` (and everything else) when the webhook never fires.

**Flow:**

- **process_due_payouts** creates an `automated_payout` (status `pending`/`processing`), calls SafeHaven, then:
  - **Path A – Webhook received:** **safehaven-webhook** updates `automated_payouts` and `transactions`, calls `update_payout_plan_progress`, creates notification, sends email.
  - **Path B – Webhook not sent / lost:** The payout stays `pending`/`processing`. **retry-pending-safehaven-transfers** (run on a cron, e.g. every 5–10 min) polls SafeHaven `POST /transfers/status` and:
    - **If Completed:**  
      1. **Updates `automated_payouts`** → `status=completed`, `completed_at`, `transferred_at`  
      2. Updates `transactions` → `status=completed`  
      3. Calls **`update_payout_plan_progress(plan_id)`** (same as webhook)  
      4. Inserts `events` (in-app payout_completed notification)  
    - **If Failed / Unable to locate:** Updates `automated_payouts` to `failed`, updates transaction, calls **`credit_back_payout_failure`**, inserts failure event.

So when the webhook is missing, the retry function is the fallback and **does** update `automated_payouts` and advance the plan. Both paths use the same RPC for plan progress.

**Idempotency:** The webhook (and the retry) set `automated_payouts.status = 'completed'` before or when updating the plan. Retry only selects rows with status `pending` or `processing`, so once a row is completed (by webhook or retry), it is never processed again. No double update.

**Recommendation:** Run **retry-pending-safehaven-transfers** on a schedule (e.g. every 5–10 minutes) so missed webhooks are corrected quickly.

---

## 2. Impact on current / existing plans (production)

Summary: **Existing plans are not broken.** All changes are backward‑compatible. Some existing plans may already have one wrong `next_payout_date` or balance; we don’t auto-correct past data, but we stop new mistakes.

### Database (migrations)

| Change | Effect on existing plans |
|--------|---------------------------|
| **recalculate_locked_balance** no longer deducts from `balance` | Next time a payout completes, we only update `locked_balance` / `available_balance`. No double-deduct. Plans already in progress get the fix on the *next* completion. |
| **charge_plan_fee** deducts fee at creation only | Applies to **new** plans. Old plans were created with previous logic; we don’t re-run fee deduction for them. |
| **update_payout_plan_progress** (weekly_specific, custom, etc.) | Next time a payout completes (webhook or retry), we compute the next date with the new logic. No migration of existing rows; we “fix” on next run. |
| **calculate_next_payout_date** (end_of_month, quarterly, biannual, annually) | Same: next completion uses the new logic. |
| **credit_back_payout_failure** | New RPC. Only used when we mark a payout as failed; no effect on healthy plans. |

### App (useCreatePayout)

- Only **new** plans are affected (e.g. weekly_specific first payout date). Existing plans already have `next_payout_date` set; we don’t rewrite history.

### Edge functions

- **safehaven-webhook:** Now calls the RPC instead of inline date math. When the webhook runs for an existing plan, it uses the new logic. Same for **retry-pending-safehaven-transfers** when it runs for a pending payout.
- **process-automated-payouts:** Same RPC/new logic when it updates a plan. No change to which payouts are created; only how the next date is computed.

### Optional one-time corrections (if you want to tidy past state)

- **Plans that already have a wrong `next_payout_date`** (e.g. weekly_specific that skipped a week): we don’t auto-fix stored values. You could run a one-time job that, for active plans, recomputes `next_payout_date` from `start_date`, `frequency`, `completed_payouts`, and `day_of_week`/metadata using the same logic as `update_payout_plan_progress` (or by calling a read-only “compute next date” helper). Optional.
- **Old plans and the “fee returned” bug:** If some users still have extra available balance from the old bug, you could run a one-time balance correction (e.g. deduct the plan fee from balance for plans that had fee recorded but not deducted). Optional and product-dependent.

### Production checklist

- [ ] Run new migrations (`supabase db push` or your process).
- [ ] Deploy **safehaven-webhook** and **process-automated-payouts** (and **retry-pending-safehaven-transfers** if not already deployed).
- [ ] Ensure **retry-pending-safehaven-transfers** is scheduled (e.g. cron every 5–10 minutes).
- [ ] (Optional) One-time recompute of `next_payout_date` for active plans and/or one-time fee balance correction, if you want to clean up existing state.

All updates are designed so current plan processing stays correct and future runs use the fixed logic without breaking existing plans.
