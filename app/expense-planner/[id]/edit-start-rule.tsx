import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, X, Banknote, Landmark } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useTextSize } from '@/contexts/TextSizeContext';
import { getScaledFontSize } from '@/lib/textSize';
import { useHaptics } from '@/hooks/useHaptics';
import FloatingButton from '@/components/FloatingButton';
import { useExpensePlans } from '@/hooks/useExpensePlans';
import { usePayoutAccounts } from '@/hooks/usePayoutAccounts';
import { getBankIconLogo } from '@/lib/bankIcons';
import { Image } from 'react-native';

type StartAction = 'wallet' | 'auto_payout';

export default function EditStartRuleScreen() {
  const { colors, isDark } = useTheme();
  const { textSizeMultiplier } = useTextSize();
  const haptics = useHaptics();
  const params = useLocalSearchParams();
  const planId = params.id as string;
  const { expensePlans, updateExpensePlan, fetchExpensePlans } = useExpensePlans();
  const { payoutAccounts } = usePayoutAccounts();
  
  const plan = expensePlans.find(p => p.id === planId);
  const [startAction, setStartAction] = useState<StartAction>(
    (plan?.metadata?.start_action || plan?.start_action || 'wallet') as StartAction
  );
  const [selectedAccountId, setSelectedAccountId] = useState<string>(
    (plan as any)?.payout_account_id || ''
  );
  const [isSaving, setIsSaving] = useState(false);

  const handleDone = async () => {
    if (startAction === 'auto_payout' && !selectedAccountId) {
      haptics.notification();
      return;
    }

    haptics.mediumImpact();
    setIsSaving(true);

    try {
      const selectedAccount = payoutAccounts.find(acc => acc.id === selectedAccountId);
      const metadata = {
        ...(plan?.metadata || {}),
        start_action: startAction,
      };

      const updates: any = {
        start_action: startAction,
        metadata: metadata,
      };

      if (startAction === 'auto_payout' && selectedAccountId && selectedAccount) {
        updates.payout_account_id = selectedAccountId;
        updates.payout_account_label = selectedAccount.account_number;
        updates.payout_account_bank_name = selectedAccount.bank_name;
        // Also store in metadata for backward compatibility
        metadata.payout_account_label = selectedAccount.account_number;
        metadata.payout_account_bank_name = selectedAccount.bank_name;
      } else if (startAction === 'wallet') {
        // Clear payout account info when switching to wallet
        updates.payout_account_id = null;
        updates.payout_account_label = null;
        updates.payout_account_bank_name = null;
      }

      await updateExpensePlan(planId, updates);
      await fetchExpensePlans();
      haptics.notification();
      router.back();
    } catch (error: any) {
      console.error('Error updating start rule:', error);
      router.back();
    } finally {
      setIsSaving(false);
    }
  };

  const selectedAccount = payoutAccounts.find(acc => acc.id === selectedAccountId);

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
        <Text style={styles.headerTitle}>Edit Plan Start Rule</Text>
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
        <Text style={styles.title}>Plan Start Rule</Text>
        <Text style={styles.description}>
          Choose what happens when the budget starts
        </Text>

        <View style={styles.optionsContainer}>
          <Pressable
            style={[
              styles.optionButton,
              startAction === 'wallet' && styles.optionButtonSelected,
            ]}
            onPress={() => {
              haptics.selection();
              setStartAction('wallet');
            }}
          >
            <Banknote size={24} color={startAction === 'wallet' ? colors.primary : colors.textSecondary} />
            <View style={styles.optionContent}>
              <Text style={[
                styles.optionTitle,
                startAction === 'wallet' && styles.optionTitleSelected,
              ]}>
                Spend directly from budget
              </Text>
              <Text style={styles.optionDescription}>
                Keep funds in the plan wallet for direct spending
              </Text>
            </View>
            {startAction === 'wallet' && (
              <View style={styles.radioSelected}>
                <View style={styles.radioInner} />
              </View>
            )}
          </Pressable>

          <Pressable
            style={[
              styles.optionButton,
              startAction === 'auto_payout' && styles.optionButtonSelected,
            ]}
            onPress={() => {
              haptics.selection();
              setStartAction('auto_payout');
            }}
          >
            <Landmark size={24} color={startAction === 'auto_payout' ? colors.primary : colors.textSecondary} />
            <View style={styles.optionContent}>
              <Text style={[
                styles.optionTitle,
                startAction === 'auto_payout' && styles.optionTitleSelected,
              ]}>
                Auto payout to bank
              </Text>
              <Text style={styles.optionDescription}>
                Automatically transfer funds to your bank account
              </Text>
            </View>
            {startAction === 'auto_payout' && (
              <View style={styles.radioSelected}>
                <View style={styles.radioInner} />
              </View>
            )}
          </Pressable>
        </View>

        {startAction === 'auto_payout' && (
          <View style={styles.accountsSection}>
            <Text style={styles.sectionTitle}>Select Payout Account</Text>
            <View style={styles.accountsContainer}>
              {payoutAccounts.map(account => {
                const bankIcon = getBankIconLogo(account.bank_name);
                const isSelected = selectedAccountId === account.id;
                
                return (
                  <Pressable
                    key={account.id}
                    style={[
                      styles.accountCard,
                      isSelected && styles.accountCardSelected,
                    ]}
                    onPress={() => {
                      haptics.selection();
                      setSelectedAccountId(account.id);
                    }}
                  >
                    <View style={styles.accountInfo}>
                      <View style={styles.accountIcon}>
                        {bankIcon.logoSvg ? (
                          React.createElement(bankIcon.logoSvg.default || bankIcon.logoSvg, {
                            width: 40,
                            height: 40,
                          })
                        ) : bankIcon.logo ? (
                          <Image 
                            source={bankIcon.logo} 
                            style={styles.bankLogoImage} 
                            resizeMode="contain" 
                          />
                        ) : (
                          <Text style={styles.accountIconText}>
                            {account.bank_name.charAt(0).toUpperCase()}
                          </Text>
                        )}
                      </View>
                      <View style={styles.accountDetails}>
                        <Text style={styles.accountName}>{account.account_name}</Text>
                        <Text style={styles.accountNumber}>
                          {account.account_number.slice(-4).padStart(account.account_number.length, '•')}
                        </Text>
                        <Text style={styles.bankName}>{account.bank_name}</Text>
                      </View>
                    </View>
                    <View style={[
                      styles.radio,
                      isSelected && styles.radioSelected,
                    ]}>
                      {isSelected && <View style={styles.radioInner} />}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}
      </ScrollView>

      <FloatingButton
        title="Done"
        onPress={handleDone}
        disabled={isSaving || (startAction === 'auto_payout' && !selectedAccountId)}
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
      marginBottom: 24,
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
    accountsSection: {
      marginTop: 8,
    },
    sectionTitle: {
      fontSize: getScaledFontSize(16, textSizeMultiplier),
      fontWeight: '600',
      color: colors.text,
      marginBottom: 12,
    },
    accountsContainer: {
      gap: 12,
    },
    accountCard: {
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 16,
      borderWidth: 2,
      borderColor: colors.border,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    accountCardSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.primary + '10',
    },
    accountInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    accountIcon: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.backgroundTertiary,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
      overflow: 'hidden',
    },
    accountIconText: {
      fontSize: getScaledFontSize(18, textSizeMultiplier),
      fontWeight: '700',
      color: colors.text,
    },
    bankLogoImage: {
      width: 40,
      height: 40,
    },
    accountDetails: {
      flex: 1,
    },
    accountName: {
      fontSize: getScaledFontSize(16, textSizeMultiplier),
      fontWeight: '600',
      color: colors.text,
      marginBottom: 4,
    },
    accountNumber: {
      fontSize: getScaledFontSize(14, textSizeMultiplier),
      color: colors.textSecondary,
      marginBottom: 2,
    },
    bankName: {
      fontSize: getScaledFontSize(12, textSizeMultiplier),
      color: colors.textTertiary,
    },
    radio: {
      width: 24,
      height: 24,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: colors.border,
      justifyContent: 'center',
      alignItems: 'center',
    },
  });

