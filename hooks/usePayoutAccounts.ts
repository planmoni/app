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

export type PayoutAccount = {
  id: string;
  user_id: string;
  account_name: string;
  account_number: string;
  bank_name: string;
  bank_code?: string | null;
  safehaven_bank_code?: string | null;
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
  const hasCachedDataRef = useRef(false);

  const enrichPlanCounts = useCallback(
    async (accounts: PayoutAccount[], userId: string) => {
      const enriched = await Promise.all(
        accounts.map(async (account) => {
          try {
            const { count, error: countError } = await fetchWithRetry(
              () =>
                supabase
                  .from('payout_plans')
                  .select('*', { count: 'exact', head: true })
                  .eq('user_id', userId)
                  .eq('payout_account_id', account.id)
                  .in('status', ['active', 'paused']),
              `Payout plans count (${account.id})`
            );

            if (countError) {
              return { ...account, active_payout_plans_count: 0 };
            }
            return { ...account, active_payout_plans_count: count ?? 0 };
          } catch {
            return { ...account, active_payout_plans_count: 0 };
          }
        })
      );

      setPayoutAccounts(enriched);
      void writeCache(CACHE_KEYS.payoutAccounts(userId), enriched);
    },
    []
  );

  const fetchPayoutAccounts = useCallback(async () => {
    const userId = session?.user?.id;
    if (!userId) {
      setPayoutAccounts([]);
      setIsLoading(false);
      return;
    }

    try {
      if (!hasCachedDataRef.current) {
        setIsLoading(true);
      }
      setError(null);

      const { data: accounts, error: accountsError } = (await fetchWithRetry(
        () =>
          supabase
            .from('payout_accounts')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false }),
        'Payout accounts fetch'
      )) as { data: PayoutAccount[] | null; error: { message?: string } | null };

      if (accountsError) throw accountsError;

      const baseAccounts: PayoutAccount[] = (accounts || []).map((account) => ({
        ...account,
        active_payout_plans_count: 0,
      }));

      setPayoutAccounts(baseAccounts);
      hasCachedDataRef.current = baseAccounts.length > 0;
      void writeCache(CACHE_KEYS.payoutAccounts(userId), baseAccounts);

      if (baseAccounts.length > 0) {
        void enrichPlanCounts(baseAccounts, userId);
      }
    } catch (err) {
      console.warn('Error fetching payout accounts:', err);
      if (!hasCachedDataRef.current) {
        setError(toUserFacingError(err, false));
      }
    } finally {
      setIsLoading(false);
    }
  }, [session?.user?.id, enrichPlanCounts]);

  useEffect(() => {
    if (!session?.user?.id) {
      hasCachedDataRef.current = false;
      setPayoutAccounts([]);
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    const init = async () => {
      const cached = await readCache<PayoutAccount[]>(CACHE_KEYS.payoutAccounts(session.user.id));
      if (cached?.length && isMounted) {
        setPayoutAccounts(cached);
        setIsLoading(false);
        hasCachedDataRef.current = true;
      }

      if (!isMounted) return;
      await fetchPayoutAccounts();
    };

    void init();

    return () => {
      isMounted = false;
    };
  }, [session?.user?.id, fetchPayoutAccounts]);

  useRegisterForegroundRefetch('payout-accounts', 3, fetchPayoutAccounts, !!session?.user?.id);

  const getProfileFullName = async (): Promise<string | null> => {
    const metaName = session?.user?.user_metadata?.full_name;
    if (metaName && typeof metaName === 'string' && metaName.trim().length > 0) {
      return metaName.trim();
    }

    if (!session?.user?.id) return null;
    const { data, error: profileError } = await supabase
      .from('profiles')
      .select('full_name, first_name, last_name')
      .eq('id', session.user.id)
      .maybeSingle();

    if (profileError) {
      console.warn('Error fetching profile full_name for payout validation:', profileError);
      return null;
    }

    const combined =
      data?.full_name && data.full_name.trim().length > 0
        ? data.full_name.trim()
        : `${data?.first_name || ''} ${data?.last_name || ''}`.trim();

    return combined.length > 0 ? combined : null;
  };

  const normalizeTokens = (value: string | null | undefined) => {
    if (!value) return [] as string[];
    return value
      .split(/\s+/)
      .map((t) => t.trim().toLowerCase().replace(/[^a-z0-9]/g, ''))
      .filter(Boolean);
  };

  const addPayoutAccount = async (accountData: {
    account_name: string;
    account_number: string;
    bank_name: string;
    bank_code?: string;
    safehaven_bank_code?: string;
    is_default?: boolean;
  }) => {
    try {
      setError(null);

      if (!session?.user?.id) {
        const msg = 'User not authenticated';
        setError(msg);
        throw new Error(msg);
      }

      if (payoutAccounts.length >= 3) {
        const msg = 'You can only add up to 3 payout accounts. Please remove one to add another.';
        setError(msg);
        throw new Error(msg);
      }

      const profileFullName = await getProfileFullName();
      const profileTokens = normalizeTokens(profileFullName);

      const { data: existingAccount, error: checkError } = await supabase
        .from('payout_accounts')
        .select('id, account_number, bank_name')
        .eq('user_id', session.user.id)
        .eq('account_number', accountData.account_number.trim())
        .eq('bank_name', accountData.bank_name.trim())
        .maybeSingle();

      if (checkError) throw checkError;

      if (existingAccount) {
        const errorMessage = `This account (${accountData.account_number.slice(-4)}) at ${accountData.bank_name} already exists in your payout accounts.`;
        setError(errorMessage);
        throw new Error(errorMessage);
      }

      const accountNameTokens = normalizeTokens(accountData.account_name);

      if (profileTokens.length > 0 && accountNameTokens.length > 0) {
        const profileSet = new Set(profileTokens);
        const matches = accountNameTokens.filter((tok) => profileSet.has(tok));
        if (matches.length < 2) {
          const msg = 'The payout account does not match your name, please contact support';
          setError(msg);
          throw new Error(msg);
        }
      }

      const { data, error: insertError } = await supabase
        .from('payout_accounts')
        .insert({
          user_id: session.user.id,
          ...accountData,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      setPayoutAccounts((prev) => {
        const next = [data, ...prev];
        void writeCache(CACHE_KEYS.payoutAccounts(session.user.id), next);
        return next;
      });

      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to add payout account';
      setError(errorMessage);
      throw err;
    }
  };

  const updatePayoutAccount = async (
    accountId: string,
    accountData: {
      account_name?: string;
      account_number?: string;
      bank_name?: string;
    }
  ) => {
    try {
      setError(null);

      const { error: updateError } = await supabase
        .from('payout_accounts')
        .update(accountData)
        .eq('id', accountId)
        .eq('user_id', session?.user?.id);

      if (updateError) throw updateError;

      setPayoutAccounts((prev) =>
        prev.map((account) =>
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

      await supabase
        .from('payout_accounts')
        .update({ is_default: false })
        .eq('user_id', session?.user?.id);

      const { error: updateError } = await supabase
        .from('payout_accounts')
        .update({ is_default: true })
        .eq('id', accountId)
        .eq('user_id', session?.user?.id);

      if (updateError) throw updateError;

      setPayoutAccounts((prev) =>
        prev.map((account) => ({
          ...account,
          is_default: account.id === accountId,
          updated_at: new Date().toISOString(),
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

      const remainingAccounts = payoutAccounts.filter((account) => account.id !== accountId);
      setPayoutAccounts(remainingAccounts);
      if (session?.user?.id) {
        void writeCache(CACHE_KEYS.payoutAccounts(session.user.id), remainingAccounts);
      }

      if (payoutAccounts.find((a) => a.id === accountId)?.is_default && remainingAccounts.length > 0) {
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
