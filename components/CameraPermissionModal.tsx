import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Modal, useWindowDimensions, Linking } from 'react-native';
import { Camera, Shield, Check, Info, AlertCircle } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useCameraPermission } from 'react-native-vision-camera';
import LivenessTestEnhanced from './LivenessTestEnhanced';

interface CameraPermissionModalProps {
  isVisible: boolean;
  onClose: () => void;
  onComplete?: (selfieUrl: string) => void;
}

export default function CameraPermissionModal({
  isVisible,
  onClose,
  onComplete,
}: CameraPermissionModalProps) {
  const { colors, isDark } = useTheme();
  const { width } = useWindowDimensions();
  const { hasPermission, requestPermission } = useCameraPermission();
  const [showPermissionDeniedModal, setShowPermissionDeniedModal] = useState(false);
  const [showLivenessTest, setShowLivenessTest] = useState(false);
  const [isRequesting, setIsRequesting] = useState(false);

  const isSmallScreen = width < 380;

  // Reset state when modal closes
  useEffect(() => {
    if (!isVisible) {
      setShowPermissionDeniedModal(false);
      setShowLivenessTest(false);
      setIsRequesting(false);
    }
  }, [isVisible]);

  // Handle camera permission request
  const handleRequestCameraPermission = async () => {
    if (isRequesting) return;
    
    setIsRequesting(true);
    try {
      const granted = await requestPermission();
      
      if (granted) {
        // Permission granted, show liveness test
        setShowLivenessTest(true);
      } else {
        // Permission denied, show permission denied modal
        setShowPermissionDeniedModal(true);
      }
    } catch (error) {
      console.error('Error requesting camera permission:', error);
      setShowPermissionDeniedModal(true);
    } finally {
      setIsRequesting(false);
    }
  };

  // Handle liveness test completion
  const handleLivenessComplete = (selfieUrl: string) => {
    setShowLivenessTest(false);
    if (onComplete) {
      onComplete(selfieUrl);
    }
    onClose();
  };

  // Handle liveness test close
  const handleLivenessClose = () => {
    setShowLivenessTest(false);
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
    permissionModal: {
      width: '90%',
      maxWidth: 400,
      borderRadius: 16,
      padding: 24,
      alignSelf: 'center',
      backgroundColor: colors.surface,
    },
    permissionModalHeader: {
      alignItems: 'center',
      marginBottom: 24,
    },
    permissionIconContainer: {
      width: 64,
      height: 64,
      borderRadius: 32,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 16,
      backgroundColor: colors.accent,
    },
    permissionDeniedIconContainer: {
      backgroundColor: isDark ? 'rgba(239, 68, 68, 0.2)' : '#FEE2E2',
    },
    permissionModalTitle: {
      fontSize: isSmallScreen ? 20 : 24,
      fontWeight: '600',
      textAlign: 'center',
      color: colors.text,
    },
    permissionModalContent: {
      marginBottom: 24,
    },
    permissionModalText: {
      fontSize: isSmallScreen ? 14 : 16,
      lineHeight: isSmallScreen ? 20 : 24,
      textAlign: 'center',
      marginBottom: 20,
      color: colors.textSecondary,
    },
    permissionModalSubtext: {
      fontSize: isSmallScreen ? 13 : 14,
      lineHeight: isSmallScreen ? 18 : 20,
      textAlign: 'center',
      marginTop: 16,
      color: colors.textSecondary,
    },
    permissionInfoList: {
      gap: 12,
      marginTop: 8,
    },
    permissionInfoItem: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
    },
    permissionInfoText: {
      flex: 1,
      fontSize: isSmallScreen ? 13 : 14,
      lineHeight: isSmallScreen ? 18 : 20,
      color: colors.text,
    },
    permissionWarningBox: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
      padding: 16,
      borderRadius: 12,
      borderWidth: 1,
      marginTop: 16,
      backgroundColor: colors.errorLight,
      borderColor: colors.error,
    },
    permissionWarningText: {
      flex: 1,
      fontSize: isSmallScreen ? 13 : 14,
      lineHeight: isSmallScreen ? 18 : 20,
      fontWeight: '500',
      color: colors.error,
    },
    permissionModalActions: {
      flexDirection: 'row',
      gap: 12,
    },
    permissionModalButton: {
      flex: 1,
      paddingVertical: 14,
      paddingHorizontal: 24,
      borderRadius: 100,
      alignItems: 'center',
      justifyContent: 'center',
    },
    permissionModalButtonPrimary: {
      backgroundColor: colors.primary,
    },
    permissionModalButtonSecondary: {
      borderWidth: 1,
      backgroundColor: 'transparent',
      borderColor: colors.border,
    },
    permissionModalButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
    },
    permissionModalButtonTextPrimary: {
      color: '#FFFFFF',
    },
  });

  // If liveness test is showing, only show that
  if (showLivenessTest) {
    return (
      <LivenessTestEnhanced 
        isVisible={showLivenessTest}
        onClose={handleLivenessClose}
        onComplete={handleLivenessComplete}
      />
    );
  }

  // If permission denied modal is showing, show that
  if (showPermissionDeniedModal) {
    return (
      <Modal
        visible={showPermissionDeniedModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          setShowPermissionDeniedModal(false);
          onClose();
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.permissionModal}>
            <View style={styles.permissionModalHeader}>
              <View style={[styles.permissionIconContainer, styles.permissionDeniedIconContainer]}>
                <AlertCircle size={32} color={colors.error} />
              </View>
              <Text style={styles.permissionModalTitle}>
                Camera Permission Required
              </Text>
            </View>
            
            <View style={styles.permissionModalContent}>
              <Text style={styles.permissionModalText}>
                You cannot complete the KYC verification process without granting camera permission.
              </Text>
              
              <View style={styles.permissionWarningBox}>
                <AlertCircle size={20} color={colors.error} />
                <Text style={styles.permissionWarningText}>
                  Camera access is required to perform the liveness test, which is mandatory for account verification.
                </Text>
              </View>
              
              <Text style={styles.permissionModalSubtext}>
                Please grant camera permission in your device settings to continue with the verification process.
              </Text>
            </View>
            
            <View style={styles.permissionModalActions}>
              <Pressable
                style={[styles.permissionModalButton, styles.permissionModalButtonPrimary]}
                onPress={async () => {
                  setShowPermissionDeniedModal(false);
                  await Linking.openSettings();
                  onClose();
                }}
              >
                <Text style={[styles.permissionModalButtonText, styles.permissionModalButtonTextPrimary]}>
                  Open Settings
                </Text>
              </Pressable>
              <Pressable
                style={[styles.permissionModalButton, styles.permissionModalButtonSecondary]}
                onPress={() => {
                  setShowPermissionDeniedModal(false);
                  onClose();
                }}
              >
                <Text style={styles.permissionModalButtonText}>
                  Cancel
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    );
  }

  // Show permission request modal
  return (
    <Modal
      visible={isVisible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.permissionModal}>
          <View style={styles.permissionModalHeader}>
            <View style={styles.permissionIconContainer}>
              <Camera size={32} color={colors.primary} />
            </View>
            <Text style={styles.permissionModalTitle}>
              Camera Permission Required
            </Text>
          </View>
          
          <View style={styles.permissionModalContent}>
            <Text style={styles.permissionModalText}>
              To complete your KYC verification, we need access to your camera to perform a liveness check.
            </Text>
            
            <View style={styles.permissionInfoList}>
              <View style={styles.permissionInfoItem}>
                <Check size={20} color={colors.primary} />
                <Text style={styles.permissionInfoText}>
                  Verify your identity through facial recognition
                </Text>
              </View>
              <View style={styles.permissionInfoItem}>
                <Check size={20} color={colors.primary} />
                <Text style={styles.permissionInfoText}>
                  Ensure you are a real person (anti-fraud protection)
                </Text>
              </View>
              <View style={styles.permissionInfoItem}>
                <Check size={20} color={colors.primary} />
                <Text style={styles.permissionInfoText}>
                  Your privacy is protected - images are securely stored
                </Text>
              </View>
            </View>
          </View>
          
          <View style={styles.permissionModalActions}>
            <Pressable
              style={[styles.permissionModalButton, styles.permissionModalButtonSecondary]}
              onPress={onClose}
              disabled={isRequesting}
            >
              <Text style={styles.permissionModalButtonText}>
                Cancel
              </Text>
            </Pressable>
            <Pressable
              style={[styles.permissionModalButton, styles.permissionModalButtonPrimary]}
              onPress={handleRequestCameraPermission}
              disabled={isRequesting}
            >
              <Text style={[styles.permissionModalButtonText, styles.permissionModalButtonTextPrimary]}>
                {isRequesting ? 'Requesting...' : 'Continue'}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
