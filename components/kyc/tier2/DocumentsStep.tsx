import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, KeyboardAvoidingView, Platform, Image, ActivityIndicator } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { Camera, Info, Upload } from 'lucide-react-native';
import ProgressBar from './ProgressBar';
import { useTier2KYC } from '@/hooks/useTier2KYC';
import { useToast } from '@/contexts/ToastContext';
import { useAuth } from '@/contexts/AuthContext';
import { useKYCData } from '@/hooks/useKYCData';
import { useKYCProgress } from '@/hooks/useKYCProgress';
import Button from '@/components/Button';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFabKeyboardOffset } from '@/hooks/useFabKeyboardOffset';
import { BlurView } from 'expo-blur';
import * as ImagePicker from 'expo-image-picker';
import { verifyDocument, validateImage, uploadDocumentToStorage } from '@/utils/kyc-verification';
import { supabase } from '@/lib/supabase';

type IdentityType = 'nin' | 'passport';

interface DocumentsStepProps {
  onComplete: () => void;
}

export default function DocumentsStep({ onComplete }: DocumentsStepProps) {
  const { colors, isDark } = useTheme();
  const { showToast } = useToast();
  const { session } = useAuth();
  const { formData, saveFormData } = useKYCData();
  const { progress, updateProgress, updateTier, checkTierCompletion, loadProgress } = useKYCProgress();
  const { getProgressPercentage, getCurrentStepNumber } = useTier2KYC();
  const insets = useSafeAreaInsets();
  
  // Keyboard offset for floating button
  const { bottomOffset } = useFabKeyboardOffset({
    gap: Platform.OS === 'android' ? -180 : -20,
    tabBarHeight: 0,
  });
  
  // Document state
  const [selectedIdentityType, setSelectedIdentityType] = useState<IdentityType>(
    (formData?.document_type as any)?.document_name?.toLowerCase() === 'passport' ? 'passport' : 'nin'
  );
  const [documentFrontImage, setDocumentFrontImage] = useState<string | null>(formData?.document_front_url || null);
  const [documentBackImage, setDocumentBackImage] = useState<string | null>(formData?.document_back_url || null);
  
  // Errors and loading
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isVerifying, setIsVerifying] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Image picker
  const pickImage = async (setImageFunction: React.Dispatch<React.SetStateAction<string | null>>, type: string) => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        base64: false,
      });
      
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        if (asset.uri) {
          setIsUploading(true);
          try {
            const uploadedUrl = await uploadDocumentToStorage(
              asset.uri,
              type === 'documentFront' ? 'front' : type === 'documentBack' ? 'back' : type,
              session?.user?.id || ''
            );
            if (uploadedUrl) {
              setImageFunction(uploadedUrl);
              setErrors(prev => ({ ...prev, [type]: '' }));
              showToast('Image uploaded successfully', 'success');
            } else {
              showToast('Failed to upload image', 'error');
            }
          } catch (error) {
            console.error('Upload error:', error);
            showToast('Failed to upload image', 'error');
          } finally {
            setIsUploading(false);
          }
        } else {
          showToast('No image selected', 'error');
        }
      }
    } catch (error) {
      console.error('Error picking image:', error);
      showToast('Failed to select image', 'error');
    }
  };

  // Take picture with camera
  const takePicture = async (type: 'front' | 'back') => {
    // Request permissions
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
          setIsUploading(true);
          try {
            const uploadedUrl = await uploadDocumentToStorage(
              imageData,
              type,
              session?.user?.id || ''
            );
            if (uploadedUrl) {
              if (type === 'front') {
                setDocumentFrontImage(uploadedUrl);
                setErrors(prev => ({ ...prev, documentFront: '' }));
              } else {
                setDocumentBackImage(uploadedUrl);
                setErrors(prev => ({ ...prev, documentBack: '' }));
              }
              showToast('Photo captured and uploaded successfully', 'success');
            } else {
              showToast('Failed to upload image', 'error');
            }
          } catch (error) {
            console.error('Upload error:', error);
            showToast('Failed to upload image', 'error');
          } finally {
            setIsUploading(false);
          }
        }
      }
    } catch (error) {
      console.error('Error taking picture:', error);
      showToast('Failed to capture image', 'error');
    }
  };

  // Validation
  const validateDocumentVerification = () => {
    const newErrors: Record<string, string> = {};
    
    if (!documentFrontImage) {
      newErrors.documentFront = 'Front of document is required';
    }
    
    setErrors(newErrors);
    
    if (Object.keys(newErrors).length > 0) {
      const firstError = Object.values(newErrors)[0];
      showToast(firstError, 'error');
      return false;
    }
    
    return true;
  };

  // Verify documents
  const handleVerify = async () => {
    if (!validateDocumentVerification()) {
      return;
    }

    if (!session?.user?.id) {
      showToast('Authentication required', 'error');
      return;
    }

    setIsVerifying(true);
    setErrors({});

    try {
      // Verify document with Dojah
      const result = await verifyDocument(
        documentFrontImage!,
        documentBackImage,
        selectedIdentityType,
        session.user.id
      );

      if (!result.success) {
        setErrors({ documentVerification: result.error || 'Document verification failed' });
        showToast(result.error || 'Document verification failed', 'error');
        return;
      }

      // Document verification successful
      const entity = result.data?.entity;
      const documentNumber = result.data?.documentNumber;

      // Save document data
      await saveFormData({
        document_type: entity?.document_type || null,
        document_number: documentNumber || undefined,
        document_front_url: documentFrontImage || undefined,
        document_back_url: documentBackImage || undefined
      });

      // Update progress
      const progressResult = await updateProgress({
        current_step: 'review',
        documents_verified: true
      });

      if (!progressResult) {
        showToast('Failed to update progress. Please try again.', 'error');
        return;
      }

      // Update tier and check completion
      await updateTier();
      await loadProgress();
      const tierStatus = checkTierCompletion();
      
      if (tierStatus.tier2) {
        showToast('Tier 2 completed! You can now deposit up to ₦100,000 monthly.', 'success');
      } else {
        showToast('Document verified successfully!', 'success');
      }

      // Navigate to success screen
      setTimeout(() => {
        onComplete();
      }, 2000);

    } catch (error) {
      console.error('Document verification error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Document verification failed';
      setErrors({ documentVerification: errorMessage });
      showToast(errorMessage, 'error');
    } finally {
      setIsVerifying(false);
    }
  };

  const styles = createStyles(colors, isDark);
  const percentage = getProgressPercentage();
  const stepNumber = getCurrentStepNumber();
  const isCompleted = progress?.documents_verified || false;

  return (
    <View style={styles.container}>
      <ProgressBar percentage={percentage} currentStep={stepNumber} totalSteps={2} />
      
      <KeyboardAvoidingView 
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={true}
          bounces={true}
        >
          <View style={styles.content}>
            <Text style={styles.title}>Document Verification</Text>
            <Text style={styles.description}>
              Please upload clear photos of your identity document for verification.
            </Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Document Type</Text>
              <View style={styles.identityTypeContainer}>
                <Pressable
                  style={[
                    styles.identityTypeOption,
                    selectedIdentityType === 'nin' && styles.identityTypeSelected
                  ]}
                  onPress={() => {
                    setSelectedIdentityType('nin');
                    setErrors(prev => ({ ...prev, documentType: '' }));
                  }}
                  disabled={isCompleted}
                >
                  <Text style={[
                    styles.identityTypeText,
                    selectedIdentityType === 'nin' && styles.identityTypeTextSelected
                  ]}>
                    NIN
                  </Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.identityTypeOption,
                    selectedIdentityType === 'passport' && styles.identityTypeSelected
                  ]}
                  onPress={() => {
                    setSelectedIdentityType('passport');
                    setErrors(prev => ({ ...prev, documentType: '' }));
                  }}
                  disabled={isCompleted}
                >
                  <Text style={[
                    styles.identityTypeText,
                    selectedIdentityType === 'passport' && styles.identityTypeTextSelected
                  ]}>
                    Passport
                  </Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Front of Document *</Text>
              <View style={styles.documentActions}>
                <Pressable 
                  style={styles.documentButton} 
                  onPress={() => pickImage(setDocumentFrontImage, 'documentFront')}
                  disabled={isCompleted || isUploading}
                >
                  <Upload size={16} color={colors.primary} />
                  <Text style={styles.documentButtonText}>Upload Photo</Text>
                </Pressable>
              </View>
              <Pressable
                style={[styles.imageUploadContainer, errors.documentFront && styles.inputError]}
                onPress={() => takePicture('front')}
                disabled={isCompleted || isUploading}
              >
                {documentFrontImage ? (
                  <Image source={{ uri: documentFrontImage }} style={styles.uploadedImage} />
                ) : (
                  <View style={styles.uploadPlaceholder}>
                    <Camera size={24} color={colors.textSecondary} />
                    <Text style={styles.uploadText}>Tap to take photo</Text>
                  </View>
                )}
              </Pressable>
              {errors.documentFront && <Text style={styles.errorText}>{errors.documentFront}</Text>}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Back of Document (Optional)</Text>
              <View style={styles.documentActions}>
                <Pressable 
                  style={styles.documentButton} 
                  onPress={() => pickImage(setDocumentBackImage, 'documentBack')}
                  disabled={isCompleted || isUploading}
                >
                  <Upload size={16} color={colors.primary} />
                  <Text style={styles.documentButtonText}>Upload Photo</Text>
                </Pressable>
              </View>
              <Pressable
                style={[styles.imageUploadContainer, errors.documentBack && styles.inputError]}
                onPress={() => takePicture('back')}
                disabled={isCompleted || isUploading}
              >
                {documentBackImage ? (
                  <Image source={{ uri: documentBackImage }} style={styles.uploadedImage} />
                ) : (
                  <View style={styles.uploadPlaceholder}>
                    <Camera size={24} color={colors.textSecondary} />
                    <Text style={styles.uploadText}>Tap to take photo</Text>
                  </View>
                )}
              </Pressable>
              {errors.documentBack && <Text style={styles.errorText}>{errors.documentBack}</Text>}
            </View>

            {isCompleted && (
              <View style={styles.completedContainer}>
                <Text style={styles.completedText}>✓ Document verified successfully</Text>
              </View>
            )}

            <View style={styles.infoContainer}>
              <Info size={20} color={colors.primary} />
              <Text style={styles.infoText}>
                Ensure the document is clearly visible, well-lit, and all text is readable. Avoid glare and shadows.
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {!isCompleted && (
        <View 
          style={[
            styles.floatingButtonContainer,
            { 
              bottom: Platform.OS === 'android' 
                ? insets.bottom 
                : bottomOffset 
            }
          ]}
          pointerEvents="box-none"
        >
          <BlurView
            intensity={Platform.OS === 'android' ? 40 : 60}
            tint={isDark ? 'dark' : 'light'}
            style={styles.blurUnderlay}
            pointerEvents="none"
          />
          
          <BlurView
            intensity={Platform.OS === 'android' ? 60 : 80}
            tint={isDark ? 'dark' : 'light'}
            style={styles.blurBackground}
            pointerEvents="none"
          />
          
          <View style={[
            styles.buttonContentOverlay,
            Platform.OS === 'android' && styles.androidButtonContentOverlay
          ]}>
            <Button
              title="Verify Document"
              onPress={handleVerify}
              disabled={isVerifying || isUploading || !documentFrontImage}
              isLoading={isVerifying}
              style={styles.mainButton}
              variant="primary"
              textColor="#fff"
              textStyle={styles.buttonText}
            />
          </View>
        </View>
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
    keyboardAvoidingView: {
      flex: 1,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      paddingBottom: 250,
    },
    content: {
      padding: 24,
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
      marginBottom: 24,
    },
    label: {
      fontSize: 14,
      fontWeight: '500',
      color: colors.text,
      marginBottom: 8,
    },
    identityTypeContainer: {
      flexDirection: 'row',
      gap: 12,
    },
    identityTypeOption: {
      flex: 1,
      paddingVertical: 14,
      paddingHorizontal: 20,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    identityTypeSelected: {
      borderColor: colors.primary,
      backgroundColor: isDark ? 'rgba(59, 130, 246, 0.2)' : '#EFF6FF',
    },
    identityTypeText: {
      fontSize: 16,
      fontWeight: '500',
      color: colors.text,
    },
    identityTypeTextSelected: {
      color: colors.primary,
      fontWeight: '600',
    },
    documentActions: {
      flexDirection: 'row',
      gap: 12,
      marginBottom: 12,
    },
    documentButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.primary,
      backgroundColor: colors.surface,
    },
    documentButtonText: {
      fontSize: 14,
      fontWeight: '500',
      color: colors.primary,
    },
    imageUploadContainer: {
      width: '100%',
      height: 200,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: colors.border,
      borderStyle: 'dashed',
      overflow: 'hidden',
      backgroundColor: colors.surface,
    },
    inputError: {
      borderColor: colors.error,
    },
    uploadPlaceholder: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    uploadText: {
      fontSize: 14,
      color: colors.textSecondary,
      fontWeight: '500',
    },
    uploadedImage: {
      width: '100%',
      height: '100%',
      resizeMode: 'cover',
    },
    errorText: {
      fontSize: 12,
      color: colors.error,
      marginTop: 4,
    },
    completedContainer: {
      backgroundColor: isDark ? 'rgba(34, 197, 94, 0.2)' : '#F0FDF4',
      paddingVertical: 12,
      paddingHorizontal: 24,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.success,
      marginBottom: 20,
    },
    completedText: {
      fontSize: 16,
      fontWeight: '500',
      color: colors.success,
    },
    infoContainer: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
      backgroundColor: isDark ? 'rgba(59, 130, 246, 0.1)' : '#EFF6FF',
      padding: 16,
      borderRadius: 12,
      marginTop: 20,
    },
    infoText: {
      fontSize: 14,
      color: colors.textSecondary,
      lineHeight: 20,
      flex: 1,
    },
    floatingButtonContainer: {
      position: 'absolute',
      left: 0,
      right: 0,
      zIndex: 1000,
    },
    blurUnderlay: {
      position: 'absolute',
      top: -1,
      left: 0,
      right: 0,
      bottom: 0,
      height: 200,
    },
    blurBackground: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
    },
    buttonContentOverlay: {
      backgroundColor: colors.surface,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingTop: 8,
      paddingHorizontal: 16,
      paddingBottom: 8,
    },
    androidButtonContentOverlay: {
      borderTopWidth: 0,
      backgroundColor: 'transparent',
      paddingTop: 4,
      paddingBottom: 4,
    },
    mainButton: {
      width: '100%',
      height: 60,
      borderRadius: 20,
      backgroundColor: colors.primary,
    },
    buttonText: {
      fontSize: 17,
      fontWeight: '600',
    },
  });
}


