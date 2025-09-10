import React, { useState, useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ThemeProvider, useTheme } from '@/contexts/ThemeContext';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { ProfileProvider } from '@/contexts/ProfileContext';
import { AutoLogoutProvider, useAutoLogout } from '@/contexts/AutoLogoutContext';
import { PinProvider } from '@/contexts/PinContext';
import { ToastProvider } from '@/contexts/ToastContext';
import { BalanceProvider } from '@/contexts/BalanceContext';
import { router } from 'expo-router';
import SplashScreen from '@/components/SplashScreen';
import LockScreen from '@/components/LockScreen';
import AppBlur from '@/components/AppBlur';

function ThemedStatusBar() {
  const { isDark } = useTheme();
  return <StatusBar style={isDark ? "light" : "dark"} />;
}

function RootLayoutNav() {
  const { session, isLoading, error } = useAuth();
  const { isAppLocked } = useAutoLogout();
  const [showSplash, setShowSplash] = useState(true);
  const [navigationReady, setNavigationReady] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(false);

  // Initialize app - show splash only on first load
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSplash(false);
      setNavigationReady(true);
      setHasInitialized(true);
    }, 3000); // 3 seconds splash for initial load only

    return () => clearTimeout(timer);
  }, []); // Empty dependency array - runs only once

  // Handle navigation - allow auth flows but prevent splash interference
  useEffect(() => {
    if (!showSplash && navigationReady && !isLoading) {
      // Only auto-navigate on initial load, not during auth flows
      if (hasInitialized && !session) {
        // Small delay to ensure router is ready
        const navigationTimer = setTimeout(() => {
          // Only navigate to welcome page if no session and we just initialized
          router.replace('/');
        }, 100);

        return () => clearTimeout(navigationTimer);
      }
    }
  }, [showSplash, navigationReady, isLoading, session, hasInitialized]);

  // Show splash screen only during initial loading
  if (showSplash || (isLoading && !hasInitialized)) {
    return <SplashScreen />;
  }

  // Show lock screen only if app is locked AND user has a valid session AND not during loading
  if (isAppLocked && session && !isLoading) {
    return <LockScreen />;
  }

  // Show error screen only for critical errors, not auth errors
  if (error && !error.includes('Invalid email or password') && !error.includes('Invalid login credentials')) {
    return (
      <Stack>
        <Stack.Screen name="+not-found" options={{ headerShown: false }} />
      </Stack>
    );
  }

  // Show authenticated screens if user has session
  if (session) {
    return (
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="add-card" />
        <Stack.Screen name="add-funds" />
        <Stack.Screen name="add-ussd" />
        <Stack.Screen name="all-payouts" />
        <Stack.Screen name="bank-selection-demo" />
        <Stack.Screen name="change-password" />
        <Stack.Screen name="create-payout" />
        <Stack.Screen name="deposit-flow" />
        <Stack.Screen name="edit-profile" />
        <Stack.Screen name="email-preferences" />
        <Stack.Screen name="emergency-withdrawal" />
        <Stack.Screen name="forgot-pin" />
        <Stack.Screen name="forgot-pin-confirm" />
        <Stack.Screen name="forgot-pin-new" />
        <Stack.Screen name="forgot-pin-otp" />
        <Stack.Screen name="forgot-pin-success" />
        <Stack.Screen name="help" />
        <Stack.Screen name="kyc-upgrade" />
        <Stack.Screen name="linked-accounts" />
        <Stack.Screen name="logging-out" />
        <Stack.Screen name="login-success" />
        <Stack.Screen name="notifications" />
        <Stack.Screen name="pause-confirmation" />
        <Stack.Screen name="payout-accounts" />
        <Stack.Screen name="pin-setup" />
        <Stack.Screen name="privacy-settings" />
        <Stack.Screen name="profile" />
        <Stack.Screen name="referral" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="transaction-limits" />
        <Stack.Screen name="transactions" />
        <Stack.Screen name="two-factor-auth" />
        <Stack.Screen name="verify-email" />
        <Stack.Screen name="verify-otp" />
        <Stack.Screen name="view-payout" />
        <Stack.Screen name="+not-found" />
      </Stack>
    );
  }

  // Show unauthenticated screens (welcome page and auth pages)
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="+not-found" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <AuthProvider>
          <ProfileProvider>
            <PinProvider>
              <AutoLogoutProvider>
                <ToastProvider>
                  <BalanceProvider>
                    <AppBlur>
                      <RootLayoutNav />
                    </AppBlur>
                  </BalanceProvider>
                </ToastProvider>
              </AutoLogoutProvider>
            </PinProvider>
          </ProfileProvider>
        </AuthProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}