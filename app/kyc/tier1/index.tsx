import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ActivityIndicator, Text, Pressable, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { X } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useTier1KYC } from '@/hooks/useTier1KYC';
import LivenessStep from '@/components/kyc/tier1/LivenessStep';
import BVNStep from '@/components/kyc/tier1/BVNStep';
import NINStep from '@/components/kyc/tier1/NINStep';
import { useKYCProgress } from '@/hooks/useKYCProgress';

export default function Tier1KYCScreen() {
  const { colors } = useTheme();
  const { width, height } = useWindowDimensions();
  const isSmallScreen = width < 380 || height < 700;
  const { currentStep, setCurrentStep, progress, loadProgress, isTier1Complete, updateTier } = useTier1KYC();
  const { checkTierCompletion } = useKYCProgress();
  const [isMounted, setIsMounted] = useState(false);

  // Wait for component to mount before checking completion
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Check if Tier 1 is already complete (after mount and router is ready)
  useEffect(() => {
    if (!isMounted) return;

    const checkCompletion = async () => {
      try {
        await loadProgress();
        await updateTier();
        
        const tierStatus = checkTierCompletion();
        if (tierStatus.tier1) {
          // Already completed, redirect to success
          // Use setTimeout to ensure navigation happens after router is ready
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
        }
      } catch (error) {
        console.error('Error checking Tier 1 completion:', error);
      }
    };

    // Delay the check to ensure router is ready
    const timer = setTimeout(() => {
      checkCompletion();
    }, 100);

    return () => clearTimeout(timer);
  }, [isMounted, loadProgress, updateTier, checkTierCompletion]);

  // Handle step completion
  const handleLivenessComplete = () => {
    setCurrentStep('bvn');
  };

  const handleBVNComplete = () => {
    setCurrentStep('nin');
  };

  const handleNINComplete = async () => {
    // Check if Tier 1 is complete
    await loadProgress();
    await updateTier();
    
    const tierStatus = checkTierCompletion();
    if (tierStatus.tier1) {
      // Navigate to success screen
      router.push('/kyc/tier1/success');
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
      case 'liveness':
        return <LivenessStep onComplete={handleLivenessComplete} />;
      case 'bvn':
        return <BVNStep onComplete={handleBVNComplete} />;
      case 'nin':
        return <NINStep onComplete={handleNINComplete} />;
      default:
        return <LivenessStep onComplete={handleLivenessComplete} />;
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <View style={styles.headerTitleContainer}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Tier 1 Verification</Text>
        </View>
        <Pressable 
          onPress={() => router.replace('/(tabs)')} 
          style={[styles.closeButton, { backgroundColor: colors.surface }]}
        >
          <X size={isSmallScreen ? 20 : 24} color={colors.text} />
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

