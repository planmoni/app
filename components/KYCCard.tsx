import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useHaptics } from '@/hooks/useHaptics';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { useKYCProgress, KYCStep } from '@/hooks/useKYCProgress';
import KYCVerificationModal from '@/components/KYCVerificationModal';
import Tier0Icon from '@/assets/kyc/tier-0.svg';
import Tier1Icon from '@/assets/kyc/tier-1.svg';
import Tier2Icon from '@/assets/kyc/tier-2.svg';
import Tier3Icon from '@/assets/kyc/tier-3.svg';
import {BadgeCheck} from 'lucide-react-native';

type KYCStatus = 'starting' | 'continuing' | 'pending';

export default function KYCCard() {
  const { colors, isDark } = useTheme();
  const haptics = useHaptics();
  const { session } = useAuth();
  const { progress, loading: progressLoading, currentTier = 0 } = useKYCProgress();
  const [verificationStatus, setVerificationStatus] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const styles = createStyles(colors, isDark);

  // Check verification status from kyc_verifications table
  useEffect(() => {
    const checkVerificationStatus = async () => {
      if (!session?.user?.id) {
        setIsLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('kyc_verifications')
          .select('status')
          .eq('user_id', session.user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error && error.code !== 'PGRST116') {
          console.warn('Error checking verification status:', error);
        } else if (data) {
          setVerificationStatus(data.status);
        }
      } catch (err) {
        console.warn('Error checking verification status:', err);
      } finally {
        setIsLoading(false);
      }
    };

    if (!progressLoading) {
      checkVerificationStatus();
    }
  }, [session?.user?.id, progressLoading]);

  // Determine KYC status
  const getKYCStatus = (): KYCStatus => {
    // Check if overall completed and verification is pending
    if (progress.overall_completed && (verificationStatus === 'pending' || verificationStatus === 'reviewing')) {
      return 'pending';
    }

    // Check if user has started KYC (has any progress beyond initial state)
    // New Tier 1 flow: Personal Info → Liveness Check → BVN → NIN
    // KYC has started if ANY step is completed OR current_step is beyond 'personal'
    const hasStarted = progress.personal_info_completed || 
                      progress.liveness_test_completed ||
                      progress.bvn_verified || 
                      progress.id_face_verified ||
                      progress.documents_verified ||
                      progress.address_completed ||
                      (progress.current_step && progress.current_step !== 'personal');

    if (hasStarted && !progress.overall_completed) {
      return 'continuing';
    }

    // If no steps are completed and current_step is 'personal' or null/undefined, KYC hasn't started
    return 'starting';
  };

  const kycStatus = getKYCStatus();
  const isLoadingStatus = isLoading || progressLoading;

  // Don't show card if KYC is fully completed and verified
  if (progress.overall_completed && verificationStatus === 'verified') {
    return null;
  }

  const handlePress = () => {
    haptics.mediumImpact();
    console.log('KYCCard handlePress called, kycStatus:', kycStatus);
    
    if (kycStatus === 'starting') {
      // Always show KYCVerificationModal first when starting
      console.log('Setting showVerificationModal to true');
      setShowVerificationModal(true);
    } else {
      router.push('/kyc-upgrade');
    }
  };

  const handleStartVerification = () => {
    // Close KYCVerificationModal first
    setShowVerificationModal(false);
    
    // Navigate directly to kyc-upgrade page
    // The page will automatically show the first incomplete step (personal info if not completed)
    // This ensures the correct order: Personal Info → Liveness → BVN → NIN
    setTimeout(() => {
      router.push('/kyc-upgrade');
    }, 350); // Wait for the slide-out animation to complete
  };


  // Helper function to get step display name
  const getStepDisplayName = (step: KYCStep): string => {
    switch (step) {
      case 'liveness_verification':
        return 'Liveness Verification';
      case 'bvn_verification':
        return 'BVN Verification';
      case 'id_face_match':
        return 'NIN Verification';
      case 'personal':
        return 'Personal Information';
      case 'documents_verification':
        return 'Document Verification';
      case 'address_details':
        return 'Address Details';
      case 'review':
        return 'KYC Review';
      default:
        return 'Verification';
    }
  };

  // Helper function to get the last completed step
  const getLastCompletedStep = (): KYCStep | null => {
    // Define step order based on tiers:
    // Tier 1: liveness_verification, bvn_verification, id_face_match
    // Tier 2: personal, documents_verification
    // Tier 3: address_details
    const stepOrder: KYCStep[] = ['liveness_verification', 'bvn_verification', 'id_face_match', 'personal', 'documents_verification', 'address_details', 'review'];
    
    // Find the last completed step by checking in reverse order
    for (let i = stepOrder.length - 1; i >= 0; i--) {
      const step = stepOrder[i];
      switch (step) {
        case 'liveness_verification':
          if (progress.liveness_test_completed) return step;
          break;
        case 'bvn_verification':
          if (progress.bvn_verified) return step;
          break;
        case 'id_face_match':
          if (progress.id_face_verified) return step;
          break;
        case 'personal':
          if (progress.personal_info_completed) return step;
          break;
        case 'documents_verification':
          if (progress.documents_verified) return step;
          break;
        case 'address_details':
          if (progress.address_completed) return step;
          break;
        case 'review':
          if (progress.overall_completed) return step;
          break;
      }
    }
    
    return null; // No steps completed yet
  };

  // Helper function to get the next incomplete step (matching kyc-upgrade.tsx logic)
  const getNextIncompleteStep = (): KYCStep => {
    // Updated step order: Personal Info → Liveness Check → BVN(Dojah) → NIN Initiate → NIN Validate → Create Sub Account (Tier 1 complete)
    // Tier 1: personal, liveness_verification, bvn_verification, id_face_match (NIN)
    // Tier 2: documents_verification
    // Tier 3: address_details
    const stepOrder: KYCStep[] = ['personal', 'liveness_verification', 'bvn_verification', 'id_face_match', 'documents_verification', 'address_details', 'review'];
    const current = progress.current_step || 'personal';
    const currentIndex = stepOrder.indexOf(current);
    
    // Find the next incomplete step starting from current
    for (let i = currentIndex; i < stepOrder.length; i++) {
      const step = stepOrder[i];
      switch (step) {
        case 'liveness_verification':
          if (!progress.liveness_test_completed) return step;
          break;
        case 'bvn_verification':
          if (!progress.bvn_verified) return step;
          break;
        case 'id_face_match':
          if (!progress.id_face_verified) return step;
          break;
        case 'personal':
          if (!progress.personal_info_completed) return step;
          break;
        case 'documents_verification':
          if (!progress.documents_verified) return step;
          break;
        case 'address_details':
          if (!progress.address_completed) return step;
          break;
        case 'review':
          return step; // Review is accessible if all steps are complete or if we're at review
      }
    }
    
    return 'review'; // Default to review if all steps are complete
  };

  // Get step-specific message for continuing KYC
  const getCurrentStepMessage = (): string => {
    // Get the next incomplete step that user needs to complete
    const nextStep = getNextIncompleteStep();

    switch (nextStep) {
      case 'liveness_verification':
        return 'Complete your Liveness Verification';
      case 'personal':
        return 'Complete your Personal Information';
      case 'bvn_verification':
        return 'Complete your BVN Verification';
      case 'id_face_match':
        return 'Complete your NIN Verification';
      case 'documents_verification':
        return 'Complete your Document Verification';
      case 'address_details':
        return 'Complete your Address Details';
      case 'review':
        return 'Complete your KYC Review';
      default:
        return 'Continue your KYC Verification';
    }
  };

  // Get status message with last completed and current step
  const getStatusMessage = (): string => {
    if (!progress) return 'Start verification';
    const lastCompleted = getLastCompletedStep();
    // Use the actual current step from progress instead of calculating next incomplete
    const currentStepToShow = progress.current_step || getNextIncompleteStep();
    
    if (!lastCompleted) {
      // No steps completed yet
      return `Start with ${getStepDisplayName(currentStepToShow)}`;
    }
    
    if (progress.overall_completed) {
      return 'Verification complete!';
    }
    
    // Show both last completed and current step
    return `Continue with ${getStepDisplayName(currentStepToShow)}`;
  };

  // Get tier-specific icon and color
  const getTierIcon = () => {
    switch (currentTier) {
      case 0:
        // No tier - unverified
        return { Icon: BadgeCheck, bgColor: isDark ? '#374151' : '#E5E7EB' };
      case 1:
        // Tier 1 - Basic verification
        return { Icon: BadgeCheck, bgColor: isDark ? '#374151' : '#E5E7EB' };
      case 2:
        // Tier 2 - Enhanced verification
        return { Icon: BadgeCheck, bgColor: isDark ? '#374151' : '#E5E7EB' };
      case 3:
        // Tier 3 - Full verification
        return { Icon: BadgeCheck, bgColor: isDark ? '#374151' : '#E5E7EB' };
      default:
        return { Icon: BadgeCheck, bgColor: isDark ? '#374151' : '#E5E7EB' };
    }
  };

  // Get tier-specific message
  const getTierMessage = (): string => {
    const nextStep = getNextIncompleteStep();
    
    if (currentTier === 0) {
      return 'Start your verification to unlock features';
    } else if (currentTier === 1) {
      if (nextStep === 'documents_verification' || nextStep === 'address_details' || nextStep === 'review') {
        return getCurrentStepMessage();
      }
      return 'Upgrade to Tier 2 for higher limits';
    } else if (currentTier === 2) {
      if (nextStep === 'address_details' || nextStep === 'review') {
        return getCurrentStepMessage();
      }
      return 'Upgrade to Tier 3 for maximum limits';
    } else if (currentTier === 3) {
      if (progress.overall_completed) {
        return 'Verification complete!';
      }
      return getCurrentStepMessage();
    }
    
    return getCurrentStepMessage();
  };

  const renderCardContent = () => {
    const { Icon, bgColor } = getTierIcon();
    
    switch (kycStatus) {
      case 'starting':
        return (
          <>
            <View style={[styles.iconContainer, { backgroundColor: bgColor }]}>
              <Icon width={25} height={25} />
            </View>
            <View style={styles.textContainer}>
              <Text style={styles.cardText}>
                Let's verify your identity
              </Text>
              <Text style={styles.cardSubtext}>Start your verification to unlock features</Text>
            </View>
            <View style={styles.actionButton}>
              <Text style={styles.actionButtonText}>Verify</Text>
            </View>
          </>
        );

      case 'continuing':
        return (
          <>
            <View style={[styles.iconContainer, { backgroundColor: bgColor }]}>
              <Icon width={25} height={25} />
            </View>
            <View style={styles.textContainer}>
              <Text style={styles.cardText}>{getStatusMessage()}</Text>
              {/* <Text style={styles.cardSubtext}>{getTierMessage()}</Text> */}
            </View>
            <View style={styles.actionButton}>
              <Text style={styles.actionButtonText}>Continue</Text>
            </View>
          </>
        );

      case 'pending':
        return (
          <>
            <View style={[styles.iconContainer, { backgroundColor: bgColor }]}>
              <Icon width={25} height={25} />
            </View>
            <Text style={styles.cardText}>Your KYC Verification Status is pending</Text>
            <View style={styles.statusIndicator}>
              <Text style={styles.statusIndicatorText}>Pending</Text>
            </View>
          </>
        );
    }
  };

  return (
    <>
      {!isLoadingStatus && (
        <Pressable style={styles.card} onPress={handlePress}>
          {renderCardContent()}
        </Pressable>
      )}
      <KYCVerificationModal
        isVisible={showVerificationModal}
        onClose={() => setShowVerificationModal(false)}
        onStartVerification={handleStartVerification}
      />
    </>
  );
}

const createStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  card: {
    backgroundColor: colors.accentBackground,
    borderRadius: 12,
    marginTop: 10,
    padding: 16,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    minHeight: 64,
    shadowColor: '#000000',
    shadowOffset: { width: 1, height: 6},
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    width: '100%',
    borderWidth: 0.5,
    borderColor: colors.border,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  textContainer: {
    flex: 1,
    flexShrink: 1,
    marginRight: 10,
    minWidth: 0, // Allow text to shrink properly in flex layout
  },
  cardText: {
    fontSize: 17,
    fontWeight: '500',
    color: isDark ? colors.text : '#374151',
    marginBottom: 2,
    flexShrink: 1,
  },
  cardSubtext: {
    fontSize: 14,
    fontWeight: '400',
    color: isDark ? colors.textSecondary : '#6B7280',
    marginTop: 2,
    flexShrink: 1,
  },
  actionButton: {
    backgroundColor: colors.accent,
    borderRadius: 100,
    paddingVertical: 10,
    paddingHorizontal: 20,
    minWidth: 90,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#065F46',
  },
  statusIndicator: {
    backgroundColor: isDark ? colors.backgroundTertiary : '#E5E7EB',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
    minWidth: 90,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  statusIndicatorText: {
    fontSize: 14,
    fontWeight: '600',
    color: isDark ? colors.textSecondary : '#6B7280',
  },
});

