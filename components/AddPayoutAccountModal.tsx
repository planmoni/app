import { Modal, View, Text, StyleSheet, Pressable, TextInput } from 'react-native';
import { useState } from 'react';
import { X } from 'lucide-react-native';
import Button from '@/components/Button';
import { useTheme } from '@/contexts/ThemeContext';
import { useHaptics } from '@/hooks/useHaptics';
import * as Haptics from 'expo-haptics';
import { usePayoutAccounts } from '@/hooks/usePayoutAccounts';
import KeyboardAvoidingWrapper from '@/components/KeyboardAvoidingWrapper';

interface AddPayoutAccountModalProps {
  isVisible: boolean;
  onClose: () => void;
}

export default function AddPayoutAccountModal({ isVisible, onClose }: AddPayoutAccountModalProps) {
  const { colors, isDark } = useTheme();
  const haptics = useHaptics();
  const { addPayoutAccount } = usePayoutAccounts();
  
  const [formData, setFormData] = useState({
    accountName: '',
    accountNumber: '',
    bankName: ''
  });
  
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAddAccount = async () => {
    if (!validateForm()) return;
    
    try {
      setIsSubmitting(true);
      
      await addPayoutAccount({
        account_name: formData.accountName.trim(),
        account_number: formData.accountNumber.trim(),
        bank_name: formData.bankName.trim()
      });
      
      haptics.notification(Haptics.NotificationFeedbackType.Success);
      resetForm();
      onClose();
    } catch (error) {
      haptics.notification(Haptics.NotificationFeedbackType.Error);
      setFormErrors({
        general: error instanceof Error ? error.message : 'Failed to add account'
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
  
  const resetForm = () => {
    setFormData({
      accountName: '',
      accountNumber: '',
      bankName: ''
    });
    setFormErrors({});
  };
  
  const handleClose = () => {
    if (!isSubmitting) {
      resetForm();
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
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.header}>
            <Text style={styles.title}>Add Payout Account</Text>
            <Pressable 
              style={styles.closeButton} 
              onPress={handleClose}
              disabled={isSubmitting}
            >
              <X size={24} color={colors.text} />
            </Pressable>
          </View>
          
          <KeyboardAvoidingWrapper contentContainerStyle={styles.formContainer}>
            <Text style={styles.description}>
              Add a bank account where you want to receive payouts
            </Text>
            
            {formErrors.general && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{formErrors.general}</Text>
              </View>
            )}
            
            <View style={styles.formGroup}>
              <Text style={styles.label}>Account Name</Text>
              <TextInput
                style={[styles.input, formErrors.accountName && styles.inputError]}
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
              {formErrors.accountName && (
                <Text style={styles.fieldError}>{formErrors.accountName}</Text>
              )}
            </View>
            
            <View style={styles.formGroup}>
              <Text style={styles.label}>Account Number</Text>
              <TextInput
                style={[styles.input, formErrors.accountNumber && styles.inputError]}
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
              {formErrors.accountNumber && (
                <Text style={styles.fieldError}>{formErrors.accountNumber}</Text>
              )}
            </View>
            
            <View style={styles.formGroup}>
              <Text style={styles.label}>Bank Name</Text>
              <TextInput
                style={[styles.input, formErrors.bankName && styles.inputError]}
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
              {formErrors.bankName && (
                <Text style={styles.fieldError}>{formErrors.bankName}</Text>
              )}
            </View>
          </KeyboardAvoidingWrapper>
          
          <View style={styles.footer}>
            <Button
              title="Add Account"
              onPress={handleAddAccount}
              isLoading={isSubmitting}
              style={styles.addButton}
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
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    width: '100%',
    maxWidth: 500,
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
  description: {
    fontSize: 16,
    color: colors.textSecondary,
    marginBottom: 24,
    lineHeight: 24,
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
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.backgroundTertiary,
  },
  inputError: {
    borderColor: colors.error,
  },
  fieldError: {
    fontSize: 12,
    color: colors.error,
    marginTop: 4,
  },
  footer: {
    padding: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  addButton: {
    backgroundColor: colors.primary,
  },
  cancelButton: {
    borderColor: colors.border,
  },
});