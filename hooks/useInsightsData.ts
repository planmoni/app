import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { formatPayoutDateTime } from '@/lib/formatters';
import { useRegisterForegroundRefetch } from '@/hooks/useForegroundRefreshCoordinator';
import { useLoadingGuard } from '@/hooks/useLoadingGuard';
import { fetchWithRetry, CACHE_KEYS, readCache, writeCache } from '@/lib/supabase-fetch';

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

export function useInsightsData(payoutPlans: any[] = []) {
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [trends, setTrends] = useState<Trend[]>([]);
  const [vaultStats, setVaultStats] = useState<VaultStat[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { session } = useAuth();
  const hasCachedDataRef = useRef(false);

  const fetchInsightsData = useCallback(async () => {
    if (!session?.user?.id) return;
    try {
      if (!hasCachedDataRef.current) {
        setIsLoading(true);
      }
      setError(null);

      const transactionsResult = await fetchWithRetry(
        () =>
          supabase
            .from('transactions')
            .select('*')
            .eq('user_id', session.user.id)
            .order('created_at', { ascending: false }),
        'Insights transactions'
      ) as { data: any[] | null; error: any };

      if (transactionsResult.error) throw transactionsResult.error;

      const transactions = transactionsResult.data;

      // Calculate metrics
      const totalPayouts = transactions
        ?.filter((t: any) => t.type === 'payout' && t.status === 'completed')
        .reduce((sum: number, t: any) => sum + Number(t.amount), 0) || 0;

      const totalDeposits = transactions
        ?.filter((t: any) => t.type === 'deposit' && t.status === 'completed')
        .reduce((sum: number, t: any) => sum + Number(t.amount), 0) || 0;

  const activePlans = payoutPlans?.filter((p: any) => p.status === 'active').length || 0;
      
      const totalTransactions = transactions?.length || 0;

      // Calculate previous month's payouts for growth calculation
      const currentDate = new Date();
      const currentMonth = currentDate.getMonth();
      const currentYear = currentDate.getFullYear();
      
      // Calculate last month properly handling year boundary
      let lastMonth = currentMonth - 1;
      let lastYear = currentYear;
      if (lastMonth < 0) {
        lastMonth = 11; // December
        lastYear = currentYear - 1;
      }
      
      const currentMonthPayouts = transactions
        ?.filter((t: any) => {
          const txDate = new Date(t.created_at);
          return t.type === 'payout' && 
                 t.status === 'completed' && 
                 txDate.getMonth() === currentMonth &&
                 txDate.getFullYear() === currentYear;
        })
        .reduce((sum: number, t: any) => sum + Number(t.amount), 0) || 0;
      
      const lastMonthPayouts = transactions
        ?.filter((t: any) => {
          const txDate = new Date(t.created_at);
          return t.type === 'payout' && 
                 t.status === 'completed' && 
                 txDate.getMonth() === lastMonth &&
                 txDate.getFullYear() === lastYear;
        })
        .reduce((sum: number, t: any) => sum + Number(t.amount), 0) || 0;
      
      // Calculate growth percentage for payouts
      let payoutGrowthPercentage = 0;
      if (lastMonthPayouts > 0) {
        payoutGrowthPercentage = ((currentMonthPayouts - lastMonthPayouts) / lastMonthPayouts) * 100;
      } else if (currentMonthPayouts > 0) {
        // If last month was 0 but this month has value, show actual increase
        payoutGrowthPercentage = 100;
      }
      
      // Calculate current month's deposits and previous month's deposits
      const currentMonthDeposits = transactions
        ?.filter((t: any) => {
          const txDate = new Date(t.created_at);
          return t.type === 'deposit' && 
                 t.status === 'completed' && 
                 txDate.getMonth() === currentMonth &&
                 txDate.getFullYear() === currentYear;
        })
        .reduce((sum: number, t: any) => sum + Number(t.amount), 0) || 0;
      
      const lastMonthDeposits = transactions
        ?.filter((t: any) => {
          const txDate = new Date(t.created_at);
          return t.type === 'deposit' && 
                 t.status === 'completed' && 
                 txDate.getMonth() === lastMonth &&
                 txDate.getFullYear() === lastYear;
        })
        .reduce((sum: number, t: any) => sum + Number(t.amount), 0) || 0;
      
      // Calculate growth percentage for deposits
      let depositGrowthPercentage = 0;
      if (lastMonthDeposits > 0) {
        depositGrowthPercentage = ((currentMonthDeposits - lastMonthDeposits) / lastMonthDeposits) * 100;
      } else if (currentMonthDeposits > 0) {
        // If last month was 0 but this month has value, show actual increase
        depositGrowthPercentage = 100;
      }
      
      // Calculate transaction count growth
      const currentMonthTransactionCount = transactions
        ?.filter((t: any) => {
          const txDate = new Date(t.created_at);
          return txDate.getMonth() === currentMonth &&
                 txDate.getFullYear() === currentYear;
        }).length || 0;
      
      const lastMonthTransactionCount = transactions
        ?.filter((t: any) => {
          const txDate = new Date(t.created_at);
          return txDate.getMonth() === lastMonth &&
                 txDate.getFullYear() === lastYear;
        }).length || 0;
      
      // Calculate transaction count growth percentage
      let transactionGrowthPercentage = 0;
      if (lastMonthTransactionCount > 0) {
        transactionGrowthPercentage = ((currentMonthTransactionCount - lastMonthTransactionCount) / lastMonthTransactionCount) * 100;
      } else if (currentMonthTransactionCount > 0) {
        // If last month was 0 but this month has value, show actual increase
        transactionGrowthPercentage = 100;
      }
      
      // Debug logging to check the calculations
      console.log('Monthly Growth Debug:', {
        currentMonth,
        currentYear,
        lastMonth,
        lastYear,
        currentMonthDeposits,
        lastMonthDeposits,
        currentMonthPayouts,
        lastMonthPayouts,
        totalTransactions: transactions?.length || 0,
        currentMonthTransactionCount,
        lastMonthTransactionCount
      });
      
      // Calculate overall monthly growth based on net financial activity
      // Net activity = deposits - payouts (positive means more money coming in)
      const currentMonthNetActivity = currentMonthDeposits - currentMonthPayouts;
      const lastMonthNetActivity = lastMonthDeposits - lastMonthPayouts;
      
      let monthlyGrowthPercentage = 0;
      let monthlyGrowthIsPositive = true;
      
      if (lastMonthNetActivity !== 0) {
        monthlyGrowthPercentage = ((currentMonthNetActivity - lastMonthNetActivity) / Math.abs(lastMonthNetActivity)) * 100;
        monthlyGrowthIsPositive = currentMonthNetActivity >= lastMonthNetActivity;
      } else if (currentMonthNetActivity > 0) {
        // If last month was neutral but this month is positive
        monthlyGrowthPercentage = 100;
        monthlyGrowthIsPositive = true;
      } else if (currentMonthNetActivity < 0) {
        // If last month was neutral but this month is negative
        monthlyGrowthPercentage = 100;
        monthlyGrowthIsPositive = false;
      }
      
      // Calculate average payout amount
      const averagePayoutAmount = payoutPlans && payoutPlans.length > 0
        ? payoutPlans.reduce((sum: number, plan: any) => sum + Number(plan.payout_amount), 0) / payoutPlans.length
        : 0;
      
      // Calculate upcoming payouts (next 30 days)
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(currentDate.getDate() + 30);
      
      const upcomingPayouts = payoutPlans
        ?.filter((p: any) => {
          if (p.status !== 'active' || !p.next_payout_date) return false;
          const nextPayoutDate = new Date(p.next_payout_date);
          return nextPayoutDate <= thirtyDaysFromNow && nextPayoutDate >= currentDate;
        })
        .reduce((sum: number, p: any) => sum + Number(p.payout_amount), 0) || 0;
      
      // Calculate this week and next week payouts
      const oneWeekFromNow = new Date();
      oneWeekFromNow.setDate(currentDate.getDate() + 7);
      
      const twoWeeksFromNow = new Date();
      twoWeeksFromNow.setDate(currentDate.getDate() + 14);
      
      const thisWeekPayouts = payoutPlans
        ?.filter((p: any) => {
          if (p.status !== 'active' || !p.next_payout_date) return false;
          const nextPayoutDate = new Date(p.next_payout_date);
          return nextPayoutDate <= oneWeekFromNow && nextPayoutDate >= currentDate;
        })
        .reduce((sum: number, p: any) => sum + Number(p.payout_amount), 0) || 0;
      
      const nextWeekPayouts = payoutPlans
        ?.filter((p: any) => {
          if (p.status !== 'active' || !p.next_payout_date) return false;
          const nextPayoutDate = new Date(p.next_payout_date);
          return nextPayoutDate <= twoWeeksFromNow && nextPayoutDate > oneWeekFromNow;
        })
        .reduce((sum: number, p: any) => sum + Number(p.payout_amount), 0) || 0;

      // Format currency values
      const formatCurrency = (amount: number) => {
        if (amount >= 1000000) {
          return `₦${(amount / 1000000).toFixed(2)}M`;
        } else if (amount >= 1000) {
          return `₦${(amount / 1000).toFixed(0)}K`;
        } else {
          return `₦${amount.toFixed(0)}`;
        }
      };

      // Set metrics data
      const metricsData = [
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

      // Set trends data with absolute values for comparison
      const trendsData = [
        {
          title: 'Monthly Growth',
          value: `${monthlyGrowthPercentage >= 0 ? '+' : ''}${monthlyGrowthPercentage.toFixed(2)}%`,
          description: 'Net financial activity vs last month',
          positive: monthlyGrowthIsPositive,
          details: [
            { label: 'Last Month Net', value: formatCurrency(lastMonthNetActivity) },
            { label: 'This Month Net', value: formatCurrency(currentMonthNetActivity) },
            { label: 'Net Change', value: formatCurrency(Math.abs(currentMonthNetActivity - lastMonthNetActivity)) },
          ],
        },
        {
          title: 'Average Payout',
          value: formatCurrency(averagePayoutAmount),
          description: averagePayoutAmount > 0 ? 'Per payout plan' : 'No active plans',
          positive: true,
          details: [
            { label: 'Lowest', value: formatCurrency(payoutPlans?.length > 0 ? Math.min(...payoutPlans.map((p: any) => p.payout_amount)) : 0) },
            { label: 'Highest', value: formatCurrency(payoutPlans?.length > 0 ? Math.max(...payoutPlans.map((p: any) => p.payout_amount)) : 0) },
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

      // Set vault stats data - AUTOMATICALLY EXCLUDE COMPLETED PAYOUTS
      // Only show active, paused, and other non-completed plans in the "Percentage completed" section
  const nonCompletedPlans = payoutPlans?.filter((plan: any) => plan.status !== 'completed') || [];
      
      const vaultStatsData = nonCompletedPlans.map((plan: any) => {
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

      // Log the filtering for debugging
      console.log('Vault Stats Filtering:', {
        totalPlans: payoutPlans?.length || 0,
  completedPlans: payoutPlans?.filter((p: any) => p.status === 'completed').length || 0,
        nonCompletedPlans: nonCompletedPlans.length,
        filteredOut: (payoutPlans?.length || 0) - nonCompletedPlans.length
      });

      setMetrics(metricsData);
      setTrends(trendsData);
      setVaultStats(vaultStatsData);

      void writeCache(CACHE_KEYS.insights(session.user.id), {
        metrics: metricsData,
        trends: trendsData,
        vaultStats: vaultStatsData,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch insights data');
    } finally {
      setIsLoading(false);
    }
  }, [session?.user?.id, payoutPlans]);

  useEffect(() => {
    if (session?.user?.id) {
      let isMounted = true;

      const init = async () => {
        try {
          const cached = await readCache<{
            metrics: Metric[];
            trends: Trend[];
            vaultStats: VaultStat[];
          }>(CACHE_KEYS.insights(session.user.id));
          if (cached && isMounted) {
            const d = cached;
            setMetrics(d.metrics || []);
            setTrends(d.trends || []);
            setVaultStats(d.vaultStats || []);
            setIsLoading(false);
            hasCachedDataRef.current = true;
          }
        } catch (_) {}

        if (!isMounted) return;
        void fetchInsightsData();
      };

      void init();

      return () => {
        isMounted = false;
      };
    }

    // Return empty/mock data for unauthenticated users
    setMetrics([
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
    ]);
    setTrends([]);
    setVaultStats([]);
    setIsLoading(false);
    setError(null);
    hasCachedDataRef.current = false;
  }, [session?.user?.id, payoutPlans, fetchInsightsData]);

  useRegisterForegroundRefetch('insights', 2, fetchInsightsData, !!session?.user?.id);

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
    refreshInsights: fetchInsightsData,
  };
}

// Add a comment to document the automatic filtering
// AUTOMATIC COMPLETED PAYOUT REMOVAL:
// This hook automatically filters out completed payouts from the vault stats
// to prevent them from appearing in the "Percentage completed" section.
// Only active, paused, and other non-completed plans are shown.
