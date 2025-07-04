import { Modal, View, Text, StyleSheet, Pressable, ScrollView, Alert, TextInput, Animated, Dimensions, Platform } from 'react-native';
import { useState, useEffect, useRef } from 'react';
import { X, Plus, CreditCard, ChevronRight, Check, Trash2, LocationEdit as Edit2 } from 'lucide-react-native';
import Button from '@/components/Button';
import { useTheme } from '@/contexts/ThemeContext';
import { useHaptics } from '@/hooks/useHaptics';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface PayoutAccountsModalProps {
  isVisible: boolean;
  onClose: () => void;
}

// Mock data for payout accounts
type PayoutAccount = {
  id: string;
  name: string;
  accountNumber: string;
  bankName: string;
  isDefault: boolean;
  status: 'active' | 'pending' | 'failed';
};

export default function PayoutAccountsModal({ isVisible, onClose }: PayoutAccountsModalProps) {
  const { colors, isDark } = useTheme();
  const haptics = useHaptics();
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = Dimensions.get('window');
  
  const [payoutAccounts, setPayoutAccounts] = useState<PayoutAccount[]>([
    {
      id: '1',
      name: 'John Doe',
      accountNumber: '0123456789',
      bankName: 'GTBank',
      isDefault: true,
      status: 'active'
    },
    {
      id: '2',
      name: 'John Doe',
      accountNumber: '9876543210',
      bankName: 'First Bank',
      isDefault: false,
      status: 'active'
    },
    {
      id: '3',
      name: 'John Doe',
      accountNumber: '5678901234',
      bankName: 'Access Bank',
      isDefault: false,
      status: 'pending'
    }
  ]);
  
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [showEditAccount, setShowEditAccount] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<PayoutAccount | null>(null);
  
  // Form state for adding/editing account
  const [formData, setFormData] = useState({
    accountName: '',
    accountNumber: '',
    bankName: ''
  });
  
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  
  // Animation values
  const slideAnim = useRef(new Animated.Value(screenHeight)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const formSlideAnim = useRef(new Animated.Value(screenHeight)).current;
  
  useEffect(() => {
    if (isVisible) {
      // Animate modal in
      Animated.parallel([
        Animated.timing(overlayOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 65,
          friction: 11,
          useNativeDriver: true,
        })
      ]).start();
    }
  }, [isVisible]);
  
  useEffect(() => {
    if (showAddAccount || showEditAccount) {
      // Animate form in
      Animated.spring(formSlideAnim, {
        toValue: 0,
        tension: 65,
        friction: 11,
        useNativeDriver: true,
      }).start();
    } else {
      // Animate form out
      Animated.timing(formSlideAnim, {
        toValue: screenHeight,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
  }, [showAddAccount, showEditAccount]);
  
  useEffect(() => {
    if (selectedAccount && showEditAccount) {
      setFormData({
        accountName: selectedAccount.name,
        accountNumber: selectedAccount.accountNumber,
        bankName: selectedAccount.bankName
      });
    } else {
      setFormData({
        accountName: '',
        accountNumber: '',
        bankName: ''
      });
    }
    setFormErrors({});
  }, [selectedAccount, showEditAccount, showAddAccount]);
  
  const handleAddAccount = () => {
    if (!validateForm()) return;
    
    haptics.success();
    
    const newAccount: PayoutAccount = {
      id: Date.now().toString(),
      name: formData.accountName,
      accountNumber: formData.accountNumber,
      bankName: formData.bankName,
      isDefault: payoutAccounts.length === 0,
      status: 'pending'
    };
    
    setPayoutAccounts([...payoutAccounts, newAccount]);
    
    // Animate form out
    Animated.timing(formSlideAnim, {
      toValue: screenHeight,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      setShowAddAccount(false);
      setFormData({
        accountName: '',
        accountNumber: '',
        bankName: ''
      });
    });
  };
  
  const handleEditAccount = () => {
    if (!validateForm() || !selectedAccount) return;
    
    haptics.success();
    
    const updatedAccounts = payoutAccounts.map(account => 
      account.id === selectedAccount.id 
        ? {
            ...account,
            name: formData.accountName,
            accountNumber: formData.accountNumber,
            bankName: formData.bankName
          }
        : account
    );
    
    setPayoutAccounts(updatedAccounts);
    
    // Animate form out
    Animated.timing(formSlideAnim, {
      toValue: screenHeight,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      setShowEditAccount(false);
      setSelectedAccount(null);
    });
  };
  
  const handleDeleteAccount = (account: PayoutAccount) => {
    haptics.notification(Haptics.NotificationFeedbackType.Warning);
    
    Alert.alert(
      "Delete Account",
      `Are you sure you want to delete ${account.bankName} account ending in ${account.accountNumber.slice(-4)}?`,
      [
        {
          text: "Cancel",
          style: "cancel",
          onPress: () => haptics.lightImpact()
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            haptics.heavyImpact();
            const updatedAccounts = payoutAccounts.filter(a => a.id !== account.id);
            
            // If we deleted the default account and there are other accounts, make the first one default
            if (account.isDefault && updatedAccounts.length > 0) {
              updatedAccounts[0].isDefault = true;
            }
            
            setPayoutAccounts(updatedAccounts);
          }
        }
      ]
    );
  };
  
  const handleSetDefault = (account: PayoutAccount) => {
    haptics.selection();
    
    if (account.isDefault) return;
    
    const updatedAccounts = payoutAccounts.map(a => ({
      ...a,
      isDefault: a.id === account.id
    }));
    
    setPayoutAccounts(updatedAccounts);
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
      haptics.error();
    }
    
    return Object.keys(errors).length === 0;
  };
  
  const handleClose = () => {
    // Animate out before closing
    Animated.parallel([
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: screenHeight,
        duration: 250,
        useNativeDriver: true,
      })
    ]).start(() => {
      onClose();
    });
  };
  
  // Calculate modal height - limit to 90% of screen height
  const modalMaxHeight = screenHeight * 0.9;
  
  const styles = createStyles(colors, isDark, insets);
  
  if (!isVisible) return null;
  
  const renderAddEditForm = () => (
    <Animated.View 
      style={[
        styles.overlay,
        { 
          opacity: showAddAccount || showEditAccount ? 1 : 0,
          zIndex: showAddAccount || showEditAccount ? 1100 : -1,
        }
      ]}
      pointerEvents={showAddAccount || showEditAccount ? 'auto' : 'none'}
    >
      <Pressable 
        style={styles.overlayPressable} 
        onPress={() => {
          if (showAddAccount) {
            setShowAddAccount(false);
          } else {
            setShowEditAccount(false);
            setSelectedAccount(null);
          }
          haptics.lightImpact();
        }} 
      />
      
      <Animated.View 
        style={[
          styles.formContainer,
          { 
            transform: [{ translateY: formSlideAnim }],
            maxHeight: modalMaxHeight
          }
        ]}
      >
        <View style={styles.dragIndicator} />
        
        <View style={styles.formHeader}>
          <Text style={styles.formTitle}>
            {showEditAccount ? 'Edit Payout Account' : 'Add Payout Account'}
          </Text>
          <Pressable 
            style={styles.closeButton} 
            onPress={() => {
              haptics.lightImpact();
              if (showAddAccount) {
                setShowAddAccount(false);
              } else {
                setShowEditAccount(false);
                setSelectedAccount(null);
              }
            }}
          >
            <X size={24} color={colors.text} />
          </Pressable>
        </View>
        
        <ScrollView style={styles.formScrollView}>
          <View style={styles.formContent}>
            <View style={styles.formGroup}>
              <Text style={styles.label}>Account Name</Text>
              <TextInput
                style={[styles.input, formErrors.accountName && styles.inputError]}
                placeholder="Enter account holder name"
                placeholderTextColor={colors.textTertiary}
                value={formData.accountName}
                onChangeText={(text) => setFormData({...formData, accountName: text})}
              />
              {formErrors.accountName && (
                <Text style={styles.errorText}>{formErrors.accountName}</Text>
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
                  }
                }}
                keyboardType="numeric"
                maxLength={10}
              />
              {formErrors.accountNumber && (
                <Text style={styles.errorText}>{formErrors.accountNumber}</Text>
              )}
            </View>
            
            <View style={styles.formGroup}>
              <Text style={styles.label}>Bank Name</Text>
              <TextInput
                style={[styles.input, formErrors.bankName && styles.inputError]}
                placeholder="Enter bank name"
                placeholderTextColor={colors.textTertiary}
                value={formData.bankName}
                onChangeText={(text) => setFormData({...formData, bankName: text})}
              />
              {formErrors.bankName && (
                <Text style={styles.errorText}>{formErrors.bankName}</Text>
              )}
            </View>
          </View>
        </ScrollView>
        
        <View style={styles.formActions}>
          <Button
            title="Cancel"
            variant="outline"
            style={styles.cancelButton}
            onPress={() => {
              haptics.lightImpact();
              if (showAddAccount) {
                setShowAddAccount(false);
              } else {
                setShowEditAccount(false);
                setSelectedAccount(null);
              }
            }}
          />
          <Button
            title={showEditAccount ? "Save Changes" : "Add Account"}
            style={styles.submitButton}
            onPress={showEditAccount ? handleEditAccount : handleAddAccount}
            hapticType="success"
          />
        </View>
      </Animated.View>
    </Animated.View>
  );
  
  return (
    <Animated.View 
      style={[
        styles.overlay,
        { opacity: overlayOpacity }
      ]}
      pointerEvents={isVisible ? 'auto' : 'none'}
    >
      <Pressable style={styles.overlayPressable} onPress={handleClose} />
      
      <Animated.View 
        style={[
          styles.modal,
          { 
            transform: [{ translateY: slideAnim }],
            maxHeight: modalMaxHeight
          }
        ]}
      >
        <View style={styles.dragIndicator} />
        
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Payout Accounts</Text>
          <Pressable 
            style={styles.closeButton} 
            onPress={handleClose}
          >
            <X size={24} color={colors.text} />
          </Pressable>
        </View>
        
        <Text style={styles.modalDescription}>
          Manage accounts where you receive payouts from your plans
        </Text>
        
        <ScrollView style={styles.accountsList}>
          {payoutAccounts.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>No payout accounts added yet</Text>
              <Text style={styles.emptyStateSubtext}>Add an account to receive payouts</Text>
            </View>
          ) : (
            payoutAccounts.map((account) => (
              <View key={account.id} style={styles.accountCard}>
                <View style={styles.accountHeader}>
                  <View style={styles.accountIcon}>
                    <CreditCard size={24} color={colors.primary} />
                  </View>
                  <View style={styles.accountInfo}>
                    <Text style={styles.accountName}>{account.bankName}</Text>
                    <Text style={styles.accountNumber}>•••• {account.accountNumber.slice(-4)}</Text>
                    <Text style={styles.accountHolderName}>{account.name}</Text>
                    
                    <View style={styles.accountStatus}>
                      {account.isDefault && (
                        <View style={styles.defaultBadge}>
                          <Text style={styles.defaultBadgeText}>Default</Text>
                        </View>
                      )}
                      
                      {account.status === 'pending' && (
                        <View style={styles.pendingBadge}>
                          <Text style={styles.pendingBadgeText}>Pending Verification</Text>
                        </View>
                      )}
                    </View>
                  </View>
                </View>
                
                <View style={styles.accountActions}>
                  {!account.isDefault && (
                    <Pressable 
                      style={styles.actionButton}
                      onPress={() => handleSetDefault(account)}
                    >
                      <Check size={16} color={colors.primary} />
                      <Text style={styles.actionButtonText}>Set Default</Text>
                    </Pressable>
                  )}
                  
                  <Pressable 
                    style={styles.actionButton}
                    onPress={() => {
                      haptics.selection();
                      setSelectedAccount(account);
                      setShowEditAccount(true);
                    }}
                  >
                    <Edit2 size={16} color={colors.text} />
                    <Text style={styles.actionButtonText}>Edit</Text>
                  </Pressable>
                  
                  {!account.isDefault && (
                    <Pressable 
                      style={[styles.actionButton, styles.deleteButton]}
                      onPress={() => handleDeleteAccount(account)}
                    >
                      <Trash2 size={16} color="#EF4444" />
                      <Text style={styles.deleteButtonText}>Delete</Text>
                    </Pressable>
                  )}
                </View>
              </View>
            ))
          )}
        </ScrollView>
        
        <View style={styles.addButtonContainer}>
          <Button
            title="Add New Account"
            icon={Plus}
            style={styles.addButton}
            onPress={() => {
              haptics.mediumImpact();
              setShowAddAccount(true);
            }}
            hapticType="medium"
          />
        </View>
      </Animated.View>
      
      {renderAddEditForm()}
    </Animated.View>
  );
}

const createStyles = (colors: any, isDark: boolean, insets: any) => StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
    zIndex: 1000,
  },
  overlayPressable: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  modal: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    width: '100%',
    borderWidth: isDark ? 1 : 0,
    borderColor: isDark ? colors.border : 'transparent',
    // Add shadow for iOS
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -3 },
        shadowOpacity: 0.1,
        shadowRadius: 5,
      },
      android: {
        elevation: 5,
      },
    }),
  },
  dragIndicator: {
    width: 40,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
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
  modalDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 20,
  },
  accountsList: {
    flex: 1,
    maxHeight: '60%',
    padding: 20,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  accountCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  accountHeader: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  accountIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.backgroundTertiary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  accountInfo: {
    flex: 1,
  },
  accountName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  accountNumber: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  accountHolderName: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  accountStatus: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  defaultBadge: {
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  defaultBadgeText: {
    fontSize: 12,
    color: '#22C55E',
    fontWeight: '500',
  },
  pendingBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  pendingBadgeText: {
    fontSize: 12,
    color: '#D97706',
    fontWeight: '500',
  },
  accountActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.backgroundTertiary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionButtonText: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '500',
  },
  deleteButton: {
    backgroundColor: isDark ? 'rgba(239, 68, 68, 0.1)' : '#FEF2F2',
    borderColor: '#FECACA',
  },
  deleteButtonText: {
    color: '#EF4444',
  },
  addButtonContainer: {
    padding: 20,
    paddingBottom: Math.max(20, insets.bottom),
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  addButton: {
    backgroundColor: colors.primary,
  },
  formContainer: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    width: '100%',
    borderWidth: isDark ? 1 : 0,
    borderColor: isDark ? colors.border : 'transparent',
    // Add shadow for iOS
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -3 },
        shadowOpacity: 0.1,
        shadowRadius: 5,
      },
      android: {
        elevation: 5,
      },
    }),
  },
  formHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  formTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
  },
  formScrollView: {
    maxHeight: 400,
  },
  formContent: {
    padding: 20,
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
    borderColor: '#EF4444',
  },
  errorText: {
    fontSize: 12,
    color: '#EF4444',
    marginTop: 4,
  },
  formActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    padding: 20,
    paddingBottom: Math.max(20, insets.bottom),
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  cancelButton: {
    flex: 1,
    borderColor: colors.border,
  },
  submitButton: {
    flex: 1,
    backgroundColor: colors.primary,
  },
});