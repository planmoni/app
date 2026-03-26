import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, X, Banknote, Landmark } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useTextSize } from '@/contexts/TextSizeContext';
import { getScaledFontSize } from '@/lib/textSize';
import { useHaptics } from '@/hooks/useHaptics';
import KeyboardAvoidingWrapper from '@/components/KeyboardAvoidingWrapper';
import FloatingButton from '@/components/FloatingButton';
import { Platform } from 'react-native';
import { usePayoutAccounts } from '@/hooks/usePayoutAccounts';
import { getBankIcon } from '@/lib/bankIcons';

type StartAction = 'wallet' | 'auto_payout';

export default function StartActionScreen() {
  const { colors } = useTheme();
  const { textSizeMultiplier } = useTextSize();
  const haptics = useHaptics();
  const params = useLocalSearchParams();
  const { payoutAccounts, isLoading: payoutAccountsLoading } = usePayoutAccounts();

  const planId = params.planId as string | undefined;
  const planName = params.planName as string;
  const targetAmount = params.targetAmount as string;
  const startDate = params.startDate as string;
  const endDate = params.endDate as string;
  const dateType = params.dateType as string;
  const payoutSchedule = params.payoutSchedule as string;
  const requiredPerCycle = params.requiredPerCycle as string;
  const fundingMethod = params.fundingMethod as 'auto' | 'manual';
  const subCategories = params.subCategories as string | undefined;
  const planTypesParam = params.planTypes as string | undefined;
  // Auto top-up parameters
  const autoTopupEnabled = params.autoTopupEnabled as string | undefined;
  const autoTopupFrequency = params.autoTopupFrequency as string | undefined;
  const autoTopupAmount = params.autoTopupAmount as string | undefined;
  const autoTopupStartDate = params.autoTopupStartDate as string | undefined;
  const autoTopupEndDate = params.autoTopupEndDate as string | undefined;
  const autoTopupNextDate = params.autoTopupNextDate as string | undefined;
  const autoTopupTotalCycles = params.autoTopupTotalCycles as string | undefined;

  const [startAction, setStartAction] = useState<StartAction>('wallet');
  const [payoutAccountId, setPayoutAccountId] = useState<string>('');
  const [payoutAccountLabel, setPayoutAccountLabel] = useState<string>('');
  const [payoutAccountBankName, setPayoutAccountBankName] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);

  const handleContinue = () => {
    if (startAction === 'auto_payout' && !payoutAccountId) {
      Alert.alert('Select account', 'Please choose a payout account.');
      haptics.notification();
      return;
    }

    haptics.mediumImpact();
    setIsSaving(true);

    router.push({
      pathname: '/expense-planner/create/review',
      params: {
        planName,
        targetAmount,
        startDate,
        endDate,
        dateType,
        payoutSchedule,
        requiredPerCycle,
        fundingMethod,
        startAction,
        payoutAccountId,
        payoutAccountLabel,
        payoutAccountBankName,
        planId: planId || '',
        ...(subCategories && { subCategories }),
        ...(planTypesParam && { planTypes: planTypesParam }),
        // Auto top-up parameters
        ...(autoTopupEnabled && { autoTopupEnabled }),
        ...(autoTopupFrequency && { autoTopupFrequency }),
        ...(autoTopupAmount && { autoTopupAmount }),
        ...(autoTopupStartDate && { autoTopupStartDate }),
        ...(autoTopupEndDate && { autoTopupEndDate }),
        ...(autoTopupNextDate && { autoTopupNextDate }),
        ...(autoTopupTotalCycles && { autoTopupTotalCycles }),
      },
    });
  };

  const styles = createStyles(colors, textSizeMultiplier);

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
        <Text style={styles.headerTitle}>Vault start rule</Text>
        <Pressable
          onPress={() => {
            haptics.selection();
            router.replace('/(tabs)');
          }}
          style={styles.closeButton}
        >
          <X size={24} color={colors.text} />
        </Pressable>
      </View>

      <KeyboardAvoidingWrapper contentContainerStyle={styles.scrollContent}>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
          <Text style={styles.title}>What happens when the vault is due?</Text>
          <Text style={styles.subtitle}>Choose how the vault amount should be handled on start.</Text>

          <Pressable
            style={[
              styles.optionCard,
              startAction === 'wallet' && styles.optionCardSelected,
            ]}
            onPress={() => {
              haptics.selection();
              setStartAction('wallet');
              setPayoutAccountId('');
              setPayoutAccountLabel('');
            }}
          >
            <View style={styles.optionHeader}>
              <View style={[
                styles.optionIconContainer,
                startAction === 'wallet' && styles.optionIconContainerSelected,
              ]}>
                <Banknote size={24} color={startAction === 'wallet' ? colors.primary : colors.text} />
              </View>
              <View style={styles.optionHeaderText}>
                <Text style={styles.optionTitle}>Spend directly from vault</Text>
                <Text style={styles.optionSubtitle}>Keep the funds in this vault's wallet to spend/allocate.</Text>
              </View>
              <View style={[
                styles.radio,
                startAction === 'wallet' && styles.radioSelected,
              ]}>
                {startAction === 'wallet' && <View style={styles.radioInner} />}
              </View>
            </View>
          </Pressable>

          <Pressable
            style={[
              styles.optionCard,
              startAction === 'auto_payout' && styles.optionCardSelected,
            ]}
            onPress={() => {
              haptics.selection();
              setStartAction('auto_payout');
            }}
          >
            <View style={styles.optionHeader}>
              <View style={[
                styles.optionIconContainer,
                startAction === 'auto_payout' && styles.optionIconContainerSelected,
              ]}>
                <Banknote size={24} color={startAction === 'auto_payout' ? colors.primary : colors.text} />
              </View>
              <View style={styles.optionHeaderText}>
                <Text style={styles.optionTitle}>Auto payout to bank account</Text>
                <Text style={styles.optionSubtitle}>Send the vault amount to a chosen payout account.</Text>
              </View>
              <View style={[
                styles.radio,
                startAction === 'auto_payout' && styles.radioSelected,
              ]}>
                {startAction === 'auto_payout' && <View style={styles.radioInner} />}
              </View>
            </View>

            {startAction === 'auto_payout' && (
              <View style={styles.payoutAccountsContainer}>
                {payoutAccountsLoading && (
                  <Text style={styles.payoutAccountsInfo}>Loading payout accounts...</Text>
                )}
                {!payoutAccountsLoading && payoutAccounts.length === 0 && (
                  <Text style={styles.payoutAccountsInfo}>No payout accounts added yet.</Text>
                )}
                {!payoutAccountsLoading && payoutAccounts.map((account) => {
                  const label = `${account.bank_name} ••••${account.account_number.slice(-4)}`;
                  const selected = payoutAccountId === account.id;
                  const bankIcon = getBankIcon(account.bank_name || '');
                  const SvgLogo = bankIcon.logoSvg;
                  
                  // Check if SvgLogo is a valid component (function or class)
                  const isValidComponent = SvgLogo && 
                    (typeof SvgLogo === 'function' || 
                     (typeof SvgLogo === 'object' && SvgLogo !== null && 
                      (typeof SvgLogo.default === 'function' || typeof SvgLogo === 'function')));
                  
                  return (
                    <Pressable
                      key={account.id}
                      style={[
                        styles.payoutAccountCard,
                        selected && styles.payoutAccountCardSelected,
                      ]}
                      onPress={() => {
                        haptics.selection();
                        setPayoutAccountId(account.id);
                        setPayoutAccountLabel(label);
                        setPayoutAccountBankName(account.bank_name || '');
                      }}
                    >
                      <View style={styles.payoutAccountInfo}>
                        <View style={styles.bankLogoContainer}>
                          {isValidComponent ? (
                            React.createElement(
                              (SvgLogo as any).default || SvgLogo, 
                              {
                                width: 24,
                                height: 24,
                              }
                            )
                          ) : (
                            <Landmark size={18} color={colors.primary} />
                          )}
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.payoutAccountName}>{account.account_name}</Text>
                          <Text style={styles.payoutAccountMeta}>{label}</Text>
                        </View>
                      </View>
                      <View style={[
                        styles.radio,
                        selected && styles.radioSelected,
                      ]}>
                        {selected && <View style={styles.radioInner} />}
                      </View>
                    </Pressable>
                  );
                })}
                {/* Add new bank account */}
                {!payoutAccountsLoading && (
                  <Pressable
                    style={styles.addBankCard}
                    onPress={() => {
                      haptics.selection();
                      router.push('/payout-accounts');
                    }}
                  >
                    <View style={styles.payoutAccountInfo}>
                      <View style={[styles.bankLogoContainer, styles.addBankIconContainer]}>
                        <Text style={styles.addBankIcon}>+</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.payoutAccountName}>Add new bank account</Text>
                        <Text style={styles.payoutAccountMeta}>Create a new payout destination</Text>
                      </View>
                    </View>
                  </Pressable>
                )}
              </View>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingWrapper>

      <FloatingButton
        title="Continue"
        onPress={handleContinue}
        disabled={isSaving || (startAction === 'auto_payout' && !payoutAccountId)}
        hapticType="medium"
      />
    </SafeAreaView>
  );
}

const createStyles = (colors: any, textSizeMultiplier: number) =>
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
      fontSize: getScaledFontSize(22, textSizeMultiplier),
      fontWeight: '700',
      color: colors.text,
      marginBottom: 8,
    },
    subtitle: {
      fontSize: getScaledFontSize(14, textSizeMultiplier),
      color: colors.textSecondary,
      marginBottom: 24,
      lineHeight: 20,
    },
    optionCard: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 20,
      borderWidth: 2,
      borderColor: colors.border,
      marginBottom: 16,
    },
    optionCardSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.primary + '10',
    },
    optionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
    },
    optionIconContainer: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.backgroundTertiary,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    optionIconContainerSelected: {
      backgroundColor: colors.primary + '20',
    },
    optionHeaderText: {
      flex: 1,
    },
    optionTitle: {
      fontSize: getScaledFontSize(18, textSizeMultiplier),
      fontWeight: '600',
      color: colors.text,
      marginBottom: 4,
    },
    optionSubtitle: {
      fontSize: getScaledFontSize(13, textSizeMultiplier),
      color: colors.textSecondary,
    },
    radio: {
      width: 24,
      height: 24,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: colors.border,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.background,
    },
    radioSelected: {
      borderColor: colors.primary,
    },
    radioInner: {
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: colors.primary,
    },
    payoutAccountsContainer: {
      marginTop: 12,
      gap: 12,
    },
    payoutAccountsInfo: {
      color: colors.textSecondary,
      fontSize: getScaledFontSize(13, textSizeMultiplier),
    },
    payoutAccountCard: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 12,
      backgroundColor: colors.card,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    payoutAccountCardSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.backgroundTertiary,
    },
  addBankCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
    backgroundColor: colors.backgroundSecondary,
    marginTop: 10,
  },
    payoutAccountInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      flex: 1,
    },
    bankLogoContainer: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.background,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
  addBankIconContainer: {
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: colors.border,
  },
  addBankIcon: {
    fontSize: 18,
    color: colors.text,
    fontWeight: '600',
  },
    payoutAccountName: {
      color: colors.text,
      fontSize: getScaledFontSize(15, textSizeMultiplier),
      fontWeight: '600',
    },
    payoutAccountMeta: {
      color: colors.textSecondary,
      fontSize: getScaledFontSize(13, textSizeMultiplier),
    },
  });
