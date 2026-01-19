import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, useWindowDimensions, ActivityIndicator, Alert } from 'react-native';
import { router } from 'expo-router';
import { ArrowLeft, ArrowRight, Shield, CheckCircle } from 'lucide-react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useHaptics } from '@/hooks/useHaptics';
import { useToast } from '@/contexts/ToastContext';
import { supabase } from '@/lib/supabase';
import PaystackLogo from '@/assets/banks/paystack.svg';
import SafeHavenLogo from '@/assets/banks/safe_haven_bank.svg';

export default function AddFundsScreen() {
  const { colors, isDark } = useTheme();
  const { session } = useAuth();
  const { width: screenWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const haptics = useHaptics();
  const { showToast } = useToast();
  const isSmallScreen = screenWidth < 380;
  
  const [isVerifying, setIsVerifying] = useState(true);
  const [isVerified, setIsVerified] = useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(null);

  const styles = createStyles(colors, isDark, isSmallScreen);

  // Verify user on mount
  useEffect(() => {
    verifyUserAccess();
  }, []);

  const verifyUserAccess = async () => {
    if (!session?.user?.id) {
      setVerificationError('Please log in to continue');
      setIsVerifying(false);
      return;
    }

    try {
      const { checkVerificationStatus } = await import('@/utils/verification-check');
      const result = await checkVerificationStatus(session.user.id);

      if (!result.canProceed) {
        setVerificationError(result.reason || 'Verification required');
        setIsVerified(false);
        
        // Show alert and redirect
        Alert.alert(
          'Verification Required',
          result.reason || 'Please complete verification to add funds.',
          [
            { text: 'Go Back', onPress: () => router.back(), style: 'cancel' },
            {
              text: 'Verify Now',
              onPress: () => router.replace(result.redirectTo || '/kyc/tier1')
            }
          ]
        );
      } else {
        setIsVerified(true);
      }
    } catch (error) {
      console.error('Verification error:', error);
      setVerificationError('Unable to verify account. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleBack = () => {
    haptics.lightImpact();
    router.back();
  };

  const handleBankTransfer = () => {
    haptics.mediumImpact();
    router.push('/bank-transfer');
  };

  const handleCards = async () => {
    // Double-check verification before proceeding
    if (!session?.user?.id) {
      Alert.alert('Error', 'Please log in to continue');
      return;
    }

    try {
      const { checkVerificationStatus, performBasicFraudCheck } = await import('@/utils/verification-check');
      
      // Verify again
      const verificationResult = await checkVerificationStatus(session.user.id);
      if (!verificationResult.canProceed) {
        Alert.alert(
          'Verification Required',
          verificationResult.reason || 'Please complete verification to proceed.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Verify Now', onPress: () => router.push('/kyc/tier1') }
          ]
        );
        return;
      }

      // Fraud check
      const fraudCheck = await performBasicFraudCheck(session.user.id);
      if (!fraudCheck.passed) {
        Alert.alert('Verification Failed', fraudCheck.reason || 'Unable to proceed.');
        return;
      }

      // All checks passed - proceed to Paystack
      haptics.mediumImpact();
      router.push('/paystack-payment');
    } catch (error) {
      console.error('Error in handleCards:', error);
      Alert.alert('Error', 'Something went wrong. Please try again.');
    }
  };

  const handleLinkBank = () => {
    haptics.mediumImpact();
    showToast('This feature is coming soon', 'info');
  };

  // Show loading state during verification
  if (isVerifying) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Verifying your account...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Show error state if verification failed
  if (!isVerified || verificationError) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Pressable onPress={handleBack} style={styles.backButton}>
            <ArrowLeft size={24} color={colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Add funds</Text>
        </View>
        <View style={styles.errorContainer}>
          <Shield size={48} color={colors.error} />
          <Text style={styles.errorTitle}>Verification Required</Text>
          <Text style={styles.errorMessage}>
            {verificationError || 'Please complete your verification to add funds.'}
          </Text>
          <Pressable
            style={[styles.verifyButton, { backgroundColor: colors.primary }]}
            onPress={() => router.push('/kyc/tier1')}
          >
            <Text style={styles.verifyButtonText}>Complete Verification</Text>
          </Pressable>
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
        <Text style={styles.headerTitle}>Add funds</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(20, insets.bottom) }
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>
          {/* Verification Badge */}
          <View style={[styles.verificationBadge, { backgroundColor: isDark ? '#166534' : '#DCFCE7' }]}>
            <CheckCircle size={20} color={colors.success} />
            <Text style={[styles.verificationText, { color: colors.success }]}>
              Account Verified
            </Text>
          </View>

          <Text style={styles.title}>Choose how you want to add funds</Text>
          <Text style={styles.subtitle}>
            Select a payment method to add money to your wallet
          </Text>

          <View style={styles.optionsContainer}>
            {/* Bank Transfer Option */}
            <Pressable
              style={styles.optionCard}
              onPress={handleBankTransfer}
            >
              <View style={styles.optionIconContainer}>
                <SafeHavenLogo width={24} height={24} />
              </View>
              <View style={styles.optionContent}>
                <Text style={styles.optionTitle}>Your Account Details</Text>
                <Text style={styles.optionDescription}>
                  Transfer money directly from your bank account
                </Text>
              </View>
              <ArrowRight size={20} color={colors.textSecondary} />
            </Pressable>

            {/* Cards Option - Paystack with Security Badge */}
            <Pressable
              style={styles.optionCard}
              onPress={handleCards}
            >
              <View style={styles.optionIconContainer}>
                <PaystackLogo width={24} height={24} />
              </View>
              <View style={styles.optionContent}>
                <View style={styles.optionTitleRow}>
                  <Text style={styles.optionTitle}>Continue with Paystack</Text>
                  <View style={[styles.securityBadge, { backgroundColor: colors.success }]}>
                    <Shield size={12} color="#fff" />
                  </View>
                </View>
                <Text style={styles.optionDescription}>
                  Add funds with Credit/Debit cards, Transfers, Direct Debit, USSD, and more.
                </Text>
              </View>
              <ArrowRight size={20} color={colors.textSecondary} />
            </Pressable>
          </View>
        </View>
      </ScrollView>
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
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
  subtitle: {
    fontSize: isSmallScreen ? 14 : 16,
    color: colors.textSecondary,
    marginBottom: 24,
    lineHeight: 22,
  },
  optionsContainer: {
    gap: 16,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: isSmallScreen ? 16 : 20,
    gap: 16,
    position: 'relative',
    overflow: 'visible',
  },
  optionIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.accentBackground,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  optionContent: {
    flex: 1,
  },
  optionTitle: {
    fontSize: isSmallScreen ? 16 : 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  optionDescription: {
    fontSize: isSmallScreen ? 13 : 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  comingSoonTag: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: colors.backgroundTertiary,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    zIndex: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  comingSoonText: {
    fontSize: isSmallScreen ? 10 : 11,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  optionCardDisabled: {
    opacity: 0.5,
  },
  optionIconContainerDisabled: {
    opacity: 0.6,
  },
  optionTitleDisabled: {
    opacity: 0.7,
  },
  optionDescriptionDisabled: {
    opacity: 0.7,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    gap: 16,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
    marginTop: 8,
  },
  errorMessage: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 8,
  },
  verifyButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 8,
  },
  verifyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  verificationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    marginBottom: 20,
  },
  verificationText: {
    fontSize: 14,
    fontWeight: '600',
  },
  optionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  securityBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
});