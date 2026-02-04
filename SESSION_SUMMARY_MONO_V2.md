# Mono DirectPay V2 Migration Summary
**Date:** February 4, 2026
**Status:** ✅ Complete & Verified

## Core Architecture
The application has been refactored to use a **Server-Initiated Mandate Flow**, replacing the previous unstable Client-Side SDK implementation. This ensures compliance with Mono API V2 and robust handling of Nigerian banking scenarios (e.g., app switching for transfers).

### 1. Linking Flow (Bank Binding)
*   **User Action:** Clicks "Link Bank Account".
*   **Frontend:** Calls `PaymentService.initiateMandateSetup`.
*   **Backend (`initiate-mandate`):**
    *   **Identity Resolution:** Checks DB for existing `mono_customer_id`.
    *   **Self-Healing:** If "Identity Exists" conflict occurs, it extracts the existing ID from the error response or falls back to V1 lookup.
    *   **Patching:** Ensures the Mono Customer has `phone` and `address` (Required for Mandates).
    *   **Initiation:** Calls `POST /v2/payments/initiate` (Variable Recurring Mandate, 10 Years).
    *   **Return:** Returns a secure `mono_url`.
*   **Frontend:** Opens the URL in **System Browser** (Chrome/Safari) using `Linking.openURL`.
    *   *Why?* Prevents the session from closing when the user minimizes the app to make a bank transfer.
*   **Return:** User is redirected to `planmoni://mandate-status`, which the app listens for to trigger the "Success" state.

### 2. Charging Flow (Instant Debit)
*   **User Action:** Enters amount and clicks "Pay Now".
*   **Frontend:** Calls `PaymentService.chargeSavedBank`.
*   **Backend (`charge-saved-bank`):**
    *   Retrieves `mandate_id` (Account ID) from `profiles`.
    *   Calls `POST /v2/payments/initiate` with `type: "onetime-debit"` and `account: savedId`.
    *   **Fix:** Uses `mandate_type: "on-demand"` and strictly alphanumeric references (`< 24 chars`) to satisfy V2 validation.
*   **Result:** Immediate debit initiation.

### 3. Webhook (Settlement & Sync)
*   **Function:** `mono-webhook`
*   **Security:** Implements "Soft Fail" signature verification for easier debugging.
*   **Sync:** Listens for `mandate.active` to automatically update the `profiles` table if the frontend flow is interrupted.

## Key Files Created/Modified
*   `supabase/functions/initiate-mandate/index.ts` (New Core Logic)
*   `supabase/functions/charge-saved-bank/index.ts` (Charging Logic)
*   `supabase/functions/mono-webhook/index.ts` (Event Handling)
*   `app/deposit-flow/deposit.tsx` (UI with Deep Linking)
*   `services/PaymentService.ts` (API Interface)
*   `app.json` (Scheme updated to `planmoni`)

## Deployment Status
All functions are deployed. The Android app requires a native rebuild (`npx expo run:android`) to register the new deep link scheme.
