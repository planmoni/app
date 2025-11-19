import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useKYCProgress } from '@/hooks/useKYCProgress';
import { useKYCData } from '@/hooks/useKYCData';
import { supabase } from '@/lib/supabase';
import { KYCStep } from '@/hooks/useKYCProgress';

export const useKYCLiveness = (currentStep: KYCStep) => {
  const { session } = useAuth();
  const { progress } = useKYCProgress();
  const { saveFormData } = useKYCData();
  
  const [showLivenessTest, setShowLivenessTest] = useState(false);
  const [showCameraPermissionModal, setShowCameraPermissionModal] = useState(false);
  const [livenessInitiated, setLivenessInitiated] = useState(false);
  const [livenessManuallyClosed, setLivenessManuallyClosed] = useState(false);
  const [livenessCompleted, setLivenessCompleted] = useState(false);

  // Note: Camera permission modal is now triggered from the Home page (KYCCard)
  // when the user clicks "Start" or "Continue" if liveness is not completed.
  // This auto-trigger on BVN step has been removed to ensure the modal opens
  // at the start of the verification process, not during the BVN step.

  const handleLivenessComplete = useCallback(async (selfieUrl: string) => {
    console.log('[useKYCLiveness] handleLivenessComplete called with selfieUrl:', selfieUrl);
    try {
      setLivenessCompleted(true);
      
      // Save the selfie URL to form data
      await saveFormData({
        selfie_url: selfieUrl
      });
      
      // Create audit log for liveness test completion
      const { data: auditLogId } = await supabase.rpc('create_kyc_audit_log', {
        p_user_id: session?.user?.id,
        p_operation_type: 'liveness_check',
        p_verification_type: 'liveness',
        p_verification_provider: 'internal',
        p_request_data: {
          action: 'liveness_test_completed',
          source: 'kyc_upgrade_screen',
          timestamp: new Date().toISOString()
        },
        p_response_data: {
          selfie_url: selfieUrl,
          completion_status: 'success',
          next_step: 'bvn_verification'
        },
        p_status: 'success',
        p_result_message: 'Liveness test completed successfully',
        p_metadata: {
          component: 'useKYCLiveness',
          action: 'liveness_completion',
          step: 'bvn_verification'
        }
      });

      // Create audit event for liveness completion
      if (auditLogId) {
        await supabase
          .from('kyc_audit_events')
          .insert({
            audit_log_id: auditLogId,
            user_id: session?.user?.id,
            event_type: 'verification_completed',
            event_data: {
              action: 'liveness_test_completed',
              selfie_url: selfieUrl,
              test_stages: ['blink', 'nod', 'look_left', 'look_right', 'smile']
            },
            severity: 'medium'
          });

        // Create audit attachment for selfie image
        await supabase
          .from('kyc_audit_attachments')
          .insert({
            audit_log_id: auditLogId,
            file_name: `liveness-selfie-${Date.now()}.jpg`,
            file_type: 'image/jpeg',
            file_size: 0,
            file_hash: 'selfie-hash-placeholder',
            file_path: selfieUrl,
            access_level: 'restricted',
            description: 'Liveness test selfie image',
            tags: ['liveness', 'selfie', 'kyc']
          });
      }

      return true;
    } catch (error) {
      console.error('Error handling liveness completion:', error);
      setLivenessCompleted(false);
      return false;
    }
  }, [session?.user?.id, saveFormData]);

  const handleLivenessClose = useCallback(async () => {
    console.log('[useKYCLiveness] handleLivenessClose called');
    
    if (livenessCompleted || progress?.liveness_test_completed) {
      console.log('[useKYCLiveness] Liveness test was completed, closing modal without navigation');
      setShowLivenessTest(false);
      setLivenessInitiated(false);
      setLivenessManuallyClosed(false);
      return;
    }
    
    console.log('[useKYCLiveness] Liveness test was not completed, user manually closed');

    try {
      // Create audit log for liveness test manual close
      const { data: auditLogId } = await supabase.rpc('create_kyc_audit_log', {
        p_user_id: session?.user?.id,
        p_operation_type: 'liveness_check',
        p_verification_type: 'liveness',
        p_verification_provider: 'internal',
        p_request_data: {
          action: 'liveness_test_manually_closed',
          source: 'kyc_upgrade_screen',
          timestamp: new Date().toISOString()
        },
        p_response_data: {
          user_action: 'manually_closed_liveness_test',
          completion_status: 'cancelled'
        },
        p_status: 'failed',
        p_result_message: 'User manually closed liveness test',
        p_metadata: {
          component: 'useKYCLiveness',
          action: 'liveness_manual_close',
          step: 'bvn_verification'
        }
      });

      if (auditLogId) {
        await supabase
          .from('kyc_audit_events')
          .insert({
            audit_log_id: auditLogId,
            user_id: session?.user?.id,
            event_type: 'verification_cancelled',
            event_data: {
              action: 'liveness_test_manually_closed',
              reason: 'user_cancelled',
              step: 'bvn_verification'
            },
            severity: 'low'
          });
      }
    } catch (error) {
      console.error('Error creating audit log for liveness close:', error);
    }

    setShowLivenessTest(false);
    setLivenessInitiated(false);
    setLivenessManuallyClosed(true);
  }, [livenessCompleted, progress?.liveness_test_completed, session?.user?.id]);

  const handleCameraPermissionComplete = useCallback(async (selfieUrl: string) => {
    console.log('[useKYCLiveness] handleCameraPermissionComplete called with selfieUrl:', selfieUrl);
    return await handleLivenessComplete(selfieUrl);
  }, [handleLivenessComplete]);

  const handleCameraPermissionClose = useCallback(() => {
    console.log('[useKYCLiveness] handleCameraPermissionClose called');
    setShowCameraPermissionModal(false);
    setLivenessInitiated(false);
  }, []);

  return {
    // State
    showLivenessTest,
    showCameraPermissionModal,
    livenessInitiated,
    livenessManuallyClosed,
    livenessCompleted,
    
    // Setters
    setShowLivenessTest,
    setShowCameraPermissionModal,
    setLivenessInitiated,
    setLivenessManuallyClosed,
    setLivenessCompleted,
    
    // Handlers
    handleLivenessComplete,
    handleLivenessClose,
    handleCameraPermissionComplete,
    handleCameraPermissionClose,
  };
};

