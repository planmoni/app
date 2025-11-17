import React, { useState, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, ActivityIndicator, Modal, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Fingerprint, Shield, User, X, CheckCircle } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useToast } from '@/contexts/ToastContext';
import KeyboardAvoidingWrapper from '@/components/KeyboardAvoidingWrapper';
import FloatingButton from '@/components/FloatingButton';
import { useHaptics } from '@/hooks/useHaptics';

type Step = 'bvn' | 'nin' | 'otp' | 'success';

export default function KycTierOne() {
  const { colors, isDark } = useTheme();
  const { width, height } = useWindowDimensions();
  const { showToast } = useToast();
  const haptics = useHaptics();
  const isSmallScreen = width < 380 || height < 700;

  const [step, setStep] = useState<Step>('bvn');
  const [bvn, setBvn] = useState('');
  const [nin, setNin] = useState('');
  const [phoneNumber, setPhoneNumber] = useState(''); // This will be fetched from NIN
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [timer, setTimer] = useState(60);
  const [isResending, setIsResending] = useState(false);

  const bvnInputRef = useRef<TextInput>(null);
  const ninInputRef = useRef<TextInput>(null);
  const otpInputRefs = useRef<(TextInput | null)[]>([]);

  const setOtpInputRef = useCallback((el: TextInput | null, index: number) => {
    otpInputRefs.current[index] = el;
  }, []);

  // OTP Timer
  React.useEffect(() => {
    if (step === 'otp' && timer > 0) {
      const interval = setInterval(() => {
        setTimer((prev) => (prev <= 1 ? 0 : prev - 1));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [step, timer]);

  const handleBvnContinue = () => {
    const newErrors: Record<string, string> = {};

    if (!bvn.trim()) {
      newErrors.bvn = 'BVN is required';
    } else if (bvn.length !== 11) {
      newErrors.bvn = 'BVN must be 11 digits';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      showToast('Please enter a valid BVN', 'error');
      return;
    }

    setErrors({});
    setIsLoading(true);
    
    // Simulate API call to verify BVN
    setTimeout(() => {
      setIsLoading(false);
      setStep('nin');
      haptics.mediumImpact();
    }, 1500);
  };

  const handleNinContinue = () => {
    const newErrors: Record<string, string> = {};

    if (!nin.trim()) {
      newErrors.nin = 'NIN is required';
    } else if (nin.length !== 11) {
      newErrors.nin = 'NIN must be 11 digits';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      showToast('Please enter a valid NIN', 'error');
      return;
    }

    setErrors({});
    setIsLoading(true);
    
    // Simulate API call to verify NIN and get linked phone number
    // In real implementation, this would fetch the phone number from NIN
    setTimeout(() => {
      setIsLoading(false);
      // Simulated phone number from NIN (in real app, this comes from API)
      setPhoneNumber('09012345678');
      setStep('otp');
      setTimer(60);
      setTimeout(() => {
        otpInputRefs.current[0]?.focus();
      }, 300);
    }, 1500);
  };

  const handleOtpChange = (text: string, index: number) => {
    if (text.length > 1) {
      text = text[text.length - 1];
    }

    const newOtp = [...otp];
    newOtp[index] = text.replace(/[^0-9]/g, '');
    setOtp(newOtp);
    setErrors({});

    if (text !== '' && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }

    if (index === 5 && text !== '' && newOtp.every(digit => digit !== '')) {
      setTimeout(() => {
        handleOtpVerify();
      }, 300);
    }
  };

  const handleOtpKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && index > 0 && otp[index] === '') {
      otpInputRefs.current[index - 1]?.focus();
      const newOtp = [...otp];
      newOtp[index - 1] = '';
      setOtp(newOtp);
    }
  };

  const handleOtpVerify = () => {
    const otpString = otp.join('');
    if (otpString.length !== 6) {
      showToast('Please enter complete OTP', 'error');
      return;
    }

    setIsLoading(true);
    
    // Simulate OTP verification
    setTimeout(() => {
      setIsLoading(false);
      setStep('success');
      haptics.success();
    }, 1500);
  };

  const handleResendOtp = () => {
    setIsResending(true);
    setTimer(60);
    
    setTimeout(() => {
      setIsResending(false);
      showToast('OTP resent successfully', 'success');
    }, 1000);
  };

  const handleAddFunds = () => {
    haptics.mediumImpact();
    router.push('/add-funds');
  };

  const handleDone = () => {
    haptics.mediumImpact();
    router.back();
  };

  const renderBvnScreen = () => {
    return (
      <View style={styles.formContainer}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>BVN Verification</Text>
        <Text style={[styles.sectionDescription, { color: colors.textSecondary }]}>
          Enter your Bank Verification Number (BVN) to continue.
        </Text>

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.text }]}>BVN *</Text>
          <View style={[
            styles.inputContainer,
            bvn.trim() !== '' && styles.inputFilled,
            errors.bvn && styles.inputError,
            { borderColor: colors.border, backgroundColor: colors.background }
          ]}>
            <Fingerprint size={20} color={colors.textSecondary} style={{ marginRight: 12 }} />
            <TextInput
              ref={bvnInputRef}
              style={[styles.input, { color: colors.text }]}
              placeholder="Enter your 11-digit BVN"
              placeholderTextColor={colors.textTertiary}
              value={bvn}
              onChangeText={(text) => {
                const numeric = text.replace(/[^0-9]/g, '').slice(0, 11);
                setBvn(numeric);
                setErrors(prev => ({ ...prev, bvn: '' }));
              }}
              keyboardType="numeric"
              returnKeyType="done"
              onSubmitEditing={handleBvnContinue}
            />
          </View>
          {errors.bvn && <Text style={styles.errorText}>{errors.bvn}</Text>}
        </View>
      </View>
    );
  };

  const renderNinScreen = () => {
    return (
      <View style={styles.formContainer}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>NIN Verification</Text>
        <Text style={[styles.sectionDescription, { color: colors.textSecondary }]}>
          Enter your National Identification Number (NIN). An OTP will be sent to the phone number linked to your NIN.
        </Text>

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.text }]}>NIN *</Text>
          <View style={[
            styles.inputContainer,
            nin.trim() !== '' && styles.inputFilled,
            errors.nin && styles.inputError,
            { borderColor: colors.border, backgroundColor: colors.background }
          ]}>
            <User size={20} color={colors.textSecondary} style={{ marginRight: 12 }} />
            <TextInput
              ref={ninInputRef}
              style={[styles.input, { color: colors.text }]}
              placeholder="Enter your 11-digit NIN"
              placeholderTextColor={colors.textTertiary}
              value={nin}
              onChangeText={(text) => {
                const numeric = text.replace(/[^0-9]/g, '').slice(0, 11);
                setNin(numeric);
                setErrors(prev => ({ ...prev, nin: '' }));
              }}
              keyboardType="numeric"
              returnKeyType="done"
              onSubmitEditing={handleNinContinue}
            />
          </View>
          {errors.nin && <Text style={styles.errorText}>{errors.nin}</Text>}
        </View>
      </View>
    );
  };

  const renderOtpScreen = () => {
    return (
      <View style={styles.formContainer}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Verify OTP</Text>
        <Text style={[styles.sectionDescription, { color: colors.textSecondary }]}>
          Enter the 6-digit OTP sent to {phoneNumber || 'the phone number linked to your NIN'}
        </Text>

        <View style={styles.otpContainer}>
          {otp.map((digit, index) => (
            <TextInput
              key={index}
              ref={(el) => setOtpInputRef(el, index)}
              style={[
                styles.otpInput,
                { 
                  borderColor: digit ? colors.primary : colors.border,
                  backgroundColor: colors.surface,
                }
              ]}
              value={digit}
              onChangeText={(text) => handleOtpChange(text, index)}
              onKeyPress={(e) => handleOtpKeyPress(e, index)}
              keyboardType="numeric"
              maxLength={1}
              textAlign="center"
              selectTextOnFocus
            />
          ))}
        </View>

        {timer > 0 ? (
          <Text style={styles.timerText}>
            Resend OTP in {Math.floor(timer / 60)}:{(timer % 60).toString().padStart(2, '0')}
          </Text>
        ) : (
          <Pressable 
            style={styles.resendButton}
            onPress={handleResendOtp}
            disabled={isResending}
          >
            <Text style={[styles.resendText, { color: colors.primary }]}>
              {isResending ? 'Resending...' : 'Resend OTP'}
            </Text>
          </Pressable>
        )}
      </View>
    );
  };

  const renderSuccessScreen = () => {
    return (
      <View style={styles.successContainer}>
        <View style={[styles.successIcon, { backgroundColor: colors.success + '20' }]}>
          <CheckCircle size={64} color={colors.success} />
        </View>
        <Text style={[styles.successTitle, { color: colors.text }]}>Verification Successful!</Text>
        <Text style={[styles.successDescription, { color: colors.textSecondary }]}>
          Your BVN and NIN have been verified successfully.
          You can now start using Planmoni.
        </Text>
      </View>
    );
  };

  const renderCurrentStep = () => {
    switch (step) {
      case 'bvn':
        return renderBvnScreen();
      case 'nin':
        return renderNinScreen();
      case 'otp':
        return renderOtpScreen();
      case 'success':
        return renderSuccessScreen();
    }
  };

  const canProceed = () => {
    switch (step) {
      case 'bvn':
        return bvn.length === 11;
      case 'nin':
        return nin.length === 11;
      case 'otp':
        return otp.every(digit => digit !== '');
      case 'success':
        return true;
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (step === 'bvn') {
      handleBvnContinue();
    } else if (step === 'nin') {
      handleNinContinue();
    } else if (step === 'otp') {
      handleOtpVerify();
    } else if (step === 'success') {
      handleDone();
    }
  };

  const handlePrevious = () => {
    haptics.lightImpact();
    if (step === 'nin') setStep('bvn');
    else if (step === 'otp') setStep('nin');
  };

  const getButtonText = () => {
    switch (step) {
      case 'bvn':
        return 'Continue';
      case 'nin':
        return 'Continue';
      case 'otp':
        return 'Verify OTP';
      case 'success':
        return 'Done';
      default:
        return 'Continue';
    }
  };

  const headerPadding = isSmallScreen ? 12 : 16;
  const contentPadding = isSmallScreen ? 16 : 24;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[styles.header, { paddingHorizontal: headerPadding }]}>
        {step !== 'bvn' && step !== 'success' && (
          <Pressable onPress={handlePrevious} style={styles.backButton}>
            <ArrowLeft size={isSmallScreen ? 20 : 24} color={colors.text} />
          </Pressable>
        )}
        {step === 'bvn' && (
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft size={isSmallScreen ? 20 : 24} color={colors.text} />
          </Pressable>
        )}
        
        <View style={styles.headerTitleContainer}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Verify Identity</Text>
        </View>
        
        {step !== 'success' && (
          <Pressable onPress={() => router.back()} style={styles.closeButton}>
            <X size={isSmallScreen ? 20 : 24} color={colors.text} />
          </Pressable>
        )}
      </View>

      <KeyboardAvoidingWrapper contentContainerStyle={styles.scrollContent}>
        {renderCurrentStep()}
      </KeyboardAvoidingWrapper>

      {step !== 'success' && (
        <FloatingButton
          title={getButtonText()}
          onPress={handleNext}
          disabled={!canProceed() || isLoading}
          loading={isLoading}
        />
      )}

      {step === 'success' && (
        <View style={[styles.stickyButtonContainer, { paddingHorizontal: contentPadding }]}>
          <Pressable
            style={[styles.addFundsButton, { backgroundColor: colors.accent }]}
            onPress={handleAddFunds}
          >
            <Text style={[styles.addFundsButtonText, { color: colors.text }]}>Add funds</Text>
          </Pressable>
          <Pressable
            style={[styles.doneButton, { backgroundColor: colors.primary }]}
            onPress={handleDone}
          >
            <Text style={styles.doneButtonText}>Done</Text>
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    backgroundColor: 'transparent',
    position: 'relative',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
    zIndex: 1,
  },
  headerTitleContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 0,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
  },
  closeButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
    zIndex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  formContainer: {
    padding: 24,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 16,
    marginBottom: 24,
    lineHeight: 24,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    backgroundColor: 'transparent',
    paddingHorizontal: 14,
    height: 55,
  },
  inputFilled: {
    borderColor: '#10B981',
    backgroundColor: '#F0FDF4',
  },
  inputError: {
    borderColor: '#EF4444',
  },
  input: {
    flex: 1,
    fontSize: 18,
    marginLeft: 12,
  },
  errorText: {
    fontSize: 12,
    color: '#EF4444',
    marginTop: 4,
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 32,
    gap: 12,
  },
  otpInput: {
    flex: 1,
    height: 60,
    borderWidth: 2,
    borderRadius: 12,
    fontSize: 24,
    fontWeight: '600',
  },
  timerText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 16,
  },
  resendButton: {
    marginTop: 16,
    alignItems: 'center',
  },
  resendText: {
    fontSize: 16,
    fontWeight: '600',
  },
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  successIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 12,
    textAlign: 'center',
  },
  successDescription: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    color: '#6B7280',
    maxWidth: 320,
  },
  stickyButtonContainer: {
    paddingBottom: 16,
    paddingTop: 8,
    gap: 12,
  },
  addFundsButton: {
    height: 55,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  addFundsButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  doneButton: {
    height: 55,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 25,
  },
  doneButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

