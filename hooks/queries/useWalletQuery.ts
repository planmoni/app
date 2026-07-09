import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { financialQueryKeys } from '@/lib/queries/keys';
import { fetchWallet, readWalletCache, type WalletData } from '@/lib/queries/walletQueries';
import { useHydrateFinancialCache } from '@/lib/queries/hydrateFinancialCache';
import { useLoadingGuard } from '@/hooks/useLoadingGuard';
import { logAuthQueryGateViolation } from '@/lib/auth-telemetry';

const STALE_TIME_MS = 5 * 60 * 1000;

export function useWalletQuery() {
  const { session, isAuthReady } = useAuth();
  const userId = session?.user?.id;
  const queryClient = useQueryClient();
  const queryKey = useMemo(
    () => (userId ? financialQueryKeys.wallet(userId) : (['wallet', 'anonymous'] as const)),
    [userId]
  );

  useHydrateFinancialCache(userId, queryKey, readWalletCache);

  const query = useQuery({
    queryKey,
    queryFn: () => {
      logAuthQueryGateViolation('wallet', isAuthReady, userId);
      return fetchWallet(userId!);
    },
    enabled: isAuthReady && !!userId,
    staleTime: STALE_TIME_MS,
    placeholderData: (previous) => previous,
  });

  const hasData = query.data !== undefined;
  const { isLoading: guardedLoading, isTimedOut } = useLoadingGuard(
    query.isLoading,
    hasData
  );

  const refreshWallet = useCallback(async () => {
    if (!userId) return null;
    const result = await query.refetch();
    const data = result.data;
    if (!data) return null;
    return {
      balance: data.balance,
      lockedBalance: data.lockedBalance,
      availableBalance: data.availableBalance,
    };
  }, [userId, query]);

  return {
    ...query,
    balance: query.data?.balance ?? 0,
    lockedBalance: query.data?.lockedBalance ?? 0,
    availableBalance: query.data?.availableBalance ?? 0,
    isLoading: guardedLoading,
    isTimedOut,
    error: query.error ? 'Failed to load wallet data' : null,
    refreshWallet,
    setWalletData: (data: WalletData) => {
      if (userId) queryClient.setQueryData(financialQueryKeys.wallet(userId), data);
    },
  };
}
