import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { X, CheckCircle2, AlertCircle } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { supabase } from '@/lib/supabase';
import LivenessTestEnhanced from '@/components/LivenessTestEnhanced';
import { verifyBVNWithFaceMatch, validateBVN } from '@/utils/kyc-verification';
import { useHaptics } from '@/hooks/useHaptics';

type Step = 'liveness' | 'bvn' | 'success';

export default function SimplifiedKYCScreen() {
  const { colors, isDark } = useTheme();
  const { session } = useAuth();
  const { showToast } = useToast();
  const haptics = useHaptics();
  const styles = createStyles(colors, isDark);

  const [currentStep, setCurrentStep] = useState<Step>('liveness');
  const [showLivenessTest, setShowLivenessTest] = useState(false);
  const [selfieUrl, setSelfieUrl] = useState<string | null>(null);
  const [bvn, setBvn] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<{
    success: boolean;
    match?: boolean;
    confidence?: number;
    bvnPhoto?: string;
    error?: string;
  } | null>(null);
  const [kycCompleted, setKycCompleted] = useState(false);

  const bvnInputRef = useRef<TextInput>(null);

  // Auto-start liveness test when component mounts
  useEffect(() => {
    if (currentStep === 'liveness' && !selfieUrl) {
      setShowLivenessTest(true);
    }
  }, [currentStep, selfieUrl]);

  // Auto-focus BVN input when step changes
  useEffect(() => {
    if (currentStep === 'bvn' && bvnInputRef.current) {
      setTimeout(() => {
        bvnInputRef.current?.focus();
      }, 300);
    }
  }, [currentStep]);

  const handleLivenessComplete = async (capturedImageUrl: string) => {
    try {
      setSelfieUrl(capturedImageUrl);
      setShowLivenessTest(false);
      setCurrentStep('bvn');
      showToast('Selfie captured successfully', 'success');
      haptics.success();
    } catch (error) {
      console.error('Error handling liveness completion:', error);
      showToast('Failed to process selfie. Please try again.', 'error');
    }
  };

  const handleLivenessClose = () => {
    setShowLivenessTest(false);
    if (!selfieUrl) {
      // If no selfie was captured, go back
      router.back();
    }
  };

  const handleBVNChange = (text: string) => {
    const numericText = text.replace(/[^0-9]/g, '');
    if (numericText.length <= 11) {
      setBvn(numericText);
      setVerificationResult(null);
    }
  };

  const handleVerifyBVN = async () => {
    if (!session?.user?.id) {
      showToast('Authentication required', 'error');
      return;
    }

    if (!selfieUrl) {
      showToast('Please complete the liveness test first', 'error');
      setCurrentStep('liveness');
      setShowLivenessTest(true);
      return;
    }

    // Validate BVN
    const validation = validateBVN(bvn);
    if (!validation.isValid) {
      showToast(validation.error || 'Invalid BVN', 'error');
      haptics.error();
      return;
    }

    setIsVerifying(true);
    setVerificationResult(null);
    haptics.lightImpact();

    try {
      const result = await verifyBVNWithFaceMatch(bvn, selfieUrl, session.user.id);

      setVerificationResult(result);

      if (result.success && result.match && result.confidence && result.confidence >= 80) {
        // Face match successful - update KYC status
        await updateKYCStatus();
        haptics.success();
        showToast(`Face match successful! Confidence: ${result.confidence.toFixed(1)}%`, 'success');
        
        // Move to success step after a short delay
        setTimeout(() => {
          setKycCompleted(true);
          setCurrentStep('success');
        }, 1500);
      } else {
        // Face match failed or low confidence
        haptics.error();
        const errorMsg = result.error || 'Face match verification failed';
        showToast(errorMsg, 'error');
      }
    } catch (error) {
      console.error('BVN verification error:', error);
      const errorMessage = error instanceof Error ? error.message : 'BVN verification failed';
      setVerificationResult({
        success: false,
        error: errorMessage,
      });
      showToast(errorMessage, 'error');
      haptics.error();
    } finally {
      setIsVerifying(false);
    }
  };

  const updateKYCStatus = async () => {
    if (!session?.user?.id) return;

    try {
      // Update KYC progress
      const { error: progressError } = await supabase
        .from('kyc_progress')
        .upsert({
          user_id: session.user.id,
          bvn_verified: true,
          id_face_verified: true,
          tier_1_completed: true,
          overall_completed: true,
          current_step: 'review',
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id',
        });

      if (progressError) {
        console.error('Error updating KYC progress:', progressError);
      }

      // Update profile
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ 
          account_verified: true,
          kyc_tier: 1,
        })
        .eq('id', session.user.id);

      if (profileError) {
        console.error('Error updating profile:', profileError);
      }

      // Update KYC tier using function
      await supabase.rpc('update_user_kyc_tier', {
        p_user_id: session.user.id,
      });

      // Create audit log
      await supabase.rpc('create_kyc_audit_log', {
        p_user_id: session.user.id,
        p_operation_type: 'kyc_verified',
        p_verification_type: 'bvn',
        p_verification_provider: 'dojah',
        p_request_data: {
          action: 'simplified_kyc_completion',
          bvn: bvn.substring(0, 4) + '****',
          face_match_confidence: verificationResult?.confidence,
        },
        p_response_data: {
          overall_completed: true,
          account_verified: true,
          completion_timestamp: new Date().toISOString(),
          simplified_kyc: true,
        },
        p_status: 'success',
        p_result_message: 'Simplified KYC verification completed successfully',
        p_confidence_score: verificationResult?.confidence || 100.0,
        p_metadata: {
          component: 'simplified_kyc',
          verification_step: 'bvn_face_match',
          final_completion: true,
        },
      });
    } catch (error) {
      console.error('Error updating KYC status:', error);
    }
  };

  const handleRetry = () => {
    setVerificationResult(null);
    setBvn('');
    setCurrentStep('liveness');
    setShowLivenessTest(true);
    setSelfieUrl(null);
  };

  const handleSuccessContinue = () => {
    router.replace('/(tabs)');
  };

  const renderLivenessStep = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Step 1: Liveness Test</Text>
      <Text style={styles.stepDescription}>
        We need to verify that you're a real person. Please complete the liveness test by following the on-screen instructions.
      </Text>
      {selfieUrl && (
        <View style={styles.completedBadge}>
          <CheckCircle2 size={20} color={colors.success} />
          <Text style={styles.completedText}>Liveness test completed</Text>
        </View>
      )}
      {!selfieUrl && (
        <Pressable
          style={[styles.button, styles.primaryButton]}
          onPress={() => setShowLivenessTest(true)}
        >
          <Text style={styles.buttonText}>Start Liveness Test</Text>
        </Pressable>
      )}
    </View>
  );

  const renderBVNStep = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Step 2: BVN Verification</Text>
      <Text style={styles.stepDescription}>
        Enter your Bank Verification Number (BVN) to complete verification. We'll match your face with your BVN photo.
      </Text>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Bank Verification Number (BVN)</Text>
        <View style={[
          styles.inputContainer,
          verificationResult && !verificationResult.success && styles.inputError,
        ]}>
          <TextInput
            ref={bvnInputRef}
            style={styles.input}
            placeholder="Enter your 11-digit BVN"
            placeholderTextColor={colors.textTertiary}
            value={bvn}
            onChangeText={handleBVNChange}
            keyboardType="numeric"
            maxLength={11}
            editable={!isVerifying}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="done"
            onSubmitEditing={handleVerifyBVN}
          />
        </View>
        {verificationResult && !verificationResult.success && (
          <View style={styles.errorContainer}>
            <AlertCircle size={16} color={colors.error} />
            <Text style={styles.errorText}>{verificationResult.error}</Text>
          </View>
        )}
      </View>

      {verificationResult && verificationResult.success && (
        <View style={styles.successContainer}>
          <CheckCircle2 size={20} color={colors.success} />
          <View style={styles.successTextContainer}>
            <Text style={styles.successText}>Face match successful!</Text>
            <Text style={styles.confidenceText}>
              Confidence: {verificationResult.confidence?.toFixed(1)}%
            </Text>
          </View>
        </View>
      )}

      {verificationResult && verificationResult.bvnPhoto && (
        <View style={styles.photoContainer}>
          <Text style={styles.photoLabel}>Your BVN Photo:</Text>
          <Image
            source={{ uri: verificationResult.bvnPhoto }}
            style={styles.bvnPhoto}
            resizeMode="cover"
          />
        </View>
      )}

      <Pressable
        style={[
          styles.button,
          styles.primaryButton,
          (isVerifying || bvn.length !== 11) && styles.buttonDisabled,
        ]}
        onPress={handleVerifyBVN}
        disabled={isVerifying || bvn.length !== 11}
      >
        {isVerifying ? (
          <>
            <ActivityIndicator size="small" color="#fff" style={{ marginRight: 8 }} />
            <Text style={styles.buttonText}>Verifying...</Text>
          </>
        ) : (
          <Text style={styles.buttonText}>Verify BVN</Text>
        )}
      </Pressable>

      {verificationResult && !verificationResult.success && (
        <Pressable
          style={[styles.button, styles.secondaryButton]}
          onPress={handleRetry}
        >
          <Text style={[styles.buttonText, styles.secondaryButtonText]}>Retry</Text>
        </Pressable>
      )}
    </View>
  );

  const renderSuccessStep = () => (
    <View style={styles.stepContainer}>
      <View style={styles.successIconContainer}>
        <CheckCircle2 size={64} color={colors.success} />
      </View>
      <Text style={styles.successTitle}>KYC Verification Complete!</Text>
      <Text style={styles.successDescription}>
        Your identity has been successfully verified. You can now use all features of the app.
      </Text>
      {verificationResult && (
        <View style={styles.successDetails}>
          <Text style={styles.successDetailText}>
            Face Match Confidence: {verificationResult.confidence?.toFixed(1)}%
          </Text>
        </View>
      )}
      <Pressable
        style={[styles.button, styles.primaryButton]}
        onPress={handleSuccessContinue}
      >
        <Text style={styles.buttonText}>Continue</Text>
      </Pressable>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.header}>
        <Pressable
          style={styles.closeButton}
          onPress={() => router.back()}
        >
          <X size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Simplified KYC</Text>
        <View style={{ width: 24 }} />
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {currentStep === 'liveness' && renderLivenessStep()}
          {currentStep === 'bvn' && renderBVNStep()}
          {currentStep === 'success' && renderSuccessStep()}
        </ScrollView>
      </KeyboardAvoidingView>

      <LivenessTestEnhanced
        isVisible={showLivenessTest}
        onClose={handleLivenessClose}
        onComplete={handleLivenessComplete}
      />
    </SafeAreaView>
  );
}

function createStyles(colors: any, isDark: boolean) {
  return StyleSheet.create({
    container: {
      flex: 1,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    closeButton: {
      padding: 4,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
    },
    keyboardView: {
      flex: 1,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      padding: 20,
    },
    stepContainer: {
      gap: 24,
    },
    stepTitle: {
      fontSize: 24,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 8,
    },
    stepDescription: {
      fontSize: 16,
      lineHeight: 24,
      color: colors.textSecondary,
      marginBottom: 8,
    },
    completedBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      padding: 12,
      borderRadius: 12,
      backgroundColor: colors.successLight,
      marginTop: 8,
    },
    completedText: {
      fontSize: 14,
      fontWeight: '500',
      color: colors.success,
    },
    inputGroup: {
      gap: 8,
    },
    label: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 4,
    },
    inputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      backgroundColor: colors.backgroundSecondary,
      paddingHorizontal: 16,
      minHeight: 52,
    },
    inputError: {
      borderColor: colors.error,
    },
    input: {
      flex: 1,
      fontSize: 16,
      color: colors.text,
      paddingVertical: 14,
    },
    errorContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 4,
    },
    errorText: {
      fontSize: 14,
      color: colors.error,
      flex: 1,
    },
    successContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 16,
      borderRadius: 12,
      backgroundColor: colors.successLight,
    },
    successTextContainer: {
      flex: 1,
    },
    successText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.success,
      marginBottom: 4,
    },
    confidenceText: {
      fontSize: 14,
      color: colors.success,
    },
    photoContainer: {
      gap: 8,
    },
    photoLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
    },
    bvnPhoto: {
      width: '100%',
      height: 200,
      borderRadius: 12,
      backgroundColor: colors.backgroundTertiary,
    },
    button: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 16,
      paddingHorizontal: 24,
      borderRadius: 12,
      minHeight: 52,
    },
    primaryButton: {
      backgroundColor: colors.primary,
    },
    buttonDisabled: {
      opacity: 0.5,
    },
    secondaryButton: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: colors.border,
    },
    buttonText: {
      fontSize: 16,
      fontWeight: '600',
      color: '#fff',
    },
    secondaryButtonText: {
      color: colors.text,
    },
    successIconContainer: {
      alignItems: 'center',
      marginBottom: 24,
    },
    successTitle: {
      fontSize: 28,
      fontWeight: '700',
      color: colors.text,
      textAlign: 'center',
      marginBottom: 12,
    },
    successDescription: {
      fontSize: 16,
      lineHeight: 24,
      color: colors.textSecondary,
      textAlign: 'center',
      marginBottom: 24,
    },
    successDetails: {
      padding: 16,
      borderRadius: 12,
      backgroundColor: colors.backgroundSecondary,
      marginBottom: 24,
    },
    successDetailText: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
    },
  });
}
