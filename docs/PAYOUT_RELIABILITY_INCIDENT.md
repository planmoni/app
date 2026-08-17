# PlanMoni payout incident report (code investigation)

**Date:** 2026-08-16  
**Scope:** Repository + known Aug 2026 production incidents  
**Status:** **NO-GO** for unrestricted automatic payout resume  
**Bunce / feature work:** paused pending financial clearance  

Live user lists and amounts require running  
[`scripts/payout-reliability-inventory.sql`](../scripts/payout-reliability-inventory.sql) in production.

Companion canvas: `payout-reliability-investigation.canvas.tsx` (open beside chat).

---

## Executive summary

Users not receiving automatic payouts is consistent with a **compound failure class**, not a single bug:

1. **Schedule / due-queue stalls** (Aug 2 `payout_time` progress crash + same-day completed guard) left plans overdue but invisible to cron.
2. **Provider outcomes ≠ internal status** for rows with `safehaven_transfer_initiated` still `processing` / `failed` without verified refund or complete.
3. **Wallet model is balance mutation + audit ledger**, not double-entry funds-in-transit — refunds and locks must be checked explicitly.
4. **SafeHaven webhook HMAC verification is a stub** (`verifyWebhookSignature` always returns `true`) — unacceptable for money movement.

Do **not** blindly retry. Treat any row with a provider reference as **UNKNOWN** until SafeHaven status is looked up.

---

## 1. Freeze and protect

| Control | Verdict |
|---------|---------|
| Pause blind retries | **Required** for any AP with `transfer_reference` or `safehaven_transfer_initiated` |
| Idempotent claim | **Partial** — unique `(payout_plan_id, installment_index)` |
| Duplicate SafeHaven POST | **Partial** — gated by metadata flags; timeout race remains |
| Webhook signature | **Fail** — stub |
| Webhook durable store | **Partial** — audit logs only |
| Ledger edits | Audit append-only; balances mutable via RPCs |
| Manual complete | `complete_manual_payout_installment` — service_role |

**Controlled mode (allowed):**

- `reconcile-payout-plans` stuck-progress advance + ops email  
- `process-due-payouts` only when claim returns `may_call_safehaven` and no prior initiated flag  
- Manual bank pay → `complete_manual_payout_installment` after dashboard proof  

---

## 2–3. Inventory + reconciliation layers

Run inventory SQL sections 1–10. Matching order:

1. `transfer_reference` / SafeHaven session id  
2. `automated_payouts.id` + `transactions.metadata.automated_payout_id`  
3. Installment `(plan_id, installment_index)`  
4. Amount + user + time window (manual only)  

Layers A–I from the brief map to:

| Layer | PlanMoni artifact |
|-------|-------------------|
| A Wallet | `wallets.balance` / `locked_balance` |
| B Ledger | `wallet_ledger` (audit, not GL) |
| C Internal payout | `automated_payouts` |
| D Provider API | SafeHaven transfer create response in metadata |
| E Webhook | `safehaven-webhook` + audit logs |
| F Provider lookup | Dashboard / `retry-pending-safehaven-transfers` (limited) |
| G Settlement report | **Missing** |
| H Bank statement | **Missing automation** |
| I User-facing | `events` + app payout status |

Buckets A–H are defined in the canvas and SQL script.

---

## 4. Wallet / ledger

**Verdict:** Not true double-entry.  

- Debit: `transfer_funds` → balance↓ locked↓  
- Refund: `refund_payout_wallet_debit` → balance↑ locked↑ (available unchanged)  
- Lock at plan create; `recalculate_locked_balance` resets locked from plan remaining  

**Invariants gaps:** no `source_ref` uniqueness on `transfer_funds`; refund idempotency is metadata-only (TOCTOU); `monitor_user` locked formula may drift from live recalculate.

---

## 5. Provider failure taxonomy (known)

| Class | Examples |
|-------|----------|
| Corporate funding | RC51 insufficient funds |
| Beneficiary bank | Bank not available |
| Schedule bug | Progress RPC error; due guard |
| Webhook gap | Processing forever |
| False initiated | Business error after POST attempt |
| Manual hold | Second fail after refunded retry |

Store machine code + support message; never dump raw provider JSON to users.

---

## 6. Lifecycle race conditions to watch

- Wallet debit committed, worker dies before SafeHaven POST → bucket C  
- SafeHaven POST succeeds, worker dies before flag → possible double POST on retry  
- Fail webhook + late success → complete after refund (must detect)  
- Concurrent webhooks on refund flags  
- Manual complete + auto cron racing  

---

## 7. Target state machine

Use explicit states from the brief. Map today’s statuses:

| Current | Target |
|---------|--------|
| pending | CREATED / FUNDS_RESERVED |
| processing + initiated | SUBMITTED / PENDING_PROVIDER / UNKNOWN |
| completed | SUCCESSFUL (+ RECONCILED later) |
| failed + refunded | FAILED → REFUNDED |
| failed + manual_hold | FAILED (ops) |
| retrying | UNKNOWN or REFUND_PENDING |

**Rule:** UNKNOWN never → auto retry until provider lookup resolves prior attempt.

---

## 8–9. Jobs and exceptions

**Have:** reconcile stuck progress, manual-action email, partial SafeHaven poll.  

**Need:** provider daily report import, `payout_exceptions` table (severity, severity, owner, SLA), settlement reconciliation, real webhook HMAC + event outbox.

---

## 10. Support runbook (short)

1. Search by user / AP id / transfer_reference (masked account only).  
2. Show: AP status, wallet_debited / refunded / initiated, last update.  
3. If provider success claimed: require SafeHaven dashboard proof before telling user money was sent.  
4. If failed unreimbursed: escalate Critical — do not tell user “retrying”.  
5. Manual pay → `complete_manual_payout_installment(ap_id, external_ref, notes)`.  

---

## 11. Monitoring (minimum)

Alert on: pending+initiated age > SLA; failed unreimbursed count; due_now = 0 while overdue plans > 0; duplicate refs per installment; webhook verify failures (once HMAC exists); locked ≠ recalculate delta.

---

## 12. Acceptance criteria (resume)

Not complete until inventory Critical buckets cleared or owned; HMAC live; UNKNOWN resolved via provider lookup; staging covers timeout / duplicate webhook / late success / single refund; exception queue exists.

---

## 13. Deliverables checklist

| # | Item | Location |
|---|------|----------|
| 1 | Incident report | this doc |
| 2 | Affected users / IDs | **prod SQL export** |
| 3 | Reconciliation report | SQL §2 + CSV |
| 4 | Failure taxonomy | SQL §10 + §5 above |
| 5 | Users owed | Bucket F (+ underpaid from progress stall) |
| 6 | Duplicate / overpaid | SQL §5 |
| 7 | Remediation procedure | Support + manual complete runbook |
| 8 | State machine | §7 |
| 9 | Schema changes | TBD: payout_exceptions, webhook_events |
| 10 | Reconciliation jobs | §8 |
| 11 | Alerts | §11 |
| 12 | Support runbook | §10 |
| 13 | Recovery / retry | Controlled mode §1 |
| 14 | Test plan | staging list §12 |
| 15 | Go/no-go | **NO-GO** until §12 |

---

## Immediate actions for engineering

1. Run `scripts/payout-reliability-inventory.sql` and share bucket counts (no secrets).  
2. Fix `verifyWebhookSignature` in `safehaven-webhook` (reject when secret set and signature missing/invalid).  
3. Do not continue Bunce rollout until Critical F/H/D queues are owned.  
4. Optionally disable or rate-limit automatic SafeHaven retries until inventory is clean.  
5. Confirm production cron does **not** invoke Paystack-era `retry-failed-payouts`.  
6. Treat `retry-pending-safehaven-transfers` fail path as incomplete until it calls `fail_payout_installment` / refund.

---

## Follow-up from lifecycle code review

Additional findings from the full lifecycle pass ([Explore payout lifecycle](c6c42fb9-2624-4b10-b46c-7a643e34182e)):

| Finding | Severity | Action |
|---------|----------|--------|
| `retry-failed-payouts` is **Paystack-era** (`get_retry_payouts`, Paystack `/transfer`, `reverse_locked_funds`) — not SafeHaven claim/refund/`manual_hold` | High if still cron’d | Confirm Dashboard cron; unschedule if present. Docs still recommend deploying it — treat as stale. |
| `retry-pending-safehaven-transfers` on Failed/Reversed marks **transaction failed only** — does **not** fail AP or call `refund_payout_wallet_debit` | Critical for missed webhooks | Prefer webhook or `fail_payout_installment`; fix poller before relying on it for refunds. Docs (`PAYOUT_WEBHOOK_AND_RETRY.md`) claim fuller AP updates — **stale**. |
| No migration schedules either retry function via `pg_cron` in-repo | Info | Still verify live `cron.job` / Edge Function schedules in Dashboard |
| Monitoring API can still POST `retry-failed-payouts` | Medium | Gate or remove until rewritten for SafeHaven |
| Canonical path confirmed | — | `process-due-payouts` → claim → SafeHaven → webhook/complete; modern retry = get_due + claim `retry_after_refund` |
