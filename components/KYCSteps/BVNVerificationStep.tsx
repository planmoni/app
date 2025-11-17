import React from 'react';
import { View, Text, TextInput, ActivityIndicator } from 'react-native';
import { Check, Info } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useKYCStyles } from './sharedStyles';

interface BVNVerificationStepProps {
  bvn: string;
  errors: Record<string, string>;
  bvnVerified: boolean;
  bvnMatchedName: string;
  isResolvingBvn: boolean;
  onBvnChange: (text: string) => void;
  handleNumericInput: (text: string, setter: (value: string) => void, maxLength: number, errorKey: string) => void;
  bvnInputRef?: React.RefObject<TextInput | null>;
}

export default function BVNVerificationStep({
  bvn,
  errors,
  bvnVerified,
  bvnMatchedName,
  isResolvingBvn,
  onBvnChange,
  handleNumericInput,
  bvnInputRef,
}: BVNVerificationStepProps) {
  const { colors } = useTheme();
  const styles = useKYCStyles();

  return (
    <View style={styles.formContainer}>
      <Text style={styles.sectionTitle}>BVN Verification</Text>
      <Text style={styles.sectionDescription}>
        Please enter your Bank Verification Number (BVN) for identity verification.
      </Text>
      
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Bank Verification Number (BVN)</Text>
        <View style={[styles.inputContainer, errors.bvn && styles.inputError]}>
          <TextInput
            ref={bvnInputRef}
            style={styles.input}
            placeholder="Enter your 11-digit BVN"
            placeholderTextColor={colors.textTertiary}
            value={bvn}
            onChangeText={(text) => handleNumericInput(text, onBvnChange, 11, 'bvn')}
            keyboardType="numeric"
            maxLength={11}
            editable={!isResolvingBvn && !bvnVerified}
            autoCorrect={false}
            autoCapitalize="none"
            selectTextOnFocus={true}
            blurOnSubmit={false}
            returnKeyType="done"
            textContentType="none"
            autoComplete="off"
            importantForAutofill="no"
            spellCheck={false}
          />
          {isResolvingBvn && (
            <ActivityIndicator size="small" color={colors.primary} style={styles.activityIndicator} />
          )}
          {bvnVerified && (
            <View style={styles.verifiedBadge}>
              <Check size={16} color="#FFFFFF" />
            </View>
          )}
        </View>
        {errors.bvn && <Text style={styles.errorText}>{errors.bvn}</Text>}
      </View>
      
      {bvnVerified && bvnMatchedName && (
        <View style={styles.matchedNameContainer}>
          <Check size={16} color={colors.success} />
          <Text style={styles.matchedNameText}>
            BVN verified! Name: {bvnMatchedName}
          </Text>
        </View>
      )}
      
      <View style={styles.infoContainer}>
        <Info size={20} color={colors.primary} />
        <Text style={styles.infoText}>
          Your BVN is used for verification purposes only. This helps us confirm your identity and protect your account.
        </Text>
      </View>
    </View>
  );
}

