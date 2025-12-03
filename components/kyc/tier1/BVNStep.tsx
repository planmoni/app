import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, ActivityIndicator, Pressable } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { Check, CreditCard } from 'lucide-react-native';
import ProgressBar from './ProgressBar';
import { useTier1KYC } from '@/hooks/useTier1KYC';
import { useToast } from '@/contexts/ToastContext';
import { useAuth } from '@/contexts/AuthContext';
import { useKYCData } from '@/hooks/useKYCData';
import { useKYCProgress } from '@/hooks/useKYCProgress';
import { verifyBVN, validateBVN } from '@/utils/kyc-verification';
import FloatingButton from '@/components/FloatingButton';

interface BVNStepProps {
  onComplete: () => void;
}

export default function BVNStep({ onComplete }: BVNStepProps) {
  const { colors, isDark } = useTheme();
  const { showToast } = useToast();
  const { session } = useAuth();
  const { formData } = useKYCData();
  const { progress, updateProgress } = useKYCProgress();
  const { getProgressPercentage, getCurrentStepNumber } = useTier1KYC();
  
  const [bvn, setBvn] = useState(formData?.bvn || '');
  const [isVerifying, setIsVerifying] = useState(false);
  const [bvnVerified, setBvnVerified] = useState(false);
  const [bvnMatchedName, setBvnMatchedName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const bvnInputRef = useRef<TextInput>(null);

  // Auto-focus BVN input when step loads
  useEffect(() => {
    if (!bvnVerified && bvnInputRef.current) {
      const timer = setTimeout(() => {
        bvnInputRef.current?.focus();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [bvnVerified]);

  const handleVerify = async () => {
    // Validate BVN
    const validation = validateBVN(bvn);
    if (!validation.isValid) {
      setError(validation.error);
      showToast(validation.error || 'Invalid BVN', 'error');
      return;
    }

    if (!session?.user?.id) {
      showToast('Authentication required', 'error');
      return;
    }

    if (!formData?.selfie_url) {
      showToast('Please complete the liveness test first', 'error');
      return;
    }

    setIsVerifying(true);
    setError(null);

    try {
      const result = await verifyBVN(
        bvn,
        formData.selfie_url,
        session.user.id,
        async (updates) => {
          return await updateProgress(updates);
        }
      );

      if (result.success && result.displayName) {
        setBvnVerified(true);
        setBvnMatchedName(result.displayName);
        showToast(`BVN verified! Name: ${result.displayName}`, 'success');
        
        // Auto-advance to next step after delay
        setTimeout(() => {
          onComplete();
        }, 2000);
      } else {
        setError(result.error || 'BVN verification failed');
        showToast(result.error || 'BVN verification failed', 'error');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'BVN verification failed';
      setError(errorMessage);
      showToast(errorMessage, 'error');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleNumericInput = (text: string) => {
    const numericText = text.replace(/[^0-9]/g, '');
    if (numericText.length <= 11) {
      setBvn(numericText);
      setError(null);
    }
  };

  const styles = createStyles(colors, isDark);
  const percentage = getProgressPercentage();
  const stepNumber = getCurrentStepNumber();
  const isVerified = progress?.bvn_verified || bvnVerified;

  return (
    <View style={styles.container}>
      <ProgressBar percentage={percentage} currentStep={stepNumber} totalSteps={3} />
      
      <View style={styles.content}>
        
        <Text style={styles.title}>BVN Verification</Text>
        <Text style={styles.description}>
          Enter your Bank Verification Number (BVN) to verify your identity. This is a secure process that helps protect your account.
        </Text>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Bank Verification Number (BVN)</Text>
          <View style={[styles.inputContainer, error && styles.inputError, isVerified && styles.inputVerified]}>
            <TextInput
              ref={bvnInputRef}
              style={styles.input}
              placeholder="Enter your 11-digit BVN"
              placeholderTextColor={colors.textTertiary}
              value={bvn}
              onChangeText={handleNumericInput}
              keyboardType="numeric"
              maxLength={11}
              editable={!isVerifying && !isVerified}
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
            {isVerifying && (
              <ActivityIndicator size="small" color={colors.primary} style={styles.activityIndicator} />
            )}
            {isVerified && (
              <View style={styles.verifiedBadge}>
                <Check size={16} color="#FFFFFF" />
              </View>
            )}
          </View>
          {error && <Text style={styles.errorText}>{error}</Text>}
        </View>

        {isVerified && bvnMatchedName && (
          <View style={styles.matchedNameContainer}>
            <Check size={16} color={colors.success} />
            <Text style={styles.matchedNameText}>
              BVN verified! Name: {bvnMatchedName}
            </Text>
          </View>
        )}

        <View style={styles.infoContainer}>
          <Text style={styles.infoText}>
            Your BVN is used for verification purposes only. This helps us confirm your identity and protect your account.
          </Text>
        </View>
      </View>

      {!isVerified && (
        <FloatingButton
          title="Verify BVN"
          onPress={handleVerify}
          disabled={isVerifying || bvn.length !== 11}
          loading={isVerifying}
        />
      )}
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
    },
    iconContainer: {
      width: 100,
      height: 100,
      borderRadius: 50,
      backgroundColor: isDark ? 'rgba(59, 130, 246, 0.2)' : '#EFF6FF',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 24,
      alignSelf: 'center',
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
    },
    inputGroup: {
      marginBottom: 20,
    },
    label: {
      fontSize: 14,
      fontWeight: '500',
      color: colors.text,
      marginBottom: 8,
    },
    inputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      backgroundColor: colors.surface,
      paddingHorizontal: 16,
      height: 60,
    },
    inputError: {
      borderColor: colors.error,
    },
    inputVerified: {
      borderColor: colors.success,
      backgroundColor: isDark ? 'rgba(34, 197, 94, 0.1)' : '#F0FDF4',
    },
    input: {
      flex: 1,
      fontSize: 18,
      color: colors.text,
    },
    activityIndicator: {
      marginLeft: 8,
    },
    verifiedBadge: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: colors.success,
      justifyContent: 'center',
      alignItems: 'center',
    },
    errorText: {
      fontSize: 12,
      color: colors.error,
      marginTop: 4,
    },
    matchedNameContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: isDark ? 'rgba(34, 197, 94, 0.1)' : '#F0FDF4',
      padding: 12,
      borderRadius: 8,
      marginBottom: 20,
    },
    matchedNameText: {
      fontSize: 14,
      color: colors.success,
      fontWeight: '500',
    },
    infoContainer: {
      backgroundColor: isDark ? 'rgba(59, 130, 246, 0.1)' : '#EFF6FF',
      padding: 16,
      borderRadius: 12,
      marginTop: 'auto',
    },
    infoText: {
      fontSize: 14,
      color: colors.textSecondary,
      lineHeight: 20,
    },
  });
}

