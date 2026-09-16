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
import { withTimeout } from '@/lib/with-timeout';
import { timedOperation } from '@/lib/supabase-timing';
import { isFinancialMutationActive } from '@/lib/financial-mutation-gate';

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
  /** All payout plans referencing this account (any status). */
  linked_payout_plans_count?: number;
};

export function payoutAccountDeleteErrorMessage(error: unknown): string {
  if (error && typeof error === 'object') {
    const code = 'code' in error ? String((error as { code?: string }).code) : '';
    const message =
      'message' in error && typeof (error as { message?: string }).message === 'string'
        ? (error as { message: string }).message
        : '';
    const lower = message.toLowerCase();

    if (
      lower.includes('active or paused payout plan') ||
      code === '23514' ||
      message.includes('payout_plans_account_check')
    ) {
      return ACTIVE_PLAN_BLOCK_MESSAGE;
    }
    if (
      code === '23503' ||
      lower.includes('foreign key') ||
      lower.includes('emergency_withdrawals') ||
      lower.includes('vault_payout_schedules')
    ) {
      return 'This account is still linked to withdrawal history. Please try again in a moment.';
    }
    if (message.includes('safe_delete_payout_account') && lower.includes('does not exist')) {
      return 'Account removal is not available yet. Please update the app or try again shortly.';
    }
    if (message) return message;
  }
  if (error instanceof Error) return error.message;
  return 'Failed to remove account';
}

const IN_USE_PLAN_STATUSES = ['active', 'paused'] as const;

const ACTIVE_PLAN_BLOCK_MESSAGE =
  'This account is used by an active or paused payout plan and cannot be removed.';

async function countActivePlanLinks(accountId: string, userId: string): Promise<number> {
  const [plansResult, schedulesResult] = await Promise.all([
    withTimeout(
      supabase
        .from('payout_plans')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('payout_account_id', accountId)
        .in('status', [...IN_USE_PLAN_STATUSES]),
      10000,
      'Active payout plan check'
    ),
    withTimeout(
      supabase
        .from('vault_payout_schedules')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('payout_account_id', accountId)
        .in('status', [...IN_USE_PLAN_STATUSES]),
      10000,
      'Active vault schedule check'
    ),
  ]);

  const plansCount = (plansResult as { count: number | null }).count ?? 0;
  const schedulesCount = (schedulesResult as { count: number | null }).count ?? 0;
  return plansCount + schedulesCount;
}

function tallyPlanLinks(
  plans: { payout_account_id: string | null; status: string }[] | null,
  schedules: { payout_account_id: string | null; status: string }[] | null
) {
  const tallies = new Map<string, { active: number; linked: number }>();

  const add = (accountId: string | null, status: string) => {
    if (!accountId) return;
    const entry = tallies.get(accountId) ?? { active: 0, linked: 0 };
    entry.linked += 1;
    if (status === 'active' || status === 'paused') {
      entry.active += 1;
    }
    tallies.set(accountId, entry);
  };

  plans?.forEach((plan) => add(plan.payout_account_id, plan.status));
  schedules?.forEach((schedule) => add(schedule.payout_account_id, schedule.status));

  return tallies;
}

export function usePayoutAccounts() {
  const [payoutAccounts, setPayoutAccounts] = useState<PayoutAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFresh, setIsFresh] = useState(false);
  const [lastFetchedAt, setLastFetchedAt] = useState<number | null>(null);
  const { session, isAuthReady } = useAuth();
  const hasCachedDataRef = useRef(false);
  const fetchInFlightRef = useRef(false);
  const fetchStartedAtRef = useRef(0);
  const FETCH_STALE_MS = 20000;

  const hydrateFromCache = useCallback(async (userId: string): Promise<boolean> => {
    const cached = await readCache<PayoutAccount[]>(CACHE_KEYS.payoutAccounts(userId));
    if (!Array.isArray(cached)) return false;

    setPayoutAccounts(cached);
    hasCachedDataRef.current = true;
    setIsFresh(false);
    setIsLoading(false);
    return true;
  }, []);

  const enrichPlanCounts = useCallback(
    async (accounts: PayoutAccount[], userId: string) => {
      try {
        const [plansResult, schedulesResult] = await Promise.all([
          fetchWithRetry(
            () =>
              supabase
                .from('payout_plans')
                .select('payout_account_id, status')
                .eq('user_id', userId)
                .not('payout_account_id', 'is', null),
            'Payout plan links'
          ),
          fetchWithRetry(
            () =>
              supabase
                .from('vault_payout_schedules')
                .select('payout_account_id, status')
                .eq('user_id', userId)
                .not('payout_account_id', 'is', null),
            'Vault payout schedule links'
          ),
        ]);

        const plans = (plansResult as { data: { payout_account_id: string | null; status: string }[] | null })
          .data;
        const schedules = (
          schedulesResult as { data: { payout_account_id: string | null; status: string }[] | null }
        ).data;
        const tallies = tallyPlanLinks(plans, schedules);

        const enriched = accounts.map((account) => {
          const counts = tallies.get(account.id) ?? { active: 0, linked: 0 };
          return {
            ...account,
            active_payout_plans_count: counts.active,
            linked_payout_plans_count: counts.linked,
          };
        });

        setPayoutAccounts(enriched);
        void writeCache(CACHE_KEYS.payoutAccounts(userId), enriched);
      } catch {
        // Keep accounts visible even if plan link counts fail.
      }
    },
    []
  );

  const fetchPayoutAccounts = useCallback(async () => {
    const userId = session?.user?.id;
    if (!userId || !isAuthReady) {
      if (!userId) {
        setPayoutAccounts([]);
        setIsLoading(false);
      }
      return;
    }

    // Don't compete with create-payout / other money mutations
    if (isFinancialMutationActive()) {
      return;
    }

    if (
      fetchInFlightRef.current &&
      Date.now() - fetchStartedAtRef.current < FETCH_STALE_MS
    ) {
      return;
    }
    fetchInFlightRef.current = true;
    fetchStartedAtRef.current = Date.now();

    await hydrateFromCache(userId);

    try {
      if (!hasCachedDataRef.current) {
        setIsLoading(true);
      }
      setError(null);

      const { data: accounts, error: accountsError } = await timedOperation(
        'db.payout_accounts',
        async () =>
          (await fetchWithRetry(
            () =>
              supabase
                .from('payout_accounts')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false }),
            'Payout accounts fetch',
            { timeoutMs: 8000, retryDelayMs: 400, maxRetries: 0 }
          )) as { data: PayoutAccount[] | null; error: { message?: string } | null },
        {
          userId,
          hasSession: true,
          sessionExpiresAt: session?.expires_at ?? null,
        }
      );

      if (accountsError) throw accountsError;

      const baseAccounts: PayoutAccount[] = (accounts || []).map((account) => ({
        ...account,
        active_payout_plans_count: 0,
        linked_payout_plans_count: 0,
      }));

      setPayoutAccounts(baseAccounts);
      hasCachedDataRef.current = true;
      setIsFresh(true);
      setLastFetchedAt(Date.now());
      setError(null);
      void writeCache(CACHE_KEYS.payoutAccounts(userId), baseAccounts);

      if (baseAccounts.length > 0) {
        void enrichPlanCounts(baseAccounts, userId);
      }
    } catch (err) {
      console.warn('Error fetching payout accounts:', err);
      setIsFresh(false);
      setError(toUserFacingError(err, hasCachedDataRef.current));
    } finally {
      setIsLoading(false);
      fetchInFlightRef.current = false;
    }
  }, [session?.user?.id, session?.expires_at, isAuthReady, enrichPlanCounts, hydrateFromCache]);

  useEffect(() => {
    if (!session?.user?.id || !isAuthReady) {
      if (!session?.user?.id) {
        hasCachedDataRef.current = false;
        setPayoutAccounts([]);
        setIsLoading(false);
      }
      return;
    }

    let isMounted = true;

    const init = async () => {
      await hydrateFromCache(session.user.id);
      if (!isMounted) return;
      await fetchPayoutAccounts();
    };

    void init();

    return () => {
      isMounted = false;
    };
  }, [session?.user?.id, isAuthReady, fetchPayoutAccounts, hydrateFromCache]);

  useRegisterForegroundRefetch('payout-accounts', 3, fetchPayoutAccounts, !!session?.user?.id && isAuthReady);

  useEffect(() => {
    if (!isLoading || payoutAccounts.length > 0) return;
    const timer = setTimeout(() => setIsLoading(false), 10000);
    return () => clearTimeout(timer);
  }, [isLoading, payoutAccounts.length]);

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

      const profileFullName = await withTimeout(
        getProfileFullName(),
        10000,
        'Profile name lookup'
      );
      const profileTokens = normalizeTokens(profileFullName);

      const { data: existingAccount, error: checkError } = await withTimeout(
        supabase
          .from('payout_accounts')
          .select('id, account_number, bank_name')
          .eq('user_id', session.user.id)
          .eq('account_number', accountData.account_number.trim())
          .eq('bank_name', accountData.bank_name.trim())
          .maybeSingle(),
        15000,
        'Check existing payout account'
      );

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

      const { data, error: insertError } = await withTimeout(
        supabase
          .from('payout_accounts')
          .insert({
            user_id: session.user.id,
            ...accountData,
          })
          .select()
          .single(),
        15000,
        'Add payout account'
      );

      if (insertError) throw insertError;

      setPayoutAccounts((prev) => {
        const next = [data, ...prev];
        void writeCache(CACHE_KEYS.payoutAccounts(session.user.id), next);
        return next;
      });

      return data;
    } catch (err) {
      const raw =
        err && typeof err === 'object' && 'message' in err && typeof (err as { message?: string }).message === 'string'
          ? (err as { message: string }).message
          : err instanceof Error
            ? err.message
            : '';
      const lower = raw.toLowerCase();
      let errorMessage = toUserFacingError(err, false);

      if (lower.includes('does not match your name')) {
        errorMessage = 'The payout account does not match your name, please contact support';
      } else if (lower.includes('profiles') || lower.includes('user_id_fkey')) {
        errorMessage = 'Your profile is incomplete. Please restart the app and try again.';
      } else if (lower.includes('duplicate') || lower.includes('unique')) {
        errorMessage = 'This payout account already exists.';
      }

      setError(errorMessage);
      throw new Error(errorMessage);
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

      const userId = session?.user?.id;
      if (!userId) {
        throw new Error('User not authenticated');
      }

      const account = payoutAccounts.find((a) => a.id === accountId);
      if ((account?.active_payout_plans_count ?? 0) > 0) {
        setError(ACTIVE_PLAN_BLOCK_MESSAGE);
        throw new Error(ACTIVE_PLAN_BLOCK_MESSAGE);
      }

      const activeLinks = await countActivePlanLinks(accountId, userId);
      if (activeLinks > 0) {
        setError(ACTIVE_PLAN_BLOCK_MESSAGE);
        throw new Error(ACTIVE_PLAN_BLOCK_MESSAGE);
      }

      const { error: deleteError } = (await withTimeout(
        supabase.rpc('safe_delete_payout_account', { p_account_id: accountId }),
        15000,
        'Remove payout account'
      )) as { error: { message?: string; code?: string } | null };

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
      const message = payoutAccountDeleteErrorMessage(err);
      setError(message);
      throw new Error(message);
    }
  };

  return {
    payoutAccounts,
    isLoading,
    error,
    isFresh,
    lastFetchedAt,
    fetchPayoutAccounts,
    addPayoutAccount,
    updatePayoutAccount,
    setDefaultAccount,
    deleteAccount,
  };
}
