import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Plus } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useTextSize } from '@/contexts/TextSizeContext';
import { getScaledFontSize } from '@/lib/textSize';
import { useHaptics } from '@/hooks/useHaptics';
import ExpenseBucketCard from '@/components/expense-planner/ExpenseBucketCard';
import PieChart from '@/components/expense-planner/PieChart';
import BarChart from '@/components/expense-planner/BarChart';
import { ExpensePlan, ExpenseBucket } from '@/types/expense-planner';
import { useExpensePlans } from '@/hooks/useExpensePlans';
import { useExpenseBuckets } from '@/hooks/useExpenseBuckets';

const CATEGORY_COLORS: Record<string, string> = {
  travel: '#3B82F6',
  food: '#F59E0B',
  shopping: '#EC4899',
  entertainment: '#8B5CF6',
  bills: '#10B981',
  health: '#EF4444',
  education: '#6366F1',
  transportation: '#14B8A6',
  housing: '#F97316',
  personal: '#A855F7',
};

export default function PlanDetailScreen() {
  const { colors, isDark } = useTheme();
  const { textSizeMultiplier } = useTextSize();
  const haptics = useHaptics();
  const { id } = useLocalSearchParams();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { expensePlans, fetchExpensePlans } = useExpensePlans();
  const { buckets, fetchBuckets } = useExpenseBuckets(id as string);

  const plan = expensePlans.find(p => p.id === id) || null;

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([fetchExpensePlans(), fetchBuckets()]);
      haptics.notification();
    } catch (error) {
      console.error('Error refreshing plan:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleLogExpense = () => {
    haptics.mediumImpact();
    router.push({
      pathname: '/expense-planner/log-expense',
      params: { planId: id as string },
    });
  };

  const pieChartData = useMemo(() => {
    return buckets.map(bucket => ({
      label: bucket.name,
      value: bucket.target_amount,
      color: CATEGORY_COLORS[bucket.name.toLowerCase()] || colors.primary,
    }));
  }, [buckets, colors.primary]);

  const barChartData = useMemo(() => {
    return buckets.map(bucket => ({
      label: bucket.name,
      allocated: bucket.target_amount,
      spent: bucket.amount_spent,
      color: CATEGORY_COLORS[bucket.name.toLowerCase()] || colors.primary,
    }));
  }, [buckets, colors.primary]);

  const maxBarValue = useMemo(() => {
    return Math.max(
      ...buckets.map(b => Math.max(b.target_amount, b.amount_spent)),
      plan?.total_budget || 0
    );
  }, [buckets, plan]);

  const styles = createStyles(colors, isDark, textSizeMultiplier);

  if (!plan) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft size={24} color={colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Plan Not Found</Text>
          <View style={styles.placeholder} />
        </View>
      </SafeAreaView>
    );
  }

  const percentageUsed = plan.total_budget > 0 ? (plan.total_spent / plan.total_budget) * 100 : 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {plan.name}
        </Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />}
      >
        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <View>
              <Text style={styles.summaryLabel}>Total Budget</Text>
              <Text style={styles.summaryAmount}>₦{plan.total_budget.toLocaleString()}</Text>
            </View>
            <View style={styles.summaryRight}>
              <Text style={styles.summaryLabel}>Remaining</Text>
              <Text
                style={[
                  styles.summaryAmount,
                  plan.remaining_budget < 0 && styles.overBudgetAmount,
                ]}
              >
                ₦{Math.abs(plan.remaining_budget).toLocaleString()}
              </Text>
            </View>
          </View>
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${Math.min(Math.max(percentageUsed, 0), 100)}%`,
                    backgroundColor:
                      percentageUsed > 100
                        ? '#EF4444'
                        : percentageUsed > 75
                        ? '#F97316'
                        : '#22C55E',
                  },
                ]}
              />
            </View>
            <Text style={styles.progressText}>{Math.round(percentageUsed)}% used</Text>
          </View>
        </View>

        {buckets.length > 0 && (
          <>
            <View style={styles.chartCard}>
              <Text style={styles.chartTitle}>Budget Distribution</Text>
              <PieChart data={pieChartData} total={plan.total_budget} />
            </View>

            <View style={styles.chartCard}>
              <BarChart data={barChartData} maxValue={maxBarValue} />
            </View>
          </>
        )}

        <View style={styles.bucketsSection}>
          <Text style={styles.sectionTitle}>Expense Buckets</Text>
          {buckets.length === 0 ? (
            <View style={styles.emptyBuckets}>
              <Text style={styles.emptyText}>No expense buckets yet</Text>
            </View>
          ) : (
            buckets.map(bucket => (
              <ExpenseBucketCard key={bucket.id} bucket={bucket} />
            ))
          )}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable onPress={handleLogExpense} style={styles.logButton}>
          <Plus size={20} color="#fff" />
          <Text style={styles.logButtonText}>Log New Expense</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const createStyles = (colors: any, isDark: boolean, textSizeMultiplier: number) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.backgroundSecondary,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    backButton: {
      padding: 8,
    },
    headerTitle: {
      fontSize: getScaledFontSize(20, textSizeMultiplier),
      fontWeight: '700',
      color: colors.text,
      flex: 1,
      textAlign: 'center',
    },
    placeholder: {
      width: 40,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      padding: 16,
    },
    summaryCard: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 20,
      marginBottom: 24,
      borderWidth: 1,
      borderColor: colors.border,
    },
    summaryRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 20,
    },
    summaryRight: {
      alignItems: 'flex-end',
    },
    summaryLabel: {
      fontSize: getScaledFontSize(14, textSizeMultiplier),
      color: colors.textSecondary,
      marginBottom: 4,
    },
    summaryAmount: {
      fontSize: getScaledFontSize(24, textSizeMultiplier),
      fontWeight: '700',
      color: colors.text,
    },
    overBudgetAmount: {
      color: '#EF4444',
    },
    progressContainer: {
      marginTop: 8,
    },
    progressBar: {
      height: 8,
      backgroundColor: colors.backgroundTertiary,
      borderRadius: 4,
      overflow: 'hidden',
      marginBottom: 8,
    },
    progressFill: {
      height: '100%',
      borderRadius: 4,
    },
    progressText: {
      fontSize: getScaledFontSize(12, textSizeMultiplier),
      color: colors.textSecondary,
      textAlign: 'right',
    },
    chartCard: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 20,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    chartTitle: {
      fontSize: getScaledFontSize(18, textSizeMultiplier),
      fontWeight: '600',
      color: colors.text,
      marginBottom: 16,
    },
    bucketsSection: {
      marginBottom: 24,
    },
    sectionTitle: {
      fontSize: getScaledFontSize(18, textSizeMultiplier),
      fontWeight: '600',
      color: colors.text,
      marginBottom: 16,
    },
    emptyBuckets: {
      padding: 40,
      alignItems: 'center',
    },
    emptyText: {
      fontSize: getScaledFontSize(14, textSizeMultiplier),
      color: colors.textSecondary,
    },
    footer: {
      padding: 16,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.backgroundSecondary,
    },
    logButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: colors.primary,
      paddingVertical: 16,
      borderRadius: 20,
    },
    logButtonText: {
      fontSize: getScaledFontSize(16, textSizeMultiplier),
      fontWeight: '600',
      color: '#fff',
    },
  });
