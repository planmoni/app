import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { financialQueryKeys } from '@/lib/queries/keys';
import {
  fetchWallet,
  readWalletCache,
  writeWalletCache,
  type WalletData,
} from '@/lib/queries/walletQueries';
import { useHydrateFinancialCache } from '@/lib/queries/hydrateFinancialCache';
import { useLoadingGuard } from '@/hooks/useLoadingGuard';
import { logAuthQueryGateViolation } from '@/lib/auth-telemetry';

/** Wallet is money — never treat it as "fresh for 5 minutes". */
const WALLET_STALE_MS = 0;
/** Background poll while screen is focused / app active. */
const WALLET_POLL_MS = 15_000;

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
    staleTime: WALLET_STALE_MS,
    gcTime: 30 * 60 * 1000,
    refetchOnMount: 'always',
    refetchOnReconnect: true,
    refetchOnWindowFocus: true,
    refetchInterval: WALLET_POLL_MS,
    refetchIntervalInBackground: false,
    placeholderData: (previous) => previous,
    networkMode: 'online',
  });

  const hasData = query.data !== undefined;
  const { isLoading: guardedLoading, isTimedOut } = useLoadingGuard(
    query.isLoading,
    hasData
  );

  /** Forced network refetch — pulls latest DB row, updates memory + disk cache. */
  const refreshWallet = useCallback(async () => {
    if (!userId) return null;
    try {
      const data = await queryClient.fetchQuery({
        queryKey: financialQueryKeys.wallet(userId),
        queryFn: () => fetchWallet(userId),
        staleTime: 0,
      });
      return {
        balance: data.balance,
        lockedBalance: data.lockedBalance,
        availableBalance: data.availableBalance,
      };
    } catch (err) {
      console.warn('refreshWallet failed:', err);
      // Fall back to any existing cache so UI can still render
      const cached = queryClient.getQueryData<WalletData>(financialQueryKeys.wallet(userId));
      if (cached) {
        return {
          balance: cached.balance,
          lockedBalance: cached.lockedBalance,
          availableBalance: cached.availableBalance,
        };
      }
      return null;
    }
  }, [userId, queryClient]);

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
      if (!userId) return;
      queryClient.setQueryData(financialQueryKeys.wallet(userId), data);
      void writeWalletCache(userId, data);
    },
  };
}
