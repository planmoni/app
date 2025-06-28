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
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setIsLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
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
          },
          emailRedirectTo: 'https://planmoni.com/auth/callback',
          disableEmailConfirmation: true
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

      // Wait for the profile to be created
      // This is necessary because the database trigger might take some time
      if (authData?.user?.id) {
        // Try to fetch the profile a few times with a delay
        let profileFound = false;
        const maxAttempts = 5;
        
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
          console.log(`Checking for profile creation, attempt ${attempt + 1}/${maxAttempts}`);
          
          // Wait a bit before checking
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // Check if profile exists - removed .single() to avoid error when no rows found
          const { data: profiles, error: profileError } = await supabase
            .from('profiles')
            .select('id')
            .eq('id', authData.user.id);
          
          if (!profileError && profiles && profiles.length > 0) {
            console.log('Profile created successfully:', profiles[0]);
            profileFound = true;
            break;
          }
          
          console.log('Profile not found yet, waiting...');
        }
        
        if (!profileFound) {
          console.warn('Profile was not created after multiple attempts, attempting manual creation');
          
          // Try to create the profile manually as a fallback
          try {
            console.log('Attempting to create profile manually');
            const { error: insertError } = await supabase
              .from('profiles')
              .insert({
                id: authData.user.id,
                first_name: firstName.trim(),
                last_name: lastName.trim(),
                email: email.toLowerCase().trim(),
                referral_code: referralCode?.trim() || null,
              });
            
            if (insertError) {
              console.error('Failed to manually create profile:', insertError);
              return { 
                success: false, 
                error: 'Your account was created but profile setup failed. Please contact support.',
                data: authData
              };
            }
            
            console.log('Profile created manually successfully');
            profileFound = true; // Update the flag to indicate success
          } catch (manualError) {
            console.error('Error during manual profile creation:', manualError);
            return { 
              success: false, 
              error: 'Your account was created but profile setup failed. Please contact support.',
              data: authData
            };
          }
        }
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
    user: session?.user || null,
    isLoading,
    error,
    signIn,
    signUp,
    signOut,
    resetPassword,
  };
}