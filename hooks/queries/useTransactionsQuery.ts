import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { financialQueryKeys, PAGE_SIZE } from '@/lib/queries/keys';
import {
  fetchTransactions as fetchTransactionsFromApi,
  fetchTransactionsPage,
  readTransactionsCache,
} from '@/lib/queries/transactionsQueries';
import { useHydrateFinancialCache } from '@/lib/queries/hydrateFinancialCache';
import { useLoadingGuard } from '@/hooks/useLoadingGuard';
import { toUserFacingError } from '@/lib/supabase-fetch';
import { logAuthQueryGateViolation } from '@/lib/auth-telemetry';
import type { Transaction } from '@/hooks/useRealtimeTransactions';
export type { Transaction };

const STALE_TIME_MS = 5 * 60 * 1000;

type InfiniteTxData = {
  pages: Array<{ items: Transaction[]; nextPage: number | undefined }>;
  pageParams: number[];
};

async function readInfiniteTxCache(userId: string): Promise<InfiniteTxData | null> {
  const firstPage = await readTransactionsCache(userId);
  if (!firstPage?.length) return null;
  return {
    pages: [
      {
        items: firstPage,
        nextPage: firstPage.length === PAGE_SIZE.transactions ? 1 : undefined,
      },
    ],
    pageParams: [0],
  };
}

/**
 * Bounded list for home / insights / calendar summaries.
 * Prefer a small limit (default PAGE_SIZE.transactions).
 */
export function useTransactionsQuery(limit: number = PAGE_SIZE.transactions) {
  const { session, isAuthReady } = useAuth();
  const userId = session?.user?.id;
  const queryKey = useMemo(
    () =>
      userId
        ? financialQueryKeys.transactions(userId, limit)
        : (['transactions', 'anonymous', limit] as const),
    [userId, limit]
  );

  useHydrateFinancialCache(userId, queryKey, readTransactionsCache);

  const query = useQuery({
    queryKey,
    queryFn: () => {
      logAuthQueryGateViolation('transactions', isAuthReady, userId);
      return fetchTransactionsFromApi(userId!, limit);
    },
    enabled: isAuthReady && !!userId,
    staleTime: STALE_TIME_MS,
    placeholderData: (previous) => previous ?? [],
  });

  const transactions = (query.data ?? []) as Transaction[];
  const { isLoading: guardedLoading, isTimedOut } = useLoadingGuard(
    query.isLoading,
    transactions.length > 0
  );

  const fetchTransactions = useCallback(() => query.refetch(), [query]);

  return {
    ...query,
    transactions,
    isLoading: guardedLoading,
    isTimedOut,
    error: query.error ? toUserFacingError(query.error, transactions.length > 0) : null,
    fetchTransactions,
  };
}

/** Infinite list for the All Transactions screen. */
export function useInfiniteTransactionsQuery() {
  const { session, isAuthReady } = useAuth();
  const userId = session?.user?.id;
  const queryKey = useMemo(
    () =>
      userId
        ? financialQueryKeys.transactionsInfinite(userId)
        : (['transactions', 'infinite', 'anonymous'] as const),
    [userId]
  );

  useHydrateFinancialCache(userId, queryKey, readInfiniteTxCache);

  const query = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam = 0 }) => {
      logAuthQueryGateViolation('transactionsInfinite', isAuthReady, userId);
      return fetchTransactionsPage(userId!, pageParam, PAGE_SIZE.transactions);
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextPage,
    enabled: isAuthReady && !!userId,
    staleTime: STALE_TIME_MS,
  });

  const transactions = useMemo(
    () => (query.data?.pages ?? []).flatMap((p) => p.items),
    [query.data]
  );

  const { isLoading: guardedLoading, isTimedOut } = useLoadingGuard(
    query.isLoading,
    transactions.length > 0
  );

  return {
    transactions,
    isLoading: guardedLoading,
    isTimedOut,
    isFetchingNextPage: query.isFetchingNextPage,
    hasNextPage: !!query.hasNextPage,
    fetchNextPage: query.fetchNextPage,
    refetch: query.refetch,
    error: query.error ? toUserFacingError(query.error, transactions.length > 0) : null,
  };
}
