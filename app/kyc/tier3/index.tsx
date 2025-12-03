import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Image,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { X, Upload, Clock, Mail, CheckCircle, CircleHelp as HelpCircle, FileText } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { getDocumentAsync } from 'expo-document-picker';
import { useTheme } from '@/contexts/ThemeContext';
import { useToast } from '@/contexts/ToastContext';
import { useKYCData } from '@/hooks/useKYCData';
import { useKYCProgress } from '@/hooks/useKYCProgress';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useIntercom } from '@/hooks/useIntercom';
import { useHaptics } from '@/hooks/useHaptics';
import { logAnalyticsEvent } from '@/lib/firebase';
import { useWindowDimensions } from 'react-native';

export default function Tier3KYCScreen() {
  const { colors, isDark } = useTheme();
  const { width, height } = useWindowDimensions();
  const isSmallScreen = width < 380 || height < 700;
  const { showToast } = useToast();
  const { session } = useAuth();
  const { formData: kycData, saveFormData } = useKYCData();
  const { progress, updateProgress, loadProgress, updateTier, checkTierCompletion } = useKYCProgress();
  const { openChat, isLoading: isHelpLoading, isSupported: isIntercomSupported } = useIntercom();
  const haptics = useHaptics();

  const [utilityBillImage, setUtilityBillImage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [isApproved, setIsApproved] = useState(false);
  const [validationResult, setValidationResult] = useState<any>(null);
  const [showSupportMessage, setShowSupportMessage] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  // Wait for component to mount
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Load existing utility bill data
  useEffect(() => {
    if (kycData?.utility_bill_url) {
      setUtilityBillImage(kycData.utility_bill_url);
      setIsApproved(kycData.approved || false);
      
      // Check if utility bill was uploaded more than 3 days ago
      if (kycData.updated_at) {
        const uploadTime = new Date(kycData.updated_at);
        const now = new Date();
        const daysDiff = (now.getTime() - uploadTime.getTime()) / (1000 * 60 * 60 * 24);
        
        if (daysDiff > 3 && !kycData.approved) {
          setShowSupportMessage(true);
        }
      }
    }
  }, [kycData]);

  // Check if Tier 3 is already complete
  useFocusEffect(
    useCallback(() => {
      if (!isMounted || !progress) return;

      const checkCompletion = async () => {
        try {
          await loadProgress();
          await updateTier();
          
          const tierStatus = checkTierCompletion();
          
          // Check if Tier 3 is complete (utility bill verified)
          const utilityBillVerified = progress?.utility_bill_verified === true;
          const addressCompleted = progress?.address_completed === true;
          
          if (tierStatus.tier3 && utilityBillVerified && addressCompleted) {
            // Tier 3 is complete, redirect to success
            setTimeout(() => {
              try {
                router.replace('/kyc/tier3/success');
              } catch (error) {
                console.error('Navigation error:', error);
              }
            }, 300);
          }
        } catch (error) {
          console.error('Error checking Tier 3 completion:', error);
        }
      };

      const timer = setTimeout(() => {
        checkCompletion();
      }, 1000);

      return () => clearTimeout(timer);
    }, [isMounted, loadProgress, updateTier, checkTierCompletion, progress])
  );

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setUtilityBillImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      showToast('Failed to pick image. Please try again.', 'error');
    }
  };

  const pickFile = async () => {
    try {
      // Try to use document picker for PDFs and images
      const result = await getDocumentAsync({
        type: ['image/*', 'application/pdf'],
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setUtilityBillImage(asset.uri);
        showToast('File selected successfully', 'success');
      }
    } catch (error: any) {
      console.error('Error picking file:', error);
      
      // Fallback to image picker if document picker fails
      try {
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.All,
          allowsEditing: false,
          quality: 0.8,
        });

        if (!result.canceled && result.assets[0]) {
          setUtilityBillImage(result.assets[0].uri);
          showToast('File selected (images only - rebuild app for PDF support)', 'info');
        }
      } catch (fallbackError) {
        console.error('Fallback image picker error:', fallbackError);
        showToast('Failed to pick file. Please try again.', 'error');
      }
    }
  };

  const validateUtilityBill = async (base64Image: string) => {
    if (!session?.user?.id) {
      throw new Error('Authentication required');
    }

    // Get user's address from KYC data for validation
    const userAddress = kycData?.address || '';

    const response = await fetch('/api/utility-bill-validation', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({
        utilityBillImage: base64Image,
        userAddress: userAddress
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Validation failed');
    }

    const result = await response.json();
    return result;
  };

  const uploadUtilityBill = async () => {
    if (!utilityBillImage || !session?.user?.id) {
      showToast('Please select a utility bill image first.', 'error');
      return;
    }

    setIsUploading(true);
    setIsValidating(true);

    try {
      // Upload file to Supabase storage
      showToast('Uploading utility bill...', 'info');
      
      // Get file extension from URI
      const fileExtension = utilityBillImage.split('.').pop()?.toLowerCase() || 'jpg';
      const fileName = `utility-bill.${fileExtension}`;
      const filePath = `${session.user.id}/${fileName}`;

      // Convert file to blob for upload (handles both images and PDFs)
      const response = await fetch(utilityBillImage);
      const blob = await response.blob();

      // Upload to Supabase storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, blob, {
          contentType: blob.type,
          upsert: true
        });

      if (uploadError) {
        throw new Error(`Upload failed: ${uploadError.message}`);
      }

      // Get the public URL for the uploaded file
      const { data: urlData } = supabase.storage
        .from('documents')
        .getPublicUrl(filePath);

      const storageUrl = urlData.publicUrl;

      // Validate utility bill with Dojah using the storage URL
      showToast('Validating utility bill...', 'info');
      const validation = await validateUtilityBill(storageUrl);
      setValidationResult(validation);

      if (!validation.isValid) {
        // Show validation errors
        const errors = [];
        if (!validation.validationChecks.isRecent) {
          errors.push('Utility bill is not recent (must be within 3 months)');
        }
        if (!validation.validationChecks.hasAddressInfo) {
          errors.push('Address information could not be extracted from the utility bill');
        }
        if (!validation.validationChecks.addressMatches) {
          errors.push('Address on utility bill does not match your registered address');
        }

        showToast(`Validation failed: ${errors.join(', ')}`, 'error');
        setIsValidating(false);
        return;
      }

      // Validation passed, save to KYC data and update progress
      showToast('Validation passed! Saving utility bill...', 'success');
      
      const success = await saveFormData({
        utility_bill_url: storageUrl,
        utility_bill_validated: true,
        utility_bill_validation_result: validation
      });

      if (success) {
        // Update progress - mark utility bill as verified and address as completed
        await updateProgress({
          utility_bill_verified: true,
          address_completed: true,
          current_step: 'review'
        });

        // Update tier
        await updateTier();
        await loadProgress();

        showToast('Utility bill uploaded and validated successfully!', 'success');
        
        // Navigate to success screen
        setTimeout(() => {
          router.push('/kyc/tier3/success');
        }, 1500);
      } else {
        showToast('Failed to save utility bill. Please try again.', 'error');
      }
    } catch (error) {
      console.error('Error uploading utility bill:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      showToast(`Failed to upload utility bill: ${errorMessage}`, 'error');
    } finally {
      setIsUploading(false);
      setIsValidating(false);
    }
  };

  const handleHelpPress = async () => {
    if (Platform.OS !== 'web') {
      haptics.lightImpact();
    }
    
    if (!isIntercomSupported) {
      return;
    }
    
    try {
      console.log('🎯 Help button pressed - opening Intercom instantly');
      await openChat();
      logAnalyticsEvent('help_click', { source: 'tier3_kyc_flow' });
    } catch (error) {
      console.error('❌ Failed to open Intercom:', error);
      Alert.alert(
        'Support Chat Unavailable',
        'Unable to open support chat at the moment. This might be due to network connectivity issues. Would you like to try again?',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Retry', 
            onPress: () => {
              console.log('🔄 Retrying Intercom...');
              handleHelpPress();
            }
          }
        ]
      );
    }
  };

  const styles = createStyles(colors, isDark);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Pressable 
          onPress={() => router.replace('/(tabs)')} 
          style={[styles.closeButton, { backgroundColor: colors.surface }]}
        >
          <X size={isSmallScreen ? 20 : 24} color={colors.text} />
        </Pressable>
        <View style={styles.headerTitleContainer}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Tier 3 Verification</Text>
        </View>
        <Pressable 
          onPress={handleHelpPress}
          disabled={!isIntercomSupported || isHelpLoading}
          style={[styles.helpButton, { backgroundColor: colors.backgroundTertiary }]}
        >
          <HelpCircle size={isSmallScreen ? 18 : 20} color={colors.textSecondary} />
        </Pressable>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {/* Status Section */}
        {isApproved ? (
          <View style={styles.approvedSection}>
            <CheckCircle size={48} color="#22C55E" />
            <Text style={styles.approvedTitle}>Approved!</Text>
            <Text style={styles.approvedDescription}>
              Your utility bill has been approved. You now have access to maximum transaction limits.
            </Text>
          </View>
        ) : utilityBillImage && kycData?.utility_bill_url ? (
          <View style={styles.pendingSection}>
            <Clock size={48} color="#F59E0B" />
            <Text style={styles.pendingTitle}>Pending Approval</Text>
            <Text style={styles.pendingDescription}>
              Your utility bill has been uploaded and is being reviewed by our team.
            </Text>
            
            {showSupportMessage && (
              <View style={styles.supportMessage}>
                <Mail size={20} color="#EF4444" />
                <Text style={styles.supportText}>
                  It's been more than 3 days. Please contact us at{' '}
                  <Text style={styles.emailLink}>support@planmoni.com</Text>
                </Text>
              </View>
            )}
          </View>
        ) : (
          <>
            {/* Instructions */}
            <View style={styles.instructionsSection}>
              <Text style={styles.instructionsTitle}>Upload Utility Bill</Text>
              <Text style={styles.instructionsDescription}>
                Please upload a recent utility bill (electricity, water, or gas) to verify your address and unlock maximum transaction limits.
              </Text>
              
              <View style={styles.requirementsList}>
                <Text style={styles.requirementItem}>• Bill must be recent (within last 3 months)</Text>
                <Text style={styles.requirementItem}>• Must show your name and address clearly</Text>
                <Text style={styles.requirementItem}>• File size should be less than 5MB</Text>
                <Text style={styles.requirementItem}>• Supported formats: JPG, PNG, PDF</Text>
              </View>
            </View>

            {/* File Preview */}
            {utilityBillImage && (
              <View style={styles.imagePreviewSection}>
                <Text style={styles.imagePreviewTitle}>Selected File</Text>
                <View style={styles.imageContainer}>
                  {utilityBillImage.toLowerCase().endsWith('.pdf') || utilityBillImage.toLowerCase().includes('pdf') ? (
                    <View style={styles.pdfPreviewContainer}>
                      <FileText size={48} color={colors.primary} />
                      <Text style={styles.pdfPreviewText}>PDF Document</Text>
                      <Text style={styles.pdfPreviewSubtext}>
                        {utilityBillImage.split('/').pop() || 'utility-bill.pdf'}
                      </Text>
                    </View>
                  ) : (
                    <Image source={{ uri: utilityBillImage }} style={styles.previewImage} />
                  )}
                  <Pressable
                    onPress={() => setUtilityBillImage(null)}
                    style={styles.removeImageButton}
                  >
                    <X size={20} color="#EF4444" />
                  </Pressable>
                </View>
              </View>
            )}

            {/* Upload Options */}
            {!utilityBillImage && (
              <View style={styles.uploadOptions}>
                <Pressable style={styles.uploadOption} onPress={pickImage}>
                  <Upload size={32} color={colors.primary} />
                  <Text style={styles.uploadOptionText}>Choose from Gallery</Text>
                </Pressable>
                
                <Pressable style={styles.uploadOption} onPress={pickFile}>
                  <FileText size={32} color={colors.primary} />
                  <Text style={styles.uploadOptionText}>Upload Utility Bill</Text>
                </Pressable>
              </View>
            )}

            {/* Upload Button */}
            {utilityBillImage && (
              <Pressable
                style={[styles.uploadButton, (isUploading || isValidating) && styles.uploadButtonDisabled]}
                onPress={uploadUtilityBill}
                disabled={isUploading || isValidating}
              >
                {isUploading || isValidating ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.uploadButtonText}>
                    {isValidating ? 'Validating...' : 'Upload & Validate Utility Bill'}
                  </Text>
                )}
              </Pressable>
            )}

            {/* Validation Result Display */}
            {validationResult && (
              <View style={styles.validationResult}>
                <Text style={styles.validationTitle}>Validation Result:</Text>
                <View style={styles.validationChecks}>
                  <View style={styles.validationCheck}>
                    <CheckCircle 
                      size={16} 
                      color={validationResult.validationChecks.isRecent ? '#10B981' : '#EF4444'} 
                    />
                    <Text style={[
                      styles.validationCheckText,
                      { color: validationResult.validationChecks.isRecent ? '#10B981' : '#EF4444' }
                    ]}>
                      Recent Document
                    </Text>
                  </View>
                  <View style={styles.validationCheck}>
                    <CheckCircle 
                      size={16} 
                      color={validationResult.validationChecks.hasAddressInfo ? '#10B981' : '#EF4444'} 
                    />
                    <Text style={[
                      styles.validationCheckText,
                      { color: validationResult.validationChecks.hasAddressInfo ? '#10B981' : '#EF4444' }
                    ]}>
                      Address Information
                    </Text>
                  </View>
                  <View style={styles.validationCheck}>
                    <CheckCircle 
                      size={16} 
                      color={validationResult.validationChecks.addressMatches ? '#10B981' : '#EF4444'} 
                    />
                    <Text style={[
                      styles.validationCheckText,
                      { color: validationResult.validationChecks.addressMatches ? '#10B981' : '#EF4444' }
                    ]}>
                      Address Match
                    </Text>
                  </View>
                </View>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(colors: any, isDark: boolean) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      position: 'relative',
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
    helpButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1,
    },
    content: {
      flex: 1,
    },
    contentContainer: {
      padding: 24,
      paddingBottom: 40,
    },
    instructionsSection: {
      marginBottom: 24,
    },
    instructionsTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 8,
    },
    instructionsDescription: {
      fontSize: 16,
      color: colors.textSecondary,
      lineHeight: 24,
      marginBottom: 16,
    },
    requirementsList: {
      backgroundColor: colors.backgroundTertiary || (isDark ? 'rgba(255, 255, 255, 0.05)' : '#F3F4F6'),
      padding: 16,
      borderRadius: 12,
    },
    requirementItem: {
      fontSize: 14,
      color: colors.textSecondary,
      marginBottom: 4,
    },
    uploadOptions: {
      flexDirection: 'row',
      gap: 16,
      marginBottom: 24,
    },
    uploadOption: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 24,
      paddingHorizontal: 16,
      backgroundColor: colors.backgroundTertiary || (isDark ? 'rgba(255, 255, 255, 0.05)' : '#F3F4F6'),
      borderRadius: 12,
      borderWidth: 2,
      borderColor: colors.border,
    },
    uploadOptionText: {
      fontSize: 14,
      fontWeight: '500',
      color: colors.text,
      marginTop: 8,
    },
    imagePreviewSection: {
      marginBottom: 24,
    },
    imagePreviewTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 12,
    },
    imageContainer: {
      position: 'relative',
      alignItems: 'center',
    },
    previewImage: {
      width: '100%',
      height: 200,
      borderRadius: 12,
      resizeMode: 'cover',
    },
    pdfPreviewContainer: {
      width: '100%',
      height: 200,
      borderRadius: 12,
      backgroundColor: colors.backgroundTertiary || (isDark ? 'rgba(255, 255, 255, 0.05)' : '#F3F4F6'),
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 2,
      borderColor: colors.border,
      borderStyle: 'dashed',
    },
    pdfPreviewText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginTop: 12,
    },
    pdfPreviewSubtext: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 4,
      textAlign: 'center',
      paddingHorizontal: 16,
    },
    removeImageButton: {
      position: 'absolute',
      top: 8,
      right: 8,
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: 'rgba(255, 255, 255, 0.9)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    uploadButton: {
      backgroundColor: colors.primary,
      paddingVertical: 16,
      paddingHorizontal: 24,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 24,
    },
    uploadButtonDisabled: {
      opacity: 0.6,
    },
    uploadButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: '#FFFFFF',
    },
    approvedSection: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 40,
    },
    approvedTitle: {
      fontSize: 24,
      fontWeight: '700',
      color: '#22C55E',
      marginTop: 16,
      marginBottom: 8,
    },
    approvedDescription: {
      fontSize: 16,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 24,
      paddingHorizontal: 20,
    },
    pendingSection: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 40,
    },
    pendingTitle: {
      fontSize: 24,
      fontWeight: '700',
      color: '#F59E0B',
      marginTop: 16,
      marginBottom: 8,
    },
    pendingDescription: {
      fontSize: 16,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 24,
      paddingHorizontal: 20,
      marginBottom: 24,
    },
    supportMessage: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#FEE2E2',
      padding: 16,
      borderRadius: 12,
      gap: 12,
      marginTop: 16,
    },
    supportText: {
      fontSize: 14,
      color: '#EF4444',
      flex: 1,
    },
    emailLink: {
      fontWeight: '600',
      textDecorationLine: 'underline',
    },
    validationResult: {
      marginTop: 16,
      padding: 16,
      backgroundColor: colors.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    validationTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 12,
    },
    validationChecks: {
      gap: 8,
    },
    validationCheck: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    validationCheckText: {
      fontSize: 14,
      fontWeight: '500',
    },
  });
}

