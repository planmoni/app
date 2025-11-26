import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { usePin } from './PinContext';
import { isNavigationInProgress } from '@/hooks/useSafeNavigation';

type AutoLockDuration = 'instant' | '5' | '60' | 'never';

interface AppLockContextType {
  autoLockDuration: AutoLockDuration;
  setAutoLockDuration: (duration: AutoLockDuration) => Promise<void>;
  isAppLocked: boolean;
  unlockApp: () => void;
  lockApp: () => void;
  setLastActivePage: (page: string) => void;
  getLastActivePage: () => string;
  isPinResetMode: boolean;
  setPinResetMode: (enabled: boolean) => void;
  updateLastActiveOnInteraction: () => void;
}

const AppLockContext = createContext<AppLockContextType | undefined>(undefined);

const AUTO_LOCK_KEY = 'auto_lock_duration';
const LAST_ACTIVE_KEY = 'last_active_timestamp';
const LAST_ACTIVE_PAGE_KEY = 'last_active_page';

export const useAppLock = () => {
  const context = useContext(AppLockContext);
  if (!context) {
    throw new Error('useAppLock must be used within an AppLockProvider');
  }
  return context;
};

export const AppLockProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [autoLockDuration, setAutoLockDurationState] = useState<AutoLockDuration>('5');
  const [isAppLocked, setIsAppLocked] = useState(false);
  const [lastActivePage, setLastActivePageState] = useState<string>('(tabs)');
  const [isPinResetMode, setIsPinResetMode] = useState(false);
  const { hasAppLockPin } = usePin();
  const appState = useRef(AppState.currentState);
  const lastActiveRef = useRef<number>(Date.now());
  const unlockTimestampRef = useRef<number | null>(null);
  const hasCheckedLaunchLockRef = useRef(false);

  // Load saved settings on mount
  useEffect(() => {
    loadAutoLockDuration();
    loadLastActivePage();
  }, []);

  const loadAutoLockDuration = async () => {
    try {
      const saved = await AsyncStorage.getItem(AUTO_LOCK_KEY);
      if (saved && ['instant', '5', '60', 'never'].includes(saved)) {
        setAutoLockDurationState(saved as AutoLockDuration);
      }
    } catch (error) {
      console.error('Error loading auto-lock duration:', error);
    }
  };

  const loadLastActivePage = async () => {
    try {
      const saved = await AsyncStorage.getItem(LAST_ACTIVE_PAGE_KEY);
      if (saved) {
        setLastActivePageState(saved);
      }
    } catch (error) {
      console.error('Error loading last active page:', error);
    }
  };

  const setAutoLockDuration = async (duration: AutoLockDuration) => {
    try {
      await AsyncStorage.setItem(AUTO_LOCK_KEY, duration);
      setAutoLockDurationState(duration);
    } catch (error) {
      console.error('Error saving auto-lock duration:', error);
    }
  };

  // Use refs to store latest values for use in event listener
  const autoLockDurationRef = useRef(autoLockDuration);
  const hasAppLockPinRef = useRef(hasAppLockPin);
  const isAppLockedRef = useRef(isAppLocked);
  
  // Keep refs in sync with state
  useEffect(() => {
    autoLockDurationRef.current = autoLockDuration;
  }, [autoLockDuration]);
  
  useEffect(() => {
    hasAppLockPinRef.current = hasAppLockPin;
  }, [hasAppLockPin]);
  
  useEffect(() => {
    isAppLockedRef.current = isAppLocked;
  }, [isAppLocked]);

  const updateLastActive = async () => {
    try {
      const timestamp = Date.now();
      lastActiveRef.current = timestamp;
      await AsyncStorage.setItem(LAST_ACTIVE_KEY, timestamp.toString());
    } catch (error) {
      console.error('Error updating last active timestamp:', error);
    }
  };

  // Method to update last active timestamp on user interaction
  // This should be called when user interacts with the app (touch, scroll, etc.)
  const updateLastActiveOnInteraction = useCallback(() => {
    // Only update if app is active and not locked
    if (appState.current === 'active' && !isAppLockedRef.current) {
      updateLastActive();
    }
  }, []);

  const lockApp = () => {
    const currentHasAppLockPin = hasAppLockPinRef.current;
    const currentIsAppLocked = isAppLockedRef.current;
    
    console.log('🔒 AppLock - lockApp() called', {
      hasAppLockPin: currentHasAppLockPin,
      isAppLocked: currentIsAppLocked,
      autoLockDuration: autoLockDurationRef.current,
      timestamp: new Date().toISOString()
    });
    
    if (currentHasAppLockPin && !currentIsAppLocked) {
      console.log('🔒 AppLock - Locking app');
      setIsAppLocked(true);
    } else {
      console.log('🔒 AppLock - Cannot lock app', {
        hasAppLockPin: currentHasAppLockPin,
        isAppLocked: currentIsAppLocked,
        reason: !currentHasAppLockPin ? 'no_pin' : 'already_locked'
      });
    }
  };

  const checkIfShouldLock = async () => {
    // Don't lock if no PIN is set or auto-lock is disabled
    if (!hasAppLockPin || autoLockDuration === 'never') {
      console.log('⏭️ AppLock - Skipping lock check (no PIN or never setting)');
      return;
    }

    // Don't lock if we just unlocked recently
    if (unlockTimestampRef.current && (Date.now() - unlockTimestampRef.current) < 30000) {
      console.log('🛡️ AppLock - Recently unlocked, skipping lock check');
      return;
    }

    // Don't lock if already locked
    if (isAppLocked) {
      console.log('🛡️ AppLock - Already locked, skipping lock check');
      return;
    }

    // Don't lock if navigation is in progress (check global flag first for immediate protection)
    const globalNavFlag = isNavigationInProgress();
    console.log('🛡️ AppLock - Checking global navigation flag:', globalNavFlag);
    if (globalNavFlag) {
      console.log('🛡️ AppLock - Global navigation flag active, skipping lock check');
      return;
    }

    // Also check AsyncStorage flag for additional protection (supports token-based JSON and legacy numeric)
    try {
      const navigationInProgress = await AsyncStorage.getItem('navigation_in_progress');
      if (navigationInProgress) {
        let navigationTime: number | null = null;
        let navigationToken: string | null = null;

        // Try parsing JSON { token, ts }
        try {
          const parsed = JSON.parse(navigationInProgress);
          if (parsed && (parsed.ts || parsed.token)) {
            navigationTime = parsed.ts ? parseInt(parsed.ts, 10) : null;
            navigationToken = parsed.token ? String(parsed.token) : null;
          }
        } catch (err) {
          // Not JSON: fall back to legacy numeric timestamp string
          const legacy = parseInt(navigationInProgress, 10);
          if (!Number.isNaN(legacy)) navigationTime = legacy;
        }

        const timeSinceNavigation = navigationTime ? Date.now() - navigationTime : null;
        console.log('🛡️ AppLock - navigation flag found', { navigationToken, navigationTime, timeSinceNavigation });

        if (timeSinceNavigation !== null && timeSinceNavigation < 3500) { // 3.5 seconds protection window
          console.log('🛡️ AppLock - Navigation in progress, skipping lock check', {
            timeSinceNavigation: `${timeSinceNavigation}ms`,
            protectionWindow: '3.5s',
            navigationToken,
          });
          return;
        } else {
          // Clean up expired or malformed navigation flag
          await AsyncStorage.removeItem('navigation_in_progress');
          console.log('🧹 AppLock - Cleaned up expired/malformed navigation flag');
        }
      }
    } catch (error) {
      console.warn('AppLock - Error checking navigation status:', error);
    }

    try {
      const lastActiveStr = await AsyncStorage.getItem(LAST_ACTIVE_KEY);
      const lastActive = lastActiveStr ? parseInt(lastActiveStr, 10) : Date.now();
      const timeDiff = Date.now() - lastActive;

      let shouldLock = false;

      switch (autoLockDuration) {
        case 'instant': // Instant lock - handled when app goes to background
          // This case is handled in handleAppStateChange, so we don't need to check here
          shouldLock = false;
          break;
        case '5': // After 5 minutes
          shouldLock = timeDiff > 5 * 60 * 1000;
          break;
        case '60': // After 60 minutes
          shouldLock = timeDiff > 60 * 60 * 1000;
          break;
        default:
          shouldLock = false;
      }

      console.log('⏰ AppLock - Time check:', {
        timeDiff,
        autoLockDuration,
        shouldLock
      });

      if (shouldLock) {
        console.log('🔒 AppLock - Locking app due to inactivity');
        lockApp();
      }
    } catch (error) {
      console.error('Error in checkIfShouldLock:', error);
    }
  };

  const handleAppStateChange = useCallback((nextAppState: AppStateStatus) => {
    const currentState = appState.current;
    const currentAutoLockDuration = autoLockDurationRef.current;
    const currentHasAppLockPin = hasAppLockPinRef.current;
    const currentIsAppLocked = isAppLockedRef.current;
    
    console.log('📱 AppLock - State change:', currentState, '->', nextAppState, {
      autoLockDuration: currentAutoLockDuration,
      hasAppLockPin: currentHasAppLockPin,
      isAppLocked: currentIsAppLocked
    });
    
    if (currentState.match(/inactive|background/) && nextAppState === 'active') {
      // App is becoming active - update last active time and check if we should lock
      updateLastActive();
      
      // Add a slightly larger delay to prevent race conditions during navigation
      // (gives navigation flags/AsyncStorage a bit more time to settle)
      setTimeout(() => {
        checkIfShouldLock();
      }, 300);
    } else if (currentState === 'active' && nextAppState.match(/inactive|background/)) {
      // App moved from active -> inactive/background
      // Update last active time when app goes to background/inactive
      updateLastActive();
      
      // If instant lock is enabled, lock immediately when app goes to background/inactive
      if (currentAutoLockDuration === 'instant' && currentHasAppLockPin && !currentIsAppLocked) {
        console.log('🔒 AppLock - Instant lock triggered (app going to background/inactive)', {
          from: currentState,
          to: nextAppState,
          autoLockDuration: currentAutoLockDuration,
          hasAppLockPin: currentHasAppLockPin,
          isAppLocked: currentIsAppLocked
        });
        lockApp();
      } else {
        console.log('🔒 AppLock - Instant lock NOT triggered', {
          from: currentState,
          to: nextAppState,
          autoLockDuration: currentAutoLockDuration,
          hasAppLockPin: currentHasAppLockPin,
          isAppLocked: currentIsAppLocked,
          reason: currentAutoLockDuration !== 'instant' ? 'not_instant' :
                 !currentHasAppLockPin ? 'no_pin' :
                 currentIsAppLocked ? 'already_locked' : 'unknown'
        });
      }
    }
    
    appState.current = nextAppState;
  }, []);

  // Handle app state changes
  useEffect(() => {
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, [handleAppStateChange]);

  // Always lock app on launch if PIN is set - no checks, just lock if PIN exists
  useEffect(() => {
    // Only check once on app launch
    if (hasCheckedLaunchLockRef.current) {
      return;
    }

    // Wait a moment for PIN status to be loaded, then lock immediately if PIN exists
    const checkLaunchLock = setTimeout(() => {
      const currentHasAppLockPin = hasAppLockPinRef.current;
      const currentIsAppLocked = isAppLockedRef.current;

      console.log('🚀 AppLock - Checking launch lock', {
        hasAppLockPin: currentHasAppLockPin,
        isAppLocked: currentIsAppLocked,
      });

      // ALWAYS lock on launch if PIN is set - no other conditions
      if (currentHasAppLockPin && !currentIsAppLocked) {
        console.log('🔒 AppLock - Locking app on launch (PIN is set)');
        lockApp();
      }
      
      // Mark as checked regardless of outcome
      hasCheckedLaunchLockRef.current = true;
    }, 100); // Small delay to ensure PIN context has loaded

    return () => clearTimeout(checkLaunchLock);
  }, [hasAppLockPin]);

  // Periodic check for 5 mins and 60 mins auto-lock while app is active
  useEffect(() => {
    // Only set up periodic check if auto-lock is set to 5 or 60 minutes
    if (autoLockDuration !== '5' && autoLockDuration !== '60') {
      return;
    }

    // Only check if app is active and has PIN set
    if (!hasAppLockPin || isAppLocked || appState.current !== 'active') {
      return;
    }

    // Check every 30 seconds if we should lock
    const interval = setInterval(() => {
      // Only check if app is still active
      if (appState.current === 'active' && !isAppLockedRef.current) {
        checkIfShouldLock();
      }
    }, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, [autoLockDuration, hasAppLockPin, isAppLocked]);

  const unlockApp = () => {
    console.log('🔓 AppLock - Unlocking app');
    setIsAppLocked(false);
    unlockTimestampRef.current = Date.now();
    
    // Clear the unlock timestamp after 30 seconds
    setTimeout(() => {
      unlockTimestampRef.current = null;
    }, 30000);
  };

  const setLastActivePage = (page: string) => {
    setLastActivePageState(page);
    AsyncStorage.setItem(LAST_ACTIVE_PAGE_KEY, page).catch(error => {
      console.error('Error saving last active page:', error);
    });
  };

  const getLastActivePage = () => {
    return lastActivePage;
  };

  const setPinResetMode = (enabled: boolean) => {
    setIsPinResetMode(enabled);
  };

  const value: AppLockContextType = {
    autoLockDuration,
    setAutoLockDuration,
    isAppLocked,
    unlockApp,
    lockApp,
    setLastActivePage,
    getLastActivePage,
    isPinResetMode,
    setPinResetMode,
    updateLastActiveOnInteraction,
  };

  return (
    <AppLockContext.Provider value={value}>
      {children}
    </AppLockContext.Provider>
  );
};
