import { useState, useEffect, useCallback } from 'react';
import { useKYCData } from './useKYCData';
import { useKYCProgress } from './useKYCProgress';
import { useAuth } from '@/contexts/AuthContext';

export type Tier2Step = 'personal' | 'documents';

export interface Tier2Progress {
  personalInfoCompleted: boolean;
  documentsVerified: boolean;
}

export const useTier2KYC = () => {
  const { session } = useAuth();
  const { formData, saveFormData } = useKYCData();
  const { progress, updateProgress, checkTierCompletion, loadProgress, updateTier } = useKYCProgress();

  const [currentStep, setCurrentStep] = useState<Tier2Step>('personal');
  const [isLoading, setIsLoading] = useState(false);

  // Calculate progress percentage
  // Tier 2 has 2 steps: Personal Info (1), Documents Verification (2)
  const getProgressPercentage = useCallback((): number => {
    if (!progress) return 0;

    const personalInfoCompleted = progress.personal_info_completed || false;
    const documentsVerified = progress.documents_verified || false;

    // If documents are verified, all steps are complete
    if (documentsVerified) {
      return 100; // All steps complete
    }

    // Step 1: Personal Info - 0% to 50%
    if (!personalInfoCompleted) {
      return 0; // Not started
    }

    // Step 2: Documents Verification - 50% to 100%
    if (currentStep === 'documents') {
      return 50; // Personal info done, on documents step
    }

    // Default: calculate based on completed steps
    let completed = 0;
    if (personalInfoCompleted) completed++; // Step 1
    // Step 2 is not verified yet
    return (completed / 2) * 100;
  }, [progress, currentStep]);

  // Get current step number (1 or 2)
  const getCurrentStepNumber = useCallback((): number => {
    if (!progress) return 1;

    const personalInfoCompleted = progress.personal_info_completed || false;
    const documentsVerified = progress.documents_verified || false;

    // Step 1: Personal Info
    if (!personalInfoCompleted) {
      return 1;
    }

    // Step 2: Documents Verification
    if (!documentsVerified) {
      return 2;
    }

    // All steps complete
    return 2;
  }, [progress]);

  // Check if Tier 2 is complete
  const isTier2Complete = useCallback((): boolean => {
    if (!progress) return false;
    const tierStatus = checkTierCompletion();
    return tierStatus.tier2;
  }, [progress, checkTierCompletion]);

  // Check if Tier 1 is complete (prerequisite)
  const isTier1Complete = useCallback((): boolean => {
    if (!progress) return false;
    const tierStatus = checkTierCompletion();
    return tierStatus.tier1;
  }, [progress, checkTierCompletion]);

  // Determine current step based on progress
  // IMPORTANT: Only set step on initial load, don't auto-advance
  // This prevents interfering with user's active form filling
  useEffect(() => {
    if (!progress) {
      // Only set to personal if we don't have a step set yet
      if (!currentStep || currentStep === 'personal') {
        setCurrentStep('personal');
      }
      return;
    }

    const personalInfoCompleted = progress.personal_info_completed || false;
    const documentsVerified = progress.documents_verified || false;

    // Only auto-set step on initial load (when currentStep is not set or is default)
    // Don't change step if user is actively on a step
    if (currentStep === 'personal' || currentStep === 'documents') {
      // User is on a step, don't auto-advance
      return;
    }

    // Only set initial step based on progress
    if (!personalInfoCompleted) {
      setCurrentStep('personal');
    } else if (personalInfoCompleted && !documentsVerified) {
      setCurrentStep('documents');
    }
  }, [progress?.personal_info_completed, progress?.documents_verified, currentStep]);

  // Move to next step
  const moveToNextStep = useCallback(() => {
    if (currentStep === 'personal') {
      setCurrentStep('documents');
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
    isTier2Complete,
    isTier1Complete,
    moveToNextStep,
  };
};


