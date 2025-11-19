import { useState, useEffect, useCallback } from 'react';
import { useKYCProgress, KYCStep } from '@/hooks/useKYCProgress';

export const useKYCNavigation = () => {
  const { progress, loading: progressLoading, updateProgress } = useKYCProgress();
  const [currentStep, setCurrentStep] = useState<KYCStep>('bvn_verification');

  // Helper function to get the first incomplete step
  const getFirstIncompleteStep = useCallback((): KYCStep => {
    if (!progress) return 'bvn_verification';
    
    // Check liveness first - if not completed, show BVN step but trigger liveness modal
    if (!progress.liveness_test_completed) {
      return 'bvn_verification'; // Go to BVN step, but liveness will be triggered automatically
    }
    
    const stepOrder: KYCStep[] = ['bvn_verification', 'id_face_match', 'personal', 'documents_verification', 'address_details', 'review'];
    
    // Find the first incomplete step
    for (const step of stepOrder) {
      switch (step) {
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
          return step; // Review is accessible if all steps are complete
      }
    }
    
    return 'review'; // Default to review if all steps are complete
  }, [progress]);

  // Helper function to get the next incomplete step
  const getNextIncompleteStep = useCallback((current: KYCStep): KYCStep => {
    const stepOrder: KYCStep[] = ['bvn_verification', 'id_face_match', 'personal', 'documents_verification', 'address_details', 'review'];
    const currentIndex = stepOrder.indexOf(current);
    
    // Find the next incomplete step
    for (let i = currentIndex + 1; i < stepOrder.length; i++) {
      const step = stepOrder[i];
      switch (step) {
        case 'bvn_verification':
          if (!progress?.bvn_verified) return step;
          break;
        case 'id_face_match':
          if (!progress?.id_face_verified) return step;
          break;
        case 'personal':
          if (!progress?.personal_info_completed) return step;
          break;
        case 'documents_verification':
          if (!progress?.documents_verified) return step;
          break;
        case 'address_details':
          if (!progress?.address_completed) return step;
          break;
        case 'review':
          return step; // Review is always accessible if all steps are complete
      }
    }
    
    return 'review'; // Default to review if all steps are complete
  }, [progress]);

  // Helper function to get the previous incomplete step
  const getPreviousIncompleteStep = useCallback((current: KYCStep): KYCStep | null => {
    const stepOrder: KYCStep[] = ['bvn_verification', 'id_face_match', 'personal', 'documents_verification', 'address_details', 'review'];
    const currentIndex = stepOrder.indexOf(current);
    
    // Find the last incomplete step before current
    for (let i = currentIndex - 1; i >= 0; i--) {
      const step = stepOrder[i];
      switch (step) {
        case 'bvn_verification':
          if (!progress?.bvn_verified) return step;
          break;
        case 'id_face_match':
          if (!progress?.id_face_verified) return step;
          break;
        case 'personal':
          if (!progress?.personal_info_completed) return step;
          break;
        case 'documents_verification':
          if (!progress?.documents_verified) return step;
          break;
        case 'address_details':
          if (!progress?.address_completed) return step;
          break;
      }
    }
    
    return null; // No previous incomplete step
  }, [progress]);

  // Update current step when progress changes
  useEffect(() => {
    if (progress && !progressLoading) {
      const targetStep = getFirstIncompleteStep();
      setCurrentStep(targetStep);
    }
  }, [progress, progressLoading, getFirstIncompleteStep]);

  const goToNextStep = useCallback(async (fromStep: KYCStep) => {
    const nextStep = getNextIncompleteStep(fromStep);
    await updateProgress({ current_step: nextStep });
    setCurrentStep(nextStep);
    return nextStep;
  }, [getNextIncompleteStep, updateProgress]);

  const goToPreviousStep = useCallback(async (fromStep: KYCStep) => {
    const previousStep = getPreviousIncompleteStep(fromStep);
    if (previousStep) {
      await updateProgress({ current_step: previousStep });
      setCurrentStep(previousStep);
      return previousStep;
    }
    return null;
  }, [getPreviousIncompleteStep, updateProgress]);

  const goToStep = useCallback(async (step: KYCStep) => {
    await updateProgress({ current_step: step });
    setCurrentStep(step);
  }, [updateProgress]);

  return {
    currentStep,
    setCurrentStep,
    goToNextStep,
    goToPreviousStep,
    goToStep,
    getFirstIncompleteStep,
    getNextIncompleteStep,
    getPreviousIncompleteStep,
  };
};

