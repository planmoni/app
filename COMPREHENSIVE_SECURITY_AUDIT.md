# 🔒 Comprehensive Security Audit Report
**React Native & Expo Application**

**Date:** $(date)  
**Auditor:** Senior Security Engineer  
**Status:** 🔴 **NOT SAFE FOR PRODUCTION** - Critical issues found

---

## Executive Summary

This comprehensive security audit identified **multiple critical vulnerabilities** that expose sensitive credentials, API keys, and secrets in the client-side application bundle. These issues allow attackers to:

- Access payment processing APIs (Mono, Paystack)
- Send unauthorized emails (Resend)
- Access KYC verification services (Dojah)
- Use OpenAI API with your credentials
- Potentially access Supabase with elevated privileges

**All exposed secrets MUST be rotated immediately** and client-side code MUST be migrated to use server-side API routes or Supabase Edge Functions.

---

## 🔴 CRITICAL SEVERITY ISSUES

### 1. Client-Side Secret Keys Exposed via EXPO_PUBLIC_ Variables

**Severity:** 🔴 **CRITICAL**  
**Risk Level:** **EXTREME**  
**Impact:** All secrets are bundled into the app and visible to anyone who inspects the bundle

#### Issue Details:

Multiple secret keys are exposed via `EXPO_PUBLIC_*` variables, which get bundled into the client app:

1. **`EXPO_PUBLIC_MONO_SECRET_KEY`** - Live production secret key
   - **Files Affected:**
     - `hooks/useMonoDirectPay.ts` (lines 47, 222)
     - `hooks/useMonoAccountLinking.ts` (line 37)
     - `hooks/useMonoCustomer.ts` (line 70)
     - `app/linked-accounts.tsx` (line 128)
   - **Risk:** Full access to Mono payment API, can initiate/verify payments, access customer data

2. **`EXPO_PUBLIC_PAYSTACK_LIVE_SECRET_KEY`** - Live production secret key
   - **Files Affected:**
     - `hooks/usePaystackTransactions.ts` (line 68)
     - `app/add-card.tsx` (lines 49, 177)
     - `hooks/useBanks.ts` (line 39)
     - `hooks/useAccountResolution.ts` (lines 18, 50)
     - `hooks/useUSSD.ts` (line 12)
   - **Risk:** Full access to Paystack API, can verify transactions, initialize payments, access bank data

3. **`EXPO_PUBLIC_DOJAH_PRIVATE_KEY`** - Private authentication key
   - **Files Affected:**
     - `app/kyc-upgrade.tsx` (lines 1166, 1543)
     - `utils/kyc-verification.ts` (lines 88, 547)
   - **Risk:** Full access to Dojah KYC services, can perform identity verification, access sensitive user data

4. **`EXPO_PUBLIC_OPENAI_API_KEY`** - OpenAI API key
   - **Files Affected:**
     - `lib/openai.ts` (lines 7-8, 23, 63)
   - **Risk:** Unauthorized API usage, potential cost abuse, access to AI services

5. **`EXPO_PUBLIC_RESEND_API_KEY`** - Email service API key
   - **Files Affected:**
     - `hooks/usePaystackTransactions.ts` (line 315)
   - **Risk:** Unauthorized email sending, spam potential, reputation damage

#### Why This Is Dangerous:

- **EXPO_PUBLIC_ variables are bundled into the JavaScript bundle**
- Anyone can extract the app bundle and read these values
- Attackers can use these keys directly against your APIs
- No way to revoke access without rotating keys
- Potential for financial fraud, data breaches, service abuse

#### Fix Required:

**IMMEDIATE ACTIONS:**
1. ✅ **COMPLETED:** Removed from `app.config.js`
2. ⚠️ **PENDING:** Migrate all client-side code to use server-side routes
3. ⚠️ **PENDING:** Rotate all exposed keys immediately

**Migration Strategy:**
- Create Supabase Edge Functions for Mono operations
- Create API routes for Paystack operations
- Use existing API routes for Dojah (already exist, just need to update client code)
- Create Supabase Edge Function for OpenAI
- Remove Resend usage from client (already server-side in functions)

---

### 2. Hardcoded Intercom API Keys in app.config.js

**Severity:** 🟡 **MEDIUM**  
**Risk Level:** **MODERATE**  
**Impact:** API keys exposed in configuration

#### Issue Details:

```javascript
// app.config.js lines 117-118
INTERCOM_IOS_API_KEY: "ios_sdk-de52645ae34ab0f059890a422f90b18092032115",
INTERCOM_ANDROID_API_KEY: "android_sdk-c13200a10981c64eb6e2b4030551b67de50243bf",
```

#### Why This Is Dangerous:

- Intercom SDK keys are typically public, but hardcoding them makes rotation difficult
- Should use environment variables for easier management

#### Fix Required:

```javascript
// app.config.js
INTERCOM_IOS_API_KEY: process.env.INTERCOM_IOS_API_KEY || "",
INTERCOM_ANDROID_API_KEY: process.env.INTERCOM_ANDROID_API_KEY || "",
```

---

### 3. Firebase Service Account Private Key in Repository

**Severity:** 🔴 **CRITICAL**  
**Risk Level:** **EXTREME**  
**Impact:** Full Firebase project access

#### Issue Details:

- **File:** `planmoni-7e669-0a063d562e31.json`
- **Contains:** Full private key, client email, project ID
- **Status:** ✅ Added to `.gitignore` but may already be in git history

#### Why This Is Dangerous:

- Full access to Firebase project
- Can impersonate service account
- Can access all Firebase services
- Can modify project settings

#### Fix Required:

1. ✅ **COMPLETED:** Added to `.gitignore`
2. ⚠️ **REQUIRED:** Rotate service account key in Google Cloud Console
3. ⚠️ **REQUIRED:** Remove from git history if committed:
   ```bash
   git rm --cached planmoni-7e669-0a063d562e31.json
   git commit -m "Security: Remove exposed Firebase service account key"
   ```
4. ⚠️ **REQUIRED:** Store as environment variable `GOOGLE_SERVICE_ACCOUNT_JSON` in Supabase secrets

---

## 🟠 HIGH SEVERITY ISSUES

### 4. Insecure Storage Fallbacks

**Severity:** 🟠 **HIGH**  
**Risk Level:** **HIGH**  
**Impact:** Sensitive data may be stored insecurely

#### Issue Details:

Multiple files fall back to `AsyncStorage` when `SecureStore` fails:

- `lib/user-scoped-storage.ts` (lines 187-200, 220-230, 251-262)
- `lib/SecureStoreAdapter.ts` (line 69 - uses AsyncStorage on web)

#### Why This Is Dangerous:

- `AsyncStorage` is not encrypted
- Sensitive data (tokens, pins) could be stored in plaintext
- On web, falls back to localStorage which is accessible to JavaScript

#### Fix Required:

```typescript
// lib/user-scoped-storage.ts
// Remove AsyncStorage fallback for sensitive keys
if (this.isSensitiveKey(key)) {
  if (Platform.OS === 'web') {
    throw new Error('SecureStore not available on web for sensitive data');
  }
  // Only use SecureStore, no fallback
  return await SecureStore.getItemAsync(scopedKey, await this.getSecureStorageOptions());
}
```

**Sensitive Keys to Protect:**
- `app_lock_pin`
- `payout_pin`
- `emergency_pin`
- `auth_session`
- `auth_access_token`
- `auth_refresh_token`
- `biometric_token`

---

### 5. Missing HTTPS Validation

**Severity:** 🟠 **HIGH**  
**Risk Level:** **MODERATE**  
**Impact:** Potential for man-in-the-middle attacks

#### Issue Details:

No explicit HTTPS enforcement found in API calls. While most APIs use HTTPS, there's no validation.

#### Fix Required:

Add HTTPS validation:

```typescript
// lib/api-client.ts (create if doesn't exist)
const validateHttps = (url: string) => {
  if (!url.startsWith('https://')) {
    throw new Error('Only HTTPS URLs are allowed');
  }
};
```

---

## 🟡 MEDIUM SEVERITY ISSUES

### 6. AsyncStorage Usage for Non-Sensitive Data

**Severity:** 🟡 **MEDIUM**  
**Risk Level:** **LOW**  
**Impact:** Acceptable for non-sensitive data, but should be documented

#### Issue Details:

Many files use `AsyncStorage` for non-sensitive data (navigation state, UI preferences, etc.)

**Files:**
- `app/(tabs)/index.tsx`
- `contexts/TextSizeContext.tsx`
- `contexts/BalanceContext.tsx`
- `lib/route-persistence.ts`
- And many more...

#### Assessment:

✅ **ACCEPTABLE** - These are non-sensitive preferences and UI state. However, ensure no sensitive data leaks into these.

#### Recommendation:

Add comments to clarify which data is sensitive vs non-sensitive:

```typescript
// ✅ SAFE: Non-sensitive UI preference
await AsyncStorage.setItem('theme_preference', theme);

// ❌ DANGEROUS: Sensitive data - use SecureStore
// await AsyncStorage.setItem('auth_token', token); // DON'T DO THIS
```

---

### 7. Service Role Key Usage in API Routes

**Severity:** 🟡 **MEDIUM**  
**Risk Level:** **MODERATE**  
**Impact:** Properly secured, but should be monitored

#### Issue Details:

`SUPABASE_SERVICE_ROLE_KEY` is used in API routes (server-side only), which is correct.

**Files:**
- `app/api/account-statement+api.ts`
- `app/api/unsubscribe+api.ts`
- `app/api/track-open+api.ts`
- And many more...

#### Assessment:

✅ **ACCEPTABLE** - These are server-side API routes, not client code. Service role key is correctly kept server-side.

#### Recommendation:

- Ensure all API routes have proper authentication
- Use Row Level Security (RLS) in Supabase as additional protection
- Monitor for unauthorized access attempts

---

## ✅ SECURITY BEST PRACTICES FOUND

### Good Practices:

1. ✅ **SecureStore Usage** - Sensitive data uses `expo-secure-store` where appropriate
2. ✅ **Service Role Key** - Only used in server-side code (API routes, Edge Functions)
3. ✅ **Environment Variables** - Proper separation of public vs private variables
4. ✅ **API Routes** - Some operations already moved to server-side
5. ✅ **Authentication** - API routes verify user authentication
6. ✅ **HTTPS APIs** - All external APIs use HTTPS

---

## 📋 COMPREHENSIVE FIX CHECKLIST

### Immediate Actions (Before Production):

- [ ] **Rotate all exposed keys:**
  - [ ] Mono Secret Key
  - [ ] Paystack Secret Keys (test and live)
  - [ ] Dojah Private Key
  - [ ] OpenAI API Key
  - [ ] Resend API Key
  - [ ] Firebase Service Account Key

- [ ] **Create Server-Side Infrastructure:**
  - [ ] Create Supabase Edge Function: `mono-api-proxy`
  - [ ] Create Supabase Edge Function: `openai-proxy`
  - [ ] Create API route: `/api/paystack-transactions`
  - [ ] Create API route: `/api/verify-payment`
  - [ ] Create API route: `/api/initialize-payment`

- [ ] **Migrate Client Code:**
  - [ ] Update `hooks/useMonoDirectPay.ts` to use Edge Function
  - [ ] Update `hooks/useMonoAccountLinking.ts` to use Edge Function
  - [ ] Update `hooks/useMonoCustomer.ts` to use Edge Function
  - [ ] Update `app/linked-accounts.tsx` to use Edge Function
  - [ ] Update `hooks/usePaystackTransactions.ts` to use API route
  - [ ] Update `app/add-card.tsx` to use API routes
  - [ ] Update `app/kyc-upgrade.tsx` to use existing API routes
  - [ ] Update `utils/kyc-verification.ts` to use API routes
  - [ ] Update `lib/openai.ts` to use Edge Function
  - [ ] Remove Resend usage from `hooks/usePaystackTransactions.ts`

- [ ] **Environment Variables:**
  - [ ] Set `MONO_SECRET_KEY` in Supabase secrets
  - [ ] Set `PAYSTACK_LIVE_SECRET_KEY` in Supabase secrets
  - [ ] Set `DOJAH_PRIVATE_KEY` in API route hosting
  - [ ] Set `OPENAI_API_KEY` in Supabase secrets
  - [ ] Set `RESEND_API_KEY` in Supabase secrets
  - [ ] Remove all `EXPO_PUBLIC_*` secret keys from `.env` files

- [ ] **Security Hardening:**
  - [ ] Remove AsyncStorage fallback for sensitive keys
  - [ ] Add HTTPS validation
  - [ ] Update Intercom keys to use env vars
  - [ ] Remove Firebase service account from git history

- [ ] **Testing:**
  - [ ] Test all payment flows
  - [ ] Test KYC flows
  - [ ] Test OpenAI integration
  - [ ] Verify no secrets in client bundle
  - [ ] Test secure storage for sensitive data

---

## 🔍 VERIFICATION STEPS

### 1. Check Client Bundle for Secrets:

```bash
# Build the app
npx expo build

# Extract and search bundle
grep -r "live_sk_\|sk_live_\|re_[A-Za-z0-9]\{32\}" dist/
# Should return ZERO results
```

### 2. Verify Environment Variables:

```bash
# Should NOT find any EXPO_PUBLIC_* secret keys
grep -r "EXPO_PUBLIC.*SECRET\|EXPO_PUBLIC.*PRIVATE\|EXPO_PUBLIC.*KEY" \
  --include="*.ts" --include="*.tsx" \
  --exclude-dir=node_modules \
  --exclude-dir=.expo
```

### 3. Check .gitignore:

```bash
# Verify .env files are ignored
cat .gitignore | grep -E "\.env|service.*account|\.json"
```

---

## 📊 RISK ASSESSMENT

| Issue | Severity | Impact | Exploitability | Priority |
|-------|----------|--------|----------------|----------|
| EXPO_PUBLIC_ Secret Keys | 🔴 Critical | Extreme | Very Easy | P0 |
| Firebase Service Account | 🔴 Critical | Extreme | Easy | P0 |
| Insecure Storage Fallbacks | 🟠 High | High | Moderate | P1 |
| Missing HTTPS Validation | 🟠 High | Moderate | Moderate | P1 |
| Intercom Hardcoded Keys | 🟡 Medium | Low | Easy | P2 |
| AsyncStorage Usage | 🟡 Medium | Low | Low | P3 |

---

## 🚨 PRODUCTION READINESS

### Current Status: 🔴 **NOT SAFE FOR PRODUCTION**

**Blocking Issues:**
1. Multiple secret keys exposed in client bundle
2. Firebase service account key in repository
3. Client-side code directly accessing APIs with secrets

**Required Before Production:**
1. ✅ Remove secrets from `app.config.js` (COMPLETED)
2. ⚠️ Migrate all client-side secret usage to server-side (PENDING)
3. ⚠️ Rotate all exposed keys (PENDING)
4. ⚠️ Remove Firebase key from git history (PENDING)
5. ⚠️ Fix insecure storage fallbacks (PENDING)

**Estimated Time to Fix:** 2-3 days

---

## 📚 REFERENCES

- [Expo Environment Variables Guide](https://docs.expo.dev/guides/environment-variables/)
- [Supabase Edge Functions Secrets](https://supabase.com/docs/guides/functions/secrets)
- [React Native Security Best Practices](https://reactnative.dev/docs/security)
- [OWASP Mobile Top 10](https://owasp.org/www-project-mobile-top-10/)

---

## 📞 NEXT STEPS

1. **Immediate:** Rotate all exposed keys
2. **Day 1:** Create server-side infrastructure (Edge Functions, API routes)
3. **Day 2:** Migrate client-side code
4. **Day 3:** Testing and verification
5. **Before Production:** Complete security checklist

---

**Report Generated:** Comprehensive Security Audit  
**Next Review:** After fixes are implemented




