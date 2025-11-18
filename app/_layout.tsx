import React, { useEffect, useState, useRef } from 'react';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { BalanceProvider } from '@/contexts/BalanceContext';
import { BottomNavProvider } from '@/contexts/BottomNavContext';
// import { router } from 'expo-router';
// import SplashScreen from '@/components/SplashScreen';
// import BiometricsLock from '@/components/BiometricsLock';
// import SimplePinLock from '@/components/SimplePinLock'; // Changed from LockScreen
import { ThemeProvider, useTheme } from '@/contexts/ThemeContext';
import { ToastProvider } from '@/contexts/ToastContext';
import { PinProvider } from '@/contexts/PinContext';
import { AppLockProvider, useAppLock } from '@/contexts/AppLockContext';
import { AppVersionProvider } from '@/contexts/AppVersionContext';
import UpdateAppModal from '@/components/UpdateAppModal';
import { UserActivityTracker } from '@/hooks/useUserActivityTracking';
import { NotificationProvider } from '@/contexts/NotificationContext';


import { usePageTracking } from '@/hooks/usePageTracking';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { useFonts } from 'expo-font';
import { usePayoutNotifications } from '@/hooks/usePayoutNotifications';
import { useTransactionNotifications } from '@/hooks/useTransactionNotifications';
import { SplashScreen, Stack , usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Text, View, StyleSheet, Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { initializeNotifications } from '@/lib/notifications';
import * as SystemUI from 'expo-system-ui';
// import { intercomInstant } from '@/lib/IntercomInstant';
import { 
  PlusJakartaSans_400Regular, 
  PlusJakartaSans_500Medium, 
  PlusJakartaSans_600SemiBold, 
  PlusJakartaSans_700Bold 
} from '@expo-google-fonts/plus-jakarta-sans';
import CustomSplashScreen from '@/components/SplashScreen';
import AppLockScreen from '@/components/AppLockScreen';
import AppBlur from '@/components/AppBlur';

// import { SessionDebugger } from '@/components/SessionDebugger';
import AppErrorProvider, { useAppError } from '@/contexts/AppErrorContext';

// Prevent the splash screen from auto-hiding
SplashScreen.preventAutoHideAsync().catch((e) =>
  console.warn("Failed to prevent splash screen auto-hide:", e)
);

function RootLayoutNav() {
  const { session, isLoading, error } = useAuth();
  const { isDark } = useTheme();
  const { isAppLocked, isPinResetMode } = useAppLock();
  const [showSplash, setShowSplash] = useState(false);
  
  // Track previous session state to detect transitions
  const previousSessionRef = useRef<typeof session>(null);
  const [isAuthTransitioning, setIsAuthTransitioning] = useState(false);
  
  // Track page changes for redirect after unlock
  usePageTracking();
  
  // Initialize notification hooks for payout and transaction notifications
  usePayoutNotifications();
  useTransactionNotifications();

  // Deterministic navigation-finish clearing: when the pathname changes,
  // clear the stored navigation token so AppLockContext won't falsely skip or lock.
  const pathname = usePathname();
  useEffect(() => {
    // Clear navigation_in_progress when the route actually changed (navigation finished)
    (async () => {
      try {
        const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
        const stored = await AsyncStorage.getItem('navigation_in_progress');
        if (!stored) return;

        // Try parsing token JSON and then remove (we are at the destination)
        try {
          const parsed = JSON.parse(stored);
          if (parsed?.token) {
            await AsyncStorage.removeItem('navigation_in_progress');
            console.log('🚀 RootLayoutNav - Cleared navigation_in_progress after pathname change', pathname);
          }
        } catch (err) {
          // If malformed or legacy numeric, remove it as well
          await AsyncStorage.removeItem('navigation_in_progress');
          console.log('🚀 RootLayoutNav - Cleared legacy/malformed navigation_in_progress after pathname change', pathname);
        }
      } catch (error) {
        console.warn('RootLayoutNav - Error clearing navigation flag on pathname change:', error);
      }
    })();
  }, [pathname]);

  // Handle authentication state transitions
  useEffect(() => {
    // Skip on initial load when we're still loading
    if (isLoading) return;
    
    const previousSession = previousSessionRef.current;
    const currentSession = session;
    
    console.log('🔍 Auth transition check:', {
      previousSession: previousSession ? 'exists' : 'null',
      currentSession: currentSession ? 'exists' : 'null',
      isLoading,
      showSplash,
      isAuthTransitioning
    });
    
    // Detect authentication state changes (login/logout)
    // Check for valid user, not just session existence
    const wasLoggedIn = !!(previousSession?.user?.id);
    const isLoggedIn = !!(currentSession?.user?.id);
    
    // More robust transition detection
    if (previousSession !== null && wasLoggedIn !== isLoggedIn) {
      console.log('🔄 Authentication state transition detected:', {
        from: wasLoggedIn ? 'logged in' : 'logged out',
        to: isLoggedIn ? 'logged in' : 'logged out',
        previousUserId: previousSession?.user?.id,
        currentUserId: currentSession?.user?.id
      });
      
      // Show splash screen during transition immediately (disabled for login transitions)
      // setIsAuthTransitioning(true); // Disabled for login transitions
      // setShowSplash(true); // Disabled for login transitions
      
      // For login transitions, show splash screen a bit longer to ensure smooth transition
      const transitionDuration = isLoggedIn ? 2000 : 1500; // 2 seconds for login, 1.5 for logout
      
      // Hide splash screen after transition duration
      const timer = setTimeout(() => {
        console.log('✅ Auth transition complete, hiding splash screen');
        setIsAuthTransitioning(false);
        setShowSplash(false);
      }, transitionDuration);
      
      return () => clearTimeout(timer);
    }
    
    // Update previous session reference
    previousSessionRef.current = currentSession;
  }, [session, isLoading]);

  // Additional effect to handle the case where splash screen should stay visible during transitions
  useEffect(() => {
    if (isAuthTransitioning && !showSplash) {
      console.log('🔄 Forcing splash screen to stay visible during transition');
      // setShowSplash(true); // Disabled for login transitions
    }
  }, [isAuthTransitioning, showSplash]);

  // Initialize notifications when user is authenticated
  useEffect(() => {
    if (session?.user?.id) {
      try {
        initializeNotifications(session.user.id).then(cleanup => {
          return () => {
            if (cleanup) cleanup();
          };
        }).catch(error => {
          console.warn('Failed to initialize notifications:', error);
        });
      } catch (error) {
        console.error('Error setting up notification initialization:', error);
      }
    }
  }, [session?.user?.id]);

  // Initialize IntercomInstant for instant access
  // useEffect(() => {
  //   intercomInstant.initialize().catch(error => {
  //     console.warn('Failed to initialize IntercomInstant:', error);
  //   });
  // }, []);

  const [fontsLoaded, fontError] = useFonts({
    'PlusJakartaSans-Regular': PlusJakartaSans_400Regular,
    'PlusJakartaSans-Medium': PlusJakartaSans_500Medium,
    'PlusJakartaSans-SemiBold': PlusJakartaSans_600SemiBold,
    'PlusJakartaSans-Bold': PlusJakartaSans_700Bold,
  });

  useEffect(() => {
    if (fontError) {
      console.warn("Font loading error (app will continue with system fonts):", fontError);
      // Don't block app startup if fonts fail to load - use system fonts as fallback
    }
  }, [fontError]);

  useEffect(() => {
    // Hide splash screen even if fonts fail to load (after a short delay)
    if (!isLoading) {
      const timer = setTimeout(() => {
        SplashScreen.hideAsync().catch((e) =>
          console.warn("Failed to hide splash screen:", e)
        );
      }, fontsLoaded ? 0 : 1000); // Wait 1s if fonts didn't load, otherwise hide immediately
      
      return () => clearTimeout(timer);
    }
  }, [fontsLoaded, isLoading]);

  // Show error screen if there's a critical fatal error during startup
  // Non-fatal errors should not unmount the app; they are handled via the
  // AppErrorContext and displayed as overlays/toasts so the current page
  // remains mounted (e.g. credential validation failures).
  const { appError, clearError } = useAppError();

  if (appError && !fontsLoaded && !fontError) {
    // Keep splash screen visible when fonts are not yet loaded (but not if there's a font error)
    return null;
  }

  if (appError?.fatal) {
    // Only render a blocking fatal startup error here
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorMessage}>{appError.message}</Text>
        <Text style={styles.errorInstructions}>
          Please check your environment configuration and database setup as
          described in the README.md file.
        </Text>
      </View>
    );
  }

  // Allow app to continue even if fonts fail to load (use system fonts as fallback)
  if ((!fontsLoaded && !fontError) || isLoading) {
    return null; // Keep native splash screen visible
  }

  // Show our custom splash screen during initial load or auth transitions
  if (showSplash && !session?.user?.id) {
    return <CustomSplashScreen onFinish={() => setShowSplash(false)} />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      {/* Non-fatal app error banner (non-blocking) */}
      {appError && !appError.fatal && (
        <View style={styles.nonFatalBanner}>
          <Text style={styles.nonFatalText}>{appError.message}</Text>
          <Text onPress={() => clearError()} style={styles.nonFatalDismiss}>Dismiss</Text>
        </View>
      )}
      <Stack screenOptions={{ headerShown: false }}>
        {session?.user?.id ? (
          <React.Fragment key="authenticated-screens">
            <Stack.Screen 
              name="login-success" 
              options={{ headerShown: false, gestureEnabled: false }} 
            />
            <Stack.Screen 
              name="(tabs)" 
              options={{ 
                headerShown: false, 
                gestureEnabled: false,
                animationEnabled: false, // Disable animations that might allow gestures
              }} 
            />
            <Stack.Screen 
              name="profile" 
              options={{ headerShown: false, gestureEnabled: false }} 
            />
            <Stack.Screen 
              name="add-funds" 
              options={{ headerShown: false, gestureEnabled: false }} 
            />
            <Stack.Screen 
              name="all-payouts" 
              options={{ headerShown: false, gestureEnabled: false }} 
            />
            <Stack.Screen
              name="change-password"
              options={{ headerShown: false, gestureEnabled: false }}
            />
            <Stack.Screen
              name="create-payout"
              options={{ headerShown: false, gestureEnabled: false }}
            />
            <Stack.Screen
              name="deposit-flow"
              options={{ headerShown: false, gestureEnabled: false }}
            />
            <Stack.Screen
              name="linked-accounts"
              options={{ headerShown: false, gestureEnabled: false }}
            />
            <Stack.Screen
              name="pause-confirmation"
              options={{ headerShown: false, gestureEnabled: false }}
            />
            <Stack.Screen 
              name="referral" 
              options={{ headerShown: false, gestureEnabled: false }} 
            />
            <Stack.Screen 
              name="transaction-limits" 
              options={{ headerShown: false, gestureEnabled: false }} 
            />
            <Stack.Screen 
              name="transactions" 
              options={{ headerShown: false, gestureEnabled: false }} 
            />
            <Stack.Screen 
              name="account-statement" 
              options={{ headerShown: false, gestureEnabled: false }} 
            />
            <Stack.Screen 
              name="two-factor-auth" 
              options={{ headerShown: false, gestureEnabled: false }} 
            />
            <Stack.Screen 
              name="two-factor-setup" 
              options={{ headerShown: false, gestureEnabled: false }} 
            />
            <Stack.Screen 
              name="two-factor-settings" 
              options={{ headerShown: false, gestureEnabled: false }} 
            />
            <Stack.Screen 
              name="view-backup-codes" 
              options={{ headerShown: false, gestureEnabled: false }} 
            />
            <Stack.Screen 
              name="view-payout" 
              options={{ headerShown: false, gestureEnabled: false }} 
            />
            <Stack.Screen 
              name="app-lock-setup" 
              options={{ headerShown: false, gestureEnabled: false }} 
            />
            <Stack.Screen 
              name="logging-out" 
              options={{ headerShown: false, gestureEnabled: false }} 
            />
          </React.Fragment>
        ) : (
          <React.Fragment key="unauthenticated-screens">
            <Stack.Screen 
              name="index" 
              options={{ 
                headerShown: false,
                gestureEnabled: true, // Allow gestures only when not authenticated
              }} 
            />
            <Stack.Screen name="(auth)" options={{ headerShown: false }} />
            <Stack.Screen name="logging-out" options={{ headerShown: false }} />
          </React.Fragment>
        )}
        <Stack.Screen name="+not-found" options={{ title: "Page Not Found" }} />
      </Stack>
      
      {/* Lock Screen Overlay - Renders at root level */}
      {isAppLocked && session?.user?.id && !isPinResetMode && (
        <AppLockScreen />
      )}
      <UpdateAppModal />
      
      <StatusBar style={isDark ? 'light' : 'dark'} />
      {/* <SessionDebugger /> */}
    </GestureHandlerRootView>
  );
}

export default function RootLayout() {
  useFrameworkReady();

  // Initialize expo-system-ui to allow system to control appearance
  useEffect(() => {
    if (Platform.OS !== 'web') {
      SystemUI.setBackgroundColorAsync('system').catch((error) => {
        console.warn('Failed to set system background color:', error);
      });
    }
  }, []);

  return (
    <AppErrorProvider>
      <ThemeProvider>
        <ToastProvider>
          <AuthProvider>
            <AppVersionProvider>
              <PinProvider>
                <AppLockProvider>
                  <NotificationProvider>
                    <BalanceProvider>
                      <BottomNavProvider>
                        <AppBlur>
                          <UserActivityTracker>
                            <RootLayoutNav />
                          </UserActivityTracker>
                        </AppBlur>
                      </BottomNavProvider>
                    </BalanceProvider>
                  </NotificationProvider>
              </AppLockProvider>
            </PinProvider>
          </AppVersionProvider>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  </AppErrorProvider>
  );
}

const styles = StyleSheet.create({
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    backgroundColor: "#f5f5f5",
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#d32f2f",
    marginBottom: 16,
    textAlign: "center",
  },
  errorMessage: {
    fontSize: 16,
    color: "#666",
    marginBottom: 16,
    textAlign: "center",
    lineHeight: 24,
  },
  errorInstructions: {
    fontSize: 14,
    color: "#888",
    textAlign: "center",
    lineHeight: 20,
  },
  nonFatalBanner: {
    position: 'absolute',
    top: 40,
    left: 16,
    right: 16,
    backgroundColor: '#ffecec',
    padding: 12,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 1000,
  },
  nonFatalText: {
    color: '#8a1f1f',
    flex: 1,
    marginRight: 12,
  },
  nonFatalDismiss: {
    color: '#8a1f1f',
    fontWeight: '600',
  },
});
