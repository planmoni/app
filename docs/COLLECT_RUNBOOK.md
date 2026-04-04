# Collect (Stripe platform) runbook

## Overview

Collect adds international **USD** payments using **Planmoni’s single Stripe account** (platform). Checkout sessions and invoices are created on that account; `supabase_user_id` and `collect_link_id` / `collect_invoice_id` in Stripe **metadata** attribute each charge to the correct user. Successful charges are converted to **NGN** using `collect_fx_rates` and `collect_fee_schedule`, then credited atomically via `finalize_collect_stripe_settlement`.

End users **do not** open or onboard their own Stripe accounts.

The table `collect_connected_accounts` is **legacy** (Connect Express). The webhook still runs `account.updated` updates against it if present; it is not required for Collect.

## Prerequisites (Stripe Dashboard)

1. Use your **platform** Stripe account (e.g. Planmoni, Inc.) with **secret key** in Supabase secrets.
2. Add webhook endpoint: `https://<project-ref>.supabase.co/functions/v1/stripe-webhook`
3. Subscribe to events:
   - `checkout.session.completed`
   - `invoice.paid`
   - (optional) `account.updated` — only if you still use Connect elsewhere
   - (optional) `payment_intent.succeeded`, `invoice.payment_failed`
4. Copy the **webhook signing secret** into Supabase secrets as `STRIPE_WEBHOOK_SECRET`.
5. Store `STRIPE_SECRET_KEY` (restricted key acceptable if scoped correctly) in Supabase Edge secrets.

## Supabase secrets (Edge Functions)

| Secret | Purpose |
|--------|---------|
| `STRIPE_SECRET_KEY` | Stripe API (platform account) |
| `STRIPE_WEBHOOK_SECRET` | Verify webhook signatures |
| `STRIPE_CHECKOUT_SUCCESS_URL` | Checkout success (default includes `myapp://collect/success`) |
| `STRIPE_CHECKOUT_CANCEL_URL` | Checkout cancel |

Match **return URLs** to your Expo scheme in `app.json` (`scheme`: `myapp`).

## Migrations

Apply:

- `20260403120000_planmoni_collect_stripe.sql` — tables, RLS, `finalize_collect_stripe_settlement`, seed FX/fee rows (includes unused `collect_connected_accounts` for legacy compatibility).

## Deploy functions

- `stripe-webhook` (`verify_jwt = false`)
- `stripe-collect-create-link`
- `stripe-collect-create-invoice`

Optional / legacy: `stripe-connect-start` (not used by the app).

## FX and fees (operations)

Collect settlement converts the **invoice currency → NGN** using `collect_fx_rates` where `quote_currency = 'NGN'` and `base_currency` matches the invoice (e.g. `USD`, `EUR`). Checkout links remain USD-only and use the USD row.

Update USD→NGN rate (example):

```sql
insert into collect_fx_rates (base_currency, quote_currency, rate, valid_from)
values ('USD', 'NGN', 1550, now());
```

For non-USD invoices, add a row per currency you allow in the app (example EUR):

```sql
insert into collect_fx_rates (base_currency, quote_currency, rate, valid_from)
values ('EUR', 'NGN', 1680, now());
```

Update Planmoni fee (% of NGN subtotal after Stripe fee + flat ₦):

```sql
insert into collect_fee_schedule (fee_percent, fee_flat_ngn, effective_from)
values (1.5, 0, now());
```

Settlement breakdown is stored per row in `collect_settlements`.

## Reconciliation SQL

```sql
select * from collect_settlements order by created_at desc limit 50;
```

```sql
select status, count(*) from collect_links group by 1;
select status, count(*) from collect_invoices group by 1;
```

```sql
select * from transactions
where source = 'Stripe Collect'
order by created_at desc
limit 50;
```

## Testing (Stripe test mode)

1. Use test keys on the **platform** account.
2. Forward webhooks locally: `stripe listen --forward-to http://127.0.0.1:54321/functions/v1/stripe-webhook`
3. Create a link or invoice from the app, pay with test card `4242…`.
4. Confirm `collect_settlements` row, `transactions` deposit, wallet balance.

## Charge model

Checkout and Invoicing run on the **platform** Stripe account. **Planmoni’s take** on Collect is modeled via `collect_fee_schedule` on the NGN conversion step (after Stripe’s own processing fees, using balance transaction data in the webhook).

## Compliance

Product/legal should confirm pricing disclosure, invoicing terms, and Nigeria cross-border rules. This runbook does not constitute legal advice.
