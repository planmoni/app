import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, X } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useTextSize } from '@/contexts/TextSizeContext';
import { getScaledFontSize } from '@/lib/textSize';
import { useHaptics } from '@/hooks/useHaptics';
import KeyboardAvoidingWrapper from '@/components/KeyboardAvoidingWrapper';
import FloatingButton from '@/components/FloatingButton';
import { Platform } from 'react-native';
import { useExpensePlans } from '@/hooks/useExpensePlans';

export default function ExpensePlannerScreen() {
  const { colors, isDark } = useTheme();
  const { textSizeMultiplier } = useTextSize();
  const haptics = useHaptics();
  const params = useLocalSearchParams();
  const { saveDraftExpensePlan, saveLastStep } = useExpensePlans();
  const planId = params.planId as string | undefined;
  const subCategories = params.subCategories as string | undefined;
  const [amount, setAmount] = useState('');
  const [budgetStructure, setBudgetStructure] = useState<'fixed' | 'estimated' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const amountInputRef = useRef<TextInput>(null);

  useEffect(() => {
    const timeout = setTimeout(() => {
      amountInputRef.current?.focus();
    }, 300);
    return () => clearTimeout(timeout);
  }, []);

  const formatAmount = (value: string) => {
    let cleanValue = value.replace(/[^0-9.]/g, '');
    const parts = cleanValue.split('.');
    if (parts.length > 2) {
      const integerPart = parts[0];
      const decimalPart = parts.slice(1).join('');
      cleanValue = integerPart + '.' + decimalPart;
    }
    if (parts.length === 2 && parts[1].length > 2) {
      cleanValue = parts[0] + '.' + parts[1].substring(0, 2);
    }
    const numericValue = parseFloat(cleanValue);
    if (!isNaN(numericValue)) {
      return numericValue.toLocaleString('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      });
    }
    return cleanValue;
  };

  const handleAmountChange = (value: string) => {
    const formatted = formatAmount(value);
    setAmount(formatted);
    setError(null);
  };

  const handleContinue = async () => {
    if (!amount) {
      setError('Please enter a budget amount');
      haptics.notification();
      return;
    }

    const numericAmount = parseFloat(amount.replace(/,/g, ''));
    if (isNaN(numericAmount) || numericAmount <= 0) {
      setError('Please enter a valid amount');
      haptics.notification();
      return;
    }

    if (numericAmount < 1000) {
      setError('Minimum budget is ₦1,000');
      haptics.notification();
      return;
    }

    if (!budgetStructure) {
      setError('Please select a budget structure');
      haptics.notification();
      return;
    }

    haptics.mediumImpact();
    setIsCreating(true);
    setError(null);

    try {
      // Use existing planId if available (from plan-details), otherwise create new
      let activePlanId = planId;
      let draftPlan;

      if (activePlanId) {
        // Update existing draft plan with budget info
        draftPlan = await saveDraftExpensePlan({
          planId: activePlanId,
          total_budget: numericAmount,
          budget_structure: budgetStructure,
        });
      } else {
        // Create new draft plan
        draftPlan = await saveDraftExpensePlan({
          total_budget: numericAmount,
          budget_structure: budgetStructure,
        });
      }

      if (!draftPlan || !draftPlan.id) {
        throw new Error('Failed to create draft plan: No plan ID returned');
      }

      // Navigate to dates with planId and subCategories if available
      const navigationParams: any = {
        totalBudget: amount.replace(/,/g, ''),
        budgetStructure,
        planId: draftPlan.id,
      };

      // If we have subCategories from plan-details, pass them along
      if (subCategories) {
        navigationParams.subCategories = subCategories;
      }

      router.push({
        pathname: '/expense-planner/create/dates',
        params: navigationParams,
    });
    } catch (error) {
      console.error('Error creating draft plan:', error);
      setError('Failed to create plan. Please try again.');
      Alert.alert('Error', 'Failed to create expense plan. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  const styles = createStyles(colors, isDark, textSizeMultiplier);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable
          onPress={() => {
            haptics.lightImpact();
            router.back();
          }}
          style={styles.backButton}
        >
          <ArrowLeft size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Expense Planner</Text>
        <Pressable
          onPress={async () => {
            if (Platform.OS !== 'web') {
              haptics.lightImpact();
            }
            if (planId) {
              await saveLastStep(planId, '/expense-planner');
            }
            router.push('/(tabs)');
          }}
          style={styles.cancelButton}
        >
          <X size={24} color={colors.text} />
        </Pressable>
      </View>

      <KeyboardAvoidingWrapper contentContainerStyle={styles.scrollContent}>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
          <Text style={styles.title}>What's the total budget?</Text>

          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <View
            style={[
              styles.amountContainer,
              amount.trim() !== '' && styles.amountContainerFilled,
              error && styles.amountContainerError,
            ]}
          >
            <Text style={styles.currencySymbol}>₦</Text>
            <TextInput
              ref={amountInputRef}
              style={styles.amountInput}
              placeholder="0"
              placeholderTextColor={colors.textTertiary}
              keyboardType="decimal-pad"
              value={amount}
              onChangeText={handleAmountChange}
            />
          </View>

          <View style={styles.budgetStructureContainer}>
            <Text style={styles.budgetStructureLabel}>Budget structure</Text>
            <View style={styles.checkboxContainer}>
              <Pressable
                style={[
                  styles.checkbox,
                  budgetStructure === 'fixed' && styles.checkboxSelected,
                ]}
                onPress={() => {
                  haptics.selection();
                  setBudgetStructure('fixed');
                  setError(null);
                }}
              >
                <View
                  style={[
                    styles.checkboxInner,
                    budgetStructure === 'fixed' && styles.checkboxInnerSelected,
                  ]}
                >
                  {budgetStructure === 'fixed' && (
                    <View style={styles.checkboxCheckmark} />
                  )}
                </View>
                <Text style={styles.checkboxLabel}>Fixed</Text>
              </Pressable>

              <Pressable
                style={[
                  styles.checkbox,
                  budgetStructure === 'estimated' && styles.checkboxSelected,
                ]}
                onPress={() => {
                  haptics.selection();
                  setBudgetStructure('estimated');
                  setError(null);
                }}
              >
                <View
                  style={[
                    styles.checkboxInner,
                    budgetStructure === 'estimated' && styles.checkboxInnerSelected,
                  ]}
                >
                  {budgetStructure === 'estimated' && (
                    <View style={styles.checkboxCheckmark} />
                  )}
                </View>
                <Text style={styles.checkboxLabel}>Estimated</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingWrapper>

      <FloatingButton
        title="Continue"
        onPress={handleContinue}
        disabled={!amount || !budgetStructure || isCreating}
        hapticType="medium"
      />
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
      width: 40,
      height: 40,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 8,
    },
    headerTitle: {
      fontSize: getScaledFontSize(18, textSizeMultiplier),
      fontWeight: '600',
      color: colors.text,
      flex: 1,
      textAlign: 'center',
    },
    cancelButton: {
      width: 40,
      height: 40,
      justifyContent: 'center',
      alignItems: 'center',
      marginLeft: 8,
    },
    scrollContent: {
      paddingBottom: 100,
    },
    scrollView: {
      flex: 1,
    },
    content: {
      padding: 20,
    },
    title: {
      fontSize: getScaledFontSize(24, textSizeMultiplier),
      fontWeight: '700',
      color: colors.text,
      marginBottom: 32,
    },
    errorContainer: {
      backgroundColor: colors.errorLight || '#FEE2E2',
      borderRadius: 8,
      padding: 12,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.error || '#DC2626',
    },
    errorText: {
      color: colors.error || '#DC2626',
      fontSize: getScaledFontSize(14, textSizeMultiplier),
    },
    amountContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.background,
      borderRadius: 12,
      paddingLeft: 16,
      paddingRight: 16,
      paddingVertical: Platform.OS === 'ios' ? 4 : 0,
      marginBottom: 32,
      borderWidth: 2,
      borderColor: colors.border,
      minHeight: 64,
    },
    amountContainerFilled: {
      borderColor: colors.primary,
      backgroundColor: colors.accentBackground || colors.background,
    },
    amountContainerError: {
      borderColor: colors.error || '#DC2626',
    },
    currencySymbol: {
      fontSize: getScaledFontSize(28, textSizeMultiplier),
      fontWeight: '600',
      color: colors.text,
      marginRight: 8,
    },
    amountInput: {
      flex: 1,
      fontSize: getScaledFontSize(28, textSizeMultiplier),
      fontWeight: '600',
      color: colors.text,
      paddingVertical: 12,
    },
    budgetStructureContainer: {
      marginBottom: 24,
    },
    budgetStructureLabel: {
      fontSize: getScaledFontSize(16, textSizeMultiplier),
      fontWeight: '600',
      color: colors.text,
      marginBottom: 16,
    },
    checkboxContainer: {
      gap: 12,
    },
    checkbox: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      backgroundColor: colors.card,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: colors.border,
    },
    checkboxSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.primary + '10',
    },
    checkboxInner: {
      width: 24,
      height: 24,
      borderRadius: 6,
      borderWidth: 2,
      borderColor: colors.border,
      marginRight: 12,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.background,
    },
    checkboxInnerSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.primary,
    },
    checkboxCheckmark: {
      width: 8,
      height: 8,
      borderRadius: 2,
      backgroundColor: '#fff',
    },
    checkboxLabel: {
      fontSize: getScaledFontSize(16, textSizeMultiplier),
      fontWeight: '500',
      color: colors.text,
    },
  });
