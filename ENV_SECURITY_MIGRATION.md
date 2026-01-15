# Environment Variables Security Migration Plan

## 🔴 CRITICAL SECURITY ISSUES IDENTIFIED

### Problem
Multiple **SECRET KEYS** are exposed via `EXPO_PUBLIC_*` variables, which get bundled into the client app and are visible to anyone who inspects the app.

### Exposed Secrets (MUST BE FIXED IMMEDIATELY):
1. ❌ `EXPO_PUBLIC_MONO_SECRET_KEY` - **SECRET KEY** exposed in client
2. ❌ `EXPO_PUBLIC_PAYSTACK_SECRET_KEY` - **SECRET KEY** exposed in client  
3. ❌ `EXPO_PUBLIC_PAYSTACK_LIVE_SECRET_KEY` - **SECRET KEY** exposed in client
4. ❌ `EXPO_PUBLIC_DOJAH_PRIVATE_KEY` - **PRIVATE KEY** exposed in client
5. ❌ `EXPO_PUBLIC_OPENAI_API_KEY` - **API KEY** exposed in client
6. ❌ `EXPO_PUBLIC_RESEND_API_KEY` - **API KEY** exposed in client
7. ❌ `EXPO_PUBLIC_SAFEHAVEN_CLIENT_ASSERTION` - **CLIENT ASSERTION** exposed in client

---

## ✅ SECURE VARIABLES (Can stay as EXPO_PUBLIC_)

These are safe to expose because they're designed to be public:
- ✅ `EXPO_PUBLIC_SUPABASE_URL` - Public URL
- ✅ `EXPO_PUBLIC_SUPABASE_ANON_KEY` - Anon key (public, RLS-protected)
- ✅ `EXPO_PUBLIC_PAYSTACK_PUBLIC_KEY` - Public key (designed to be public)
- ✅ `EXPO_PUBLIC_MONO_PUBLIC_KEY` - Public key (designed to be public)
- ✅ `EXPO_PUBLIC_DOJAH_APP_ID` - App ID (can be public)
- ✅ `EXPO_PUBLIC_API_URL` - Public API URL
- ✅ `EXPO_PUBLIC_APP_URL` - Public app URL

---

## 🔧 MIGRATION STRATEGY

### Phase 1: Remove Secrets from app.config.js
Remove all secret keys from `app.config.js` extra section.

### Phase 2: Move Secret Operations to Server-Side
Create API routes or use Supabase Edge Functions for all operations requiring secrets.

### Phase 3: Update Client Code
Update all client-side code to call server-side API routes instead of using secrets directly.

---

## 📋 DETAILED MIGRATION PLAN

### 1. Mono Secret Key Operations

**Current (INSECURE):**
- Client directly calls Mono API with `EXPO_PUBLIC_MONO_SECRET_KEY`

**Solution:**
- Create Supabase Edge Function: `mono-api-proxy`
- Client calls Edge Function
- Edge Function uses `MONO_SECRET_KEY` (server-side only)

**Files to Update:**
- `hooks/useMonoDirectPay.ts`
- `hooks/useMonoAccountLinking.ts`
- `hooks/useMonoCustomer.ts`
- `app/linked-accounts.tsx`

---

### 2. Paystack Secret Key Operations

**Current (INSECURE):**
- Client directly calls Paystack API with `EXPO_PUBLIC_PAYSTACK_LIVE_SECRET_KEY`

**Solution:**
- Update existing API routes to use server-side `PAYSTACK_LIVE_SECRET_KEY`
- Remove `EXPO_PUBLIC_` prefix from API route files

**Files to Update:**
- `app/api/fetch-paystack-transactions+api.ts` ✅ (already API route, just needs env var fix)
- `hooks/usePaystackTransactions.ts` - Move to API route
- `app/add-card.tsx` - Move to API route

---

### 3. Dojah Private Key Operations

**Current (INSECURE):**
- Client directly calls Dojah API with `EXPO_PUBLIC_DOJAH_PRIVATE_KEY`

**Solution:**
- Use existing API routes: `app/api/dojah-kyc+api.ts`, `app/api/dojah-document-analysis+api.ts`
- Update to use server-side `DOJAH_PRIVATE_KEY`

**Files to Update:**
- `app/kyc-upgrade.tsx` - Use API routes instead
- `utils/kyc-verification.ts` - Use API routes instead
- `app/api/dojah-kyc+api.ts` - Fix env var
- `app/api/dojah-document-analysis+api.ts` - Fix env var

---

### 4. OpenAI API Key Operations

**Current (INSECURE):**
- Client directly calls OpenAI API with `EXPO_PUBLIC_OPENAI_API_KEY`

**Solution:**
- Create Supabase Edge Function: `openai-proxy`
- Client calls Edge Function
- Edge Function uses `OPENAI_API_KEY` (server-side only)

**Files to Update:**
- `lib/openai.ts` - Call Edge Function instead

---

### 5. Resend API Key Operations

**Current (INSECURE):**
- Some client code uses `EXPO_PUBLIC_RESEND_API_KEY`

**Solution:**
- Already mostly server-side (Supabase functions)
- Remove any client-side usage

**Files to Update:**
- `hooks/usePaystackTransactions.ts` - Remove Resend usage if any

---

### 6. SafeHaven Client Assertion

**Current (INSECURE):**
- Client uses `EXPO_PUBLIC_SAFEHAVEN_CLIENT_ASSERTION`

**Solution:**
- Move to Supabase Edge Functions
- Use server-side `SAFEHAVEN_CLIENT_ASSERTION`

**Files to Update:**
- `lib/safehaven-service.ts`
- `lib/safehaven-api-service.ts`

---

## 🚀 IMPLEMENTATION STEPS

### Step 1: Update app.config.js
Remove all secret keys from `extra` section.

### Step 2: Create/Update Server-Side API Routes
Ensure all API routes use server-side env vars (no `EXPO_PUBLIC_` prefix).

### Step 3: Create Supabase Edge Functions
For operations that need secrets but don't have API routes yet.

### Step 4: Update Client Code
Replace direct API calls with calls to server-side routes/functions.

### Step 5: Update Environment Variables
- Remove `EXPO_PUBLIC_*` versions of secrets
- Add server-side versions (no prefix)
- Update Supabase secrets
- Update EAS build secrets

---

## 📝 ENVIRONMENT VARIABLES CHECKLIST

### Server-Side Only (No EXPO_PUBLIC_ prefix):
- [ ] `MONO_SECRET_KEY` - Set in Supabase secrets
- [ ] `PAYSTACK_SECRET_KEY` - Set in Supabase secrets
- [ ] `PAYSTACK_LIVE_SECRET_KEY` - Set in Supabase secrets
- [ ] `DOJAH_PRIVATE_KEY` - Set in Supabase secrets
- [ ] `OPENAI_API_KEY` - Set in Supabase secrets
- [ ] `RESEND_API_KEY` - Set in Supabase secrets
- [ ] `SAFEHAVEN_CLIENT_ASSERTION` - Set in Supabase secrets

### Client-Side (EXPO_PUBLIC_ prefix - Safe):
- [x] `EXPO_PUBLIC_SUPABASE_URL`
- [x] `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- [x] `EXPO_PUBLIC_PAYSTACK_PUBLIC_KEY`
- [x] `EXPO_PUBLIC_MONO_PUBLIC_KEY`
- [x] `EXPO_PUBLIC_DOJAH_APP_ID`
- [x] `EXPO_PUBLIC_API_URL`
- [x] `EXPO_PUBLIC_APP_URL`

---

## ⚠️ CRITICAL: Rotate All Exposed Keys

Since these keys were exposed in the client bundle, they MUST be rotated:
1. Mono Secret Key
2. Paystack Secret Keys
3. Dojah Private Key
4. OpenAI API Key
5. Resend API Key
6. SafeHaven Client Assertion

---

## 🔒 SECURITY BEST PRACTICES

1. **Never use `EXPO_PUBLIC_` for secrets** - They get bundled into the app
2. **Always use server-side env vars** for API keys, secrets, tokens
3. **Use API routes or Edge Functions** for operations requiring secrets
4. **Validate and authenticate** all API route requests
5. **Use RLS (Row Level Security)** in Supabase for data protection
6. **Rotate keys immediately** if exposed




