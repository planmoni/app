import React, { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, ActivityIndicator, Text, Pressable, useWindowDimensions, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { X, CircleHelp as HelpCircle } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useTier1KYC } from '@/hooks/useTier1KYC';
import LivenessStep from '@/components/kyc/tier1/LivenessStep';
import BVNStep from '@/components/kyc/tier1/BVNStep';
import NINStep from '@/components/kyc/tier1/NINStep';
import OTPStep from '@/components/kyc/tier1/OTPStep';
import BVNOTPStep from '@/components/kyc/tier1/BVNOTPStep';
import { useKYCProgress } from '@/hooks/useKYCProgress';
import { useKYCData } from '@/hooks/useKYCData';
import { useIntercom } from '@/hooks/useIntercom';
import { useHaptics } from '@/hooks/useHaptics';
import { logAnalyticsEvent } from '@/lib/firebase';
import { safeHavenService } from '@/lib/safehaven-service';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';

export default function Tier1KYCScreen() {
  const { colors } = useTheme();
  const { width, height } = useWindowDimensions();
  const isSmallScreen = width < 380 || height < 700;
  const { currentStep, setCurrentStep, progress, loadProgress, isTier1Complete, updateTier, formData: tier1FormData, stepInitialized } = useTier1KYC();
  const { checkTierCompletion } = useKYCProgress();
  const { formData, loadFormData } = useKYCData();
  const { openChat, isLoading: isHelpLoading, isSupported: isIntercomSupported } = useIntercom();
  const haptics = useHaptics();
  const { session } = useAuth();
  const { showToast } = useToast();
  const [isMounted, setIsMounted] = useState(false);
  const [otpData, setOtpData] = useState<{ nin: string; identityId: string; otpMessage?: string } | null>(null);
  const [bvnOtpData, setBvnOtpData] = useState<{ bvn: string; identityId: string; otpMessage?: string } | null>(null);
  const [isSendingBVNOTP, setIsSendingBVNOTP] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Wait for component to mount before checking completion
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // TIER 1 COMPLETION CHECK - COMPLETELY ISOLATED FROM TIER 2
  // Only run when Tier 1 screen is actually focused (not when navigating to Tier 2)
  useFocusEffect(
    useCallback(() => {
      if (!isMounted) return;

      let hasChecked = false;

      const checkCompletion = async () => {
        // Only check once per focus
        if (hasChecked) return;
        hasChecked = true;

        try {
          // Wait a bit to ensure we're actually on Tier 1 screen
          await new Promise(resolve => setTimeout(resolve, 300));
          
          await loadProgress();
          await updateTier();
          
          const tierStatus = checkTierCompletion();
          
          console.log('🔍 Tier 1 - Checking completion status (ISOLATED):', {
            tierStatus,
            currentStep,
            shouldRedirect: tierStatus.tier1
          });
          
          // Only redirect if Tier 1 is complete AND we're not actively on a step
          // This prevents redirecting while user is filling the form
          if (tierStatus.tier1 && currentStep !== 'liveness' && currentStep !== 'bvn' && currentStep !== 'nin' && currentStep !== 'otp' && currentStep !== 'bvn_otp') {
            // Already completed, redirect to Tier 1 success ONLY (NOT Tier 2)
            console.log('✅ Tier 1 complete, redirecting to Tier 1 success (NOT Tier 2)');
            setTimeout(() => {
              try {
                router.replace('/kyc/tier1/success');
              } catch (error) {
                console.error('Navigation error:', error);
                // Retry after a longer delay
                setTimeout(() => {
                  router.replace('/kyc/tier1/success');
                }, 500);
              }
            }, 300);
          } else {
            console.log('⏳ Tier 1 not complete yet or user is on a step:', currentStep);
          }
        } catch (error) {
          console.error('Error checking Tier 1 completion:', error);
        }
      };

      // Delay the check to ensure router is ready and we're actually on Tier 1
      const timer = setTimeout(() => {
        checkCompletion();
      }, 500);

      return () => {
        clearTimeout(timer);
        hasChecked = false;
      };
    }, [isMounted, currentStep, loadProgress, updateTier, checkTierCompletion])
  );

  // Handle step completion
  const handleLivenessComplete = async () => {
    try {
      // Set transitioning state to show loading during transition
      setIsTransitioning(true);
      
      // Ensure progress is loaded before changing step
      await loadProgress();
      
      // Wait a bit to ensure state has propagated
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Reload progress one more time to get the latest state
      await loadProgress();
      
      // Always advance to BVN step to prevent blank screen
      // The progress update has been called, so even if state hasn't propagated yet,
      // it will be correct. The useTier1KYC hook will handle any corrections if needed.
      console.log('✅ Advancing to BVN step after liveness completion');
      setCurrentStep('bvn');
      
      // Clear transitioning state after BVN step has had time to render
      // Use requestAnimationFrame to ensure the step is rendered before clearing loading
      requestAnimationFrame(() => {
        setTimeout(() => {
          setIsTransitioning(false);
        }, 100);
      });
    } catch (error) {
      console.error('Error in handleLivenessComplete:', error);
      // Always advance to prevent getting stuck on blank screen
    setCurrentStep('bvn');
      setIsTransitioning(false);
    }
  };

  const handleBVNComplete = () => {
    setCurrentStep('nin');
  };

  // Handler for switching from NIN step to BVN step
  // If BVN is already verified, initialize BVN OTP and go to BVN OTP step
  // Otherwise, go to BVN verification step
  const handleSwitchFromNINToBVN = async () => {
    // Reload form data to ensure we have the latest BVN
    await loadFormData();
    
    // Check if BVN is verified
    if (progress?.bvn_verified) {
      // BVN is verified, initialize BVN OTP and navigate to BVN OTP step
      const bvn = formData?.bvn || tier1FormData?.bvn;
      
      if (!bvn || bvn.length !== 11) {
        showToast('BVN not found. Please complete BVN verification first.', 'error');
        return;
      }
      
      if (!session?.user?.id || !session?.user?.email) {
        showToast('Authentication required', 'error');
        return;
      }
      
      setIsSendingBVNOTP(true);
      
      try {
        // Initialize BVN verification to get OTP
        const result = await safeHavenService.initializeBVNVerification(
          session.user.id,
          bvn,
          session.user.email
        );
        
        if (result.success && result.data?.identityId) {
          const identityId = result.data.identityId;
          const otpMessage = result.data?.otpMessage || 'OTP sent to phone number linked to your BVN';
          
          // Store BVN OTP data
          setBvnOtpData({
            bvn: bvn,
            identityId: identityId,
            otpMessage: otpMessage
          });
          
          // Clear NIN OTP data
          setOtpData(null);
          
          // Navigate to BVN OTP step
          setCurrentStep('bvn_otp');
          
          showToast(otpMessage, 'success');
        } else {
          showToast(result.error || 'Failed to initialize BVN verification', 'error');
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to initialize BVN verification';
        showToast(errorMessage, 'error');
      } finally {
        setIsSendingBVNOTP(false);
      }
    } else {
      // BVN is not verified, go to BVN verification step
      setCurrentStep('bvn');
    }
  };

  const handleNINComplete = (nin: string, identityId: string, otpMessage?: string) => {
    // Store OTP data and navigate to OTP step
    setOtpData({ nin, identityId, otpMessage });
    setCurrentStep('otp');
  };

  const handleOTPComplete = async () => {
    // NIN OTP verification is complete, navigate to success screen
    // Reload progress and update tier to ensure latest state
    await loadProgress();
    await updateTier();
    
    // Navigate directly to success screen - NIN verification is the final step
    router.push('/kyc/tier1/success');
  };

  const handleSwitchToBVN = async () => {
    // Reload form data to ensure we have the latest BVN
    await loadFormData();
    
    // Check if BVN is verified in progress
    if (!progress?.bvn_verified) {
      console.error('BVN not verified. Please complete BVN verification first.');
      return;
    }
    
    // Get BVN from form data (try both sources)
    const bvn = formData?.bvn || tier1FormData?.bvn;
    if (!bvn || bvn.length !== 11) {
      // If BVN is not in form data but is verified, try reloading one more time
      await loadFormData();
      const retryBvn = formData?.bvn || tier1FormData?.bvn;
      if (!retryBvn || retryBvn.length !== 11) {
        console.error('BVN not found in form data for BVN OTP switch. BVN verified:', progress?.bvn_verified);
        return;
      }
      // Use retry BVN
      setOtpData(null);
      setCurrentStep('bvn_otp');
      return;
    }
    
    // Clear NIN OTP data and set current step to BVN OTP
    setOtpData(null);
    setCurrentStep('bvn_otp');
  };

  const handleSwitchToNIN = () => {
    // Navigate directly to NIN step
    setCurrentStep('nin');
  };

  const handleSwitchToNINFromBVNOTP = () => {
    // If we have NIN OTP data, go back to NIN OTP step
    // Otherwise, go to NIN input step
    if (otpData) {
      setCurrentStep('otp');
    } else {
      setCurrentStep('nin');
    }
  };

  const handleBVNOTPComplete = async () => {
    // BVN OTP verification is complete, navigate to success screen
    // Reload progress and update tier to ensure latest state
    await loadProgress();
    await updateTier();
    
    // Navigate directly to success screen - BVN OTP verification is the final step
    router.push('/kyc/tier1/success');
  };

  const handleHelpPress = async () => {
    if (Platform.OS !== 'web') {
      haptics.lightImpact();
    }
    
    if (!isIntercomSupported) {
      return;
    }
    
    try {
      console.log('🎯 Help button pressed - opening Intercom instantly');
      await openChat();
      logAnalyticsEvent('help_click', { source: 'tier1_kyc_flow' });
    } catch (error) {
      console.error('❌ Failed to open Intercom:', error);
      Alert.alert(
        'Support Chat Unavailable',
        'Unable to open support chat at the moment. This might be due to network connectivity issues. Would you like to try again?',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Retry', 
            onPress: () => {
              console.log('🔄 Retrying Intercom...');
              handleHelpPress();
            }
          }
        ]
      );
    }
  };

  // Show loading while checking progress or initializing step
  // This prevents showing the wrong step before the correct one is determined
  if (!progress || !stepInitialized || isTransitioning) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  // Render current step
  const renderCurrentStep = () => {
    switch (currentStep) {
      case 'liveness':
        return <LivenessStep onComplete={handleLivenessComplete} />;
      case 'bvn':
        return <BVNStep onComplete={handleBVNComplete} onSwitchToNIN={handleSwitchToNIN} />;
      case 'nin':
        return <NINStep onComplete={handleNINComplete} onSwitchToBVN={handleSwitchFromNINToBVN} isSendingBVNOTP={isSendingBVNOTP} />;
      case 'otp':
        if (otpData) {
          return (
            <OTPStep 
              onComplete={handleOTPComplete} 
              nin={otpData.nin}
              identityId={otpData.identityId}
              otpMessage={otpData.otpMessage}
              onSwitchToBVN={handleSwitchToBVN}
            />
          );
        }
        // If no otpData, go back to NIN step instead of LivenessStep
        // This prevents showing "Selfie captured" when user is on OTP step
        return <NINStep onComplete={handleNINComplete} onSwitchToBVN={handleSwitchFromNINToBVN} isSendingBVNOTP={isSendingBVNOTP} />;
      case 'bvn_otp':
        if (formData?.bvn && bvnOtpData?.identityId) {
          return (
            <BVNOTPStep 
              onComplete={handleBVNOTPComplete}
              bvn={formData.bvn}
              identityId={bvnOtpData.identityId}
              otpMessage={bvnOtpData?.otpMessage}
              onSwitchToNIN={handleSwitchToNINFromBVNOTP}
            />
          );
        }
        // If no BVN or OTP data, go back to BVN step
        return <BVNStep onComplete={handleBVNComplete} onSwitchToNIN={handleSwitchToNIN} />;
      default:
        // If currentStep is invalid or unexpected, determine correct step based on progress
        // IMPORTANT: Always prioritize currentStep to avoid race conditions during step transitions
        // This prevents blank screen when step is changing but progress hasn't updated yet
        if (currentStep === 'bvn') {
          return <BVNStep onComplete={handleBVNComplete} onSwitchToNIN={handleSwitchToNIN} />;
        } else if (currentStep === 'nin') {
          return <NINStep onComplete={handleNINComplete} onSwitchToBVN={handleSwitchFromNINToBVN} isSendingBVNOTP={isSendingBVNOTP} />;
        } else if (currentStep === 'otp' || currentStep === 'bvn_otp') {
          // OTP steps are handled above, but include here as fallback
          if (currentStep === 'otp' && otpData) {
            return (
              <OTPStep 
                onComplete={handleOTPComplete} 
                nin={otpData.nin}
                identityId={otpData.identityId}
                otpMessage={otpData.otpMessage}
                onSwitchToBVN={handleSwitchToBVN}
              />
            );
          } else if (currentStep === 'bvn_otp' && formData?.bvn && bvnOtpData?.identityId) {
            return (
              <BVNOTPStep 
                onComplete={handleBVNOTPComplete}
                bvn={formData.bvn}
                identityId={bvnOtpData.identityId}
                otpMessage={bvnOtpData?.otpMessage}
                onSwitchToNIN={handleSwitchToNINFromBVNOTP}
              />
            );
          }
        }
        
        // Fallback: determine step based on progress if currentStep is not set or invalid
        if (!progress?.liveness_test_completed) {
          return <LivenessStep onComplete={handleLivenessComplete} />;
        } else if (!progress?.bvn_verified) {
          return <BVNStep onComplete={handleBVNComplete} onSwitchToNIN={handleSwitchToNIN} />;
        } else if (!progress?.id_face_verified) {
          return <NINStep onComplete={handleNINComplete} onSwitchToBVN={handleSwitchFromNINToBVN} isSendingBVNOTP={isSendingBVNOTP} />;
        }
        // All steps complete, but still show NIN step as fallback
        return <NINStep onComplete={handleNINComplete} onSwitchToBVN={handleSwitchFromNINToBVN} isSendingBVNOTP={isSendingBVNOTP} />;
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Pressable 
          onPress={() => router.replace('/(tabs)')} 
          style={[styles.closeButton, { backgroundColor: colors.surface }]}
        >
          <X size={isSmallScreen ? 20 : 24} color={colors.text} />
        </Pressable>
        <View style={styles.headerTitleContainer}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Tier 1 Verification</Text>
        </View>
        <Pressable 
          onPress={handleHelpPress}
          disabled={!isIntercomSupported || isHelpLoading}
          style={[styles.helpButton, { backgroundColor: colors.backgroundTertiary }]}
        >
          <HelpCircle size={isSmallScreen ? 18 : 20} color={colors.textSecondary} />
        </Pressable>
      </View>
      {renderCurrentStep()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    position: 'relative',
  },
  headerTitleContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 0,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  closeButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
    zIndex: 1,
  },
  helpButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

