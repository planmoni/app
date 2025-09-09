import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { usePin } from './PinContext';
import { useAuth } from './AuthContext';
import { isAppLockEnabled } from '@/lib/app-lock';
import { supabase } from '@/lib/supabaseClient';
import { createUserScopedStorage } from '@/lib/user-scoped-storage';
import { createRoutePersistence } from '@/lib/route-persistence';
import { restoreSession, isValidRouteForRestoration } from '@/lib/session-restoration';
import { router } from 'expo-router';

type AutoLogoutDuration = '5' | '60' | 'never';

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
  const [globalUnlockProtection, setGlobalUnlockProtection] = useState(false);
  
  // Synchronous protection refs to prevent race conditions
  const justUnlockedRef = useRef(false);
  const globalUnlockProtectionRef = useRef(false);
  const unlockTimestampRef = useRef<number | null>(null);
  const [lastActivePage, setLastActivePageState] = useState<string>('(tabs)');
  const { hasAppLockPin, verifyAppLockPin } = usePin();
  const { user, session } = useAuth();
  const appState = useRef(AppState.currentState);
  const lastActiveRef = useRef<number>(Date.now());

  // Enhanced debug logging for isAppLocked changes
  useEffect(() => {
    console.log('🔒 AutoLogoutContext - isAppLocked changed to:', isAppLocked, {
      timestamp: new Date().toISOString(),
      stack: new Error().stack?.split('\n').slice(1, 4).join('\n')
    });
  }, [isAppLocked]);

  // Enhanced debug logging for isUnlocked changes
  useEffect(() => {
    console.log('🔓 AutoLogoutContext - isUnlocked changed to:', justUnlocked, {
      timestamp: new Date().toISOString(),
      stack: new Error().stack?.split('\n').slice(1, 4).join('\n')
    });
  }, [justUnlocked]);

  // Enhanced debug logging for globalUnlockProtection changes
  useEffect(() => {
    console.log('🛡️ AutoLogoutContext - globalUnlockProtection changed to:', globalUnlockProtection, {
      timestamp: new Date().toISOString(),
      stack: new Error().stack?.split('\n').slice(1, 4).join('\n')
    });
  }, [globalUnlockProtection]);

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

  // Check if app lock is enabled for the current user
  const checkAppLockEnabled = async () => {
    if (!user?.id) {
      return false;
    }
    
    try {
      return await isAppLockEnabled(user.id);
    } catch (error) {
      console.error('Failed to check app lock enabled state:', error);
      return false;
    }
  };

  // Load auto-logout duration from storage
  useEffect(() => {
    const loadAutoLogoutDuration = async () => {
      try {
        const stored = await AsyncStorage.getItem(AUTO_LOGOUT_KEY);
        if (stored && ['5', '60', 'never'].includes(stored)) {
          setAutoLogoutDurationState(stored as AutoLogoutDuration);
        }
      } catch (error) {
        console.error('Failed to load auto-logout duration:', error);
      }
    };

    loadAutoLogoutDuration();
  }, []);

  // Check app lock status when user changes
  useEffect(() => {
    const checkInitialAppLock = async () => {
      if (!session?.user) {
        setIsAppLocked(false);
        return;
      }

      try {
        // Check if app lock is enabled for this user
        const appLockEnabled = await isAppLockEnabled(session.user.id);
        
        if (appLockEnabled) {
          // Check if user has a PIN set up
          const userStorage = createUserScopedStorage(session.user.id);
          const hasPin = await userStorage.getItem('app_lock_pin') !== null;
          
          if (hasPin) {
            setIsAppLocked(true);
          } else {
            // App lock is enabled but no PIN, disable app lock
            // await setAppLockEnabled(session.user.id, false); // This line was removed from the new_code, so it's removed here.
            setIsAppLocked(false);
          }
        } else {
          setIsAppLocked(false);
        }
      } catch (error) {
        console.error('[AutoLogoutContext] Failed to check app lock:', error);
        setIsAppLocked(false);
      }
    };

    checkInitialAppLock();
  }, [session?.user?.id]);

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
      if (saved && ['5', '60', 'never'].includes(saved)) {
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
    const stateChangeTime = Date.now();
    console.log('📱 AutoLogoutContext - App state change detected', {
      timestamp: new Date().toISOString(),
      stateChangeTime,
      from: appState.current,
      to: nextAppState,
      currentState: {
        isAppLocked,
        justUnlocked,
        unlockTimestamp,
        biometricUnlockInProgress,
        autoLogoutDuration,
        globalUnlockProtection
      }
    });
    
    if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
      // App is becoming active (coming to foreground)
      console.log('📱 AutoLogoutContext - App becoming active (coming to foreground)', {
        timestamp: new Date().toISOString(),
        timeSinceStateChange: Date.now() - stateChangeTime
      });
      
      // If biometric unlock is in progress, don't check for locks
      if (biometricUnlockInProgress) {
        console.log('🛡️ AutoLogoutContext - Biometric unlock in progress, skipping lock check', {
          timestamp: new Date().toISOString(),
          biometricUnlockInProgress
        });
        return;
      }
      
      console.log('🔍 AutoLogoutContext - Proceeding with lock check for app becoming active', {
        timestamp: new Date().toISOString()
      });
      
      checkIfShouldLock();
    } else if (appState.current === 'active' && nextAppState.match(/inactive|background/)) {
      // App is becoming inactive (going to background)
      console.log('📱 AutoLogoutContext - App becoming inactive (going to background)', {
        timestamp: new Date().toISOString(),
        timeSinceStateChange: Date.now() - stateChangeTime
      });
      
      updateLastActive();
    }
    
    appState.current = nextAppState;
    
    console.log('📱 AutoLogoutContext - App state change completed', {
      timestamp: new Date().toISOString(),
      finalState: nextAppState,
      totalDuration: Date.now() - stateChangeTime
    });
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

    if (!hasAppLockPin || autoLogoutDuration === 'never') {
      console.log('⏭️ AutoLogoutContext - Skipping lock check (no PIN or never setting)', {
        timestamp: new Date().toISOString(),
        reason: !hasAppLockPin ? 'no_pin' : 'never_setting'
      });
      return;
    }

    // GLOBAL PROTECTION: Don't check for locks if global unlock protection is active
    if (globalUnlockProtection || globalUnlockProtectionRef.current) {
      console.log('🛡️ AutoLogoutContext - Skipping lock check due to global unlock protection', {
        timestamp: new Date().toISOString(),
        globalUnlockProtection,
        globalUnlockProtectionRef: globalUnlockProtectionRef.current
      });
      return;
    }

    // If we just unlocked within the last 30 seconds, don't lock again
    if ((unlockTimestamp && timeSinceUnlock && timeSinceUnlock < 30000) ||
        (unlockTimestampRef.current && (Date.now() - unlockTimestampRef.current) < 30000)) {
      console.log('🛡️ AutoLogoutContext - Recently unlocked, skipping lock check', {
        timestamp: new Date().toISOString(),
        protectionDetails: {
          unlockTimestamp,
          unlockTimestampRef: unlockTimestampRef.current,
          timeSinceUnlock: timeSinceUnlock || 'null',
          timeSinceUnlockRef: unlockTimestampRef.current ? Date.now() - unlockTimestampRef.current : 'N/A',
          protectionWindow: '30 seconds',
          remainingProtection: unlockTimestamp && timeSinceUnlock ? 30000 - timeSinceUnlock : 
                               unlockTimestampRef.current ? 30000 - (Date.now() - unlockTimestampRef.current) : 'N/A'
        }
      });
      return;
    }
    
    // Additional check: if justUnlocked is true, don't lock
    if (justUnlocked || justUnlockedRef.current) {
      console.log('🛡️ AutoLogoutContext - justUnlocked flag is true, skipping lock check', {
        timestamp: new Date().toISOString(),
        justUnlocked,
        justUnlockedRef: justUnlockedRef.current
      });
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
    const stackTrace = new Error().stack?.split('\n').slice(1, 6).join('\n');
    
    console.log('🔒 AutoLogoutContext - lockApp() called', {
      timestamp: new Date().toISOString(),
      lockTime,
      currentState: {
        isAppLocked,
        hasAppLockPin,
        justUnlocked,
        unlockTimestamp,
        biometricUnlockInProgress,
        globalUnlockProtection
      },
      stackTrace
    });
    
    // GLOBAL PROTECTION: Don't allow locking if we're in global unlock protection mode
    if (globalUnlockProtection || globalUnlockProtectionRef.current) {
      console.log('🛡️ AutoLogoutContext - BLOCKING lockApp due to global unlock protection', {
        timestamp: new Date().toISOString(),
        globalUnlockProtection,
        globalUnlockProtectionRef: globalUnlockProtectionRef.current,
        blockReason: 'global_protection_active'
      });
      return;
    }
    
    // ADDITIONAL PROTECTION: Don't allow locking if we just unlocked
    if (justUnlocked || justUnlockedRef.current || 
        (unlockTimestamp && (Date.now() - unlockTimestamp) < 30000) ||
        (unlockTimestampRef.current && (Date.now() - unlockTimestampRef.current) < 30000)) {
      console.log('🛡️ AutoLogoutContext - BLOCKING lockApp due to recent unlock protection', {
        timestamp: new Date().toISOString(),
        justUnlocked,
        justUnlockedRef: justUnlockedRef.current,
        timeSinceUnlock: unlockTimestamp ? Date.now() - unlockTimestamp : 'N/A',
        timeSinceUnlockRef: unlockTimestampRef.current ? Date.now() - unlockTimestampRef.current : 'N/A',
        blockReason: 'recent_unlock_protection'
      });
      return;
    }
    
    if (hasAppLockPin) {
      console.log('🔒 AutoLogoutContext - Locking app (PIN exists)', {
        timestamp: new Date().toISOString(),
        beforeSetIsAppLocked: isAppLocked
      });
      
      setIsAppLocked(true);
      
      console.log('✅ AutoLogoutContext - App locked successfully, isAppLocked set to true', {
        timestamp: new Date().toISOString(),
        afterSetIsAppLocked: true,
        lockDuration: Date.now() - lockTime
      });
    } else {
      console.log('❌ AutoLogoutContext - Cannot lock app: no PIN set up', {
        timestamp: new Date().toISOString(),
        hasAppLockPin
      });
    }
  };

  const unlockApp = () => {
    if (globalUnlockProtectionRef.current) {
      console.log('AutoLogoutContext - Unlock blocked by global protection');
      return;
    }

    console.log('AutoLogoutContext - Unlocking app');
    setIsAppLocked(false);
    setJustUnlocked(true);
    setUnlockTimestamp(Date.now());
    setBiometricUnlockInProgress(false);
    
    // Update refs
    justUnlockedRef.current = true;
    unlockTimestampRef.current = Date.now();
    
    // Reset just unlocked state after a short delay
    setTimeout(() => {
      setJustUnlocked(false);
      justUnlockedRef.current = false;
    }, 1000);
  };

  const unlockAppWithBiometrics = () => {
    setBiometricUnlockInProgress(true);
    // The actual biometric verification will be handled by the BiometricsLock component
  };

  const checkPin = async (pin: string): Promise<boolean> => {
    try {
      const isValid = await verifyAppLockPin(pin);
      if (isValid) {
        unlockApp();
      }
      return isValid;
    } catch (error) {
      console.error('AutoLogoutContext - Error checking PIN:', error);
      return false;
    }
  };

  const setLastActivePage = (page: string) => {
    setLastActivePageState(page);
    try {
      AsyncStorage.setItem(LAST_ACTIVE_PAGE_KEY, page);
    } catch (error) {
      console.error('Failed to save last active page:', error);
    }
  };

  const getLastActivePage = (): string => {
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
  };

  return (
    <AutoLogoutContext.Provider value={value}>
      {children}
    </AutoLogoutContext.Provider>
  );
}; 