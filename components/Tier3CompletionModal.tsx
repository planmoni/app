import React from 'react';
import { View, Text, Pressable, Modal, StyleSheet } from 'react-native';
import { CheckCircle, Home, Trophy } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { useHaptics } from '@/hooks/useHaptics';

interface Tier3CompletionModalProps {
  isVisible: boolean;
  onClose: () => void;
  onGoToDashboard: () => void;
}

export default function Tier3CompletionModal({
  isVisible,
  onClose,
  onGoToDashboard,
}: Tier3CompletionModalProps) {
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
    },
    iconContainer: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: '#22C55E20',
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
      backgroundColor: isDark ? 'rgba(34, 197, 94, 0.1)' : '#F0FDF4',
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
    },
    primaryButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#22C55E',
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
    badgeContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: isDark ? 'rgba(34, 197, 94, 0.1)' : '#F0FDF4',
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
      marginBottom: 16,
    },
    badgeText: {
      fontSize: 14,
      fontWeight: '600',
      color: '#22C55E',
    },
  });

  const handleGoToDashboard = () => {
    haptics.mediumImpact();
    onGoToDashboard();
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
            <Trophy size={48} color="#22C55E" />
          </View>

          <View style={styles.badgeContainer}>
            <Trophy size={20} color="#22C55E" />
            <Text style={styles.badgeText}>Maximum Verification Achieved</Text>
          </View>

          <Text style={styles.title}>Tier 3 Complete! 🎉</Text>
          
          <Text style={styles.message}>
            Congratulations! You've successfully completed the highest level of verification. 
            You now have access to all features and maximum transaction limits.
          </Text>

          <View style={styles.benefitsContainer}>
            <Text style={styles.benefitsTitle}>What you can do now:</Text>
            <View style={styles.benefitItem}>
              <CheckCircle size={16} color="#22C55E" />
              <Text style={styles.benefitText}>Deposit up to ₦5,000,000 daily</Text>
            </View>
            <View style={styles.benefitItem}>
              <CheckCircle size={16} color="#22C55E" />
              <Text style={styles.benefitText}>Deposit up to ₦20,000,000 weekly</Text>
            </View>
            <View style={styles.benefitItem}>
              <CheckCircle size={16} color="#22C55E" />
              <Text style={styles.benefitText}>Deposit up to ₦100,000,000 monthly</Text>
            </View>
            <View style={styles.benefitItem}>
              <CheckCircle size={16} color="#22C55E" />
              <Text style={styles.benefitText}>Single transaction up to ₦5,000,000</Text>
            </View>
            <View style={styles.benefitItem}>
              <CheckCircle size={16} color="#22C55E" />
              <Text style={styles.benefitText}>Maximum balance of ₦500,000,000</Text>
            </View>
            <View style={styles.benefitItem}>
              <CheckCircle size={16} color="#22C55E" />
              <Text style={styles.benefitText}>Access to all premium features</Text>
            </View>
          </View>

          <View style={styles.buttonsContainer}>
            <Pressable
              style={styles.primaryButton}
              onPress={handleGoToDashboard}
            >
              <Home size={20} color="#FFFFFF" />
              <Text style={styles.primaryButtonText}>Go to Dashboard</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

