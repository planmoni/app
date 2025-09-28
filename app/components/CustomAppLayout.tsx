import React, { ReactNode, useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useErrorHandling } from '@/hooks/useErrorHandling';
import { useIsOnline } from '@/hooks/useIsOnline';
import OfflineBanner from '@/components/OfflineBanner';
import SplashScreen from '@/components/SplashScreen';
import { initializeAnalytics, logAnalyticsEvent } from '@/lib/firebase';

interface CustomAppLayoutProps {
  children: ReactNode;
}

export default function CustomAppLayout({ children }: CustomAppLayoutProps) {
  const { session, isLoading, error } = useAuth();
  const { isDark } = useTheme();
  const { isOnline } = useIsOnline();
  const { handleError, clearError, errorState } = useErrorHandling();
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

  // Handle auth errors gracefully
  useEffect(() => {
    if (error) {
      handleError(error, {
        showAlert: false,
        showToast: true,
        logError: true
      });
    } else {
      clearError();
    }
  }, [error, handleError, clearError]);

  if (error && !fontsLoaded) {
    return null;
  }

  // Show offline banner if not online, but don't block the app
  if (!isOnline && !isLoading) {
    return (
      <View style={styles.container}>
        <OfflineBanner />
        <View style={styles.offlineContainer}>
          <Text style={[styles.offlineTitle, { color: isDark ? '#fff' : '#000' }]}>
            No Internet Connection
          </Text>
          <Text style={[styles.offlineMessage, { color: isDark ? '#ccc' : '#666' }]}>
            Please check your internet connection and try again.
          </Text>
        </View>
        <StatusBar style={isDark ? 'light' : 'dark'} />
      </View>
    );
  }

  if (!fontsLoaded || isLoading) {
    return null;
  }

  if (showSplash) {
    return <SplashScreen onFinish={() => setShowSplash(false)} />;
  }

  return (
    <View style={{ flex: 1 }}>
      <OfflineBanner />
      {children}
      <StatusBar style={isDark ? 'light' : 'dark'} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  offlineContainer: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  offlineTitle: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 12,
    textAlign: 'center',
  },
  offlineMessage: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
}); 