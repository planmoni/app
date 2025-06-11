import { Session } from '@supabase/supabase-js';
import { createContext, useContext } from 'react';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';

type AuthResult = {
  success: boolean;
  error?: string;
};

type AuthContextType = {
  session: Session | null;
  isLoading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signUp: (email: string, password: string, firstName: string, lastName: string) => Promise<AuthResult>;
  signOut: () => Promise<AuthResult>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const auth = useSupabaseAuth();

  return (
    <AuthContext.Provider value={auth}>
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