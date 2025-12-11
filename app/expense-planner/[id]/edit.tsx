import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, X, Target, Calendar, Flag, Zap, Hand, Settings, Lock, Unlock, Bell, AlertTriangle } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useTextSize } from '@/contexts/TextSizeContext';
import { getScaledFontSize } from '@/lib/textSize';
import { useHaptics } from '@/hooks/useHaptics';
import KeyboardAvoidingWrapper from '@/components/KeyboardAvoidingWrapper';
import FloatingButton from '@/components/FloatingButton';
import { Platform } from 'react-native';
import { useExpensePlans } from '@/hooks/useExpensePlans';
import { supabase } from '@/lib/supabase';
import { checkPlanFeasibility, PlanConfig, UserFinancials } from '@/lib/engines/planFeasibilityEngine';
import { calculateRequiredContribution, PayoutSchedule } from '@/lib/engines/contributionCalculator';

export default function PlanEditScreen() {
  const { colors, isDark } = useTheme();
  const { textSizeMultiplier } = useTextSize();
  const haptics = useHaptics();
  const params = useLocalSearchParams();
  const { expensePlans, fetchExpensePlans, updateExpensePlan } = useExpensePlans();
  const planId = params.id as string;

  const plan = expensePlans.find(p => p.id === planId);

  const [planName, setPlanName] = useState(plan?.name || '');
  const [targetAmount, setTargetAmount] = useState(plan?.total_budget?.toString() || '');
  const [priority, setPriority] = useState<'high' | 'medium' | 'low'>((plan as any)?.priority || 'medium');
  const [fundingMethod, setFundingMethod] = useState<'auto' | 'manual' | 'hybrid'>((plan as any)?.funding_method || 'manual');
  const [payoutSchedule, setPayoutSchedule] = useState<PayoutSchedule>((plan as any)?.payout_schedule || 'weekly');
  const [startDate, setStartDate] = useState<Date | null>(plan?.start_date ? new Date(plan.start_date) : null);
  const [endDate, setEndDate] = useState<Date | null>(plan?.end_date ? new Date(plan.end_date) : null);
  const [spendingPermission, setSpendingPermission] = useState<'open' | 'restricted'>('open');
  const [lockType, setLockType] = useState<'none' | 'instant' | '24h_delay' | 'pin_required'>('none');
  const [alertAt70Percent, setAlertAt70Percent] = useState(false);
  const [alertRiskFailure, setAlertRiskFailure] = useState(false);
  const [alertWeeklyProgress, setAlertWeeklyProgress] = useState(false);
  const [feasibilityWarning, setFeasibilityWarning] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!plan) return;

    // Load wallet and rules
    const loadPlanData = async () => {
      try {
        const { data: wallet } = await supabase
          .from('plan_wallets')
          .select('*')
          .eq('plan_id', planId)
          .single();

        if (wallet) {
          setSpendingPermission(wallet.spending_permission || 'open');
          setLockType(wallet.lock_type || 'none');
        }

        const { data: rules } = await supabase
          .from('plan_rules')
          .select('*')
          .eq('plan_id', planId)
          .single();

        if (rules) {
          setAlertAt70Percent(rules.alert_at_70_percent || false);
          setAlertRiskFailure(rules.alert_risk_failure || false);
          setAlertWeeklyProgress(rules.alert_weekly_progress || false);
        }

        if ((plan as any)?.auto_fund_minimum) {
          setAutoFundMinimum((plan as any).auto_fund_minimum.toString());
        }
      } catch (error) {
        console.error('Error loading plan data:', error);
      }
    };

    loadPlanData();
  }, [plan, planId]);

  // Recalculate feasibility when key fields change
  useEffect(() => {
    if (!targetAmount || !startDate || !endDate) return;

    const numericAmount = parseFloat(targetAmount.replace(/,/g, ''));
    if (isNaN(numericAmount)) return;

    // Get user financials (simplified - would fetch from user profile)
    const userFinancials: UserFinancials = {
      monthlyIncome: 100000, // TODO: Fetch from user profile
      mandatoryExpenses: 20000, // TODO: Calculate from bills
      availableForPlans: 80000, // TODO: Calculate
    };

    const planConfig: PlanConfig = {
      targetAmount: numericAmount,
      startDate,
      endDate,
      requiredPerCycle: (plan as any)?.required_per_cycle || 0,
      payoutSchedule,
      currentBalance: (plan as any)?.current_balance || 0,
    };

    const result = checkPlanFeasibility(planConfig, userFinancials);
    
    if (!result.isFeasible || result.status !== 'on_track') {
      setFeasibilityWarning(result.message);
    } else {
      setFeasibilityWarning(null);
    }
  }, [targetAmount, startDate, endDate, payoutSchedule, plan]);

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
    setTargetAmount(formatted);
    setError(null);
  };

  const handleSave = async () => {
    if (!planName.trim()) {
      setError('Please enter a plan name');
      haptics.notification();
      return;
    }

    if (!targetAmount) {
      setError('Please enter a target amount');
      haptics.notification();
      return;
    }

    const numericAmount = parseFloat(targetAmount.replace(/,/g, ''));
    if (isNaN(numericAmount) || numericAmount < 1000) {
      setError('Please enter a valid amount (minimum ₦1,000)');
      haptics.notification();
      return;
    }

    if (!startDate) {
      setError('Please select a start date');
      haptics.notification();
      return;
    }

    haptics.mediumImpact();
    setIsSaving(true);
    setError(null);

    try {
      // Recalculate required contribution
      const calculation = calculateRequiredContribution(
        numericAmount,
        startDate,
        endDate,
        payoutSchedule,
        (plan as any)?.current_balance || 0
      );

      // Update plan
      await updateExpensePlan(planId, {
        name: planName.trim(),
        plan_name: planName.trim(),
        total_budget: numericAmount,
        priority,
        funding_method: fundingMethod,
        payout_schedule: payoutSchedule,
        required_per_cycle: calculation.requiredPerCycle,
        required_per_day: calculation.requiredPerDay,
        start_date: startDate.toISOString().split('T')[0],
        end_date: endDate ? endDate.toISOString().split('T')[0] : null,
      });

      // Update wallet
      await supabase
        .from('plan_wallets')
        .update({
          spending_permission: spendingPermission,
          lock_type: lockType,
        })
        .eq('plan_id', planId);

      // Update rules
      await supabase
        .from('plan_rules')
        .update({
          alert_at_70_percent: alertAt70Percent,
          alert_risk_failure: alertRiskFailure,
          alert_weekly_progress: alertWeeklyProgress,
        })
        .eq('plan_id', planId);

      // Refresh plans
      await fetchExpensePlans();

      Alert.alert('Success', 'Plan updated successfully', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error: any) {
      console.error('Error updating plan:', error);
      setError(error.message || 'Failed to update plan');
      Alert.alert('Error', error.message || 'Failed to update plan');
    } finally {
      setIsSaving(false);
    }
  };

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
        <Text style={styles.headerTitle}>Edit Plan</Text>
        <Pressable
          onPress={() => {
            haptics.lightImpact();
            router.back();
          }}
          style={styles.cancelButton}
        >
          <X size={24} color={colors.text} />
        </Pressable>
      </View>

      <KeyboardAvoidingWrapper contentContainerStyle={styles.scrollContent}>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
          {feasibilityWarning && (
            <View style={styles.warningContainer}>
              <AlertTriangle size={20} color="#F59E0B" />
              <Text style={styles.warningText}>{feasibilityWarning}</Text>
            </View>
          )}

          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Plan Name */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Flag size={20} color={colors.primary} />
              <Text style={styles.sectionTitle}>Plan Name</Text>
            </View>
            <TextInput
              style={styles.textInput}
              placeholder="Enter plan name"
              placeholderTextColor={colors.textTertiary}
              value={planName}
              onChangeText={setPlanName}
            />
          </View>

          {/* Target Amount */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Target size={20} color={colors.primary} />
              <Text style={styles.sectionTitle}>Target Amount</Text>
            </View>
            <View style={styles.amountContainer}>
              <Text style={styles.currencySymbol}>₦</Text>
              <TextInput
                style={styles.amountInput}
                placeholder="0"
                placeholderTextColor={colors.textTertiary}
                keyboardType="decimal-pad"
                value={targetAmount}
                onChangeText={handleAmountChange}
              />
            </View>
          </View>

          {/* Priority */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Priority Level</Text>
            <View style={styles.checkboxContainer}>
              {(['high', 'medium', 'low'] as const).map((pri) => (
                <Pressable
                  key={pri}
                  style={[
                    styles.checkbox,
                    priority === pri && styles.checkboxSelected,
                  ]}
                  onPress={() => {
                    haptics.selection();
                    setPriority(pri);
                  }}
                >
                  <View
                    style={[
                      styles.checkboxInner,
                      priority === pri && styles.checkboxInnerSelected,
                    ]}
                  >
                    {priority === pri && (
                      <View style={styles.checkboxCheckmark} />
                    )}
                  </View>
                  <Text style={styles.checkboxLabel}>
                    {pri.charAt(0).toUpperCase() + pri.slice(1)}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Funding Method */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Funding Method</Text>
            <View style={styles.optionsContainer}>
              <Pressable
                style={[
                  styles.optionButton,
                  fundingMethod === 'auto' && styles.optionButtonSelected,
                ]}
                onPress={() => {
                  haptics.selection();
                  setFundingMethod('auto');
                }}
              >
                <Zap size={20} color={fundingMethod === 'auto' ? colors.primary : colors.textSecondary} />
                <Text style={[
                  styles.optionText,
                  fundingMethod === 'auto' && styles.optionTextSelected,
                ]}>
                  Auto
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.optionButton,
                  fundingMethod === 'manual' && styles.optionButtonSelected,
                ]}
                onPress={() => {
                  haptics.selection();
                  setFundingMethod('manual');
                }}
              >
                <Hand size={20} color={fundingMethod === 'manual' ? colors.primary : colors.textSecondary} />
                <Text style={[
                  styles.optionText,
                  fundingMethod === 'manual' && styles.optionTextSelected,
                ]}>
                  Manual
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.optionButton,
                  fundingMethod === 'hybrid' && styles.optionButtonSelected,
                ]}
                onPress={() => {
                  haptics.selection();
                  setFundingMethod('hybrid');
                }}
              >
                <Settings size={20} color={fundingMethod === 'hybrid' ? colors.primary : colors.textSecondary} />
                <Text style={[
                  styles.optionText,
                  fundingMethod === 'hybrid' && styles.optionTextSelected,
                ]}>
                  Hybrid
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Payout Schedule */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Payout Schedule</Text>
            <View style={styles.scheduleContainer}>
              {(['daily', 'weekly', 'biweekly', 'monthly'] as PayoutSchedule[]).map((schedule) => (
                <Pressable
                  key={schedule}
                  style={[
                    styles.scheduleButton,
                    payoutSchedule === schedule && styles.scheduleButtonSelected,
                  ]}
                  onPress={() => {
                    haptics.selection();
                    setPayoutSchedule(schedule);
                  }}
                >
                  <Text style={[
                    styles.scheduleText,
                    payoutSchedule === schedule && styles.scheduleTextSelected,
                  ]}>
                    {schedule.charAt(0).toUpperCase() + schedule.slice(1)}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Dates - Simplified for now */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Calendar size={20} color={colors.primary} />
              <Text style={styles.sectionTitle}>Dates</Text>
            </View>
            <Text style={styles.infoText}>
              Start: {startDate?.toLocaleDateString('en-US') || 'Not set'}
            </Text>
            <Text style={styles.infoText}>
              End: {endDate?.toLocaleDateString('en-US') || 'Not set'}
            </Text>
            <Text style={styles.noteText}>
              Date editing coming soon
            </Text>
          </View>

          {/* Wallet Rules */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Lock size={20} color={colors.primary} />
              <Text style={styles.sectionTitle}>Wallet Rules</Text>
            </View>
            <View style={styles.optionsContainer}>
              <Pressable
                style={[
                  styles.optionButton,
                  spendingPermission === 'open' && styles.optionButtonSelected,
                ]}
                onPress={() => {
                  haptics.selection();
                  setSpendingPermission('open');
                }}
              >
                <Unlock size={20} color={spendingPermission === 'open' ? colors.primary : colors.textSecondary} />
                <Text style={[
                  styles.optionText,
                  spendingPermission === 'open' && styles.optionTextSelected,
                ]}>
                  Open
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.optionButton,
                  spendingPermission === 'restricted' && styles.optionButtonSelected,
                ]}
                onPress={() => {
                  haptics.selection();
                  setSpendingPermission('restricted');
                }}
              >
                <Lock size={20} color={spendingPermission === 'restricted' ? colors.primary : colors.textSecondary} />
                <Text style={[
                  styles.optionText,
                  spendingPermission === 'restricted' && styles.optionTextSelected,
                ]}>
                  Restricted
                </Text>
              </Pressable>
            </View>
            <View style={styles.optionsContainer}>
              {(['none', 'instant', '24h_delay', 'pin_required'] as const).map((lock) => (
                <Pressable
                  key={lock}
                  style={[
                    styles.optionButton,
                    lockType === lock && styles.optionButtonSelected,
                  ]}
                  onPress={() => {
                    haptics.selection();
                    setLockType(lock);
                  }}
                >
                  <Text style={[
                    styles.optionText,
                    lockType === lock && styles.optionTextSelected,
                  ]}>
                    {lock === 'none' ? 'No Lock' :
                     lock === 'instant' ? 'Instant' :
                     lock === '24h_delay' ? '24h Delay' :
                     'PIN'}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Alerts */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Bell size={20} color={colors.primary} />
              <Text style={styles.sectionTitle}>Alerts</Text>
            </View>
            <View style={styles.alertsContainer}>
              <Pressable
                style={styles.alertItem}
                onPress={() => {
                  haptics.selection();
                  setAlertAt70Percent(!alertAt70Percent);
                }}
              >
                <View style={[
                  styles.checkbox,
                  alertAt70Percent && styles.checkboxSelected,
                ]}>
                  {alertAt70Percent && <View style={styles.checkboxInner} />}
                </View>
                <Text style={styles.alertText}>Notify at 70% spent</Text>
              </Pressable>
              <Pressable
                style={styles.alertItem}
                onPress={() => {
                  haptics.selection();
                  setAlertRiskFailure(!alertRiskFailure);
                }}
              >
                <View style={[
                  styles.checkbox,
                  alertRiskFailure && styles.checkboxSelected,
                ]}>
                  {alertRiskFailure && <View style={styles.checkboxInner} />}
                </View>
                <Text style={styles.alertText}>Notify when plan risks failing</Text>
              </Pressable>
              <Pressable
                style={styles.alertItem}
                onPress={() => {
                  haptics.selection();
                  setAlertWeeklyProgress(!alertWeeklyProgress);
                }}
              >
                <View style={[
                  styles.checkbox,
                  alertWeeklyProgress && styles.checkboxSelected,
                ]}>
                  {alertWeeklyProgress && <View style={styles.checkboxInner} />}
                </View>
                <Text style={styles.alertText}>Notify weekly progress</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingWrapper>

      <FloatingButton
        title="Save Changes"
        onPress={handleSave}
        disabled={isSaving}
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
    placeholder: {
      width: 40,
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
    warningContainer: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
      padding: 16,
      backgroundColor: '#FEF3C7',
      borderRadius: 12,
      marginBottom: 20,
      borderWidth: 1,
      borderColor: '#F59E0B',
    },
    warningText: {
      fontSize: getScaledFontSize(14, textSizeMultiplier),
      color: '#92400E',
      flex: 1,
      lineHeight: 20,
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
    section: {
      marginBottom: 24,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 12,
    },
    sectionTitle: {
      fontSize: getScaledFontSize(16, textSizeMultiplier),
      fontWeight: '600',
      color: colors.text,
      marginBottom: 12,
    },
    textInput: {
      backgroundColor: colors.background,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 14,
      fontSize: getScaledFontSize(16, textSizeMultiplier),
      color: colors.text,
      borderWidth: 2,
      borderColor: colors.border,
    },
    amountContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.background,
      borderRadius: 12,
      paddingLeft: 16,
      paddingRight: 16,
      paddingVertical: Platform.OS === 'ios' ? 4 : 0,
      borderWidth: 2,
      borderColor: colors.border,
      minHeight: 64,
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
    optionsContainer: {
      flexDirection: 'row',
      gap: 12,
      flexWrap: 'wrap',
    },
    optionButton: {
      flex: 1,
      minWidth: '30%',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      padding: 16,
      backgroundColor: colors.card,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: colors.border,
    },
    optionButtonSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.primary + '10',
    },
    optionText: {
      fontSize: getScaledFontSize(14, textSizeMultiplier),
      fontWeight: '500',
      color: colors.text,
    },
    optionTextSelected: {
      color: colors.primary,
      fontWeight: '600',
    },
    hybridInput: {
      marginTop: 16,
      padding: 16,
      backgroundColor: colors.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    hybridLabel: {
      fontSize: getScaledFontSize(14, textSizeMultiplier),
      fontWeight: '500',
      color: colors.text,
      marginBottom: 8,
    },
    amountInputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.background,
      borderRadius: 12,
      paddingLeft: 16,
      paddingRight: 16,
      paddingVertical: Platform.OS === 'ios' ? 4 : 0,
      borderWidth: 2,
      borderColor: colors.primary,
      minHeight: 56,
    },
    scheduleContainer: {
      flexDirection: 'row',
      gap: 8,
      flexWrap: 'wrap',
    },
    scheduleButton: {
      flex: 1,
      minWidth: '22%',
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 8,
      backgroundColor: colors.card,
      borderWidth: 2,
      borderColor: colors.border,
      alignItems: 'center',
    },
    scheduleButtonSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.primary + '10',
    },
    scheduleText: {
      fontSize: getScaledFontSize(14, textSizeMultiplier),
      fontWeight: '500',
      color: colors.text,
    },
    scheduleTextSelected: {
      color: colors.primary,
      fontWeight: '600',
    },
    infoText: {
      fontSize: getScaledFontSize(14, textSizeMultiplier),
      color: colors.text,
      marginBottom: 4,
    },
    noteText: {
      fontSize: getScaledFontSize(12, textSizeMultiplier),
      color: colors.textSecondary,
      fontStyle: 'italic',
      marginTop: 8,
    },
    alertsContainer: {
      gap: 12,
    },
    alertItem: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      backgroundColor: colors.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 12,
    },
    alertText: {
      fontSize: getScaledFontSize(14, textSizeMultiplier),
      color: colors.text,
      flex: 1,
    },
  });
