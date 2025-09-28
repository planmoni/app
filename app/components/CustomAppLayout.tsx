import React, { ReactNode, useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { 
  useFonts, 
  PlusJakartaSans_400Regular, 
  PlusJakartaSans_500Medium, 
  PlusJakartaSans_600SemiBold, 
  PlusJakartaSans_700Bold 
} from '@expo-google-fonts/plus-jakarta-sans';
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
    'PlusJakartaSans-Regular': PlusJakartaSans_400Regular,
    'PlusJakartaSans-Medium': PlusJakartaSans_500Medium,
    'PlusJakartaSans-SemiBold': PlusJakartaSans_600SemiBold,
    'PlusJakartaSans-Bold': PlusJakartaSans_700Bold,
  });

  useEffect(() => {
    if (fontError) {
      console.error('Font loading error:', fontError);
    }
  }, [fontError]);

  // Removed the problematic SplashScreen.hideAsync() call since it's not needed
  // The splash screen is handled by the showSplash state

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
    fontFamily: 'PlusJakartaSans-SemiBold',
    marginBottom: 12,
    textAlign: 'center',
  },
  offlineMessage: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans-Regular',
    textAlign: 'center',
    lineHeight: 24,
  },
});