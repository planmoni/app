import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export type BankAccount = {
  id: string;
  user_id: string;
  bank_name: string;
  account_number: string;
  account_name: string;
  is_default: boolean;
  status: 'pending' | 'active' | 'failed';
  created_at: string;
  updated_at: string;
};

export function useBankAccounts() {
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { session } = useAuth();

  useEffect(() => {
    if (session?.user?.id) {
      fetchBankAccounts();
    }
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
    account_number: string;
    account_name: string;
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
      await fetchBankAccounts();
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
      await fetchBankAccounts();
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
      await fetchBankAccounts();
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