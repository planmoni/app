import React, { useEffect, useState, useRef } from 'react';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { BalanceProvider } from '@/contexts/BalanceContext';
import { BottomNavProvider } from '@/contexts/BottomNavContext';
// import { router } from 'expo-router';
// import SplashScreen from '@/components/SplashScreen';
// import BiometricsLock from '@/components/BiometricsLock';
// import SimplePinLock from '@/components/SimplePinLock'; // Changed from LockScreen
import { ThemeProvider, useTheme } from '@/contexts/ThemeContext';
import { TextSizeProvider } from '@/contexts/TextSizeContext';
import { ToastProvider } from '@/contexts/ToastContext';
import { PinProvider, usePin } from '@/contexts/PinContext';
import { AppLockProvider, useAppLock } from '@/contexts/AppLockContext';
import { AppVersionProvider } from '@/contexts/AppVersionContext';
import UpdateAppModal from '@/components/UpdateAppModal';
import { UserActivityTracker } from '@/hooks/useUserActivityTracking';
import { NotificationProvider } from '@/contexts/NotificationContext';
import { QueryClientProvider } from '@/contexts/QueryClientProvider';
import { PaystackProvider } from 'react-native-paystack-webview';
import Constants from 'expo-constants';


import { usePageTracking } from '@/hooks/usePageTracking';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { useFonts } from 'expo-font';
import { usePayoutNotifications } from '@/hooks/usePayoutNotifications';
import { useTransactionNotifications } from '@/hooks/useTransactionNotifications';
import { SplashScreen, Stack , usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Text, View, StyleSheet, Platform, AppState, AppStateStatus } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { initializeNotifications, setupTokenRefresh } from '@/lib/notifications';
import { initializeMessaging } from '@/lib/firebase';
import * as SystemUI from 'expo-system-ui';
import * as Updates from 'expo-updates';
// Conditionally import NavigationBar to handle cases where native module isn't available
let NavigationBar: any = null;
try {
  NavigationBar = require('expo-navigation-bar');
} catch (e) {
  console.warn('expo-navigation-bar not available:', e);
}
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
  const { isDark, colors } = useTheme();
  const { isAppLocked, isPinResetMode, lockApp } = useAppLock();
  const { isLoading: isPinLoading, hasAppLockPin } = usePin();
  const [showSplash, setShowSplash] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const hasInitializedRef = useRef(false);
  
  // Track previous session state to detect transitions
  const previousSessionRef = useRef<typeof session>(null);
  const [isAuthTransitioning, setIsAuthTransitioning] = useState(false);
  
  // Track app state for update checks
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  
  // Track page changes for redirect after unlock
  usePageTracking();
  
  // Initialize notification hooks for payout and transaction notifications
  usePayoutNotifications();
  useTransactionNotifications();

  // Update Android navigation bar style based on theme
  useEffect(() => {
    if (Platform.OS === 'android') {
      const updateNavigationBar = async () => {
        if (!NavigationBar) {
          return; // Module not available
        }
        try {
          // Set navigation bar background and button style based on theme
          if (isDark) {
            // Dark mode: black background with light buttons
            await NavigationBar.setBackgroundColorAsync('#0E141F');
            await NavigationBar.setButtonStyleAsync('light');
          } else {
            // Light mode: use a darker gray (#64748B) for strong contrast against light backgrounds
            // This ensures the navigation bar is clearly visible with light buttons
            await NavigationBar.setBackgroundColorAsync('#FFFFFF');
            await NavigationBar.setButtonStyleAsync('light');
          }
        } catch (error) {
          // Navigation bar API not available (e.g., on older Android versions)
          console.warn('Failed to update navigation bar:', error);
        }
      };
      
      updateNavigationBar();
    }
  }, [isDark]);

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
      let tokenRefreshCleanup: (() => void) | null = null;
      
      const setupNotifications = async () => {
        try {
          const cleanup = await initializeNotifications(session.user.id);
          
          // Set up periodic token refresh (every 60 minutes)
          tokenRefreshCleanup = setupTokenRefresh(session.user.id, 60);
          
          return () => {
            if (cleanup) cleanup();
            if (tokenRefreshCleanup) tokenRefreshCleanup();
          };
        } catch (error) {
          console.warn('Failed to initialize notifications:', error);
          return null;
        }
      };
      
      setupNotifications().catch(error => {
        console.warn('Failed to setup notifications:', error);
      });
      
      return () => {
        if (tokenRefreshCleanup) tokenRefreshCleanup();
      };
    }
  }, [session?.user?.id]);

  // Handle notifications when app is opened from background/closed state
  useEffect(() => {
    const checkInitialNotification = async () => {
      try {
        const Notifications = await import('expo-notifications');
        const response = await Notifications.getLastNotificationResponseAsync();
        if (response) {
          const data = response.notification.request.content.data;
          
          // Handle Intercom notifications
          if (data?.intercom) {
            console.log('📬 App opened from Intercom notification');
            setTimeout(() => {
              const { intercomInstant } = require('@/lib/IntercomInstant');
              intercomInstant.open().catch((error: any) => {
                console.error('Failed to open Intercom from notification:', error);
              });
            }, 1000);
            return;
          }

          // Handle event/notification navigation
          if (data?.route) {
            console.log('🔔 App opened from notification, navigating to:', data.route);
            setTimeout(() => {
              const { router } = require('expo-router');
              router.push(data.route as any);
            }, 1000);
          } else if (data?.eventType || data?.notificationType) {
            // Navigate based on event/notification type
            const routeMap: Record<string, string> = {
              payout_completed: '/all-payouts',
              payout_scheduled: '/all-payouts',
              disbursement_failed: '/all-payouts',
              deposit_successful: '/(tabs)/',
              deposit_failed: '/(tabs)/',
              transaction_completed: '/transactions',
              transaction_failed: '/transactions',
              security_alert: '/profile',
              login_alert: '/profile',
              suspicious_activity: '/profile',
              payout: '/all-payouts',
              transaction: '/transactions',
              security: '/profile',
            };
            const eventType = (data.eventType || data.notificationType) as string;
            const route = routeMap[eventType] || '/(tabs)/';
            setTimeout(() => {
              const { router } = require('expo-router');
              router.push(route as any);
            }, 1000);
          }
        }
      } catch (error) {
        console.warn('Failed to check initial notification:', error);
      }
    };

    // Check for initial notification after a short delay to ensure app is ready
    const timer = setTimeout(() => {
      checkInitialNotification();
    }, 500);

    return () => clearTimeout(timer);
  }, []);

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

  // Check for and apply OTA updates automatically
  useEffect(() => {
    let isChecking = false;

    const checkForUpdates = async (source: string = 'initial') => {
      // Only check for updates in production builds (not in development)
      if (__DEV__) {
        console.log('🔧 Development mode: Skipping OTA update check');
        return;
      }

      // Prevent concurrent update checks
      if (isChecking) {
        console.log('⏳ Update check already in progress, skipping...');
        return;
      }

      try {
        isChecking = true;
        
        // Check if updates are enabled
        if (!Updates.isEnabled) {
          console.log('ℹ️ OTA updates are not enabled');
          return;
        }

        // Get current update info for debugging
        const currentlyRunningUpdate = Updates.updateId;
        const runtimeVersion = Updates.runtimeVersion;
        
        console.log('🔄 Checking for OTA updates...', {
          source,
          currentlyRunningUpdate,
          runtimeVersion,
          updateUrl: Updates.url || 'N/A'
        });
        
        // Check for available updates
        const update = await Updates.checkForUpdateAsync();
        
        if (update.isAvailable) {
          console.log('✅ Update available!', {
            manifest: update.manifest?.id || 'N/A',
            createdAt: update.manifest?.createdAt || 'N/A',
            runtimeVersion: update.manifest?.runtimeVersion || 'N/A'
          });
          
          // Download the update in the background
          const fetchResult = await Updates.fetchUpdateAsync();
          
          if (fetchResult.isNew) {
            console.log('✅ New update downloaded successfully, reloading app...');
            
            // Reload the app to apply the update
            // Use a small delay to ensure any pending operations complete
            setTimeout(() => {
              Updates.reloadAsync().catch((error) => {
                console.error('❌ Error reloading app with update:', error);
                isChecking = false;
              });
            }, 1000);
          } else {
            console.log('ℹ️ Update downloaded but not new, already have this version');
            isChecking = false;
          }
        } else {
          console.log('✅ App is up to date', {
            currentlyRunningUpdate,
            runtimeVersion
          });
          isChecking = false;
        }
      } catch (error) {
        console.error('❌ Error checking for updates:', error);
        isChecking = false;
        // Don't block app startup if update check fails
      }
    };

    // Check for updates when app comes to foreground
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        // App came to foreground - check for updates
        console.log('📱 App came to foreground, checking for updates...');
        setTimeout(() => {
          checkForUpdates('foreground');
        }, 1000);
      }
      appStateRef.current = nextAppState;
    };

    // Initial check after app initialization
    const timer = setTimeout(() => {
      checkForUpdates('initial');
    }, 2000);

    // Subscribe to app state changes
    const subscription = AppState.addEventListener('change', handleAppStateChange);

    // Periodic check every 30 minutes (as fallback)
    const intervalId = setInterval(() => {
      if (appStateRef.current === 'active') {
        checkForUpdates('periodic');
      }
    }, 30 * 60 * 1000); // 30 minutes

    return () => {
      clearTimeout(timer);
      clearInterval(intervalId);
      subscription?.remove();
    };
  }, []);

  // Track app initialization - keep splash visible until everything is ready
  useEffect(() => {
    // Hide native splash screen when we show our custom splash screen
    // This ensures smooth transition from native to custom splash
    if ((!fontsLoaded && !fontError) || isLoading) {
      // Hide native splash to show our custom one
      SplashScreen.hideAsync().catch((e) =>
        console.warn("Failed to hide native splash screen:", e)
      );
    } else if (fontsLoaded && !isLoading) {
      // Hide native splash when app is ready
      SplashScreen.hideAsync().catch((e) =>
        console.warn("Failed to hide splash screen:", e)
      );
    }
  }, [fontsLoaded, isLoading, fontError]);

  // Initialize app - wait for fonts, auth, and PIN context to be ready, then add a small delay
  useEffect(() => {
    // Only run once on initial load
    if (hasInitializedRef.current) return;

    // Wait for fonts to load (or error), auth to finish loading, and PIN context to be ready
    const fontsReady = fontsLoaded || fontError;
    const authReady = !isLoading;
    const pinReady = !isPinLoading;

    if (fontsReady && authReady && pinReady) {
      // Immediately lock app if PIN is set - do this first so lock screen is ready
      if (hasAppLockPin && session?.user?.id && !isAppLocked) {
        console.log('🔒 RootLayoutNav - Locking app immediately (PIN is set)');
        lockApp();
      }
      
      // Add a delay to ensure everything is settled before hiding splash
      // This prevents the welcome screen from flashing before auth redirects to dashboard
      const timer = setTimeout(() => {
        console.log('✅ App initialization complete - fonts, auth, and PIN context ready');
        setIsInitializing(false);
        hasInitializedRef.current = true;
      }, 800); // 800ms delay to ensure smooth transition and prevent glitching

      return () => clearTimeout(timer);
    }
  }, [fontsLoaded, fontError, isLoading, isPinLoading, hasAppLockPin, session?.user?.id, lockApp, isAppLocked]);

  // Show error screen if there's a critical fatal error during startup
  // Non-fatal errors should not unmount the app; they are handled via the
  // AppErrorContext and displayed as overlays/toasts so the current page
  // remains mounted (e.g. credential validation failures).
  const { appError, clearError } = useAppError();

  // Handle fatal errors - return early without Stack
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

  // Always render Stack to ensure navigation context is available
  // Show splash screen on top during initialization
  const showSplashOverlay = isInitializing || (!fontsLoaded && !fontError) || isLoading || isPinLoading || (showSplash && !session?.user?.id);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Non-fatal app error banner (non-blocking) */}
      {appError && !appError.fatal && (
        <View style={styles.nonFatalBanner}>
          <Text style={styles.nonFatalText}>{appError.message}</Text>
          <Text onPress={() => clearError()} style={styles.nonFatalDismiss}>Dismiss</Text>
        </View>
      )}
      <Stack 
        screenOptions={{ 
          headerShown: false,
          animation: 'default',
        }}
      >
        {/* Tabs are accessible to both authenticated and unauthenticated users */}
        <Stack.Screen 
          name="(tabs)" 
          options={{ 
            headerShown: false, 
            gestureEnabled: false,
          }} 
        />
        
        {/* Declare all screens - Expo Router requires all screens to be declared */}
        <Stack.Screen 
          name="index" 
          options={{ 
            headerShown: false,
            gestureEnabled: true,
          }} 
        />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen 
          name="login-success" 
          options={{ headerShown: false, gestureEnabled: false }} 
        />
        <Stack.Screen 
          name="profile" 
          options={{ headerShown: false, gestureEnabled: false }} 
        />
        <Stack.Screen 
          name="kyc-upgrade" 
          options={{ 
            headerShown: false, 
            gestureEnabled: false,
            animation: 'fade',
          }} 
        />
        <Stack.Screen 
          name="kyc/tier1" 
          options={{ 
            headerShown: false, 
            gestureEnabled: false,
            animation: 'fade',
          }} 
        />
        <Stack.Screen 
          name="kyc/tier2" 
          options={{ 
            headerShown: false, 
            gestureEnabled: false,
            animation: 'fade',
          }} 
        />
        <Stack.Screen 
          name="add-funds" 
          options={{ 
            headerShown: false, 
            gestureEnabled: false,
            animation: 'fade',
          }} 
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
        <Stack.Screen name="+not-found" options={{ title: "Page Not Found" }} />
      </Stack>
      
      {/* Splash screen overlay during initialization */}
      {showSplashOverlay && (
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          <CustomSplashScreen onFinish={showSplash && !session?.user?.id ? () => setShowSplash(false) : undefined} />
        </View>
      )}
      
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

  // Initialize Firebase messaging early to prevent initialization errors
  useEffect(() => {
    const initFirebase = async () => {
      try {
        await initializeMessaging();
        console.log('✅ Firebase messaging initialized');
      } catch (error) {
        console.warn('⚠️ Firebase messaging initialization failed (non-critical):', error);
      }
    };
    
    initFirebase();
  }, []);

  // Initialize expo-system-ui and navigation bar for edge-to-edge display
  useEffect(() => {
    if (Platform.OS === 'android') {
      const initializeSystemUI = async () => {
        try {
          // Set transparent system bars so app colors can extend behind them
          await SystemUI.setBackgroundColorAsync('transparent');
          
          // Set initial navigation bar style (will be updated by theme in RootLayoutNav)
          // Default to light theme initially with darker gray for better visibility
          await NavigationBar.setBackgroundColorAsync('#FFFFFF');
          await NavigationBar.setButtonStyleAsync('light');
        } catch (error) {
          console.warn('Failed to initialize system UI:', error);
        }
      };
      
      initializeSystemUI();
    }
  }, []);

  // Get Paystack public key from environment
  const paystackPublicKey = 
    Constants.expoConfig?.extra?.EXPO_PUBLIC_PAYSTACK_LIVE_PUBLIC_KEY ||
    Constants.expoConfig?.extra?.EXPO_PUBLIC_PAYSTACK_PUBLIC_KEY ||
    process.env.EXPO_PUBLIC_PAYSTACK_LIVE_PUBLIC_KEY ||
    process.env.EXPO_PUBLIC_PAYSTACK_PUBLIC_KEY ||
    'pk_test_placeholder'; // Fallback to prevent provider error

  return (
    <AppErrorProvider>
      <QueryClientProvider>
        <ThemeProvider>
          <TextSizeProvider>
            <ToastProvider>
              <PaystackProvider 
                publicKey={paystackPublicKey}
                defaultChannels={['card', 'bank', 'ussd', 'qr', 'mobile_money', 'bank_transfer']}
              >
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
              </PaystackProvider>
            </ToastProvider>
          </TextSizeProvider>
        </ThemeProvider>
      </QueryClientProvider>
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
