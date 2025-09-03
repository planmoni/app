import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { usePin } from './PinContext';

type AutoLogoutDuration = '0' | '5' | '60' | 'never';

interface AutoLogoutContextType {
  autoLogoutDuration: AutoLogoutDuration;
  setAutoLogoutDuration: (duration: AutoLogoutDuration) => Promise<void>;
  isAppLocked: boolean;
  unlockApp: () => void;
  checkPin: (pin: string) => Promise<boolean>;
  lockApp: () => void;
  setLastActivePage: (page: string) => void;
  getLastActivePage: () => string;
}

const AutoLogoutContext = createContext<AutoLogoutContextType | undefined>(undefined);

const AUTO_LOGOUT_KEY = 'auto_logout_duration';
const LAST_ACTIVE_KEY = 'last_active_timestamp';
const LAST_ACTIVE_PAGE_KEY = 'last_active_page';

export const useAutoLogout = () => {
  const context = useContext(AutoLogoutContext);
  if (!context) {
    throw new Error('useAutoLogout must be used within an AutoLogoutProvider');
  }
  return context;
};

export const AutoLogoutProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [autoLogoutDuration, setAutoLogoutDurationState] = useState<AutoLogoutDuration>('5');
  const [isAppLocked, setIsAppLocked] = useState(false);
  const [lastActivePage, setLastActivePageState] = useState<string>('(tabs)');
  const [justUnlocked, setJustUnlocked] = useState(false);
  const [unlockTimestamp, setUnlockTimestamp] = useState<number | null>(null);
  const { hasAppLockPin, verifyAppLockPin } = usePin();
  const appState = useRef(AppState.currentState);
  const lastActiveRef = useRef<number>(Date.now());

  // Debug logging for state changes
  useEffect(() => {
    console.log('AutoLogoutContext - isAppLocked state changed to:', isAppLocked);
  }, [isAppLocked]);

  // Debug logging for PinContext values
  useEffect(() => {
    console.log('AutoLogoutContext - PinContext values:', {
      hasAppLockPin,
      timestamp: new Date().toISOString()
    });
  }, [hasAppLockPin]);

  // Load saved auto-logout duration and last active page on mount
  useEffect(() => {
    loadAutoLogoutDuration();
    loadLastActivePage();
  }, []);

  // Handle app state changes
  useEffect(() => {
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, [autoLogoutDuration, hasAppLockPin]);

  // Check if app should be locked when it becomes active
  useEffect(() => {
    if (AppState.currentState === 'active') {
      checkIfShouldLock();
    }
  }, [autoLogoutDuration, isAppLocked]);

  const loadAutoLogoutDuration = async () => {
    try {
      const saved = await AsyncStorage.getItem(AUTO_LOGOUT_KEY);
      if (saved && ['0', '5', '60', 'never'].includes(saved)) {
        setAutoLogoutDurationState(saved as AutoLogoutDuration);
      }
    } catch (error) {
      console.error('Error loading auto-logout duration:', error);
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

  const setAutoLogoutDuration = async (duration: AutoLogoutDuration) => {
    try {
      await AsyncStorage.setItem(AUTO_LOGOUT_KEY, duration);
      setAutoLogoutDurationState(duration);
      
      // If setting to "Immediately", lock the app right away
      if (duration === '0') {
        lockApp();
      }
    } catch (error) {
      console.error('Error saving auto-logout duration:', error);
    }
  };

  const handleAppStateChange = (nextAppState: AppStateStatus) => {
    if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
      // App is becoming active (coming to foreground)
      console.log('AutoLogoutContext - App becoming active');
      checkIfShouldLock();
    } else if (appState.current === 'active' && nextAppState.match(/inactive|background/)) {
      // App is becoming inactive (going to background)
      updateLastActive();
      
      // If auto-logout is set to "Immediately", lock the app right away
      if (autoLogoutDuration === '0' && hasAppLockPin) {
        console.log('App going to background with "Immediately" setting - locking app');
        lockApp();
      }
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
    const now = Date.now();
    const timeSinceUnlock = unlockTimestamp ? now - unlockTimestamp : null;
    
    console.log('AutoLogoutContext - checkIfShouldLock called:', {
      hasAppLockPin,
      autoLogoutDuration,
      justUnlocked,
      unlockTimestamp,
      timeSinceUnlock: timeSinceUnlock ? `${timeSinceUnlock}ms` : 'null',
      timestamp: new Date().toISOString()
    });

    if (!hasAppLockPin || autoLogoutDuration === 'never') {
      console.log('AutoLogoutContext - Skipping lock check (no PIN or never setting)');
      return;
    }

    // If we just unlocked within the last 10 seconds, don't lock again
    if (unlockTimestamp && timeSinceUnlock && timeSinceUnlock < 10000) {
      console.log('AutoLogoutContext - Recently unlocked, skipping lock check');
      console.log('AutoLogoutContext - Protection details:', {
        unlockTimestamp,
        timeSinceUnlock,
        protectionWindow: '10 seconds'
      });
      return;
    }
    
    // Additional check: if justUnlocked is true, don't lock
    if (justUnlocked) {
      console.log('AutoLogoutContext - justUnlocked flag is true, skipping lock check');
      return;
    }

    // For "Immediately" setting, lock when app becomes active
    if (autoLogoutDuration === '0') {
      console.log('AutoLogoutContext - App becoming active with "Immediately" setting - locking app');
      lockApp();
      return;
    }

    try {
      const lastActiveStr = await AsyncStorage.getItem(LAST_ACTIVE_KEY);
      const lastActive = lastActiveStr ? parseInt(lastActiveStr, 10) : Date.now();
      const now = Date.now();
      const timeDiff = now - lastActive;

      let shouldLock = false;

      switch (autoLogoutDuration) {
        case '5': // After 5 minutes
          shouldLock = timeDiff > 5 * 60 * 1000;
          break;
        case '60': // After 60 minutes
          shouldLock = timeDiff > 60 * 60 * 1000;
          break;
        default:
          shouldLock = false;
      }

      if (shouldLock) {
        lockApp();
      }
    } catch (error) {
      console.error('Error checking if should lock:', error);
      // If there's an error, lock the app for security
      // Note: autoLogoutDuration === '0' case is handled above
    }
  };

  const lockApp = () => {
    console.log('AutoLogoutContext - lockApp() called');
    console.log('AutoLogoutContext - hasAppLockPin:', hasAppLockPin);
    console.log('AutoLogoutContext - Current isAppLocked state:', isAppLocked);
    
    if (hasAppLockPin) {
      setIsAppLocked(true);
      console.log('AutoLogoutContext - App locked successfully, isAppLocked set to true');
    } else {
      console.log('AutoLogoutContext - Cannot lock app: no PIN set up');
    }
  };

  const unlockApp = () => {
    console.log('AutoLogoutContext - unlockApp() called');
    console.log('AutoLogoutContext - Current isAppLocked state:', isAppLocked);
    
    const now = Date.now();
    
    // Set protection flags BEFORE changing the locked state
    setJustUnlocked(true);
    setUnlockTimestamp(now);
    
    // Then unlock the app
    setIsAppLocked(false);
    
    console.log('AutoLogoutContext - App unlocked successfully:', {
      isAppLocked: false,
      justUnlocked: true,
      unlockTimestamp: now,
      timestamp: new Date(now).toISOString()
    });
    
    // Verify timestamp was set correctly
    setTimeout(() => {
      console.log('AutoLogoutContext - Verifying unlock timestamp after 100ms:', {
        currentUnlockTimestamp: unlockTimestamp,
        expectedTimestamp: now,
        match: unlockTimestamp === now
      });
    }, 100);
    
    // Reset unlock timestamp after 10 seconds to allow normal locking behavior
    setTimeout(() => {
      setUnlockTimestamp(null);
      setJustUnlocked(false);
      console.log('AutoLogoutContext - Unlock protection expired, normal locking behavior restored');
    }, 10000);
  };

  const checkPin = async (pin: string): Promise<boolean> => {
    try {
      return await verifyAppLockPin(pin);
    } catch (error) {
      console.error('Error verifying PIN:', error);
      return false;
    }
  };

  const setLastActivePage = (page: string) => {
    setLastActivePageState(page);
    // Also save to AsyncStorage for persistence
    AsyncStorage.setItem(LAST_ACTIVE_PAGE_KEY, page).catch(error => {
      console.error('Error saving last active page:', error);
    });
  };

  const getLastActivePage = () => {
    return lastActivePage;
  };

  const value: AutoLogoutContextType = {
    autoLogoutDuration,
    setAutoLogoutDuration,
    isAppLocked,
    unlockApp,
    checkPin,
    lockApp,
    setLastActivePage,
    getLastActivePage,
  };

  return (
    <AutoLogoutContext.Provider value={value}>
      {children}
    </AutoLogoutContext.Provider>
  );
}; 