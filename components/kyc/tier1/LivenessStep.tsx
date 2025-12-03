import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { Camera } from 'lucide-react-native';
import LivenessTestEnhanced from '@/components/LivenessTestEnhanced';
import CameraPermissionModal from '@/components/CameraPermissionModal';
import { useCameraPermissions } from 'expo-camera';
import ProgressBar from './ProgressBar';
import { useTier1KYC } from '@/hooks/useTier1KYC';
import { useToast } from '@/contexts/ToastContext';
import { useAuth } from '@/contexts/AuthContext';
import { useKYCData } from '@/hooks/useKYCData';
import { useKYCProgress } from '@/hooks/useKYCProgress';
import { supabase } from '@/lib/supabase';

interface LivenessStepProps {
  onComplete: () => void;
}

export default function LivenessStep({ onComplete }: LivenessStepProps) {
  const { colors, isDark } = useTheme();
  const { showToast } = useToast();
  const { session } = useAuth();
  const { saveFormData } = useKYCData();
  const { progress, updateProgress, loadProgress } = useKYCProgress();
  const { getProgressPercentage, getCurrentStepNumber } = useTier1KYC();
  const [permission] = useCameraPermissions();
  const hasPermission = permission?.granted ?? false;
  
  const [showLivenessTest, setShowLivenessTest] = useState(false);
  const [showCameraPermissionModal, setShowCameraPermissionModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleLivenessComplete = async (selfieUrl: string) => {
    try {
      setIsLoading(true);
      
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
          source: 'tier1_kyc_flow',
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
          component: 'Tier1KYC',
          action: 'liveness_completion',
          step: 'liveness'
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
      
      // Update progress
      await updateProgress({
        current_step: 'bvn_verification',
        liveness_test_completed: true
      });
      
      // Reload progress to ensure state is updated
      await loadProgress();
      
      showToast('Selfie captured and saved successfully', 'success');
      
      // Auto-advance to next step
      setTimeout(() => {
        setShowLivenessTest(false);
        onComplete();
      }, 1000);
      
    } catch (error) {
      console.error('Error handling liveness completion:', error);
      showToast('Failed to process liveness completion. Please try again.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLivenessClose = () => {
    setShowLivenessTest(false);
  };

  const handleStartLivenessTest = () => {
    // Check if camera permission is granted
    if (hasPermission) {
      // Permission already granted, show liveness test directly
      setShowLivenessTest(true);
    } else {
      // No permission, show camera permission modal
      setShowCameraPermissionModal(true);
    }
  };

  const handleCameraPermissionComplete = (selfieUrl: string) => {
    // Permission granted and liveness test completed from CameraPermissionModal
    // Close the permission modal and handle completion
    setShowCameraPermissionModal(false);
    handleLivenessComplete(selfieUrl);
  };

  const handleCameraPermissionClose = () => {
    setShowCameraPermissionModal(false);
  };

  const handleContinue = () => {
    onComplete();
  };

  const styles = createStyles(colors, isDark);
  const percentage = getProgressPercentage();
  const stepNumber = getCurrentStepNumber();

  return (
    <View style={styles.container}>
      <ProgressBar percentage={percentage} currentStep={stepNumber} totalSteps={4} />
      
      <View style={styles.content}>
        
        <Text style={styles.title}>Selfie Capture</Text>
        <Text style={styles.description}>
          Complete a quick selfie capture to begin your verification process. This helps us ensure your account security.
        </Text>

        {progress?.liveness_test_completed ? (
          <View style={styles.completedContainer}>
            <Text style={styles.completedText}>✓ Selfie captured</Text>
            <Pressable
              style={[styles.button, styles.continueButton]}
              onPress={handleContinue}
            >
              <Text style={styles.buttonText}>Continue</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable
            style={[styles.button, isLoading && styles.buttonDisabled]}
            onPress={handleStartLivenessTest}
            disabled={isLoading}
          >
            <Camera size={20} color="#FFFFFF" />
            <Text style={styles.buttonText}>Start Selfie Capture</Text>
          </Pressable>
        )}
      </View>

      <CameraPermissionModal
        isVisible={showCameraPermissionModal}
        onClose={handleCameraPermissionClose}
        onComplete={handleCameraPermissionComplete}
      />

      <LivenessTestEnhanced
        isVisible={showLivenessTest}
        onClose={handleLivenessClose}
        onComplete={handleLivenessComplete}
      />
    </View>
  );
}

function createStyles(colors: any, isDark: boolean) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      flex: 1,
      padding: 24,
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconContainer: {
      width: 100,
      height: 100,
      borderRadius: 50,
      backgroundColor: isDark ? 'rgba(59, 130, 246, 0.2)' : '#EFF6FF',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 24,
    },
    title: {
      fontSize: 24,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 12,
      textAlign: 'center',
    },
    description: {
      fontSize: 16,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 24,
      marginBottom: 32,
      paddingHorizontal: 16,
    },
    button: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: colors.primary,
      paddingVertical: 16,
      paddingHorizontal: 32,
      borderRadius: 20,
      minWidth: 200,
    },
    buttonDisabled: {
      opacity: 0.6,
    },
    buttonText: {
      fontSize: 16,
      fontWeight: '600',
      color: '#FFFFFF',
    },
    completedContainer: {
      backgroundColor: isDark ? 'rgba(34, 197, 94, 0.2)' : '#F0FDF4',
      paddingVertical: 12,
      paddingHorizontal: 24,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.success,
      alignItems: 'center',
      gap: 16,
    },
    completedText: {
      fontSize: 16,
      fontWeight: '500',
      color: colors.success,
    },
    continueButton: {
      marginTop: 8,
      minWidth: 150,
    },
  });
}

