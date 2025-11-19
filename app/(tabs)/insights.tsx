import { View, Text, StyleSheet, ScrollView, Platform } from 'react-native';
import { TrendingUp, TrendingDown, Users, ArrowUpRight, ArrowDownRight, Wallet, Clock, Calendar, Send } from 'lucide-react-native';
import Card from '@/components/Card';
import { useMemo } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { useInsightsData } from '@/hooks/useInsightsData';
import { useRealtimePayoutPlans } from '@/hooks/useRealtimePayoutPlans';
import PlanmoniLoader from '@/components/PlanmoniLoader';
import Button from '@/components/Button';
import SummaryCard from '@/components/SummaryCard';


export default function InsightsScreen() {
  const { colors, isDark } = useTheme();
  const { metrics, trends, vaultStats, isLoading, error, refreshInsights } = useInsightsData();
  const { payoutPlans, isLoading: payoutPlansLoading } = useRealtimePayoutPlans();

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
  const totalPaidOut = payoutPlans.reduce((sum, plan) => 
    sum + (plan.completed_payouts * plan.payout_amount), 0
  );
  
  const pendingPayouts = payoutPlans
    .filter(plan => plan.status === 'active')
    .reduce((sum, plan) => 
      sum + ((plan.duration - plan.completed_payouts) * plan.payout_amount), 0
    );

  const completionRate = payoutPlans.length > 0 
    ? Math.round((payoutPlans.filter(plan => plan.status === 'completed').length / payoutPlans.length) * 100)
    : 0;

  // Get active payout plans for display
  const activePlans = payoutPlans.filter(plan => plan.status === 'active');

  // Find the last payout date - the most recent completed payout
  const getLastPayoutDate = () => {
    // Sort all plans by their completed_payouts and find the most recent one
    const completedPayouts = payoutPlans.filter(plan => plan.completed_payouts > 0);
    
    if (completedPayouts.length === 0) {
      return 'No payouts yet';
    }
    
    // For simplicity, we'll use the start_date and completed_payouts to estimate the last payout date
    // In a real app, you would track actual payout dates in transactions
    const mostRecentPlan = completedPayouts.reduce((latest, current) => {
      const latestDate = new Date(latest.start_date);
      const currentDate = new Date(current.start_date);
      
      // Add time based on frequency and completed payouts
      let latestPayoutDate = new Date(latestDate);
      let currentPayoutDate = new Date(currentDate);
      
      if (latest.frequency === 'weekly') {
        latestPayoutDate.setDate(latestDate.getDate() + (7 * (latest.completed_payouts - 1)));
      } else if (latest.frequency === 'biweekly') {
        latestPayoutDate.setDate(latestDate.getDate() + (14 * (latest.completed_payouts - 1)));
      } else if (latest.frequency === 'monthly') {
        latestPayoutDate.setMonth(latestDate.getMonth() + (latest.completed_payouts - 1));
      }
      
      if (current.frequency === 'weekly') {
        currentPayoutDate.setDate(currentDate.getDate() + (7 * (current.completed_payouts - 1)));
      } else if (current.frequency === 'biweekly') {
        currentPayoutDate.setDate(currentDate.getDate() + (14 * (current.completed_payouts - 1)));
      } else if (current.frequency === 'monthly') {
        currentPayoutDate.setMonth(currentDate.getMonth() + (current.completed_payouts - 1));
      }
      
      return currentPayoutDate > latestPayoutDate ? current : latest;
    });
    
    // Calculate the estimated last payout date
    const startDate = new Date(mostRecentPlan.start_date);
    let lastPayoutDate = new Date(startDate);
    
    if (mostRecentPlan.frequency === 'weekly') {
      lastPayoutDate.setDate(startDate.getDate() + (7 * (mostRecentPlan.completed_payouts - 1)));
    } else if (mostRecentPlan.frequency === 'biweekly') {
      lastPayoutDate.setDate(startDate.getDate() + (14 * (mostRecentPlan.completed_payouts - 1)));
    } else if (mostRecentPlan.frequency === 'monthly') {
      lastPayoutDate.setMonth(startDate.getMonth() + (mostRecentPlan.completed_payouts - 1));
    }
    
    return lastPayoutDate.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const styles = createStyles(colors, isDark);

  if (isLoading || payoutPlansLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Insights</Text>
        </View>
        <View style={styles.loadingContainer}>
          <PlanmoniLoader size="medium" description="Loading insights data..." />
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Insights</Text>
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
                      { color: trend.positive ? colors.text : colors.error }
                    ]}>
                      {trend.value}
                    </Text>
                  </View>
                </View>
              </Card>
            ))}
          </View>
          

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
              vaultStats.map((vault, index) => (
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
              ))
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundSecondary,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: Platform.OS === 'ios' ? 24 : 20,
    fontWeight: '700',
    color: colors.text,
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
    fontSize: Platform.OS === 'ios' ? 16 : 14,
    color: colors.textSecondary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    fontSize: Platform.OS === 'ios' ? 16 : 14,
    color: colors.error,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    minWidth: Platform.OS === 'ios' ? 120 : 100,
    backgroundColor: colors.primary,
  },
  sectionTitle: {
    fontSize: Platform.OS === 'ios' ? 18 : 16,
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
    fontSize: Platform.OS === 'ios' ? 14 : 12,
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
    fontSize: Platform.OS === 'ios' ? 24 : 20,
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
    fontSize: Platform.OS === 'ios' ? 14 : 12,
    fontWeight: '500',
  },
  metricDescription: {
    fontSize: Platform.OS === 'ios' ? 12 : 10,
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
    fontSize: Platform.OS === 'ios' ? 16 : 14,
    fontWeight: '500',
    color: colors.text,
    marginBottom: 4,
  },
  trendDescription: {
    fontSize: Platform.OS === 'ios' ? 14 : 12,
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
    fontSize: Platform.OS === 'ios' ? 12 : 10,
    color: colors.textSecondary,
  },
  detailValue: {
    fontSize: Platform.OS === 'ios' ? 12 : 10,
    fontWeight: '500',
    color: colors.text,
  },
  trendValue: {
    paddingHorizontal: Platform.OS === 'ios' ? 12 : 10,
    paddingVertical: 6,
    borderRadius: 16,
  },
  trendValueText: {
    fontSize: Platform.OS === 'ios' ? 16 : 14,
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
    fontSize: Platform.OS === 'ios' ? 16 : 14,
    fontWeight: '500',
    color: colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyVaultSubtext: {
    fontSize: Platform.OS === 'ios' ? 14 : 12,
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
    fontSize: Platform.OS === 'ios' ? 16 : 14,
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
    fontSize: Platform.OS === 'ios' ? 12 : 10,
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
    fontSize: Platform.OS === 'ios' ? 12 : 10,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  vaultStatValue: {
    fontSize: Platform.OS === 'ios' ? 14 : 12,
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
});
