import { useQuery } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { financialQueryKeys } from '@/lib/queries/keys';
import { fetchTransactions, readTransactionsCache } from '@/lib/queries/transactionsQueries';
import { useHydrateFinancialCache } from '@/lib/queries/hydrateFinancialCache';
import { useLoadingGuard } from '@/hooks/useLoadingGuard';
import { toUserFacingError } from '@/lib/supabase-fetch';
import type { Transaction } from '@/hooks/useRealtimeTransactions';
export type { Transaction };

const STALE_TIME_MS = 5 * 60 * 1000;
const DEFAULT_LIMIT = 50;

export function useTransactionsQuery(limit = DEFAULT_LIMIT) {
  const { session } = useAuth();
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
    queryFn: () => fetchTransactions(userId!, limit),
    enabled: !!userId,
    staleTime: STALE_TIME_MS,
    placeholderData: (previous) => previous ?? [],
  });

  const transactions = (query.data ?? []) as Transaction[];
  const { isLoading: guardedLoading, isTimedOut } = useLoadingGuard(
    query.isLoading,
    transactions.length > 0
  );

  const fetchTransactions = useCallback(
    (fetchLimit = limit) => {
      if (fetchLimit !== limit && userId) {
        // Consumers may call fetchTransactions(customLimit); refetch current query for now.
      }
      return query.refetch();
    },
    [limit, query, userId]
  );

  return {
    ...query,
    transactions,
    isLoading: guardedLoading,
    isTimedOut,
    error: query.error ? toUserFacingError(query.error, transactions.length > 0) : null,
    fetchTransactions,
  };
}
