import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Building2, Clock, TriangleAlert as AlertTriangle } from 'lucide-react-native';
import Button from '@/components/Button';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import SafeFooter from '@/components/SafeFooter';
import KeyboardAvoidingWrapper from '@/components/KeyboardAvoidingWrapper';
import FloatingButton from '@/components/FloatingButton';
import { useBalance } from '@/contexts/BalanceContext';
import { useHaptics } from '@/hooks/useHaptics';

export default function AuthorizationScreen() {
  const { colors } = useTheme();
  const params = useLocalSearchParams();
  const amount = params.amount as string;
  const methodId = params.methodId as string;
  const methodTitle = params.methodTitle as string;
  const newMethodType = params.newMethodType as string;
  const { addFunds } = useBalance();
  const haptics = useHaptics();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleFundWallet = async () => {
    try {
      setIsProcessing(true);
      // Process the deposit
      const numericAmount = parseFloat(amount.replace(/,/g, ''));
      console.log('Funding wallet with amount:', numericAmount);
      await addFunds(numericAmount);
      haptics.success();
      
      // Navigate to success screen
      router.replace({
        pathname: '/deposit-flow/success',
        params: {
          amount,
          methodTitle: methodTitle || getMethodTitle(newMethodType)
        }
      });
    } catch (error) {
      haptics.error();
      console.error('Error funding wallet:', error);
      setIsProcessing(false);
    }
  };

  const getMethodTitle = (type: string): string => {
    switch (type) {
      case 'card':
        return 'New Card';
      case 'ussd':
        return 'USSD Payment';
      case 'bank-account':
        return 'Bank Account';
      default:
        return 'New Payment Method';
    }
  };

  const styles = createStyles(colors);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Payment</Text>
      </View>

      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: '100%' }]} />
        </View>
        <Text style={styles.stepText}>Step 3 of 3</Text>
      </View>

      <KeyboardAvoidingWrapper contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          <Text style={styles.title}>Payment Authorization</Text>
          <Text style={styles.description}>Review your deposit details before proceeding.</Text>

          <View style={styles.summaryCard}>
            <View style={styles.summaryHeader}>
              <Text style={styles.summaryTitle}>Deposit Summary</Text>
            </View>

            <View style={styles.summaryContent}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Amount</Text>
                <Text style={styles.summaryValue}>₦{amount}</Text>
              </View>

              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Payment Method</Text>
                <View style={styles.methodContainer}>
                  <Building2 size={16} color={colors.primary} />
                  <Text style={styles.methodText}>
                    {methodTitle || getMethodTitle(newMethodType)}
                  </Text>
                </View>
              </View>
              {methodId && <Text style={styles.defaultText}>Default Account</Text>}

              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Processing Fee</Text>
                <Text style={styles.summaryValue}>₦0.00</Text>
              </View>

              <View style={[styles.summaryRow, styles.totalRow]}>
                <Text style={styles.totalLabel}>Total Amount</Text>
                <Text style={styles.totalValue}>₦{amount}</Text>
              </View>

              <View style={styles.estimateContainer}>
                <Clock size={16} color={colors.primary} />
                <Text style={styles.estimateLabel}>Estimated Time to Reflect</Text>
                <Text style={styles.estimateValue}>Instant - 5 minutes</Text>
              </View>
            </View>
          </View>

          <View style={styles.infoCard}>
            <View style={styles.infoHeader}>
              <View style={styles.infoIconContainer}>
                <AlertTriangle size={20} color={colors.primary} />
              </View>
              <Text style={styles.infoTitle}>Security Notice</Text>
            </View>
            <Text style={styles.infoText}>
              Your transaction will require PIN verification for security.
            </Text>
          </View>
        </View>
      </KeyboardAvoidingWrapper>

      <FloatingButton 
        title={isProcessing ? "Processing..." : "Fund wallet now"}
        onPress={handleFundWallet}
        disabled={isProcessing}
      />
      
      <SafeFooter />
    </SafeAreaView>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
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
  progressContainer: {
    padding: 20,
    paddingBottom: 0,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  progressBar: {
    height: 6,
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
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 20,
  },
  scrollContent: {
    paddingBottom: 100, // Extra padding for the floating button
  },
  content: {
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 24,
  },
  summaryCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 24,
    overflow: 'hidden',
  },
  summaryHeader: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.backgroundTertiary,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  summaryContent: {
    padding: 20,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  summaryLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
  },
  methodContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  methodText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
  },
  defaultText: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'right',
    marginTop: -12,
    marginBottom: 16,
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 16,
    marginTop: 8,
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  totalValue: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  estimateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    backgroundColor: colors.backgroundTertiary,
    padding: 12,
    borderRadius: 8,
  },
  estimateLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  estimateValue: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
  },
  infoCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 20,
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
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.backgroundTertiary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  infoText: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
});