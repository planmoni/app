import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
// Conditionally import Updates - may not be available until rebuild
let Updates: any = null;
try {
  Updates = require('expo-updates');
} catch (e) {
  // Native module not available yet
}
import { usePin } from './PinContext';
import { isNavigationInProgress } from '@/hooks/useSafeNavigation';

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
const AUTO_LOCK_DURATION_MS = 3 * 60 * 1000; // Fixed 3 minutes

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
  const unlockTimestampRef = useRef<number | null>(null);
  const hasCheckedLaunchLockRef = useRef(false);
  const backgroundLockTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backgroundTimestampRef = useRef<number | null>(null);
  const REFRESH_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

  // Use refs to store latest values for use in event listener
  const hasAppLockPinRef = useRef(hasAppLockPin);
  const isAppLockedRef = useRef(isAppLocked);
  
  // Keep refs in sync with state
  useEffect(() => {
    hasAppLockPinRef.current = hasAppLockPin;
  }, [hasAppLockPin]);
  
  useEffect(() => {
    isAppLockedRef.current = isAppLocked;
  }, [isAppLocked]);

  // Load saved settings on mount
  useEffect(() => {
    loadLastActivePage();
    
    // Cleanup timeout on unmount
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

  const updateLastActive = async () => {
    try {
      const timestamp = Date.now();
      const previousTimestamp = lastActiveRef.current;
      lastActiveRef.current = timestamp;
      await AsyncStorage.setItem(LAST_ACTIVE_KEY, timestamp.toString());
      console.log('⏰ AppLock - Updated last active timestamp', {
        timestamp: new Date(timestamp).toISOString(),
        previousTimestamp: previousTimestamp ? new Date(previousTimestamp).toISOString() : 'none',
        timeSincePrevious: previousTimestamp ? `${timestamp - previousTimestamp}ms` : 'N/A',
        appState: appState.current
      });
    } catch (error) {
      console.error('🔒 AppLock - Error updating last active timestamp:', error);
    }
  };

  // Method to update last active timestamp on user interaction
  // This should be called when user interacts with the app (touch, scroll, etc.)
  const updateLastActiveOnInteraction = useCallback(() => {
    // Only update if app is active and not locked
    if (appState.current === 'active' && !isAppLockedRef.current) {
      console.log('👆 AppLock - User interaction detected, updating last active timestamp');
      updateLastActive();
    } else {
      console.log('👆 AppLock - User interaction ignored', {
        appState: appState.current,
        isLocked: isAppLockedRef.current,
        reason: appState.current !== 'active' ? 'app_not_active' : 'app_locked'
      });
    }
  }, []);

  const lockApp = () => {
    const currentHasAppLockPin = hasAppLockPinRef.current;
    const currentIsAppLocked = isAppLockedRef.current;
    
    console.log('🔒 AppLock - lockApp() called', {
      hasAppLockPin: currentHasAppLockPin,
      isAppLocked: currentIsAppLocked,
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
    const startTime = Date.now();
    console.log('🔍 AppLock - checkIfShouldLock() called', {
      timestamp: new Date().toISOString(),
      appState: appState.current
    });
    
    // Early exit: Don't lock if no PIN is set
    const currentHasAppLockPin = hasAppLockPinRef.current;
    const currentIsAppLocked = isAppLockedRef.current;
    
    if (!currentHasAppLockPin) {
      console.log('⏭️ AppLock - Skipping lock check (no PIN set)');
      return;
    }

    // Early exit: Don't lock if already locked
    if (currentIsAppLocked) {
      console.log('⏭️ AppLock - Skipping lock check (already locked)');
      return;
    }

    // Early exit: Don't lock if we just unlocked recently
    const timeSinceUnlock = unlockTimestampRef.current ? Date.now() - unlockTimestampRef.current : null;
    if (unlockTimestampRef.current && timeSinceUnlock && timeSinceUnlock < 30000) {
      console.log('⏭️ AppLock - Skipping lock check (recently unlocked)', {
        timeSinceUnlock: `${timeSinceUnlock}ms`,
        remainingProtection: `${30000 - timeSinceUnlock}ms`
      });
      return;
    }

    // Early exit: Don't lock if navigation is in progress (check global flag first for immediate protection)
    const globalNavFlag = isNavigationInProgress();
    if (globalNavFlag) {
      console.log('⏭️ AppLock - Skipping lock check (navigation in progress - global flag)');
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

      // Fixed 3-minute auto lock
      const shouldLock = timeDiff >= AUTO_LOCK_DURATION_MS;

      console.log('⏰ AppLock - Time check completed', {
        lastActive: new Date(lastActive).toISOString(),
        currentTime: new Date().toISOString(),
        timeDiff: `${timeDiff}ms`,
        timeDiffFormatted: `${Math.floor(timeDiff / 1000 / 60)}m ${Math.floor((timeDiff / 1000) % 60)}s`,
        threshold: '3 minutes',
        shouldLock,
        checkDuration: `${Date.now() - startTime}ms`
      });

      if (shouldLock) {
        console.log('🔒 AppLock - Locking app due to inactivity (3 minutes)', {
          timeDiff: `${timeDiff}ms`
        });
        lockApp();
      } else {
        console.log('✅ AppLock - No lock needed (within 3 minute threshold)');
      }
    } catch (error) {
      console.error('🔒 AppLock - Error in checkIfShouldLock:', error);
    }
  };

  const handleAppStateChange = useCallback((nextAppState: AppStateStatus) => {
    const currentState = appState.current;
    const currentHasAppLockPin = hasAppLockPinRef.current;
    const currentIsAppLocked = isAppLockedRef.current;
    
    console.log('📱 AppLock - State change:', currentState, '->', nextAppState, {
      hasAppLockPin: currentHasAppLockPin,
      isAppLocked: currentIsAppLocked
    });
    
    if (currentState.match(/inactive|background/) && nextAppState === 'active') {
      // App is becoming active - cancel any pending background lock timeout
      if (backgroundLockTimeoutRef.current) {
        console.log('🔒 AppLock - Cancelling pending background lock (app returned to foreground)');
        clearTimeout(backgroundLockTimeoutRef.current);
        backgroundLockTimeoutRef.current = null;
      }
      
      // Check if app was in background for more than 5 minutes
      if (backgroundTimestampRef.current) {
        const timeInBackground = Date.now() - backgroundTimestampRef.current;
        console.log('📱 AppLock - App returned from background', {
          timeInBackgroundMs: timeInBackground,
          timeInBackgroundMinutes: (timeInBackground / 1000 / 60).toFixed(2),
          thresholdMinutes: REFRESH_THRESHOLD_MS / 1000 / 60
        });
        
        if (timeInBackground >= REFRESH_THRESHOLD_MS) {
          console.log('🔄 AppLock - App was in background for 5+ minutes, reloading app...');
          backgroundTimestampRef.current = null;
          
          // Reload the app to clear any rendering issues
          try {
            if (Updates && Updates.reloadAsync) {
              Updates.reloadAsync().catch((error: any) => {
              console.error('❌ AppLock - Failed to reload app:', error);
            });
            } else {
              console.warn('⚠️ AppLock - Updates module not available, skipping reload');
            }
          } catch (error) {
            console.error('❌ AppLock - Error calling Updates.reloadAsync:', error);
            console.warn('⚠️ AppLock - App reload not available (likely in development), app will continue normally');
          }
          return; // Exit early since we're reloading
        }
        
        // Reset background timestamp
        backgroundTimestampRef.current = null;
      }
      
      // Update last active time and check if we should lock
      updateLastActive();
      
      // Add a delay to prevent race conditions during navigation
      setTimeout(() => {
        // Only check if app is still active and not locked
        if (appState.current === 'active' && !isAppLockedRef.current && hasAppLockPinRef.current) {
          checkIfShouldLock();
        }
      }, 500);
    } else if (currentState === 'active' && nextAppState.match(/inactive|background/)) {
      // App moved from active -> inactive/background
      // Store timestamp when app goes to background
      backgroundTimestampRef.current = Date.now();
      console.log('📱 AppLock - App going to background', {
        timestamp: new Date(backgroundTimestampRef.current).toISOString()
      });
      
      // Update last active time when app goes to background/inactive
      updateLastActive();
      
      // Schedule lock after 3 minutes of inactivity when app goes to background
      if (currentHasAppLockPin && !currentIsAppLocked) {
        console.log('🔒 AppLock - Scheduling background lock (3 minutes)', {
          from: currentState,
          to: nextAppState
        });
        
        // Clear any existing timeout
        if (backgroundLockTimeoutRef.current) {
          clearTimeout(backgroundLockTimeoutRef.current);
        }
        
        backgroundLockTimeoutRef.current = setTimeout(() => {
          // Double-check conditions before locking (app might have come back to foreground)
          const stillInBackground = appState.current.match(/inactive|background/);
          const stillHasPin = hasAppLockPinRef.current;
          const stillNotLocked = !isAppLockedRef.current;
          
          console.log('🔒 AppLock - Background lock timeout fired, checking conditions', {
            stillInBackground,
            stillHasPin,
            stillNotLocked,
            appState: appState.current,
            timestamp: new Date().toISOString()
          });
          
          if (stillInBackground && stillHasPin && stillNotLocked) {
            console.log('🔒 AppLock - Executing background lock after 3 minutes');
            lockApp();
          } else {
            console.log('🔒 AppLock - Background lock cancelled (app returned to foreground or already locked)', {
              appState: appState.current,
              hasPin: stillHasPin,
              isLocked: !stillNotLocked
            });
          }
          
          backgroundLockTimeoutRef.current = null;
        }, AUTO_LOCK_DURATION_MS);
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

  // Periodic check for 3-minute auto-lock while app is active
  useEffect(() => {
    // Only check if app is active and has PIN set
    if (!hasAppLockPin || isAppLocked || appState.current !== 'active') {
      console.log('🔒 AppLock - Periodic check not started', {
        hasAppLockPin,
        isAppLocked,
        appState: appState.current,
        reason: !hasAppLockPin ? 'no_pin' :
                isAppLocked ? 'already_locked' :
                appState.current !== 'active' ? 'app_not_active' : 'unknown'
      });
      return;
    }

    console.log('🔒 AppLock - Starting periodic lock check (3 minutes)', {
      interval: '30 seconds',
      timestamp: new Date().toISOString()
    });

    // Use a ref to track if a check is in progress to prevent overlapping calls
    let isCheckingRef = { current: false };

    // Check every 30 seconds for 3 minutes of inactivity
    const interval = setInterval(() => {
      // Early exit if already checking or app is not in correct state
      if (isCheckingRef.current) {
        console.log('⏭️ AppLock - Periodic check skipped (check already in progress)');
        return;
      }
      
      // Double-check app state before proceeding
      if (appState.current !== 'active' || isAppLockedRef.current || !hasAppLockPinRef.current) {
        console.log('⏭️ AppLock - Periodic check skipped (state changed)', {
          appState: appState.current,
          isLocked: isAppLockedRef.current,
          hasPin: hasAppLockPinRef.current
        });
        return;
      }

      console.log('⏰ AppLock - Periodic check triggered', {
        timestamp: new Date().toISOString(),
        threshold: '3 minutes'
      });

      // Set checking flag to prevent overlapping calls
      isCheckingRef.current = true;
      
      // Call checkIfShouldLock and clear flag when done
      checkIfShouldLock()
        .finally(() => {
          isCheckingRef.current = false;
        });
    }, 30000); // Check every 30 seconds

    return () => {
      console.log('🔒 AppLock - Stopping periodic lock check', {
        timestamp: new Date().toISOString()
      });
      clearInterval(interval);
    };
  }, [hasAppLockPin, isAppLocked]);

  const unlockApp = () => {
    const unlockTime = Date.now();
    console.log('🔓 AppLock - Unlocking app', {
      timestamp: new Date().toISOString(),
      previousState: isAppLockedRef.current
    });
    setIsAppLocked(false);
    unlockTimestampRef.current = unlockTime;
    
    console.log('🔓 AppLock - Unlock protection set (30 seconds)', {
      unlockTimestamp: new Date(unlockTime).toISOString(),
      protectionUntil: new Date(unlockTime + 30000).toISOString()
    });
    
    // Clear the unlock timestamp after 30 seconds
    setTimeout(() => {
      console.log('🔓 AppLock - Unlock protection expired');
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
