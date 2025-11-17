import React from 'react';
import { View, Text, TextInput } from 'react-native';
import { Info, Shield } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useKYCStyles } from './sharedStyles';

interface IDFaceMatchStepProps {
  nin: string;
  errors: Record<string, string>;
  bvnVerified: boolean;
  isVerifyingDocuments: boolean;
  documentsVerified: boolean;
  onNinChange: (text: string) => void;
}

export default function IDFaceMatchStep({
  nin,
  errors,
  bvnVerified,
  isVerifyingDocuments,
  documentsVerified,
  onNinChange,
}: IDFaceMatchStepProps) {
  const { colors } = useTheme();
  const styles = useKYCStyles();

  return (
    <View style={styles.formContainer}>
      <Text style={styles.sectionTitle}>NIN Verification</Text>
      <Text style={styles.sectionDescription}>
        Please provide your National Identification Number (NIN) for verification.
      </Text>
      
      {!bvnVerified && (
        <View style={styles.warningContainer}>
          <Info size={20} color={colors.warning} />
          <Text style={styles.warningText}>
            You must complete BVN verification before proceeding with ID verification.
          </Text>
        </View>
      )}
      
      <View style={styles.inputGroup}>
        <Text style={styles.label}>National Identification Number (NIN)</Text>
        <View style={[styles.inputContainer, errors.nin && styles.inputError]}>
          <TextInput
            style={styles.input}
            placeholder="Enter your 11-digit NIN"
            placeholderTextColor={colors.textTertiary}
            value={nin}
            onChangeText={(text) => {
              // Only allow numbers and limit to 11 digits
              const numericText = text.replace(/[^0-9]/g, '');
              if (numericText.length <= 11) {
                onNinChange(numericText);
              }
            }}
            keyboardType="numeric"
            maxLength={11}
            editable={!isVerifyingDocuments && !documentsVerified && bvnVerified}
          />
        </View>
        {errors.nin && <Text style={styles.errorText}>{errors.nin}</Text>}
      </View>
      
      {errors.documentVerification && (
        <View style={styles.warningContainer}>
          <Text style={styles.errorText}>{errors.documentVerification}</Text>
        </View>
      )}
      
      <View style={styles.infoContainer}>
        <Shield size={20} color={colors.primary} />
        <Text style={styles.infoText}>
          Your documents are securely encrypted and will only be used for verification purposes. They will be deleted after verification is complete.
        </Text>
      </View>
    </View>
  );
}

