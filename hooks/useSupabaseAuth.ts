import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Session } from '@supabase/supabase-js';

type AuthResult = {
  success: boolean;
  error?: string;
  data?: any;
};

export function useSupabaseAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user || null);
      setIsLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user || null);
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const checkUserExists = async (email: string): Promise<{ exists: boolean; error?: string }> => {
    try {
      // Use password reset to check if user exists without triggering auth errors
      // This method doesn't actually send an email if the user doesn't exist
      const { error } = await supabase.auth.resetPasswordForEmail(email.toLowerCase().trim(), {
        redirectTo: 'planmoni://reset-password',
      });
      
      // If no error, user exists
      if (!error) {
        return { exists: true };
      }
      
      // Check for specific error messages that indicate user doesn't exist
      if (error.message.includes('User not found') || 
          error.message.includes('Unable to validate email address') ||
          error.message.includes('Invalid email')) {
        return { exists: false };
      }
      
      // For other errors, assume user might exist to be safe
      return { exists: true, error: error.message };
    } catch (err) {
      // On any error, assume user exists to be safe
      return { exists: true, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  };

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
        
        // Handle specific error codes first, then fall back to message checks
        if (error.code === 'invalid_credentials') {
          errorMessage = 'Invalid email or password. Please check your credentials and try again.';
        } else if (error.code === 'email_not_confirmed') {
          errorMessage = 'Please verify your email address before signing in.';
        } else if (error.code === 'too_many_requests') {
          errorMessage = 'Too many login attempts. Please try again later.';
        } else if (error.message.includes('Invalid login credentials')) {
          errorMessage = 'Invalid email or password. Please check your credentials and try again.';
        } else if (error.message.includes('Email not confirmed')) {
          errorMessage = 'Please verify your email address before signing in.';
        } else if (error.message.includes('rate limit')) {
          errorMessage = 'Too many login attempts. Please try again later.';
        }
        
        setError(errorMessage);
        return { success: false, error: errorMessage };
      }
      
      return { success: true, data };
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
        
        // Handle specific error codes first, then fall back to message checks
        if (signUpError.code === 'user_already_exists') {
          errorMessage = 'This email is already registered. Please sign in or use a different email.';
        } else if (signUpError.code === 'weak_password') {
          errorMessage = 'Password is too weak. Please use a stronger password.';
        } else if (signUpError.code === 'invalid_credentials') {
          errorMessage = 'Invalid email or password format. Please check your information and try again.';
        } else if (signUpError.message.includes('already registered')) {
          errorMessage = 'This email is already registered. Please sign in or use a different email.';
        } else if (signUpError.message.includes('password')) {
          errorMessage = 'Password is too weak. Please use a stronger password.';
        }
        
        setError(errorMessage);
        return { success: false, error: errorMessage };
      }

      return { success: true, data: authData };
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
    user,
    isLoading,
    error,
    signIn,
    signUp,
    signOut,
    resetPassword,
    checkUserExists,
  };
}