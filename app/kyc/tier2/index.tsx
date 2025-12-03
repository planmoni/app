import React, { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, ActivityIndicator, Text, Pressable, useWindowDimensions, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
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

  // Check if Tier 1 is complete (prerequisite)
  useEffect(() => {
    if (!isMounted || !progress) return;

    const checkTier1Prerequisite = async () => {
      // Reload progress to ensure we have the latest data
      await loadProgress();
      await updateTier();
      
      const tierStatus = checkTierCompletion();
      const tier1Complete = tierStatus.tier1 || 
        (progress?.liveness_test_completed && 
         progress?.bvn_verified && 
         progress?.id_face_verified);
      
      console.log('🔍 Tier 2 - Checking Tier 1 prerequisite:', {
        tierStatus,
        tier1Complete,
        progress: {
          liveness: progress?.liveness_test_completed,
          bvn: progress?.bvn_verified,
          nin: progress?.id_face_verified
        }
      });

      if (!tier1Complete) {
        // Tier 1 not complete, redirect to Tier 1 flow
        console.log('❌ Tier 1 not complete, redirecting to Tier 1 flow');
        setTimeout(() => {
          try {
            router.replace('/kyc/tier1');
          } catch (error) {
            console.error('Navigation error:', error);
          }
        }, 300);
      } else {
        console.log('✅ Tier 1 complete, proceeding with Tier 2');
      }
    };

    checkTier1Prerequisite();
  }, [isMounted, progress, isTier1Complete, loadProgress, updateTier, checkTierCompletion]);

  // Check if Tier 2 is already complete
  useEffect(() => {
    if (!isMounted) return;

    const checkCompletion = async () => {
      try {
        await loadProgress();
        await updateTier();
        
        const tierStatus = checkTierCompletion();
        if (tierStatus.tier2) {
          // Already completed, redirect to success
          setTimeout(() => {
            try {
              router.replace('/kyc/tier2/success');
            } catch (error) {
              console.error('Navigation error:', error);
              setTimeout(() => {
                router.replace('/kyc/tier2/success');
              }, 500);
            }
          }, 300);
        }
      } catch (error) {
        console.error('Error checking Tier 2 completion:', error);
      }
    };

    const timer = setTimeout(() => {
      checkCompletion();
    }, 100);

    return () => clearTimeout(timer);
  }, [isMounted, loadProgress, updateTier, checkTierCompletion]);

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


