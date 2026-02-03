# Mono Integration Log - January 27, 2026

## Overview
This log documents the successful troubleshooting and implementation of the Mono "Direct Bank Pay" feature, including account linking and mandate authorization using Supabase Edge Functions.

## Issues Resolved (Update Jan 28, 2026)

### 1. "Mono Customer Not Found"
*   **Cause:** Client-side usage of secret keys and missing/mismatched configuration between `app.json` and `app.config.js`.
*   **Resolution:** 
    *   Migrated customer creation logic to a secure Edge Function (`mono-api-proxy`).
    *   Removed `EXPO_PUBLIC_MONO_SECRET_KEY` from client code.
    *   Aligned `package` name in `app.json` to `com.planmoni.app` to match `app.config.js`.

### 2. "App not found" (Mono Widget)
*   **Cause:** Mono public key was created for a "Web" app, which validates referrers, whereas React Native apps validate via Package Name.
*   **Resolution:** 
    *   Confirmed `com.planmoni.app` is the correct package name.
    *   User needs to whitelist this package name in the Mono Dashboard or create a new Mobile app to generate a compatible key.

## Issues Resolved (Update Jan 28, 2026 - Final Session)

### 3. "Subscription plan has expired" (401 Error) - FIXED
*   **Status:** User successfully funded the Mono wallet.

### 4. "You are not authorized" (401 Error) - FIXED
*   **Cause:** Typo/Mismatch in Supabase Secrets for `MONO_SECRET_KEY`.
*   **Resolution:** Re-uploaded correct live secret key.

### 5. "Relation mono_mandates does not exist" - FIXED
*   **Cause:** Migrations were out of sync; the table existed locally but not on the live database.
*   **Resolution:** Manually created `mono_mandates` table and `process_mono_deposit` function via Supabase SQL Editor using `SETUP_MONO_TABLES.sql`.

### 6. "Customer not found" / "Identity incomplete" - FIXED
*   **Cause:** Mono V2 requires strict customer identity (phone, address) and existing IDs.
*   **Resolution:** 
    *   Implemented **Self-Healing logic** in `mono-mandate-initiate`.
    *   The function now automatically creates a Mono customer if missing.
    *   The function automatically **PATCHES** existing customers if Mono returns "Phone number and address are required."

### 7. "Reference must be Alphanumeric" - FIXED
*   **Cause:** Reference used underscores/dashes which Mono V2 forbids.
*   **Resolution:** Updated reference generation to be strictly alphanumeric.

## Current Technical State
*   ✅ **Table Schema:** `mono_mandates` is live with partial unique indexing for active mandates.
*   ✅ **Edge Functions:** `mono-mandate-initiate` is ultra-resilient with multi-layer retries.
*   ✅ **Frontend:** Flow is complete (Select -> Amount -> Authorize -> Execute).
*   ✅ **Security:** Webhook signature verification and atomic balance updates are active.

## Final Instructions for User
1.  Run the final SQL in `SETUP_MONO_TABLES.sql` if not already done.
2.  Set `MONO_WEBHOOK_SECRET` in Supabase Secrets.
3.  Set Webhook URL in Mono Dashboard to: `https://rqmpnoaavyizlwzfngpr.supabase.co/functions/v1/mono-webhook`.

### 4. Mandate Authorization Bridge
*   **Issue:** The app was not opening the hosted `mono_url` for mandate authorization.
*   **Resolution:** 
    *   Updated `AuthorizationScreen` to use `expo-web-browser` to open the mandate URL.
    *   Added `refetchMandates` to update the UI once the user returns from authorization.

## Technical Implementation

### Frontend Flow (`Direct Bank Pay`)
1.  **Select Method:** Added "Direct Bank Pay (Mono)" to `app/add-funds.tsx` and `app/deposit-flow/payment-methods.tsx`.
2.  **Amount:** User enters amount in `amount.tsx`.
3.  **Linking:** If no account is linked, redirects to `linked-accounts.tsx`.
    *   Updated `linked-accounts.tsx` to allow account selection for payment when `fromDepositFlow` is true.
4.  **Authorization:** Redirects to `AuthorizationScreen`.
    *   If no mandate, calls `mono-mandate-initiate`.
    *   Automatically opens `mono_url` in browser for one-time authorization.
    *   Upon return, "Fund wallet now" executes the debit via `mono-debit-execute`.

### Backend (Supabase Edge Functions)
*   **`mono-api-proxy`**: Proxies `/v2/accounts/auth` and `/v2/accounts/{id}`.
*   **`mono-mandate-initiate`**: 
    *   Added `start_date` and `end_date` for API compliance.
    *   Now fetches and uses `mono_customer_id` from user profile.
*   **`mono-webhook`**: Configured to handle `debit.successful` with `settled: true` before crediting the wallet.

## Current Status (Jan 28, 2026)
*   ✅ UI Flow: Select -> Amount -> Link -> Authorize -> Execute (Complete).
*   ✅ Security: All sensitive keys moved to Edge Functions.
*   ✅ Logic: Compliance with Mono V2 Payments API.
*   ⏳ Pending: Wallet funding on Mono Dashboard to reactive the PAYG plan.

## Next Steps
1.  **Subscription:** Renew/activate plan on app.mono.co.
2.  **Mandate Dates:** Update `mono-mandate-initiate` to include `start_date` and `end_date` for full API compliance (optional but recommended).
3.  **Settlement:** Ensure webhook handles `settled` status for wallet crediting.
