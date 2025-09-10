import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Session } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { BiometricService } from '@/lib/biometrics';
import { ProfileSnapshotManager } from '@/lib/profileSnapshot';

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

  const refreshBiometricSettings = async () => {
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
  };

  const setBiometricEnabled = async (enabled: boolean): Promise<boolean> => {
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
  };

  // Enhanced signIn function that sends login notification and migrates app lock settings
  const signIn = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const result = await supabaseSignIn(email, password);
      
      if (result.success && session?.user?.id) {
        // Send login notification
        try {
          const { supabase } = await import('@/lib/supabase');
          await supabase.functions.invoke('login-notification', {
            body: { userId: session.user.id }
          });
        } catch (error) {
          console.error('Failed to send login notification:', error);
          // Don't fail the sign-in if notification fails
        }
      }
      
      return result;
    } catch (error) {
      console.error('Sign-in error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Sign-in failed' };
    }
  };

  // Enhanced signOut function that clears profile snapshots
  const signOut = async (): Promise<void> => {
    try {
      // Clear profile snapshots for current user
      if (session?.user?.id) {
        await ProfileSnapshotManager.clearProfileSnapshot(session.user.id);
      }
      
      // Sign out from Supabase
      await supabaseSignOut();
    } catch (error) {
      console.error('Sign-out error:', error);
      throw error;
    }
  };

  const value: AuthContextType = {
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
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};