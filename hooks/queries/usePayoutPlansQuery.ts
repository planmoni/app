import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { financialQueryKeys, PAGE_SIZE } from '@/lib/queries/keys';
import {
  fetchPayoutPlans,
  fetchPayoutPlansPage,
  readPayoutPlansCache,
} from '@/lib/queries/payoutPlansQueries';
import { useHydrateFinancialCache } from '@/lib/queries/hydrateFinancialCache';
import { useLoadingGuard } from '@/hooks/useLoadingGuard';
import { logAuthQueryGateViolation } from '@/lib/auth-telemetry';
import type { PayoutPlan } from '@/hooks/useRealtimePayoutPlans';

const STALE_TIME_MS = 5 * 60 * 1000;

type InfinitePlansData = {
  pages: Array<{ items: PayoutPlan[]; nextPage: number | undefined }>;
  pageParams: number[];
};

async function readInfinitePlansCache(userId: string): Promise<InfinitePlansData | null> {
  const firstPage = await readPayoutPlansCache(userId);
  if (!firstPage?.length) return null;
  return {
    pages: [
      {
        items: firstPage,
        nextPage: firstPage.length >= PAGE_SIZE.payoutPlans ? 1 : undefined,
      },
    ],
    pageParams: [0],
  };
}

/** Bounded plans for home / calendar / insights. */
export function usePayoutPlansQuery(limit: number = PAGE_SIZE.payoutPlans) {
  const { session, isAuthReady } = useAuth();
  const userId = session?.user?.id;
  const queryKey = useMemo(
    () =>
      userId
        ? ([...financialQueryKeys.payoutPlans(userId), limit] as const)
        : (['payoutPlans', 'anonymous', limit] as const),
    [userId, limit]
  );

  useHydrateFinancialCache(userId, queryKey, readPayoutPlansCache);

  const query = useQuery({
    queryKey,
    queryFn: () => {
      logAuthQueryGateViolation('payoutPlans', isAuthReady, userId);
      return fetchPayoutPlans(userId!, limit);
    },
    enabled: isAuthReady && !!userId,
    staleTime: STALE_TIME_MS,
    placeholderData: (previous) => previous ?? [],
  });

  const payoutPlans = (query.data ?? []) as PayoutPlan[];
  const { isLoading: guardedLoading, isTimedOut } = useLoadingGuard(
    query.isLoading,
    payoutPlans.length > 0
  );

  return {
    ...query,
    payoutPlans,
    isLoading: guardedLoading,
    isTimedOut,
    error: query.error instanceof Error ? query.error.message : query.error ? String(query.error) : null,
    fetchPayoutPlans: query.refetch,
  };
}

/** Infinite owned plans for All Payouts. */
export function useInfinitePayoutPlansQuery() {
  const { session, isAuthReady } = useAuth();
  const userId = session?.user?.id;
  const queryKey = useMemo(
    () =>
      userId
        ? financialQueryKeys.payoutPlansInfinite(userId)
        : (['payoutPlans', 'infinite', 'anonymous'] as const),
    [userId]
  );

  useHydrateFinancialCache(userId, queryKey, readInfinitePlansCache);

  const query = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam = 0 }) => {
      logAuthQueryGateViolation('payoutPlansInfinite', isAuthReady, userId);
      return fetchPayoutPlansPage(userId!, pageParam, PAGE_SIZE.payoutPlans);
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextPage,
    enabled: isAuthReady && !!userId,
    staleTime: STALE_TIME_MS,
  });

  const payoutPlans = useMemo(
    () => (query.data?.pages ?? []).flatMap((p) => p.items),
    [query.data]
  );

  const { isLoading: guardedLoading, isTimedOut } = useLoadingGuard(
    query.isLoading,
    payoutPlans.length > 0
  );

  return {
    payoutPlans,
    isLoading: guardedLoading,
    isTimedOut,
    isFetchingNextPage: query.isFetchingNextPage,
    hasNextPage: !!query.hasNextPage,
    fetchNextPage: query.fetchNextPage,
    refetch: query.refetch,
    fetchPayoutPlans: query.refetch,
    error: query.error instanceof Error ? query.error.message : query.error ? String(query.error) : null,
  };
}
