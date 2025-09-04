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
        console.log('🔒 AutoLogoutContext - Setting auto-logout to "Immediately", checking if should lock', {
          timestamp: new Date().toISOString(),
          currentState: {
            isAppLocked,
            justUnlocked,
            unlockTimestamp,
            biometricUnlockInProgress
          }
        });
        
        // Don't lock immediately if we just unlocked
        if (justUnlocked || (unlockTimestamp && (Date.now() - unlockTimestamp) < 30000)) {
          console.log('🛡️ AutoLogoutContext - Skipping immediate lock due to recent unlock', {
            timestamp: new Date().toISOString(),
            justUnlocked,
            timeSinceUnlock: unlockTimestamp ? Date.now() - unlockTimestamp : 'N/A'
          });
        } else {
          console.log('🔒 AutoLogoutContext - Locking app immediately due to "Immediately" setting', {
            timestamp: new Date().toISOString()
          });
          lockApp();
        }
      }
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
      
      // If auto-logout is set to "Immediately", lock the app right away
      if (autoLogoutDuration === '0' && hasAppLockPin) {
        // Don't lock if biometric unlock just happened
        if (biometricUnlockInProgress) {
          console.log('🛡️ AutoLogoutContext - Biometric unlock in progress, skipping immediate background lock', {
            timestamp: new Date().toISOString(),
            biometricUnlockInProgress
          });
          return;
        }
        
        // Don't lock if we just unlocked
        if (justUnlocked || justUnlockedRef.current || 
            (unlockTimestamp && (Date.now() - unlockTimestamp) < 30000) ||
            (unlockTimestampRef.current && (Date.now() - unlockTimestampRef.current) < 30000)) {
          console.log('🛡️ AutoLogoutContext - Skipping immediate background lock due to recent unlock', {
            timestamp: new Date().toISOString(),
            justUnlocked,
            justUnlockedRef: justUnlockedRef.current,
            timeSinceUnlock: unlockTimestamp ? Date.now() - unlockTimestamp : 'N/A',
            timeSinceUnlockRef: unlockTimestampRef.current ? Date.now() - unlockTimestampRef.current : 'N/A'
          });
          return;
        }
        
        console.log('🔒 AutoLogoutContext - App going to background with "Immediately" setting - locking app', {
          timestamp: new Date().toISOString(),
          autoLogoutDuration,
          hasAppLockPin
        });
        lockApp();
      }
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

    // For "Immediately" setting, lock when app becomes active
    if (autoLogoutDuration === '0') {
      // Additional protection: don't lock if we just unlocked
      if (justUnlocked || justUnlockedRef.current || 
          (unlockTimestamp && timeSinceUnlock && timeSinceUnlock < 30000) ||
          (unlockTimestampRef.current && (Date.now() - unlockTimestampRef.current) < 30000)) {
        console.log('🛡️ AutoLogoutContext - Skipping "Immediately" lock due to recent unlock', {
          timestamp: new Date().toISOString(),
          justUnlocked,
          justUnlockedRef: justUnlockedRef.current,
          timeSinceUnlock: timeSinceUnlock || 'null',
          timeSinceUnlockRef: unlockTimestampRef.current ? Date.now() - unlockTimestampRef.current : 'N/A',
          protectionWindow: '30 seconds'
        });
        return;
      }
      
      console.log('🔒 AutoLogoutContext - App becoming active with "Immediately" setting - locking app', {
        timestamp: new Date().toISOString(),
        autoLogoutDuration
      });
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
      // Note: autoLogoutDuration === '0' case is handled above
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
    const startTime = Date.now();
    console.log('🔓 AutoLogoutContext - unlockApp() called', {
      timestamp: new Date().toISOString(),
      startTime,
      currentState: {
        isAppLocked,
        justUnlocked,
        unlockTimestamp,
        biometricUnlockInProgress,
        globalUnlockProtection
      }
    });
    
    const now = Date.now();
    
    // Set protection flags BEFORE changing the locked state
    console.log('🔒 AutoLogoutContext - Setting protection flags', {
      timestamp: new Date().toISOString(),
      beforeSetJustUnlocked: justUnlocked,
      beforeSetUnlockTimestamp: unlockTimestamp,
      beforeSetGlobalProtection: globalUnlockProtection
    });
    
    // Set both state AND refs synchronously to prevent race conditions
    setJustUnlocked(true);
    setUnlockTimestamp(now);
    setGlobalUnlockProtection(true);
    
    // Also set refs immediately for synchronous access
    justUnlockedRef.current = true;
    unlockTimestampRef.current = now;
    globalUnlockProtectionRef.current = true;
    
    const afterSetGlobalProtection = Date.now();
    console.log('🛡️ AutoLogoutContext - Global unlock protection activated (state + refs)', {
      timestamp: new Date().toISOString(),
      afterSetGlobalProtection,
      timeSinceStart: afterSetGlobalProtection - startTime,
      refsSet: {
        justUnlockedRef: justUnlockedRef.current,
        unlockTimestampRef: unlockTimestampRef.current,
        globalUnlockProtectionRef: globalUnlockProtectionRef.current
      }
    });
    
    // Then unlock the app
    console.log('🔓 AutoLogoutContext - Setting isAppLocked to false', {
      timestamp: new Date().toISOString(),
      beforeSetIsAppLocked: isAppLocked
    });
    
    setIsAppLocked(false);
    const afterSetIsAppLocked = Date.now();
    
    console.log('✅ AutoLogoutContext - App unlocked successfully', {
      timestamp: new Date().toISOString(),
      afterSetIsAppLocked,
      unlockDuration: afterSetIsAppLocked - startTime,
      newState: {
        isAppLocked: false,
        justUnlocked: true,
        globalUnlockProtection: true
      }
    });
    
    // Verify all state changes were applied
    setTimeout(() => {
      const verifyTime = Date.now();
      console.log('🔍 AutoLogoutContext - Verifying state changes after 50ms', {
        timestamp: new Date().toISOString(),
        verifyTime,
        timeSinceUnlock: verifyTime - afterSetIsAppLocked,
        expectedState: {
          isAppLocked: false,
          justUnlocked: true,
          globalUnlockProtection: true
        }
      });
    }, 50);
    
    // Verify timestamp was set correctly
    setTimeout(() => {
      const verifyTime = Date.now();
      console.log('🔍 AutoLogoutContext - Verifying unlock timestamp after 100ms', {
        timestamp: new Date().toISOString(),
        verifyTime,
        currentUnlockTimestamp: unlockTimestamp,
        expectedTimestamp: now,
        match: unlockTimestamp === now,
        timeSinceUnlock: verifyTime - afterSetIsAppLocked
      });
    }, 100);
    
    // Reset unlock timestamp after 30 seconds to allow normal locking behavior
    // This gives the same protection as biometric unlock for consistency
    setTimeout(() => {
      const resetTime = Date.now();
      console.log('⏰ AutoLogoutContext - Resetting unlock protection after 30 seconds', {
        timestamp: new Date().toISOString(),
        resetTime,
        timeSinceUnlock: resetTime - afterSetIsAppLocked,
        beforeReset: {
          unlockTimestamp,
          justUnlocked,
          globalUnlockProtection
        }
      });
      
      setUnlockTimestamp(null);
      setJustUnlocked(false);
      setGlobalUnlockProtection(false);
      
      // Also clear refs when protection expires
      justUnlockedRef.current = false;
      unlockTimestampRef.current = null;
      globalUnlockProtectionRef.current = false;
      
      console.log('✅ AutoLogoutContext - Unlock protection expired after 30 seconds, normal locking behavior restored', {
        timestamp: new Date().toISOString(),
        afterReset: {
          unlockTimestamp: null,
          justUnlocked: false,
          globalUnlockProtection: false,
          refsCleared: {
            justUnlockedRef: justUnlockedRef.current,
            unlockTimestampRef: unlockTimestampRef.current,
            globalUnlockProtectionRef: globalUnlockProtectionRef.current
          }
        }
      });
    }, 30000);
  };

  const unlockAppWithBiometrics = () => {
    console.log('AutoLogoutContext - unlockAppWithBiometrics() called');
    console.log('AutoLogoutContext - Current isAppLocked state:', isAppLocked);
    
    const now = Date.now();
    
    // Set biometric unlock flag to prevent any lock checks
    setBiometricUnlockInProgress(true);
    
    // Set protection flags BEFORE changing the locked state
    setJustUnlocked(true);
    setUnlockTimestamp(now);
    
    // Then unlock the app
    setIsAppLocked(false);
    
    console.log('AutoLogoutContext - App unlocked successfully with biometrics:', {
      isAppLocked: false,
      justUnlocked: true,
      unlockTimestamp: now,
      biometricUnlockInProgress: true,
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
    
    // Clear biometric unlock flag after 5 seconds to allow normal operation
    setTimeout(() => {
      setBiometricUnlockInProgress(false);
      console.log('AutoLogoutContext - Biometric unlock flag cleared after 5 seconds');
    }, 5000);
    
    // Reset unlock timestamp after 30 seconds to allow normal locking behavior
    setTimeout(() => {
      setUnlockTimestamp(null);
      setJustUnlocked(false);
      console.log('AutoLogoutContext - Unlock protection expired after 30 seconds, normal locking behavior restored');
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
  };

  return (
    <AutoLogoutContext.Provider value={value}>
      {children}
    </AutoLogoutContext.Provider>
  );
}; 