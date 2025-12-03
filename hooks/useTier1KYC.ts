import { useState, useEffect, useCallback } from 'react';
import { useKYCData } from './useKYCData';
import { useKYCProgress } from './useKYCProgress';
import { useAuth } from '@/contexts/AuthContext';

export type Tier1Step = 'liveness' | 'bvn' | 'nin' | 'otp' | 'bvn_otp';

export interface Tier1Progress {
  livenessCompleted: boolean;
  bvnVerified: boolean;
  ninVerified: boolean;
}

export const useTier1KYC = () => {
  const { session } = useAuth();
  const { formData, saveFormData } = useKYCData();
  const { progress, updateProgress, checkTierCompletion, loadProgress, updateTier } = useKYCProgress();

  const [currentStep, setCurrentStep] = useState<Tier1Step>('liveness');
  const [isLoading, setIsLoading] = useState(false);

  // Calculate progress percentage
  // Tier 1 has 4 steps: Liveness (1), BVN (2), NIN Input (3), OTP Verification (4)
  // OTP is the final step, so it should show 100%
  const getProgressPercentage = useCallback((): number => {
    if (!progress) return 0;

    const livenessCompleted = progress.liveness_test_completed || false;
    const bvnVerified = progress.bvn_verified || false;
    const ninVerified = progress.id_face_verified || false;

    // If NIN is verified, all steps are complete
    if (ninVerified) {
      return 100; // All steps complete
    }

    // Step 4: OTP Verification - This is the final step, show 100% when on this step
    if (currentStep === 'otp' || currentStep === 'bvn_otp') {
      return 100; // OTP is the last step, show 100%
    }

    // Step 1: Liveness - 0% to 33%
    if (!livenessCompleted) {
      return 0; // Not started
    }

    // Step 2: BVN - 33% to 66%
    if (!bvnVerified) {
      return 33; // Liveness done, on BVN step
    }

    // Step 3: NIN Input - 66% to 100%
    if (currentStep === 'nin') {
      return 66; // Liveness + BVN done, on NIN input step
    }

    // Default: calculate based on completed steps
    let completed = 0;
    if (livenessCompleted) completed++; // Step 1
    if (bvnVerified) completed++; // Step 2
    // Steps 3 and 4 are not verified yet
    return (completed / 3) * 100; // Changed to 3 steps since OTP is the final step
  }, [progress, currentStep]);

  // Get current step number (1, 2, 3, or 4)
  // This should align with the progress percentage:
  // Step 1 (Liveness): 0-33%
  // Step 2 (BVN): 33-66%
  // Step 3 (NIN Input): 66-100%
  // Step 4 (OTP): 100% (final step)
  const getCurrentStepNumber = useCallback((): number => {
    if (!progress) return 1;

    const livenessCompleted = progress.liveness_test_completed || false;
    const bvnVerified = progress.bvn_verified || false;
    const ninVerified = progress.id_face_verified || false;

    // Step 1: Liveness
    if (!livenessCompleted) {
      return 1;
    }

    // Step 2: BVN
    if (!bvnVerified) {
      return 2;
    }

    // Step 4: OTP Verification (final step) - both NIN OTP and BVN OTP
    if (currentStep === 'otp' || currentStep === 'bvn_otp') {
      return 4; // Step 4: OTP Verification - final step
    }

    // Step 3: NIN Input
    if (!ninVerified) {
      return 3; // Step 3: NIN Input
    }

    // All steps complete
    return 4;
  }, [progress, currentStep]);

  // Check if Tier 1 is complete
  const isTier1Complete = useCallback((): boolean => {
    if (!progress) return false;
    const tierStatus = checkTierCompletion();
    return tierStatus.tier1;
  }, [progress, checkTierCompletion]);

  // Determine current step based on progress
  // Only auto-set step on initial load or when progress changes significantly
  // Don't override manual step changes immediately after updates
  useEffect(() => {
    if (!progress) {
      setCurrentStep('liveness');
      return;
    }

    const livenessCompleted = progress.liveness_test_completed || false;
    const bvnVerified = progress.bvn_verified || false;
    const ninVerified = progress.id_face_verified || false;

    // Only auto-set step if it makes sense based on progress
    // Don't override if we're already on a step that's consistent with progress
    if (!livenessCompleted && currentStep !== 'liveness') {
      setCurrentStep('liveness');
    } else if (livenessCompleted && !bvnVerified && currentStep !== 'bvn' && currentStep !== 'liveness') {
      setCurrentStep('bvn');
    } else if (livenessCompleted && bvnVerified && !ninVerified) {
      // If NIN is initialized but not verified, we need to check formData to see if we have identityId
      // For now, default to 'nin' - the component will handle navigation to 'otp'
      if (currentStep !== 'otp' && currentStep !== 'bvn_otp') {
        setCurrentStep('nin');
      }
    } else if (livenessCompleted && bvnVerified && ninVerified && currentStep !== 'otp' && currentStep !== 'bvn_otp') {
      // All steps complete - should navigate to success (but don't override if already on OTP step)
      // This case should be handled by the parent component redirecting to success
    }
  }, [progress?.liveness_test_completed, progress?.bvn_verified, progress?.id_face_verified]);

  // Move to next step
  const moveToNextStep = useCallback(() => {
    if (currentStep === 'liveness') {
      setCurrentStep('bvn');
    } else if (currentStep === 'bvn') {
      setCurrentStep('nin');
    } else if (currentStep === 'nin') {
      setCurrentStep('otp');
    }
  }, [currentStep]);

  return {
    currentStep,
    setCurrentStep,
    isLoading,
    setIsLoading,
    formData,
    saveFormData,
    progress,
    updateProgress,
    loadProgress,
    updateTier,
    checkTierCompletion,
    getProgressPercentage,
    getCurrentStepNumber,
    isTier1Complete,
    moveToNextStep,
  };
};

