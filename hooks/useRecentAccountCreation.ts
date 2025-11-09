import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

interface RecentAccountCreationResult {
  isRecentAccount: boolean;
  accountCreatedAt: Date | null;
  isLoading: boolean;
  error: string | null;
}

export function useRecentAccountCreation() {
  const [result, setResult] = useState<RecentAccountCreationResult>({
    isRecentAccount: false,
    accountCreatedAt: null,
    isLoading: true,
    error: null,
  });

  const { session } = useAuth();

  useEffect(() => {
    const checkRecentAccountCreation = async () => {
      if (!session?.user?.id) {
        setResult({
          isRecentAccount: false,
          accountCreatedAt: null,
          isLoading: false,
          error: null,
        });
        return;
      }

      try {
        // Get user creation time from auth.users table
        const { data: userData, error: userError } = await supabase
          .from('auth.users')
          .select('created_at')
          .eq('id', session.user.id)
          .single();

        if (userError) {
          // If we can't access auth.users, try profiles table
          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('created_at')
            .eq('id', session.user.id)
            .single();

          if (profileError) {
            throw profileError;
          }

          const createdAt = new Date(profileData.created_at);
          const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
          
          setResult({
            isRecentAccount: createdAt > fiveMinutesAgo,
            accountCreatedAt: createdAt,
            isLoading: false,
            error: null,
          });
        } else {
          const createdAt = new Date(userData.created_at);
          const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
          
          setResult({
            isRecentAccount: createdAt > fiveMinutesAgo,
            accountCreatedAt: createdAt,
            isLoading: false,
            error: null,
          });
        }
      } catch (error) {
        console.error('Error checking recent account creation:', error);
        setResult({
          isRecentAccount: false,
          accountCreatedAt: null,
          isLoading: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    };

    checkRecentAccountCreation();
  }, [session?.user?.id]);

  return result;
} 