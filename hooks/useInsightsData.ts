import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

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

export function useInsightsData() {
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [trends, setTrends] = useState<Trend[]>([]);
  const [vaultStats, setVaultStats] = useState<VaultStat[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { session } = useAuth();

  useEffect(() => {
    if (session?.user?.id) {
      fetchInsightsData();
    }
  }, [session?.user?.id]);

  const fetchInsightsData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Fetch transactions data
      const { data: transactions, error: transactionsError } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', session?.user?.id)
        .order('created_at', { ascending: false });

      if (transactionsError) throw transactionsError;

      // Fetch payout plans data
      const { data: payoutPlans, error: plansError } = await supabase
        .from('payout_plans')
        .select('*')
        .eq('user_id', session?.user?.id)
        .order('created_at', { ascending: false });

      if (plansError) throw plansError;

      // Calculate metrics
      const totalPayouts = transactions
        ?.filter(t => t.type === 'payout' && t.status === 'completed')
        .reduce((sum, t) => sum + t.amount, 0) || 0;

      const totalDeposits = transactions
        ?.filter(t => t.type === 'deposit' && t.status === 'completed')
        .reduce((sum, t) => sum + t.amount, 0) || 0;

      const activePlans = payoutPlans?.filter(p => p.status === 'active').length || 0;
      
      const totalTransactions = transactions?.length || 0;

      // Calculate previous month's payouts for growth calculation
      const currentDate = new Date();
      const lastMonthDate = new Date();
      lastMonthDate.setMonth(currentDate.getMonth() - 1);
      
      const currentMonthPayouts = transactions
        ?.filter(t => {
          const txDate = new Date(t.created_at);
          return t.type === 'payout' && 
                 t.status === 'completed' && 
                 txDate.getMonth() === currentDate.getMonth() &&
                 txDate.getFullYear() === currentDate.getFullYear();
        })
        .reduce((sum, t) => sum + t.amount, 0) || 0;
      
      const lastMonthPayouts = transactions
        ?.filter(t => {
          const txDate = new Date(t.created_at);
          return t.type === 'payout' && 
                 t.status === 'completed' && 
                 txDate.getMonth() === lastMonthDate.getMonth() &&
                 txDate.getFullYear() === lastMonthDate.getFullYear();
        })
        .reduce((sum, t) => sum + t.amount, 0) || 0;
      
      // Calculate growth percentage for payouts
      let payoutGrowthPercentage = 0;
      if (lastMonthPayouts > 0) {
        payoutGrowthPercentage = ((currentMonthPayouts - lastMonthPayouts) / lastMonthPayouts) * 100;
      }
      
      // Calculate current month's deposits and previous month's deposits
      const currentMonthDeposits = transactions
        ?.filter(t => {
          const txDate = new Date(t.created_at);
          return t.type === 'deposit' && 
                 t.status === 'completed' && 
                 txDate.getMonth() === currentDate.getMonth() &&
                 txDate.getFullYear() === currentDate.getFullYear();
        })
        .reduce((sum, t) => sum + t.amount, 0) || 0;
      
      const lastMonthDeposits = transactions
        ?.filter(t => {
          const txDate = new Date(t.created_at);
          return t.type === 'deposit' && 
                 t.status === 'completed' && 
                 txDate.getMonth() === lastMonthDate.getMonth() &&
                 txDate.getFullYear() === lastMonthDate.getFullYear();
        })
        .reduce((sum, t) => sum + t.amount, 0) || 0;
      
      // Calculate growth percentage for deposits
      let depositGrowthPercentage = 0;
      if (lastMonthDeposits > 0) {
        depositGrowthPercentage = ((currentMonthDeposits - lastMonthDeposits) / lastMonthDeposits) * 100;
      }
      
      // Calculate transaction count growth
      const currentMonthTransactionCount = transactions
        ?.filter(t => {
          const txDate = new Date(t.created_at);
          return txDate.getMonth() === currentDate.getMonth() &&
                 txDate.getFullYear() === currentDate.getFullYear();
        }).length || 0;
      
      const lastMonthTransactionCount = transactions
        ?.filter(t => {
          const txDate = new Date(t.created_at);
          return txDate.getMonth() === lastMonthDate.getMonth() &&
                 txDate.getFullYear() === lastMonthDate.getFullYear();
        }).length || 0;
      
      // Calculate transaction count growth percentage
      let transactionGrowthPercentage = 0;
      if (lastMonthTransactionCount > 0) {
        transactionGrowthPercentage = ((currentMonthTransactionCount - lastMonthTransactionCount) / lastMonthTransactionCount) * 100;
      }
      
      // Calculate average payout amount
      const averagePayoutAmount = payoutPlans && payoutPlans.length > 0
        ? payoutPlans.reduce((sum, plan) => sum + plan.payout_amount, 0) / payoutPlans.length
        : 0;
      
      // Calculate upcoming payouts (next 30 days)
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(currentDate.getDate() + 30);
      
      const upcomingPayouts = payoutPlans
        ?.filter(p => {
          if (p.status !== 'active' || !p.next_payout_date) return false;
          const nextPayoutDate = new Date(p.next_payout_date);
          return nextPayoutDate <= thirtyDaysFromNow && nextPayoutDate >= currentDate;
        })
        .reduce((sum, p) => sum + p.payout_amount, 0) || 0;
      
      // Calculate this week and next week payouts
      const oneWeekFromNow = new Date();
      oneWeekFromNow.setDate(currentDate.getDate() + 7);
      
      const twoWeeksFromNow = new Date();
      twoWeeksFromNow.setDate(currentDate.getDate() + 14);
      
      const thisWeekPayouts = payoutPlans
        ?.filter(p => {
          if (p.status !== 'active' || !p.next_payout_date) return false;
          const nextPayoutDate = new Date(p.next_payout_date);
          return nextPayoutDate <= oneWeekFromNow && nextPayoutDate >= currentDate;
        })
        .reduce((sum, p) => sum + p.payout_amount, 0) || 0;
      
      const nextWeekPayouts = payoutPlans
        ?.filter(p => {
          if (p.status !== 'active' || !p.next_payout_date) return false;
          const nextPayoutDate = new Date(p.next_payout_date);
          return nextPayoutDate <= twoWeeksFromNow && nextPayoutDate > oneWeekFromNow;
        })
        .reduce((sum, p) => sum + p.payout_amount, 0) || 0;

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
          change: `${payoutGrowthPercentage >= 0 ? '+' : ''}${Math.abs(payoutGrowthPercentage).toFixed(1)}%`,
          positive: payoutGrowthPercentage >= 0,
          icon: 'Send',
          description: 'Total payouts this month',
        },
        {
          title: 'Deposits',
          value: formatCurrency(totalDeposits),
          change: `${depositGrowthPercentage >= 0 ? '+' : ''}${Math.abs(depositGrowthPercentage).toFixed(1)}%`,
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
          change: `${transactionGrowthPercentage >= 0 ? '+' : ''}${Math.abs(transactionGrowthPercentage).toFixed(1)}%`,
          positive: transactionGrowthPercentage >= 0,
          icon: 'TrendingUp',
          description: 'Total payout transactions',
        },
      ];

      // Set trends data
      const trendsData = [
        {
          title: 'Monthly Growth',
          value: `${payoutGrowthPercentage >= 0 ? '+' : ''}${payoutGrowthPercentage.toFixed(1)}%`,
          description: 'Compared to last month',
          positive: payoutGrowthPercentage >= 0,
          details: [
            { label: 'Last Month', value: formatCurrency(lastMonthPayouts) },
            { label: 'This Month', value: formatCurrency(currentMonthPayouts) },
          ],
        },
        {
          title: 'Average Payout',
          value: formatCurrency(averagePayoutAmount),
          description: averagePayoutAmount > 0 ? 'Per payout plan' : 'No active plans',
          positive: true,
          details: [
            { label: 'Lowest', value: formatCurrency(payoutPlans?.length > 0 ? Math.min(...payoutPlans.map(p => p.payout_amount)) : 0) },
            { label: 'Highest', value: formatCurrency(payoutPlans?.length > 0 ? Math.max(...payoutPlans.map(p => p.payout_amount)) : 0) },
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

      // Set vault stats data
      const vaultStatsData = payoutPlans?.map(plan => {
        const progress = Math.round((plan.completed_payouts / plan.duration) * 100);
        return {
          title: plan.name,
          total: formatCurrency(plan.total_amount),
          progress: `${progress}%`,
          nextPayout: plan.next_payout_date 
            ? new Date(plan.next_payout_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
            : 'N/A',
          status: plan.status.charAt(0).toUpperCase() + plan.status.slice(1),
        };
      }) || [];

      setMetrics(metricsData);
      setTrends(trendsData);
      setVaultStats(vaultStatsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch insights data');
    } finally {
      setIsLoading(false);
    }
  };

  return {
    metrics,
    trends,
    vaultStats,
    isLoading,
    error,
    refreshInsights: fetchInsightsData,
  };
}