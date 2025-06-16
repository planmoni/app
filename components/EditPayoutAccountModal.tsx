import { Modal, View, Text, StyleSheet, Pressable, TextInput, ActivityIndicator } from 'react-native';
import { useState, useEffect } from 'react';
import { X, Check, TriangleAlert as AlertTriangle } from 'lucide-react-native';
import Button from '@/components/Button';
import { useTheme } from '@/contexts/ThemeContext';
import { useHaptics } from '@/hooks/useHaptics';
import * as Haptics from 'expo-haptics';
import { usePayoutAccounts } from '@/hooks/usePayoutAccounts';
import KeyboardAvoidingWrapper from '@/components/KeyboardAvoidingWrapper';

interface EditPayoutAccountModalProps {
  isVisible: boolean;
  onClose: () => void;
  account: any;
}

export default function EditPayoutAccountModal({ isVisible, onClose, account }: EditPayoutAccountModalProps) {
  const { colors, isDark } = useTheme();
  const haptics = useHaptics();
  const { updatePayoutAccount } = usePayoutAccounts();
  
  const [formData, setFormData] = useState({
    accountName: '',
    accountNumber: '',
    bankName: ''
  });
  
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (account) {
      setFormData({
        accountName: account.account_name || '',
        accountNumber: account.account_number || '',
        bankName: account.bank_name || ''
      });
    }
  }, [account]);

  const handleUpdateAccount = async () => {
    if (!validateForm()) return;
    
    try {
      setIsSubmitting(true);
      
      await updatePayoutAccount(account.id, {
        account_name: formData.accountName.trim(),
        account_number: formData.accountNumber.trim(),
        bank_name: formData.bankName.trim()
      });
      
      haptics.notification(Haptics.NotificationFeedbackType.Success);
      onClose();
    } catch (error) {
      haptics.notification(Haptics.NotificationFeedbackType.Error);
      setFormErrors({
        general: error instanceof Error ? error.message : 'Failed to update account'
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const validateForm = () => {
    const errors: Record<string, string> = {};
    
    if (!formData.accountName.trim()) {
      errors.accountName = 'Account name is required';
    }
    
    if (!formData.accountNumber.trim()) {
      errors.accountNumber = 'Account number is required';
    } else if (!/^\d{10}$/.test(formData.accountNumber)) {
      errors.accountNumber = 'Account number must be 10 digits';
    }
    
    if (!formData.bankName.trim()) {
      errors.bankName = 'Bank name is required';
    }
    
    setFormErrors(errors);
    
    if (Object.keys(errors).length > 0) {
      haptics.notification(Haptics.NotificationFeedbackType.Error);
    }
    
    return Object.keys(errors).length === 0;
  };
  
  const handleClose = () => {
    if (!isSubmitting) {
      onClose();
    }
  };

  const styles = createStyles(colors, isDark);

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={isVisible}
      onRequestClose={handleClose}
      statusBarTranslucent={true}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.header}>
            <Text style={styles.title}>Edit Payout Account</Text>
            <Pressable 
              style={styles.closeButton} 
              onPress={handleClose}
              disabled={isSubmitting}
            >
              <X size={24} color={colors.text} />
            </Pressable>
          </View>
          
          <KeyboardAvoidingWrapper contentContainerStyle={styles.formContainer}>
            {formErrors.general && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{formErrors.general}</Text>
              </View>
            )}
            
            <View style={styles.formGroup}>
              <Text style={styles.label}>Account Name</Text>
              <View style={[styles.inputContainer, formErrors.accountName && styles.inputError]}>
                <TextInput
                  style={styles.input}
                  placeholder="Enter account holder name"
                  placeholderTextColor={colors.textTertiary}
                  value={formData.accountName}
                  onChangeText={(text) => {
                    setFormData({...formData, accountName: text});
                    if (formErrors.accountName) {
                      setFormErrors({...formErrors, accountName: ''});
                    }
                  }}
                  editable={!isSubmitting}
                />
              </View>
              {formErrors.accountName && (
                <Text style={styles.fieldError}>{formErrors.accountName}</Text>
              )}
            </View>
            
            <View style={styles.formGroup}>
              <Text style={styles.label}>Account Number</Text>
              <View style={[styles.inputContainer, formErrors.accountNumber && styles.inputError]}>
                <TextInput
                  style={styles.input}
                  placeholder="Enter 10-digit account number"
                  placeholderTextColor={colors.textTertiary}
                  value={formData.accountNumber}
                  onChangeText={(text) => {
                    // Only allow numbers and limit to 10 digits
                    const numericText = text.replace(/[^0-9]/g, '');
                    if (numericText.length <= 10) {
                      setFormData({...formData, accountNumber: numericText});
                      if (formErrors.accountNumber) {
                        setFormErrors({...formErrors, accountNumber: ''});
                      }
                    }
                  }}
                  keyboardType="numeric"
                  maxLength={10}
                  editable={!isSubmitting}
                />
              </View>
              {formErrors.accountNumber && (
                <Text style={styles.fieldError}>{formErrors.accountNumber}</Text>
              )}
            </View>
            
            <View style={styles.formGroup}>
              <Text style={styles.label}>Bank Name</Text>
              <View style={[styles.inputContainer, formErrors.bankName && styles.inputError]}>
                <TextInput
                  style={styles.input}
                  placeholder="Enter bank name"
                  placeholderTextColor={colors.textTertiary}
                  value={formData.bankName}
                  onChangeText={(text) => {
                    setFormData({...formData, bankName: text});
                    if (formErrors.bankName) {
                      setFormErrors({...formErrors, bankName: ''});
                    }
                  }}
                  editable={!isSubmitting}
                />
              </View>
              {formErrors.bankName && (
                <Text style={styles.fieldError}>{formErrors.bankName}</Text>
              )}
            </View>
            
            <View style={styles.infoContainer}>
              <AlertTriangle size={16} color={colors.primary} />
              <Text style={styles.infoText}>
                Please ensure all details are correct. These details will be used for your payouts.
              </Text>
            </View>
          </KeyboardAvoidingWrapper>
          
          <View style={styles.footer}>
            <Button
              title="Save Changes"
              onPress={handleUpdateAccount}
              isLoading={isSubmitting}
              style={styles.saveButton}
              hapticType="success"
            />
            <Button
              title="Cancel"
              onPress={handleClose}
              variant="outline"
              style={styles.cancelButton}
              disabled={isSubmitting}
              hapticType="light"
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    width: '100%',
    maxHeight: '90%',
    borderWidth: isDark ? 1 : 0,
    borderColor: isDark ? colors.border : 'transparent',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.backgroundTertiary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  formContainer: {
    padding: 20,
  },
  errorContainer: {
    backgroundColor: colors.errorLight,
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.error,
  },
  errorText: {
    color: colors.error,
    fontSize: 14,
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 16,
    backgroundColor: colors.backgroundTertiary,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
  },
  inputError: {
    borderColor: colors.error,
  },
  fieldError: {
    fontSize: 12,
    color: colors.error,
    marginTop: 4,
  },
  infoContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: isDark ? 'rgba(59, 130, 246, 0.1)' : '#EFF6FF',
    padding: 12,
    borderRadius: 8,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  footer: {
    padding: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  saveButton: {
    backgroundColor: colors.primary,
  },
  cancelButton: {
    borderColor: colors.border,
  },
});