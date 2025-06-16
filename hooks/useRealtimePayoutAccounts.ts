import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { RealtimeChannel } from '@supabase/supabase-js';

export type PayoutAccount = {
  id: string;
  user_id: string;
  account_name: string;
  account_number: string;
  bank_name: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
};

export function useRealtimePayoutAccounts() {
  const [payoutAccounts, setPayoutAccounts] = useState<PayoutAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { session } = useAuth();

  useEffect(() => {
    if (!session?.user?.id) return;

    let channel: RealtimeChannel;

    const setupRealtimeSubscription = async () => {
      try {
        // Initial fetch
        await fetchPayoutAccounts();

        // Set up real-time subscription
        channel = supabase
          .channel('payout-accounts-changes')
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'payout_accounts',
              filter: `user_id=eq.${session.user.id}`,
            },
            (payload) => {
              console.log('Payout account change received:', payload);
              
              if (payload.eventType === 'INSERT' && payload.new) {
                setPayoutAccounts(prev => [payload.new as PayoutAccount, ...prev]);
              } else if (payload.eventType === 'UPDATE' && payload.new) {
                setPayoutAccounts(prev => 
                  prev.map(account => 
                    account.id === payload.new.id ? payload.new as PayoutAccount : account
                  )
                );
              } else if (payload.eventType === 'DELETE' && payload.old) {
                setPayoutAccounts(prev => 
                  prev.filter(account => account.id !== payload.old.id)
                );
              }
            }
          )
          .subscribe((status) => {
            console.log('Payout accounts subscription status:', status);
          });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to setup payout accounts subscription');
      }
    };

    setupRealtimeSubscription();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [session?.user?.id]);

  const fetchPayoutAccounts = async () => {
    try {
      setError(null);
      const { data, error: fetchError } = await supabase
        .from('payout_accounts')
        .select('*')
        .eq('user_id', session?.user?.id)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      setPayoutAccounts(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch payout accounts');
    } finally {
      setIsLoading(false);
    }
  };

  const addPayoutAccount = async (accountData: {
    account_name: string;
    account_number: string;
    bank_name: string;
    is_default?: boolean;
  }) => {
    try {
      setError(null);
      
      const { data, error: insertError } = await supabase
        .from('payout_accounts')
        .insert({
          user_id: session?.user?.id,
          ...accountData
        })
        .select()
        .single();

      if (insertError) throw insertError;
      
      // Real-time subscription will handle the update
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add payout account');
      throw err;
    }
  };

  const updatePayoutAccount = async (accountId: string, accountData: {
    account_name?: string;
    account_number?: string;
    bank_name?: string;
  }) => {
    try {
      setError(null);
      
      const { error: updateError } = await supabase
        .from('payout_accounts')
        .update(accountData)
        .eq('id', accountId)
        .eq('user_id', session?.user?.id);

      if (updateError) throw updateError;
      
      // Real-time subscription will handle the update
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update payout account');
      throw err;
    }
  };

  const setDefaultAccount = async (accountId: string) => {
    try {
      setError(null);
      
      // First, remove default from all accounts
      await supabase
        .from('payout_accounts')
        .update({ is_default: false })
        .eq('user_id', session?.user?.id);

      // Then set the selected account as default
      const { error: updateError } = await supabase
        .from('payout_accounts')
        .update({ is_default: true })
        .eq('id', accountId)
        .eq('user_id', session?.user?.id);

      if (updateError) throw updateError;
      
      // Real-time subscription will handle the update
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set default account');
      throw err;
    }
  };

  const deleteAccount = async (accountId: string) => {
    try {
      setError(null);
      const { error: deleteError } = await supabase
        .from('payout_accounts')
        .delete()
        .eq('id', accountId)
        .eq('user_id', session?.user?.id);

      if (deleteError) throw deleteError;
      
      // Real-time subscription will handle the update
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete account');
      throw err;
    }
  };

  return {
    payoutAccounts,
    isLoading,
    error,
    fetchPayoutAccounts,
    addPayoutAccount,
    updatePayoutAccount,
    setDefaultAccount,
    deleteAccount,
  };
}