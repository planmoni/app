import React, { createContext, useContext, useState, useEffect, ReactNode, useMemo, useCallback } from 'react';
import { Session } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { BiometricService } from '@/lib/biometrics';
import { ProfileSnapshotManager } from '@/lib/profileSnapshot';
import SessionExpiredModal from '@/components/SessionExpiredModal';
import { createUserScopedStorage } from '@/lib/user-scoped-storage';

interface BiometricSettings {
  isAvailable: boolean;
  isEnabled: boolean;
  supportedTypes: string[];
}

interface AuthContextType {
  session: Session | null;
  user: any;
  isLoading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signUp: (email: string, password: string, metadata?: any) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ success: boolean; error?: string }>;
  biometricSettings: BiometricSettings | null;
  setBiometricEnabled: (enabled: boolean) => Promise<boolean>;
  refreshBiometricSettings: () => Promise<void>;
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
    signIn: supabaseSignIn,
    signUp,
    resetPassword,
    signOut: supabaseSignOut,
    error
  } = useSupabaseAuth();

  const [biometricSettings, setBiometricSettings] = useState<BiometricSettings | null>(null);
  const [showSessionExpiredModal, setShowSessionExpiredModal] = useState(false);
  
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

  // Monitor for session expiration
  useEffect(() => {
    if (error && (
      error.includes('JWT expired') ||
      error.includes('refresh_token_not_found') ||
      error.includes('Invalid Refresh Token') ||
      error.includes('Session expired') ||
      error.includes('Session expired or invalid')
    )) {
      console.log('🔴 Session expired detected, showing modal');
      setShowSessionExpiredModal(true);
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
      console.log('🔴 Session lost with error, showing modal');
      setShowSessionExpiredModal(true);
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

  // Enhanced signIn function that sends login notification and tracks login sessions
  const signIn = useCallback(async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const result = await supabaseSignIn(email, password);

      if (result.success) {
        // Get the session directly from Supabase since state might not be updated yet
        const { supabase } = await import('@/lib/supabase');
        const { data: { session: currentSession } } = await supabase.auth.getSession();

        if (currentSession?.user?.id) {
          // Track login session with device and location info
          try {
            const { DeviceInfoService } = await import('@/lib/device-info');
            await DeviceInfoService.createLoginSession(currentSession.user.id, currentSession.access_token);
          } catch (error) {
            console.error('Failed to track login session:', error);
          }

          // Send login notification
          try {
            const { DeviceInfoService } = await import('@/lib/device-info');

            const deviceInfo = await DeviceInfoService.getDeviceInfo();
            const locationInfo = await DeviceInfoService.getLocationInfo();

            // Use direct fetch like OTP emails
            const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
            const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

            const response = await fetch(`${supabaseUrl}/functions/v1/login-notification`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseAnonKey}`,
                'apikey': supabaseAnonKey || ''
              },
              body: JSON.stringify({
                userId: currentSession.user.id,
                loginInfo: {
                  device: `${deviceInfo.device_manufacturer} ${deviceInfo.device_model}`,
                  location: `${locationInfo.city}, ${locationInfo.country}`,
                  time: new Date().toLocaleString(),
                  ip: locationInfo.ip_address
                }
              })
            });

            const data = await response.json();
            if (data.success) {
              console.log('Login notification sent successfully');
            } else {
              console.log('Login notification attempted:', data.message);
            }
          } catch (error) {
            console.error('Failed to send login notification:', error);
          }
        }
      }

      return result;
    } catch (error) {
      console.error('Sign-in error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Sign-in failed' };
    }
  }, [supabaseSignIn]);

  // Enhanced signOut function that clears profile snapshots
  // NOTE: PIN and biometric settings are NOT cleared on logout - they persist per user account
  const signOut = useCallback(async (): Promise<void> => {
    try {
      const userId = session?.user?.id;
      
      // Clear profile snapshots for current user
      if (userId) {
        await ProfileSnapshotManager.clearProfileSnapshot(userId);
      }
      
      // NOTE: We intentionally do NOT clear PIN/biometric settings on logout
      // These are user-specific security preferences that should persist across sessions
      // They are stored in user-scoped secure storage and will be available when the user logs back in
      
      // Sign out from Supabase
      await supabaseSignOut();
    } catch (error) {
      console.error('Sign-out error:', error);
      throw error;
    }
  }, [session?.user?.id, supabaseSignOut]);

  const handleSessionExpiredModalClose = useCallback(() => {
    setShowSessionExpiredModal(false);
  }, []);

  // Memoize context value to prevent unnecessary re-renders
  const value: AuthContextType = useMemo(() => ({
    session,
    user,
    isLoading,
    error,
    signIn,
    signUp,
    resetPassword,
    signOut,
    biometricSettings,
    setBiometricEnabled,
    refreshBiometricSettings,
  }), [
    session,
    user,
    isLoading,
    error,
    signIn,
    signUp,
    resetPassword,
    signOut,
    biometricSettings,
    setBiometricEnabled,
    refreshBiometricSettings,
  ]);

  return (
    <AuthContext.Provider value={value}>
      {children}
      <SessionExpiredModal 
        isVisible={showSessionExpiredModal}
        onClose={handleSessionExpiredModalClose}
      />
    </AuthContext.Provider>
  );
};