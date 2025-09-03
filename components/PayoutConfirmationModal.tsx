import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Alert,
} from 'react-native';
import { X, Shield, CheckCircle, AlertTriangle } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { usePin } from '@/contexts/PinContext';
import { useHaptics } from '@/hooks/useHaptics';
import PinVerificationModal from './PinVerificationModal';

interface PayoutConfirmationModalProps {
  isVisible: boolean;
  onClose: () => void;
  onConfirm: () => void;
  payoutDetails: {
    name: string;
    totalAmount: string;
    payoutAmount: string;
    frequency: string;
    duration: string;
    startDate: string;
    bankName: string;
    accountName: string;
    accountNumber: string;
  };
}

export default function PayoutConfirmationModal({
  isVisible,
  onClose,
  onConfirm,
  payoutDetails
}: PayoutConfirmationModalProps) {
  const { colors, isDark } = useTheme();
  const { payoutBiometricEnabled } = usePin();
  const haptics = useHaptics();
  
  const [showPinVerification, setShowPinVerification] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleConfirm = () => {
    if (payoutBiometricEnabled) {
      // Show PIN verification modal
      setShowPinVerification(true);
    } else {
      // Proceed directly without PIN verification
      proceedWithConfirmation();
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

  const styles = createStyles(colors, isDark);

  if (!isVisible) return null;

  return (
    <>
      <Modal
        visible={isVisible}
        transparent
        animationType="fade"
        onRequestClose={onClose}
      >
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <View style={styles.header}>
              <View style={styles.headerContent}>
                <View style={styles.securityIcon}>
                  <Shield size={24} color={colors.primary} />
                </View>
                <Text style={styles.headerTitle}>Confirm Payout Plan</Text>
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
              <View style={styles.securityNotice}>
                <View style={styles.noticeIcon}>
                  <AlertTriangle size={16} color={colors.warning} />
                </View>
                <Text style={styles.noticeText}>
                  {payoutBiometricEnabled 
                    ? 'PIN verification required to confirm this payout plan'
                    : 'Please review the details below before confirming'
                  }
                </Text>
              </View>

              <View style={styles.detailsCard}>
                <Text style={styles.detailsTitle}>Payout Plan Details</Text>
                
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Plan Name</Text>
                  <Text style={styles.detailValue}>{payoutDetails.name}</Text>
                </View>
                
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Total Amount</Text>
                  <Text style={styles.detailValue}>₦{payoutDetails.totalAmount}</Text>
                </View>
                
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Payout Amount</Text>
                  <Text style={styles.detailValue}>₦{payoutDetails.payoutAmount}</Text>
                </View>
                
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Frequency</Text>
                  <Text style={styles.detailValue}>{payoutDetails.frequency}</Text>
                </View>
                
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Duration</Text>
                  <Text style={styles.detailValue}>{payoutDetails.duration}</Text>
                </View>
                
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Start Date</Text>
                  <Text style={styles.detailValue}>{payoutDetails.startDate}</Text>
                </View>
              </View>

              <View style={styles.bankCard}>
                <Text style={styles.bankTitle}>Bank Account Details</Text>
                
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Bank</Text>
                  <Text style={styles.detailValue}>{payoutDetails.bankName}</Text>
                </View>
                
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Account Name</Text>
                  <Text style={styles.detailValue}>{payoutDetails.accountName}</Text>
                </View>
                
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Account Number</Text>
                  <Text style={styles.detailValue}>{payoutDetails.accountNumber}</Text>
                </View>
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
                style={[styles.confirmButton, isProcessing && styles.disabledButton]} 
                onPress={handleConfirm}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <View style={styles.loadingContainer}>
                    <CheckCircle size={20} color="#FFFFFF" />
                    <Text style={styles.confirmButtonText}>Processing...</Text>
                  </View>
                ) : (
                  <Text style={styles.confirmButtonText}>Confirm Plan</Text>
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
        title="Verify PIN"
        description="Enter your PIN to confirm the payout plan"
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
    backgroundColor: colors.primary + '20',
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
  securityNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.warning + '15',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.warning + '30',
  },
  noticeIcon: {
    marginRight: 12,
  },
  noticeText: {
    fontSize: 14,
    color: colors.warning,
    flex: 1,
    lineHeight: 20,
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
    backgroundColor: colors.primary,
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