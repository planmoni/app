import React, { createContext, useContext, useState, useEffect } from 'react';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { Session, User } from '@supabase/supabase-js';
import { BiometricService } from '@/lib/biometrics';
import { Platform } from 'react-native';
import { useEmailNotifications } from '@/hooks/useEmailNotifications';

interface BiometricSettings {
  isEnabled: boolean;
  supportedTypes: any[];
  isEnrolled: boolean;
  isAvailable: boolean;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signUp: (email: string, password: string, firstName: string, lastName: string, referralCode?: string) => Promise<{ success: boolean; error?: string }>;
  resetPassword: (email: string) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<{ success: boolean; error?: string }>;
  error: string | null;
  biometricSettings: BiometricSettings | null;
  setBiometricEnabled: (enabled: boolean) => Promise<boolean>;
  refreshBiometricSettings: () => Promise<void>;
}

const defaultBiometricSettings: BiometricSettings = {
  isEnabled: false,
  supportedTypes: [],
  isEnrolled: false,
  isAvailable: false
};

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  isLoading: true,
  signIn: async () => ({ success: false }),
  signUp: async () => ({ success: false }),
  resetPassword: async () => ({ success: false }),
  signOut: async () => ({ success: false }),
  error: null,
  biometricSettings: defaultBiometricSettings,
  setBiometricEnabled: async () => false,
  refreshBiometricSettings: async () => {},
});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const {
    session,
    user,
    isLoading,
    signIn: supabaseSignIn,
    signUp,
    resetPassword,
    signOut,
    error
  } = useSupabaseAuth();

  const [biometricSettings, setBiometricSettings] = useState<BiometricSettings | null>(null);
  const { sendNotification } = useEmailNotifications();

  useEffect(() => {
    refreshBiometricSettings();
  }, []);

  const refreshBiometricSettings = async () => {
    try {
      if (Platform.OS === 'web') {
        setBiometricSettings(defaultBiometricSettings);
        return;
      }
      
      const settings = await BiometricService.checkBiometricSupport();
      setBiometricSettings(settings);
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

  // Enhanced signIn function that sends login notification
  const signIn = async (email: string, password: string) => {
    const result = await supabaseSignIn(email, password);
    
    if (result.success && result.data?.session?.access_token) {
      // Get device and location info
      const deviceInfo = {
        device: Platform.OS === 'web' ? 'Web Browser' : Platform.OS === 'ios' ? 'iOS Device' : 'Android Device',
        location: 'Unknown Location', // In a real app, you would use geolocation
        time: new Date().toLocaleString(),
        ip: '0.0.0.0' // In a real app, you would get the IP from the server
      };
      
      // Send login notification email with explicit token
      try {
        await sendNotification('new_login', {
          ...deviceInfo,
          firstName: result.data.session.user?.user_metadata?.first_name || 'User'
        }, result.data.session.access_token);
      } catch (error) {
        console.error('Failed to send login notification:', error);
      }
    }
    
    return result;
  };

  return (
    <AuthContext.Provider value={{
      session,
      user,
      isLoading,
      signIn,
      signUp,
      resetPassword,
      signOut,
      error,
      biometricSettings,
      setBiometricEnabled,
      refreshBiometricSettings
    }}>
      {children}
    </AuthContext.Provider>
  );
};