import React from 'react';
import { View, Text, Image, Pressable } from 'react-native';
import { Camera, Info, Upload } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useKYCStyles } from './sharedStyles';
import { IdentityType } from './types';

interface DocumentsVerificationStepProps {
  selectedIdentityType: IdentityType;
  documentFrontImage: string | null;
  documentBackImage: string | null;
  errors: Record<string, string>;
  onIdentityTypeChange: (type: IdentityType) => void;
  onDocumentFrontImageChange: (uri: string | null) => void;
  onDocumentBackImageChange: (uri: string | null) => void;
  onPickImage: (setImageFunction: React.Dispatch<React.SetStateAction<string | null>>, type: string) => Promise<void>;
  onTakePicture: (type: 'front' | 'back' | 'house' | 'utility') => Promise<void>;
}

export default function DocumentsVerificationStep({
  selectedIdentityType,
  documentFrontImage,
  documentBackImage,
  errors,
  onIdentityTypeChange,
  onDocumentFrontImageChange,
  onDocumentBackImageChange,
  onPickImage,
  onTakePicture,
}: DocumentsVerificationStepProps) {
  const { colors } = useTheme();
  const styles = useKYCStyles();

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
            onPress={() => onIdentityTypeChange('nin')}
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
            onPress={() => onIdentityTypeChange('passport')}
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
            onPress={() => onPickImage(onDocumentFrontImageChange, 'documentFront')}
          >
            <Text style={styles.documentButtonText}>Upload Photo</Text>
          </Pressable>
        </View>
        <Pressable
          style={[styles.imageUploadContainer, errors.documentFront && styles.inputError]}
          onPress={() => onTakePicture('front')}
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
            onPress={() => onPickImage(onDocumentBackImageChange, 'documentBack')}
          >
            <Text style={styles.documentButtonText}>Upload Photo</Text>
          </Pressable>
        </View>
        <Pressable
          style={[styles.imageUploadContainer, errors.documentBack && styles.inputError]}
          onPress={() => onTakePicture('back')}
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

      <View style={styles.infoContainer}>
        <Info size={20} color={colors.primary} />
        <Text style={styles.infoText}>
          Ensure the document is clearly visible, well-lit, and all text is readable. Avoid glare and shadows.
        </Text>
      </View>
    </View>
  );
}

