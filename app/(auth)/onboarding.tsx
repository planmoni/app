import { View, Text, StyleSheet, TextInput, Pressable, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { useState, useRef, useEffect } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { Eye, EyeOff, Mail, Lock, User, ArrowRight, Check, Info, CreditCard, Fingerprint, ArrowLeft } from 'lucide-react-native';
import Button from '@/components/Button';
import { useAuth } from '@/contexts/AuthContext';
import KeyboardAvoidingWrapper from '@/components/KeyboardAvoidingWrapper';
import PinInput from '@/components/PinInput';
import SuccessAnimation from '@/components/SuccessAnimation';

type Step = 
  | 'firstName'
  | 'lastName'
  | 'email'
  | 'otp'
  | 'createPassword'
  | 'confirmPassword'
  | 'bvn'
  | 'appLock'
  | 'success';

export default function OnboardingScreen() {
  const { colors } = useTheme();
  const { signUp } = useAuth();
  const scrollViewRef = useRef<ScrollView>(null);
  
  // Form state
  const [currentStep, setCurrentStep] = useState<Step>('firstName');
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    otp: ['', '', '', ''],
    password: '',
    confirmPassword: '',
    bvn: '',
    pin: '',
    pinLength: 4 as 4 | 6,
  });
  
  // UI state
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [timeLeft, setTimeLeft] = useState(60);
  const [isLoading, setIsLoading] = useState(false);
  
  // Refs for OTP inputs
  const otpInputRefs = useRef<Array<TextInput | null>>([null, null, null, null]);

  // Timer for OTP resend
  useEffect(() => {
    if (currentStep === 'otp' && timeLeft > 0) {
      const timer = setInterval(() => {
        setTimeLeft(prevTime => prevTime - 1);
      }, 1000);
      
      return () => clearInterval(timer);
    }
  }, [currentStep, timeLeft]);

  // Scroll to top when step changes
  useEffect(() => {
    scrollViewRef.current?.scrollTo({ y: 0, animated: true });
  }, [currentStep]);

  // Update form data
  const updateFormData = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (error) setError(null);
  };

  // Handle OTP input
  const handleOtpChange = (text: string, index: number) => {
    if (error) setError(null);
    
    // Allow only numbers
    if (!/^\d*$/.test(text)) return;
    
    const newOtp = [...formData.otp];
    newOtp[index] = text;
    updateFormData('otp', newOtp);
    
    // Auto-focus next input
    if (text && index < 3) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyPress = (e: any, index: number) => {
    // Handle backspace
    if (e.nativeEvent.key === 'Backspace' && !formData.otp[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  // Handle resend OTP
  const handleResendCode = () => {
    setTimeLeft(60);
    // Implement resend logic here
  };

  // Get password strength
  const getPasswordStrength = () => {
    const password = formData.password;
    if (password.length === 0) return { strength: 0, label: '' };
    if (password.length < 6) return { strength: 1, label: 'Weak' };
    if (password.length < 8) return { strength: 2, label: 'Fair' };
    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) return { strength: 2, label: 'Fair' };
    return { strength: 3, label: 'Strong' };
  };

  const passwordStrength = getPasswordStrength();

  // Validate current step
  const validateCurrentStep = (): boolean => {
    switch (currentStep) {
      case 'firstName':
        if (!formData.firstName.trim()) {
          setError('Please enter your first name');
          return false;
        }
        break;
        
      case 'lastName':
        if (!formData.lastName.trim()) {
          setError('Please enter your last name');
          return false;
        }
        break;
        
      case 'email':
        if (!formData.email.trim()) {
          setError('Please enter your email address');
          return false;
        }
        
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(formData.email)) {
          setError('Please enter a valid email address');
          return false;
        }
        break;
        
      case 'otp':
        if (formData.otp.some(digit => !digit)) {
          setError('Please enter the complete verification code');
          return false;
        }
        break;
        
      case 'createPassword':
        if (!formData.password) {
          setError('Please enter a password');
          return false;
        }
        
        if (formData.password.length < 8) {
          setError('Password must be at least 8 characters long');
          return false;
        }
        
        if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(formData.password)) {
          setError('Password must contain uppercase, lowercase, and number');
          return false;
        }
        break;
        
      case 'confirmPassword':
        if (!formData.confirmPassword) {
          setError('Please confirm your password');
          return false;
        }
        
        if (formData.confirmPassword !== formData.password) {
          setError('Passwords do not match');
          return false;
        }
        break;
        
      case 'bvn':
        if (formData.bvn && formData.bvn.length !== 11) {
          setError('BVN must be 11 digits');
          return false;
        }
        break;
        
      case 'appLock':
        if (formData.pin.length !== formData.pinLength) {
          setError(`Please enter a ${formData.pinLength}-digit PIN`);
          return false;
        }
        break;
    }
    
    return true;
  };

  // Navigate to next step
  const goToNextStep = () => {
    if (!validateCurrentStep()) return;
    
    const steps: Step[] = [
      'firstName',
      'lastName',
      'email',
      'otp',
      'createPassword',
      'confirmPassword',
      'bvn',
      'appLock',
      'success'
    ];
    
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex < steps.length - 1) {
      setCurrentStep(steps[currentIndex + 1]);
    }
  };

  // Handle skip for optional steps
  const handleSkip = () => {
    if (currentStep === 'bvn') {
      setCurrentStep('appLock');
    }
  };

  // Handle final submission
  const handleSubmit = async () => {
    setIsLoading(true);
    
    try {
      // In a real app, you would register the user here
      await signUp(
        formData.email,
        formData.password,
        formData.firstName,
        formData.lastName
      );
      
      // Navigate to success
      setCurrentStep('success');
    } catch (error) {
      setError('Failed to create account. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle actions after success
  const handleCreatePayout = () => {
    router.replace('/create-payout/amount');
  };

  const handleGoToDashboard = () => {
    router.replace('/(tabs)');
  };

  // Render step content
  const renderStepContent = () => {
    switch (currentStep) {
      case 'firstName':
        return (
          <>
            <View style={styles.header}>
              <Text style={styles.title}>What's your first name?</Text>
              <Text style={styles.subtitle}>We'll use this to personalize your experience</Text>
            </View>

            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder="Enter your first name"
                placeholderTextColor={colors.textTertiary}
                value={formData.firstName}
                onChangeText={(text) => updateFormData('firstName', text)}
                autoFocus
                autoCapitalize="words"
                returnKeyType="next"
                onSubmitEditing={goToNextStep}
              />
            </View>
          </>
        );
        
      case 'lastName':
        return (
          <>
            <View style={styles.header}>
              <Text style={styles.title}>What's your last name?</Text>
              <Text style={styles.subtitle}>We'll use this to personalize your experience</Text>
            </View>

            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder="Enter your last name"
                placeholderTextColor={colors.textTertiary}
                value={formData.lastName}
                onChangeText={(text) => updateFormData('lastName', text)}
                autoFocus
                autoCapitalize="words"
                returnKeyType="next"
                onSubmitEditing={goToNextStep}
              />
            </View>
          </>
        );
        
      case 'email':
        return (
          <>
            <View style={styles.header}>
              <Text style={styles.title}>What's your email address?</Text>
              <Text style={styles.subtitle}>We'll send you a verification code</Text>
            </View>

            <View style={styles.inputContainer}>
              <View style={styles.inputWrapper}>
                <Mail size={20} color={colors.textSecondary} style={styles.icon} />
                <TextInput
                  style={styles.input}
                  placeholder="Enter your email address"
                  placeholderTextColor={colors.textTertiary}
                  value={formData.email}
                  onChangeText={(text) => updateFormData('email', text)}
                  autoFocus
                  autoCapitalize="none"
                  keyboardType="email-address"
                  returnKeyType="next"
                  onSubmitEditing={goToNextStep}
                />
              </View>
            </View>
          </>
        );
        
      case 'otp':
        return (
          <>
            <View style={styles.header}>
              <Text style={styles.title}>Enter the verification code</Text>
              <Text style={styles.subtitle}>
                We've sent a 4-digit code to {formData.email}
              </Text>
            </View>

            <View style={styles.otpContainer}>
              {formData.otp.map((digit, index) => (
                <TextInput
                  key={index}
                  ref={(ref) => (otpInputRefs.current[index] = ref)}
                  style={styles.otpInput}
                  value={digit}
                  onChangeText={(text) => handleOtpChange(text, index)}
                  onKeyPress={(e) => handleOtpKeyPress(e, index)}
                  keyboardType="number-pad"
                  maxLength={1}
                  autoFocus={index === 0}
                  selectTextOnFocus
                />
              ))}
            </View>

            <View style={styles.resendContainer}>
              {timeLeft > 0 ? (
                <Text style={styles.resendText}>
                  Resend code in {timeLeft} seconds
                </Text>
              ) : (
                <Pressable onPress={handleResendCode}>
                  <Text style={styles.resendLink}>Resend verification code</Text>
                </Pressable>
              )}
            </View>
          </>
        );
        
      case 'createPassword':
        return (
          <>
            <View style={styles.header}>
              <Text style={styles.title}>Create a password</Text>
              <Text style={styles.subtitle}>Make sure it's secure and easy to remember</Text>
            </View>

            <View style={styles.inputContainer}>
              <View style={styles.inputWrapper}>
                <Lock size={20} color={colors.textSecondary} style={styles.icon} />
                <TextInput
                  style={styles.input}
                  placeholder="Enter your password"
                  placeholderTextColor={colors.textTertiary}
                  value={formData.password}
                  onChangeText={(text) => updateFormData('password', text)}
                  secureTextEntry={!showPassword}
                  autoFocus
                  returnKeyType="next"
                  onSubmitEditing={goToNextStep}
                />
                <Pressable
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.eyeButton}
                >
                  {showPassword ? (
                    <EyeOff size={20} color={colors.textSecondary} />
                  ) : (
                    <Eye size={20} color={colors.textSecondary} />
                  )}
                </Pressable>
              </View>
            </View>

            {formData.password.length > 0 && (
              <View style={styles.passwordStrength}>
                <View style={styles.strengthBar}>
                  <View 
                    style={[
                      styles.strengthFill,
                      { 
                        width: `${(passwordStrength.strength / 3) * 100}%`,
                        backgroundColor: passwordStrength.strength === 1 ? colors.error : 
                                       passwordStrength.strength === 2 ? colors.warning : colors.success
                      }
                    ]} 
                  />
                </View>
                <Text style={[
                  styles.strengthLabel,
                  { 
                    color: passwordStrength.strength === 1 ? colors.error : 
                           passwordStrength.strength === 2 ? colors.warning : colors.success
                  }
                ]}>
                  {passwordStrength.label}
                </Text>
              </View>
            )}

            <View style={styles.requirements}>
              <Text style={styles.requirementsTitle}>Password Requirements</Text>
              <View style={styles.requirementsList}>
                <Text style={[
                  styles.requirementItem,
                  formData.password.length >= 8 ? styles.requirementMet : null
                ]}>• At least 8 characters long</Text>
                <Text style={[
                  styles.requirementItem,
                  /[A-Z]/.test(formData.password) ? styles.requirementMet : null
                ]}>• Contains at least one uppercase letter</Text>
                <Text style={[
                  styles.requirementItem,
                  /[a-z]/.test(formData.password) ? styles.requirementMet : null
                ]}>• Contains at least one lowercase letter</Text>
                <Text style={[
                  styles.requirementItem,
                  /\d/.test(formData.password) ? styles.requirementMet : null
                ]}>• Contains at least one number</Text>
              </View>
            </View>
          </>
        );
        
      case 'confirmPassword':
        return (
          <>
            <View style={styles.header}>
              <Text style={styles.title}>Confirm your password</Text>
              <Text style={styles.subtitle}>Please re-enter your password to confirm</Text>
            </View>

            <View style={styles.inputContainer}>
              <View style={styles.inputWrapper}>
                <Lock size={20} color={colors.textSecondary} style={styles.icon} />
                <TextInput
                  style={styles.input}
                  placeholder="Confirm your password"
                  placeholderTextColor={colors.textTertiary}
                  value={formData.confirmPassword}
                  onChangeText={(text) => updateFormData('confirmPassword', text)}
                  secureTextEntry={!showConfirmPassword}
                  autoFocus
                  returnKeyType="next"
                  onSubmitEditing={goToNextStep}
                />
                <Pressable
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                  style={styles.eyeButton}
                >
                  {showConfirmPassword ? (
                    <EyeOff size={20} color={colors.textSecondary} />
                  ) : (
                    <Eye size={20} color={colors.textSecondary} />
                  )}
                </Pressable>
              </View>
            </View>
          </>
        );
        
      case 'bvn':
        return (
          <>
            <View style={styles.header}>
              <Text style={styles.title}>Enter your BVN</Text>
              <Text style={styles.subtitle}>Bank Verification Number (Optional)</Text>
            </View>

            <View style={styles.inputContainer}>
              <View style={styles.inputWrapper}>
                <CreditCard size={20} color={colors.textSecondary} style={styles.icon} />
                <TextInput
                  style={styles.input}
                  placeholder="Enter your 11-digit BVN"
                  placeholderTextColor={colors.textTertiary}
                  value={formData.bvn}
                  onChangeText={(text) => {
                    // Only allow numbers and limit to 11 digits
                    if (/^\d*$/.test(text) && text.length <= 11) {
                      updateFormData('bvn', text);
                    }
                  }}
                  keyboardType="number-pad"
                  autoFocus
                  returnKeyType="next"
                  onSubmitEditing={goToNextStep}
                />
              </View>
            </View>

            <View style={styles.infoContainer}>
              <Info size={20} color={colors.primary} style={styles.infoIcon} />
              <Text style={styles.infoText}>
                Your BVN helps us verify your identity and increases your transaction limits. We do not store your BVN after verification.
              </Text>
            </View>
          </>
        );
        
      case 'appLock':
        return (
          <>
            <View style={styles.header}>
              <Text style={styles.title}>Set up app lock</Text>
              <Text style={styles.subtitle}>Create a PIN to secure your account</Text>
            </View>

            <View style={styles.pinContainer}>
              <PinInput
                length={formData.pinLength}
                value={formData.pin}
                onChange={(value) => updateFormData('pin', value)}
                autoFocus
              />
            </View>

            <View style={styles.optionsContainer}>
              <Text style={styles.optionsTitle}>PIN Length</Text>
              <View style={styles.optionsButtons}>
                <Pressable
                  style={[
                    styles.optionButton,
                    formData.pinLength === 4 && styles.optionButtonActive
                  ]}
                  onPress={() => updateFormData('pinLength', 4)}
                >
                  <Text style={[
                    styles.optionButtonText,
                    formData.pinLength === 4 && styles.optionButtonTextActive
                  ]}>4 Digits</Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.optionButton,
                    formData.pinLength === 6 && styles.optionButtonActive
                  ]}
                  onPress={() => updateFormData('pinLength', 6)}
                >
                  <Text style={[
                    styles.optionButtonText,
                    formData.pinLength === 6 && styles.optionButtonTextActive
                  ]}>6 Digits</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.biometricsContainer}>
              <View style={styles.biometricsHeader}>
                <Fingerprint size={24} color={colors.primary} />
                <Text style={styles.biometricsTitle}>Enable Biometric Authentication</Text>
              </View>
              <Text style={styles.biometricsDescription}>
                Use your fingerprint or face recognition to quickly access your account
              </Text>
              <Pressable style={styles.biometricsButton}>
                <Text style={styles.biometricsButtonText}>Enable Biometrics</Text>
              </Pressable>
            </View>
          </>
        );
        
      case 'success':
        return (
          <View style={styles.successContainer}>
            <SuccessAnimation />
            
            <Text style={styles.successTitle}>Account Created Successfully!</Text>
            <Text style={styles.successSubtitle}>
              Welcome to Planmoni, {formData.firstName}! Your account has been set up and is ready to use.
            </Text>
            
            <View style={styles.card}>
              <Text style={styles.cardTitle}>What's Next?</Text>
              <Text style={styles.cardText}>
                Start planning your finances by creating your first payout plan or explore your dashboard to see all features.
              </Text>
            </View>

            <View style={styles.successButtons}>
              <Button
                title="Create a Payout Plan"
                onPress={handleCreatePayout}
                style={styles.createButton}
              />
              <Button
                title="Go to Dashboard"
                onPress={handleGoToDashboard}
                variant="outline"
                style={styles.dashboardButton}
              />
            </View>
          </View>
        );
    }
  };

  // Get step number for progress
  const getStepNumber = () => {
    const steps: Step[] = [
      'firstName',
      'lastName',
      'email',
      'otp',
      'createPassword',
      'confirmPassword',
      'bvn',
      'appLock',
      'success'
    ];
    
    return steps.indexOf(currentStep) + 1;
  };

  // Calculate progress percentage
  const progressPercentage = (getStepNumber() / 8) * 100;

  const styles = createStyles(colors);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {currentStep !== 'success' && (
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View 
              style={[
                styles.progressFill, 
                { width: `${progressPercentage}%` }
              ]} 
            />
          </View>
        </View>
      )}
      
      {currentStep !== 'firstName' && currentStep !== 'success' && (
        <Pressable 
          style={styles.backButton}
          onPress={() => {
            const steps: Step[] = [
              'firstName',
              'lastName',
              'email',
              'otp',
              'createPassword',
              'confirmPassword',
              'bvn',
              'appLock',
              'success'
            ];
            
            const currentIndex = steps.indexOf(currentStep);
            if (currentIndex > 0) {
              setCurrentStep(steps[currentIndex - 1]);
            }
          }}
        >
          <ArrowLeft size={24} color={colors.text} />
        </Pressable>
      )}
      
      <KeyboardAvoidingWrapper disableDismissKeyboard={true} contentContainerStyle={styles.scrollContent}>
        <ScrollView 
          ref={scrollViewRef}
          style={styles.scrollView}
          contentContainerStyle={styles.scrollViewContent}
          keyboardShouldPersistTaps="handled"
        >
          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}
          
          {renderStepContent()}
        </ScrollView>
      </KeyboardAvoidingWrapper>

      {currentStep !== 'success' && (
        <View style={styles.footer}>
          {currentStep === 'bvn' ? (
            <>
              <Button
                title="Continue"
                onPress={currentStep === 'appLock' ? handleSubmit : goToNextStep}
                isLoading={isLoading}
                disabled={
                  (currentStep === 'bvn' && formData.bvn.length > 0 && formData.bvn.length !== 11) ||
                  (currentStep === 'appLock' && formData.pin.length !== formData.pinLength)
                }
                style={styles.continueButton}
              />
              <Pressable onPress={handleSkip} style={styles.skipButton}>
                <Text style={styles.skipText}>Skip for now</Text>
              </Pressable>
            </>
          ) : (
            <Button
              title={currentStep === 'appLock' ? "Create Account" : "Continue"}
              onPress={currentStep === 'appLock' ? handleSubmit : goToNextStep}
              isLoading={isLoading}
              disabled={
                (currentStep === 'firstName' && !formData.firstName.trim()) ||
                (currentStep === 'lastName' && !formData.lastName.trim()) ||
                (currentStep === 'email' && !formData.email.trim()) ||
                (currentStep === 'otp' && formData.otp.some(digit => !digit)) ||
                (currentStep === 'createPassword' && !formData.password) ||
                (currentStep === 'confirmPassword' && !formData.confirmPassword) ||
                (currentStep === 'appLock' && formData.pin.length !== formData.pinLength)
              }
              style={styles.continueButton}
            />
          )}
        </View>
      )}
    </SafeAreaView>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  progressContainer: {
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  progressBar: {
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 2,
  },
  backButton: {
    position: 'absolute',
    top: 16,
    left: 16,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.backgroundTertiary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  scrollViewContent: {
    flexGrow: 1,
    padding: 24,
    paddingTop: 40,
  },
  errorContainer: {
    backgroundColor: colors.errorLight,
    borderWidth: 1,
    borderColor: colors.error,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: colors.error,
    fontSize: 14,
  },
  header: {
    marginBottom: 32,
    alignItems: 'flex-start',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
    textAlign: 'left',
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'left',
  },
  inputContainer: {
    marginBottom: 24,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 16,
    backgroundColor: colors.surface,
  },
  icon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 18,
    color: colors.text,
  },
  eyeButton: {
    padding: 4,
  },
  passwordStrength: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  strengthBar: {
    flex: 1,
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    marginRight: 12,
  },
  strengthFill: {
    height: '100%',
    borderRadius: 2,
  },
  strengthLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  requirements: {
    backgroundColor: colors.backgroundTertiary,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  requirementsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
  },
  requirementsList: {
    gap: 8,
  },
  requirementItem: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  requirementMet: {
    color: colors.success,
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 32,
  },
  otpInput: {
    width: 64,
    height: 64,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    fontSize: 24,
    fontWeight: '600',
    textAlign: 'center',
    color: colors.text,
    backgroundColor: colors.surface,
  },
  resendContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  resendText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  resendLink: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600',
  },
  infoContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: colors.backgroundTertiary,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  infoIcon: {
    marginTop: 2,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  pinContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  optionsContainer: {
    marginBottom: 32,
  },
  optionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
  },
  optionsButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  optionButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
  },
  optionButtonActive: {
    borderColor: colors.primary,
    backgroundColor: colors.backgroundTertiary,
  },
  optionButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  optionButtonTextActive: {
    color: colors.primary,
  },
  biometricsContainer: {
    backgroundColor: colors.backgroundTertiary,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  biometricsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  biometricsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  biometricsDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 16,
    lineHeight: 20,
  },
  biometricsButton: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  biometricsButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  footer: {
    padding: 24,
    paddingBottom: 40,
  },
  continueButton: {
    backgroundColor: colors.primary,
  },
  skipButton: {
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 8,
  },
  skipText: {
    fontSize: 16,
    color: colors.primary,
    fontWeight: '500',
  },
  successContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 16,
    textAlign: 'center',
  },
  successSubtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  card: {
    backgroundColor: colors.backgroundTertiary,
    borderRadius: 16,
    padding: 24,
    width: '100%',
    marginBottom: 32,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
  },
  cardText: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  successButtons: {
    width: '100%',
    gap: 16,
  },
  createButton: {
    backgroundColor: colors.primary,
  },
  dashboardButton: {
    borderColor: colors.border,
  },
});