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
  active_payout_plans_count?: number;
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
      
      // First, fetch payout accounts
      const { data: accounts, error: accountsError } = await supabase
        .from('payout_accounts')
        .select('*')
        .eq('user_id', session?.user?.id)
        .order('created_at', { ascending: false });

      if (accountsError) throw accountsError;

      // Then, fetch active payout plans count for each account
      const accountsWithPlanCounts = await Promise.all(
        (accounts || []).map(async (account) => {
          const { count, error: countError } = await supabase
            .from('payout_plans')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', session?.user?.id)
            .eq('payout_account_id', account.id)
            .in('status', ['active', 'pending']);

          if (countError) {
            console.error('Error fetching payout plans count for account:', account.id, countError);
            return { ...account, active_payout_plans_count: 0 };
          }

          return { ...account, active_payout_plans_count: count || 0 };
        })
      );

      setPayoutAccounts(accountsWithPlanCounts);
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
      
      // Update local state with the new account
      setPayoutAccounts(prev => [data, ...prev]);
      
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
      
      // Update local state
      setPayoutAccounts(prev => 
        prev.map(account => 
          account.id === accountId 
            ? { ...account, ...accountData, updated_at: new Date().toISOString() }
            : account
        )
      );
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
      
      // Update local state
      setPayoutAccounts(prev => 
        prev.map(account => ({
          ...account,
          is_default: account.id === accountId,
          updated_at: new Date().toISOString()
        }))
      );
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
      
      // Update local state
      setPayoutAccounts(prev => prev.filter(account => account.id !== accountId));
      
      // If we deleted the default account and there are other accounts, make the first one default
      const remainingAccounts = payoutAccounts.filter(account => account.id !== accountId);
      if (payoutAccounts.find(a => a.id === accountId)?.is_default && remainingAccounts.length > 0) {
        await setDefaultAccount(remainingAccounts[0].id);
      }
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