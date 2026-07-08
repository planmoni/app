import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from 'react';
import { AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { usePin } from './PinContext';
import { isNavigationInProgress } from '@/hooks/useSafeNavigation';

let Updates: any = null;
try {
  Updates = require('expo-updates');
} catch {
  // Native module not available yet
}

interface AppLockContextType {
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

const LAST_ACTIVE_KEY = 'last_active_timestamp';
const LAST_ACTIVE_PAGE_KEY = 'last_active_page';
const AUTO_LOCK_DURATION_MS = 3 * 60 * 1000;
const LAST_ACTIVE_FLUSH_MS = 2 * 60 * 1000;

const devLog = (...args: unknown[]) => {
  if (__DEV__) {
    console.log(...args);
  }
};

const devWarn = (...args: unknown[]) => {
  if (__DEV__) {
    console.warn(...args);
  }
};

export const useAppLock = () => {
  const context = useContext(AppLockContext);
  if (!context) {
    throw new Error('useAppLock must be used within an AppLockProvider');
  }
  return context;
};

export const AppLockProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAppLocked, setIsAppLocked] = useState(false);
  const [lastActivePage, setLastActivePageState] = useState<string>('(tabs)');
  const [isPinResetMode, setIsPinResetMode] = useState(false);
  const { hasAppLockPin } = usePin();
  const appState = useRef(AppState.currentState);
  const lastActiveRef = useRef<number>(Date.now());
  const lastPersistedActiveRef = useRef<number>(0);
  const unlockTimestampRef = useRef<number | null>(null);
  const hasCheckedLaunchLockRef = useRef(false);
  const backgroundLockTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backgroundTimestampRef = useRef<number | null>(null);
  const REFRESH_THRESHOLD_MS = 5 * 60 * 1000;

  const hasAppLockPinRef = useRef(hasAppLockPin);
  const isAppLockedRef = useRef(isAppLocked);

  useEffect(() => {
    hasAppLockPinRef.current = hasAppLockPin;
  }, [hasAppLockPin]);

  useEffect(() => {
    isAppLockedRef.current = isAppLocked;
  }, [isAppLocked]);

  useEffect(() => {
    loadLastActivePage();
    loadLastActiveTimestamp();

    return () => {
      if (backgroundLockTimeoutRef.current) {
        clearTimeout(backgroundLockTimeoutRef.current);
        backgroundLockTimeoutRef.current = null;
      }
    };
  }, []);

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

  const loadLastActiveTimestamp = async () => {
    try {
      const saved = await AsyncStorage.getItem(LAST_ACTIVE_KEY);
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (!Number.isNaN(parsed)) {
          lastActiveRef.current = parsed;
          lastPersistedActiveRef.current = parsed;
        }
      }
    } catch (error) {
      if (__DEV__) {
        console.error('AppLock - Error loading last active timestamp:', error);
      }
    }
  };

  const flushLastActive = useCallback(async (force = false) => {
    try {
      const timestamp = lastActiveRef.current;
      if (
        !force &&
        lastPersistedActiveRef.current > 0 &&
        timestamp - lastPersistedActiveRef.current < LAST_ACTIVE_FLUSH_MS
      ) {
        return;
      }

      await AsyncStorage.setItem(LAST_ACTIVE_KEY, timestamp.toString());
      lastPersistedActiveRef.current = timestamp;
      devLog('AppLock - Flushed last active timestamp');
    } catch (error) {
      console.error('AppLock - Error flushing last active timestamp:', error);
    }
  }, []);

  const updateLastActive = useCallback((options?: { flush?: boolean }) => {
    lastActiveRef.current = Date.now();
    if (options?.flush) {
      void flushLastActive(true);
    }
  }, [flushLastActive]);

  const updateLastActiveOnInteraction = useCallback(() => {
    if (appState.current === 'active' && !isAppLockedRef.current) {
      updateLastActive();
    }
  }, [updateLastActive]);

  const lockApp = useCallback(() => {
    const currentHasAppLockPin = hasAppLockPinRef.current;
    const currentIsAppLocked = isAppLockedRef.current;

    if (currentHasAppLockPin && !currentIsAppLocked) {
      devLog('AppLock - Locking app');
      setIsAppLocked(true);
    }
  }, []);

  const checkIfShouldLock = useCallback(async () => {
    const currentHasAppLockPin = hasAppLockPinRef.current;
    const currentIsAppLocked = isAppLockedRef.current;

    if (!currentHasAppLockPin || currentIsAppLocked) {
      return;
    }

    const timeSinceUnlock = unlockTimestampRef.current
      ? Date.now() - unlockTimestampRef.current
      : null;
    if (unlockTimestampRef.current && timeSinceUnlock && timeSinceUnlock < 30000) {
      return;
    }

    if (isNavigationInProgress()) {
      return;
    }

    try {
      const navigationInProgress = await AsyncStorage.getItem('navigation_in_progress');
      if (navigationInProgress) {
        let navigationTime: number | null = null;

        try {
          const parsed = JSON.parse(navigationInProgress);
          if (parsed && (parsed.ts || parsed.token)) {
            navigationTime = parsed.ts ? parseInt(parsed.ts, 10) : null;
          }
        } catch {
          const legacy = parseInt(navigationInProgress, 10);
          if (!Number.isNaN(legacy)) navigationTime = legacy;
        }

        const timeSinceNavigation = navigationTime ? Date.now() - navigationTime : null;
        if (timeSinceNavigation !== null && timeSinceNavigation < 3500) {
          return;
        }

        await AsyncStorage.removeItem('navigation_in_progress');
      }
    } catch (error) {
      devWarn('AppLock - Error checking navigation status:', error);
    }

    try {
      // Prefer in-memory timestamp to avoid AsyncStorage on every check.
      let lastActive = lastActiveRef.current;
      if (!lastActive) {
        const lastActiveStr = await AsyncStorage.getItem(LAST_ACTIVE_KEY);
        lastActive = lastActiveStr ? parseInt(lastActiveStr, 10) : Date.now();
        lastActiveRef.current = lastActive;
      }

      const timeDiff = Date.now() - lastActive;
      if (timeDiff >= AUTO_LOCK_DURATION_MS) {
        lockApp();
      }
    } catch (error) {
      console.error('AppLock - Error in checkIfShouldLock:', error);
    }
  }, [lockApp]);

  const handleAppStateChange = useCallback((nextAppState: AppStateStatus) => {
    const currentState = appState.current;
    const currentHasAppLockPin = hasAppLockPinRef.current;
    const currentIsAppLocked = isAppLockedRef.current;

    if (currentState.match(/inactive|background/) && nextAppState === 'active') {
      if (backgroundLockTimeoutRef.current) {
        clearTimeout(backgroundLockTimeoutRef.current);
        backgroundLockTimeoutRef.current = null;
      }

      if (backgroundTimestampRef.current) {
        const timeInBackground = Date.now() - backgroundTimestampRef.current;

        if (timeInBackground >= REFRESH_THRESHOLD_MS) {
          backgroundTimestampRef.current = null;
          try {
            if (Updates?.reloadAsync) {
              Updates.reloadAsync().catch((error: unknown) => {
                console.error('AppLock - Failed to reload app:', error);
              });
            }
          } catch (error) {
            console.error('AppLock - Error calling Updates.reloadAsync:', error);
          }
          return;
        }

        backgroundTimestampRef.current = null;
      }

      updateLastActive({ flush: true });

      setTimeout(() => {
        if (appState.current === 'active' && !isAppLockedRef.current && hasAppLockPinRef.current) {
          void checkIfShouldLock();
        }
      }, 500);
    } else if (currentState === 'active' && nextAppState.match(/inactive|background/)) {
      backgroundTimestampRef.current = Date.now();
      updateLastActive({ flush: true });

      if (currentHasAppLockPin && !currentIsAppLocked) {
        if (backgroundLockTimeoutRef.current) {
          clearTimeout(backgroundLockTimeoutRef.current);
        }

        backgroundLockTimeoutRef.current = setTimeout(() => {
          const stillInBackground = !!appState.current.match(/inactive|background/);
          const stillHasPin = hasAppLockPinRef.current;
          const stillNotLocked = !isAppLockedRef.current;

          if (stillInBackground && stillHasPin && stillNotLocked) {
            lockApp();
          }

          backgroundLockTimeoutRef.current = null;
        }, AUTO_LOCK_DURATION_MS);
      }
    }

    appState.current = nextAppState;
  }, [checkIfShouldLock, lockApp, updateLastActive]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, [handleAppStateChange]);

  useEffect(() => {
    if (hasCheckedLaunchLockRef.current) {
      return;
    }

    const checkLaunchLock = setTimeout(() => {
      const currentHasAppLockPin = hasAppLockPinRef.current;
      const currentIsAppLocked = isAppLockedRef.current;

      if (currentHasAppLockPin && !currentIsAppLocked) {
        lockApp();
      }

      hasCheckedLaunchLockRef.current = true;
    }, 100);

    return () => clearTimeout(checkLaunchLock);
  }, [hasAppLockPin, lockApp]);

  useEffect(() => {
    if (!hasAppLockPin || isAppLocked || appState.current !== 'active') {
      return;
    }

    let isChecking = false;

    const interval = setInterval(() => {
      if (isChecking) return;
      if (appState.current !== 'active' || isAppLockedRef.current || !hasAppLockPinRef.current) {
        return;
      }

      isChecking = true;
      void checkIfShouldLock().finally(() => {
        isChecking = false;
      });
    }, 30000);

    return () => clearInterval(interval);
  }, [hasAppLockPin, isAppLocked, checkIfShouldLock]);

  const unlockApp = useCallback(() => {
    setIsAppLocked(false);
    unlockTimestampRef.current = Date.now();
    updateLastActive({ flush: true });

    setTimeout(() => {
      unlockTimestampRef.current = null;
    }, 30000);
  }, [updateLastActive]);

  const setLastActivePage = useCallback((page: string) => {
    setLastActivePageState(page);
    AsyncStorage.setItem(LAST_ACTIVE_PAGE_KEY, page).catch((error) => {
      console.error('Error saving last active page:', error);
    });
  }, []);

  const getLastActivePage = useCallback(() => lastActivePage, [lastActivePage]);

  const setPinResetMode = useCallback((enabled: boolean) => {
    setIsPinResetMode(enabled);
  }, []);

  const value = useMemo<AppLockContextType>(
    () => ({
      isAppLocked,
      unlockApp,
      lockApp,
      setLastActivePage,
      getLastActivePage,
      isPinResetMode,
      setPinResetMode,
      updateLastActiveOnInteraction,
    }),
    [
      isAppLocked,
      unlockApp,
      lockApp,
      setLastActivePage,
      getLastActivePage,
      isPinResetMode,
      setPinResetMode,
      updateLastActiveOnInteraction,
    ]
  );

  return (
    <AppLockContext.Provider value={value}>
      {children}
    </AppLockContext.Provider>
  );
};
