Collecting workspace information# Planmoni Technical Documentation

## Overview

Planmoni is a React Native Expo application designed for financial planning, payout scheduling, and wallet management for Nigerian users. It integrates with Paystack for virtual accounts, card payments, and USSD payments, and uses Supabase for real-time data and authentication.

---

## Key Features

- **Virtual Account Creation:** Users can create dedicated bank accounts for receiving funds.
- **Automated Balance Updates:** Wallet balances update automatically when money is sent to virtual accounts.
- **Payout Scheduling:** Flexible payout plans (daily, weekly, monthly, biweekly, end-of-month).
- **Card & USSD Payments:** Direct Paystack integration for card and USSD payments.
- **KYC Verification:** BVN, NIN, passport, and document verification via Dojah.
- **Real-time Notifications:** Email and in-app notifications for transactions and plan events.
- **Referral Rewards:** Automated referral reward system.

---

## Architecture

- **Frontend:** React Native (Expo)
- **Backend:** Supabase (Postgres, Functions), Paystack API, Dojah API
- **APIs:** Custom endpoints in api and api folders
- **Real-time:** Supabase subscriptions for wallet and transaction updates

---

## Main Components

| Component/Feature          | File/Folder                          | Description                                                                 |
| -------------------------- | ------------------------------------ | --------------------------------------------------------------------------- |
| Home Screen                | [`aindex.tsx`](app/(tabs)/index.tsx) | Displays wallet balance, transactions, and payout plans                     |
| Balance Context            | BalanceContext.tsx                   | Provides wallet state and real-time updates                                 |
| Paystack Webhook Handler   | paystack-webhook+api.ts              | Processes incoming Paystack webhooks, updates balance, creates transactions |
| Paystack Transactions Hook | usePaystackTransactions.ts           | Fetches and processes Paystack transactions                                 |
| USSD Payments              | useUSSD.ts                           | Handles USSD payment initialization and status checks                       |
| Card Payments              | add-card.tsx                         | Card addition and payment flow                                              |
| KYC Verification           | kyc-upgrade.tsx                      | Handles user identity verification                                          |
| Referral Rewards           | index.ts                             | Rewards referrers automatically                                             |
| Email Notifications        | email-notifications+api.ts           | Sends transactional and summary emails                                      |
| Database Migrations        | migrations                           | Schema and function definitions                                             |

---

## Payment Flows

### Virtual Account

1. User creates a virtual account (index.tsx).
2. Paystack assigns a dedicated account.
3. Incoming payments trigger webhook (paystack-webhook+api.ts).
4. Wallet balance and transaction records update automatically.

### Card Payment

1. User initiates payment via card (add-card.tsx).
2. App calls Paystack `/transaction/initialize` API.
3. User completes payment on Paystack Checkout.
4. Webhook updates wallet and saves card token.

### USSD Payment

1. User selects USSD payment (useUSSD.ts).
2. App calls Paystack `/charge` API with USSD type.
3. User dials USSD code to complete payment.
4. Webhook updates wallet and transaction records.

---

## KYC Verification

- BVN, NIN, passport, and document verification via Dojah API.
- Endpoints: dojah-kyc+api.ts, dojah-kyc+api.ts
- Verification status stored in Supabase tables.

---

## Real-time Updates

- Supabase subscriptions update wallet and transaction data instantly.
- Balance context (BalanceContext.tsx) provides state to all screens.

---

## Security

- Webhook signatures verified for all Paystack events.
- API keys and secrets stored in .env (never exposed in frontend).
- Row Level Security (RLS) enabled on all database tables.
- Input validation and error handling throughout.

---

## Testing & Debugging

- Test scripts in scripts for webhook and transaction simulation.
- Manual testing via app UI and Paystack dashboard.
- Logs available for webhook, real-time, and balance context events.

---

## Support & Troubleshooting

- Check logs and error messages.
- Verify Paystack and Supabase configuration.
- Use provided scripts for debugging.
- Contact support at `support@planmoni.com`.

---

## References

- PAYSTACK_INTEGRATION.md
- BALANCE_UPDATE_GUIDE.md
- CARD_PAYMENT_INTEGRATION.md
- USSD_INTEGRATION.md
- PAYSTACK_WEBHOOK_SETUP.md

---

For more details, see the documentation files in the docs folder.