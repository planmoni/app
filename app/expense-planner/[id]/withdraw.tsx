import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, X, Plus } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useTextSize } from '@/contexts/TextSizeContext';
import { getScaledFontSize } from '@/lib/textSize';
import { useHaptics } from '@/hooks/useHaptics';
import FloatingButton from '@/components/FloatingButton';
import { usePayoutAccounts } from '@/hooks/usePayoutAccounts';
import AddPayoutAccountModal from '@/components/AddPayoutAccountModal';
import { getBankIconLogo } from '@/lib/bankIcons';

export default function WithdrawScreen() {
  const { colors, isDark } = useTheme();
  const { textSizeMultiplier } = useTextSize();
  const haptics = useHaptics();
  const params = useLocalSearchParams();
  const planId = params.id as string;
  
  const { payoutAccounts, isLoading: accountsLoading, fetchPayoutAccounts } = usePayoutAccounts();
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    // Set default account if available
    if (payoutAccounts.length > 0 && !selectedAccountId) {
      const defaultAccount = payoutAccounts.find(acc => acc.is_default) || payoutAccounts[0];
      setSelectedAccountId(defaultAccount.id);
    }
  }, [payoutAccounts]);


  const handleWithdraw = async () => {
    if (!selectedAccountId) {
      Alert.alert('Account Required', 'Please select a payout account');
      haptics.notification();
      return;
    }

    haptics.mediumImpact();
    setIsProcessing(true);

    try {
      // TODO: Implement actual withdrawal logic
      // await withdrawExpenseFunds(selectedAccountId);
      
      const selectedAccount = payoutAccounts.find(acc => acc.id === selectedAccountId);
      Alert.alert(
        'Withdrawal Initiated',
        `Funds will be transferred to ${selectedAccount?.bank_name} ••••${selectedAccount?.account_number.slice(-4)}.`,
        [
          {
            text: 'OK',
            onPress: () => {
              router.back();
            },
          },
        ]
      );
    } catch (error) {
      console.error('Error processing withdrawal:', error);
      Alert.alert('Error', 'Failed to process withdrawal. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const styles = createStyles(colors, isDark, textSizeMultiplier);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Withdraw Funds</Text>
        <Pressable 
          onPress={() => {
            haptics.selection();
            router.back();
          }} 
          style={styles.closeButton}
        >
          <X size={24} color={colors.text} />
        </Pressable>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.sectionTitle}>Select payout account</Text>
        <Text style={styles.sectionDescription}>
          Choose where you want to receive the withdrawn funds
        </Text>

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

        {payoutAccounts.length < 3 && (
          <Pressable
            style={styles.addAccountButton}
            onPress={() => {
              haptics.selection();
              setShowAddAccount(true);
            }}
          >
            <Plus size={20} color={colors.primary} />
            <Text style={styles.addAccountText}>Add New Account</Text>
          </Pressable>
        )}
      </ScrollView>

      <FloatingButton
        title="Withdraw"
        onPress={handleWithdraw}
        disabled={!selectedAccountId || isProcessing}
        hapticType="medium"
      />

      <AddPayoutAccountModal
        isVisible={showAddAccount}
        onClose={async (newAccount) => {
          haptics.lightImpact();
          setShowAddAccount(false);
          if (newAccount) {
            await fetchPayoutAccounts();
            setSelectedAccountId(newAccount.id);
          }
        }}
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
    sectionTitle: {
      fontSize: getScaledFontSize(20, textSizeMultiplier),
      fontWeight: '700',
      color: colors.text,
      marginBottom: 8,
    },
    sectionDescription: {
      fontSize: getScaledFontSize(14, textSizeMultiplier),
      color: colors.textSecondary,
      marginBottom: 20,
      lineHeight: 20,
    },
    accountsContainer: {
      gap: 12,
      marginBottom: 16,
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
    radioSelected: {
      borderColor: colors.primary,
    },
    radioInner: {
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: colors.primary,
    },
    addAccountButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 16,
      borderWidth: 2,
      borderColor: colors.border,
      borderStyle: 'dashed',
      borderRadius: 12,
      marginBottom: 24,
    },
    addAccountText: {
      fontSize: getScaledFontSize(14, textSizeMultiplier),
      fontWeight: '600',
      color: colors.primary,
    },
  });

