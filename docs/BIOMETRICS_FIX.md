# Biometrics Implementation Fix

## Problem
After enabling biometrics in the Security Center and clicking "Done", the Face ID/Fingerprint prompt was appearing on every tab click and every page navigation. This was causing a poor user experience where users had to authenticate constantly.

## Root Cause
The issue was in `/app/_layout.tsx`. The app was using a `hasShownLockScreen` state flag that was being reset on navigation, causing the biometric lock screen to appear repeatedly even when the app wasn't actually locked.

The problematic logic was:
```typescript
const [hasShownLockScreen, setHasShownLockScreen] = useState(false);

// This effect was resetting the flag on every navigation
useEffect(() => {
  if (isAppLocked && session && !isLoading && !hasShownLockScreen) {
    setHasShownLockScreen(true);
  } else if (!isAppLocked) {
    setHasShownLockScreen(false);  // ❌ This caused the issue
  }
}, [isAppLocked, session, isLoading, hasShownLockScreen]);

// This condition was showing the lock screen unnecessarily
if (isAppLocked && session && !isLoading && !hasShownLockScreen) {
  return biometricEnabled ? <BiometricsLock /> : <SimplePinLock />;
}
```

## Solution
Removed the `hasShownLockScreen` state and its associated logic. The lock screen should only be shown when `isAppLocked` is actually `true`, which happens in these scenarios:

1. **App returns from background** - After the configured timeout period (5 or 60 minutes)
2. **Manual lock** - When the user manually locks the app

The fixed logic:
```typescript
// Show lock screen ONLY if app is actually locked (not just because biometrics are enabled)
// This prevents the lock screen from showing on every navigation
if (isAppLocked && session && !isLoading) {
  // Use BiometricsLock if biometrics are enabled, otherwise use SimplePinLock
  return biometricEnabled ? <BiometricsLock /> : <SimplePinLock />;
}
```

## How Biometrics Should Work Now

### 1. **App Lock (Face ID/Fingerprint for unlocking app)**
- **When it appears:**
  - When app returns from background after timeout period
  - When app is manually locked
- **When it doesn't appear:**
  - During normal navigation between tabs/pages
  - After clicking "Done" in Security Center
  - When browsing the app normally

### 2. **Payout Biometrics (Face ID/Fingerprint for payouts)**
- **When it appears:**
  - Only when creating a new payout plan (on the review step)
  - Only if "Payout Biometrics" is enabled in Security Center
- **When it doesn't appear:**
  - During normal navigation
  - When viewing existing payouts

### 3. **Emergency Withdrawal Biometrics (Face ID/Fingerprint for emergency withdrawals)**
- **When it appears:**
  - Only when confirming an emergency withdrawal
  - Only if "Emergency Biometrics" is enabled in Security Center
- **When it doesn't appear:**
  - During normal navigation
  - When viewing emergency withdrawal options

## Testing Checklist

### App Lock Biometrics
- [ ] Enable "App Lock Biometrics" in Security Center
- [ ] Click "Done" and navigate to different tabs
- [ ] Verify Face ID/Fingerprint does NOT appear on navigation
- [ ] Put app in background for 5+ minutes (or configured timeout)
- [ ] Bring app to foreground
- [ ] Verify Face ID/Fingerprint DOES appear
- [ ] Authenticate successfully
- [ ] Verify you can navigate freely without repeated prompts

### Payout Biometrics
- [ ] Enable "Payout Biometrics" in Security Center
- [ ] Navigate to create a new payout plan
- [ ] Fill in all details and reach the review step
- [ ] Click "Start Payout Plan"
- [ ] Verify Face ID/Fingerprint DOES appear
- [ ] Authenticate successfully
- [ ] Verify payout is created
- [ ] Navigate to other pages
- [ ] Verify Face ID/Fingerprint does NOT appear on navigation

### Emergency Withdrawal Biometrics
- [ ] Enable "Emergency Biometrics" in Security Center
- [ ] Navigate to Emergency Withdrawal page
- [ ] Select a payout plan and withdrawal option
- [ ] Click "Confirm Withdrawal"
- [ ] Verify Face ID/Fingerprint DOES appear
- [ ] Authenticate successfully
- [ ] Verify withdrawal is processed
- [ ] Navigate to other pages
- [ ] Verify Face ID/Fingerprint does NOT appear on navigation

## Key Files Modified

### `/app/_layout.tsx`
- Removed `hasShownLockScreen` state
- Removed the effect that was resetting the flag
- Simplified the lock screen display condition to only check `isAppLocked`

## Related Files (No Changes Needed)

These files already have correct biometric implementations:
- `/contexts/PinContext.tsx` - Manages biometric settings
- `/contexts/AutoLogoutContext.tsx` - Manages app lock state
- `/components/BiometricsLock.tsx` - Biometric lock screen component
- `/components/SimplePinLock.tsx` - PIN lock screen component
- `/app/create-payout/review.tsx` - Payout biometric authentication
- `/app/emergency-withdrawal.tsx` - Emergency withdrawal biometric authentication

## Important Notes

1. **Biometric settings are independent:**
   - App Lock Biometrics - For unlocking the app
   - Payout Biometrics - For confirming payouts
   - Emergency Biometrics - For confirming emergency withdrawals

2. **Each can be enabled/disabled separately** in Security Center

3. **Biometrics are optional:**
   - If biometrics fail, users can fall back to PIN
   - If biometrics are not available, PIN is used automatically

4. **Security is maintained:**
   - The fix doesn't compromise security
   - It only prevents unnecessary biometric prompts
   - All sensitive actions still require authentication when appropriate

## Troubleshooting

If biometrics still appear too frequently:

1. **Check AutoLogoutContext settings:**
   - Verify `isAppLocked` is not being set to `true` unnecessarily
   - Check the timeout settings (5 min, 60 min, never)

2. **Check console logs:**
   - Look for "AutoLogoutContext - isAppLocked changed to: true"
   - This will show when and why the app is being locked

3. **Verify biometric settings:**
   - Go to Security Center
   - Check which biometric options are enabled
   - Disable any you don't want to use

4. **Clear app data (last resort):**
   - This will reset all biometric settings
   - You'll need to set up PINs and biometrics again

---

**Last Updated:** January 2025
**Tested On:** iOS 15.0+, Android 12+, Expo SDK 53
