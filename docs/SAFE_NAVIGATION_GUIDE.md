# Safe Navigation Guide

## Problem
When using `router.push('/(tabs)')` or `router.replace('/(tabs)')`, the app was triggering biometric authentication due to app state changes during navigation.

## Solution
We've created a new `useSafeNavigation` hook that prevents app lock checks during navigation.

## How to Use

### 1. Import the Hook
```typescript
import { useSafeNavigation } from '@/hooks/useSafeNavigation';
```

### 2. Use in Your Component
```typescript
export default function YourComponent() {
  const { navigateToHome, replaceWithHome, navigateTo, replaceWith } = useSafeNavigation();
  
  // ... rest of your component
}
```

### 3. Replace Navigation Calls

#### Before (Problematic):
```typescript
// ❌ This triggers biometric authentication
onPress={() => router.push('/(tabs)')}
onPress={() => router.replace('/(tabs)')}
```

#### After (Safe):
```typescript
// ✅ This prevents biometric authentication
onPress={navigateToHome}
onPress={replaceWithHome}
```

## Available Methods

### `navigateToHome()`
- Navigates to `/(tabs)` using `router.push()`
- Prevents app lock checks during navigation
- Use for "Go to Dashboard" or "Done" buttons

### `replaceWithHome()`
- Navigates to `/(tabs)` using `router.replace()`
- Prevents app lock checks during navigation
- Use when you want to replace the current route

### `navigateTo(route: string)`
- Navigates to any route using `router.push()`
- Prevents app lock checks during navigation
- Use for general navigation

### `replaceWith(route: string)`
- Navigates to any route using `router.replace()`
- Prevents app lock checks during navigation
- Use when you want to replace the current route

## Files That Need to Be Updated

The following files currently use `router.push('/(tabs)')` or `router.replace('/(tabs)')` and should be updated:

1. `app/create-payout/review.tsx`
2. `app/create-payout/schedule.tsx`
3. `app/create-payout/amount.tsx`
4. `app/create-payout/destination.tsx`
5. `app/create-payout/rules.tsx`
6. `app/emergency-withdrawal/confirmation.tsx`
7. `app/deposit-flow/success.tsx`
8. `app/pin-setup/index.tsx`
9. `app/login-success.tsx`
10. `app/(auth)/onboarding/success.tsx`
11. `app/(auth)/onboarding/creating-account.tsx`
12. `app/pin-setup/confirm.tsx`
13. `app/pin-setup/success.tsx`
14. `app/kyc-upgrade.tsx`
15. `app/view-payout.tsx`
16. `app/index.tsx`

## Example Migration

### Before:
```typescript
import { useRouter } from 'expo-router';

export default function MyComponent() {
  const router = useRouter();
  
  return (
    <TouchableOpacity onPress={() => router.push('/(tabs)')}>
      <Text>Go to Dashboard</Text>
    </TouchableOpacity>
  );
}
```

### After:
```typescript
import { useSafeNavigation } from '@/hooks/useSafeNavigation';

export default function MyComponent() {
  const { navigateToHome } = useSafeNavigation();
  
  return (
    <TouchableOpacity onPress={navigateToHome}>
      <Text>Go to Dashboard</Text>
    </TouchableOpacity>
  );
}
```

## How It Works

1. **Navigation Flag**: When you call a safe navigation method, it sets a flag in AsyncStorage indicating navigation is in progress
2. **AppLock Protection**: The AppLockContext checks this flag and skips lock checks during navigation
3. **Automatic Cleanup**: The flag is automatically removed after 1 second
4. **Extended Protection**: The AppLockContext provides a 2-second protection window to prevent race conditions

## Benefits

- ✅ **No more biometric prompts** during navigation to home screen
- ✅ **Smooth navigation** without app state change interference
- ✅ **Backward compatible** - existing navigation still works
- ✅ **Automatic cleanup** - no manual flag management needed
- ✅ **Extensible** - can be used for any route, not just home

## Testing

After implementing the safe navigation:

1. Navigate to any screen that has a "Go to Dashboard" button
2. Press the button
3. Verify that no biometric authentication prompt appears
4. Verify that navigation to the home screen works correctly
5. Test with both PIN and biometric settings enabled/disabled

## Notes

- The safe navigation methods are designed to be drop-in replacements for `router.push('/(tabs)')` and `router.replace('/(tabs)')`
- They work with all existing navigation patterns
- The protection mechanism is automatic and requires no additional configuration
- The hook can be used in any component that needs to navigate to the home screen
