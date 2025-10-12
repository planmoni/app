import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { usePin } from './PinContext';
import { isNavigationInProgress } from '@/hooks/useSafeNavigation';

type AutoLockDuration = '5' | '60' | 'never';

interface AppLockContextType {
  autoLockDuration: AutoLockDuration;
  setAutoLockDuration: (duration: AutoLockDuration) => Promise<void>;
  isAppLocked: boolean;
  unlockApp: () => void;
  lockApp: () => void;
  setLastActivePage: (page: string) => void;
  getLastActivePage: () => string;
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
  const { hasAppLockPin } = usePin();
  const appState = useRef(AppState.currentState);
  const lastActiveRef = useRef<number>(Date.now());
  const unlockTimestampRef = useRef<number | null>(null);

  // Load saved settings on mount
  useEffect(() => {
    loadAutoLockDuration();
    loadLastActivePage();
  }, []);

  // Handle app state changes
  useEffect(() => {
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, [autoLockDuration, hasAppLockPin]);

  const loadAutoLockDuration = async () => {
    try {
      const saved = await AsyncStorage.getItem(AUTO_LOCK_KEY);
      if (saved && ['5', '60', 'never'].includes(saved)) {
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

  const handleAppStateChange = (nextAppState: AppStateStatus) => {
    console.log('📱 AppLock - State change:', appState.current, '->', nextAppState);
    
    if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
      // App is becoming active - check if we should lock
      // Add a small delay to prevent race conditions during navigation
      setTimeout(() => {
        checkIfShouldLock();
      }, 100);
    } else if (appState.current === 'active' && nextAppState.match(/inactive|background/)) {
      // App is becoming inactive - update last active time
      updateLastActive();
    }
    
    appState.current = nextAppState;
  };

  const updateLastActive = async () => {
    try {
      const timestamp = Date.now();
      lastActiveRef.current = timestamp;
      await AsyncStorage.setItem(LAST_ACTIVE_KEY, timestamp.toString());
    } catch (error) {
      console.error('Error updating last active timestamp:', error);
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

    // Also check AsyncStorage flag for additional protection
    try {
      const navigationInProgress = await AsyncStorage.getItem('navigation_in_progress');
      if (navigationInProgress) {
        const navigationTime = parseInt(navigationInProgress, 10);
        const timeSinceNavigation = Date.now() - navigationTime;
        if (timeSinceNavigation < 3000) { // 3 seconds protection window
          console.log('🛡️ AppLock - Navigation in progress, skipping lock check', {
            timeSinceNavigation: `${timeSinceNavigation}ms`,
            protectionWindow: '3s'
          });
          return;
        } else {
          // Clean up expired navigation flag
          await AsyncStorage.removeItem('navigation_in_progress');
          console.log('🧹 AppLock - Cleaned up expired navigation flag');
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

  const lockApp = () => {
    if (hasAppLockPin && !isAppLocked) {
      console.log('🔒 AppLock - Locking app');
      setIsAppLocked(true);
    } else {
      console.log('🔒 AppLock - Cannot lock app', {
        hasAppLockPin,
        isAppLocked,
        reason: !hasAppLockPin ? 'no_pin' : 'already_locked'
      });
    }
  };

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

  const value: AppLockContextType = {
    autoLockDuration,
    setAutoLockDuration,
    isAppLocked,
    unlockApp,
    lockApp,
    setLastActivePage,
    getLastActivePage,
  };

  return (
    <AppLockContext.Provider value={value}>
      {children}
    </AppLockContext.Provider>
  );
};
