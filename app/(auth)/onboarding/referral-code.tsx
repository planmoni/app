import { View, Text, StyleSheet, TextInput, Pressable } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useState, useEffect, useRef } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Gift, CheckCircle, X } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import KeyboardAvoidingWrapper from '@/components/KeyboardAvoidingWrapper';
import FloatingButton from '@/components/FloatingButton';
import OnboardingProgress from '@/components/OnboardingProgress';
import { useHaptics } from '@/hooks/useHaptics';
import { supabase } from '@/lib/supabase';
import { Modal, Animated } from 'react-native';
import PlanmoniLoader from '@/components/PlanmoniLoader';
import { useAuth } from '@/contexts/AuthContext';

export default function ReferralCodeScreen() {
  const { colors } = useTheme();
  const { signUp } = useAuth();
  const haptics = useHaptics();
  const params = useLocalSearchParams();
  const firstName = params.firstName as string;
  const lastName = params.lastName as string;
  const email = params.email as string;
  const password = params.password as string;
  const bvn = params.bvn as string;
  const emailVerified = params.emailVerified === 'true';

  const [referralCode, setReferralCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [validReferrer, setValidReferrer] = useState<{id: string, name: string} | null>(null);
  const referralInputRef = useRef<TextInput>(null);
  
  // Account creation modal state
  const [showCreatingModal, setShowCreatingModal] = useState(false);
  const [creationProgress, setCreationProgress] = useState('');
  const [creationError, setCreationError] = useState<string | null>(null);
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);
  const [accountCreated, setAccountCreated] = useState(false);
  
  // Animation values for success state
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const timer = setTimeout(() => {
      referralInputRef.current?.focus();
    }, 300);

    return () => clearTimeout(timer);
  }, []);

  const validateReferralCode = async (code: string) => {
    if (!code || code.trim().length === 0) {
      setValidReferrer(null);
      setError(null);
      return true; // Empty code is valid (skip)
    }
    
    setIsValidating(true);
    setError(null);
    
    try {
      console.log('🔍 Validating referral code:', code.toUpperCase());
      
      // Check if the referral code exists
      const { data, error: queryError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, referral_code')
        .eq('referral_code', code.toUpperCase().trim())
        .single();
      
      console.log('📊 Query result:', { data, error: queryError });
      
      if (queryError) {
        console.log('❌ Query error:', queryError);
        if (queryError.code === 'PGRST116') {
          // No rows returned - code doesn't exist
          setError('Invalid referral code');
          setValidReferrer(null);
          return false;
        } else {
          // Other database error
          setError('Failed to validate referral code');
          setValidReferrer(null);
          return false;
        }
      }
      
      if (!data) {
        setError('Invalid referral code');
        setValidReferrer(null);
        return false;
      }
      
      console.log('✅ Valid referral code found:', data);
      setValidReferrer({
        id: data.id,
        name: `${data.first_name} ${data.last_name}`
      });
      setError(null);
      return true;
    } catch (err) {
      console.error('💥 Error validating referral code:', err);
      setError('Failed to validate referral code');
      setValidReferrer(null);
      return false;
    } finally {
      setIsValidating(false);
    }
  };

  const handleContinue = async () => {
    if (referralCode) {
      // Validate the code before continuing
      const isValid = await validateReferralCode(referralCode);
      if (!isValid) {
        haptics.error();
        return;
      }
    }
    
    // Start account creation process
    await createAccount();
  };

  const handleSkip = () => {
    // Start account creation process
    createAccount();
  };

  const createAccount = async () => {
    if (isCreatingAccount) return; // Prevent multiple calls
    
    try {
      setIsCreatingAccount(true);
      setShowCreatingModal(true);
      setCreationProgress('Preparing your account...');
      setCreationError(null);
      
      console.log('Starting user registration with:', { 
        email, 
        firstName, 
        lastName, 
        referralCode: referralCode.trim() 
      });
      
      // Add delay to show the modal properly
      await new Promise(resolve => setTimeout(resolve, 500));
      
      setCreationProgress('Creating your account...');
      
      // Use AuthContext signUp to ensure proper state synchronization
      const result = await signUp(
        email, 
        password, 
        firstName, 
        lastName, 
        referralCode.trim() || undefined
      );
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to create account');
      }
      
      if (!result.data?.user) {
        throw new Error('Failed to create user account');
      }
      
      setCreationProgress('Setting up your profile...');
      console.log('User registration successful');
      
      // Wait for authentication state to stabilize
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setCreationProgress('Finalizing your account...');
      
      // If email was verified during onboarding, update the profile
      if (emailVerified && result.data.user.id) {
        try {
          console.log('Updating email_verified status to true');
          
          const { error: updateError } = await supabase
            .from('profiles')
            .update({ email_verified: true })
            .eq('id', result.data.user.id);
            
          if (updateError) {
            console.error('Error updating email_verified status:', updateError);
          } else {
            console.log('Email verified status updated successfully');
          }
        } catch (updateError) {
          console.error('Failed to update email_verified status:', updateError);
        }
      }
      
      setCreationProgress('Account created successfully!');
      setAccountCreated(true);
      
      // Show success message for 2 seconds
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Close modal and navigate
      setShowCreatingModal(false);
      await new Promise(resolve => setTimeout(resolve, 300));
      
      haptics.success();
      
      // Navigate to success screen
      router.push({
        pathname: '/onboarding/success',
        params: {
          firstName,
          lastName,
          email,
          registrationComplete: 'true'
        }
      });
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create account';
      console.error('Registration error:', errorMessage);
      
      setCreationError(errorMessage);
      setCreationProgress('');
      haptics.error();
      
      // Don't close modal on error, let user retry or close manually
    } finally {
      setIsCreatingAccount(false);
    }
  };

  const handleRetryAccountCreation = () => {
    setCreationError(null);
    setCreationProgress('');
    createAccount();
  };

  const handleCancelAccountCreation = () => {
    setShowCreatingModal(false);
    setCreationError(null);
    setCreationProgress('');
    setIsCreatingAccount(false);
  };

  const handleReferralCodeChange = (text: string) => {
    setReferralCode(text.toUpperCase());
    setError(null);
    setValidReferrer(null);
  };

  const styles = createStyles(colors);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <OnboardingProgress currentStep={7} totalSteps={8} />
      
      <KeyboardAvoidingWrapper>
        <View style={styles.content}>
          <View style={styles.header}>
            <Pressable
              onPress={() => {
                if (!isCreatingAccount) {
                  haptics.lightImpact();
                  router.back();
                }
              }}
              style={[styles.backButton, isCreatingAccount && styles.disabledButton]}
              disabled={isCreatingAccount}
            >
              <ArrowLeft size={24} color={isCreatingAccount ? colors.textTertiary : colors.text} />
            </Pressable>
          </View>

          <View style={styles.mainContent}>
            <View style={styles.iconContainer}>
              <Gift size={48} color={colors.primary} />
            </View>
            
            <Text style={styles.title}>Referral Code</Text>
            <Text style={styles.subtitle}>
              Enter a referral code if you have one, or skip to continue
            </Text>

            <View style={styles.inputContainer}>
              <TextInput
                ref={referralInputRef}
                style={styles.input}
                value={referralCode}
                onChangeText={handleReferralCodeChange}
                placeholder="Enter referral code"
                placeholderTextColor={colors.textTertiary}
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={8}
                returnKeyType="done"
                onSubmitEditing={handleContinue}
                editable={!isValidating && !isCreatingAccount}
              />
              
              {isValidating && (
                <View style={styles.validationIndicator}>
                  <Text style={styles.validationText}>Validating...</Text>
                </View>
              )}
              
              {validReferrer && !isValidating && (
                <View style={styles.validIndicator}>
                  <CheckCircle size={20} color={colors.success} />
                  <Text style={styles.validText}>Valid: {validReferrer.name}</Text>
                </View>
              )}
              
              {error && !isValidating && (
                <View style={styles.errorIndicator}>
                  <X size={20} color={colors.error} />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}
            </View>

            <Pressable 
              onPress={handleSkip} 
              style={[styles.skipButton, isCreatingAccount && styles.disabledButton]}
              disabled={isCreatingAccount}
            >
              <Text style={[styles.skipText, isCreatingAccount && styles.disabledText]}>
                Skip for now
              </Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingWrapper>

      <View style={styles.footer}>
        <FloatingButton
          title="Continue"
          onPress={handleContinue}
          disabled={isCreatingAccount}
          hapticType="medium"
        />
      </View>
      
      {/* Creating Account Modal - FORCED TO STAY VISIBLE */}
      <Modal
        visible={showCreatingModal}
        transparent={true}
        animationType="fade"
        presentationStyle="overFullScreen"
        onRequestClose={() => {
          // FORCE MODAL TO STAY OPEN DURING ACCOUNT CREATION
          if (creationError && !creationProgress && !isCreatingAccount) {
            handleCancelAccountCreation();
          }
          // Block all other close attempts
          return false;
        }}
      >
        <View style={[styles.modalOverlay, { zIndex: 9999 }]}>
          <View style={styles.modalContent}>
            <PlanmoniLoader size="medium" />
            
            {creationProgress && (
              <Text style={styles.progressText}>{creationProgress}</Text>
            )}
            
            {creationError && !isCreatingAccount && (
              <View style={styles.modalErrorContainer}>
                <Text style={styles.modalErrorText}>{creationError}</Text>
                <View style={styles.modalButtonContainer}>
                  <Pressable 
                    style={styles.retryButton}
                    onPress={handleRetryAccountCreation}
                  >
                    <Text style={styles.retryButtonText}>Try Again</Text>
                  </Pressable>
                  <Pressable 
                    style={styles.cancelButton}
                    onPress={handleCancelAccountCreation}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </Pressable>
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
  },
  backButton: {
    padding: 8,
    borderRadius: 8,
  },
  disabledButton: {
    opacity: 0.5,
  },
  mainContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 16,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 48,
    lineHeight: 24,
    paddingHorizontal: 20,
  },
  inputContainer: {
    width: '100%',
    marginBottom: 32,
  },
  input: {
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 18,
    color: colors.text,
    backgroundColor: colors.surface,
    textAlign: 'center',
    letterSpacing: 2,
    fontWeight: '600',
  },
  validationIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  validationText: {
    color: colors.textSecondary,
    fontSize: 14,
    marginLeft: 8,
  },
  validIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  validText: {
    color: colors.success,
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  errorIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  errorText: {
    color: colors.error,
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  skipButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 20,
  },
  skipText: {
    fontSize: 16,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  disabledText: {
    color: colors.textTertiary,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    minWidth: 280,
    maxWidth: '90%',
  },
  progressText: {
    fontSize: 16,
    color: colors.text,
    marginTop: 16,
    textAlign: 'center',
  },
  modalErrorContainer: {
    marginTop: 16,
    alignItems: 'center',
  },
  modalErrorText: {
    fontSize: 14,
    color: colors.error,
    textAlign: 'center',
    marginBottom: 16,
  },
  modalButtonContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  retryButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  cancelButton: {
    backgroundColor: colors.backgroundTertiary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  cancelButtonText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
});