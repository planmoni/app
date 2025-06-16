import { Modal, View, Text, StyleSheet, Pressable, TextInput, ScrollView, ActivityIndicator, Animated, Dimensions, Platform } from 'react-native';
import { useState, useEffect, useRef } from 'react';
import { X, Search, Check, TriangleAlert as AlertTriangle } from 'lucide-react-native';
import Button from '@/components/Button';
import { useTheme } from '@/contexts/ThemeContext';
import { useHaptics } from '@/hooks/useHaptics';
import * as Haptics from 'expo-haptics';
import { usePayoutAccounts } from '@/hooks/usePayoutAccounts';
import KeyboardAvoidingWrapper from '@/components/KeyboardAvoidingWrapper';
import { useBanks, Bank } from '@/hooks/useBanks';
import { useAccountResolution } from '@/hooks/useAccountResolution';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface AddPayoutAccountModalProps {
  isVisible: boolean;
  onClose: (newAccountId?: string) => void;
}

export default function AddPayoutAccountModal({ isVisible, onClose }: AddPayoutAccountModalProps) {
  const { colors, isDark } = useTheme();
  const haptics = useHaptics();
  const { addPayoutAccount } = usePayoutAccounts();
  const { banks, isLoading: banksLoading } = useBanks();
  const { resolveAccount, isResolving, error: resolutionError, setError: setResolutionError } = useAccountResolution();
  const insets = useSafeAreaInsets();
  const { height: screenHeight, width: screenWidth } = Dimensions.get('window');
  
  // Determine if we're on a small screen
  const isSmallScreen = screenWidth < 380 || screenHeight < 700;
  
  const [formData, setFormData] = useState({
    accountName: '',
    accountNumber: '',
    bankName: ''
  });
  
  const [selectedBank, setSelectedBank] = useState<Bank | null>(null);
  const [showBankSelector, setShowBankSelector] = useState(false);
  const [bankSearchQuery, setBankSearchQuery] = useState('');
  const [accountResolved, setAccountResolved] = useState(false);
  
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newAccountId, setNewAccountId] = useState<string | undefined>(undefined);

  // Animation values
  const slideAnim = useRef(new Animated.Value(screenHeight)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const bankListSlideAnim = useRef(new Animated.Value(screenHeight)).current;

  // Filter banks based on search query
  const filteredBanks = banks.filter(bank => 
    bank.name.toLowerCase().includes(bankSearchQuery.toLowerCase())
  );

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
    if (showBankSelector) {
      // Animate bank list in
      Animated.spring(bankListSlideAnim, {
        toValue: 0,
        tension: 65,
        friction: 11,
        useNativeDriver: true,
      }).start();
    } else {
      // Animate bank list out
      Animated.timing(bankListSlideAnim, {
        toValue: screenHeight,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
  }, [showBankSelector]);

  const handleAddAccount = async () => {
    if (!validateForm()) return;
    
    try {
      setIsSubmitting(true);
      
      const newAccount = await addPayoutAccount({
        account_name: formData.accountName.trim(),
        account_number: formData.accountNumber.trim(),
        bank_name: selectedBank?.name || formData.bankName.trim(),
        is_default: false
      });
      
      haptics.notification(Haptics.NotificationFeedbackType.Success);
      setNewAccountId(newAccount?.id);
      
      // Animate out before closing
      handleClose(newAccount?.id);
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
    
    if (!selectedBank && !formData.bankName.trim()) {
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
    setSelectedBank(null);
    setAccountResolved(false);
    setFormErrors({});
    setResolutionError(null);
    setNewAccountId(undefined);
  };
  
  const handleClose = (accountId?: string) => {
    if (isSubmitting) return;
    
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
      resetForm();
      onClose(accountId || newAccountId);
    });
  };

  const handleBankSelect = (bank: Bank) => {
    setSelectedBank(bank);
    setFormData(prev => ({ ...prev, bankName: bank.name }));
    setShowBankSelector(false);
    haptics.selection();
    
    // If account number is already entered, try to resolve account
    if (formData.accountNumber.length === 10) {
      handleResolveAccount(formData.accountNumber, bank.code);
    }
  };

  const handleAccountNumberChange = (text: string) => {
    // Only allow numbers and limit to 10 digits
    const numericText = text.replace(/[^0-9]/g, '');
    if (numericText.length <= 10) {
      setFormData({...formData, accountNumber: numericText});
      
      if (formErrors.accountNumber) {
        setFormErrors({...formErrors, accountNumber: ''});
      }
      
      // Reset account resolution if account number changes
      if (accountResolved) {
        setAccountResolved(false);
        setFormData(prev => ({ ...prev, accountName: '' }));
      }
      
      // If account number is 10 digits and bank is selected, try to resolve
      if (numericText.length === 10 && selectedBank) {
        handleResolveAccount(numericText, selectedBank.code);
      }
    }
  };

  const handleResolveAccount = async (accountNumber: string, bankCode: string) => {
    if (accountNumber.length !== 10 || !bankCode) {
      return;
    }
    
    haptics.impact(Haptics.ImpactFeedbackStyle.Medium);
    
    try {
      const accountDetails = await resolveAccount(accountNumber, bankCode);
      
      if (accountDetails) {
        setFormData(prev => ({
          ...prev,
          accountName: accountDetails.account_name
        }));
        setAccountResolved(true);
        haptics.notification(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      haptics.notification(Haptics.NotificationFeedbackType.Error);
    }
  };

  // Calculate modal height - limit to 90% of screen height
  const modalMaxHeight = screenHeight * 0.9;

  const styles = createStyles(colors, isDark, isSmallScreen, insets);

  if (!isVisible) return null;

  return (
    <Animated.View 
      style={[
        styles.overlay,
        { opacity: overlayOpacity }
      ]}
      pointerEvents={isVisible ? 'auto' : 'none'}
    >
      <Pressable style={styles.overlayPressable} onPress={() => handleClose()} />
      
      <Animated.View 
        style={[
          styles.modalContent,
          { 
            transform: [{ translateY: slideAnim }],
            maxHeight: modalMaxHeight
          }
        ]}
      >
        <View style={styles.dragIndicator} />
        
        <View style={styles.header}>
          <Text style={styles.title}>Add Payout Account</Text>
          <Pressable 
            style={styles.closeButton} 
            onPress={() => handleClose()}
            disabled={isSubmitting}
          >
            <X size={isSmallScreen ? 20 : 24} color={colors.text} />
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
          
          {resolutionError && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{resolutionError}</Text>
            </View>
          )}
          
          <View style={styles.formGroup}>
            <Text style={styles.label}>Account Number</Text>
            <View style={[
              styles.inputContainer, 
              formErrors.accountNumber && styles.inputError,
              accountResolved && styles.resolvedInput
            ]}>
              <TextInput
                style={styles.input}
                placeholder="Enter 10-digit account number"
                placeholderTextColor={colors.textTertiary}
                value={formData.accountNumber}
                onChangeText={handleAccountNumberChange}
                keyboardType="numeric"
                maxLength={10}
                editable={!isSubmitting && !accountResolved}
              />
              {isResolving && (
                <ActivityIndicator size="small" color={colors.primary} style={styles.activityIndicator} />
              )}
              {accountResolved && (
                <View style={styles.resolvedIcon}>
                  <Check size={16} color={colors.success} />
                </View>
              )}
            </View>
            {formErrors.accountNumber && (
              <Text style={styles.fieldError}>{formErrors.accountNumber}</Text>
            )}
          </View>
          
          <View style={styles.formGroup}>
            <Text style={styles.label}>Bank</Text>
            <Pressable 
              style={[
                styles.bankSelector,
                formErrors.bankName && styles.inputError,
                selectedBank && styles.selectedInput
              ]}
              onPress={() => {
                if (!isSubmitting && !accountResolved) {
                  haptics.selection();
                  setShowBankSelector(true);
                }
              }}
              disabled={isSubmitting || accountResolved}
            >
              {selectedBank ? (
                <Text style={styles.selectedBankText}>{selectedBank.name}</Text>
              ) : (
                <Text style={styles.placeholderText}>Select your bank</Text>
              )}
              <ChevronDown size={isSmallScreen ? 16 : 20} color={colors.textSecondary} />
            </Pressable>
            {formErrors.bankName && (
              <Text style={styles.fieldError}>{formErrors.bankName}</Text>
            )}
          </View>
          
          <View style={styles.formGroup}>
            <Text style={styles.label}>Account Name</Text>
            <View style={[
              styles.inputContainer, 
              formErrors.accountName && styles.inputError,
              accountResolved && styles.resolvedInput
            ]}>
              <TextInput
                style={styles.input}
                placeholder={isResolving ? "Resolving account name..." : "Enter account holder name"}
                placeholderTextColor={colors.textTertiary}
                value={formData.accountName}
                onChangeText={(text) => {
                  if (!accountResolved) {
                    setFormData({...formData, accountName: text});
                    if (formErrors.accountName) {
                      setFormErrors({...formErrors, accountName: ''});
                    }
                  }
                }}
                editable={!isSubmitting && !accountResolved && !isResolving}
              />
              {accountResolved && (
                <View style={styles.resolvedIcon}>
                  <Check size={16} color={colors.success} />
                </View>
              )}
            </View>
            {formErrors.accountName && (
              <Text style={styles.fieldError}>{formErrors.accountName}</Text>
            )}
          </View>
          
          {accountResolved && (
            <View style={styles.successContainer}>
              <Check size={16} color={colors.success} />
              <Text style={styles.successText}>Account details verified successfully</Text>
            </View>
          )}
          
          <View style={styles.infoContainer}>
            <AlertTriangle size={16} color={colors.primary} />
            <Text style={styles.infoText}>
              Please ensure all details are correct. These details will be used for your payouts.
            </Text>
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
            onPress={() => handleClose()}
            variant="outline"
            style={styles.cancelButton}
            disabled={isSubmitting}
            hapticType="light"
          />
        </View>
      </Animated.View>

      {/* Bank Selection Modal */}
      <Animated.View 
        style={[
          styles.overlay,
          { 
            opacity: showBankSelector ? 1 : 0,
            zIndex: showBankSelector ? 1100 : -1,
          }
        ]}
        pointerEvents={showBankSelector ? 'auto' : 'none'}
      >
        <Pressable 
          style={styles.overlayPressable} 
          onPress={() => {
            setShowBankSelector(false);
            haptics.lightImpact();
          }} 
        />
        
        <Animated.View 
          style={[
            styles.bankSelectorModal,
            { 
              transform: [{ translateY: bankListSlideAnim }],
              maxHeight: modalMaxHeight
            }
          ]}
        >
          <View style={styles.dragIndicator} />
          
          <View style={styles.bankSelectorHeader}>
            <Text style={styles.bankSelectorTitle}>Select Bank</Text>
            <Pressable 
              style={styles.closeButton}
              onPress={() => {
                setShowBankSelector(false);
                haptics.lightImpact();
              }}
            >
              <X size={isSmallScreen ? 20 : 24} color={colors.text} />
            </Pressable>
          </View>
          
          <View style={styles.searchContainer}>
            <Search size={isSmallScreen ? 16 : 20} color={colors.textSecondary} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search banks..."
              placeholderTextColor={colors.textTertiary}
              value={bankSearchQuery}
              onChangeText={setBankSearchQuery}
              autoFocus
            />
          </View>
          
          <ScrollView style={styles.bankList} nestedScrollEnabled>
            {filteredBanks.map((bank) => (
              <Pressable
                key={bank.id}
                style={styles.bankOption}
                onPress={() => {
                  if (!isSubmitting) {
                    handleBankSelect(bank);
                  }
                }}
                disabled={isSubmitting}
              >
                <Text style={styles.bankOptionText}>{bank.name}</Text>
                {selectedBank?.id === bank.id && (
                  <Check size={isSmallScreen ? 16 : 20} color={colors.primary} />
                )}
              </Pressable>
            ))}
            
            {filteredBanks.length === 0 && (
              <View style={styles.noResultsContainer}>
                <Text style={styles.noResultsText}>No banks found</Text>
              </View>
            )}
          </ScrollView>
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
}

const createStyles = (colors: any, isDark: boolean, isSmallScreen: boolean, insets: any) => StyleSheet.create({
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
  modalContent: {
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: isSmallScreen ? 16 : 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    fontSize: isSmallScreen ? 18 : 20,
    fontWeight: '600',
    color: colors.text,
  },
  closeButton: {
    width: isSmallScreen ? 32 : 40,
    height: isSmallScreen ? 32 : 40,
    borderRadius: isSmallScreen ? 16 : 20,
    backgroundColor: colors.backgroundTertiary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  formContainer: {
    padding: isSmallScreen ? 16 : 20,
  },
  description: {
    fontSize: isSmallScreen ? 14 : 16,
    color: colors.textSecondary,
    marginBottom: isSmallScreen ? 16 : 24,
    lineHeight: isSmallScreen ? 20 : 24,
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
    fontSize: isSmallScreen ? 12 : 14,
  },
  formGroup: {
    marginBottom: isSmallScreen ? 16 : 20,
  },
  label: {
    fontSize: isSmallScreen ? 12 : 14,
    fontWeight: '500',
    color: colors.text,
    marginBottom: isSmallScreen ? 6 : 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: isSmallScreen ? 12 : 16,
    backgroundColor: colors.backgroundTertiary,
  },
  input: {
    flex: 1,
    fontSize: isSmallScreen ? 14 : 16,
    color: colors.text,
  },
  bankSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: isSmallScreen ? 12 : 16,
    backgroundColor: colors.backgroundTertiary,
  },
  placeholderText: {
    fontSize: isSmallScreen ? 14 : 16,
    color: colors.textTertiary,
  },
  selectedBankText: {
    fontSize: isSmallScreen ? 14 : 16,
    color: colors.text,
  },
  inputError: {
    borderColor: colors.error,
  },
  selectedInput: {
    borderColor: colors.primary,
    backgroundColor: isDark ? 'rgba(59, 130, 246, 0.1)' : '#F0F9FF',
  },
  resolvedInput: {
    borderColor: colors.success,
    backgroundColor: isDark ? 'rgba(34, 197, 94, 0.1)' : '#F0FDF4',
  },
  fieldError: {
    fontSize: isSmallScreen ? 10 : 12,
    color: colors.error,
    marginTop: 4,
  },
  activityIndicator: {
    marginLeft: 8,
  },
  resolvedIcon: {
    width: isSmallScreen ? 20 : 24,
    height: isSmallScreen ? 20 : 24,
    borderRadius: isSmallScreen ? 10 : 12,
    backgroundColor: isDark ? 'rgba(34, 197, 94, 0.2)' : '#DCFCE7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  successContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: isDark ? 'rgba(34, 197, 94, 0.1)' : '#F0FDF4',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  successText: {
    fontSize: isSmallScreen ? 12 : 14,
    color: colors.success,
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
    fontSize: isSmallScreen ? 12 : 14,
    color: colors.textSecondary,
    lineHeight: isSmallScreen ? 18 : 20,
  },
  footer: {
    padding: isSmallScreen ? 16 : 20,
    paddingBottom: Math.max(isSmallScreen ? 16 : 20, insets.bottom),
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
  bankSelectorModal: {
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
  bankSelectorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: isSmallScreen ? 16 : 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  bankSelectorTitle: {
    fontSize: isSmallScreen ? 18 : 20,
    fontWeight: '600',
    color: colors.text,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: isSmallScreen ? 12 : 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.backgroundTertiary,
  },
  searchInput: {
    flex: 1,
    fontSize: isSmallScreen ? 14 : 16,
    color: colors.text,
    marginLeft: 12,
  },
  bankList: {
    maxHeight: isSmallScreen ? '40%' : '50%',
  },
  bankOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: isSmallScreen ? 12 : 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  bankOptionText: {
    fontSize: isSmallScreen ? 14 : 16,
    color: colors.text,
  },
  noResultsContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noResultsText: {
    fontSize: isSmallScreen ? 14 : 16,
    color: colors.textSecondary,
  },
});