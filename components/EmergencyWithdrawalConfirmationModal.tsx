import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Alert,
  Platform,
} from 'react-native';
import { X, Shield, CheckCircle, AlertTriangle } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { usePin } from '@/contexts/PinContext';
import { useHaptics } from '@/hooks/useHaptics';
import { BiometricService } from '@/lib/biometrics';
import PinVerificationModal from './PinVerificationModal';

interface EmergencyWithdrawalConfirmationModalProps {
  isVisible: boolean;
  onClose: () => void;
  onConfirm: () => void;
  withdrawalDetails: {
    planName: string;
    planAmount: string;
    option: string;
    feeAmount: string;
    netAmount: string;
    bankName: string;
    accountName: string;
    accountNumber: string;
  };
}

export default function EmergencyWithdrawalConfirmationModal({
  isVisible,
  onClose,
  onConfirm,
  withdrawalDetails
}: EmergencyWithdrawalConfirmationModalProps) {
  const { colors, isDark } = useTheme();
  const { emergencyBiometricEnabled, verifyEmergencyPin, checkBiometricSupport } = usePin();
  const haptics = useHaptics();
  
  const [showPinVerification, setShowPinVerification] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isBiometricAuthenticating, setIsBiometricAuthenticating] = useState(false);
  const [biometricSupport, setBiometricSupport] = useState<any>(null);

  useEffect(() => {
    if (isVisible) {
      checkBiometrics();
    }
  }, [isVisible]);

  const checkBiometrics = async () => {
    try {
      const support = await checkBiometricSupport();
      setBiometricSupport(support);
    } catch (error) {
      console.error('Error checking biometric support:', error);
    }
  };

  const handleConfirm = async () => {
    // If biometric authentication is enabled and available, try biometric first
    if (emergencyBiometricEnabled && biometricSupport?.isAvailable && Platform.OS !== 'web') {
      await attemptBiometricAuthentication();
    } else {
      // Fall back to PIN verification
      setShowPinVerification(true);
    }
  };

  const attemptBiometricAuthentication = async () => {
    try {
      setIsBiometricAuthenticating(true);
      haptics.mediumImpact();

      const result = await BiometricService.authenticateWithBiometrics(
        "Authenticate to confirm emergency withdrawal"
      );

      if (result.success) {
        // Biometric authentication successful
        haptics.success();
        proceedWithConfirmation();
      } else {
        // Biometric failed or cancelled - fall back to PIN
        haptics.error();
        
        if (result.error === "Authentication cancelled" || result.error === "User chose fallback authentication") {
          // User cancelled or chose fallback - show PIN modal
          setShowPinVerification(true);
        } else {
          // Other error - show alert and then PIN modal
          Alert.alert(
            'Biometric Authentication Failed',
            'Please use your PIN to confirm the withdrawal.',
            [
              {
                text: 'Use PIN',
                onPress: () => setShowPinVerification(true)
              },
              {
                text: 'Cancel',
                style: 'cancel',
                onPress: () => onClose()
              }
            ]
          );
        }
      }
    } catch (error) {
      console.error('Biometric authentication error:', error);
      haptics.error();
      
      // Fall back to PIN on error
      Alert.alert(
        'Authentication Error',
        'Biometric authentication failed. Please use your PIN.',
        [
          {
            text: 'Use PIN',
            onPress: () => setShowPinVerification(true)
          },
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => onClose()
          }
        ]
      );
    } finally {
      setIsBiometricAuthenticating(false);
    }
  };

  const proceedWithConfirmation = () => {
    setIsProcessing(true);
    haptics.success();
    
    // Close the modal and proceed with confirmation
    setTimeout(() => {
      setIsProcessing(false);
      onClose();
      onConfirm();
    }, 500);
  };

  const handlePinVerificationSuccess = () => {
    setShowPinVerification(false);
    proceedWithConfirmation();
  };

  const handlePinVerificationClose = () => {
    setShowPinVerification(false);
  };

  const getOptionDetails = () => {
    switch (withdrawalDetails.option) {
      case 'instant':
        return {
          title: 'Instant Withdrawal',
          description: 'Your funds will be processed immediately',
          timeframe: 'within minutes',
        };
      case '24h':
        return {
          title: '24-Hour Withdrawal',
          description: 'Your funds will be processed within 24 hours',
          timeframe: 'within 24 hours',
        };
      case '72h':
        return {
          title: '72-Hour Withdrawal',
          description: 'Your funds will be processed within 72 hours',
          timeframe: 'within 72 hours',
        };
      default:
        return {
          title: 'Emergency Withdrawal',
          description: 'Your funds will be processed',
          timeframe: 'soon',
        };
    }
  };

  const optionDetails = getOptionDetails();
  const styles = createStyles(colors, isDark);

  if (!isVisible) return null;

  return (
    <>
      <Modal
        visible={isVisible && !showPinVerification}
        transparent
        animationType="fade"
        onRequestClose={onClose}
      >
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <View style={styles.header}>
              <View style={styles.headerContent}>
                <View style={styles.securityIcon}>
                  <AlertTriangle size={24} color={colors.warning} />
                </View>
                <Text style={styles.headerTitle}>Emergency Withdrawal</Text>
              </View>
              <Pressable 
                style={styles.closeButton} 
                onPress={onClose}
                disabled={isProcessing}
              >
                <X size={20} color={colors.textSecondary} />
              </Pressable>
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
              <View style={styles.warningNotice}>
                <View style={styles.noticeIcon}>
                  <AlertTriangle size={16} color={colors.error} />
                </View>
                <Text style={styles.warningText}>
                  This is an emergency withdrawal. Fees may apply and processing times vary based on your selected option.
                </Text>
              </View>

              <View style={styles.optionCard}>
                <Text style={styles.optionTitle}>{optionDetails.title}</Text>
                <Text style={styles.optionDescription}>{optionDetails.description}</Text>
                <Text style={styles.timeframeText}>Processing: {optionDetails.timeframe}</Text>
              </View>

              <View style={styles.detailsCard}>
                <Text style={styles.detailsTitle}>Withdrawal Details</Text>
                
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Plan Name</Text>
                  <Text style={styles.detailValue}>{withdrawalDetails.planName}</Text>
                </View>
                
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Plan Amount</Text>
                  <Text style={styles.detailValue}>₦{withdrawalDetails.planAmount}</Text>
                </View>
                
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Withdrawal Fee</Text>
                  <Text style={styles.detailValue}>₦{withdrawalDetails.feeAmount}</Text>
                </View>
                
                <View style={[styles.detailRow, styles.totalRow]}>
                  <Text style={styles.totalLabel}>Net Amount</Text>
                  <Text style={styles.totalValue}>₦{withdrawalDetails.netAmount}</Text>
                </View>
              </View>

              <View style={styles.bankCard}>
                <Text style={styles.bankTitle}>Destination Account</Text>
                
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Bank</Text>
                  <Text style={styles.detailValue}>{withdrawalDetails.bankName}</Text>
                </View>
                
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Account Name</Text>
                  <Text style={styles.detailValue}>{withdrawalDetails.accountName}</Text>
                </View>
                
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Account Number</Text>
                  <Text style={styles.detailValue}>{withdrawalDetails.accountNumber}</Text>
                </View>
              </View>

              <View style={styles.importantNote}>
                <Text style={styles.noteText}>
                  <Text style={styles.noteBold}>Important:</Text> Emergency withdrawals are irreversible once processed. 
                  {emergencyBiometricEnabled && ' PIN verification is required to proceed.'}
                </Text>
              </View>
            </ScrollView>

            <View style={styles.footer}>
              <Pressable 
                style={[styles.cancelButton, isProcessing && styles.disabledButton]} 
                onPress={onClose}
                disabled={isProcessing}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </Pressable>
              
              <Pressable 
                style={[styles.confirmButton, (isProcessing || isBiometricAuthenticating) && styles.disabledButton]} 
                onPress={handleConfirm}
                disabled={isProcessing || isBiometricAuthenticating}
              >
                {isProcessing ? (
                  <View style={styles.loadingContainer}>
                    <CheckCircle size={20} color="#FFFFFF" />
                    <Text style={styles.confirmButtonText}>Processing...</Text>
                  </View>
                ) : isBiometricAuthenticating ? (
                  <View style={styles.loadingContainer}>
                    <Shield size={20} color="#FFFFFF" />
                    <Text style={styles.confirmButtonText}>Authenticating...</Text>
                  </View>
                ) : (
                  <Text style={styles.confirmButtonText}>Confirm Withdrawal</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <PinVerificationModal
        isVisible={showPinVerification}
        onClose={handlePinVerificationClose}
        onSuccess={handlePinVerificationSuccess}
        title="Emergency Withdrawal PIN"
        description="Enter your emergency withdrawal PIN to confirm"
        customVerifyPin={verifyEmergencyPin}
      />
    </>
  );
}

const createStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modal: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    width: '100%',
    maxHeight: '90%',
    maxWidth: 400,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  securityIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.warning + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.backgroundTertiary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: 20,
  },
  warningNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.error + '15',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.error + '30',
  },
  noticeIcon: {
    marginRight: 12,
  },
  warningText: {
    fontSize: 14,
    color: colors.error,
    flex: 1,
    lineHeight: 20,
  },
  optionCard: {
    backgroundColor: colors.primary + '15',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.primary + '30',
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
    marginBottom: 4,
  },
  optionDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  timeframeText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.primary,
  },
  detailsCard: {
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  detailsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 16,
  },
  bankCard: {
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bankTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  detailLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
    textAlign: 'right',
    flex: 1,
    marginLeft: 16,
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: 8,
    paddingTop: 12,
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  totalValue: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  importantNote: {
    backgroundColor: colors.warning + '10',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.warning + '20',
  },
  noteText: {
    fontSize: 14,
    color: colors.warning,
    lineHeight: 20,
  },
  noteBold: {
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  confirmButton: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: colors.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  disabledButton: {
    opacity: 0.6,
  },
}); 