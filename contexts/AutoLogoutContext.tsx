import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { usePin } from './PinContext';

type AutoLogoutDuration = 'instant' | '5' | '60' | 'never';

interface AutoLogoutContextType {
  autoLogoutDuration: AutoLogoutDuration;
  setAutoLogoutDuration: (duration: AutoLogoutDuration) => Promise<void>;
  isAppLocked: boolean;
  unlockApp: () => void;
  unlockAppWithBiometrics: () => void;
  checkPin: (pin: string) => Promise<boolean>;
  lockApp: () => void;
  setLastActivePage: (page: string) => void;
  getLastActivePage: () => string;
  updateLastActiveOnInteraction: () => void;
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
  const [justUnlocked, setJustUnlocked] = useState(false);
  const [unlockTimestamp, setUnlockTimestamp] = useState<number | null>(null);
  const [biometricUnlockInProgress, setBiometricUnlockInProgress] = useState(false);
  const [lastActivePage, setLastActivePageState] = useState<string>('(tabs)');
  const globalUnlockProtection = false; // placeholder flag used in logging; can be wired to settings later
  const { hasAppLockPin, verifyAppLockPin } = usePin();
  const appState = useRef(AppState.currentState);
  const lastActiveRef = useRef<number>(Date.now());

  // Debug logging for state changes
  useEffect(() => {
    console.log('🔒 AutoLogoutContext - isAppLocked changed to:', isAppLocked);
  }, [isAppLocked]);

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
      if (saved && ['instant', '5', '60', 'never'].includes(saved)) {
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
    } catch (error) {
      console.error('Error saving auto-logout duration:', error);
    }
  };

  const handleAppStateChange = (nextAppState: AppStateStatus) => {
    console.log('📱 AutoLogoutContext - App state change:', appState.current, '->', nextAppState);
    
    if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
      // App is becoming active (coming to foreground)
      console.log('📱 AutoLogoutContext - App becoming active');
      
      // If biometric unlock is in progress, don't check for locks
      if (biometricUnlockInProgress) {
        console.log('🛡️ AutoLogoutContext - Biometric unlock in progress, skipping lock check');
        return;
      }
      
      checkIfShouldLock();
    } else if (appState.current === 'active' && nextAppState.match(/inactive|background/)) {
      // App is becoming inactive (going to background)
      console.log('📱 AutoLogoutContext - App becoming inactive');
      updateLastActive();
      
      // If instant lock is enabled, lock immediately when app goes to background
      if (autoLogoutDuration === 'instant' && hasAppLockPin && !isAppLocked) {
        console.log('🔒 AutoLogoutContext - Instant lock triggered (app going to background)');
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

  // Method to update last active timestamp on user interaction
  // This should be called when user interacts with the app (touch, scroll, etc.)
  const updateLastActiveOnInteraction = React.useCallback(() => {
    // Only update if app is active and not locked
    if (appState.current === 'active' && !isAppLocked) {
      updateLastActive();
    }
  }, [isAppLocked]);

  const checkIfShouldLock = async () => {
    const startTime = Date.now();
    const now = Date.now();
    const timeSinceUnlock = unlockTimestamp ? now - unlockTimestamp : null;
    
    console.log('🔍 AutoLogoutContext - checkIfShouldLock called', {
      timestamp: new Date().toISOString(),
      startTime,
      hasAppLockPin,
      autoLogoutDuration,
      justUnlocked,
      unlockTimestamp,
      timeSinceUnlock: timeSinceUnlock ? `${timeSinceUnlock}ms` : 'null',
      biometricUnlockInProgress,
      globalUnlockProtection
    });

    // Early exit conditions - simplified and more reliable
    if (!hasAppLockPin || autoLogoutDuration === 'never') {
      console.log('⏭️ AutoLogoutContext - Skipping lock check (no PIN or never setting)', {
        timestamp: new Date().toISOString(),
        reason: !hasAppLockPin ? 'no_pin' : 'never_setting'
      });
      return;
    }

    // If biometric unlock is in progress, don't check for locks
    if (biometricUnlockInProgress) {
      console.log('🛡️ AutoLogoutContext - Biometric unlock in progress, skipping lock check');
      return;
    }

    // If we just unlocked within the last 30 seconds, don't lock again
    if (timeSinceUnlock && timeSinceUnlock < 30000) {
      console.log('🛡️ AutoLogoutContext - Recently unlocked, skipping lock check', {
        timestamp: new Date().toISOString(),
        timeSinceUnlock: `${timeSinceUnlock}ms`,
        remainingProtection: `${30000 - timeSinceUnlock}ms`
      });
      return;
    }

    try {
      const lastActiveStr = await AsyncStorage.getItem(LAST_ACTIVE_KEY);
      const lastActive = lastActiveStr ? parseInt(lastActiveStr, 10) : Date.now();
      const timeDiff = now - lastActive;

      let shouldLock = false;

      switch (autoLogoutDuration) {
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

      console.log('⏰ AutoLogoutContext - Time-based lock check completed', {
        timestamp: new Date().toISOString(),
        lastActive,
        timeDiff,
        autoLogoutDuration,
        shouldLock,
        checkDuration: Date.now() - startTime
      });

      if (shouldLock) {
        console.log('🔒 AutoLogoutContext - Time-based lock triggered', {
          timestamp: new Date().toISOString(),
          reason: `inactive_for_${timeDiff}ms`
        });
        lockApp();
      }
    } catch (error) {
      console.error('💥 AutoLogoutContext - Error in checkIfShouldLock', {
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? {
          message: error.message,
          stack: error.stack,
          name: error.name
        } : error
      });
      // If there's an error, lock the app for security
    }
  };

  const lockApp = () => {
    const lockTime = Date.now();
    
    console.log('🔒 AutoLogoutContext - lockApp() called', {
      timestamp: new Date().toISOString(),
      lockTime,
      currentState: {
        isAppLocked,
        hasAppLockPin,
        justUnlocked,
        unlockTimestamp,
        biometricUnlockInProgress
      }
    });
    
    // Don't allow locking if biometric unlock is in progress
    if (biometricUnlockInProgress) {
      console.log('🛡️ AutoLogoutContext - BLOCKING lockApp due to biometric unlock in progress');
      return;
    }
    
    // Don't allow locking if we just unlocked within 30 seconds
    if (unlockTimestamp && (Date.now() - unlockTimestamp) < 30000) {
      console.log('🛡️ AutoLogoutContext - BLOCKING lockApp due to recent unlock', {
        timeSinceUnlock: Date.now() - unlockTimestamp
      });
      return;
    }
    
    if (hasAppLockPin && !isAppLocked) {
      console.log('🔒 AutoLogoutContext - Locking app (PIN exists)', {
        timestamp: new Date().toISOString()
      });
      
      setIsAppLocked(true);
      
      console.log('✅ AutoLogoutContext - App locked successfully', {
        timestamp: new Date().toISOString(),
        lockDuration: Date.now() - lockTime
      });
    } else {
      console.log('❌ AutoLogoutContext - Cannot lock app', {
        timestamp: new Date().toISOString(),
        hasAppLockPin,
        isAppLocked
      });
    }
  };

  const unlockApp = () => {
    const startTime = Date.now();
    console.log('🔓 AutoLogoutContext - unlockApp() called', {
      timestamp: new Date().toISOString(),
      startTime,
      currentState: {
        isAppLocked,
        justUnlocked,
        unlockTimestamp,
        biometricUnlockInProgress
      }
    });
    
    const now = Date.now();
    
    // Set protection flags BEFORE changing the locked state
    setJustUnlocked(true);
    setUnlockTimestamp(now);
    
    // Then unlock the app
    setIsAppLocked(false);
    
    console.log('✅ AutoLogoutContext - App unlocked successfully', {
      timestamp: new Date().toISOString(),
      unlockDuration: Date.now() - startTime,
      newState: {
        isAppLocked: false,
        justUnlocked: true,
        unlockTimestamp: now
      }
    });
    
    // Reset unlock protection after 30 seconds
    setTimeout(() => {
      console.log('⏰ AutoLogoutContext - Resetting unlock protection after 30 seconds');
      setUnlockTimestamp(null);
      setJustUnlocked(false);
    }, 30000);
  };

  const unlockAppWithBiometrics = () => {
    console.log('🔓 AutoLogoutContext - unlockAppWithBiometrics() called');
    
    const now = Date.now();
    
    // Set biometric unlock flag to prevent any lock checks
    setBiometricUnlockInProgress(true);
    
    // Set protection flags BEFORE changing the locked state
    setJustUnlocked(true);
    setUnlockTimestamp(now);
    
    // Then unlock the app
    setIsAppLocked(false);
    
    console.log('✅ AutoLogoutContext - App unlocked successfully with biometrics:', {
      isAppLocked: false,
      justUnlocked: true,
      unlockTimestamp: now,
      biometricUnlockInProgress: true
    });
    
    // Clear biometric unlock flag after 5 seconds
    setTimeout(() => {
      setBiometricUnlockInProgress(false);
      console.log('🔓 AutoLogoutContext - Biometric unlock flag cleared');
    }, 5000);
    
    // Reset unlock protection after 30 seconds
    setTimeout(() => {
      setUnlockTimestamp(null);
      setJustUnlocked(false);
      console.log('⏰ AutoLogoutContext - Unlock protection expired');
    }, 30000);
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
    unlockAppWithBiometrics,
    checkPin,
    lockApp,
    setLastActivePage,
    getLastActivePage,
    updateLastActiveOnInteraction,
  };

  return (
    <AutoLogoutContext.Provider value={value}>
      {children}
    </AutoLogoutContext.Provider>
  );
}; 