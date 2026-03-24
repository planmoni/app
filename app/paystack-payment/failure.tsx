import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { XCircle, AlertTriangle, ArrowLeft, RefreshCw, Home } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useTextSize } from '@/contexts/TextSizeContext';
import { getScaledFontSize } from '@/lib/textSize';
import { useHaptics } from '@/hooks/useHaptics';
import Button from '@/components/Button';
import SafeFooter from '@/components/SafeFooter';

export default function PaystackPaymentFailureScreen() {
  const { colors, isDark } = useTheme();
  const { textSizeMultiplier } = useTextSize();
  const insets = useSafeAreaInsets();
  const haptics = useHaptics();
  const params = useLocalSearchParams();
  
  const amount = params.amount as string;
  const reference = params.reference as string;
  const error = params.error as string;
  const errorType = params.errorType as string || 'verification'; // 'verification', 'payment', 'cancelled'

  const getErrorDetails = () => {
    switch (errorType) {
      case 'cancelled':
        return {
          title: 'Payment Cancelled',
          message: 'You cancelled the payment process. No funds were charged.',
          icon: XCircle,
          color: colors.warning,
        };
      case 'payment':
        return {
          title: 'Payment Failed',
          message: 'The payment could not be processed. Please try again or use a different payment method.',
          icon: AlertTriangle,
          color: colors.error,
        };
      case 'verification':
      default:
        return {
          title: 'Verification Failed',
          message: error || 'We couldn\'t verify your payment. Don\'t worry, if you were charged, your funds will be refunded within 24 hours.',
          icon: AlertTriangle,
          color: colors.error,
        };
    }
  };

  const errorDetails = getErrorDetails();
  const ErrorIcon = errorDetails.icon;

  const handleTryAgain = () => {
    haptics.mediumImpact();
    router.back();
  };

  const handleBackToDashboard = () => {
    haptics.lightImpact();
    router.replace('/(tabs)');
  };

  const handleContactSupport = () => {
    haptics.lightImpact();
    // Navigate to support or open support modal
    // router.push('/support');
  };

  const styles = createStyles(colors, isDark, textSizeMultiplier, errorDetails.color);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable
          onPress={handleBackToDashboard}
          style={styles.backButton}
        >
          <ArrowLeft size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Payment Status</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(20, insets.bottom) },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.iconContainer}>
          <View style={styles.iconBackground}>
            <ErrorIcon size={64} color={errorDetails.color} strokeWidth={1.5} />
          </View>
        </View>

        <Text style={styles.title}>{errorDetails.title}</Text>
        <Text style={styles.subtitle}>{errorDetails.message}</Text>

        {amount && (
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Attempted Amount</Text>
            <View style={styles.amountContainer}>
              <Text style={styles.currencySymbol}>₦</Text>
              <Text style={styles.amount}>{parseFloat(amount).toLocaleString('en-NG')}</Text>
            </View>
          </View>
        )}

        {reference && (
          <View style={styles.detailsCard}>
            <Text style={styles.detailsTitle}>Transaction Details</Text>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Reference</Text>
              <Text style={styles.detailValue} numberOfLines={1} ellipsizeMode="middle">
                {reference}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Date & Time</Text>
              <Text style={styles.detailValue}>
                {new Date().toLocaleString('en-NG')}
              </Text>
            </View>
          </View>
        )}

        {errorType === 'verification' && (
          <View style={styles.infoCard}>
            <View style={styles.infoHeader}>
              <View style={styles.infoIconContainer}>
                <AlertTriangle size={20} color={colors.warning} />
              </View>
              <Text style={styles.infoTitle}>What to do next?</Text>
            </View>
            <Text style={styles.infoText}>
              • Check your email for payment confirmation{'\n'}
              • If you were charged, contact support with your reference number{'\n'}
              • Funds will be automatically refunded if payment was unsuccessful{'\n'}
              • You can try the payment again
            </Text>
          </View>
        )}

        {errorType === 'payment' && (
          <View style={styles.infoCard}>
            <View style={styles.infoHeader}>
              <View style={styles.infoIconContainer}>
                <AlertTriangle size={20} color={colors.warning} />
              </View>
              <Text style={styles.infoTitle}>Payment Tips</Text>
            </View>
            <Text style={styles.infoText}>
              • Check your card details and try again{'\n'}
              • Ensure you have sufficient funds{'\n'}
              • Try a different payment method{'\n'}
              • Contact your bank if the issue persists
            </Text>
          </View>
        )}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(16, insets.bottom) }]}>
        {errorType !== 'cancelled' && (
          <Button
            title="Try Again"
            onPress={handleTryAgain}
            style={styles.primaryButton}
            icon={RefreshCw}
          />
        )}
        <Button
          title={errorType === 'cancelled' ? 'Back to Dashboard' : 'Go to Dashboard'}
          onPress={handleBackToDashboard}
          variant={errorType === 'cancelled' ? 'primary' : 'outline'}
          style={errorType === 'cancelled' ? styles.primaryButton : styles.secondaryButton}
          icon={Home}
        />
        {errorType === 'verification' && (
          <Button
            title="Contact Support"
            onPress={handleContactSupport}
            variant="outline"
            style={styles.secondaryButton}
          />
        )}
      </View>

      <SafeFooter />
    </SafeAreaView>
  );
}

const createStyles = (colors: any, isDark: boolean, textSizeMultiplier: number, errorColor: string) =>
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
    },
    headerTitle: {
      fontSize: getScaledFontSize(18, textSizeMultiplier),
      fontWeight: '600',
      color: colors.text,
      flex: 1,
      textAlign: 'center',
    },
    placeholder: {
      width: 40,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      padding: 24,
      alignItems: 'center',
    },
    iconContainer: {
      marginBottom: 24,
    },
    iconBackground: {
      width: 120,
      height: 120,
      borderRadius: 60,
      backgroundColor: errorColor + '20',
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 3,
      borderColor: errorColor + '40',
    },
    title: {
      fontSize: getScaledFontSize(28, textSizeMultiplier),
      fontWeight: '700',
      color: colors.text,
      marginBottom: 12,
      textAlign: 'center',
    },
    subtitle: {
      fontSize: getScaledFontSize(16, textSizeMultiplier),
      color: colors.textSecondary,
      marginBottom: 32,
      textAlign: 'center',
      lineHeight: 24,
    },
    summaryCard: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 24,
      width: '100%',
      alignItems: 'center',
      marginBottom: 24,
      borderWidth: 1,
      borderColor: colors.border,
    },
    summaryLabel: {
      fontSize: getScaledFontSize(14, textSizeMultiplier),
      color: colors.textSecondary,
      marginBottom: 8,
    },
    amountContainer: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'center',
    },
    currencySymbol: {
      fontSize: getScaledFontSize(28, textSizeMultiplier),
      fontWeight: '700',
      color: colors.text,
      marginRight: 4,
    },
    amount: {
      fontSize: getScaledFontSize(36, textSizeMultiplier),
      fontWeight: '700',
      color: colors.text,
    },
    detailsCard: {
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 20,
      width: '100%',
      marginBottom: 24,
      borderWidth: 1,
      borderColor: colors.border,
    },
    detailsTitle: {
      fontSize: getScaledFontSize(16, textSizeMultiplier),
      fontWeight: '600',
      color: colors.text,
      marginBottom: 16,
    },
    detailRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    detailLabel: {
      fontSize: getScaledFontSize(14, textSizeMultiplier),
      color: colors.textSecondary,
      flex: 1,
    },
    detailValue: {
      fontSize: getScaledFontSize(14, textSizeMultiplier),
      fontWeight: '500',
      color: colors.text,
      flex: 1,
      textAlign: 'right',
    },
    infoCard: {
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 20,
      width: '100%',
      marginBottom: 20,
      borderWidth: 1,
      borderColor: colors.border,
      borderLeftWidth: 4,
      borderLeftColor: colors.warning,
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
      backgroundColor: colors.warning + '20',
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    infoTitle: {
      fontSize: getScaledFontSize(16, textSizeMultiplier),
      fontWeight: '600',
      color: colors.text,
    },
    infoText: {
      fontSize: getScaledFontSize(14, textSizeMultiplier),
      color: colors.textSecondary,
      lineHeight: 22,
    },
    footer: {
      padding: 24,
      gap: 12,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.surface,
    },
    primaryButton: {
      backgroundColor: colors.primary,
      height: 55,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 12,
    },
    secondaryButton: {
      borderColor: colors.border,
      height: 55,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 12,
    },
  });