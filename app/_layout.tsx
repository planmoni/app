import React, { useEffect, useState } from 'react';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { BalanceProvider } from '@/contexts/BalanceContext';
import { ThemeProvider, useTheme } from '@/contexts/ThemeContext';
import { ToastProvider } from '@/contexts/ToastContext';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { useFonts } from 'expo-font';
import { SplashScreen, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, Text, View, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import CustomSplashScreen from '@/components/SplashScreen';

// Prevent the splash screen from auto-hiding
SplashScreen.preventAutoHideAsync().catch(e => console.warn("Failed to prevent splash screen auto-hide:", e));

function RootLayoutNav() {
  const { session, isLoading, error } = useAuth();
  const { isDark } = useTheme();
  const [showSplash, setShowSplash] = useState(true);

  const [fontsLoaded, fontError] = useFonts({
    'Inter-Regular': Inter_400Regular,
    'Inter-Medium': Inter_500Medium,
    'Inter-SemiBold': Inter_600SemiBold,
    'Inter-Bold': Inter_700Bold,
  });

  useEffect(() => {
    if (fontError) {
      console.error('Font loading error:', fontError);
    }
  }, [fontError]);

  useEffect(() => {
    if (fontsLoaded && !isLoading) {
      // Hide the native splash screen
      SplashScreen.hideAsync().catch(e => console.warn("Failed to hide splash screen:", e));
    }
  }, [fontsLoaded, isLoading]);

  // Show error screen if there's a critical error
  if (error && !fontsLoaded) {
    return null; // Keep splash screen while fonts load
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorTitle}>Configuration Error</Text>
        <Text style={styles.errorMessage}>{error}</Text>
        <Text style={styles.errorInstructions}>
          Please check your environment configuration and database setup as described in the README.md file.
        </Text>
      </View>
    );
  }

  if (!fontsLoaded || isLoading) {
    return null; // Keep native splash screen visible
  }

  // Show our custom splash screen
  if (showSplash) {
    return <CustomSplashScreen onFinish={() => setShowSplash(false)} />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
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
    </GestureHandlerRootView>
  );
}

export default function RootLayout() {
  useFrameworkReady();

  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <BalanceProvider>
            <RootLayoutNav />
          </BalanceProvider>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#d32f2f',
    marginBottom: 16,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 16,
    color: '#666',
    marginBottom: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  errorInstructions: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    lineHeight: 20,
  },
});