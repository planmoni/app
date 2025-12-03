import { useState, useEffect, useCallback } from 'react';
import { useKYCData } from './useKYCData';
import { useKYCProgress } from './useKYCProgress';
import { useAuth } from '@/contexts/AuthContext';

export type Tier1Step = 'liveness' | 'bvn' | 'nin';

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
  const getProgressPercentage = useCallback((): number => {
    if (!progress) return 0;

    const livenessCompleted = progress.liveness_test_completed || false;
    const bvnVerified = progress.bvn_verified || false;
    const ninVerified = progress.id_face_verified || false;

    let completed = 0;
    if (livenessCompleted) completed++;
    if (bvnVerified) completed++;
    if (ninVerified) completed++;

    return (completed / 3) * 100;
  }, [progress]);

  // Get current step number (1, 2, or 3)
  const getCurrentStepNumber = useCallback((): number => {
    if (!progress) return 1;

    const livenessCompleted = progress.liveness_test_completed || false;
    const bvnVerified = progress.bvn_verified || false;

    if (!livenessCompleted) return 1;
    if (!bvnVerified) return 2;
    return 3;
  }, [progress]);

  // Check if Tier 1 is complete
  const isTier1Complete = useCallback((): boolean => {
    if (!progress) return false;
    const tierStatus = checkTierCompletion();
    return tierStatus.tier1;
  }, [progress, checkTierCompletion]);

  // Determine current step based on progress
  useEffect(() => {
    if (!progress) {
      setCurrentStep('liveness');
      return;
    }

    const livenessCompleted = progress.liveness_test_completed || false;
    const bvnVerified = progress.bvn_verified || false;
    const ninVerified = progress.id_face_verified || false;

    if (!livenessCompleted) {
      setCurrentStep('liveness');
    } else if (!bvnVerified) {
      setCurrentStep('bvn');
    } else if (!ninVerified) {
      setCurrentStep('nin');
    } else {
      // All steps complete - should navigate to success
      setCurrentStep('nin');
    }
  }, [progress?.liveness_test_completed, progress?.bvn_verified, progress?.id_face_verified]);

  // Move to next step
  const moveToNextStep = useCallback(() => {
    if (currentStep === 'liveness') {
      setCurrentStep('bvn');
    } else if (currentStep === 'bvn') {
      setCurrentStep('nin');
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

