# Manual payout vs recalculate locked balance

Ops quick reference. These are **different** tools — do not confuse them.

| Tool | What it does | Sends money to user? |
|------|----------------|----------------------|
| **Manual payout** | You pay outside the app, then mark the installment complete in Planmoni | Yes — **you** pay via bank |
| **`recalculate_locked_balance`** | Rebuilds wallet `locked_balance` / `available_balance` from active/paused plans | **No** |

---

## Manual payout (when recon emails “needs manual action”)

Triggered by `reconcile-payout-plans` when an installment is past due / failed and blocked from auto-pay (e.g. `manual_hold`, existing transfer ref, unreimbursed debit).

### Steps

1. **Confirm SafeHaven did not already pay**  
   Check SafeHaven dashboard / `reconcile-payout-provider` / `payout_provider_checks` for that `automated_payouts` row.

2. **Pay the user from Planmoni’s bank** (manual NIP/transfer). Keep the bank reference.

3. **Mark the installment complete** in Supabase (service role / SQL editor):

```sql
SELECT public.complete_manual_payout_installment(
  'AUTOMATED_PAYOUT_UUID',   -- ap_id from the email / list_payouts_needing_manual_action
  'YOUR_BANK_TRANSFER_REF',  -- external payment reference
  'Paid manually via bank — ops note'
  -- optional 4th arg: p_unpause_plan boolean DEFAULT true
);
```

4. **Verify** plan advanced (`next_payout_date` / completed count) and wallet locked looks right.  
   If locked still looks wrong after complete, then run recalculate (below).

### Find rows that need manual action

```sql
SELECT * FROM public.list_payouts_needing_manual_action();
```

### Drill-down one user

```sql
SELECT jsonb_pretty(public.monitor_user('USER_UUID'));
```

---

## Recalculate locked balance (balance hygiene only)

Use when **locked/available** on the wallet does not match what active/paused plans imply.  
Does **not** pay the customer and does **not** complete an installment.

```sql
SELECT public.recalculate_locked_balance('USER_UUID');
```

Safe to run after support fixes; also runs automatically inside some payout complete/cancel paths.

---

## What not to do

- Do **not** run only `recalculate_locked_balance` when the user is owed a failed payout — that does not send money.
- Do **not** call `complete_manual_payout_installment` before the bank transfer is actually sent (unless SafeHaven already paid and you are only syncing our books — still use the real provider/bank ref).
- Do **not** use `confirm-paystack-deposit` for payouts — that is for **missing Paystack deposits** only.

---

## Related

- Payout recon cron: `reconcile-payout-plans` (every 15m) — see [AUTOMATED_PAYOUTS_DEPLOYMENT.md](./AUTOMATED_PAYOUTS_DEPLOYMENT.md)
- Provider status checks: `reconcile-payout-provider`
- Incident context: [PAYOUT_RELIABILITY_INCIDENT.md](./PAYOUT_RELIABILITY_INCIDENT.md) §10
- Post no debit: [POST_NO_DEBIT.md](./POST_NO_DEBIT.md)
