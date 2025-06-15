import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

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

export function usePayoutAccounts() {
  const [payoutAccounts, setPayoutAccounts] = useState<PayoutAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { session } = useAuth();

  useEffect(() => {
    if (session?.user?.id) {
      fetchPayoutAccounts();
    }
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
      await fetchPayoutAccounts();
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
      await fetchPayoutAccounts();
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
      await fetchPayoutAccounts();
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
      await fetchPayoutAccounts();
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