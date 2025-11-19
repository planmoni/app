import React from 'react';
import { View, Text, Pressable, Modal, StyleSheet } from 'react-native';
import { CheckCircle, ArrowRight, Home } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { useHaptics } from '@/hooks/useHaptics';

interface Tier1CompletionModalProps {
  isVisible: boolean;
  onClose: () => void;
  onGoToDashboard: () => void;
  onUpgradeToTier2: () => void;
}

export default function Tier1CompletionModal({
  isVisible,
  onClose,
  onGoToDashboard,
  onUpgradeToTier2,
}: Tier1CompletionModalProps) {
  const { colors, isDark } = useTheme();
  const { width, height } = useWindowDimensions();
  const haptics = useHaptics();
  const isSmallScreen = width < 380 || height < 700;

  const styles = StyleSheet.create({
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 16,
    },
    modalContainer: {
      width: '100%',
      maxWidth: 400,
      borderRadius: 24,
      padding: isSmallScreen ? 24 : 32,
      backgroundColor: colors.surface,
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 8,
    },
    iconContainer: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: colors.primary + '20',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 24,
    },
    title: {
      fontSize: isSmallScreen ? 24 : 28,
      fontWeight: '700',
      color: colors.text,
      textAlign: 'center',
      marginBottom: 12,
    },
    message: {
      fontSize: isSmallScreen ? 14 : 16,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: isSmallScreen ? 20 : 24,
      marginBottom: 32,
    },
    benefitsContainer: {
      width: '100%',
      marginBottom: 32,
      padding: 16,
      borderRadius: 12,
      backgroundColor: colors.accentBackground,
    },
    benefitsTitle: {
      fontSize: isSmallScreen ? 14 : 16,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 12,
    },
    benefitItem: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 8,
    },
    benefitText: {
      fontSize: isSmallScreen ? 13 : 14,
      color: colors.textSecondary,
      marginLeft: 8,
      flex: 1,
    },
    buttonsContainer: {
      width: '100%',
      gap: 12,
    },
    primaryButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
      paddingVertical: 16,
      paddingHorizontal: 24,
      borderRadius: 20,
      gap: 8,
    },
    secondaryButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.backgroundTertiary,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: 16,
      paddingHorizontal: 24,
      borderRadius: 20,
      gap: 8,
    },
    primaryButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: '#FFFFFF',
    },
    secondaryButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
    },
  });

  const handleGoToDashboard = () => {
    haptics.mediumImpact();
    onGoToDashboard();
    onClose();
  };

  const handleUpgradeToTier2 = () => {
    haptics.mediumImpact();
    onUpgradeToTier2();
    onClose();
  };

  return (
    <Modal
      visible={isVisible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <View style={styles.iconContainer}>
            <CheckCircle size={48} color={colors.primary} />
          </View>

          <Text style={styles.title}>Tier 1 Complete! 🎉</Text>
          
          <Text style={styles.message}>
            Congratulations! You've successfully completed Tier 1 verification. 
            Your sub-account has been created and you can now start using Planmoni.
          </Text>

          <View style={styles.benefitsContainer}>
            <Text style={styles.benefitsTitle}>What you can do now:</Text>
            <View style={styles.benefitItem}>
              <CheckCircle size={16} color={colors.primary} />
              <Text style={styles.benefitText}>Deposit up to ₦100,000 daily</Text>
            </View>
            <View style={styles.benefitItem}>
              <CheckCircle size={16} color={colors.primary} />
              <Text style={styles.benefitText}>Deposit up to ₦500,000 weekly</Text>
            </View>
            <View style={styles.benefitItem}>
              <CheckCircle size={16} color={colors.primary} />
              <Text style={styles.benefitText}>Deposit up to ₦2,000,000 monthly</Text>
            </View>
            <View style={styles.benefitItem}>
              <CheckCircle size={16} color={colors.primary} />
              <Text style={styles.benefitText}>Single transaction up to ₦50,000</Text>
            </View>
            <View style={styles.benefitItem}>
              <CheckCircle size={16} color={colors.primary} />
              <Text style={styles.benefitText}>Maximum balance of ₦5,000,000</Text>
            </View>
            <View style={styles.benefitItem}>
              <CheckCircle size={16} color={colors.primary} />
              <Text style={styles.benefitText}>Create and manage payout plans</Text>
            </View>
          </View>

          <View style={styles.buttonsContainer}>
            <Pressable
              style={styles.primaryButton}
              onPress={handleUpgradeToTier2}
            >
              <ArrowRight size={20} color="#FFFFFF" />
              <Text style={styles.primaryButtonText}>Upgrade to Tier 2</Text>
            </Pressable>

            <Pressable
              style={styles.secondaryButton}
              onPress={handleGoToDashboard}
            >
              <Home size={20} color={colors.text} />
              <Text style={styles.secondaryButtonText}>Go to Dashboard</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

