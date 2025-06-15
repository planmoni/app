import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { RealtimeChannel } from '@supabase/supabase-js';

export type BankAccount = {
  id: string;
  user_id: string;
  bank_name: string;
  account_number: string;
  account_name: string;
  mono_account_id?: string,
  is_default: boolean;
  status: 'pending' | 'active' | 'failed';
  created_at: string;
  updated_at: string;
};

export function useRealtimeBankAccounts() {
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { session } = useAuth();

  useEffect(() => {
    if (!session?.user?.id) return;

    let channel: RealtimeChannel;

    const setupRealtimeSubscription = async () => {
      try {
        // Initial fetch
        await fetchBankAccounts();

        // Set up real-time subscription
        channel = supabase
          .channel('bank-accounts-changes')
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'bank_accounts',
              filter: `user_id=eq.${session.user.id}`,
            },
            (payload) => {
              console.log('Bank account change received:', payload);
              
              if (payload.eventType === 'INSERT' && payload.new) {
                setBankAccounts(prev => [payload.new as BankAccount, ...prev]);
              } else if (payload.eventType === 'UPDATE' && payload.new) {
                setBankAccounts(prev => 
                  prev.map(account => 
                    account.id === payload.new.id ? payload.new as BankAccount : account
                  )
                );
              } else if (payload.eventType === 'DELETE' && payload.old) {
                setBankAccounts(prev => 
                  prev.filter(account => account.id !== payload.old.id)
                );
              }
            }
          )
          .subscribe((status) => {
            console.log('Bank accounts subscription status:', status);
          });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to setup bank accounts subscription');
      }
    };

    setupRealtimeSubscription();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [session?.user?.id]);

  const fetchBankAccounts = async () => {
    try {
      setError(null);
      const { data, error: fetchError } = await supabase
        .from('bank_accounts')
        .select('*')
        .eq('user_id', session?.user?.id)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      setBankAccounts(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch bank accounts');
    } finally {
      setIsLoading(false);
    }
  };

  const addBankAccount = async (accountData: {
    bank_name: string;
    bank_code?: string;
    account_number: string;
    account_name: string;
    mono_account_id?: string,
    is_default?: boolean;
  }) => {
    try {
      setError(null);
      const { data, error: insertError } = await supabase
        .from('bank_accounts')
        .insert({
          user_id: session?.user?.id,
          ...accountData,
          status: 'pending',
        })
        .select()
        .single();

      if (insertError) throw insertError;
      // Real-time subscription will handle the update
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add bank account');
      throw err;
    }
  };

  const setDefaultAccount = async (accountId: string) => {
    try {
      setError(null);
      
      // First, remove default from all accounts
      await supabase
        .from('bank_accounts')
        .update({ is_default: false })
        .eq('user_id', session?.user?.id);

      // Then set the selected account as default
      const { error: updateError } = await supabase
        .from('bank_accounts')
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
        .from('bank_accounts')
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
    bankAccounts,
    isLoading,
    error,
    fetchBankAccounts,
    addBankAccount,
    setDefaultAccount,
    deleteAccount,
  };
}