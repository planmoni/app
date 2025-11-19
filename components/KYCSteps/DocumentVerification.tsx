import React, { useState, useRef, useEffect, useImperativeHandle, forwardRef } from 'react';
import { View, Text, Image, Pressable, ActivityIndicator } from 'react-native';
import { Camera, Info, Upload, Check } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '@/contexts/ThemeContext';
import { useToast } from '@/contexts/ToastContext';
import { useAuth } from '@/contexts/AuthContext';
import { useKYCData } from '@/hooks/useKYCData';
import { useKYCProgress } from '@/hooks/useKYCProgress';
import { useKYCStyles } from './sharedStyles';
import { IdentityType } from './types';
import { supabase } from '@/lib/supabase';

export interface DocumentVerificationHandle {
  verify: () => Promise<boolean>;
  isValid: () => boolean;
}

interface DocumentVerificationProps {
  onComplete?: () => void;
  onError?: (error: string) => void;
  initialDocumentType?: IdentityType;
  initialFrontImage?: string | null;
  initialBackImage?: string | null;
}

const DocumentVerification = forwardRef<DocumentVerificationHandle, DocumentVerificationProps>(
  ({ onComplete, onError, initialDocumentType = 'nin', initialFrontImage = null, initialBackImage = null }, ref) => {
    const { colors } = useTheme();
    const { showToast } = useToast();
    const { session } = useAuth();
    const { formData, saveFormData } = useKYCData();
    const { progress, updateProgress, updateTier, checkTierCompletion } = useKYCProgress();
    const styles = useKYCStyles();
    
    const [selectedIdentityType, setSelectedIdentityType] = useState<IdentityType>(initialDocumentType);
    const [documentFrontImage, setDocumentFrontImage] = useState<string | null>(initialFrontImage);
    const [documentBackImage, setDocumentBackImage] = useState<string | null>(initialBackImage);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [isVerifying, setIsVerifying] = useState(false);
    const [verified, setVerified] = useState(false);

    // Load data from form data
    useEffect(() => {
      if (formData?.document_type) {
        setSelectedIdentityType(formData.document_type as IdentityType);
      }
      if (formData?.document_front_url) {
        setDocumentFrontImage(formData.document_front_url);
      }
      if (formData?.document_back_url) {
        setDocumentBackImage(formData.document_back_url);
      }
      if (progress?.documents_verified) {
        setVerified(true);
      }
    }, [formData, progress]);

    const validateImage = (imageUri: string): { isValid: boolean; error?: string } => {
      const isDataUri = imageUri.startsWith('data:image/');
      const isFileUri = imageUri.startsWith('file:');
      const isContentUri = imageUri.startsWith('content:');
      const isHttpUri = imageUri.startsWith('http://') || imageUri.startsWith('https://');
      
      if (!isDataUri && !isFileUri && !isContentUri && !isHttpUri) {
        return { isValid: false, error: 'Invalid image format. Please select a valid image.' };
      }

      if (isDataUri) {
        const parts = imageUri.split(',');
        if (parts.length > 1) {
          const base64Data = parts[1];
          const sizeInBytes = (base64Data.length * 3) / 4;
          const sizeInMB = sizeInBytes / (1024 * 1024);
          if (sizeInMB > 5) {
            return { isValid: false, error: 'Image size must be less than 5MB. Please select a smaller image.' };
          }
        }
      }

      return { isValid: true };
    };

    const uploadDocumentToStorage = async (uri: string, part: 'front' | 'back'): Promise<string | null> => {
      try {
        if (!session?.user?.id) {
          showToast('Authentication required', 'error');
          return null;
        }

        const fileExtensionGuess = uri.split('.').pop()?.toLowerCase();
        const ext = fileExtensionGuess && fileExtensionGuess.length <= 5 ? fileExtensionGuess : 'jpg';
        const fileName = `${part}-document-${Date.now()}.${ext}`;
        const filePath = `kyc-documents/${session.user.id}/${fileName}`;

        const file: any = {
          uri,
          name: fileName,
          type: 'image/jpeg',
        };

        const { error: uploadError } = await supabase.storage
          .from('documents')
          .upload(filePath, file, { contentType: 'image/jpeg', upsert: true });

        if (uploadError) {
          console.error('Supabase upload error:', uploadError);
          showToast('Upload failed. Please try again.', 'error');
          return null;
        }

        const { data: urlData } = supabase.storage.from('documents').getPublicUrl(filePath);
        return urlData.publicUrl || null;
      } catch (e) {
        console.error('Upload exception:', e);
        return null;
      }
    };

    const pickImage = async (type: 'front' | 'back') => {
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
            const uploadedUrl = await uploadDocumentToStorage(asset.uri, type);
            if (uploadedUrl) {
              if (type === 'front') {
                setDocumentFrontImage(uploadedUrl);
              } else {
                setDocumentBackImage(uploadedUrl);
              }
              setErrors(prev => ({ ...prev, [`document${type === 'front' ? 'Front' : 'Back'}`]: '' }));
            } else {
              showToast('Failed to upload image', 'error');
            }
          }
        }
      } catch (error) {
        console.error('Error picking image:', error);
        showToast('Failed to select image', 'error');
      }
    };

    const takePicture = async (type: 'front' | 'back') => {
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
            const uploadedUrl = await uploadDocumentToStorage(imageData, type);
            if (uploadedUrl) {
              if (type === 'front') {
                setDocumentFrontImage(uploadedUrl);
              } else {
                setDocumentBackImage(uploadedUrl);
              }
              setErrors(prev => ({ ...prev, [`document${type === 'front' ? 'Front' : 'Back'}`]: '' }));
            } else {
              showToast('Failed to upload image', 'error');
            }
          }
        }
      } catch (error) {
        console.error('Error taking picture:', error);
        showToast('Failed to capture image', 'error');
      }
    };

    const validateDocuments = (): boolean => {
      const newErrors: Record<string, string> = {};

      if (!documentFrontImage) {
        newErrors.documentFront = 'Front of document is required';
      } else {
        const validation = validateImage(documentFrontImage);
        if (!validation.isValid) {
          newErrors.documentFront = validation.error || 'Invalid image';
        }
      }

      setErrors(newErrors);

      if (Object.keys(newErrors).length > 0) {
        const firstError = Object.values(newErrors)[0];
        showToast(firstError, 'error');
        return false;
      }

      return true;
    };

    const verifyDocuments = async (): Promise<boolean> => {
      if (!validateDocuments()) return false;

      try {
        if (!session?.user?.id) {
          throw new Error('Authentication required');
        }

        setIsVerifying(true);
        setErrors({});

        // Create audit log
        const { data: auditLogId } = await supabase.rpc('create_kyc_audit_log', {
          p_user_id: session.user.id,
          p_operation_type: 'document_uploaded',
          p_verification_type: selectedIdentityType,
          p_verification_provider: 'dojah',
          p_request_data: {
            action: 'start_document_verification',
            document_type: selectedIdentityType,
            source: 'document_verification_component',
            timestamp: new Date().toISOString()
          },
          p_response_data: {
            user_action: 'initiated_document_verification',
            verification_status: 'pending'
          },
          p_status: 'pending',
          p_result_message: 'User initiated document verification process',
          p_metadata: {
            component: 'DocumentVerification',
            action: 'document_verification_start',
            step: 'documents_verification',
            document_type: selectedIdentityType
          }
        });

        if (auditLogId) {
          await supabase
            .from('kyc_audit_events')
            .insert({
              audit_log_id: auditLogId,
              user_id: session.user.id,
              event_type: 'document_uploaded',
              event_data: {
                action: 'document_verification_initiated',
                document_type: selectedIdentityType,
                provider: 'dojah'
              },
              severity: 'medium'
            });
        }

        const appId = process.env.EXPO_PUBLIC_DOJAH_APP_ID!;
        const privateKey = process.env.EXPO_PUBLIC_DOJAH_PRIVATE_KEY!;
        
        if (!appId || !privateKey) {
          console.error('Missing Dojah credentials');
          showToast('KYC service configuration error', 'error');
          return false;
        }

        // Ensure we have URLs (upload if still data URI)
        let frontImageUrl = documentFrontImage;
        let backImageUrl = documentBackImage;

        if (frontImageUrl && frontImageUrl.startsWith('data:image/')) {
          const uploaded = await uploadDocumentToStorage(frontImageUrl, 'front');
          if (!uploaded) throw new Error('Failed to upload front document image');
          frontImageUrl = uploaded;
          setDocumentFrontImage(uploaded);
        }

        if (backImageUrl && backImageUrl.startsWith('data:image/')) {
          const uploadedBack = await uploadDocumentToStorage(backImageUrl, 'back');
          if (!uploadedBack) throw new Error('Failed to upload back document image');
          backImageUrl = uploadedBack;
          setDocumentBackImage(uploadedBack);
        }

        // Call Dojah document analysis API
        const payload: any = {
          input_type: 'url',
          imagefrontside: frontImageUrl
        };

        if (backImageUrl) {
          payload.imagebackside = backImageUrl;
        }

        const analysisResponse = await fetch('https://api.dojah.io/api/v1/document/analysis', {
          method: 'POST',
          headers: {
            'AppId': appId,
            'Authorization': privateKey,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });

        if (!analysisResponse.ok) {
          const errorData = await analysisResponse.json().catch(() => ({}));
          throw new Error(errorData.message || errorData.error || `Document analysis failed: ${analysisResponse.status} ${analysisResponse.statusText}`);
        }

        const analysisData = await analysisResponse.json();
        console.log('Document analysis response:', {
          overall_status: analysisData.entity?.status?.overall_status,
          reason: analysisData.entity?.status?.reason,
          document_type: analysisData.entity?.document_type?.document_name
        });
        
        if (!analysisData.entity) {
          throw new Error('Invalid response from document analysis service');
        }

        if (analysisData.entity?.status?.overall_status !== 1) {
          throw new Error(`Document validation failed: ${analysisData.entity?.status?.reason || 'Invalid document'}`);
        }

        showToast('Document verified successfully!', 'success');

        // Persist document details
        try {
          const entity = analysisData.entity;
          const details: any = entity?.details || entity?.data || {};
          const extractedDocumentNumber = details.document_number || details.id_number || details.passport_number || details.number || null;

          await saveFormData({
            document_type: entity?.document_type || null,
            document_number: extractedDocumentNumber || undefined,
            document_front_url: frontImageUrl || undefined,
            document_back_url: backImageUrl || undefined
          });
        } catch (persistError) {
          console.error('Error saving verified document data:', persistError);
        }
        
        setVerified(true);

        // Update progress
        const progressResult = await updateProgress({
          current_step: 'address_details',
          documents_verified: true
        });
        
        if (progressResult) {
          await updateTier();
          const tierStatus = checkTierCompletion();
          if (tierStatus.tier2) {
            showToast('Tier 2 completed! You can now deposit up to ₦10,000,000 monthly.', 'success');
          }
        }

        if (onComplete) {
          onComplete();
        }

        return true;
      } catch (error) {
        console.error('Document verification error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Document verification failed';
        showToast(errorMessage, 'error');
        setErrors({ documentVerification: errorMessage });
        if (onError) {
          onError(errorMessage);
        }
        return false;
      } finally {
        setIsVerifying(false);
      }
    };

    // Expose methods to parent via ref
    useImperativeHandle(ref, () => ({
      verify: verifyDocuments,
      isValid: () => verified && !isVerifying
    }));

    return (
      <View style={styles.formContainer}>
        <Text style={styles.sectionTitle}>Document Verification</Text>
        <Text style={styles.sectionDescription}>
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
              onPress={() => setSelectedIdentityType('nin')}
              disabled={isVerifying || verified}
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
              onPress={() => setSelectedIdentityType('passport')}
              disabled={isVerifying || verified}
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
              onPress={() => pickImage('front')}
              disabled={isVerifying || verified}
            >
              <Upload size={16} color={colors.primary} />
              <Text style={styles.documentButtonText}>Upload Photo</Text>
            </Pressable>
          </View>
          <Pressable
            style={[styles.imageUploadContainer, errors.documentFront && styles.inputError, verified && styles.resolvedInput]}
            onPress={() => takePicture('front')}
            disabled={isVerifying || verified}
          >
            {documentFrontImage ? (
              <>
                <Image source={{ uri: documentFrontImage }} style={styles.uploadedImage} />
                {verified && (
                  <View style={[styles.verifiedBadge, { position: 'absolute', top: 12, right: 12 }]}>
                    <Check size={16} color="#FFFFFF" />
                  </View>
                )}
              </>
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
              onPress={() => pickImage('back')}
              disabled={isVerifying || verified}
            >
              <Upload size={16} color={colors.primary} />
              <Text style={styles.documentButtonText}>Upload Photo</Text>
            </Pressable>
          </View>
          <Pressable
            style={[styles.imageUploadContainer, errors.documentBack && styles.inputError]}
            onPress={() => takePicture('back')}
            disabled={isVerifying || verified}
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

        {isVerifying && (
          <View style={styles.infoContainer}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.infoText}>Verifying document... Please wait.</Text>
          </View>
        )}

        {verified && (
          <View style={styles.matchedNameContainer}>
            <Check size={16} color={colors.success} />
            <Text style={styles.matchedNameText}>
              Document verified successfully!
            </Text>
          </View>
        )}

        <View style={styles.infoContainer}>
          <Info size={20} color={colors.primary} />
          <Text style={styles.infoText}>
            Please ensure your document is clear, well-lit, and all information is visible. The document must be valid and not expired.
          </Text>
        </View>
      </View>
    );
  }
);

DocumentVerification.displayName = 'DocumentVerification';

export default DocumentVerification;

