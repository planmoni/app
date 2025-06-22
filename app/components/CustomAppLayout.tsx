import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useAppLock } from '@/contexts/AppLockContext';
import { useFonts } from 'expo-font';
import { SplashScreen } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, Text, StyleSheet } from 'react-native';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import CustomSplashScreen from '@/components/SplashScreen';
import LockScreen from '@/components/LockScreen';
import OfflineBanner from '@/components/OfflineBanner';
import { ReactNode } from 'react';
import { initializeAnalytics, logAnalyticsEvent } from '@/lib/firebase';

interface CustomAppLayoutProps {
  children: ReactNode;
}

export default function CustomAppLayout({ children }: CustomAppLayoutProps) {
  const { session, isLoading, error } = useAuth();
  const { isDark } = useTheme();
  const [showSplash, setShowSplash] = useState(true);
  const { isAppLocked, isAppLockEnabled, resetInactivityTimer } = useAppLock();

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
      SplashScreen.hideAsync().catch(e => console.warn("Failed to hide splash screen:", e));
    }
  }, [fontsLoaded, isLoading]);

  useEffect(() => {
    const setupAnalytics = async () => {
      await initializeAnalytics();
      logAnalyticsEvent('app_open');
    };
    setupAnalytics();
  }, []);

  if (error && !fontsLoaded) {
    return null;
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
    return null;
  }

  if (showSplash) {
    return <CustomSplashScreen onFinish={() => setShowSplash(false)} />;
  }

  return (
    <View style={{ flex: 1 }} onTouchStart={() => resetInactivityTimer()}>
      <OfflineBanner />
      {children}
      <StatusBar style={isDark ? 'light' : 'dark'} />
      {isAppLocked && isAppLockEnabled && <LockScreen />}
    </View>
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