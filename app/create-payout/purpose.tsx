import { View, Text, StyleSheet, Pressable, Platform, ScrollView, TextInput } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import {
  ArrowLeft,
  X,
  Check,
  Wallet,
  Car,
  UtensilsCrossed,
  UsersRound,
  Briefcase,
  HeartHandshake,
  Sparkles,
  Home,
  Zap,
  Wifi,
  Tv,
  CreditCard,
  PiggyBank,
  MoreHorizontal,
} from 'lucide-react-native';
import React, { useState, useEffect } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { useHaptics } from '@/hooks/useHaptics';
import KeyboardAvoidingWrapper from '@/components/KeyboardAvoidingWrapper';
import FloatingButton from '@/components/FloatingButton';
import { PURPOSE_OPTIONS } from '@/lib/payout-purposes';

const PURPOSE_ICONS: Record<string, React.ComponentType<{ size: number; color: string }>> = {
  personal_salary_allowance: Wallet,
  transportation: Car,
  groceries_food: UtensilsCrossed,
  family_support: UsersRound,
  mini_salary_payroll: Briefcase,
  commitments: HeartHandshake,
  personal_care: Sparkles,
  rent_service_charge: Home,
  utility_bills: Zap,
  internet_data: Wifi,
  online_subscriptions: Tv,
  loan_repayments: CreditCard,
  contributions: PiggyBank,
  others: MoreHorizontal,
};

export default function PurposeScreen() {
  const { colors } = useTheme();
  const params = useLocalSearchParams<Record<string, string>>();
  const haptics = useHaptics();
  const [selectedPurpose, setSelectedPurpose] = useState<string | null>('personal_salary_allowance');
  const [purposeOtherText, setPurposeOtherText] = useState('');

  useEffect(() => {
    if (params.purpose) setSelectedPurpose(params.purpose);
    if (params.purposeOther) setPurposeOtherText(params.purposeOther);
  }, [params.purpose, params.purposeOther]);

  const handleContinue = () => {
    if (!selectedPurpose) return;
    haptics.mediumImpact();
    router.push({
      pathname: '/create-payout/frequency-selection',
      params: {
        totalAmount: params.totalAmount || '',
        frequency: params.frequency || '',
        payoutAmount: params.payoutAmount || '',
        duration: params.duration || '',
        startDate: params.startDate || '',
        bankName: params.bankName || '',
        accountNumber: params.accountNumber || '',
        accountName: params.accountName || '',
        bankAccountId: params.bankAccountId || '',
        payoutAccountId: params.payoutAccountId || '',
        emergencyWithdrawal: params.emergencyWithdrawal || 'false',
        customDates: params.customDates || '',
        customDateAmounts: params.customDateAmounts || '',
        customDateTimes: params.customDateTimes || '',
        dayOfWeek: params.dayOfWeek || '',
        payoutHour: params.payoutHour || '',
        payoutMinute: params.payoutMinute || '',
        purpose: selectedPurpose,
        purposeOther: selectedPurpose === 'others' ? purposeOtherText : '',
      },
    });
  };

  const canContinue = selectedPurpose !== null;

  const styles = createStyles(colors);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable
          onPress={() => {
            if (Platform.OS !== 'web') haptics.lightImpact();
            router.back();
          }}
          style={styles.backButton}
        >
          <ArrowLeft size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>New Payout plan</Text>
        <Pressable
          onPress={() => {
            if (Platform.OS !== 'web') haptics.lightImpact();
            router.push('/(tabs)');
          }}
          style={styles.cancelButton}
        >
          <X size={24} color={colors.text} />
        </Pressable>
      </View>

      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: '40%' }]} />
        </View>
        <Text style={styles.stepText}>Step 2 of 5</Text>
      </View>

      <KeyboardAvoidingWrapper contentContainerStyle={styles.scrollContent}>
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={styles.content}>
            <Text style={styles.title}>What is this plan for?</Text>
            <Text style={styles.description}>
              Choose a purpose that best describes this payout plan.
            </Text>

            {PURPOSE_OPTIONS.map((option) => {
              const isSelected = selectedPurpose === option.value;
              const isOthers = option.value === 'others';
              return (
                <View key={option.value}>
                  <Pressable
                    style={[
                      styles.optionCard,
                      isSelected && styles.optionCardSelected,
                      { borderColor: isSelected ? colors.primary : colors.border },
                    ]}
                    onPress={() => {
                      if (Platform.OS !== 'web') haptics.selection();
                      setSelectedPurpose(option.value);
                    }}
                  >
                    {(() => {
                      const IconComponent = PURPOSE_ICONS[option.value];
                      return IconComponent ? (
                        <View style={[styles.optionIconWrap, { backgroundColor: isSelected ? colors.primary + '20' : colors.backgroundTertiary }]}>
                          <IconComponent size={22} color={isSelected ? colors.primary : colors.textSecondary} />
                        </View>
                      ) : null;
                    })()}
                    <View style={styles.optionContent}>
                      <Text style={[styles.optionLabel, { color: colors.text }]}>
                        {option.label}
                      </Text>
                      <Text
                        style={[styles.optionDescription, { color: colors.textSecondary }]}
                        numberOfLines={2}
                      >
                        {option.description}
                      </Text>
                    </View>
                    {isSelected && (
                      <View style={[styles.checkWrap, { backgroundColor: colors.primary }]}>
                        <Check size={16} color="#FFFFFF" />
                      </View>
                    )}
                  </Pressable>
                  {isOthers && selectedPurpose === 'others' && (
                    <View style={styles.otherInputWrap}>
                      <TextInput
                        style={[
                          styles.otherInput,
                          {
                            backgroundColor: colors.backgroundTertiary,
                            borderColor: colors.border,
                            color: colors.text,
                          },
                        ]}
                        placeholder="Describe your purpose (optional)"
                        placeholderTextColor={colors.textTertiary}
                        value={purposeOtherText}
                        onChangeText={setPurposeOtherText}
                      />
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        </ScrollView>
      </KeyboardAvoidingWrapper>

      <FloatingButton
        title="Continue"
        onPress={handleContinue}
        disabled={!canContinue}
        hapticType="medium"
      />
    </SafeAreaView>
  );
}

const createStyles = (colors: any) =>
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
      fontSize: 18,
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
    progressContainer: {
      padding: 20,
      paddingBottom: 0,
      backgroundColor: colors.surface,
    },
    progressBar: {
      height: 2,
      backgroundColor: colors.border,
      borderRadius: 2,
      marginBottom: 8,
    },
    progressFill: {
      height: '100%',
      backgroundColor: '#1E3A8A',
      borderRadius: 2,
    },
    stepText: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    scrollContent: {
      flexGrow: 1,
      paddingBottom: 100,
    },
    content: {
      padding: 20,
      paddingTop: 8,
    },
    title: {
      fontSize: 20,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 8,
    },
    description: {
      fontSize: 14,
      color: colors.textSecondary,
      marginBottom: 20,
    },
    optionCard: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      borderRadius: 12,
      borderWidth: 1.5,
      marginBottom: 10,
      gap: 12,
    },
    optionCardSelected: {
      borderWidth: 2,
    },
    optionIconWrap: {
      width: 44,
      height: 44,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
    },
    optionContent: {
      flex: 1,
    },
    optionLabel: {
      fontSize: 16,
      fontWeight: '600',
      marginBottom: 4,
    },
    optionDescription: {
      fontSize: 13,
      lineHeight: 18,
    },
    checkWrap: {
      width: 24,
      height: 24,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
      marginLeft: 12,
    },
    otherInputWrap: {
      marginBottom: 10,
      marginLeft: 8,
      marginRight: 8,
    },
    otherInput: {
      borderWidth: 1,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 15,
    },
  });
