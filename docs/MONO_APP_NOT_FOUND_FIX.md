# Mono "App not found" Error - Fix Guide

## 🔍 Error Description

The error **"App not found"** from Mono typically occurs when:
1. Mono Connect widget cannot find the required configuration
2. Mono public key is missing or incorrect
3. MonoProvider is not properly configured
4. Mono SDK cannot initialize

## ✅ Fixes Applied

### 1. Added Validation in `LinkAccountButton`
- ✅ Checks if `EXPO_PUBLIC_MONO_PUBLIC_KEY` exists before calling `init()`
- ✅ Shows user-friendly error message if key is missing
- ✅ Prevents crash when Mono is not configured

### 2. Enhanced Mono Config Validation
- ✅ Validates both `monoCustomerId` and `monoPublicKey` before creating config
- ✅ Shows error screen if Mono is not properly configured
- ✅ Logs warnings for debugging

### 3. Removed Unused Imports
- ✅ Removed `MonoProvider` and `useMonoConnect` from authorization screen (not needed for DirectDebit)

## 🔧 How to Fix

### Step 1: Check Environment Variables

Verify that `EXPO_PUBLIC_MONO_PUBLIC_KEY` is set:

```bash
# Check if it's in your .env file
grep EXPO_PUBLIC_MONO_PUBLIC_KEY .env

# Should show:
# EXPO_PUBLIC_MONO_PUBLIC_KEY=live_pk_... or test_pk_...
```

### Step 2: Verify app.config.js

Check that the key is properly exposed:

```javascript
// app.config.js
extra: {
  EXPO_PUBLIC_MONO_PUBLIC_KEY: process.env.EXPO_PUBLIC_MONO_PUBLIC_KEY || "",
}
```

### Step 3: Restart Development Server

After setting environment variables:

```bash
# Stop the server (Ctrl+C)
# Clear cache and restart
npx expo start --clear
```

### Step 4: Verify Mono Customer ID

The Mono customer ID must be created before linking accounts:

1. Check if customer exists in database:
```sql
SELECT mono_customer_id FROM profiles WHERE id = 'your-user-id';
```

2. If missing, it will be created automatically when you try to link an account

## 🐛 Common Causes

### Cause 1: Missing Public Key
**Symptom**: Error shows immediately when clicking "Link with Mono"

**Fix**:
```bash
# Add to .env file
EXPO_PUBLIC_MONO_PUBLIC_KEY=live_pk_YOUR_KEY_HERE
```

### Cause 2: Empty Public Key
**Symptom**: Config exists but key is empty string

**Fix**: Ensure `.env` file has the key set (not just declared)

### Cause 3: Wrong Key Format
**Symptom**: Key exists but Mono still fails

**Fix**: Verify key format:
- Test: `test_pk_...`
- Live: `live_pk_...`

### Cause 4: Not Restarted After Setting Key
**Symptom**: Key is set but error persists

**Fix**: Restart Expo dev server with `--clear` flag

## 📝 Testing Checklist

- [ ] `EXPO_PUBLIC_MONO_PUBLIC_KEY` is set in `.env`
- [ ] Key is properly exposed in `app.config.js`
- [ ] Development server restarted after setting key
- [ ] Mono customer ID exists (created automatically)
- [ ] No console errors about missing Mono config

## 🔍 Debug Steps

1. **Check Console Logs**:
   - Look for: `❌ EXPO_PUBLIC_MONO_PUBLIC_KEY is missing`
   - Look for: `⚠️ Mono customer ID not found`

2. **Verify Key Format**:
```javascript
// In your app, check:
console.log('Mono Public Key:', process.env.EXPO_PUBLIC_MONO_PUBLIC_KEY);
// Should show: live_pk_... or test_pk_...
```

3. **Test Mono Config**:
```javascript
// In linked-accounts.tsx, check if monoConfig is null
console.log('Mono Config:', monoConfig);
// Should be an object, not null
```

## ✅ Expected Behavior After Fix

1. **Valid Config**: Mono widget opens when clicking "Link with Mono"
2. **Missing Key**: Shows error alert instead of "App not found"
3. **No Customer ID**: Shows error screen with helpful message

## 🚨 If Error Persists

1. **Check Mono Dashboard**:
   - Verify your Mono account is active
   - Check if public key matches dashboard

2. **Verify Package Installation**:
```bash
npm list @mono.co/connect-react-native
# Should show: @mono.co/connect-react-native@^2.1.1
```

3. **Check React Native Linking**:
   - For iOS: May need to run `pod install`
   - For Android: May need to rebuild native code

4. **Contact Mono Support**:
   - If key is correct but still failing
   - Provide error logs and Mono account details

---

**Last Updated**: 2025-01-25
**Status**: ✅ Fixed with validation and error handling


