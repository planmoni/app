import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export function useEmailVerification() {
  const [isVerified, setIsVerified] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userData, setUserData] = useState<{
    email: string;
    firstName: string;
    lastName: string;
  } | null>(null);

  const checkEmailVerification = async (email: string) => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Check if email is verified in the cache
      const { data, error: fetchError } = await supabase
        .from('email_verification_cache')
        .select('*')
        .eq('email', email.toLowerCase())
        .eq('verified', true)
        .single();
      
      if (fetchError) {
        if (fetchError.code === 'PGRST116') {
          // No record found, email is not verified
          setIsVerified(false);
          setUserData(null);
        } else {
          throw fetchError;
        }
      } else if (data) {
        // Email is verified
        setIsVerified(true);
        setUserData({
          email: data.email,
          firstName: data.first_name,
          lastName: data.last_name
        });
      } else {
        // No data returned
        setIsVerified(false);
        setUserData(null);
      }
      
      return {
        isVerified: data ? true : false,
        userData: data ? {
          email: data.email,
          firstName: data.first_name,
          lastName: data.last_name
        } : null
      };
    } catch (err) {
      console.error('Error checking email verification:', err);
      setError(err instanceof Error ? err.message : 'Failed to check email verification');
      return { isVerified: false, userData: null };
    } finally {
      setIsLoading(false);
    }
  };

  const storeEmailVerification = async (
    email: string, 
    firstName: string, 
    lastName: string, 
    verified: boolean = true
  ) => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Store or update email verification status
      const { error: upsertError } = await supabase
        .from('email_verification_cache')
        .upsert([
          {
            email: email.toLowerCase(),
            first_name: firstName,
            last_name: lastName,
            verified,
            expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours expiry
          }
        ]);
      
      if (upsertError) throw upsertError;
      
      setIsVerified(verified);
      setUserData({
        email,
        firstName,
        lastName
      });
      
      return true;
    } catch (err) {
      console.error('Error storing email verification:', err);
      setError(err instanceof Error ? err.message : 'Failed to store email verification');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const clearEmailVerification = async (email: string) => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Delete the email verification record
      const { error: deleteError } = await supabase
        .from('email_verification_cache')
        .delete()
        .eq('email', email.toLowerCase());
      
      if (deleteError) throw deleteError;
      
      setIsVerified(false);
      setUserData(null);
      
      return true;
    } catch (err) {
      console.error('Error clearing email verification:', err);
      setError(err instanceof Error ? err.message : 'Failed to clear email verification');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    isVerified,
    isLoading,
    error,
    userData,
    checkEmailVerification,
    storeEmailVerification,
    clearEmailVerification
  };
}