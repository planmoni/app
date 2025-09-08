import { View, Text, StyleSheet, Pressable } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useState, useEffect, useRef } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { useToast } from '@/contexts/ToastContext';
import { useAuth } from '@/contexts/AuthContext';
import { useHaptics } from '@/hooks/useHaptics';
import PlanmoniLoader from '@/components/PlanmoniLoader';
import { accountCreationHandler } from '@/scripts/account-creation-handler';
import { Platform } from 'react-native';
import AccountCreationSuccessModal from '@/components/AccountCreationSuccessModal';

export default function CreatingAccountScreen() {
  const { colors } = useTheme();
  const { showToast } = useToast();
  const { signUp } = useAuth();
  const haptics = useHaptics();
  const params = useLocalSearchParams();
  
  const firstName = params.firstName as string;
  const lastName = params.lastName as string;
  const email = params.email as string;
  const password = params.password as string;
  const emailVerified = params.emailVerified === 'true';
  const referralCode = params.referralCode as string | undefined;
  
  const [creationProgress, setCreationProgress] = useState('');
  const [creationError, setCreationError] = useState<string | null>(null);
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [showRetryOptions, setShowRetryOptions] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  
  // Use ref to prevent multiple simultaneous calls
  const isCreatingRef = useRef(false);

  useEffect(() => {
    // Start account creation immediately when component mounts
    createAccount();
  }, []);

  const createAccount = async () => {
    // Prevent multiple simultaneous calls
    if (isCreatingRef.current || isCreatingAccount) {
      console.log('Account creation already in progress, skipping...');
      return;
    }
    
    try {
      isCreatingRef.current = true;
      setIsCreatingAccount(true);
      setCreationError(null);
      setShowRetryOptions(false);
      
      if (Platform.OS !== 'web') {
        haptics.mediumImpact();
      }
      
      console.log('Starting user registration with:', { 
        email, 
        firstName, 
        lastName
      });
      
      // Add initial delay to show the modal properly
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // Use the account creation handler
      const result = await accountCreationHandler.createAccount({
        email,
        password,
        firstName,
        lastName,
        referralCode,
        onProgress: (progress: string) => {
          setCreationProgress(progress);
          console.log('Account creation progress:', progress);
        },
        onError: (error: any) => {
          console.error('Account creation error:', error);
          setCreationError(error.message || 'Failed to create account');
          setCreationProgress('');
          if (Platform.OS !== 'web') {
            haptics.error();
          }
        },
        onSuccess: (data: any) => {
          console.log('Account creation successful:', data);
          setCreationProgress('Account created successfully!');
          
          // Show success modal after 5 seconds
          setTimeout(() => {
            if (Platform.OS !== 'web') {
              haptics.success();
            }
            setShowSuccessModal(true);
          }, 5000);
        }
      });
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to create account');
      }
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create account';
      console.error('Registration error:', errorMessage);
      
      setCreationError(errorMessage);
      setCreationProgress('');
      setShowRetryOptions(true);
      setRetryCount(prev => prev + 1);
      
      if (Platform.OS !== 'web') {
        haptics.error();
      }
    } finally {
      setIsCreatingAccount(false);
      isCreatingRef.current = false;
    }
  };

  const handleRetryAccountCreation = () => {
    if (Platform.OS !== 'web') {
      haptics.lightImpact();
    }
    setCreationError(null);
    setCreationProgress('');
    setShowRetryOptions(false);
    createAccount();
  };

  const handleCancelAccountCreation = () => {
    if (Platform.OS !== 'web') {
      haptics.lightImpact();
    }
    
    // Reset the handler state
    accountCreationHandler.reset();
    
    // Navigate back
    router.back();
  };

  const handleGoToLogin = () => {
    if (Platform.OS !== 'web') {
      haptics.lightImpact();
    }
    
    // Reset the handler state
    accountCreationHandler.reset();
    
    // Navigate to login
    router.push('/login');
  };

  const handleStartVerification = () => {
    setShowSuccessModal(false);
    router.push('/kyc-upgrade');
  };

  const handleGoToDashboard = () => {
    setShowSuccessModal(false);
    router.push('/(tabs)');
  };

  const styles = createStyles(colors);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.content}>
        <PlanmoniLoader 
          size="medium" 
          description={isCreatingAccount ? "Creating your account..." : "Processing..."}
        />
        
        {creationProgress && (
          <Text style={styles.progressText}>{creationProgress}</Text>
        )}
        
        {retryCount > 0 && !creationError && (
          <Text style={styles.retryText}>
            Attempt {retryCount + 1} of 3
          </Text>
        )}
        
        {creationError && showRetryOptions && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorTitle}>Account Creation Failed</Text>
            <Text style={styles.errorText}>{creationError}</Text>
            
            <View style={styles.buttonContainer}>
              <Pressable 
                style={styles.retryButton}
                onPress={handleRetryAccountCreation}
                disabled={isCreatingAccount}
              >
                <Text style={styles.retryButtonText}>
                  {isCreatingAccount ? 'Retrying...' : 'Try Again'}
                </Text>
              </Pressable>
              
              <Pressable 
                style={styles.secondaryButton}
                onPress={handleGoToLogin}
                disabled={isCreatingAccount}
              >
                <Text style={styles.secondaryButtonText}>Sign In Instead</Text>
              </Pressable>
              
              <Pressable 
                style={styles.cancelButton}
                onPress={handleCancelAccountCreation}
                disabled={isCreatingAccount}
              >
                <Text style={styles.cancelButtonText}>Go Back</Text>
              </Pressable>
            </View>
          </View>
        )}
        
        {!creationError && !isCreatingAccount && !creationProgress && (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Preparing your account...</Text>
          </View>
        )}
      </View>

      <AccountCreationSuccessModal
        isVisible={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        firstName={firstName}
        lastName={lastName}
        email={email}
        onStartVerification={handleStartVerification}
        onGoToDashboard={handleGoToDashboard}
      />
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
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  progressText: {
    fontSize: 16,
    color: colors.text,
    marginTop: 24,
    textAlign: 'center',
    fontWeight: '500',
  },
  retryText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 8,
    textAlign: 'center',
  },
  loadingContainer: {
    marginTop: 24,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  errorContainer: {
    marginTop: 24,
    alignItems: 'center',
    backgroundColor: colors.errorLight,
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.error,
    width: '100%',
    maxWidth: 400,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.error,
    marginBottom: 8,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 14,
    color: colors.error,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  buttonContainer: {
    width: '100%',
    gap: 12,
  },
  retryButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: colors.backgroundTertiary,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryButtonText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    backgroundColor: 'transparent',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: colors.textSecondary,
    fontSize: 16,
    fontWeight: '500',
  },
});
