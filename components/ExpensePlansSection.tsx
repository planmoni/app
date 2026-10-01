import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Platform } from 'react-native';
import { router } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useTextSize } from '@/contexts/TextSizeContext';
import { getScaledFontSize } from '@/lib/textSize';
import { useHaptics } from '@/hooks/useHaptics';
import ExpensePlanCard from '@/components/expense-planner/ExpensePlanCard';
import { useExpensePlans } from '@/hooks/useExpensePlans';
import { isBudgetStarted } from '@/lib/expensePlanUtils';

type ExpensePlansSectionProps = {
  onRequireAuth?: () => boolean;
};

export default function ExpensePlansSection({ onRequireAuth }: ExpensePlansSectionProps) {
  const { colors, isDark } = useTheme();
  const { textSizeMultiplier } = useTextSize();
  const haptics = useHaptics();
  const { expensePlans, isLoading } = useExpensePlans();

  // Filter out ongoing/started budgets - only show plans that haven't started
  const displayedPlans = useMemo(() => {
    const filteredPlans = expensePlans.filter(plan => {
      // Exclude plans that have started (ongoing budgets)
      return !isBudgetStarted(plan.start_date);
    });
    return filteredPlans.slice(0, 5);
  }, [expensePlans]);

  const handleViewAll = () => {
    if (onRequireAuth && !onRequireAuth()) return;
    haptics.selection();
    router.push('/expense-planner');
  };

  const handleCreatePlan = () => {
    if (onRequireAuth && !onRequireAuth()) return;
    haptics.mediumImpact();
    router.push({
      pathname: '/create-vault/plan-details',
      params: {
        planTypes: JSON.stringify(['one_time']),
      },
    });
  };

  const styles = createStyles(colors, isDark, textSizeMultiplier);

  if (isLoading) {
    return null;
  }

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Your vaults</Text>
        <Pressable onPress={handleViewAll} style={styles.viewAllButton}>
          <Text style={styles.viewAllText}>View All</Text>
        </Pressable>
      </View>

      {expensePlans.length === 0 ? (
        <View style={styles.emptyExpensePlansContainer}>
          <Text style={styles.emptyExpensePlansText}>No vaults yet</Text>
          <Pressable onPress={handleCreatePlan} style={styles.createFirstExpensePlanButton}>
            <Plus size={20} color={colors.text} />
            <Text style={styles.createFirstExpensePlanText}>Create your first vault</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.expensePlansContainer}
        >
          {displayedPlans.map(plan => (
            <View key={plan.id} style={styles.expensePlanCardWrapper}>
              <ExpensePlanCard
                plan={plan}
                onPress={() => {
                  if (onRequireAuth && !onRequireAuth()) return;
                  haptics.selection();
                  router.push(`/expense-planner/${plan.id}`);
                }}
              />
            </View>
          ))}
          <Pressable onPress={handleCreatePlan} style={styles.addExpensePlanCard}>
            <Plus size={24} color={colors.text} />
            <Text style={styles.addExpensePlanText}>Create vault</Text>
            <Text style={styles.addExpensePlanDescription}>
              Set up a funded vault for your future spending
            </Text>
          </Pressable>
        </ScrollView>
      )}
    </View>
  );
}

const createStyles = (colors: any, isDark: boolean, textSizeMultiplier: number) =>
  StyleSheet.create({
    section: {
      marginBottom: 10,
    },
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: Platform.OS === 'ios' ? 10 : 5,
    },
    sectionTitle: {
      fontSize: getScaledFontSize(14, textSizeMultiplier),
      fontWeight: '700',
      color: colors.text,
    },
    viewAllButton: {
      paddingVertical: 4,
    },
    viewAllText: {
      fontSize: getScaledFontSize(Platform.OS === 'ios' ? 14 : 12, textSizeMultiplier),
      color: colors.text,
      fontWeight: '600',
    },
    expensePlansContainer: {
      paddingRight: 1,
    },
    expensePlanCardWrapper: {
      width: Platform.OS === 'ios' ? 300 : 280,
      marginRight: Platform.OS === 'ios' ? 16 : 10,
    },
    addExpensePlanCard: {
      width: 220,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      padding: 16,
      alignItems: 'flex-start',
      justifyContent: 'center',
    },
    addExpensePlanText: {
      fontSize: getScaledFontSize(14, textSizeMultiplier),
      fontWeight: '600',
      color: isDark ? colors.text : colors.primary,
      marginTop: 12,
      marginBottom: 4,
    },
    addExpensePlanDescription: {
      fontSize: getScaledFontSize(16, textSizeMultiplier),
      color: colors.textSecondary,
      textAlign: 'center',
    },
    emptyExpensePlansContainer: {
      padding: 40,
      alignItems: 'center',
      backgroundColor: colors.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    emptyExpensePlansText: {
      fontSize: getScaledFontSize(14, textSizeMultiplier),
      color: colors.textSecondary,
      marginBottom: 10,
    },
    createFirstExpensePlanButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.backgroundTertiary,
      paddingHorizontal: 20,
      paddingVertical: 12,
      height: 55,
      borderRadius: 20,
    },
    createFirstExpensePlanText: {
      color: colors.text,
      fontSize: getScaledFontSize(14, textSizeMultiplier),
      fontWeight: '600',
    },
  });

