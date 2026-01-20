import { useState, useEffect, useLayoutEffect, useCallback } from 'react';
import { useKYCData } from './useKYCData';
import { useKYCProgress } from './useKYCProgress';
import { useAuth } from '@/contexts/AuthContext';

export type Tier1Step = 'liveness' | 'bvn' | 'nin' | 'otp' | 'bvn_otp';

export interface Tier1Progress {
  livenessCompleted: boolean;
  bvnVerified: boolean;
  ninVerified: boolean;
}

// Helper function to determine the correct step based on progress
const determineStepFromProgress = (progress: any, currentStep: Tier1Step): Tier1Step => {
  if (!progress) {
    return 'liveness';
  }

  const livenessCompleted = progress.liveness_test_completed || false;
  const bvnVerified = progress.bvn_verified || false;
  const ninVerified = progress.id_face_verified || false;

  // If we're on OTP steps, don't change unless progress indicates completion
  if (currentStep === 'otp' || currentStep === 'bvn_otp') {
    if (ninVerified) {
      // All steps complete, but stay on OTP (parent will handle redirect)
      return currentStep;
    }
    // Still in progress, keep current OTP step
    return currentStep;
  }

  // Determine target step based on progress
  if (!livenessCompleted) {
    return 'liveness';
  } else if (!bvnVerified) {
    return 'bvn';
  } else if (!ninVerified) {
    return 'nin';
  } else {
    // All steps complete, default to NIN (parent will handle redirect)
    return 'nin';
  }
};

export const useTier1KYC = () => {
  const { session } = useAuth();
  const { formData, saveFormData } = useKYCData();
  const { progress, updateProgress, checkTierCompletion, loadProgress, updateTier } = useKYCProgress();

  // Initialize step - will be set correctly in useLayoutEffect
  // Start with 'liveness' as default, but useLayoutEffect will correct it immediately
  const [currentStep, setCurrentStep] = useState<Tier1Step>('liveness');
  const [stepInitialized, setStepInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isManuallyChangingStep, setIsManuallyChangingStep] = useState(false);

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

  // Use useLayoutEffect to set step synchronously before render
  // This prevents showing the wrong step before the correct one is determined
  useLayoutEffect(() => {
    // Don't auto-update step if we're manually changing it
    if (isManuallyChangingStep) {
      if (!stepInitialized) {
        setStepInitialized(true);
      }
      return;
    }

    if (!progress) {
      if (!stepInitialized) {
        setCurrentStep('liveness');
        setStepInitialized(true);
      }
      return;
    }

    const targetStep = determineStepFromProgress(progress, currentStep);
    
    // Always update if step doesn't match target (except when on OTP steps that are still valid)
    if (currentStep !== targetStep) {
      // Special handling for OTP steps - only change if progress indicates we should
      if ((currentStep === 'otp' || currentStep === 'bvn_otp') && !progress.id_face_verified) {
        // Still in OTP verification, keep current step
        if (!stepInitialized) {
          setStepInitialized(true);
        }
        return;
      }
      
      // Update to target step
      setCurrentStep(targetStep);
    }
    
    if (!stepInitialized) {
      setStepInitialized(true);
    }
  }, [progress, currentStep, stepInitialized, isManuallyChangingStep]);

  // Also update step when progress fields change (for reactive updates)
  useEffect(() => {
    // Don't auto-update step if we're manually changing it
    if (isManuallyChangingStep || !progress || !stepInitialized) return;

    const targetStep = determineStepFromProgress(progress, currentStep);
    
    if (currentStep !== targetStep) {
      // Don't override OTP steps unless verification is complete
      if ((currentStep === 'otp' || currentStep === 'bvn_otp') && !progress.id_face_verified) {
        return;
      }
      
      setCurrentStep(targetStep);
    }
  }, [progress?.liveness_test_completed, progress?.bvn_verified, progress?.id_face_verified, stepInitialized, isManuallyChangingStep, currentStep]);

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

  // Wrapper for setCurrentStep that prevents auto-updates during manual changes
  const setCurrentStepManual = useCallback((step: Tier1Step) => {
    setIsManuallyChangingStep(true);
    setCurrentStep(step);
    // Reset the flag after a delay to allow progress to catch up
    setTimeout(() => {
      setIsManuallyChangingStep(false);
    }, 1000);
  }, []);

  return {
    currentStep,
    setCurrentStep: setCurrentStepManual,
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
    stepInitialized, // Export to allow parent to wait for step initialization
  };
};

