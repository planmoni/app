import { View, Text, StyleSheet, ScrollView, Dimensions, Image, Pressable, Platform } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeNavigation } from '@/hooks/useSafeNavigation';
import Button from '@/components/Button';
import SuccessAnimation from '@/components/SuccessAnimation';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import React, { useEffect, useRef } from 'react';
import { useHaptics } from '@/hooks/useHaptics';
import { useFeedback } from '@/contexts/FeedbackContext';
import { formatDisplayDate, formatPayoutFrequency } from '@/lib/formatters';
import { getBankIconLogo } from '@/lib/bankIcons';
import { Building2, X } from 'lucide-react-native';

export default function SuccessScreen() {
  const { colors } = useTheme();
  const params = useLocalSearchParams();
  const haptics = useHaptics();
  const { navigateToHome } = useSafeNavigation();
  const { showFeedback } = useFeedback();
  const mountedRef = useRef(true);
  
  // Get screen dimensions for responsive design
  const { width: screenWidth } = Dimensions.get('window');
  const isSmallScreen = screenWidth < 375;
  const isMediumScreen = screenWidth >= 375 && screenWidth < 768;
  
  // Get values from route params with safe defaults
  const planId = params.planId as string | undefined;
  const totalAmount = params.totalAmount as string || '0';
  const frequency = params.frequency as string || 'monthly';
  const payoutAmount = params.payoutAmount as string || '0';
  const startDate = params.startDate as string || '';
  const bankName = params.bankName as string || '';
  const accountNumber = (params.accountNumber as string) || '';
  const dayOfWeek = params.dayOfWeek ? parseInt(params.dayOfWeek as string) : undefined;

  // Format amount with commas and proper number formatting
  const formatAmount = (amount: string) => {
    const numericAmount = parseFloat(amount.replace(/[^0-9.]/g, ''));
    if (isNaN(numericAmount)) return '₦0';
    return `₦${numericAmount.toLocaleString()}`;
  };

  // Trigger success haptic feedback when the screen loads
  useEffect(() => {
    mountedRef.current = true;
    const timer = setTimeout(() => {
      haptics.success();
    }, 300);
    return () => {
      clearTimeout(timer);
      mountedRef.current = false;
    };
  }, []);

  // Show feedback modal after a short delay (only if still on this screen)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (mountedRef.current) showFeedback('plan_creation');
    }, 2000);
    return () => clearTimeout(timer);
  }, [showFeedback]);

  const handleViewPayouts = () => {
    haptics.mediumImpact();
    router.push('/all-payouts');
  };

  const handleBackToDashboard = () => {
    haptics.lightImpact();
    router.replace('/(tabs)');
  };

  const handleSharePlan = () => {
    haptics.mediumImpact();
    if (planId) router.push({ pathname: '/view-payout', params: { id: planId } });
  };

  const styles = createStyles(colors, isSmallScreen, isMediumScreen);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerSpacer} />
        <Text style={styles.headerTitle}>Payout Plan Created</Text>
        <Pressable 
          onPress={() => {
            if (Platform.OS !== 'web') {
              haptics.lightImpact();
            }
            navigateToHome();
          }} 
          style={styles.cancelButton}
        >
          <X size={24} color={colors.text} />
        </Pressable>
      </View>
      
      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <SuccessAnimation />

        <Text style={styles.title}>Payout Plan Created!</Text>
        <Text style={styles.subtitle}>Your payout plan has been set up successfully</Text>

        <View style={styles.summaryCard}>
          <Text style={styles.amount}>{formatAmount(totalAmount)}</Text>
          <Text style={styles.description}>
            will be paid out in {formatPayoutFrequency(frequency, dayOfWeek).toLowerCase()} installments of{'\n'}
            <Text style={styles.highlight}>{formatAmount(payoutAmount)}</Text>
          </Text>

          <View style={styles.detailsContainer}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>First Payout</Text>
              <Text style={styles.detailValue} numberOfLines={2}>
                {formatDisplayDate(startDate)}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Destination</Text>
              <View style={styles.destinationContainer}>
                <View style={styles.bankIconContainer}>
                  {(() => {
                    const bankIcon = getBankIconLogo(bankName);
                    
                    if (bankIcon.logoSvg) {
                      // Handle SVG components
                      return React.createElement(bankIcon.logoSvg.default || bankIcon.logoSvg, {
                        width: 16,
                        height: 16,
                        fill: colors.primary
                      });
                    } else if (bankIcon.logo) {
                      return (
                        <Image 
                          source={bankIcon.logo} 
                          style={{ width: 16, height: 16, resizeMode: 'contain' }}
                        />
                      );
                    } else {
                      // Fallback to Building2 icon
                      return <Building2 size={16} color={colors.primary} />;
                    }
                  })()}
                </View>
                <Text style={styles.detailValue} numberOfLines={2}>
                  {bankName} •••• {accountNumber.length >= 4 ? accountNumber.slice(-4) : accountNumber}
                </Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Button 
          title="View All Payouts"
          onPress={handleViewPayouts}
          style={styles.viewPayoutsButton}
          hapticType="medium"
        />
        {planId ? (
          <Button 
            title="Share plan"
            onPress={handleSharePlan}
            variant="outline"
            style={styles.dashboardButton}
            hapticType="medium"
          />
        ) : null}
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

const createStyles = (colors: any, isSmallScreen: boolean, isMediumScreen: boolean) => StyleSheet.create({
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
  headerSpacer: {
    width: 40,
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
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: isSmallScreen ? 16 : 24,
    alignItems: 'center',
    paddingBottom: 32,
  },
  title: {
    fontSize: isSmallScreen ? 16 : isMediumScreen ? 18 : 20,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  subtitle: {
    fontSize: isSmallScreen ? 14 : 16,
    color: colors.textSecondary,
    marginBottom: isSmallScreen ? 24 : 32,
    textAlign: 'center',
    paddingHorizontal: 16,
    lineHeight: isSmallScreen ? 20 : 22,
  },
  summaryCard: {
    backgroundColor: colors.successLight,
    borderRadius: 12,
    padding: isSmallScreen ? 16 : 24,
    width: '100%',
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: colors.success,
    borderLeftWidth: 4,
    borderLeftColor: colors.success,
    maxWidth: 400,
  },
  amount: {
    fontSize: isSmallScreen ? 24 : isMediumScreen ? 28 : 32,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  description: {
    fontSize: isSmallScreen ? 14 : 16,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: isSmallScreen ? 20 : 24,
    paddingHorizontal: 8,
    lineHeight: isSmallScreen ? 20 : 22,
  },
  highlight: {
    color: colors.success,
    fontWeight: '600',
  },
  detailsContainer: {
    width: '100%',
    gap: isSmallScreen ? 8 : 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: 8,
  },
  detailLabel: {
    fontSize: isSmallScreen ? 12 : 14,
    color: colors.textSecondary,
    flexShrink: 0,
    minWidth: isSmallScreen ? 80 : 100,
  },
  detailValue: {
    fontSize: isSmallScreen ? 12 : 14,
    fontWeight: '500',
    color: colors.text,
    flex: 1,
    textAlign: 'right',
    flexWrap: 'wrap',
  },
  destinationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    justifyContent: 'flex-end',
  },
  bankIconContainer: {
    width: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notice: {
    backgroundColor: colors.card,
    padding: isSmallScreen ? 12 : 16,
    borderRadius: 12,
    width: '100%',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  noticeText: {
    fontSize: isSmallScreen ? 12 : 14,
    color: colors.text,
    textAlign: 'center',
    lineHeight: isSmallScreen ? 18 : 20,
  },
  footer: {
    padding: isSmallScreen ? 16 : 24,
    gap: isSmallScreen ? 8 : 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  viewPayoutsButton: {
    backgroundColor: '#1E3A8A',
    height: 55,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  dashboardButton: {
    borderColor: colors.border,
    height: 55,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
});