import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, X, Zap, Hand } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useTextSize } from '@/contexts/TextSizeContext';
import { getScaledFontSize } from '@/lib/textSize';
import { useHaptics } from '@/hooks/useHaptics';
import FloatingButton from '@/components/FloatingButton';
import { useExpensePlans } from '@/hooks/useExpensePlans';

export default function EditFundingScreen() {
  const { colors, isDark } = useTheme();
  const { textSizeMultiplier } = useTextSize();
  const haptics = useHaptics();
  const params = useLocalSearchParams();
  const planId = params.id as string;
  const { expensePlans, updateExpensePlan, fetchExpensePlans } = useExpensePlans();
  
  const plan = expensePlans.find(p => p.id === planId);
  const [fundingMethod, setFundingMethod] = useState<'auto' | 'manual'>(
    (plan as any)?.funding_method || 'manual'
  );
  const startDateStr = (plan as any)?.start_date as string | undefined;

  // Matches `app/expense-planner/create/funding-source.tsx` rule:
  // auto top-up only available when the vault maturity date is >= 7 days away.
  const isAutoTopUpDisabled = useMemo(() => {
    if (!startDateStr) return false;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const startDate = new Date(startDateStr);
    startDate.setHours(0, 0, 0, 0);

    const daysUntil = Math.ceil((startDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return daysUntil < 7;
  }, [startDateStr]);

  useEffect(() => {
    if (isAutoTopUpDisabled && fundingMethod === 'auto') {
      setFundingMethod('manual');
    }
  }, [isAutoTopUpDisabled, fundingMethod]);
  const [isSaving, setIsSaving] = useState(false);

  const handleDone = async () => {
    if (fundingMethod === 'auto' && isAutoTopUpDisabled) {
      Alert.alert(
        'Auto Top-Up Unavailable',
        'Auto top-up is only available when the vault maturity date is at least 1 week away. Please select manual top-up instead.',
        [{ text: 'OK' }],
      );
      haptics.notification();
      return;
    }

    if (!plan) return;

    // Auto mode uses the same flow as during vault creation:
    // go through `auto-topup-config` to pick frequency/schedule.
    if (fundingMethod === 'auto') {
      if (!plan.start_date) {
        Alert.alert('Error', 'Vault maturity date is missing. Please set a maturity date first.');
        return;
      }

      haptics.mediumImpact();
      router.push({
        pathname: '/expense-planner/create/auto-topup-config',
        params: {
          mode: 'edit',
          planId: planId || plan.id,
          planName: plan.name,
          targetAmount: (plan.total_budget || 0).toString(),
          maturityDate: plan.start_date || '',
        },
      });
      return;
    }

    haptics.mediumImpact();
    setIsSaving(true);

    try {
      await updateExpensePlan(planId, {
        funding_method: 'manual',
        auto_topup_enabled: false,
        auto_topup_next_date: null,
      });
      await fetchExpensePlans();
      haptics.notification();
      router.back();
    } catch (error: any) {
      console.error('Error updating funding method:', error);
      router.back();
    } finally {
      setIsSaving(false);
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
        <Text style={styles.headerTitle}>Edit Funding Method</Text>
        <Pressable
          onPress={() => {
            haptics.lightImpact();
            router.back();
          }}
          style={styles.closeButton}
        >
          <X size={24} color={colors.text} />
        </Pressable>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>Funding Method</Text>
        <Text style={styles.description}>
          Choose how this budget will be funded
        </Text>

        <View style={styles.optionsContainer}>
          <Pressable
            style={[
              styles.optionButton,
              fundingMethod === 'auto' && styles.optionButtonSelected,
              isAutoTopUpDisabled && styles.optionButtonDisabled,
            ]}
            onPress={() => {
              if (isAutoTopUpDisabled) {
                haptics.notification();
                Alert.alert(
                  'Auto Top-Up Unavailable',
                  'Auto top-up is only available when the vault maturity date is at least 1 week away. Please select manual top-up instead.',
                  [{ text: 'OK' }],
                );
                return;
              }
              haptics.selection();
              setFundingMethod('auto');
            }}
            disabled={isAutoTopUpDisabled}
          >
            <Zap size={24} color={fundingMethod === 'auto' ? colors.primary : colors.textSecondary} />
            <View style={styles.optionContent}>
              <Text style={[
                styles.optionTitle,
                fundingMethod === 'auto' && styles.optionTitleSelected,
                isAutoTopUpDisabled && styles.optionTitleDisabled,
              ]}>
                Auto
              </Text>
              <Text style={styles.optionDescription}>
                Automatically fund this budget on a schedule
              </Text>
            </View>
            {fundingMethod === 'auto' && (
              <View style={styles.radioSelected}>
                <View style={styles.radioInner} />
              </View>
            )}
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
            <Hand size={24} color={fundingMethod === 'manual' ? colors.primary : colors.textSecondary} />
            <View style={styles.optionContent}>
              <Text style={[
                styles.optionTitle,
                fundingMethod === 'manual' && styles.optionTitleSelected,
              ]}>
                Manual
              </Text>
              <Text style={styles.optionDescription}>
                Add funds to this budget manually when needed
              </Text>
            </View>
            {fundingMethod === 'manual' && (
              <View style={styles.radioSelected}>
                <View style={styles.radioInner} />
              </View>
            )}
          </Pressable>
        </View>
      </ScrollView>

      <FloatingButton
        title="Done"
        onPress={handleDone}
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
    closeButton: {
      width: 40,
      height: 40,
      justifyContent: 'center',
      alignItems: 'center',
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      padding: 20,
      paddingBottom: 100,
    },
    title: {
      fontSize: getScaledFontSize(20, textSizeMultiplier),
      fontWeight: '700',
      color: colors.text,
      marginBottom: 8,
    },
    description: {
      fontSize: getScaledFontSize(14, textSizeMultiplier),
      color: colors.textSecondary,
      marginBottom: 24,
      lineHeight: 20,
    },
    optionsContainer: {
      gap: 12,
    },
    optionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 16,
      borderWidth: 2,
      borderColor: colors.border,
      gap: 12,
    },
    optionButtonSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.primary + '10',
    },
    optionButtonDisabled: {
      opacity: 0.55,
    },
    optionContent: {
      flex: 1,
    },
    optionTitle: {
      fontSize: getScaledFontSize(16, textSizeMultiplier),
      fontWeight: '600',
      color: colors.text,
      marginBottom: 4,
    },
    optionTitleSelected: {
      color: colors.primary,
    },
    optionTitleDisabled: {
      color: colors.textTertiary || colors.textSecondary,
    },
    optionDescription: {
      fontSize: getScaledFontSize(13, textSizeMultiplier),
      color: colors.textSecondary,
    },
    radioSelected: {
      width: 24,
      height: 24,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    radioInner: {
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: colors.primary,
    },
  });

