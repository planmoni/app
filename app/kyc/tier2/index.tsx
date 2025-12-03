import React, { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, ActivityIndicator, Text, Pressable, useWindowDimensions, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { X, CircleHelp as HelpCircle } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useTier2KYC } from '@/hooks/useTier2KYC';
import PersonalInfoStep from '@/components/kyc/tier2/PersonalInfoStep';
import DocumentsStep from '@/components/kyc/tier2/DocumentsStep';
import { useKYCProgress } from '@/hooks/useKYCProgress';
import { useIntercom } from '@/hooks/useIntercom';
import { useHaptics } from '@/hooks/useHaptics';
import { logAnalyticsEvent } from '@/lib/firebase';

export default function Tier2KYCScreen() {
  const { colors } = useTheme();
  const { width, height } = useWindowDimensions();
  const isSmallScreen = width < 380 || height < 700;
  const { currentStep, setCurrentStep, progress, loadProgress, isTier2Complete, updateTier, isTier1Complete } = useTier2KYC();
  const { checkTierCompletion } = useKYCProgress();
  const { openChat, isLoading: isHelpLoading, isSupported: isIntercomSupported } = useIntercom();
  const haptics = useHaptics();
  const [isMounted, setIsMounted] = useState(false);

  // Wait for component to mount before checking completion
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // TIER 2 IS COMPLETELY ISOLATED FROM TIER 1
  // No prerequisite checks, no redirects to Tier 1
  // If user is here, they should be able to complete Tier 2 regardless of Tier 1 status
  // The upgrade buttons handle routing logic - Tier 2 screen doesn't need to check prerequisites

  // TIER 2 COMPLETION CHECK - COMPLETELY ISOLATED FROM TIER 1
  // Only run when Tier 2 screen is actually focused (not when navigating away)
  // Never redirect to Tier 1 - Tier 2 is completely isolated
  useFocusEffect(
    useCallback(() => {
      if (!isMounted || !progress) return;

      // NEVER check completion if user is on a step - they're actively filling the form
      if (currentStep === 'personal' || currentStep === 'documents') {
        console.log('⏳ Tier 2 - User is on a step, skipping completion check');
        return;
      }

      let hasChecked = false;
      
      const checkCompletion = async () => {
        // Only check once per focus
        if (hasChecked) return;
        hasChecked = true;

        try {
          // Wait a bit to ensure we're actually on Tier 2 screen
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Load fresh progress data
          await loadProgress();
          await updateTier();
          
          // Wait for state to update
          await new Promise(resolve => setTimeout(resolve, 300));
          
          // Now check completion with fresh data
          const tierStatus = checkTierCompletion();
          
          // Get fresh progress after reload
          // We need to check the actual progress state, not the stale one
          await loadProgress();
          const freshProgress = await loadProgress();
          
          // Explicitly check both requirements - use strict boolean checks
          // Use the progress from the hook which should be updated by loadProgress
          const personalInfoDone = progress?.personal_info_completed === true;
          const documentsVerified = progress?.documents_verified === true;
          
          console.log('🔍 Tier 2 - Checking completion status (ISOLATED):', {
            tierStatus,
            personalInfoDone,
            documentsVerified,
            currentStep,
            progress: {
              personal: progress?.personal_info_completed,
              documents: progress?.documents_verified
            }
          });
          
          // CRITICAL: Only redirect if BOTH are true AND tierStatus confirms Tier 2 is complete
          // AND we're definitely not on a step (double check)
          // NEVER redirect to Tier 1 - Tier 2 is completely isolated
          if (tierStatus.tier2 && personalInfoDone && documentsVerified) {
            // Final check - make sure we're not on a step
            if (currentStep === 'personal' || currentStep === 'documents') {
              console.log('⏳ Tier 2 - User is on a step, not redirecting');
              return;
            }
            
            // Tier 2 is truly complete, redirect to Tier 2 success ONLY (NOT Tier 1)
            console.log('✅ Tier 2 complete, redirecting to Tier 2 success (NOT Tier 1)');
            setTimeout(() => {
              try {
                router.replace('/kyc/tier2/success');
              } catch (error) {
                console.error('Navigation error:', error);
              }
            }, 300);
          } else {
            console.log('⏳ Tier 2 not complete yet:', {
              tier2Status: tierStatus.tier2,
              personalInfoDone,
              documentsVerified,
              currentStep
            });
          }
        } catch (error) {
          console.error('Error checking Tier 2 completion:', error);
        }
      };

      // Only check once after screen is focused and user is not on a step
      const timer = setTimeout(() => {
        // Final check we're not on a step
        if (currentStep !== 'personal' && currentStep !== 'documents') {
          checkCompletion();
        } else {
          console.log('⏳ Tier 2 - Skipping completion check, user is on a step');
        }
      }, 2000); // Longer delay to ensure user isn't actively filling form

      return () => {
        clearTimeout(timer);
        hasChecked = false;
      };
    }, [isMounted, currentStep, progress, loadProgress, updateTier, checkTierCompletion])
  );

  // Handle step completion
  const handlePersonalInfoComplete = () => {
    setCurrentStep('documents');
  };

  const handleDocumentsComplete = async () => {
    // Documents verification is complete, navigate to success screen
    await loadProgress();
    await updateTier();
    
    // Navigate directly to success screen
    router.push('/kyc/tier2/success');
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
      logAnalyticsEvent('help_click', { source: 'tier2_kyc_flow' });
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

  // Show loading while checking progress
  if (!progress) {
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
      case 'personal':
        return <PersonalInfoStep onComplete={handlePersonalInfoComplete} />;
      case 'documents':
        return <DocumentsStep onComplete={handleDocumentsComplete} />;
      default:
        return <PersonalInfoStep onComplete={handlePersonalInfoComplete} />;
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
          <Text style={[styles.headerTitle, { color: colors.text }]}>Tier 2 Verification</Text>
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


