import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { RealtimeChannel } from '@supabase/supabase-js';
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
  mono_account_id?: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
};

export function useRealtimeBankAccounts() {
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { session } = useAuth();
  const hasCachedDataRef = useRef(false);

  const fetchBankAccounts = useCallback(async () => {
    const userId = session?.user?.id;
    if (!userId) {
      setBankAccounts([]);
      setIsLoading(false);
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
      if (hasCachedDataRef.current) {
        if (__DEV__) {
          console.warn('Bank accounts refresh failed; showing cached data.');
        }
      } else {
        setError(toUserFacingError(err, false));
      }
    } finally {
      setIsLoading(false);
    }
  }, [session?.user?.id]);

  useEffect(() => {
    if (!session?.user?.id) {
      hasCachedDataRef.current = false;
      setBankAccounts([]);
      setIsLoading(false);
      return;
    }

    let channel: RealtimeChannel | null = null;
    let isMounted = true;

    const setupRealtimeSubscription = async () => {
      try {
        await fetchBankAccounts();
        if (!isMounted) return;

        const channelName = `bank-accounts-changes-${session.user.id}`;
        channel = supabase
          .channel(channelName)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'bank_accounts',
              filter: `user_id=eq.${session.user.id}`,
            },
            (payload: {
              eventType: string;
              new?: BankAccount;
              old?: { id: string };
            }) => {
              if (!isMounted) return;

              if (payload.eventType === 'INSERT' && payload.new) {
                setBankAccounts((prev) => [payload.new as BankAccount, ...prev]);
              } else if (payload.eventType === 'UPDATE' && payload.new) {
                setBankAccounts((prev) =>
                  prev.map((account) =>
                    account.id === payload.new!.id ? (payload.new as BankAccount) : account
                  )
                );
              } else if (payload.eventType === 'DELETE' && payload.old) {
                setBankAccounts((prev) =>
                  prev.filter((account) => account.id !== payload.old!.id)
                );
              }
            }
          );

        if (channel && (channel.state === 'closed' || channel.state === 'leaving')) {
          channel.subscribe(() => {});
        }
      } catch (err) {
        if (!hasCachedDataRef.current && isMounted) {
          setError(toUserFacingError(err, false));
        }
      }
    };

    setupRealtimeSubscription();

    return () => {
      isMounted = false;
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [session?.user?.id, fetchBankAccounts]);

  useRegisterForegroundRefetch(
    'bank-accounts',
    2,
    () => fetchBankAccounts(),
    !!session?.user?.id
  );

  const addBankAccount = async (accountData: {
    bank_name: string;
    bank_code?: string;
    account_number: string;
    account_name: string;
    mono_account_id?: string;
    is_default?: boolean;
  }) => {
    try {
      setError(null);
      const { data, error: insertError } = await supabase
        .from('bank_accounts')
        .insert({
          user_id: session?.user?.id,
          ...accountData,
        })
        .select()
        .single();

      if (insertError) throw insertError;
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
