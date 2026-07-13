import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useRegisterForegroundRefetch } from '@/hooks/useForegroundRefreshCoordinator';
import {
  fetchWithRetry,
  CACHE_KEYS,
  readCache,
  writeCache,
  toUserFacingError,
} from '@/lib/supabase-fetch';

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
  const { session, isAuthReady } = useAuth();
  const hasCachedDataRef = useRef(false);

  const fetchBankAccounts = useCallback(async () => {
    const userId = session?.user?.id;
    if (!userId || !isAuthReady) {
      if (!userId) setIsLoading(false);
      return;
    }

    if (!hasCachedDataRef.current) {
      const cached = await readCache<BankAccount[]>(CACHE_KEYS.bankAccounts(userId));
      if (cached !== null) {
        setBankAccounts(cached);
        setIsLoading(false);
        hasCachedDataRef.current = true;
      }
    }

    try {
      if (!hasCachedDataRef.current) {
        setIsLoading(true);
      }
      setError(null);

      const { data, error: fetchError } = (await fetchWithRetry(
        () =>
          supabase
            .from('bank_accounts')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false }),
        'Bank accounts fetch'
      )) as { data: BankAccount[] | null; error: { message?: string } | null };

      if (fetchError) throw fetchError;

      const accounts = data || [];
      setBankAccounts(accounts);
      hasCachedDataRef.current = true;
      void writeCache(CACHE_KEYS.bankAccounts(userId), accounts);
    } catch (err) {
      if (!hasCachedDataRef.current) {
        setError(toUserFacingError(err, false));
      }
    } finally {
      setIsLoading(false);
    }
  }, [session?.user?.id, isAuthReady]);

  useEffect(() => {
    if (!session?.user?.id || !isAuthReady) {
      if (!session?.user?.id) {
        hasCachedDataRef.current = false;
        setBankAccounts([]);
        setIsLoading(false);
      }
      return;
    }
    void fetchBankAccounts();
  }, [session?.user?.id, isAuthReady, fetchBankAccounts]);

  useRegisterForegroundRefetch(
    'bank-accounts-static',
    2,
    () => fetchBankAccounts(),
    !!session?.user?.id && isAuthReady
  );

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

      await supabase
        .from('bank_accounts')
        .update({ is_default: false })
        .eq('user_id', session?.user?.id);

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
