import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useHaptics } from '@/hooks/useHaptics';
import { useAuth } from '@/contexts/AuthContext';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useKYCProgress, KYCStep } from '@/hooks/useKYCProgress';
import KYCVerificationModal from '@/components/KYCVerificationModal';
import Tier0Icon from '@/assets/kyc/tier-0.svg';
import Tier1Icon from '@/assets/kyc/tier-1.svg';
import Tier2Icon from '@/assets/kyc/tier-2.svg';
import Tier3Icon from '@/assets/kyc/tier-3.svg';
import {BadgeCheck} from 'lucide-react-native';
import { getScaledFontSize } from '@/lib/textSize';
import { useTextSize } from '@/contexts/TextSizeContext';
import type { RealtimeChannel } from '@supabase/supabase-js';

type KYCStatus = 'starting' | 'continuing' | 'pending';

export default function KYCCard() {
  const { colors, isDark } = useTheme();
  const { textSizeMultiplier } = useTextSize();
  const haptics = useHaptics();
  const { session } = useAuth();
  const { progress, loading: progressLoading, currentTier = 0, checkTierCompletion, loadProgress } = useKYCProgress();
  const [verificationStatus, setVerificationStatus] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [latestProgress, setLatestProgress] = useState<any>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const styles = createStyles(colors, isDark, textSizeMultiplier);

  // Fetch latest progress directly from Supabase to ensure we have the most up-to-date data
  const fetchLatestProgress = React.useCallback(async () => {
    if (!session?.user?.id) return;

    try {
      const { data, error } = await supabase
        .from('kyc_progress')
        .select('*')
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.warn('[KYCCard] Error fetching latest progress:', error);
      } else if (data) {
        console.log('[KYCCard] Latest progress from DB:', {
          liveness_test_completed: data.liveness_test_completed,
          bvn_verified: data.bvn_verified,
          current_step: data.current_step,
          id_face_verified: data.id_face_verified,
          personal_info_completed: data.personal_info_completed,
          documents_verified: data.documents_verified,
          address_completed: data.address_completed
        });
        setLatestProgress(data);
      } else {
        console.log('[KYCCard] No progress record found in database');
      }
    } catch (err) {
      console.warn('[KYCCard] Error fetching latest progress:', err);
    }
  }, [session?.user?.id]);

  // Fetch on mount and when session changes
  useEffect(() => {
    fetchLatestProgress();
  }, [fetchLatestProgress]);
  
  // Sync latestProgress with progress from hook whenever it changes
  useEffect(() => {
    if (progress) {
      console.log('[KYCCard] Progress from hook updated, syncing latestProgress');
      setLatestProgress(progress);
    }
  }, [
    progress?.liveness_test_completed,
    progress?.bvn_verified,
    progress?.id_face_verified,
    progress?.personal_info_completed,
    progress?.documents_verified,
    progress?.address_completed,
    progress?.current_step,
    progress?.overall_completed
  ]);
  
  // Also refresh when progressLoading changes (when hook refreshes)
  useEffect(() => {
    if (!progressLoading && session?.user?.id) {
      // Small delay to ensure hook has finished updating
      const timer = setTimeout(() => {
        fetchLatestProgress();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [progressLoading, session?.user?.id, fetchLatestProgress]);

  // Set up real-time subscription to kyc_progress table
  useEffect(() => {
    if (!session?.user?.id) {
      return;
    }

    // Check if Supabase is configured before attempting subscription
    if (!isSupabaseConfigured()) {
      console.log('[KYCCard] Supabase not configured, skipping realtime subscription');
      return;
    }

    const channelName = `kyc-progress-changes-${session.user.id}`;
    
    // Clean up existing channel if any
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    // Set up real-time subscription
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'kyc_progress',
          filter: `user_id=eq.${session.user.id}`,
        },
        (payload: any) => {
          console.log('[KYCCard] Real-time progress update received:', {
            event: payload.event,
            table: payload.table,
            schema: payload.schema,
            new: payload.new,
            old: payload.old
          });
          
          if (payload.event === 'UPDATE' && payload.new) {
            // Update latestProgress with the new data
            setLatestProgress(payload.new);
            console.log('[KYCCard] Progress updated in real-time:', {
              liveness_test_completed: payload.new.liveness_test_completed,
              bvn_verified: payload.new.bvn_verified,
              id_face_verified: payload.new.id_face_verified,
              current_step: payload.new.current_step,
            });
            // Also reload progress in the hook to keep it in sync
            loadProgress().catch(err => {
              console.warn('[KYCCard] Error reloading progress after real-time update:', err);
            });
          } else if (payload.event === 'INSERT' && payload.new) {
            // Handle new record creation
            setLatestProgress(payload.new);
            console.log('[KYCCard] New progress record created in real-time');
            // Also reload progress in the hook to keep it in sync
            loadProgress().catch(err => {
              console.warn('[KYCCard] Error reloading progress after real-time update:', err);
            });
          }
        }
      )
      .subscribe((status: 'SUBSCRIBED' | 'CHANNEL_ERROR' | 'TIMED_OUT' | 'CLOSED') => {
        console.log(`[KYCCard] Realtime subscription status: ${status}`);
        
        switch (status) {
          case 'SUBSCRIBED':
            console.log('[KYCCard] ✅ Real-time subscription active');
            break;
          case 'CHANNEL_ERROR':
            console.warn('[KYCCard] ⚠️ Real-time subscription error - continuing without realtime updates');
            break;
          case 'TIMED_OUT':
            console.warn('[KYCCard] ⚠️ Real-time subscription timed out - continuing without realtime updates');
            break;
          case 'CLOSED':
            console.log('[KYCCard] ℹ️ Real-time subscription closed');
            break;
        }
      });

    channelRef.current = channel;

    // Cleanup function
    return () => {
      if (channelRef.current) {
        console.log('[KYCCard] Cleaning up real-time subscription');
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [session?.user?.id]);

  // Refresh when screen comes into focus (user navigates back to home)
  useFocusEffect(
    React.useCallback(() => {
      if (session?.user?.id) {
        console.log('[KYCCard] Screen focused, refreshing progress');
        fetchLatestProgress();
      }
    }, [session?.user?.id, fetchLatestProgress])
  );

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
    // Updated flow: BVN (with auto liveness) → NIN → Personal → Documents → Address → Review
    // KYC has started if ANY step is completed OR current_step is set
    const hasStarted = progress.liveness_test_completed ||
                      progress.bvn_verified || 
                      progress.id_face_verified ||
                      progress.personal_info_completed ||
                      progress.documents_verified ||
                      progress.address_completed ||
                      (progress.current_step && progress.current_step !== null);

    if (hasStarted && !progress.overall_completed) {
      return 'continuing';
    }

    // If no steps are completed and current_step is null/undefined, KYC hasn't started
    return 'starting';
  };

  const kycStatus = getKYCStatus();
  const isLoadingStatus = isLoading || progressLoading;

  // Check if NIN verification is complete using latest progress data
  // Use latestProgress (direct from DB) if available, otherwise fall back to progress from hook
  const currentProgress = latestProgress || progress;
  const isNINVerified = 
    currentProgress?.id_face_verified === true || 
    currentProgress?.id_face_verified === 1 ||
    currentProgress?.id_face_verified === 'true';

  // Don't show card if NIN verification is complete or if KYC is fully completed and verified
  if (isNINVerified || (currentProgress?.overall_completed && verificationStatus === 'verified')) {
    console.log('[KYCCard] Hiding card - NIN verified or KYC fully completed:', {
      isNINVerified,
      idFace: currentProgress?.id_face_verified,
      overallCompleted: currentProgress?.overall_completed,
      verificationStatus
    });
    return null;
  }

  const handlePress = () => {
    haptics.mediumImpact();
    console.log('KYCCard handlePress called, kycStatus:', kycStatus);
    
    // Check current progress
    const currentProgress = latestProgress || progress;
    const currentStep = currentProgress?.current_step;
    
    // Check if liveness is completed
    const isLivenessCompleted = currentProgress?.liveness_test_completed === true || 
                                currentProgress?.liveness_test_completed === 1 || 
                                currentProgress?.liveness_test_completed === 'true';
    
    // If user has a current_step beyond liveness, they should navigate directly
    // Steps that indicate liveness is completed: bvn_verification, id_face_match, personal, documents_verification, address_details, review
    const stepsBeyondLiveness = ['bvn_verification', 'id_face_match', 'personal', 'documents_verification', 'address_details', 'review'];
    const hasProgressBeyondLiveness = currentStep && stepsBeyondLiveness.includes(currentStep);
    
    if (kycStatus === 'starting' && !hasProgressBeyondLiveness && !isLivenessCompleted) {
      // Only show KYCVerificationModal if starting and no progress beyond liveness
      console.log('Setting showVerificationModal to true');
      setShowVerificationModal(true);
    } else if (hasProgressBeyondLiveness || isLivenessCompleted) {
      // Navigate directly to kyc-upgrade if user has progress beyond liveness or liveness is completed
      console.log('Navigating directly to kyc-upgrade, currentStep:', currentStep);
      router.push('/kyc-upgrade');
    } else {
      // Fallback: if continuing but liveness not completed, show verification modal
      console.log('Liveness not completed, showing verification modal');
      setShowVerificationModal(true);
    }
  };

  const handleStartVerification = () => {
    // This callback is now used as fallback - CameraPermissionModal handles the flow
    // Close KYCVerificationModal first
    setShowVerificationModal(false);
    
    // Navigate to kyc-upgrade page
    setTimeout(() => {
      router.push('/kyc-upgrade');
    }, 400); // Wait for modal animations to complete
  };

  const handleLivenessComplete = (selfieUrl: string) => {
    // Handle liveness completion from CameraPermissionModal
    setShowVerificationModal(false);
    // Navigate to kyc-upgrade with selfie URL
    setTimeout(() => {
      router.push({
        pathname: '/kyc-upgrade',
        params: { selfieUrl }
      });
    }, 400);
  };


  // Helper function to get step display name
  const getStepDisplayName = (step: KYCStep | 'liveness_verification'): string => {
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
    // Define step order based on tiers (matching kyc-upgrade.tsx):
    // Tier 1: bvn_verification (liveness handled automatically), id_face_match
    // Tier 2: personal, documents_verification
    // Tier 3: address_details
    const stepOrder: KYCStep[] = ['bvn_verification', 'id_face_match', 'personal', 'documents_verification', 'address_details', 'review'];
    
    // Find the last completed step by checking in reverse order
    for (let i = stepOrder.length - 1; i >= 0; i--) {
      const step = stepOrder[i];
      switch (step) {
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
  // Returns the step as a string that can be 'liveness_verification' or KYCStep
  // Note: Liveness is handled automatically on BVN step, so we return 'bvn_verification' if liveness is not completed
  const getNextIncompleteStep = (): KYCStep | 'liveness_verification' => {
    // Prioritize latestProgress (direct from DB) over progress from hook
    const currentProgress = latestProgress || progress;
    
    if (!currentProgress) return 'bvn_verification';
    
    // Helper function to check if a boolean field is true (handles boolean, number, and string)
    const isFieldTrue = (field: any): boolean => {
      return field === true || field === 1 || field === 'true';
    };
    
    // Check if BVN is verified - if BVN is verified, liveness must have been completed
    const bvnVerified = isFieldTrue(currentProgress.bvn_verified);
    
    // Check if NIN is verified - if NIN is verified, both liveness and BVN must have been completed
    const idFaceVerified = isFieldTrue(currentProgress.id_face_verified);
    
    // Check liveness - but if BVN or NIN is verified, we know liveness was completed
    const livenessCompleted = isFieldTrue(currentProgress.liveness_test_completed) || bvnVerified || idFaceVerified;
    
    // Step order matching kyc-upgrade.tsx
    const stepOrder: KYCStep[] = ['bvn_verification', 'id_face_match', 'personal', 'documents_verification', 'address_details', 'review'];
    
    // Find the first incomplete step
    for (const step of stepOrder) {
      switch (step) {
        case 'bvn_verification':
          // Only return BVN step if it's not verified AND liveness is not completed
          // If BVN is verified, skip to next step
          if (!bvnVerified && !livenessCompleted) {
            return step; // Go to BVN step, but liveness will be triggered automatically
          }
          // If BVN is verified, continue to next step
          if (bvnVerified) {
            break; // Continue to check next step
          }
          break;
        case 'id_face_match':
          // Only return NIN step if it's not verified
          if (!idFaceVerified) {
            return step;
          }
          break;
        case 'personal':
          const personalNotCompleted = !isFieldTrue(currentProgress.personal_info_completed);
          if (personalNotCompleted) return step;
          break;
        case 'documents_verification':
          const documentsNotVerified = !isFieldTrue(currentProgress.documents_verified);
          if (documentsNotVerified) return step;
          break;
        case 'address_details':
          const addressNotCompleted = !isFieldTrue(currentProgress.address_completed);
          if (addressNotCompleted) return step;
          break;
        case 'review':
          return step; // Review is accessible if all steps are complete
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
      case 'bvn_verification':
        return 'Complete your BVN Verification';
      case 'id_face_match':
        return 'Complete your NIN Verification';
      case 'personal':
        return 'Complete your Personal Information';
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
  // Use latestProgress if available (direct from DB), otherwise fall back to progress from hook
  const getStatusMessage = (): string => {
    // Prioritize latestProgress (direct from DB) over progress from hook
    const currentProgress = latestProgress || progress;
    
    if (!currentProgress) return 'Start verification';
    
    console.log('[KYCCard] getStatusMessage - currentProgress:', {
      liveness_test_completed: currentProgress.liveness_test_completed,
      bvn_verified: currentProgress.bvn_verified,
      id_face_verified: currentProgress.id_face_verified,
      personal_info_completed: currentProgress.personal_info_completed,
      current_step: currentProgress.current_step,
      usingLatest: !!latestProgress,
      progressFromHook: {
        liveness_test_completed: progress?.liveness_test_completed,
        bvn_verified: progress?.bvn_verified,
        id_face_verified: progress?.id_face_verified
      }
    });
    
    if (currentProgress.overall_completed) {
      return 'Verification complete!';
    }
    
    // Check if liveness is not completed - this is the only step that should say "Start"
    // Handle both boolean true/false and null/undefined cases
    const livenessCompleted = currentProgress.liveness_test_completed === true || 
                              currentProgress.liveness_test_completed === 1 ||
                              currentProgress.liveness_test_completed === 'true';
    
    // Also check if BVN is verified - if BVN is verified, liveness must have been completed
    const bvnVerified = currentProgress.bvn_verified === true || 
                        currentProgress.bvn_verified === 1 ||
                        currentProgress.bvn_verified === 'true';
    
    // Also check if NIN is verified - if NIN is verified, liveness and BVN must have been completed
    const idFaceVerified = currentProgress.id_face_verified === true || 
                          currentProgress.id_face_verified === 1 ||
                          currentProgress.id_face_verified === 'true';
    
    console.log('[KYCCard] Verification status check:', {
      liveness_test_completed: currentProgress.liveness_test_completed,
      livenessCompleted,
      bvnVerified,
      idFaceVerified,
      type: typeof currentProgress.liveness_test_completed
    });
    
    // If liveness is not completed AND BVN is not verified, show start message
    // If BVN or NIN is verified, we know liveness was completed (even if flag is missing)
    if (!livenessCompleted && !bvnVerified && !idFaceVerified) {
      console.log('[KYCCard] Liveness not completed and no verification done, showing "Start" message');
      return 'Verify your identity to unlock features';
    }
    
    // Liveness is completed (or BVN/NIN verified, which implies liveness), so get the next incomplete step
    // Always get the next incomplete step to show (this matches kyc-upgrade.tsx logic)
    const currentStepToShow = getNextIncompleteStep();
    
    console.log('[KYCCard] Next incomplete step:', currentStepToShow);
    
    // Ensure we have a valid step
    if (!currentStepToShow || currentStepToShow === null) {
      return 'Start verification';
    }
    
    const stepDisplayName = getStepDisplayName(currentStepToShow);
    
    // If stepDisplayName is "Verification" (default case), something went wrong - use BVN as fallback
    if (stepDisplayName === 'Verification') {
      return 'Continue with BVN Verification';
    }
    
    // Once liveness is completed, all other steps say "Continue"
    console.log('[KYCCard] Showing "Continue with', stepDisplayName + '"');
    return `Continue with ${stepDisplayName}`;
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
              <Text style={styles.actionButtonText}>Start</Text>
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
        onComplete={handleLivenessComplete}
        onStartVerification={handleStartVerification}
      />
    </>
  );
}

const createStyles = (colors: any, isDark: boolean, textSizeMultiplier: number) => StyleSheet.create({
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
    fontSize: getScaledFontSize(17, textSizeMultiplier),
    fontWeight: '500',
    color: isDark ? colors.text : '#374151',
    marginBottom: 2,
    flexShrink: 1,
  },
  cardSubtext: {
    fontSize: getScaledFontSize(14, textSizeMultiplier),
    fontWeight: '400',
    color: isDark ? colors.textSecondary : '#6B7280',
    marginTop: 2,
    flexShrink: 1,
  },
  actionButton: {
    backgroundColor: colors.accent,
    borderRadius: 15,
    paddingVertical: 10,
    paddingHorizontal: 20,
    minWidth: 90,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  actionButtonText: {
    fontSize: getScaledFontSize(16, textSizeMultiplier),
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
    fontSize: getScaledFontSize(14, textSizeMultiplier),
    fontWeight: '600',
    color: isDark ? colors.textSecondary : '#6B7280',
  },
});