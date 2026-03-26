import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ArrowLeft, Send, X } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useTextSize } from '@/contexts/TextSizeContext';
import { getScaledFontSize } from '@/lib/textSize';
import { useHaptics } from '@/hooks/useHaptics';
import { useExpensePlans } from '@/hooks/useExpensePlans';
import { isBudgetStarted } from '@/lib/expensePlanUtils';
export default function SpendScreen() {
  const { colors, isDark } = useTheme();
  const { textSizeMultiplier } = useTextSize();
  const haptics = useHaptics();
  const { expensePlans, isLoading } = useExpensePlans();

  // Filter budgets that have started
  const startedBudgets = useMemo(() => {
    if (!expensePlans || expensePlans.length === 0) return [];
    
    return expensePlans.filter(plan => {
      const started = isBudgetStarted(plan.start_date);
      return started;
    });
  }, [expensePlans]);

  const formatBalance = (amount: number) => {
    if (!amount) return '₦0';
    return `₦${amount.toLocaleString('en-NG')}`;
  };

  const handleBack = () => {
    haptics.selection();
    router.back();
  };

  const handleClose = () => {
    haptics.selection();
    router.replace('/(tabs)');
  };

  const handleSpend = (planId: string) => {
    haptics.mediumImpact();
    router.push(`/spend/${planId}`);
  };

  const styles = createStyles(colors, isDark, textSizeMultiplier);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={handleBack} style={styles.backButton}>
          <ArrowLeft size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Vault Spend</Text>
        <Pressable onPress={handleClose} style={styles.closeButton}>
          <X size={20} color={colors.text} />
        </Pressable>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        {isLoading ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Loading...</Text>
          </View>
        ) : (
          <>
            {/* Started budgets section */}
            {startedBudgets.length > 0 ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Started vaults</Text>
                <View style={styles.budgetsList}>
                  {startedBudgets.map(plan => {
                    const currentBalance = (plan as any).current_balance || 0;

                    return (
                      <View key={plan.id} style={styles.budgetCard}>
                        <View style={styles.budgetCardContent}>
                          <View style={styles.budgetInfo}>
                            <Text style={styles.budgetName} numberOfLines={1}>
                              {plan.name}
                            </Text>
                            <Text style={styles.budgetAmount}>
                              {formatBalance(currentBalance)}
                            </Text>
                          </View>
                          <Pressable
                            style={styles.spendButton}
                            onPress={() => handleSpend(plan.id)}
                          >
                            <Send size={18} color={colors.primary} />
                            <Text style={styles.spendButtonText}>Spend</Text>
                          </Pressable>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            ) : (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyTitle}>No vaults ready to spend yet</Text>
                <Text style={styles.emptySubtitle}>
                  Vault savings that are ready to spend will appear here
                </Text>
              </View>
            )}
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
    closeButton: {
      padding: 8,
      marginRight: -8,
    },
    headerTitle: {
      fontSize: getScaledFontSize(20, textSizeMultiplier),
      fontWeight: '700',
      color: colors.text,
      flex: 1,
      textAlign: 'center',
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      padding: 16,
      paddingBottom: 32,
    },
    section: {
      marginBottom: 24,
    },
    sectionTitle: {
      fontSize: getScaledFontSize(16, textSizeMultiplier),
      fontWeight: '600',
      color: colors.text,
      marginBottom: 12,
    },
    availableToSpendCard: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 20,
      borderWidth: 1,
      borderColor: colors.border,
    },
    availableToSpendContent: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 16,
    },
    availableToSpendInfo: {
      flex: 1,
      gap: 4,
    },
    availableToSpendAmount: {
      fontSize: getScaledFontSize(28, textSizeMultiplier),
      fontWeight: '700',
      color: colors.primary,
      marginBottom: 2,
    },
    availableToSpendLabel: {
      fontSize: getScaledFontSize(13, textSizeMultiplier),
      color: colors.textSecondary,
    },
    budgetsList: {
      gap: 12,
    },
    budgetCard: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 20,
      borderWidth: 1,
      borderColor: colors.border,
    },
    budgetCardContent: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 16,
    },
    budgetInfo: {
      flex: 1,
      gap: 4,
    },
    budgetName: {
      fontSize: getScaledFontSize(18, textSizeMultiplier),
      fontWeight: '700',
      color: colors.text,
      marginBottom: 4,
    },
    budgetAmount: {
      fontSize: getScaledFontSize(24, textSizeMultiplier),
      fontWeight: '700',
      color: colors.text,
      marginBottom: 2,
    },
    spendButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      backgroundColor: colors.primary + '15',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.primary + '30',
      minWidth: 90,
    },
    spendButtonDisabled: {
      backgroundColor: colors.backgroundTertiary,
      borderColor: colors.border,
    },
    spendButtonText: {
      fontSize: getScaledFontSize(15, textSizeMultiplier),
      fontWeight: '600',
      color: colors.primary,
    },
    spendButtonTextDisabled: {
      color: colors.textTertiary,
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
      paddingHorizontal: 40,
    },
    emptyText: {
      fontSize: getScaledFontSize(14, textSizeMultiplier),
      color: colors.textSecondary,
    },
  });

