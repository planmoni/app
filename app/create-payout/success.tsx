import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Button from '@/components/Button';
import SuccessAnimation from '@/components/SuccessAnimation';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { useEffect } from 'react';
import { useHaptics } from '@/hooks/useHaptics';
import { formatDisplayDate, formatPayoutFrequency } from '@/lib/formatters';

export default function SuccessScreen() {
  const { colors } = useTheme();
  const params = useLocalSearchParams();
  const haptics = useHaptics();
  
  // Get values from route params with safe defaults
  const totalAmount = params.totalAmount as string || '0';
  const frequency = params.frequency as string || 'monthly';
  const payoutAmount = params.payoutAmount as string || '0';
  const startDate = params.startDate as string || '';
  const bankName = params.bankName as string || '';
  const accountNumber = (params.accountNumber as string) || '';
  const dayOfWeek = params.dayOfWeek ? parseInt(params.dayOfWeek as string) : undefined;

  // Trigger success haptic feedback when the screen loads
  useEffect(() => {
    // Use a small delay to ensure the screen is fully rendered
    const timer = setTimeout(() => {
      haptics.success();
    }, 300);
    
    return () => clearTimeout(timer);
  }, []);

  const handleViewPayouts = () => {
    haptics.mediumImpact();
    router.push('/all-payouts');
  };

  const handleBackToDashboard = () => {
    haptics.lightImpact();
    router.replace('/(tabs)');
  };

  const styles = createStyles(colors);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <SuccessAnimation />

        <Text style={styles.title}>Payout Plan Created!</Text>
        <Text style={styles.subtitle}>Your payout plan has been set up successfully</Text>

        <View style={styles.summaryCard}>
          <Text style={styles.amount}>₦{totalAmount}</Text>
          <Text style={styles.description}>
            will be paid out in {formatPayoutFrequency(frequency, dayOfWeek).toLowerCase()} installments of{'\n'}
            <Text style={styles.highlight}>₦{payoutAmount}</Text>
          </Text>

          <View style={styles.detailsContainer}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>First Payout</Text>
              <Text style={styles.detailValue}>{formatDisplayDate(startDate)}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Destination</Text>
              <Text style={styles.detailValue}>
                {bankName} •••• {accountNumber.length >= 4 ? accountNumber.slice(-4) : accountNumber}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.notice}>
          <Text style={styles.noticeText}>
            Your funds have been securely locked in your vault and will be automatically disbursed according to your schedule
          </Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Button 
          title="View All Payouts"
          onPress={handleViewPayouts}
          style={styles.viewPayoutsButton}
          hapticType="medium"
        />
        <Button 
          title="Back to Dashboard"
          onPress={handleBackToDashboard}
          variant="outline"
          style={styles.dashboardButton}
          hapticType="light"
        />
      </View>
    </SafeAreaView>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundSecondary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    marginBottom: 32,
    textAlign: 'center',
  },
  summaryCard: {
    backgroundColor: colors.successLight,
    borderRadius: 12,
    padding: 24,
    width: '100%',
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: colors.success,
    borderLeftWidth: 4,
    borderLeftColor: colors.success,
  },
  amount: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },
  description: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  highlight: {
    color: colors.success,
    fontWeight: '600',
  },
  detailsContainer: {
    width: '100%',
    gap: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
  },
  notice: {
    backgroundColor: colors.card,
    padding: 16,
    borderRadius: 12,
    width: '100%',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  noticeText: {
    fontSize: 14,
    color: colors.text,
    textAlign: 'center',
    lineHeight: 20,
  },
  footer: {
    padding: 24,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  viewPayoutsButton: {
    backgroundColor: '#1E3A8A',
  },
  dashboardButton: {
    borderColor: colors.border,
  },
});