import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { financialQueryKeys } from '@/lib/queries/keys';
import { fetchPayoutPlans, readPayoutPlansCache } from '@/lib/queries/payoutPlansQueries';
import { useHydrateFinancialCache } from '@/lib/queries/hydrateFinancialCache';
import { useLoadingGuard } from '@/hooks/useLoadingGuard';
import { logAuthQueryGateViolation } from '@/lib/auth-telemetry';
import type { PayoutPlan } from '@/hooks/useRealtimePayoutPlans';

const STALE_TIME_MS = 5 * 60 * 1000;

export function usePayoutPlansQuery() {
  const { session, isAuthReady } = useAuth();
  const userId = session?.user?.id;
  const queryKey = useMemo(
    () => (userId ? financialQueryKeys.payoutPlans(userId) : (['payoutPlans', 'anonymous'] as const)),
    [userId]
  );

  useHydrateFinancialCache(userId, queryKey, readPayoutPlansCache);

  const query = useQuery({
    queryKey,
    queryFn: () => {
      logAuthQueryGateViolation('payoutPlans', isAuthReady, userId);
      return fetchPayoutPlans(userId!);
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
