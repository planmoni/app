import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  Alert,
  ActivityIndicator,
  Image,
  Platform,
} from 'react-native';
import { Camera, Upload, X, Clock, Mail, CheckCircle } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '@/contexts/ThemeContext';
import { useToast } from '@/contexts/ToastContext';
import { useKYCData } from '@/hooks/useKYCData';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

interface UtilityBillUploadModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function UtilityBillUploadModal({
  visible,
  onClose,
  onSuccess,
}: UtilityBillUploadModalProps) {
  const { colors } = useTheme();
  const { showToast } = useToast();
  const { session } = useAuth();
  const { formData: kycData, saveFormData } = useKYCData();

  const [utilityBillImage, setUtilityBillImage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [uploadDate, setUploadDate] = useState<Date | null>(null);
  const [isApproved, setIsApproved] = useState(false);
  const [validationResult, setValidationResult] = useState<any>(null);

  // Check if utility bill was uploaded more than 3 days ago
  const [showSupportMessage, setShowSupportMessage] = useState(false);

  useEffect(() => {
    if (visible && kycData?.utility_bill_url) {
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
  }, [visible, kycData]);

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

  const takePicture = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Camera Permission Required',
          'Please grant camera permission to take a picture of your utility bill.',
          [{ text: 'OK' }]
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setUtilityBillImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error taking picture:', error);
      showToast('Failed to take picture. Please try again.', 'error');
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
      // Upload image to Supabase storage
      showToast('Uploading utility bill...', 'info');
      
      // Get file extension from URI
      const fileExtension = utilityBillImage.split('.').pop() || 'jpg';
      const fileName = `utility-bill.${fileExtension}`;
      const filePath = `${session.user.id}/${fileName}`;

      // Convert image to blob for upload
      const response = await fetch(utilityBillImage);
      const blob = await response.blob();

      // Upload to Supabase storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, blob, {
          contentType: blob.type,
          upsert: true // Replace if file already exists
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

      // Validation passed, save to KYC data
      showToast('Validation passed! Saving utility bill...', 'success');
      
      const success = await saveFormData({
        utility_bill_url: storageUrl,
        utility_bill_validated: true,
        utility_bill_validation_result: validation
      });

      if (success) {
        setUploadDate(new Date());
        showToast('Utility bill uploaded and validated successfully!', 'success');
        onSuccess?.();
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

  const handleClose = () => {
    if (isUploading || isValidating) return; // Prevent closing while uploading or validating
    onClose();
  };

  const styles = createStyles(colors);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Upload Utility Bill</Text>
          <Pressable onPress={handleClose} style={styles.closeButton}>
            <X size={24} color={colors.text} />
          </Pressable>
        </View>

        <View style={styles.content}>
          {/* Status Section */}
          {isApproved ? (
            <View style={styles.approvedSection}>
              <CheckCircle size={48} color="#22C55E" />
              <Text style={styles.approvedTitle}>Approved!</Text>
              <Text style={styles.approvedDescription}>
                Your utility bill has been approved. You now have access to maximum transaction limits.
              </Text>
            </View>
          ) : utilityBillImage ? (
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

              {/* Image Preview */}
              {utilityBillImage && (
                <View style={styles.imagePreviewSection}>
                  <Text style={styles.imagePreviewTitle}>Selected Image</Text>
                  <View style={styles.imageContainer}>
                    <Image source={{ uri: utilityBillImage }} style={styles.previewImage} />
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
                  
                  <Pressable style={styles.uploadOption} onPress={takePicture}>
                    <Camera size={32} color={colors.primary} />
                    <Text style={styles.uploadOptionText}>Take Photo</Text>
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
                    <ActivityIndicator color={colors.primary} />
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
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  closeButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    padding: 20,
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
    backgroundColor: colors.backgroundTertiary,
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
    backgroundColor: colors.backgroundTertiary,
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