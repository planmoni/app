import React from 'react';
import { View, Text, Pressable, Modal, StyleSheet } from 'react-native';
import { Lock, ArrowRight, X } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { useHaptics } from '@/hooks/useHaptics';

interface AppLockModalProps {
  isVisible: boolean;
  onClose: () => void;
}

export default function AppLockModal({
  isVisible,
  onClose,
}: AppLockModalProps) {
  const { colors, isDark } = useTheme();
  const { width, height } = useWindowDimensions();
  const haptics = useHaptics();
  const isSmallScreen = width < 380 || height < 700;

  const handleGoToSecurityCenter = () => {
    haptics.mediumImpact();
    onClose();
    router.push('/settings/security');
  };

  const handleClose = () => {
    haptics.lightImpact();
    onClose();
  };

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
    closeButton: {
      position: 'absolute',
      top: 16,
      right: 16,
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.backgroundTertiary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    iconContainer: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: '#EF444420',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 24,
    },
    title: {
      fontSize: isSmallScreen ? 22 : 26,
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
    securityButton: {
      width: '100%',
      backgroundColor: colors.primary,
      paddingVertical: 16,
      paddingHorizontal: 24,
      borderRadius: 20,
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 8,
    },
    securityButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: '#FFFFFF',
    },
  });

  return (
    <Modal
      visible={isVisible}
      transparent={true}
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <Pressable style={styles.closeButton} onPress={handleClose}>
            <X size={20} color={colors.text} />
          </Pressable>

          <View style={styles.iconContainer}>
            <Lock size={48} color="#EF4444" />
          </View>

          <Text style={styles.title}>Set up App PIN</Text>
          
          <Text style={styles.message}>
            Set up App PIN to protect your account and secure your payout plans.
          </Text>

          <Pressable style={styles.securityButton} onPress={handleGoToSecurityCenter}>
            <Text style={styles.securityButtonText}>Go to Security Center</Text>
            <ArrowRight size={20} color="#FFFFFF" />
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

