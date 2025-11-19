import React, { useState, useRef, useEffect, useImperativeHandle, forwardRef } from 'react';
import { View, Text, TextInput, ActivityIndicator } from 'react-native';
import { Check, Info } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useToast } from '@/contexts/ToastContext';
import { useAuth } from '@/contexts/AuthContext';
import { useKYCData } from '@/hooks/useKYCData';
import { useKYCProgress } from '@/hooks/useKYCProgress';
import { useKYCStyles } from './sharedStyles';
import { supabase } from '@/lib/supabase';

export interface BVNVerificationHandle {
  verify: () => Promise<boolean>;
  isValid: () => boolean;
}

interface BVNVerificationProps {
  onComplete?: () => void;
  onError?: (error: string) => void;
  initialBvn?: string;
}

const BVNVerification = forwardRef<BVNVerificationHandle, BVNVerificationProps>(
  ({ onComplete, onError, initialBvn = '' }, ref) => {
    const { colors } = useTheme();
    const { showToast } = useToast();
    const { session } = useAuth();
    const { formData, saveFormData } = useKYCData();
    const { progress, updateProgress, updateTier, checkTierCompletion } = useKYCProgress();
    const styles = useKYCStyles();
    
    const [bvn, setBvn] = useState(initialBvn);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [bvnVerified, setBvnVerified] = useState(false);
    const [bvnMatchedName, setBvnMatchedName] = useState('');
    const [isResolvingBvn, setIsResolvingBvn] = useState(false);
    const bvnInputRef = useRef<TextInput>(null);

    // Load BVN from form data
    useEffect(() => {
      if (formData?.bvn) {
        setBvn(formData.bvn);
      }
      if (progress?.bvn_verified) {
        setBvnVerified(true);
      }
    }, [formData, progress]);

  // Auto-focus BVN input on mount
  useEffect(() => {
    if (bvnInputRef.current && !bvnVerified) {
      const timer = setTimeout(() => {
        bvnInputRef.current?.focus();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [bvnVerified]);

  const handleNumericInput = (text: string) => {
    const numericText = text.replace(/[^0-9]/g, '');
    if (numericText.length <= 11) {
      setBvn(numericText);
      setErrors(prev => ({ ...prev, bvn: '' }));
    }
  };

  const validateBvn = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (!bvn.trim()) {
      newErrors.bvn = 'BVN is required';
    } else if (bvn.length !== 11 || !/^\d+$/.test(bvn)) {
      newErrors.bvn = 'BVN must be 11 digits';
    }
    
    setErrors(newErrors);
    
    if (Object.keys(newErrors).length > 0) {
      const firstError = Object.values(newErrors)[0];
      showToast(firstError, 'error');
      return false;
    }
    
    return true;
  };

  const convertImageToBase64 = async (imageUrl: string): Promise<string | null> => {
    try {
      if (imageUrl.startsWith('data:image/')) {
        const parts = imageUrl.split(',');
        return parts.length > 1 ? parts[1] : null;
      }

      const response = await fetch(imageUrl);
      const blob = await response.blob();
      
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64String = reader.result as string;
          const base64Data = base64String.split(',')[1];
          resolve(base64Data);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error('Error converting image to base64:', error);
      return null;
    }
  };

  const verifyBvn = async (): Promise<boolean> => {
    if (!validateBvn()) return false;

    try {
      // Create audit log
      const { data: auditLogId } = await supabase.rpc('create_kyc_audit_log', {
        p_user_id: session?.user?.id,
        p_operation_type: 'bvn_verified',
        p_verification_type: 'bvn',
        p_verification_provider: 'dojah',
        p_request_data: {
          action: 'start_bvn_verification',
          bvn: bvn,
          source: 'bvn_verification_component',
          timestamp: new Date().toISOString()
        },
        p_response_data: {
          user_action: 'initiated_bvn_verification',
          verification_status: 'pending'
        },
        p_status: 'pending',
        p_result_message: 'User initiated BVN verification process',
        p_metadata: {
          component: 'BVNVerification',
          action: 'bvn_verification_start',
          step: 'bvn_verification'
        }
      });

      if (auditLogId) {
        await supabase
          .from('kyc_audit_events')
          .insert({
            audit_log_id: auditLogId,
            user_id: session?.user?.id,
            event_type: 'verification_started',
            event_data: {
              action: 'bvn_verification_initiated',
              bvn: bvn,
              provider: 'dojah'
            },
            severity: 'medium'
          });
      }

      setIsResolvingBvn(true);
      setErrors({});
      
      if (!session?.user?.id) {
        throw new Error('Authentication required');
      }

      const appId = process.env.EXPO_PUBLIC_DOJAH_APP_ID!;
      const privateKey = process.env.EXPO_PUBLIC_DOJAH_PRIVATE_KEY!;
      
      if (!appId || !privateKey) {
        console.error('Missing Dojah credentials');
        showToast('KYC service configuration error', 'error');
        return;
      }
      
      // Get selfie image for verification
      let selfieImage = null;
      
      if (formData?.selfie_url) {
        const base64Image = await convertImageToBase64(formData.selfie_url);
        if (base64Image) {
          selfieImage = `data:image/jpeg;base64,${base64Image}`;
        }
      }
      
      if (!selfieImage) {
        throw new Error('Selfie image is required for BVN verification. Please complete the liveness test first.');
      }
      
      // Make Dojah API call
      const response = await fetch('https://api.dojah.io/api/v1/kyc/bvn/verify', {
        method: 'POST',
        headers: {
          'AppId': appId,
          'Authorization': privateKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          selfie_image: selfieImage,
          bvn: parseInt(bvn)
        })
      });
      
      if (!response.ok) {
        throw new Error(`BVN verification failed: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('BVN verification response:', data);
      
      if (!data.entity) {
        throw new Error('Invalid BVN or no data returned');
      }
      
      const bvnData = data.entity;
      
      // Check selfie verification result
      if (!bvnData.selfie_verification || !bvnData.selfie_verification.match) {
        throw new Error('Selfie verification failed. Please ensure your face is clearly visible and matches your BVN photo.');
      }
      
      // Create display name from BVN data
      const displayName = [bvnData.first_name, bvnData.middle_name, bvnData.last_name]
        .filter(Boolean)
        .join(' ');
      
      setBvnMatchedName(displayName);
      setBvnVerified(true);
      
      // Create audit log for success
      await supabase.rpc('create_kyc_audit_log', {
        p_user_id: session.user.id,
        p_operation_type: 'bvn_verified',
        p_verification_type: 'bvn',
        p_verification_provider: 'dojah',
        p_request_data: {
          bvn: bvn,
          selfie_verification: true
        },
        p_response_data: {
          bvn_data: bvnData,
          selfie_confidence: bvnData.selfie_verification?.confidence_value,
          matched_name: displayName
        },
        p_status: 'success',
        p_result_message: `BVN verified successfully. Name: ${displayName}`,
        p_confidence_score: bvnData.selfie_verification?.confidence_value || 95.0,
        p_metadata: {
          component: 'BVNVerification',
          verification_step: 'bvn_verification',
          provider: 'dojah'
        }
      });
      
      showToast(`BVN verified! Name: ${displayName}`, 'success');
      
      // Save BVN to form data
      await saveFormData({ bvn });
      
      // Update progress
      const progressResult = await updateProgress({
        current_step: 'id_face_match',
        bvn_verified: true
      });
      
      if (progressResult) {
        await updateTier();
        const tierStatus = checkTierCompletion();
        if (tierStatus.tier1) {
          showToast('Tier 1 completed! You can now deposit up to ₦2,000,000 monthly.', 'success');
        }
      }
      
      if (onComplete) {
        onComplete();
      }
      
      return true;
    } catch (error) {
      console.error('BVN verification error:', error);
      const errorMessage = error instanceof Error ? error.message : 'BVN verification failed';
      showToast(errorMessage, 'error');
      setErrors({ bvn: errorMessage });
      if (onError) {
        onError(errorMessage);
      }
      return false;
    } finally {
      setIsResolvingBvn(false);
    }
  };

  // Expose methods to parent via ref
  useImperativeHandle(ref, () => ({
    verify: verifyBvn,
    isValid: () => bvnVerified && !isResolvingBvn
  }));

  return (
    <View style={styles.formContainer}>
      <Text style={styles.sectionTitle}>BVN Verification</Text>
      <Text style={styles.sectionDescription}>
        Please enter your Bank Verification Number (BVN) for identity verification.
      </Text>
      
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Bank Verification Number (BVN)</Text>
        <View style={[styles.inputContainer, errors.bvn && styles.inputError, bvnVerified && styles.resolvedInput]}>
          <TextInput
            ref={bvnInputRef}
            style={styles.input}
            placeholder="Enter your 11-digit BVN"
            placeholderTextColor={colors.textTertiary}
            value={bvn}
            onChangeText={handleNumericInput}
            keyboardType="numeric"
            maxLength={11}
            editable={!isResolvingBvn && !bvnVerified}
            autoCorrect={false}
            autoCapitalize="none"
            selectTextOnFocus={true}
            blurOnSubmit={false}
            returnKeyType="done"
            textContentType="none"
            autoComplete="off"
            importantForAutofill="no"
            spellCheck={false}
          />
          {isResolvingBvn && (
            <ActivityIndicator size="small" color={colors.primary} style={styles.activityIndicator} />
          )}
          {bvnVerified && (
            <View style={styles.verifiedBadge}>
              <Check size={16} color="#FFFFFF" />
            </View>
          )}
        </View>
        {errors.bvn && <Text style={styles.errorText}>{errors.bvn}</Text>}
      </View>
      
      {bvnVerified && bvnMatchedName && (
        <View style={styles.matchedNameContainer}>
          <Check size={16} color={colors.success} />
          <Text style={styles.matchedNameText}>
            BVN verified! Name: {bvnMatchedName}
          </Text>
        </View>
      )}
      
      <View style={styles.infoContainer}>
        <Info size={20} color={colors.primary} />
        <Text style={styles.infoText}>
          Your BVN is used for verification purposes only. This helps us confirm your identity and protect your account.
        </Text>
      </View>
    </View>
  );
});

BVNVerification.displayName = 'BVNVerification';

export default BVNVerification;

