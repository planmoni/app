import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';
import { saveItem, getItem, deleteItem, APP_LOCK_PIN_KEY, APP_LOCK_ENABLED_KEY } from '@/lib/secure-storage';
import { BiometricService } from '@/lib/biometrics';
import { supabase } from '@/lib/supabase';
import { useAuth } from './AuthContext';
import { useOnlineStatus } from '@/components/OnlineStatusProvider';

// Inactivity timeout in milliseconds (5 minutes)
const INACTIVITY_TIMEOUT = 5 * 60 * 1000;

interface AppLockContextType {
  isAppLocked: boolean;
  isAppLockEnabled: boolean;
  appLockPin: string | null;
  setAppLockPin: (pin: string) => Promise<void>;
  unlockApp: () => void;
  lockApp: () => void;
  checkPin: (pin: string) => boolean;
  disableAppLock: () => Promise<void>;
  resetInactivityTimer: () => void;
}

const AppLockContext = createContext<AppLockContextType | undefined>(undefined);

export function useAppLock() {
  const context = useContext(AppLockContext);
  if (context === undefined) {
    throw new Error('useAppLock must be used within an AppLockProvider');
  }
  return context;
}

export function AppLockProvider({ children }: { children: React.ReactNode }) {
  const [isAppLocked, setIsAppLocked] = useState(false);
  const [isAppLockEnabled, setIsAppLockEnabled] = useState(false);
  const [appLockPin, setAppLockPinState] = useState<string | null>(null);
  const { session } = useAuth();
  const { isOnline } = useOnlineStatus();
  
  // Ref for tracking inactivity
  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const backgroundTimeRef = useRef<number | null>(null);
  
  // Load app lock state on mount
  useEffect(() => {
    const loadAppLockState = async () => {
      try {
        // First try to load from secure storage (for offline support)
        const pin = await getItem(APP_LOCK_PIN_KEY);
        const enabled = await getItem(APP_LOCK_ENABLED_KEY);
        
        // If we're online and have a session, try to get from database
        if (isOnline && session?.user?.id) {
          const { data, error } = await supabase
            .from('profiles')
            .select('app_lock_enabled')
            .eq('id', session.user.id)
            .single();
            
          if (!error && data) {
            setIsAppLockEnabled(data.app_lock_enabled);
            
            // If app lock is enabled in the database but we don't have a PIN,
            // keep the app locked until PIN is set
            if (data.app_lock_enabled && !pin) {
              setIsAppLocked(true);
            } else if (data.app_lock_enabled && pin) {
              setAppLockPinState(pin);
              setIsAppLocked(true);
            }
            
            return;
          }
        }
        
        // Fallback to local storage if offline or database fetch failed
        setAppLockPinState(pin);
        setIsAppLockEnabled(enabled === 'true' && !!pin);
        
        // If app lock is enabled, lock the app on initial load
        if (enabled === 'true' && !!pin) {
          setIsAppLocked(true);
        }
      } catch (error) {
        console.error('Error loading app lock state:', error);
      }
    };
    
    loadAppLockState();
  }, [session?.user?.id, isOnline]);
  
  // Set up app state change listener
  useEffect(() => {
    // Skip for web platform
    if (Platform.OS === 'web') return;
    
    const subscription = AppState.addEventListener('change', nextAppState => {
      // App is going to background
      if (
        appStateRef.current.match(/active/) &&
        nextAppState.match(/inactive|background/)
      ) {
        backgroundTimeRef.current = Date.now();
      }
      
      // App is coming to foreground
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        // Check if app was in background for more than 5 minutes
        if (
          backgroundTimeRef.current &&
          Date.now() - backgroundTimeRef.current >= INACTIVITY_TIMEOUT &&
          isAppLockEnabled
        ) {
          setIsAppLocked(true);
        }
        
        // Reset background time
        backgroundTimeRef.current = null;
        
        // Reset inactivity timer
        resetInactivityTimer();
      }
      
      appStateRef.current = nextAppState;
    });
    
    return () => {
      subscription.remove();
    };
  }, [isAppLockEnabled]);
  
  // Function to reset inactivity timer
  const resetInactivityTimer = () => {
    // Skip for web platform
    if (Platform.OS === 'web') return;
    
    // Clear existing timer
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }
    
    // Set new timer if app lock is enabled
    if (isAppLockEnabled) {
      inactivityTimerRef.current = setTimeout(() => {
        // Only lock if app is in foreground
        if (appStateRef.current === 'active') {
          setIsAppLocked(true);
        }
      }, INACTIVITY_TIMEOUT);
    }
  };
  
  // Set up inactivity timer
  useEffect(() => {
    resetInactivityTimer();
    
    return () => {
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }
    };
  }, [isAppLockEnabled]);
  
  // Set app lock PIN
  const setAppLockPin = async (pin: string) => {
    try {
      // Save PIN to secure storage (for offline support)
      await saveItem(APP_LOCK_PIN_KEY, pin);
      await saveItem(APP_LOCK_ENABLED_KEY, 'true');
      
      // Update database if online
      if (isOnline && session?.user?.id) {
        await supabase
          .from('profiles')
          .update({ app_lock_enabled: true })
          .eq('id', session.user.id);
      }
      
      setAppLockPinState(pin);
      setIsAppLockEnabled(true);
      
      // Reset inactivity timer
      resetInactivityTimer();
    } catch (error) {
      console.error('Error setting app lock PIN:', error);
      throw error;
    }
  };
  
  // Unlock app
  const unlockApp = () => {
    setIsAppLocked(false);
    resetInactivityTimer();
  };
  
  // Lock app
  const lockApp = () => {
    if (isAppLockEnabled) {
      setIsAppLocked(true);
    }
  };
  
  // Check PIN
  const checkPin = (pin: string) => {
    return pin === appLockPin;
  };
  
  // Disable app lock
  const disableAppLock = async () => {
    try {
      // Update local storage
      await saveItem(APP_LOCK_ENABLED_KEY, 'false');
      
      // Update database if online
      if (isOnline && session?.user?.id) {
        await supabase
          .from('profiles')
          .update({ app_lock_enabled: false })
          .eq('id', session.user.id);
      }
      
      setIsAppLockEnabled(false);
      setIsAppLocked(false);
      
      // Clear inactivity timer
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
        inactivityTimerRef.current = null;
      }
    } catch (error) {
      console.error('Error disabling app lock:', error);
      throw error;
    }
  };
  
  return (
    <AppLockContext.Provider
      value={{
        isAppLocked,
        isAppLockEnabled,
        appLockPin,
        setAppLockPin,
        unlockApp,
        lockApp,
        checkPin,
        disableAppLock,
        resetInactivityTimer,
      }}
    >
      {children}
    </AppLockContext.Provider>
  );
}