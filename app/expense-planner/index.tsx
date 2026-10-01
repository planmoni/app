import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Plus, Search, ArrowLeft } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useTextSize } from '@/contexts/TextSizeContext';
import { getScaledFontSize } from '@/lib/textSize';
import { useHaptics } from '@/hooks/useHaptics';
import ExpensePlanCard from '@/components/expense-planner/ExpensePlanCard';
import { useExpensePlans } from '@/hooks/useExpensePlans';
import { trackLifecycleEvent } from '@/lib/lifecycleTracking';
import { LifecycleEventName } from '@/lib/lifecycleEvents';

export default function ExpensePlannerOverviewScreen() {
  const { colors, isDark } = useTheme();
  const { textSizeMultiplier } = useTextSize();
  const haptics = useHaptics();
  const { expensePlans, isLoading, fetchExpensePlans } = useExpensePlans();
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    void trackLifecycleEvent(LifecycleEventName.VAULT_FLOW_OPENED, { source: 'expense_planner_list' });
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await fetchExpensePlans();
      haptics.notification();
    } catch (error) {
      console.error('Error refreshing plans:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleCreatePlan = () => {
    haptics.mediumImpact();
    router.push({
      pathname: '/create-vault/plan-details',
      params: {
        planTypes: JSON.stringify(['one_time']),
      },
    });
  };

  const styles = createStyles(colors, isDark, textSizeMultiplier);

  const handleBack = () => {
    haptics.selection();
    router.back();
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={handleBack} style={styles.backButton}>
          <ArrowLeft size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Your Vaults</Text>
        <Pressable
          onPress={handleCreatePlan}
          style={styles.createButton}
        >
          <Plus size={24} color={colors.primary} />
        </Pressable>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
        }
      >
        {isLoading ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>Loading plans...</Text>
          </View>
        ) : expensePlans.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>No expense plans yet</Text>
            <Text style={styles.emptySubtitle}>
              Create your first plan to start managing your expenses
            </Text>
            <Pressable onPress={handleCreatePlan} style={styles.createFirstButton}>
              <Plus size={20} color={colors.primary} />
              <Text style={styles.createFirstButtonText}>Create Your First Plan</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={styles.plansList}>
              {expensePlans.map(plan => (
                <ExpensePlanCard
                  key={plan.id}
                  plan={plan}
                  onPress={() => {
                    haptics.selection();
                    router.push(`/expense-planner/${plan.id}`);
                  }}
                />
              ))}
            </View>
            <Pressable onPress={handleCreatePlan} style={styles.addPlanCard}>
              <Plus size={24} color={colors.primary} />
              <Text style={styles.addPlanText}>Create New Plan</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
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
      paddingVertical: 16,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    backButton: {
      padding: 8,
      marginLeft: -8,
    },
    headerTitle: {
      fontSize: getScaledFontSize(24, textSizeMultiplier),
      fontWeight: '700',
      color: colors.text,
      flex: 1,
      textAlign: 'center',
    },
    createButton: {
      width: 40,
      height: 40,
      justifyContent: 'center',
      alignItems: 'center',
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      padding: 16,
    },
    plansList: {
      gap: 12,
      marginBottom: 16,
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: 60,
    },
    emptyTitle: {
      fontSize: getScaledFontSize(20, textSizeMultiplier),
      fontWeight: '600',
      color: colors.text,
      marginBottom: 8,
    },
    emptySubtitle: {
      fontSize: getScaledFontSize(14, textSizeMultiplier),
      color: colors.textSecondary,
      textAlign: 'center',
      marginBottom: 24,
      paddingHorizontal: 40,
    },
    createFirstButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.primary + '20',
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.primary,
    },
    createFirstButtonText: {
      fontSize: getScaledFontSize(16, textSizeMultiplier),
      fontWeight: '600',
      color: colors.primary,
    },
    addPlanCard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 20,
      borderWidth: 2,
      borderColor: colors.border,
      borderStyle: 'dashed',
    },
    addPlanText: {
      fontSize: getScaledFontSize(16, textSizeMultiplier),
      fontWeight: '600',
      color: colors.primary,
    },
  });
