import React from 'react';
import { View, Text } from 'react-native';
import { Info } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useKYCStyles } from './sharedStyles';

interface LivenessVerificationStepProps {
  // This step is informational only, no props needed
}

export default function LivenessVerificationStep({}: LivenessVerificationStepProps) {
  const { colors } = useTheme();
  const styles = useKYCStyles();

  return (
    <View style={styles.formContainer}>
      <Text style={styles.sectionTitle}>Liveness Verification</Text>
      <Text style={styles.sectionDescription}>
        Please complete the liveness test to verify your identity. This is the first step in your KYC verification process.
      </Text>
      
      <View style={styles.infoContainer}>
        <Info size={20} color={colors.primary} />
        <Text style={styles.infoText}>
          The liveness test requires you to perform facial movements to ensure you are a real person. This helps protect your account from fraud.
        </Text>
      </View>
    </View>
  );
}

