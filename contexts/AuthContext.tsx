import React, { createContext, useContext, useState, useEffect, ReactNode, useMemo, useCallback } from 'react';
import { Session } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import { router } from 'expo-router';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { BiometricService } from '@/lib/biometrics';
import { ProfileSnapshotManager } from '@/lib/profileSnapshot';
import { createUserScopedStorage } from '@/lib/user-scoped-storage';
import {
  ExpiredSessionRecovery,
  clearExpiredSessionRecovery,
  loadExpiredSessionRecovery,
} from '@/lib/auth-recovery';
import { resetStateAfterReauth } from '@/lib/auth-cache-reset';
import { useToast } from '@/contexts/ToastContext';

interface BiometricSettings {
  isAvailable: boolean;
  isEnabled: boolean;
  supportedTypes: string[];
}

interface AuthContextType {
  session: Session | null;
  user: any;
  isLoading: boolean;
  isAuthReady: boolean;
  error: string | null;
  sessionRecovery: ExpiredSessionRecovery | null;
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signUp: (email: string, password: string, metadata?: any) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ success: boolean; error?: string }>;
  biometricSettings: BiometricSettings | null;
  setBiometricEnabled: (enabled: boolean) => Promise<boolean>;
  refreshBiometricSettings: () => Promise<void>;
  clearSessionRecovery: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

const defaultBiometricSettings: BiometricSettings = {
  isAvailable: false,
  isEnabled: false,
  supportedTypes: [],
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Note: Sessions are automatically persisted to secure storage via useSupabaseAuth
  const {
    session,
    isLoading,
    isAuthReady,
    signIn: supabaseSignIn,
    signUp,
    resetPassword,
    signOut: supabaseSignOut,
    error
  } = useSupabaseAuth();
  const { showToast } = useToast();

  const [biometricSettings, setBiometricSettings] = useState<BiometricSettings | null>(null);
  const [sessionRecovery, setSessionRecovery] = useState<ExpiredSessionRecovery | null>(null);
  
  // Helper function to clear all PIN data for a user
  const clearAllPinsForUser = async (userId: string): Promise<void> => {
    try {
      const userStorage = createUserScopedStorage(userId);
      console.log('🗑️ AuthContext - Clearing all PIN data for user:', userId);
      
      // Clear all PINs
      await userStorage.deleteItem('app_lock_pin');
      await userStorage.deleteItem('payout_pin');
      await userStorage.deleteItem('emergency_pin');
      
      // Clear all biometric settings
      await userStorage.deleteItem('biometric_enabled');
      await userStorage.deleteItem('payout_biometric_enabled');
      await userStorage.deleteItem('emergency_biometric_enabled');
      
      console.log('✅ AuthContext - All PIN data cleared successfully');
    } catch (error) {
      console.error('❌ AuthContext - Error clearing PIN data:', error);
      throw error;
    }
  };

  // Get user from session
  const user = session?.user || null;

  useEffect(() => {
    refreshBiometricSettings();
  }, []);

  useEffect(() => {
    if (!session?.user?.id) return;
    setSessionRecovery(null);
    void clearExpiredSessionRecovery();
  }, [session?.user?.id]);

  useEffect(() => {
    if (isLoading || session?.user?.id) return;

    loadExpiredSessionRecovery()
      .then((recovery) => {
        if (recovery) {
          setSessionRecovery(recovery);
          router.replace('/(auth)/welcome-back');
        }
      })
      .catch((loadError) => {
        console.warn('Failed to hydrate session recovery payload:', loadError);
      });
  }, [isLoading, session?.user?.id]);


  // Save profile snapshots when session changes
  useEffect(() => {
    if (session?.user?.id) {
      // Save metadata snapshot immediately
      if (session.user.user_metadata) {
        ProfileSnapshotManager.saveMetadataSnapshot(session.user.id, session.user.user_metadata);
      }
      
      // Refresh profile snapshot in background
      ProfileSnapshotManager.refreshProfileSnapshot(session.user.id).catch(error => {
        console.error('Failed to refresh profile snapshot:', error);
      });
    } else {
      // Clear profile snapshots when no session
      // Note: We don't clear here as we want to keep snapshots for potential re-login
    }
  }, [session?.user?.id]);

  const clearSessionRecoveryState = useCallback(async () => {
    await clearExpiredSessionRecovery();
    setSessionRecovery(null);
  }, []);

  // Monitor for session expiration
  useEffect(() => {
    if (error && (
      error.includes('JWT expired') ||
      error.includes('refresh_token_not_found') ||
      error.includes('Invalid Refresh Token') ||
      error.includes('Session expired') ||
      error.includes('Session expired or invalid')
    )) {
      console.log('🔴 Session expired detected, checking recovery payload');
      loadExpiredSessionRecovery()
        .then((recovery) => {
          if (recovery) {
            setSessionRecovery(recovery);
            router.replace('/(auth)/welcome-back');
          }
        })
        .catch((loadError) => {
          console.warn('Failed to load session recovery payload:', loadError);
        });
    }
  }, [error]);

  // Also monitor session state directly
  useEffect(() => {
    // If we had a session but now we don't, and there's an error, show the modal
    if (!session && error && (
      error.includes('JWT expired') ||
      error.includes('refresh_token_not_found') ||
      error.includes('Invalid Refresh Token') ||
      error.includes('Session expired')
    )) {
      console.log('🔴 Session lost with error, routing to welcome-back if possible');
      loadExpiredSessionRecovery()
        .then((recovery) => {
          if (recovery) {
            setSessionRecovery(recovery);
            router.replace('/(auth)/welcome-back');
          }
        })
        .catch((loadError) => {
          console.warn('Failed to load session recovery payload:', loadError);
        });
    }
  }, [session, error]);

  const refreshBiometricSettings = useCallback(async () => {
    try {
      if (Platform.OS === 'web') {
        setBiometricSettings(defaultBiometricSettings);
        return;
      }
      const settings = await BiometricService.checkBiometricSupport();
      setBiometricSettings({
        ...settings,
        supportedTypes: settings.supportedTypes.map(type => type.toString())
      });
    } catch (error) {
      console.error('Failed to check biometric support:', error);
      setBiometricSettings(defaultBiometricSettings);
    }
  }, []);

  const setBiometricEnabled = useCallback(async (enabled: boolean): Promise<boolean> => {
    try {
      if (Platform.OS === 'web') {
        return false;
      }
      
      const success = await BiometricService.setBiometricEnabled(enabled);
      if (success) {
        await refreshBiometricSettings();
      }
      return success;
    } catch (error) {
      console.error('Failed to set biometric enabled:', error);
      return false;
    }
  }, [refreshBiometricSettings]);

  // Sign-in: return + navigate as soon as credentials succeed. Device/post work is background.
  const signIn = useCallback(async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const result = await supabaseSignIn(email, password);

      if (!result.success) {
        return { success: false, error: result.error };
      }

      // Leave password screen immediately — do not await device / email / cache work.
      router.replace('/(tabs)');

      const currentSession = result.session ?? null;
      void (async () => {
        try {
          await clearExpiredSessionRecovery();
          setSessionRecovery(null);
          await resetStateAfterReauth();
        } catch (error) {
          console.warn('Post-login cache reset failed:', error);
        }

        if (!currentSession?.user?.id) return;

        try {
          const { DeviceInfoService } = await import('@/lib/device-info');
          const { ActiveSessionService } = await import('@/lib/active-session-service');

          const deviceFingerprint = await DeviceInfoService.generateDeviceFingerprint();
          const sessionCheck = await ActiveSessionService.checkActiveSession(
            currentSession.user.id,
            deviceFingerprint
          );

          if (sessionCheck.hasActiveSession && !sessionCheck.isSameDevice) {
            console.log('⚠️ Active session found on different device, signing out...');
            const deviceInfo = sessionCheck.activeSessionInfo?.deviceInfo;
            const deviceDescription = deviceInfo
              ? `${deviceInfo.device_manufacturer} ${deviceInfo.device_model} (${deviceInfo.os_name})`
              : 'another device';

            await supabaseSignOut();
            showToast(
              `You are already logged in on ${deviceDescription}. Please log out from that device first.`,
              'error',
              5000
            );
            router.replace('/(auth)/login');
            return;
          }

          try {
            const loginSession = await DeviceInfoService.createLoginSession(
              currentSession.user.id,
              currentSession.access_token
            );
            if (loginSession?.id) {
              await ActiveSessionService.activateSession(loginSession.id, currentSession.user.id);
            }
          } catch (error) {
            console.error('Failed to track login session:', error);
          }

          try {
            const deviceInfo = await DeviceInfoService.getDeviceInfo();
            const locationInfo = await DeviceInfoService.getLocationInfo();
            const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
            const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

            const response = await fetch(`${supabaseUrl}/functions/v1/login-notification`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseAnonKey}`,
                'apikey': supabaseAnonKey || '',
              },
              body: JSON.stringify({
                userId: currentSession.user.id,
                loginInfo: {
                  device: `${deviceInfo.device_manufacturer} ${deviceInfo.device_model}`,
                  location: `${locationInfo.city}, ${locationInfo.country}`,
                  time: new Date().toLocaleString(),
                  ip: locationInfo.ip_address,
                },
              }),
            });
            const data = await response.json();
            if (data.success) console.log('Login notification sent successfully');
            else console.log('Login notification attempted:', data.message);
          } catch (error) {
            console.error('Failed to send login notification:', error);
          }
        } catch (error) {
          console.warn('Background post-login work failed:', error);
        }
      })();

      return { success: true };
    } catch (error) {
      console.error('Sign-in error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Sign-in failed' };
    }
  }, [supabaseSignIn, supabaseSignOut, showToast]);

  // Enhanced signOut function that clears profile snapshots
  // NOTE: PIN and biometric settings are NOT cleared on logout - they persist per user account
  const signOut = useCallback(async (): Promise<void> => {
    await clearExpiredSessionRecovery();
    setSessionRecovery(null);
    await supabaseSignOut();
  }, [supabaseSignOut]);

  // Memoize context value to prevent unnecessary re-renders
  const value: AuthContextType = useMemo(() => ({
    session,
    user,
    isLoading,
    isAuthReady,
    error,
    sessionRecovery,
    signIn,
    signUp,
    resetPassword,
    signOut,
    biometricSettings,
    setBiometricEnabled,
    refreshBiometricSettings,
    clearSessionRecovery: clearSessionRecoveryState,
  }), [
    session,
    user,
    isLoading,
    isAuthReady,
    error,
    sessionRecovery,
    signIn,
    signUp,
    resetPassword,
    signOut,
    biometricSettings,
    setBiometricEnabled,
    refreshBiometricSettings,
    clearSessionRecoveryState,
  ]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};