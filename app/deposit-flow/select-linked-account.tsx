/**
 * Select linked account for Direct Debit (Add funds flow).
 * Lists bank accounts linked via Mono; on select → mono-pay → amount → authorization → debit.
 * If no linked accounts, prompts user to link one first.
 */

import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { ArrowLeft, Building2, ChevronRight, Link2 } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { useHaptics } from '@/hooks/useHaptics';
import { useRealtimeBankAccounts } from '@/hooks/useRealtimeBankAccounts';
import Button from '@/components/Button';

export default function SelectLinkedAccountScreen() {
  const { colors } = useTheme();
  const haptics = useHaptics();
  const { bankAccounts, isLoading } = useRealtimeBankAccounts();

  const linkedAccounts = bankAccounts.filter((acc) => acc.mono_account_id);

  const handleSelectAccount = (accountId: string, monoAccountId: string, bankName: string) => {
    haptics.mediumImpact();
    router.push({
      pathname: '/deposit-flow/mono-pay',
      params: {
        accountId,
        monoAccountId,
        bankName: bankName || 'Bank Account',
      },
    });
  };

  const handleLinkAccount = () => {
    haptics.mediumImpact();
    router.push('/linked-accounts');
  };

  const handleBack = () => {
    haptics.lightImpact();
    router.back();
  };

  const styles = createStyles(colors);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Pressable onPress={handleBack} style={styles.backButton}>
            <ArrowLeft size={24} color={colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Pay from linked account</Text>
        </View>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading accounts...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={handleBack} style={styles.backButton}>
          <ArrowLeft size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Pay from linked account</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {linkedAccounts.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconContainer}>
              <Link2 size={40} color={colors.primary} />
            </View>
            <Text style={styles.emptyTitle}>No linked account yet</Text>
            <Text style={styles.emptyDescription}>
              Link your bank account once, then add funds anytime without logging in again. We'll debit only when you choose to fund your wallet.
            </Text>
            <Button title="Link bank account" onPress={handleLinkAccount} style={styles.linkButton} />
          </View>
        ) : (
          <View style={styles.content}>
            <Text style={styles.instruction}>
              Choose the account to debit. You'll enter the amount on the next screen.
            </Text>
            {linkedAccounts.map((account) => (
              <Pressable
                key={account.id}
                style={styles.accountCard}
                onPress={() =>
                  handleSelectAccount(account.id, account.mono_account_id!, account.bank_name)
                }
              >
                <View style={styles.accountIconContainer}>
                  <Building2 size={24} color={colors.primary} />
                </View>
                <View style={styles.accountInfo}>
                  <Text style={styles.accountName}>{account.account_name}</Text>
                  <Text style={styles.accountDetail}>
                    {account.bank_name} •••• {account.account_number.slice(-4)}
                  </Text>
                </View>
                <ChevronRight size={20} color={colors.textTertiary} />
              </Pressable>
            ))}
            <Pressable style={styles.addAnother} onPress={handleLinkAccount}>
              <Link2 size={20} color={colors.primary} />
              <Text style={styles.addAnotherText}>Link another account</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
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
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      flexGrow: 1,
      padding: 20,
    },
    centered: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 24,
    },
    loadingText: {
      marginTop: 12,
      fontSize: 16,
      color: colors.textSecondary,
    },
    emptyState: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 40,
      paddingHorizontal: 24,
    },
    emptyIconContainer: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: colors.accentBackground,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 24,
    },
    emptyTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 8,
      textAlign: 'center',
    },
    emptyDescription: {
      fontSize: 16,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 24,
      marginBottom: 32,
    },
    linkButton: {
      minWidth: 200,
    },
    content: {},
    instruction: {
      fontSize: 16,
      color: colors.textSecondary,
      marginBottom: 20,
      lineHeight: 22,
    },
    accountCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      padding: 16,
      marginBottom: 12,
      gap: 16,
    },
    accountIconContainer: {
      width: 48,
      height: 48,
      borderRadius: 12,
      backgroundColor: colors.accentBackground,
      justifyContent: 'center',
      alignItems: 'center',
    },
    accountInfo: {
      flex: 1,
    },
    accountName: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 2,
    },
    accountDetail: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    addAnother: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 16,
      marginTop: 8,
    },
    addAnotherText: {
      fontSize: 16,
      color: colors.primary,
      fontWeight: '500',
    },
  });
