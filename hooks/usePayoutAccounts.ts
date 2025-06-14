import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Platform } from 'react-native';

export type PayoutAccount = {
  id: string;
  user_id: string;
  account_name: string;
  account_number: string;
  bank_name: string;
  is_default: boolean;
  status: 'pending' | 'active' | 'failed';
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
      
      // For web demo, use mock data
      if (Platform.OS === 'web') {
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        setPayoutAccounts([
          {
            id: '1',
            user_id: session?.user?.id || '',
            account_name: 'John Doe',
            account_number: '0123456789',
            bank_name: 'GTBank',
            is_default: true,
            status: 'active',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          },
          {
            id: '2',
            user_id: session?.user?.id || '',
            account_name: 'John Doe',
            account_number: '9876543210',
            bank_name: 'First Bank',
            is_default: false,
            status: 'active',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          },
          {
            id: '3',
            user_id: session?.user?.id || '',
            account_name: 'John Doe',
            account_number: '5678901234',
            bank_name: 'Access Bank',
            is_default: false,
            status: 'pending',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
        ]);
        setIsLoading(false);
        return;
      }
      
      // For native platforms, use actual API
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
      
      // For web demo, use mock data
      if (Platform.OS === 'web') {
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const newAccount: PayoutAccount = {
          id: Date.now().toString(),
          user_id: session?.user?.id || '',
          account_name: accountData.account_name,
          account_number: accountData.account_number,
          bank_name: accountData.bank_name,
          is_default: accountData.is_default || payoutAccounts.length === 0,
          status: 'pending',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        
        setPayoutAccounts(prev => [newAccount, ...prev]);
        return newAccount;
      }
      
      // For native platforms, use actual API
      const { data, error: insertError } = await supabase
        .from('payout_accounts')
        .insert({
          user_id: session?.user?.id,
          ...accountData,
          status: 'pending',
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
      
      // For web demo, use mock data
      if (Platform.OS === 'web') {
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        setPayoutAccounts(prev => prev.map(account => 
          account.id === accountId 
            ? { ...account, ...accountData, updated_at: new Date().toISOString() }
            : account
        ));
        
        return;
      }
      
      // For native platforms, use actual API
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
      
      // For web demo, use mock data
      if (Platform.OS === 'web') {
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        setPayoutAccounts(prev => prev.map(account => ({
          ...account,
          is_default: account.id === accountId,
          updated_at: new Date().toISOString()
        })));
        
        return;
      }
      
      // For native platforms, use actual API
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
      
      // For web demo, use mock data
      if (Platform.OS === 'web') {
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const accountToDelete = payoutAccounts.find(a => a.id === accountId);
        const updatedAccounts = payoutAccounts.filter(a => a.id !== accountId);
        
        // If we deleted the default account and there are other accounts, make the first one default
        if (accountToDelete?.is_default && updatedAccounts.length > 0) {
          updatedAccounts[0].is_default = true;
        }
        
        setPayoutAccounts(updatedAccounts);
        return;
      }
      
      // For native platforms, use actual API
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