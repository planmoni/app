import { useCallback, useRef } from 'react';
import { router } from 'expo-router';
import { useAppLock } from '@/contexts/AppLockContext';

// Global navigation token to prevent race conditions
let globalNavigationToken: string | null = null;

/**
 * Custom navigation hook that prevents app lock checks during navigation
 * This solves the issue where router.push('/(tabs)') triggers biometric authentication
 */
export function useSafeNavigation() {
  const { setLastActivePage } = useAppLock();

  /**
   * Navigate to home screen without triggering app state changes
   * This method temporarily disables app lock checks during navigation
   */
  const navigateToHome = useCallback(async () => {
    try {
      console.log('🚀 SafeNavigation - navigateToHome called');
      
  // Set global navigation token immediately to prevent race conditions
  const navToken = `${Date.now()}-${Math.random().toString(36).slice(2,9)}`;
  globalNavigationToken = navToken;
  console.log('🚀 SafeNavigation - Global navigation token set:', navToken);

  // Set a flag to prevent app lock checks during navigation (store token + timestamp)
  const navigationStartTime = Date.now();

  // Import AsyncStorage synchronously to set the flag immediately
  const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;

  // Set the navigation flag as JSON { token, ts }
  await AsyncStorage.setItem('navigation_in_progress', JSON.stringify({ token: navToken, ts: navigationStartTime }));
  console.log('🚀 SafeNavigation - AsyncStorage navigation token set');
      
      console.log('🚀 SafeNavigation - Setting navigation flag, navigating to home');

      // Navigate to home screen
      router.push('/(tabs)');
      console.log('🚀 SafeNavigation - router.push called');

      // Clear the navigation flag after a short delay, but only remove the stored flag
      // if it still matches our token (another navigation may have started).
      setTimeout(async () => {
        try {
          const stored = await AsyncStorage.getItem('navigation_in_progress');
          if (stored) {
            try {
              const parsed = JSON.parse(stored);
              if (parsed?.token === navToken) {
                await AsyncStorage.removeItem('navigation_in_progress');
                console.log('🚀 SafeNavigation - Navigation token cleared from AsyncStorage');
              } else {
                console.log('🚀 SafeNavigation - Stored navigation token differs, not removing');
              }
            } catch (err) {
              // If parse fails, remove the key to avoid stale values
              await AsyncStorage.removeItem('navigation_in_progress');
              console.log('🚀 SafeNavigation - Cleared malformed navigation flag');
            }
          }
        } catch (error) {
          console.warn('SafeNavigation - Error clearing navigation flag:', error);
        } finally {
          // Always clear our in-memory token
          globalNavigationToken = null;
        }
      }, 3500); // Keep navigation protection window in sync with AppLockContext (3.5s)
    } catch (error) {
      console.error('🚀 SafeNavigation - Error in navigateToHome:', error);
      // Reset global flag on error
      globalNavigationToken = null;
    }
  }, []);

  /**
   * Navigate to home screen and replace current route
   */
  const replaceWithHome = useCallback(async () => {
    // Set a token to prevent app lock checks during navigation
    const navToken = `${Date.now()}-${Math.random().toString(36).slice(2,9)}`;
    globalNavigationToken = navToken;
    const navigationStartTime = Date.now();

    const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
    await AsyncStorage.setItem('navigation_in_progress', JSON.stringify({ token: navToken, ts: navigationStartTime }));

    console.log('🚀 SafeNavigation - Setting navigation token, replacing with home');

    // Navigate to home screen and replace current route
    router.replace('/(tabs)');

    // Clear the navigation flag after a short delay (only if token still matches)
    setTimeout(async () => {
      try {
        const stored = await AsyncStorage.getItem('navigation_in_progress');
        if (stored) {
          try {
            const parsed = JSON.parse(stored);
            if (parsed?.token === navToken) {
              await AsyncStorage.removeItem('navigation_in_progress');
              console.log('🚀 SafeNavigation - Navigation token cleared from AsyncStorage');
            } else {
              console.log('🚀 SafeNavigation - Stored navigation token differs, not removing');
            }
          } catch (err) {
            await AsyncStorage.removeItem('navigation_in_progress');
            console.log('🚀 SafeNavigation - Cleared malformed navigation flag');
          }
        }
      } catch (error) {
        console.warn('SafeNavigation - Error clearing navigation flag:', error);
      } finally {
        globalNavigationToken = null;
      }
    }, 3500);
  }, []);

  /**
   * Navigate to any route with protection against app lock checks
   */
  const navigateTo = useCallback((route: string) => {
    // Set a token to prevent app lock checks during navigation
    const navToken = `${Date.now()}-${Math.random().toString(36).slice(2,9)}`;
    globalNavigationToken = navToken;
    const navigationStartTime = Date.now();

    import('@react-native-async-storage/async-storage').then(({ default: AsyncStorage }) => {
      AsyncStorage.setItem('navigation_in_progress', JSON.stringify({ token: navToken, ts: navigationStartTime }));
    });

    // Navigate to the specified route
    router.push(route);

    // Clear the navigation flag after a short delay (only if token still matches)
    setTimeout(() => {
      import('@react-native-async-storage/async-storage').then(async ({ default: AsyncStorage }) => {
        try {
          const stored = await AsyncStorage.getItem('navigation_in_progress');
          if (stored) {
            const parsed = JSON.parse(stored);
            if (parsed?.token === navToken) {
              await AsyncStorage.removeItem('navigation_in_progress');
              console.log('🚀 SafeNavigation - Navigation token cleared from AsyncStorage');
            } else {
              console.log('🚀 SafeNavigation - Stored navigation token differs, not removing');
            }
          }
        } catch (err) {
          console.warn('SafeNavigation - Error clearing navigation flag (navigateTo):', err);
        } finally {
          globalNavigationToken = null;
        }
      });
    }, 3500);
  }, []);

  /**
   * Replace current route with any route, with protection against app lock checks
   */
  const replaceWith = useCallback((route: string) => {
    // Set a token to prevent app lock checks during navigation
    const navToken = `${Date.now()}-${Math.random().toString(36).slice(2,9)}`;
    globalNavigationToken = navToken;
    const navigationStartTime = Date.now();

    import('@react-native-async-storage/async-storage').then(({ default: AsyncStorage }) => {
      AsyncStorage.setItem('navigation_in_progress', JSON.stringify({ token: navToken, ts: navigationStartTime }));
    });

    // Replace current route with the specified route
    router.replace(route);

    // Clear the navigation flag after a short delay (only if token still matches)
    setTimeout(() => {
      import('@react-native-async-storage/async-storage').then(async ({ default: AsyncStorage }) => {
        try {
          const stored = await AsyncStorage.getItem('navigation_in_progress');
          if (stored) {
            const parsed = JSON.parse(stored);
            if (parsed?.token === navToken) {
              await AsyncStorage.removeItem('navigation_in_progress');
              console.log('🚀 SafeNavigation - Navigation token cleared from AsyncStorage');
            } else {
              console.log('🚀 SafeNavigation - Stored navigation token differs, not removing');
            }
          }
        } catch (err) {
          console.warn('SafeNavigation - Error clearing navigation flag (replaceWith):', err);
        } finally {
          globalNavigationToken = null;
        }
      });
    }, 3500);
  }, []);

  return {
    navigateToHome,
    replaceWithHome,
    navigateTo,
    replaceWith,
  };
}

// Export the global flag for AppLockContext to check
export const isNavigationInProgress = () => !!globalNavigationToken;