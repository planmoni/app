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

export default function ExpensePlansSection() {
  const { colors, isDark } = useTheme();
  const { textSizeMultiplier } = useTextSize();
  const haptics = useHaptics();
  const { expensePlans, isLoading } = useExpensePlans();

  // Show all plans (draft, active, etc.) - limit to 5 for home page
  const displayedPlans = useMemo(() => expensePlans.slice(0, 5), [expensePlans]);

  const handleViewAll = () => {
    haptics.selection();
    router.push('/expense-planner');
  };

  const handleCreatePlan = () => {
    haptics.mediumImpact();
    router.push({
      pathname: '/expense-planner/create/plan-details',
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
        <Text style={styles.sectionTitle}>Your budget plans</Text>
        <Pressable onPress={handleViewAll} style={styles.viewAllButton}>
          <Text style={styles.viewAllText}>View All</Text>
        </Pressable>
      </View>

      {expensePlans.length === 0 ? (
        <View style={styles.emptyExpensePlansContainer}>
          <Text style={styles.emptyExpensePlansText}>No spending plans yet</Text>
          <Pressable onPress={handleCreatePlan} style={styles.createFirstExpensePlanButton}>
            <Plus size={20} color={colors.text} />
            <Text style={styles.createFirstExpensePlanText}>Create your first spending plan</Text>
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
                  haptics.selection();
                  router.push(`/expense-planner/${plan.id}`);
                }}
              />
            </View>
          ))}
          <Pressable onPress={handleCreatePlan} style={styles.addExpensePlanCard}>
            <Plus size={24} color={colors.text} />
            <Text style={styles.addExpensePlanText}>Create spending plan</Text>
            <Text style={styles.addExpensePlanDescription}>
              Set up a category budget with guardrails
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
      fontSize: getScaledFontSize(Platform.OS === 'ios' ? 16 : 14, textSizeMultiplier),
      fontWeight: '600',
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
      width: 300,
      backgroundColor: colors.backgroundSecondary,
      borderWidth: 2,
      borderColor: colors.border,
      borderStyle: 'dashed',
      borderRadius: 16,
      padding: 24,
      alignItems: 'center',
      justifyContent: 'center',
    },
    addExpensePlanText: {
      fontSize: getScaledFontSize(14, textSizeMultiplier),
      fontWeight: '600',
      color: colors.primary,
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

