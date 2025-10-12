import { useCallback, useRef } from 'react';
import { router } from 'expo-router';
import { useAppLock } from '@/contexts/AppLockContext';

// Global navigation flag to prevent race conditions
let globalNavigationInProgress = false;

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
      
      // Set global flag immediately to prevent race conditions
      globalNavigationInProgress = true;
      console.log('🚀 SafeNavigation - Global flag set to true');
      
      // Set a flag to prevent app lock checks during navigation
      const navigationStartTime = Date.now();
      
      // Import AsyncStorage synchronously to set the flag immediately
      const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
      
      // Set the navigation flag immediately and synchronously
      await AsyncStorage.setItem('navigation_in_progress', navigationStartTime.toString());
      console.log('🚀 SafeNavigation - AsyncStorage flag set');
      
      console.log('🚀 SafeNavigation - Setting navigation flag, navigating to home');

      // Navigate to home screen
      router.push('/(tabs)');
      console.log('🚀 SafeNavigation - router.push called');

      // Clear the navigation flag after a short delay
      setTimeout(async () => {
        try {
          globalNavigationInProgress = false;
          await AsyncStorage.removeItem('navigation_in_progress');
          console.log('🚀 SafeNavigation - Navigation flag cleared');
        } catch (error) {
          console.warn('SafeNavigation - Error clearing navigation flag:', error);
        }
      }, 1500); // Increased to 1.5 seconds for more protection
    } catch (error) {
      console.error('🚀 SafeNavigation - Error in navigateToHome:', error);
      // Reset global flag on error
      globalNavigationInProgress = false;
    }
  }, []);

  /**
   * Navigate to home screen and replace current route
   */
  const replaceWithHome = useCallback(async () => {
    // Set a flag to prevent app lock checks during navigation
    const navigationStartTime = Date.now();
    
    // Import AsyncStorage synchronously to set the flag immediately
    const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
    
    // Set the navigation flag immediately and synchronously
    await AsyncStorage.setItem('navigation_in_progress', navigationStartTime.toString());
    
    console.log('🚀 SafeNavigation - Setting navigation flag, replacing with home');

    // Navigate to home screen and replace current route
    router.replace('/(tabs)');

    // Clear the navigation flag after a short delay
    setTimeout(async () => {
      try {
        await AsyncStorage.removeItem('navigation_in_progress');
        console.log('🚀 SafeNavigation - Navigation flag cleared');
      } catch (error) {
        console.warn('SafeNavigation - Error clearing navigation flag:', error);
      }
    }, 1500);
  }, []);

  /**
   * Navigate to any route with protection against app lock checks
   */
  const navigateTo = useCallback((route: string) => {
    // Set a flag to prevent app lock checks during navigation
    const navigationStartTime = Date.now();
    
    import('@react-native-async-storage/async-storage').then(({ default: AsyncStorage }) => {
      AsyncStorage.setItem('navigation_in_progress', navigationStartTime.toString());
    });

    // Navigate to the specified route
    router.push(route);

    // Clear the navigation flag after a short delay
    setTimeout(() => {
      import('@react-native-async-storage/async-storage').then(({ default: AsyncStorage }) => {
        AsyncStorage.removeItem('navigation_in_progress');
      });
    }, 1000);
  }, []);

  /**
   * Replace current route with any route, with protection against app lock checks
   */
  const replaceWith = useCallback((route: string) => {
    // Set a flag to prevent app lock checks during navigation
    const navigationStartTime = Date.now();
    
    import('@react-native-async-storage/async-storage').then(({ default: AsyncStorage }) => {
      AsyncStorage.setItem('navigation_in_progress', navigationStartTime.toString());
    });

    // Replace current route with the specified route
    router.replace(route);

    // Clear the navigation flag after a short delay
    setTimeout(() => {
      import('@react-native-async-storage/async-storage').then(({ default: AsyncStorage }) => {
        AsyncStorage.removeItem('navigation_in_progress');
      });
    }, 1000);
  }, []);

  return {
    navigateToHome,
    replaceWithHome,
    navigateTo,
    replaceWith,
  };
}

// Export the global flag for AppLockContext to check
export const isNavigationInProgress = () => globalNavigationInProgress;