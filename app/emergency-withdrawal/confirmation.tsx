import { View, Text, StyleSheet, Pressable, ScrollView, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Clock, CircleCheck as CheckCircle } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import Button from '@/components/Button';
import SafeFooter from '@/components/SafeFooter';
import { useHaptics } from '@/hooks/useHaptics';
import { useEffect, useState } from 'react';
import * as Haptics from 'expo-haptics';
import { supabase } from '@/lib/supabase';
import { useBalance } from '@/contexts/BalanceContext';
import PlanmoniLoader from '@/components/PlanmoniLoader';

export default function EmergencyWithdrawalConfirmationScreen() {
  const { colors, isDark } = useTheme();
  const params = useLocalSearchParams();
  const planId = params.planId as string;
  const planName = params.planName as string;
  const planAmount = params.planAmount as string;
  const option = params.option as string;
  const feeAmount = params.feeAmount as string;
  const netAmount = params.netAmount as string;
  const haptics = useHaptics();
  const { refreshWallet } = useBalance();
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Trigger success haptic feedback when the screen loads
  useEffect(() => {
    if (!isSuccess) {
      haptics.notification(Haptics.NotificationFeedbackType.Success);
    }
  }, []);
  
  const processEmergencyWithdrawal = async () => {
    try {
      setIsProcessing(true);
      setError(null);
      
      // Get the current session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('You must be logged in to process a withdrawal');
      }
      
      // Call the emergency withdrawal API
      const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL || ''}/api/emergency-withdrawal`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          planId,
          option,
          amount: planAmount,
          feeAmount,
          netAmount
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to process emergency withdrawal');
      }
      
      // Refresh wallet balance
      await refreshWallet();
      
      // Set success state
      setIsSuccess(true);
      haptics.notification(Haptics.NotificationFeedbackType.Success);
      
    } catch (err) {
      console.error('Error processing emergency withdrawal:', err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
      haptics.notification(Haptics.NotificationFeedbackType.Error);
      
      Alert.alert(
        'Withdrawal Failed',
        err instanceof Error ? err.message : 'Failed to process your emergency withdrawal. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsProcessing(false);
    }
  };
  
  useEffect(() => {
    // Process the withdrawal when the screen loads
    processEmergencyWithdrawal();
  }, []);
  
  const getOptionDetails = () => {
    switch (option) {
      case 'instant':
        return {
          title: 'Instant Withdrawal',
          description: 'Your funds will be processed immediately',
          timeframe: 'within minutes',
        };
      case '24h':
        return {
          title: '24-Hour Withdrawal',
          description: 'Your funds will be processed within 24 hours',
          timeframe: 'within 24 hours',
        };
      case '72h':
        return {
          title: '72-Hour Withdrawal',
          description: 'Your funds will be processed within 72 hours',
          timeframe: 'within 72 hours',
        };
      default:
        return {
          title: 'Emergency Withdrawal',
          description: 'Your funds will be processed',
          timeframe: 'soon',
        };
    }
  };
  
  const optionDetails = getOptionDetails();
  
  const handleBackToDashboard = () => {
    haptics.mediumImpact();
    router.replace('/(tabs)');
  };
  
  const handleViewTransactions = () => {
    haptics.mediumImpact();
    router.push('/transactions');
  };
  
  const styles = createStyles(colors, isDark);
  
  if (isProcessing) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Processing Withdrawal</Text>
        </View>
        
        <View style={styles.loadingContainer}>
          <PlanmoniLoader size="medium" description="Processing your emergency withdrawal..." />
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
            router.replace('/(tabs)');
          }} 
          style={styles.backButton}
        >
          <ArrowLeft size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Withdrawal Confirmation</Text>
      </View>
      
      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        <View style={styles.successContainer}>
          <View style={styles.successIcon}>
            <CheckCircle size={48} color="#22C55E" />
          </View>
          
          <Text style={styles.successTitle}>Withdrawal Requested</Text>
          <Text style={styles.successDescription}>
            Your emergency withdrawal request has been submitted successfully.
          </Text>
        </View>
        
        <View style={styles.detailsCard}>
          <Text style={styles.detailsTitle}>{optionDetails.title}</Text>
          
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Payout Plan</Text>
            <Text style={styles.detailValue}>{planName}</Text>
          </View>
          
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Withdrawal Amount</Text>
            <Text style={styles.detailValue}>{planAmount}</Text>
          </View>
          
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Processing Fee</Text>
            <Text style={styles.detailValue}>₦{parseFloat(feeAmount).toLocaleString()}</Text>
          </View>
          
          <View style={[styles.detailRow, styles.totalRow]}>
            <Text style={styles.totalLabel}>Net Amount</Text>
            <Text style={styles.totalValue}>₦{parseFloat(netAmount).toLocaleString()}</Text>
          </View>
        </View>
        
        <View style={styles.timeframeCard}>
          <View style={styles.timeframeIcon}>
            <Clock size={24} color={colors.primary} />
          </View>
          <View style={styles.timeframeContent}>
            <Text style={styles.timeframeTitle}>Expected Processing Time</Text>
            <Text style={styles.timeframeDescription}>
              Your funds will be sent to your default bank account {optionDetails.timeframe}.
            </Text>
          </View>
        </View>
        
        <View style={styles.noteCard}>
          <Text style={styles.noteText}>
            You will receive a notification once your withdrawal has been processed. You can check the status of your withdrawal in the Transactions tab.
          </Text>
        </View>
      </ScrollView>
      
      <View style={styles.footer}>
        <Button
          title="View Transactions"
          onPress={handleViewTransactions}
          style={styles.transactionsButton}
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
      
      <SafeFooter />
    </SafeAreaView>
  );
}

const createStyles = (colors: any, isDark: boolean) => StyleSheet.create({
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
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  successContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F0FDF4',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },
  successDescription: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    maxWidth: '80%',
  },
  detailsCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  detailsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
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
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: 8,
    paddingTop: 12,
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
  timeframeCard: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  timeframeIcon: {
    marginRight: 12,
  },
  timeframeContent: {
    flex: 1,
  },
  timeframeTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  timeframeDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  noteCard: {
    backgroundColor: isDark ? 'rgba(59, 130, 246, 0.1)' : '#EFF6FF',
    borderRadius: 12,
    padding: 16,
  },
  noteText: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  footer: {
    padding: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  transactionsButton: {
    backgroundColor: colors.primary,
  },
  dashboardButton: {
    borderColor: colors.border,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});