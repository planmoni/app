import { Session } from '@supabase/supabase-js';
import { createContext, useContext, useState } from 'react';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { BiometricService, BiometricSettings } from '@/lib/biometrics';
import { supabase } from '@/lib/supabase';

type AuthResult = {
  success: boolean;
  error?: string;
};

type AuthContextType = {
  session: Session | null;
  isLoading: boolean;
  error: string | null;
  biometricSettings: BiometricSettings | null
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signUp: (email: string, password: string, firstName: string, lastName: string) => Promise<AuthResult>;
  signOut: () => Promise<AuthResult>;
  authenticateWithBiometrics: () => Promise<boolean>
  setBiometricEnabled: (enabled: boolean) => Promise<boolean>
  refreshBiometricSettings: () => Promise<void>
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const auth = useSupabaseAuth();
  const [biometricSettings, setBiometricSettings] = useState<BiometricSettings | null>(null)

  
  const refreshBiometricSettings = async () => {
    try {
      const settings = await BiometricService.checkBiometricSupport()
      setBiometricSettings(settings)
    } catch (error) {
      console.error("Error refreshing biometric settings:", error)
    }
  }

  
  const setBiometricEnabled = async (enabled: boolean): Promise<boolean> => {
    const success = await BiometricService.setBiometricEnabled(enabled)
    if (success) {
      await refreshBiometricSettings()

      // Store current credentials if enabling biometrics
      if (enabled) {
        // Note: In a real app, you'd want to store a secure token instead of credentials
        // This is simplified for demonstration
        const currentSession = await supabase.auth.getSession()
        // const currentSession = 'supabase.auth.getSession()'
        // if (currentSession) {
        //   await BiometricService.storeBiometricToken(
        //     JSON.stringify({
        //       sessionToken: currentSession,
        //     }),
        //   )
        // }
        if (currentSession.data.session) {
          await BiometricService.storeBiometricToken(
            JSON.stringify({
              sessionToken: currentSession.data.session.access_token,
            }),
          )
        }
      }
    }
    return success
  }

  return (
    <AuthContext.Provider 
      value={{
        ...auth,
        biometricSettings,
        authenticateWithBiometrics: async () => {
          const result = await BiometricService.authenticateWithBiometrics();
          return result.success;
        },
        setBiometricEnabled,
        refreshBiometricSettings
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}