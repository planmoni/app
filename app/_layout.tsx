import React, { useEffect } from 'react';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { BalanceProvider } from '@/contexts/BalanceContext';
import { ThemeProvider, useTheme } from '@/contexts/ThemeContext';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { useFonts } from 'expo-font';
import { SplashScreen, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';

SplashScreen.preventAutoHideAsync();

function RootLayoutNav() {
  const { session, isLoading } = useAuth();
  const { isDark } = useTheme();

  const [fontsLoaded, fontError] = useFonts({
    'Inter-Regular': Inter_400Regular,
    'Inter-Medium': Inter_500Medium,
    'Inter-SemiBold': Inter_600SemiBold,
    'Inter-Bold': Inter_700Bold,
  });

  useEffect(() => {
    if (fontError) throw fontError;
  }, [fontError]);

  useEffect(() => {
    if (fontsLoaded && !isLoading) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, isLoading]);

  if (!fontsLoaded || isLoading) {
    return null;
  }

  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        {session ? (
          <React.Fragment key="authenticated-screens">
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="profile" options={{ headerShown: false }} />
            <Stack.Screen name="add-funds" options={{ headerShown: false }} />
            <Stack.Screen name="all-payouts" options={{ headerShown: false }} />
            <Stack.Screen name="change-password" options={{ headerShown: false }} />
            <Stack.Screen name="create-payout" options={{ headerShown: false }} />
            <Stack.Screen name="deposit-flow" options={{ headerShown: false }} />
            <Stack.Screen name="linked-accounts" options={{ headerShown: false }} />
            <Stack.Screen name="pause-confirmation" options={{ headerShown: false }} />
            <Stack.Screen name="referral" options={{ headerShown: false }} />
            <Stack.Screen name="transaction-limits" options={{ headerShown: false }} />
            <Stack.Screen name="transactions" options={{ headerShown: false }} />
            <Stack.Screen name="two-factor-auth" options={{ headerShown: false }} />
            <Stack.Screen name="view-payout" options={{ headerShown: false }} />
            <Stack.Screen name="app-lock-setup" options={{ headerShown: false }} />
          </React.Fragment>
        ) : (
          <React.Fragment key="unauthenticated-screens">
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="(auth)" options={{ headerShown: false }} />
            <Stack.Screen name="login" options={{ headerShown: false }} />
          </React.Fragment>
        )}
        <Stack.Screen name="+not-found" options={{ title: 'Page Not Found' }} />
      </Stack>
      <StatusBar style={isDark ? 'light' : 'dark'} />
    </>
  );
}

export default function RootLayout() {
  useFrameworkReady();

  return (
    <ThemeProvider>
      <AuthProvider>
        <BalanceProvider>
          <RootLayoutNav />
        </BalanceProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}