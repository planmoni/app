import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { RealtimeChannel } from '@supabase/supabase-js';

export type PaystackAccount = {
  id: string;
  user_id: string;
  customer_code: string;
  account_number: string;
  account_name: string;
  bank_name: string;
  accountId: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export function useRealtimePaystackAccount() {
  const [account, setAccount] = useState<PaystackAccount | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { session } = useAuth();

  useEffect(() => {
    if (!session?.user?.id) return;

    let channel: RealtimeChannel;

    const setupRealtimeSubscription = async () => {
      try {
        // Initial fetch
        await fetchAccount();

        // Set up real-time subscription
        channel = supabase
          .channel('paystack-account-changes')
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'paystack_accounts',
              filter: `user_id=eq.${session.user.id}`,
            },
            (payload: any) => {
              console.log('Paystack account change received:', payload);
              
              if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
                setAccount(payload.new as PaystackAccount);
              } else if (payload.eventType === 'DELETE') {
                setAccount(null);
              }
            }
          )
          .subscribe((status: any) => {
            console.log('Paystack account subscription status:', status);
          });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to setup account subscription');
      }
    };

    setupRealtimeSubscription();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [session?.user?.id]);

  const fetchAccount = async () => {
    try {
      setError(null);
      console.log('Fetching paystack account data...');
      
      const { data, error: accountError } = await supabase
        .from('paystack_accounts')
        .select('*')
        .eq('user_id', session?.user?.id)
        .maybeSingle();

      if (accountError) {
        console.error('Error fetching paystack account:', accountError);
        throw accountError;
      }
      
      if (data) {
        console.log('Paystack account data fetched successfully:', data);
        setAccount(data);
      } else {
        console.log('No paystack account found');
        setAccount(null);
      }
    } catch (err) {
      console.error('Error in fetchAccount:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch account');
    } finally {
      setIsLoading(false);
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