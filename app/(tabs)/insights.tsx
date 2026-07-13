import { View, Text, StyleSheet, ScrollView, Platform, Pressable } from 'react-native';
import { TrendingUp, TrendingDown, Users, ArrowUpRight, ArrowDownRight, Wallet, Clock, Calendar, Send } from 'lucide-react-native';
import Card from '@/components/Card';
import { useMemo, useState, useEffect } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { useInsightsData } from '@/hooks/useInsightsData';
import { usePayoutPlansQuery } from '@/hooks/queries/usePayoutPlansQuery';
import { useTransactionsQuery } from '@/hooks/queries/useTransactionsQuery';
import { ensureSupabaseConnection } from '@/lib/supabase-fetch';
import { useExpensePlans } from '@/hooks/useExpensePlans';
import PlanmoniLoader from '@/components/PlanmoniLoader';
import Button from '@/components/Button';
import SummaryCard from '@/components/SummaryCard';
import { supabase } from '@/lib/supabase';
import { withRetryOnTimeout } from '@/lib/with-timeout';
import { useTextSize } from '@/contexts/TextSizeContext';
import { getScaledFontSize } from '@/lib/textSize';
import { logAnalyticsEvent } from '@/lib/firebase';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { router } from 'expo-router';
import { calculatePlanInsights, generateInsightMessages } from '@/lib/insights/planInsights';
import { Target, AlertCircle, Percent } from 'lucide-react-native';


export default function InsightsScreen() {
  const { colors, isDark } = useTheme();
  const { textSizeMultiplier } = useTextSize();
  const { isAuthenticated } = useRequireAuth();
  const { payoutPlans, isLoading: payoutPlansLoading, isTimedOut: payoutPlansTimedOut, fetchPayoutPlans } = usePayoutPlansQuery();
  const { transactions, isLoading: transactionsLoading, isTimedOut: transactionsTimedOut, fetchTransactions } = useTransactionsQuery();
  const { metrics, trends, vaultStats, isLoading, isTimedOut: insightsTimedOut, error, refreshInsights } = useInsightsData(
    payoutPlans,
    transactions,
    transactionsLoading
  );
  const { expensePlans } = useExpensePlans();
  const [customPayoutDates, setCustomPayoutDates] = useState<Record<string, string[]>>({});
  const [vaultStatsLimit, setVaultStatsLimit] = useState(5);

  // Calculate plan insights
  const planInsights = useMemo(() => {
    if (expensePlans.length === 0) return null;
    return calculatePlanInsights(expensePlans);
  }, [expensePlans]);

  const planInsightMessages = useMemo(() => {
    if (!planInsights) return [];
    // TODO: Get actual monthly income from user profile
    return generateInsightMessages(planInsights, 100000);
  }, [planInsights]);

  // Map icon names to components
  const getIconComponent = (iconName: string) => {
    switch (iconName) {
      case 'Send': return Send;
      case 'Wallet': return Wallet;
      case 'Clock': return Clock;
      case 'TrendingUp': return TrendingUp;
      case 'Users': return Users;
      case 'Calendar': return Calendar;
      default: return TrendingUp;
    }
  };

  // Calculate summary stats from actual data
  // Total amount of plans created = sum of all plan total_amounts
  const totalPaidOut = payoutPlans.reduce((sum, plan) => 
    sum + plan.total_amount, 0
  );
  
  const pendingPayouts = payoutPlans
    .filter(plan => plan.status === 'active')
    .reduce((sum, plan) => 
      sum + ((plan.duration - plan.completed_payouts) * plan.payout_amount), 0
    );

  // Completion rate = average completion percentage across all plans
  const completionRate = payoutPlans.length > 0 
    ? Math.round(
        payoutPlans.reduce((sum, plan) => {
          const planCompletion = (plan.completed_payouts / plan.duration) * 100;
          return sum + planCompletion;
        }, 0) / payoutPlans.length
      )
    : 0;

  // Get active payout plans for display
  const activePlans = payoutPlans.filter(plan => plan.status === 'active');

  // Fetch custom payout dates for custom frequency plans
  useEffect(() => {
    const fetchCustomDates = async () => {
      const customPlans = payoutPlans.filter(plan => plan.frequency === 'custom' && plan.status === 'active');
      if (customPlans.length === 0) return;

      try {
        const planIds = customPlans.map(plan => plan.id);
        const { data, error } = await withRetryOnTimeout(
          () =>
            supabase
              .from('custom_payout_dates')
              .select('payout_plan_id, payout_date')
              .in('payout_plan_id', planIds)
              .order('payout_date', { ascending: true }),
          15000,
          'Insights custom payout dates'
        ) as { data: any[] | null; error: any };

        if (error) throw error;

        // Group dates by plan_id
        const datesByPlan: Record<string, string[]> = {};
        data?.forEach(item => {
          if (!datesByPlan[item.payout_plan_id]) {
            datesByPlan[item.payout_plan_id] = [];
          }
          datesByPlan[item.payout_plan_id].push(item.payout_date);
        });

        setCustomPayoutDates(datesByPlan);
      } catch (error) {
        console.error('Error fetching custom payout dates:', error);
      }
    };

    fetchCustomDates();
  }, [payoutPlans]);

  // Calculate the final payout date for a single plan
  const calculatePlanFinalDate = (plan: any): Date | null => {
    if (!plan.start_date) return null;

    const startDate = new Date(plan.start_date);
    let finalDate = new Date(startDate);

    // Calculate final payout date
    // If duration is N, the last payout is at index N-1 (0-indexed)
    // First payout: start_date (index 0)
    // Last payout: start_date + (duration - 1) * frequency_interval
    const lastPayoutIndex = plan.duration - 1;

    if (plan.frequency === 'daily') {
      // Daily: add (duration - 1) days
      finalDate.setDate(startDate.getDate() + lastPayoutIndex);
    } else if (plan.frequency === 'weekly') {
      // Weekly: add (duration - 1) * 7 days
      finalDate.setDate(startDate.getDate() + (lastPayoutIndex * 7));
    } else if (plan.frequency === 'biweekly') {
      // Biweekly: add (duration - 1) * 14 days
      finalDate.setDate(startDate.getDate() + (lastPayoutIndex * 14));
    } else if (plan.frequency === 'monthly') {
      // Monthly: add (duration - 1) months
      finalDate.setMonth(startDate.getMonth() + lastPayoutIndex);
    } else if (plan.frequency === 'custom') {
      // For custom, get the last date from custom_payout_dates
      const dates = customPayoutDates[plan.id];
      if (dates && dates.length > 0) {
        // Get the last (latest) date from the sorted array
        const lastDate = dates[dates.length - 1];
        finalDate = new Date(lastDate);
      } else {
        // Fallback: estimate based on next_payout_date and remaining payouts
        if (plan.next_payout_date) {
          const remainingPayouts = plan.duration - plan.completed_payouts;
          if (remainingPayouts > 0) {
            const nextDate = new Date(plan.next_payout_date);
            finalDate = new Date(nextDate);
            // Estimate: assume similar interval between payouts
            // Use the interval from start to next_payout_date
            const daysDiff = Math.round(
              (nextDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
            );
            if (daysDiff > 0) {
              finalDate.setDate(nextDate.getDate() + (daysDiff * (remainingPayouts - 1)));
            } else {
              // Fallback to monthly estimate
              finalDate.setMonth(nextDate.getMonth() + (remainingPayouts - 1));
            }
          }
        } else {
          return null;
        }
      }
    }

    return finalDate;
  };

  const pickLatestDate = (current: Date | null, candidate: Date | null): Date | null => {
    if (!candidate) return current;
    if (!current || candidate > current) return candidate;
    return current;
  };

  // Find the final payout date - the latest final payout date across all active plans
  const getLastPayoutDate = () => {
    // Priority: Check active plans first (these are the ones with future payouts)
    const activePlans = payoutPlans.filter(plan => plan.status === 'active');

    let latestFinalDate: Date | null = null;

    if (activePlans.length > 0) {
      // Calculate final payout date for each active plan and find the latest
      for (const plan of activePlans) {
        latestFinalDate = pickLatestDate(latestFinalDate, calculatePlanFinalDate(plan));
      }
    }

    // If no active plans, check completed plans to show the most recent final payout
    if (!latestFinalDate) {
      const completedPlans = payoutPlans.filter(plan => plan.status === 'completed');
      for (const plan of completedPlans) {
        latestFinalDate = pickLatestDate(latestFinalDate, calculatePlanFinalDate(plan));
      }
    }

    if (!latestFinalDate) {
      return 'No payouts yet';
    }

    return latestFinalDate.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const styles = createStyles(colors, isDark, textSizeMultiplier);

  const hasInsightsData = metrics.length > 0 || payoutPlans.length > 0;
  const showInitialLoader =
    !hasInsightsData && (isLoading || payoutPlansLoading);
  const showInsightsRetry =
    !hasInsightsData &&
    !isLoading &&
    !payoutPlansLoading &&
    !transactionsLoading &&
    (insightsTimedOut || payoutPlansTimedOut || transactionsTimedOut);

  const handleRetryInsights = async () => {
    await ensureSupabaseConnection({ skipProbe: true });
    await Promise.allSettled([fetchPayoutPlans(), fetchTransactions()]);
    refreshInsights();
  };

  if (showInitialLoader) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Insights</Text>
          {!isAuthenticated && (
            <Pressable 
              onPress={() => router.push('/(auth)/onboarding/country-select')} 
              style={styles.loginButton}
            >
              <Text style={styles.loginButtonText}>Login</Text>
            </Pressable>
          )}
        </View>
        <View style={styles.loadingContainer}>
          <PlanmoniLoader size="medium" description="Loading insights data..." />
        </View>
      </SafeAreaView>
    );
  }

  if (showInsightsRetry) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Insights</Text>
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Couldn&apos;t load insights. Check your connection and try again.</Text>
          <Button title="Retry" onPress={handleRetryInsights} style={styles.retryButton} />
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Insights</Text>
          {!isAuthenticated && (
            <Pressable 
              onPress={() => router.push('/(auth)/onboarding/country-select')} 
              style={styles.loginButton}
            >
              <Text style={styles.loginButtonText}>Login</Text>
            </Pressable>
          )}
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <Button 
            title="Retry" 
            onPress={refreshInsights} 
            style={styles.retryButton}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Insights</Text>
        {!isAuthenticated && (
          <Pressable 
            onPress={() => router.push('/(auth)/onboarding/country-select')} 
            style={[styles.loginButton, { borderColor: isDark ? '#fff' : colors.primary }]}
          >
            <Text style={[styles.loginButtonText, { color: isDark ? '#fff' : colors.primary }]}>Login</Text>
          </Pressable>
        )}
      </View>
      
      <ScrollView style={styles.content}>
        <View style={styles.contentPadding}>
          {/* Summary Card */}
          

          <Text style={styles.sectionTitle}>Key Metrics</Text>
          <View style={styles.metricsGrid}>
            {metrics.map((metric, index) => {
              const IconComponent = getIconComponent(metric.icon);
              return (
                <Card key={index} style={styles.metricCard}>
                  <View style={styles.metricHeader}>
                    <Text style={styles.metricTitle}>{metric.title}</Text>
                    <View style={[
                      styles.metricIcon,
                      { backgroundColor: metric.positive ? colors.accent : '#FEE2E2' }
                    ]}>
                      <IconComponent
                        size={20}
                        color={metric.positive ? colors.primary : '#EF4444'}
                      />
                    </View>
                  </View>
                  <Text style={styles.metricValue}>{metric.value}</Text>
                  <View style={styles.metricChange}>
                    {metric.positive ? (
                      <ArrowUpRight size={16} color="#22C55E" />
                    ) : (
                      <ArrowDownRight size={16} color="#EF4444" />
                    )}
                    <Text
                      style={[
                        styles.metricChangeText,
                        { color: metric.positive ? '#22C55E' : '#EF4444' },
                      ]}>
                      {metric.change}
                    </Text>
                  </View>
                  <Text style={styles.metricDescription}>{metric.description}</Text>
                </Card>
              );
            })}
          </View>
          <SummaryCard 
            totalPaidOut={totalPaidOut}
            pendingPayouts={pendingPayouts}
            completionRate={completionRate}
            activePlans={activePlans}
            payoutPlans={payoutPlans}
            getLastPayoutDate={getLastPayoutDate}
          />

          {/* Plan Insights */}
          {/* {isAuthenticated && planInsightMessages.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Expense Plan Insights</Text>
              {planInsightMessages.map((insight, index) => {
                const getIcon = () => {
                  switch (insight.type) {
                    case 'completion_rate':
                      return Target;
                    case 'underfunding':
                      return AlertCircle;
                    case 'overspending':
                      return AlertCircle;
                    case 'income_allocation':
                      return Percent;
                    case 'goals_completed':
                      return TrendingUp;
                    default:
                      return TrendingUp;
                  }
                };
                const Icon = getIcon();
                
                return (
                  <Card key={index} style={styles.trendCard}>
                    <View style={styles.trendContent}>
                      <View style={styles.planInsightContent}>
                        <View style={styles.planInsightHeader}>
                          <View style={[styles.planInsightIcon, { backgroundColor: insight.trend === 'up' ? '#DCFCE7' : insight.trend === 'down' ? '#FEE2E2' : '#EFF6FF' }]}>
                            <Icon size={20} color={insight.trend === 'up' ? '#22C55E' : insight.trend === 'down' ? '#EF4444' : colors.primary} />
                          </View>
                          <View style={styles.planInsightText}>
                            <Text style={styles.trendTitle}>{insight.title}</Text>
                            <Text style={styles.trendDescription}>{insight.description}</Text>
                          </View>
                        </View>
                        <View style={[styles.trendValue, { backgroundColor: insight.trend === 'up' ? '#DCFCE7' : insight.trend === 'down' ? '#FEE2E2' : '#EFF6FF' }]}>
                          <Text style={[styles.trendValueText, { color: insight.trend === 'up' ? '#22C55E' : insight.trend === 'down' ? '#EF4444' : colors.primary }]}>
                            {typeof insight.value === 'number' ? insight.value.toLocaleString('en-US') : insight.value}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </Card>
                );
              })}
            </View>
          )} */}

          {isAuthenticated && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Performance Trends</Text>
            {trends.map((trend, index) => (
              <Card key={index} style={styles.trendCard}>
                <View style={styles.trendContent}>
                  <View>
                    <Text style={styles.trendTitle}>{trend.title}</Text>
                    <Text style={styles.trendDescription}>{trend.description}</Text>
                    <View style={styles.trendDetails}>
                      {trend.details.map((detail, i) => (
                        <View key={i} style={styles.detailItem}>
                          <Text style={styles.detailLabel}>{detail.label}</Text>
                          <Text style={styles.detailValue}>{detail.value}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                  <View style={[
                    styles.trendValue,
                    { backgroundColor: trend.positive ? colors.accent : '#FEF2F2' }
                  ]}>
                    <Text style={[
                      styles.trendValueText,
                      { color: trend.positive ? colors.primary : colors.error }
                    ]}>
                      {trend.value}
                    </Text>
                  </View>
                </View>
              </Card>
            ))}
          </View>
          )}
          

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Percentage completed</Text>
            {vaultStats.length === 0 ? (
              <Card style={styles.emptyVaultCard}>
                <Text style={styles.emptyVaultText}>No ongoing payout plans found</Text>
                <Text style={styles.emptyVaultSubtext}>
                  Create a payout plan to start tracking your progress
                </Text>
              </Card>
            ) : (
              <>
                {vaultStats.slice(0, vaultStatsLimit).map((vault, index) => (
                  <Card key={index} style={styles.vaultCard}>
                    <View style={styles.vaultHeader}>
                      <Text style={styles.vaultTitle}>{vault.title}</Text>
                      <View style={[
                        styles.vaultStatus,
                        { 
                          backgroundColor: vault.status === 'Active' ? '#DCFCE7' : 
                                          vault.status === 'Paused' ? '#FEE2E2' : 
                                          vault.status === 'Completed' ? '#EFF6FF' : '#FEF3C7' 
                        }
                      ]}>
                        <Text style={[
                          styles.vaultStatusText,
                          { 
                            color: vault.status === 'Active' ? '#22C55E' : 
                                  vault.status === 'Paused' ? '#EF4444' : 
                                  vault.status === 'Completed' ? '#1E3A8A' : '#D97706' 
                          }
                        ]}>{vault.status}</Text>
                      </View>
                    </View>
                    
                    <View style={styles.vaultStats}>
                      <View style={styles.vaultStat}>
                        <Text style={styles.vaultStatLabel}>Total</Text>
                        <Text style={styles.vaultStatValue}>{vault.total}</Text>
                      </View>
                      <View style={styles.vaultStat}>
                        <Text style={styles.vaultStatLabel}>Progress</Text>
                        <Text style={styles.vaultStatValue}>{vault.progress}</Text>
                      </View>
                      <View style={styles.vaultStat}>
                        <Text style={styles.vaultStatLabel}>Next Payout</Text>
                        <Text style={styles.vaultStatValue}>{vault.nextPayout}</Text>
                      </View>
                    </View>
                    <View style={styles.progressBar}>
                      <View 
                        style={[
                          styles.progressFill,
                          { width: parseFloat(vault.progress) }
                        ]} 
                      />
                    </View>
                  </Card>
                ))}
                {vaultStats.length > vaultStatsLimit && (
                  <Button
                    title={`Load More (${vaultStats.length - vaultStatsLimit} remaining)`}
                    onPress={() => setVaultStatsLimit(prev => prev + 5)}
                    style={styles.loadMoreButton}
                  />
                )}
              </>
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: any, isDark: boolean, textSizeMultiplier: number) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundSecondary,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 24 : 20, textSizeMultiplier),
    fontWeight: '700',
    color: colors.text,
  },
  loginButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1.5,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loginButtonText: {
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 16 : 14, textSizeMultiplier),
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  contentPadding: {
    padding: Platform.OS === 'ios' ? 16 : 10,
    paddingBottom: 32,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 16 : 14, textSizeMultiplier),
    color: colors.textSecondary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 16 : 14, textSizeMultiplier),
    color: colors.error,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    minWidth: Platform.OS === 'ios' ? 120 : 100,
    backgroundColor: colors.primary,
  },
  sectionTitle: {
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 18 : 16, textSizeMultiplier),
    fontWeight: '600',
    color: colors.text,
    marginBottom: 16,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Platform.OS === 'ios' ? 12 : 10,
    marginBottom: 24,
  },
  metricCard: {
    flex: 1,
    minWidth: Platform.OS === 'ios' ? '48%' : '40%',
    padding: 16,
  },
  metricHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  metricTitle: {
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 14 : 12, textSizeMultiplier),
    color: colors.textSecondary,
  },
  metricIcon: {
    width: Platform.OS === 'ios' ? 36 : 32,
    height: Platform.OS === 'ios' ? 36 : 32,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  metricValue: {
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 24 : 20, textSizeMultiplier),
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },
  metricChange: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 8,
  },
  metricChangeText: {
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 14 : 12, textSizeMultiplier),
    fontWeight: '500',
  },
  metricDescription: {
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 12 : 10, textSizeMultiplier),
    color: colors.textSecondary,
  },
  section: {
    marginBottom: Platform.OS === 'ios' ? 24 : 16,
  },
  trendCard: {
    marginBottom: Platform.OS === 'ios' ? 12 : 10,
  },
  trendContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: Platform.OS === 'ios' ? 16 : 10,
  },
  trendTitle: {
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 16 : 14, textSizeMultiplier),
    fontWeight: '500',
    color: colors.text,
    marginBottom: 4,
  },
  trendDescription: {
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 14 : 12, textSizeMultiplier),
    color: colors.textSecondary,
    marginBottom: 12,
  },
  trendDetails: {
    gap: Platform.OS === 'ios' ? 8 : 6,
  },
  detailItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 12 : 10, textSizeMultiplier),
    color: colors.textSecondary,
  },
  detailValue: {
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 12 : 10, textSizeMultiplier),
    fontWeight: '500',
    color: colors.text,
  },
  trendValue: {
    paddingHorizontal: Platform.OS === 'ios' ? 12 : 10,
    paddingVertical: 6,
    borderRadius: 16,
  },
  trendValueText: {
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 16 : 14, textSizeMultiplier),
    fontWeight: '600',
  },
  vaultCard: {
    marginBottom: Platform.OS === 'ios' ? 12 : 10 ,
    padding: Platform.OS === 'ios' ? 16 : 10,
  },
  emptyVaultCard: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyVaultText: {
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 16 : 14, textSizeMultiplier),
    fontWeight: '500',
    color: colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyVaultSubtext: {
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 14 : 12, textSizeMultiplier),
    color: colors.textSecondary,
    textAlign: 'center',
  },
  vaultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  vaultTitle: {
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 16 : 14, textSizeMultiplier),
    fontWeight: '500',
    color: colors.text,
    maxWidth: '80%',
  },
  vaultStatus: {
    paddingHorizontal: Platform.OS === 'ios' ? 8 : 6,
    paddingVertical: 4,
    borderRadius: 12,
  },
  vaultStatusText: {
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 12 : 10, textSizeMultiplier),
    fontWeight: '500',
  },
  vaultStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Platform.OS === 'ios' ? 16 : 10,
  },
  vaultStat: {
    alignItems: 'center',
  },
  vaultStatLabel: {
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 12 : 10, textSizeMultiplier),
    color: colors.textSecondary,
    marginBottom: 4,
  },
  vaultStatValue: {
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 14 : 12, textSizeMultiplier),
    fontWeight: '600',
    color: colors.text,
  },
  progressBar: {
    height: 2,
    backgroundColor: colors.border,
    borderRadius: 2,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#1E3A8A',
    borderRadius: 2,
  },
  loadMoreButton: {
    marginTop: Platform.OS === 'ios' ? 12 : 10,
    backgroundColor: colors.primary,
  },
  loginPromptContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loginPromptCard: {
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    maxWidth: 400,
  },
  loginPromptTitle: {
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 20 : 18, textSizeMultiplier),
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  loginPromptText: {
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 14 : 12, textSizeMultiplier),
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  loginPromptButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  loginPromptButtonText: {
    color: '#FFFFFF',
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 16 : 14, textSizeMultiplier),
    fontWeight: '600',
  },
  planInsightContent: {
    flex: 1,
  },
  planInsightHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
  },
  planInsightIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  planInsightText: {
    flex: 1,
  },
});
