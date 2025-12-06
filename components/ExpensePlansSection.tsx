import React from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { ChevronRight, Plus } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useTextSize } from '@/contexts/TextSizeContext';
import { getScaledFontSize } from '@/lib/textSize';
import { useHaptics } from '@/hooks/useHaptics';
import ExpensePlanCard from '@/components/expense-planner/ExpensePlanCard';
import { useExpensePlans } from '@/hooks/useExpensePlans';
import { ExpensePlan } from '@/types/expense-planner';

export default function ExpensePlansSection() {
  const { colors, isDark } = useTheme();
  const { textSizeMultiplier } = useTextSize();
  const haptics = useHaptics();
  const { expensePlans, isLoading } = useExpensePlans();

  const activePlans = expensePlans.filter(plan => plan.status === 'active').slice(0, 3);

  const handleViewAll = () => {
    haptics.selection();
    router.push('/expense-planner');
  };

  const handleCreatePlan = () => {
    haptics.mediumImpact();
    router.push('/expense-planner');
  };

  const styles = createStyles(colors, isDark, textSizeMultiplier);

  if (isLoading) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Expense Plans</Text>
        <Pressable onPress={handleViewAll} style={styles.viewAllButton}>
          <Text style={styles.viewAllText}>View All</Text>
          <ChevronRight size={16} color={colors.primary} />
        </Pressable>
      </View>

      {expensePlans.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No expense plans yet</Text>
          <Pressable onPress={handleCreatePlan} style={styles.createButton}>
            <Plus size={18} color="#fff" />
            <Text style={styles.createButtonText}>Create Expense Plan</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.cardsContainer}
        >
          {activePlans.map(plan => (
            <View key={plan.id} style={styles.cardWrapper}>
              <ExpensePlanCard
                plan={plan}
                onPress={() => {
                  haptics.selection();
                  router.push(`/expense-planner/${plan.id}`);
                }}
              />
            </View>
          ))}
          {expensePlans.length > 3 && (
            <Pressable onPress={handleViewAll} style={styles.moreCard}>
              <Text style={styles.moreText}>View All Plans</Text>
              <ChevronRight size={24} color={colors.primary} />
            </Pressable>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const createStyles = (colors: any, isDark: boolean, textSizeMultiplier: number) =>
  StyleSheet.create({
    container: {
      marginBottom: 24,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
      paddingHorizontal: 16,
    },
    title: {
      fontSize: getScaledFontSize(20, textSizeMultiplier),
      fontWeight: '700',
      color: colors.text,
    },
    viewAllButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    viewAllText: {
      fontSize: getScaledFontSize(14, textSizeMultiplier),
      fontWeight: '600',
      color: colors.primary,
    },
    emptyContainer: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 24,
      alignItems: 'center',
      marginHorizontal: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    emptyText: {
      fontSize: getScaledFontSize(14, textSizeMultiplier),
      color: colors.textSecondary,
      marginBottom: 16,
    },
    createButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.primary,
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderRadius: 20,
    },
    createButtonText: {
      fontSize: getScaledFontSize(14, textSizeMultiplier),
      fontWeight: '600',
      color: '#fff',
    },
    cardsContainer: {
      paddingHorizontal: 16,
      gap: 12,
    },
    cardWrapper: {
      width: 320,
      marginRight: 12,
    },
    moreCard: {
      width: 200,
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 20,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 2,
      borderColor: colors.primary,
      borderStyle: 'dashed',
      marginRight: 12,
    },
    moreText: {
      fontSize: getScaledFontSize(14, textSizeMultiplier),
      fontWeight: '600',
      color: colors.primary,
      marginBottom: 8,
    },
  });

