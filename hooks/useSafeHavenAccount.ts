import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { RealtimeChannel } from '@supabase/supabase-js';

export type SafeHavenAccount = {
  id: string;
  user_id: string;
  account_number: string;
  account_name: string;
  bank_name: string;
  status: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
};

export function useSafeHavenAccount() {
  const [account, setAccount] = useState<SafeHavenAccount | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { session } = useAuth();
  const updateTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = React.useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    
    if (!session?.user?.id) {
      setIsLoading(false);
      return;
    }

    let channel: RealtimeChannel;

    const setupRealtimeSubscription = async () => {
      try {
        // Initial fetch
        await fetchAccount();

        // Set up real-time subscription with throttling to prevent excessive updates
        channel = supabase
          .channel('safehaven-account-changes')
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'safehaven_accounts',
              filter: `user_id=eq.${session.user.id}`,
            },
            (payload: any) => {
              // Skip if component is not mounted
              if (!isMountedRef.current) {
                return;
              }
              
              console.log('SafeHaven account change received:', payload);
              
              // Throttle updates to prevent excessive re-renders
              if (updateTimeoutRef.current) {
                clearTimeout(updateTimeoutRef.current);
              }
              
              updateTimeoutRef.current = setTimeout(() => {
                // Double-check mount status before updating
                if (!isMountedRef.current) {
                  return;
                }
                
                if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
                  const accountData = payload.new as any;
                  // Only update if account has a real account number (not a placeholder)
                  if (accountData.account_number && !accountData.account_number.startsWith('PENDING_')) {
                    setAccount((prevAccount) => {
                      // Only update if the account number actually changed to prevent unnecessary re-renders
                      if (prevAccount?.account_number === accountData.account_number) {
                        return prevAccount;
                      }
                      return {
                        id: accountData.id,
                        user_id: accountData.user_id,
                        account_number: accountData.account_number,
                        account_name: accountData.account_name,
                        bank_name: 'SAFEHAVEN MFB',
                        status: accountData.status,
                        is_default: accountData.is_default,
                        created_at: accountData.created_at,
                        updated_at: accountData.updated_at,
                      };
                    });
                  }
                  // If account is pending or placeholder, ignore the update (don't change state)
                } else if (payload.eventType === 'DELETE') {
                  if (isMountedRef.current) {
                    setAccount(null);
                  }
                }
              }, 1000); // Increased throttle to 1000ms to prevent excessive updates
            }
          )
          .subscribe((status: any) => {
            console.log('SafeHaven account subscription status:', status);
          });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to setup account subscription');
      }
    };

    setupRealtimeSubscription();

    return () => {
      isMountedRef.current = false;
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
        updateTimeoutRef.current = null;
      }
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [session?.user?.id]);

  const fetchAccount = async () => {
    if (!isMountedRef.current) return;
    
    try {
      setError(null);
      setIsLoading(true);
      console.log('[useSafeHavenAccount] Fetching SafeHaven account data for user:', session?.user?.id);
      
      // First, let's check all accounts without filters to see what we have
      const { data: allAccounts, error: allAccountsError } = await supabase
        .from('safehaven_accounts')
        .select('id, user_id, account_number, account_name, status, is_default, is_deleted, created_at, updated_at')
        .eq('user_id', session?.user?.id);
      
      console.log('[useSafeHavenAccount] All accounts found:', {
        count: allAccounts?.length || 0,
        accounts: allAccounts?.map(acc => ({
          id: acc.id,
          accountNumber: acc.account_number?.substring(0, 5) + '****',
          accountName: acc.account_name,
          status: acc.status,
          isDeleted: acc.is_deleted,
          startsWithPending: acc.account_number?.startsWith('PENDING_')
        })) || []
      });
      console.log('[useSafeHavenAccount] All accounts error:', allAccountsError);
      
      if (allAccountsError) {
        console.error('[useSafeHavenAccount] Error fetching all accounts:', {
          code: allAccountsError.code,
          message: allAccountsError.message,
          details: allAccountsError.details,
          hint: allAccountsError.hint
        });
      }
      
      // Now fetch with filters
      const { data, error: accountError } = await supabase
        .from('safehaven_accounts')
        .select('id, user_id, account_number, account_name, status, is_default, created_at, updated_at')
        .eq('user_id', session?.user?.id)
        .eq('is_deleted', false)
        .not('account_number', 'ilike', 'PENDING_%') // Exclude placeholder accounts
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!isMountedRef.current) return;

      if (accountError) {
        console.error('[useSafeHavenAccount] Error fetching SafeHaven account:', accountError);
        throw accountError;
      }
      
      console.log('[useSafeHavenAccount] Filtered account data:', data);
      
      if (data && data.account_number && !data.account_number.startsWith('PENDING_')) {
        console.log('[useSafeHavenAccount] SafeHaven account data fetched successfully:', {
          id: data.id,
          account_number: data.account_number?.substring(0, 5) + '****',
          account_name: data.account_name,
          status: data.status,
          is_default: data.is_default
        });
        if (isMountedRef.current) {
          setAccount({
            id: data.id,
            user_id: data.user_id,
            account_number: data.account_number,
            account_name: data.account_name,
            bank_name: 'SAFEHAVEN MFB',
            status: data.status,
            is_default: data.is_default,
            created_at: data.created_at,
            updated_at: data.updated_at,
          });
        }
      } else {
        console.log('[useSafeHavenAccount] No valid SafeHaven account found. Data:', data);
        console.log('[useSafeHavenAccount] Account number check:', {
          hasData: !!data,
          hasAccountNumber: !!data?.account_number,
          accountNumber: data?.account_number,
          startsWithPending: data?.account_number?.startsWith('PENDING_')
        });
        if (isMountedRef.current) {
          setAccount(null);
        }
      }
    } catch (err) {
      if (isMountedRef.current) {
        console.error('[useSafeHavenAccount] Error in fetchAccount:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch account');
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  };

  const refreshAccount = async () => {
    setIsLoading(true);
    await fetchAccount();
  };

  return {
    account,
    isLoading,
    error,
    refreshAccount
  };
}

