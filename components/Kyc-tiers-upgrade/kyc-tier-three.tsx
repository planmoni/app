import React, { useState, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, Image, useWindowDimensions, Animated } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, X, Camera, Upload, CheckCircle, User } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useToast } from '@/contexts/ToastContext';
import KeyboardAvoidingWrapper from '@/components/KeyboardAvoidingWrapper';
import FloatingButton from '@/components/FloatingButton';
import { useHaptics } from '@/hooks/useHaptics';
import * as ImagePicker from 'expo-image-picker';

type Step = 'facial' | 'address' | 'success';

export default function KycTierThree() {
  const { colors, isDark } = useTheme();
  const { width, height } = useWindowDimensions();
  const { showToast } = useToast();
  const haptics = useHaptics();
  const isSmallScreen = width < 380 || height < 700;

  const [step, setStep] = useState<Step>('facial');
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [facialRecognitionComplete, setFacialRecognitionComplete] = useState(false);
  const [facialProgress, setFacialProgress] = useState(0);
  
  // Facial recognition animation
  const [isRecognizing, setIsRecognizing] = useState(false);
  const progressAnim = useRef(new Animated.Value(0)).current;
  
  // Proof of address
  const [proofOfAddressImage, setProofOfAddressImage] = useState<string | null>(null);

  const pickImage = async (setImageFunction: React.Dispatch<React.SetStateAction<string | null>>, type: string) => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        base64: true,
      });
      
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        if (asset.base64) {
          const imageData = `data:image/jpeg;base64,${asset.base64}`;
          setImageFunction(imageData);
          setErrors(prev => ({ ...prev, [type]: '' }));
          showToast('Image selected successfully', 'success');
        }
      }
    } catch (error) {
      console.error('Error picking image:', error);
      showToast('Failed to select image', 'error');
    }
  };

  const takePicture = async (type: 'address') => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    
    if (status !== 'granted') {
      showToast('Permission to access camera is required', 'error');
      return;
    }
    
    try {
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        base64: true,
      });
      
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        if (asset.base64) {
          const imageData = `data:image/jpeg;base64,${asset.base64}`;
          setProofOfAddressImage(imageData);
          setErrors(prev => ({ ...prev, address: '' }));
          showToast('Image captured successfully', 'success');
        }
      }
    } catch (error) {
      console.error('Error taking picture:', error);
      showToast('Failed to capture image', 'error');
    }
  };

  const startFacialRecognition = () => {
    setIsRecognizing(true);
    setFacialProgress(0);
    
    // Simulate facial recognition process with animation
    Animated.timing(progressAnim, {
      toValue: 1,
      duration: 3000,
      useNativeDriver: false,
    }).start();
    
    let progress = 0;
    const interval = setInterval(() => {
      progress += 10;
      setFacialProgress(progress);
      
      if (progress >= 100) {
        clearInterval(interval);
        setIsRecognizing(false);
        setFacialRecognitionComplete(true);
        haptics.success();
        showToast('Facial recognition completed', 'success');
      }
    }, 300);
  };

  const validateFacial = () => {
    if (!facialRecognitionComplete) {
      setErrors({ facial: 'Please complete facial recognition' });
      showToast('Please complete facial recognition', 'error');
      return false;
    }

    setErrors({});
    return true;
  };

  const validateAddress = () => {
    if (!proofOfAddressImage) {
      setErrors({ address: 'Proof of address is required' });
      showToast('Please upload proof of address', 'error');
      return false;
    }

    setErrors({});
    return true;
  };

  const handleNext = () => {
    haptics.mediumImpact();
    
    if (step === 'facial') {
      if (validateFacial()) {
        setStep('address');
      }
    } else if (step === 'address') {
      if (validateAddress()) {
        setIsLoading(true);
        setTimeout(() => {
          setIsLoading(false);
          setStep('success');
          haptics.success();
        }, 1500);
      }
    }
  };

  const handlePrevious = () => {
    haptics.lightImpact();
    if (step === 'address') setStep('facial');
  };

  const handleDone = () => {
    haptics.mediumImpact();
    router.back();
  };

  const renderFacialRecognition = () => {
    const progressWidth = progressAnim.interpolate({
      inputRange: [0, 1],
      outputRange: ['0%', '100%'],
    });

    return (
      <View style={styles.formContainer}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Facial Recognition</Text>
        <Text style={[styles.sectionDescription, { color: colors.textSecondary }]}>
          Please complete facial recognition for identity verification.
        </Text>

        <View style={styles.facialRecognitionContainer}>
          <View style={[styles.facialRecognitionCircle, { 
            backgroundColor: facialRecognitionComplete ? colors.success + '20' : colors.surface,
            borderColor: facialRecognitionComplete ? colors.success : colors.border 
          }]}>
            {facialRecognitionComplete ? (
              <CheckCircle size={64} color={colors.success} />
            ) : isRecognizing ? (
              <View style={styles.recognizingContainer}>
                <User size={48} color={colors.primary} />
                <Text style={[styles.recognizingText, { color: colors.primary }]}>
                  {facialProgress}%
                </Text>
              </View>
            ) : (
              <User size={64} color={colors.textSecondary} />
            )}
          </View>

          {isRecognizing && (
            <View style={[styles.progressBarContainer, { backgroundColor: colors.border }]}>
              <Animated.View 
                style={[
                  styles.progressBar, 
                  { 
                    width: progressWidth,
                    backgroundColor: colors.primary 
                  }
                ]} 
              />
            </View>
          )}

          {!facialRecognitionComplete && !isRecognizing && (
            <Pressable
              style={[styles.startButton, { backgroundColor: colors.primary }]}
              onPress={startFacialRecognition}
            >
              <Text style={styles.startButtonText}>Start Facial Recognition</Text>
            </Pressable>
          )}

          {facialRecognitionComplete && (
            <View style={[styles.successMessage, { backgroundColor: colors.success + '20' }]}>
              <Text style={[styles.successMessageText, { color: colors.success }]}>
                ✓ Facial recognition completed successfully
              </Text>
            </View>
          )}
        </View>

        <View style={[styles.infoContainer, { backgroundColor: colors.accentBackground }]}>
          <Camera size={20} color={colors.primary} />
          <Text style={[styles.infoText, { color: colors.textSecondary }]}>
            Ensure you are in a well-lit area and your face is clearly visible. Follow the on-screen instructions.
          </Text>
        </View>
      </View>
    );
  };

  const renderProofOfAddress = () => {
    return (
      <View style={styles.formContainer}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Proof of Address</Text>
        <Text style={[styles.sectionDescription, { color: colors.textSecondary }]}>
          Please upload a proof of address document (utility bill, bank statement, etc.).
        </Text>

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.text }]}>Proof of Address *</Text>
          <View style={styles.documentActions}>
            <Pressable style={[styles.documentButton, { backgroundColor: colors.primary }]} onPress={() => pickImage(setProofOfAddressImage, 'address')}>
              <Text style={styles.documentButtonText}>Upload Photo</Text>
            </Pressable>
            <Pressable style={[styles.documentButton, { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }]} onPress={() => takePicture('address')}>
              <Camera size={16} color={colors.text} />
              <Text style={[styles.documentButtonText, { color: colors.text }]}>Take Photo</Text>
            </Pressable>
          </View>
          <Pressable
            style={[styles.imageUploadContainer, errors.address && styles.inputError]}
            onPress={() => takePicture('address')}
          >
            {proofOfAddressImage ? (
              <Image source={{ uri: proofOfAddressImage }} style={styles.uploadedImage} />
            ) : (
              <View style={[styles.uploadPlaceholder, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Upload size={24} color={colors.textSecondary} />
                <Text style={[styles.uploadText, { color: colors.textSecondary }]}>Tap to upload document</Text>
              </View>
            )}
          </Pressable>
          {errors.address && <Text style={styles.errorText}>{errors.address}</Text>}
        </View>

        <View style={[styles.infoContainer, { backgroundColor: colors.accentBackground }]}>
          <Upload size={20} color={colors.primary} />
          <Text style={[styles.infoText, { color: colors.textSecondary }]}>
            Acceptable documents include utility bills, bank statements, tenancy agreements, or any official document showing your address.
          </Text>
        </View>
      </View>
    );
  };

  const renderSuccess = () => {
    return (
      <View style={styles.successContainer}>
        <View style={[styles.successIcon, { backgroundColor: colors.success + '20' }]}>
          <CheckCircle size={64} color={colors.success} />
        </View>
        <Text style={[styles.successTitle, { color: colors.text }]}>Verification Successful!</Text>
        <Text style={[styles.successDescription, { color: colors.textSecondary }]}>
          Your Tier 3 KYC verification has been completed successfully.
          You have now completed all KYC tiers.
        </Text>
      </View>
    );
  };

  const headerPadding = isSmallScreen ? 12 : 16;
  const contentPadding = isSmallScreen ? 16 : 24;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[styles.header, { paddingHorizontal: headerPadding }]}>
        {step !== 'success' && (
          <Pressable onPress={handlePrevious} style={styles.backButton}>
            <ArrowLeft size={isSmallScreen ? 20 : 24} color={colors.text} />
          </Pressable>
        )}
        
        <View style={styles.headerTitleContainer}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>KYC Tier 3</Text>
        </View>
        
        {step !== 'success' && (
          <Pressable onPress={() => router.back()} style={styles.closeButton}>
            <X size={isSmallScreen ? 20 : 24} color={colors.text} />
          </Pressable>
        )}
      </View>

      <KeyboardAvoidingWrapper contentContainerStyle={styles.scrollContent}>
        {step === 'facial' && renderFacialRecognition()}
        {step === 'address' && renderProofOfAddress()}
        {step === 'success' && renderSuccess()}
      </KeyboardAvoidingWrapper>

      {step !== 'success' && (
        <FloatingButton
          title={step === 'address' ? 'Submit' : 'Continue'}
          onPress={handleNext}
          disabled={isLoading || (step === 'facial' && !facialRecognitionComplete) || (step === 'address' && !proofOfAddressImage)}
          loading={isLoading}
        />
      )}

      {step === 'success' && (
        <View style={[styles.stickyButtonContainer, { paddingHorizontal: contentPadding }]}>
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
  documentActions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  documentButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 8,
  },
  documentButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  imageUploadContainer: {
    width: '100%',
    minHeight: 200,
    borderRadius: 12,
    overflow: 'hidden',
  },
  uploadedImage: {
    width: '100%',
    height: 200,
    resizeMode: 'cover',
  },
  uploadPlaceholder: {
    width: '100%',
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: 12,
    gap: 12,
  },
  uploadText: {
    fontSize: 14,
    fontWeight: '500',
  },
  errorText: {
    fontSize: 12,
    color: '#EF4444',
    marginTop: 4,
  },
  infoContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    borderRadius: 12,
    gap: 12,
    marginTop: 8,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  facialRecognitionContainer: {
    alignItems: 'center',
    marginVertical: 32,
  },
  facialRecognitionCircle: {
    width: 200,
    height: 200,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    marginBottom: 24,
  },
  recognizingContainer: {
    alignItems: 'center',
    gap: 8,
  },
  recognizingText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 8,
  },
  progressBarContainer: {
    width: '100%',
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 24,
  },
  progressBar: {
    height: '100%',
    borderRadius: 4,
  },
  startButton: {
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 20,
    marginTop: 16,
  },
  startButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  successMessage: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginTop: 16,
  },
  successMessageText: {
    fontSize: 14,
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
    maxWidth: 320,
  },
  stickyButtonContainer: {
    paddingBottom: 16,
    paddingTop: 8,
  },
  doneButton: {
    height: 55,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  doneButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  inputError: {
    borderColor: '#EF4444',
    borderWidth: 2,
  },
});

