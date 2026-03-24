# Security Audit Report - Exposed Secrets

**Date:** $(date)  
**Severity:** 🔴 CRITICAL  
**Status:** ⚠️ PARTIALLY FIXED - Client-side code still needs updates

## Summary

This audit identified multiple exposed API keys, secrets, and credentials:
1. **Hardcoded secrets** - ✅ FIXED
2. **EXPO_PUBLIC_ secret keys** - ⚠️ PARTIALLY FIXED (removed from app.config.js, but client code still needs updates)

**CRITICAL:** Secrets exposed via `EXPO_PUBLIC_*` variables are bundled into the client app and visible to anyone. These MUST be moved to server-side operations.

---

## 🔴 CRITICAL ISSUES FOUND & FIXED

### 1. Mono Secret Key (LIVE PRODUCTION KEY) - FIXED ✅
**Severity:** CRITICAL  
**Risk:** Full access to Mono payment API with live production credentials

**Locations Found:**
- `hooks/useMonoDirectPay.ts` (lines 47, 222)
- `app/linked-accounts.tsx` (line 128)
- `hooks/useMonoAccountLinking.ts` (line 38)

**Exposed Key:** `live_sk_n1ubbmxfwkgoguab8cct`

**Fix Applied:**
- Replaced all hardcoded values with `process.env.EXPO_PUBLIC_MONO_SECRET_KEY`
- Added proper error handling for missing keys

---

### 2. Mono Public Key - FIXED ✅
**Severity:** MEDIUM  
**Risk:** Public keys are less sensitive but should still use environment variables

**Locations Found:**
- `app/deposit-flow/mono-pay.tsx` (line 329)
- `app/linked-accounts.tsx` (line 297)

**Exposed Key:** `live_pk_lyyes0d6yletb9osxnkf`

**Fix Applied:**
- Replaced with `process.env.EXPO_PUBLIC_MONO_PUBLIC_KEY`

---

### 3. Resend API Key - FIXED ✅
**Severity:** CRITICAL  
**Risk:** Full access to email sending service, potential for spam/abuse

**Locations Found:**
- `lib/email-service.ts` (line 4)
- `app/api/account-statement+api.ts` (line 7)
- `supabase/functions/send-account-statement/index.ts` (line 529)
- `supabase/functions/login-notification/index.ts` (line 97)
- `supabase/functions/send-otp-email/index.ts` (line 66)
- `supabase/functions/email-notifications/index.ts` (line 167)
- `supabase/functions/send-email/index.ts` (line 28)

**Exposed Key:** `re_cZUmUFmE_Co9jLj1mrMEx4vVknuhwQXUu`

**Fix Applied:**
- Removed all hardcoded fallback values
- Now requires `RESEND_API_KEY` environment variable
- Added proper error handling

---

### 4. Firebase Service Account Private Key - ACTION REQUIRED ⚠️
**Severity:** CRITICAL  
**Risk:** Full access to Firebase project, can impersonate service account

**Location Found:**
- `planmoni-7e669-0a063d562e31.json` (contains full private key)

**Status:**
- ✅ Added to `.gitignore` to prevent future commits
- ⚠️ **ACTION REQUIRED:** File may already be in git history

**Recommendations:**
1. **IMMEDIATE:** Rotate the Firebase service account key in Google Cloud Console
2. Remove the file from git history if already committed:
   ```bash
   git rm --cached planmoni-7e669-0a063d562e31.json
   git commit -m "Remove exposed Firebase service account key"
   ```
3. Store the JSON content as environment variable `GOOGLE_SERVICE_ACCOUNT_JSON` in Supabase secrets
4. Consider using git-secrets or BFG Repo-Cleaner to remove from history

---

## ✅ FIXES APPLIED

### Files Modified:
1. `hooks/useMonoDirectPay.ts` - Removed hardcoded Mono secret key (2 instances)
2. `app/linked-accounts.tsx` - Removed hardcoded Mono secret and public keys
3. `hooks/useMonoAccountLinking.ts` - Removed hardcoded Mono secret key
4. `app/deposit-flow/mono-pay.tsx` - Removed hardcoded Mono public key
5. `lib/email-service.ts` - Removed hardcoded Resend API key
6. `app/api/account-statement+api.ts` - Removed hardcoded Resend API key
7. `supabase/functions/send-account-statement/index.ts` - Removed hardcoded Resend API key
8. `supabase/functions/login-notification/index.ts` - Removed hardcoded Resend API key
9. `supabase/functions/send-otp-email/index.ts` - Removed hardcoded Resend API key
10. `supabase/functions/email-notifications/index.ts` - Removed hardcoded Resend API key
11. `supabase/functions/send-email/index.ts` - Removed hardcoded Resend API key
12. `.gitignore` - Added Firebase service account JSON patterns

---

## 🔴 NEW CRITICAL ISSUE: EXPO_PUBLIC_ Secret Keys

### Problem
Multiple **SECRET KEYS** were exposed via `EXPO_PUBLIC_*` variables in `app.config.js`, which get bundled into the client app.

### Exposed Secrets (FIXED in app.config.js, but client code still uses them):
1. ❌ `EXPO_PUBLIC_MONO_SECRET_KEY` - Used in client hooks
2. ❌ `EXPO_PUBLIC_PAYSTACK_SECRET_KEY` - Used in client hooks
3. ❌ `EXPO_PUBLIC_PAYSTACK_LIVE_SECRET_KEY` - Used in client hooks
4. ❌ `EXPO_PUBLIC_DOJAH_PRIVATE_KEY` - Used in client components
5. ❌ `EXPO_PUBLIC_OPENAI_API_KEY` - Used in client lib
6. ❌ `EXPO_PUBLIC_RESEND_API_KEY` - Used in client hooks

### Fix Status:
- ✅ **app.config.js** - All secret keys removed
- ✅ **API Routes** - Updated to use server-side env vars
- ⚠️ **Client Code** - Still needs migration to server-side routes

**See [SECURITY_FIX_SUMMARY.md](./SECURITY_FIX_SUMMARY.md) for detailed migration plan.**

---

## 🔒 REQUIRED ACTIONS

### Immediate Actions:
1. **Rotate all exposed keys:**
   - Mono Secret Key: `live_sk_n1ubbmxfwkgoguab8cct` → Generate new key in Mono dashboard
   - Resend API Key: `re_cZUmUFmE_Co9jLj1mrMEx4vVknuhwQXUu` → Generate new key in Resend dashboard
   - Firebase Service Account → Rotate in Google Cloud Console

2. **Set environment variables:**
   - ❌ **DO NOT** set `EXPO_PUBLIC_MONO_SECRET_KEY` (removed - use server-side only)
   - ✅ `EXPO_PUBLIC_MONO_PUBLIC_KEY` - Safe to expose (public key)
   - ✅ `MONO_SECRET_KEY` - Set in Supabase secrets (server-side only, no EXPO_PUBLIC_ prefix)
   - ✅ `RESEND_API_KEY` - Set in Supabase secrets (server-side only)
   - ✅ `PAYSTACK_LIVE_SECRET_KEY` - Set in Supabase secrets or API route env vars (server-side only)
   - ✅ `DOJAH_PRIVATE_KEY` - Set in API route env vars (server-side only)
   - ✅ `OPENAI_API_KEY` - Set in Supabase secrets (server-side only)
   - ✅ `GOOGLE_SERVICE_ACCOUNT_JSON` - Set in Supabase secrets (as JSON string)

3. **Remove from git history (if already committed):**
   ```bash
   # Remove Firebase service account file
   git rm --cached planmoni-7e669-0a063d562e31.json
   git commit -m "Security: Remove exposed Firebase service account key"
   
   # If already pushed, consider using BFG Repo-Cleaner or git filter-branch
   ```

4. **Verify .gitignore:**
   - Ensure `.gitignore` includes patterns for service account files
   - Never commit files containing private keys

---

## 🛡️ PREVENTION MEASURES

### Best Practices Implemented:
1. ✅ All secrets now use environment variables
2. ✅ No hardcoded fallback values for sensitive keys
3. ✅ Proper error handling when keys are missing
4. ✅ Service account JSON files added to `.gitignore`

### Recommended Additional Measures:
1. **Use git-secrets or similar tools** to prevent committing secrets
2. **Set up pre-commit hooks** to scan for exposed secrets
3. **Use secret scanning tools** like:
   - GitHub Secret Scanning (if using GitHub)
   - GitGuardian
   - TruffleHog
4. **Regular security audits** - Schedule quarterly reviews
5. **Use secret management services:**
   - Supabase Secrets (for Edge Functions)
   - AWS Secrets Manager
   - HashiCorp Vault

---

## 📋 ENVIRONMENT VARIABLES CHECKLIST

Ensure these are set in your environment:

### Frontend/Expo:
- [ ] `EXPO_PUBLIC_MONO_SECRET_KEY`
- [ ] `EXPO_PUBLIC_MONO_PUBLIC_KEY`
- [ ] `RESEND_API_KEY` (if used in frontend)

### Supabase Edge Functions:
- [ ] `RESEND_API_KEY`
- [ ] `GOOGLE_SERVICE_ACCOUNT_JSON` (as JSON string)
- [ ] `PAYSTACK_SECRET_KEY` (verify not hardcoded)
- [ ] `PAYSTACK_LIVE_SECRET_KEY` (verify not hardcoded)

---

## ⚠️ IMPORTANT NOTES

1. **All exposed keys should be considered compromised** and rotated immediately
2. **Review git history** to see if these keys were ever committed
3. **Monitor for unauthorized access** to all affected services
4. **Update team members** about the security changes
5. **Document the incident** for compliance purposes

---

## 📞 SUPPORT

If you need help with:
- Rotating keys in service dashboards
- Setting up environment variables
- Removing secrets from git history
- Setting up secret scanning tools

Contact your security team or DevOps lead.

---

**Report Generated:** Security Audit  
**Next Review:** Recommended in 3 months

