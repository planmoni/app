import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Session } from '@supabase/supabase-js';
import { Platform } from 'react-native';

type AuthResult = {
  success: boolean;
  error?: string;
};

export function useSupabaseAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      try {
        console.log('🔐 Initializing auth session...');
        
        // Get initial session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error('❌ Error getting initial session:', sessionError);
          setError(sessionError.message);
        } else {
          console.log('✅ Initial session loaded:', session ? 'User logged in' : 'No session');
          if (mounted) {
            setSession(session);
          }
        }
      } catch (err) {
        console.error('❌ Failed to initialize auth:', err);
        if (mounted) {
          setError('Failed to initialize authentication');
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    initializeAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event: string, session: Session | null) => {
        console.log('🔄 Auth state changed:', event, session ? 'Session exists' : 'No session');
        
        if (mounted) {
          setSession(session);
          setIsLoading(false);
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string): Promise<AuthResult> => {
    try {
      setError(null);
      setIsLoading(true);
      
      const { error, data } = await supabase.auth.signInWithPassword({ 
        email: email.toLowerCase().trim(), 
        password 
      });
      
      if (error) {
        // Format error message for better user experience
        let errorMessage = error.message;
        
        // Handle specific error cases
        if (error.message.includes('Invalid login credentials')) {
          errorMessage = 'Invalid email or password. Please check your credentials and try again.';
        } else if (error.message.includes('Email not confirmed')) {
          errorMessage = 'Please verify your email address before signing in.';
        } else if (error.message.includes('rate limit')) {
          errorMessage = 'Too many login attempts. Please try again later.';
        }
        
        setError(errorMessage);
        return { success: false, error: errorMessage };
      }
      
      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to sign in';
      setError(message);
      return { success: false, error: message };
    } finally {
      setIsLoading(false);
    }
  };

  const signUp = async (email: string, password: string, firstName: string, lastName: string, referralCode?: string): Promise<AuthResult> => {
    try {
      setError(null);
      setIsLoading(true);
      
      // Create the user account with metadata that will be used by the database trigger
      const { error: signUpError, data: authData } = await supabase.auth.signUp({
        email: email.toLowerCase().trim(),
        password,
        options: {
          data: {
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            referral_code: referralCode?.trim() || null,
          }
        }
      });
      
      if (signUpError) {
        // Format error message for better user experience
        let errorMessage = signUpError.message;
        
        // Handle specific error cases
        if (signUpError.message.includes('already registered')) {
          errorMessage = 'This email is already registered. Please sign in or use a different email.';
        } else if (signUpError.message.includes('password')) {
          errorMessage = 'Password is too weak. Please use a stronger password.';
        }
        
        setError(errorMessage);
        return { success: false, error: errorMessage };
      }

      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create account';
      setError(message);
      return { success: false, error: message };
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async (): Promise<AuthResult> => {
    try {
      setError(null);
      setIsLoading(true);
      const { error } = await supabase.auth.signOut();
      if (error) {
        const message = error.message;
        setError(message);
        return { success: false, error: message };
      }
      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to sign out';
      setError(message);
      return { success: false, error: message };
    } finally {
      setIsLoading(false);
    }
  };

  const resetPassword = async (email: string): Promise<AuthResult> => {
    try {
      setError(null);
      setIsLoading(true);
      const { error } = await supabase.auth.resetPasswordForEmail(email.toLowerCase().trim(), {
        redirectTo: 'planmoni://reset-password',
      });
      if (error) {
        const message = error.message;
        setError(message);
        return { success: false, error: message };
      }
      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to send reset email';
      setError(message);
      return { success: false, error: message };
    } finally {
      setIsLoading(false);
    }
  };

  return {
    session,
    isLoading,
    error,
    signIn,
    signUp,
    signOut,
    resetPassword,
  };
}