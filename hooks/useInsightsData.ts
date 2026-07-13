import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { formatPayoutDateTime } from '@/lib/formatters';
import { useLoadingGuard } from '@/hooks/useLoadingGuard';
import { CACHE_KEYS, readCache, writeCache } from '@/lib/supabase-fetch';
import type { Transaction } from '@/hooks/useRealtimeTransactions';

export type Metric = {
  title: string;
  value: string;
  change: string;
  positive: boolean;
  icon: any;
  description: string;
};

export type Trend = {
  title: string;
  value: string;
  description: string;
  positive: boolean;
  details: { label: string; value: string }[];
};

export type VaultStat = {
  title: string;
  total: string;
  progress: string;
  nextPayout: string;
  status: string;
};

export function useInsightsData(
  payoutPlans: any[] = [],
  transactions: Transaction[] = [],
  transactionsLoading = false
) {
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [trends, setTrends] = useState<Trend[]>([]);
  const [vaultStats, setVaultStats] = useState<VaultStat[]>([]);
  const [error, setError] = useState<string | null>(null);
  const { session, isAuthReady } = useAuth();
  const hasCachedDataRef = useRef(false);
  const userId = session?.user?.id;

  const computeInsights = useCallback(
    (txs: Transaction[], plans: any[]) => {
      try {
        setError(null);

        const totalPayouts =
          txs
            ?.filter((t) => t.type === 'payout' && t.status === 'completed')
            .reduce((sum, t) => sum + Number(t.amount), 0) || 0;

        const totalDeposits =
          txs
            ?.filter((t) => t.type === 'deposit' && t.status === 'completed')
            .reduce((sum, t) => sum + Number(t.amount), 0) || 0;

        const activePlans = plans?.filter((p) => p.status === 'active').length || 0;
        const totalTransactions = txs?.length || 0;

        const currentDate = new Date();
        const currentMonth = currentDate.getMonth();
        const currentYear = currentDate.getFullYear();

        let lastMonth = currentMonth - 1;
        let lastYear = currentYear;
        if (lastMonth < 0) {
          lastMonth = 11;
          lastYear = currentYear - 1;
        }

        const currentMonthPayouts =
          txs
            ?.filter((t) => {
              const txDate = new Date(t.created_at);
              return (
                t.type === 'payout' &&
                t.status === 'completed' &&
                txDate.getMonth() === currentMonth &&
                txDate.getFullYear() === currentYear
              );
            })
            .reduce((sum, t) => sum + Number(t.amount), 0) || 0;

        const lastMonthPayouts =
          txs
            ?.filter((t) => {
              const txDate = new Date(t.created_at);
              return (
                t.type === 'payout' &&
                t.status === 'completed' &&
                txDate.getMonth() === lastMonth &&
                txDate.getFullYear() === lastYear
              );
            })
            .reduce((sum, t) => sum + Number(t.amount), 0) || 0;

        let payoutGrowthPercentage = 0;
        if (lastMonthPayouts > 0) {
          payoutGrowthPercentage =
            ((currentMonthPayouts - lastMonthPayouts) / lastMonthPayouts) * 100;
        } else if (currentMonthPayouts > 0) {
          payoutGrowthPercentage = 100;
        }

        const currentMonthDeposits =
          txs
            ?.filter((t) => {
              const txDate = new Date(t.created_at);
              return (
                t.type === 'deposit' &&
                t.status === 'completed' &&
                txDate.getMonth() === currentMonth &&
                txDate.getFullYear() === currentYear
              );
            })
            .reduce((sum, t) => sum + Number(t.amount), 0) || 0;

        const lastMonthDeposits =
          txs
            ?.filter((t) => {
              const txDate = new Date(t.created_at);
              return (
                t.type === 'deposit' &&
                t.status === 'completed' &&
                txDate.getMonth() === lastMonth &&
                txDate.getFullYear() === lastYear
              );
            })
            .reduce((sum, t) => sum + Number(t.amount), 0) || 0;

        let depositGrowthPercentage = 0;
        if (lastMonthDeposits > 0) {
          depositGrowthPercentage =
            ((currentMonthDeposits - lastMonthDeposits) / lastMonthDeposits) * 100;
        } else if (currentMonthDeposits > 0) {
          depositGrowthPercentage = 100;
        }

        const currentMonthTransactionCount =
          txs?.filter((t) => {
            const txDate = new Date(t.created_at);
            return txDate.getMonth() === currentMonth && txDate.getFullYear() === currentYear;
          }).length || 0;

        const lastMonthTransactionCount =
          txs?.filter((t) => {
            const txDate = new Date(t.created_at);
            return txDate.getMonth() === lastMonth && txDate.getFullYear() === lastYear;
          }).length || 0;

        let transactionGrowthPercentage = 0;
        if (lastMonthTransactionCount > 0) {
          transactionGrowthPercentage =
            ((currentMonthTransactionCount - lastMonthTransactionCount) /
              lastMonthTransactionCount) *
            100;
        } else if (currentMonthTransactionCount > 0) {
          transactionGrowthPercentage = 100;
        }

        const currentMonthNetActivity = currentMonthDeposits - currentMonthPayouts;
        const lastMonthNetActivity = lastMonthDeposits - lastMonthPayouts;

        let monthlyGrowthPercentage = 0;
        let monthlyGrowthIsPositive = true;

        if (lastMonthNetActivity !== 0) {
          monthlyGrowthPercentage =
            ((currentMonthNetActivity - lastMonthNetActivity) / Math.abs(lastMonthNetActivity)) *
            100;
          monthlyGrowthIsPositive = currentMonthNetActivity >= lastMonthNetActivity;
        } else if (currentMonthNetActivity > 0) {
          monthlyGrowthPercentage = 100;
          monthlyGrowthIsPositive = true;
        } else if (currentMonthNetActivity < 0) {
          monthlyGrowthPercentage = 100;
          monthlyGrowthIsPositive = false;
        }

        const averagePayoutAmount =
          plans && plans.length > 0
            ? plans.reduce((sum, plan) => sum + Number(plan.payout_amount), 0) / plans.length
            : 0;

        const thirtyDaysFromNow = new Date();
        thirtyDaysFromNow.setDate(currentDate.getDate() + 30);

        const upcomingPayouts =
          plans
            ?.filter((p) => {
              if (p.status !== 'active' || !p.next_payout_date) return false;
              const nextPayoutDate = new Date(p.next_payout_date);
              return nextPayoutDate <= thirtyDaysFromNow && nextPayoutDate >= currentDate;
            })
            .reduce((sum, p) => sum + Number(p.payout_amount), 0) || 0;

        const oneWeekFromNow = new Date();
        oneWeekFromNow.setDate(currentDate.getDate() + 7);
        const twoWeeksFromNow = new Date();
        twoWeeksFromNow.setDate(currentDate.getDate() + 14);

        const thisWeekPayouts =
          plans
            ?.filter((p) => {
              if (p.status !== 'active' || !p.next_payout_date) return false;
              const nextPayoutDate = new Date(p.next_payout_date);
              return nextPayoutDate <= oneWeekFromNow && nextPayoutDate >= currentDate;
            })
            .reduce((sum, p) => sum + Number(p.payout_amount), 0) || 0;

        const nextWeekPayouts =
          plans
            ?.filter((p) => {
              if (p.status !== 'active' || !p.next_payout_date) return false;
              const nextPayoutDate = new Date(p.next_payout_date);
              return nextPayoutDate <= twoWeeksFromNow && nextPayoutDate > oneWeekFromNow;
            })
            .reduce((sum, p) => sum + Number(p.payout_amount), 0) || 0;

        const formatCurrency = (amount: number) => {
          if (amount >= 1000000) return `₦${(amount / 1000000).toFixed(2)}M`;
          if (amount >= 1000) return `₦${(amount / 1000).toFixed(0)}K`;
          return `₦${amount.toFixed(0)}`;
        };

        const metricsData: Metric[] = [
          {
            title: 'Payouts',
            value: formatCurrency(totalPayouts),
            change: `${payoutGrowthPercentage >= 0 ? '+' : ''}${Math.abs(payoutGrowthPercentage).toFixed(2)}%`,
            positive: payoutGrowthPercentage >= 0,
            icon: 'Send',
            description: 'Total payouts this month',
          },
          {
            title: 'Deposits',
            value: formatCurrency(totalDeposits),
            change: `${depositGrowthPercentage >= 0 ? '+' : ''}${Math.abs(depositGrowthPercentage).toFixed(2)}%`,
            positive: depositGrowthPercentage >= 0,
            icon: 'Wallet',
            description: 'Total deposits this month',
          },
          {
            title: 'Active',
            value: activePlans.toString(),
            change: `+${activePlans > 0 ? activePlans : 0}`,
            positive: activePlans > 0,
            icon: 'Clock',
            description: 'Currently active payouts',
          },
          {
            title: 'Txns',
            value: totalTransactions.toString(),
            change: `${transactionGrowthPercentage >= 0 ? '+' : ''}${Math.abs(transactionGrowthPercentage).toFixed(2)}%`,
            positive: transactionGrowthPercentage >= 0,
            icon: 'TrendingUp',
            description: 'Total payout transactions',
          },
        ];

        const trendsData: Trend[] = [
          {
            title: 'Monthly Growth',
            value: `${monthlyGrowthPercentage >= 0 ? '+' : ''}${monthlyGrowthPercentage.toFixed(2)}%`,
            description: 'Net financial activity vs last month',
            positive: monthlyGrowthIsPositive,
            details: [
              { label: 'Last Month Net', value: formatCurrency(lastMonthNetActivity) },
              { label: 'This Month Net', value: formatCurrency(currentMonthNetActivity) },
              {
                label: 'Net Change',
                value: formatCurrency(Math.abs(currentMonthNetActivity - lastMonthNetActivity)),
              },
            ],
          },
          {
            title: 'Average Payout',
            value: formatCurrency(averagePayoutAmount),
            description: averagePayoutAmount > 0 ? 'Per payout plan' : 'No active plans',
            positive: true,
            details: [
              {
                label: 'Lowest',
                value: formatCurrency(
                  plans?.length > 0 ? Math.min(...plans.map((p) => p.payout_amount)) : 0
                ),
              },
              {
                label: 'Highest',
                value: formatCurrency(
                  plans?.length > 0 ? Math.max(...plans.map((p) => p.payout_amount)) : 0
                ),
              },
            ],
          },
          {
            title: 'Upcoming Payouts',
            value: formatCurrency(upcomingPayouts),
            description: 'Next 30 days',
            positive: true,
            details: [
              { label: 'This Week', value: formatCurrency(thisWeekPayouts) },
              { label: 'Next Week', value: formatCurrency(nextWeekPayouts) },
            ],
          },
        ];

        const nonCompletedPlans = plans?.filter((plan) => plan.status !== 'completed') || [];
        const vaultStatsData: VaultStat[] = nonCompletedPlans.map((plan) => {
          const progress = Math.round((plan.completed_payouts / plan.duration) * 100);
          return {
            title: plan.name,
            total: formatCurrency(plan.total_amount),
            progress: `${progress}%`,
            nextPayout: plan.next_payout_date
              ? formatPayoutDateTime(plan.next_payout_date)
              : 'N/A',
            status: plan.status.charAt(0).toUpperCase() + plan.status.slice(1),
          };
        });

        setMetrics(metricsData);
        setTrends(trendsData);
        setVaultStats(vaultStatsData);
        hasCachedDataRef.current = true;

        if (userId) {
          void writeCache(CACHE_KEYS.insights(userId), {
            metrics: metricsData,
            trends: trendsData,
            vaultStats: vaultStatsData,
          });
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to compute insights data');
      }
    },
    [userId]
  );

  // Hydrate cached insights instantly (no network).
  useEffect(() => {
    if (!userId || !isAuthReady) return;

    let isMounted = true;
    void (async () => {
      try {
        const cached = await readCache<{
          metrics: Metric[];
          trends: Trend[];
          vaultStats: VaultStat[];
        }>(CACHE_KEYS.insights(userId));
        if (cached && isMounted) {
          setMetrics(cached.metrics || []);
          setTrends(cached.trends || []);
          setVaultStats(cached.vaultStats || []);
          hasCachedDataRef.current = true;
        }
      } catch {
        // non-fatal
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [userId, isAuthReady]);

  // Recompute from shared React Query transaction cache (no duplicate fetch).
  useEffect(() => {
    if (!userId || !isAuthReady || transactionsLoading) return;
    computeInsights(transactions, payoutPlans);
  }, [userId, isAuthReady, transactions, transactionsLoading, payoutPlans, computeInsights]);

  const emptyGuestMetrics = useMemo(
    (): Metric[] => [
      {
        title: 'Payouts',
        value: '₦0',
        change: '+0%',
        positive: true,
        icon: 'Send',
        description: 'Total payouts this month',
      },
      {
        title: 'Deposits',
        value: '₦0',
        change: '+0%',
        positive: true,
        icon: 'Wallet',
        description: 'Total deposits this month',
      },
      {
        title: 'Active',
        value: '0',
        change: '+0',
        positive: false,
        icon: 'Clock',
        description: 'Currently active payouts',
      },
      {
        title: 'Txns',
        value: '0',
        change: '+0%',
        positive: false,
        icon: 'TrendingUp',
        description: 'Total payout transactions',
      },
    ],
    []
  );

  useEffect(() => {
    if (userId) return;
    setMetrics(emptyGuestMetrics);
    setTrends([]);
    setVaultStats([]);
    setError(null);
    hasCachedDataRef.current = false;
  }, [userId, emptyGuestMetrics]);

  const isLoading = !!userId && isAuthReady && transactionsLoading && !hasCachedDataRef.current;

  const { isLoading: guardedLoading, isTimedOut } = useLoadingGuard(
    isLoading,
    hasCachedDataRef.current || metrics.length > 0
  );

  return {
    metrics,
    trends,
    vaultStats,
    isLoading: guardedLoading,
    isTimedOut,
    error,
    refreshInsights: () => computeInsights(transactions, payoutPlans),
  };
}

// AUTOMATIC COMPLETED PAYOUT REMOVAL:
// Vault stats exclude completed payout plans from the "Percentage completed" section.