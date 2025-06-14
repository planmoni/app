import { View, Text, StyleSheet, Pressable, TextInput, useWindowDimensions } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Info } from 'lucide-react-native';
import Button from '@/components/Button';
import { useState, useEffect } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { useBalance } from '@/contexts/BalanceContext';
import SafeFooter from '@/components/SafeFooter';
import KeyboardAvoidingWrapper from '@/components/KeyboardAvoidingWrapper';
import FloatingButton from '@/components/FloatingButton';
import { useHaptics } from '@/hooks/useHaptics';

export default function AmountScreen() {
  const { colors, isDark } = useTheme();
  const { width, height } = useWindowDimensions();
  const params = useLocalSearchParams();
  const methodId = params.methodId as string;
  const methodTitle = params.methodTitle as string;
  const { balance } = useBalance();
  
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const haptics = useHaptics();

  // Determine if we're on a small screen
  const isSmallScreen = width < 380 || height < 700;

  const handleContinue = () => {
    if (!amount.trim()) {
      setError('Please enter an amount');
      haptics.error();
      return;
    }

    const numericAmount = parseFloat(amount.replace(/,/g, ''));
    if (isNaN(numericAmount) || numericAmount <= 0) {
      setError('Please enter a valid amount');
      haptics.error();
      return;
    }

    haptics.mediumImpact();
    router.replace({
      pathname: '/deposit-flow/authorization',
      params: {
        amount,
        methodId,
        methodTitle
      }
    });
  };

  const formatAmount = (value: string) => {
    const numericValue = value.replace(/[^0-9]/g, '');
    return numericValue.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  };

  const handleAmountChange = (value: string) => {
    const formattedValue = formatAmount(value);
    setAmount(formattedValue);
    setError(null);
  };

  const handleQuickAmount = (value: string) => {
    haptics.selection();
    setAmount(value);
    setError(null);
  };

  const styles = createStyles(colors, isDark, isSmallScreen);

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
        <Text style={styles.headerTitle}>Add Funds</Text>
      </View>

      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: '66%' }]} />
        </View>
        <Text style={styles.stepText}>Step 2 of 3</Text>
      </View>

      <KeyboardAvoidingWrapper contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          <Text style={styles.title}>How much do you want to add?</Text>
          <Text style={styles.description}>This money will be securely held in your wallet until used.</Text>

          <View style={styles.amountContainer}>
            <Text style={styles.currencySymbol}>₦</Text>
            <TextInput
              style={styles.amountInput}
              placeholder="0.00"
              placeholderTextColor={colors.textTertiary}
              keyboardType="numeric"
              value={amount}
              onChangeText={handleAmountChange}
            />
          </View>

          <View style={styles.quickAmounts}>
            <Pressable 
              style={[
                styles.quickAmount,
                amount === '100,000' && styles.quickAmountActive
              ]}
              onPress={() => handleQuickAmount('100,000')}
            >
              <Text style={[
                styles.quickAmountText,
                amount === '100,000' && styles.quickAmountTextActive
              ]}>₦100k</Text>
            </Pressable>
            <Pressable 
              style={[
                styles.quickAmount,
                amount === '500,000' && styles.quickAmountActive
              ]}
              onPress={() => handleQuickAmount('500,000')}
            >
              <Text style={[
                styles.quickAmountText,
                amount === '500,000' && styles.quickAmountTextActive
              ]}>₦500k</Text>
            </Pressable>
            <Pressable 
              style={[
                styles.quickAmount,
                amount === '1,000,000' && styles.quickAmountActive
              ]}
              onPress={() => handleQuickAmount('1,000,000')}
            >
              <Text style={[
                styles.quickAmountText,
                amount === '1,000,000' && styles.quickAmountTextActive
              ]}>₦1M</Text>
            </Pressable>
          </View>

          <View style={styles.balanceContainer}>
            <Text style={styles.balanceLabel}>Current Wallet Balance</Text>
            <View style={styles.balanceRow}>
              <Text style={styles.balanceAmount}>₦{balance.toLocaleString()}</Text>
            </View>
          </View>

          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <View style={styles.infoSection}>
            <View style={styles.infoCard}>
              <View style={styles.infoHeader}>
                <View style={styles.infoIconContainer}>
                  <Info size={isSmallScreen ? 16 : 20} color={colors.primary} />
                </View>
                <Text style={styles.infoTitle}>Security Notice</Text>
              </View>
              <Text style={styles.infoText}>
                Funds will be added to your secure wallet and can be used for transactions or investments.
              </Text>
            </View>
          </View>
        </View>
      </KeyboardAvoidingWrapper>

      <FloatingButton 
        title="Continue"
        onPress={handleContinue}
        disabled={!amount}
        hapticType="medium"
      />
      
      <SafeFooter />
    </SafeAreaView>
  );
}

const createStyles = (colors: any, isDark: boolean, isSmallScreen: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundSecondary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: isSmallScreen ? 12 : 16,
    paddingVertical: isSmallScreen ? 12 : 16,
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
    fontSize: isSmallScreen ? 16 : 18,
    fontWeight: '600',
    color: colors.text,
  },
  progressContainer: {
    padding: isSmallScreen ? 12 : 16,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  progressBar: {
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 2,
  },
  stepText: {
    fontSize: isSmallScreen ? 12 : 14,
    color: colors.textSecondary,
  },
  scrollContent: {
    paddingBottom: 100, // Extra padding for the floating button
  },
  content: {
    padding: isSmallScreen ? 16 : 20,
  },
  title: {
    fontSize: isSmallScreen ? 20 : 24,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },
  description: {
    fontSize: isSmallScreen ? 14 : 16,
    color: colors.textSecondary,
    marginBottom: isSmallScreen ? 20 : 24,
  },
  amountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 16,
    marginBottom: isSmallScreen ? 16 : 24,
  },
  currencySymbol: {
    fontSize: isSmallScreen ? 24 : 32,
    fontWeight: '600',
    color: colors.text,
    marginRight: 8,
  },
  amountInput: {
    flex: 1,
    fontSize: isSmallScreen ? 24 : 32,
    fontWeight: '600',
    color: colors.text,
    padding: 0,
  },
  quickAmounts: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: isSmallScreen ? 16 : 24,
    gap: 8,
  },
  quickAmount: {
    flex: 1,
    paddingVertical: isSmallScreen ? 10 : 12,
    paddingHorizontal: isSmallScreen ? 12 : 16,
    borderRadius: 8,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  quickAmountActive: {
    backgroundColor: colors.backgroundTertiary,
    borderColor: colors.primary,
  },
  quickAmountText: {
    fontSize: isSmallScreen ? 14 : 16,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  quickAmountTextActive: {
    color: colors.primary,
  },
  balanceContainer: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    borderRadius: 12,
    marginBottom: isSmallScreen ? 16 : 24,
  },
  balanceLabel: {
    fontSize: isSmallScreen ? 12 : 14,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  balanceAmount: {
    fontSize: isSmallScreen ? 18 : 20,
    fontWeight: '700',
    color: colors.text,
  },
  errorContainer: {
    backgroundColor: colors.errorLight,
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.error,
  },
  errorText: {
    color: colors.error,
    fontSize: 14,
  },
  infoSection: {
    marginBottom: isSmallScreen ? 16 : 24,
  },
  infoCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: isSmallScreen ? 16 : 20,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoIconContainer: {
    width: isSmallScreen ? 28 : 32,
    height: isSmallScreen ? 28 : 32,
    borderRadius: isSmallScreen ? 14 : 16,
    backgroundColor: isDark ? 'rgba(59, 130, 246, 0.1)' : colors.backgroundTertiary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  infoTitle: {
    fontSize: isSmallScreen ? 14 : 16,
    fontWeight: '600',
    color: colors.text,
  },
  infoText: {
    fontSize: isSmallScreen ? 13 : 14,
    color: colors.textSecondary,
    lineHeight: isSmallScreen ? 18 : 20,
  },
});