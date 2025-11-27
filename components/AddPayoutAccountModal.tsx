import React, { useState, useEffect, useRef } from 'react';
import { Modal, View, Text, StyleSheet, Pressable, TextInput, ScrollView, ActivityIndicator, Animated, Dimensions, Platform, Image, KeyboardAvoidingView , useWindowDimensions } from 'react-native';
import { X, Check, TriangleAlert as AlertTriangle, ChevronDown } from 'lucide-react-native';
import { Ionicons } from '@expo/vector-icons';
import Button from '@/components/Button';
import { useTheme } from '@/contexts/ThemeContext';
import { useHaptics } from '@/hooks/useHaptics';
import * as Haptics from 'expo-haptics';
import { usePayoutAccounts } from '@/hooks/usePayoutAccounts';
import KeyboardAvoidingWrapper from '@/components/KeyboardAvoidingWrapper';
import { useBanks, Bank } from '@/hooks/useBanks';
import { useAccountResolution } from '@/hooks/useAccountResolution';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getSafeHavenBankCode } from '@/lib/safehaven-bank-mapper';

interface AddPayoutAccountModalProps {
  isVisible: boolean;
  onClose: (newAccount?: any) => void;
}

export default function AddPayoutAccountModal({ isVisible, onClose }: AddPayoutAccountModalProps) {
  const { colors, isDark } = useTheme();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const haptics = useHaptics();
  const { addPayoutAccount } = usePayoutAccounts();
  const { banks, isLoading: banksLoading } = useBanks();
  const { resolveAccount, isResolving, error: resolutionError, setError: setResolutionError } = useAccountResolution();
  
  // Debug logging
  useEffect(() => {
    console.log('AddPayoutAccountModal - Banks state:', {
      banksCount: banks.length,
      banksLoading,
      banks: banks.slice(0, 3) // Log first 3 banks for debugging
    });
  }, [banks, banksLoading]);

  // Determine if we're on a small screen
  const isSmallScreen = width < 380 || height < 700;
  
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

  // Animation values
  const slideAnim = useRef(new Animated.Value(height)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const bankListSlideAnim = useRef(new Animated.Value(height)).current;

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
        toValue: height,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
  }, [showBankSelector]);

  const handleAddAccount = async () => {
    if (!validateForm()) {
      haptics.error();
      return;
    }
    
    try {
      setIsSubmitting(true);
      haptics.impact();
      
      const bankName = selectedBank?.name || formData.bankName.trim();
      const bankCode = selectedBank?.code || null;
      const safeHavenBankCode = getSafeHavenBankCode(bankCode, bankName);
      
      // Prepare account data with bank codes
      const accountData = {
        account_name: formData.accountName.trim(),
        account_number: formData.accountNumber.trim(),
        bank_name: bankName,
        ...(bankCode && { bank_code: bankCode }),
        ...(safeHavenBankCode && { safehaven_bank_code: safeHavenBankCode })
      };
      
      // Log the data being sent for debugging
      console.log('📤 Adding payout account with data:', {
        account_name: accountData.account_name,
        account_number: accountData.account_number,
        bank_name: accountData.bank_name,
        bank_code: accountData.bank_code || 'N/A',
        safehaven_bank_code: accountData.safehaven_bank_code || 'N/A',
        selectedBank: selectedBank ? {
          name: selectedBank.name,
          code: selectedBank.code
        } : 'N/A'
      });
      
      const newAccount = await addPayoutAccount(accountData);
      
      haptics.notification(Haptics.NotificationFeedbackType.Success);
      resetForm();
      onClose(newAccount);
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
    
    // Validate that bank_code exists when a bank is selected
    if (selectedBank && !selectedBank.code) {
      errors.bankName = 'Selected bank is missing bank code. Please select a different bank.';
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
  };
  
  const handleClose = () => {
    if (isSubmitting) return;
    
    // Animate out before closing
    Animated.parallel([
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: height,
        duration: 250,
        useNativeDriver: true,
      })
    ]).start(() => {
      resetForm();
      onClose();
    });
  };

  const handleBankSelect = (bank: Bank) => {
    setSelectedBank(bank);
    setFormData(prev => ({ ...prev, bankName: bank.name }));
    setShowBankSelector(false);
    haptics.selection();
    
    // Clear any previously resolved account details when bank changes
    if (accountResolved) {
      setAccountResolved(false);
      setFormData(prev => ({ ...prev, accountName: '' }));
      setResolutionError(null);
    }
    
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
        setResolutionError(null);
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

  const styles = createStyles(colors, isDark, isSmallScreen, insets);

  return (
    <Modal
      animationType="none"
      transparent={true}
      visible={isVisible}
      onRequestClose={handleClose}
      statusBarTranslucent={true}
    >
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
              transform: [{ translateY: slideAnim }]
            }
          ]}
        >
          <View style={styles.dragIndicator} />
          
          <View style={styles.header}>
            <Text style={styles.title}>Add Payout Account</Text>
            <Pressable 
              style={styles.closeButton} 
              onPress={handleClose}
              disabled={isSubmitting}
            >
              <X size={isSmallScreen ? 20 : 24} color={colors.text} />
            </Pressable>
          </View>

          <KeyboardAvoidingWrapper contentContainerStyle={styles.content} disableScrollView={false}>
            <View style={styles.contentInner}>
              <Text style={styles.subtitle}>Enter your bank account details</Text>
              
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

              <View style={styles.field}>
                <Text style={styles.label}>Account Number</Text>
                <View style={[
                  styles.inputContainer,
                  formData.accountNumber.trim() !== '' && styles.inputContainerFilled,
                  formErrors.accountNumber && styles.inputContainerError,
                  accountResolved && styles.resolvedInput
                ]}>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter 10-digit account number"
                    placeholderTextColor={colors.textTertiary}
                    keyboardType="numeric"
                    value={formData.accountNumber}
                    onChangeText={handleAccountNumberChange}
                    maxLength={10}
                    editable={true}
                    // editable={!isSubmitting && !accountResolved}
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

              <View style={styles.field}>
                <Text style={styles.label}>Select Bank</Text>
                <Pressable 
                  style={[
                    styles.bankSelector,
                    formErrors.bankName && styles.inputError,
                    selectedBank && styles.selectedInput
                  ]}
                  onPress={() => {
                    // if (!isSubmitting && !accountResolved) {
                    if (!isSubmitting ) {
                      haptics.selection();
                      setShowBankSelector(true);
                    }
                  }}
                  // disabled={isSubmitting || accountResolved}
                >
                  {selectedBank ? (
                    <Text style={styles.selectedBankText}>{selectedBank.name}</Text>
                  ) : (
                    <Text style={styles.placeholderText}>Choose your bank</Text>
                  )}
                  <ChevronDown size={20} color={colors.textSecondary} />
                </Pressable>
                {formErrors.bankName && (
                  <Text style={styles.fieldError}>{formErrors.bankName}</Text>
                )}
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Account Name</Text>
                <View style={[
                  styles.inputContainer,
                  formData.accountName.trim() !== '' && styles.inputContainerFilled,
                  formErrors.accountName && styles.inputContainerError,
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
                    editable={false}
                    // editable={!isSubmitting && !accountResolved && !isResolving}
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
            </View>
          </KeyboardAvoidingWrapper>
          
          <View style={styles.footer}>
            <Button
              title="Use this Account"
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
        </Animated.View>
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
        
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardAvoidingContainer}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <Animated.View 
            style={[
              styles.bankListModal,
              { 
                transform: [{ translateY: bankListSlideAnim }]
              }
            ]}
          >
            <View style={styles.dragIndicator} />
            
            <View style={styles.bankListHeader}>
              <Text style={styles.bankListTitle}>Select Bank</Text>
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
              <TextInput
                style={styles.searchInput}
                placeholder="Search banks..."
                placeholderTextColor={colors.textTertiary}
                value={bankSearchQuery}
                onChangeText={setBankSearchQuery}
                autoFocus
                returnKeyType="search"
                clearButtonMode="while-editing"
              />
            </View>
            
            <ScrollView 
              style={styles.bankList} 
              nestedScrollEnabled
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {banksLoading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color={colors.primary} />
                  <Text style={styles.loadingText}>Loading banks...</Text>
                </View>
              ) : (
                filteredBanks.map((bank) => (
                  <Pressable
                    key={bank.id}
                    style={styles.bankOption}
                    onPress={() => handleBankSelect(bank)}
                  >
                    <View style={styles.bankOptionContent}>
                      {bank.logoSvg ? (
                        // Handle SVG components
                        <View style={styles.bankOptionLogo}>
                          {React.createElement(bank.logoSvg.default || bank.logoSvg, {
                            width: 32,
                            height: 32,
                            fill: colors.textSecondary
                          })}
                        </View>
                      ) : bank.logo ? (
                        <Image
                          source={bank.logo as any}
                          style={styles.bankOptionLogo}
                          resizeMode="contain"
                        />
                      ) : (
                        <View style={styles.bankOptionIconContainer}>
                          <Ionicons name="business" size={20} color={colors.textSecondary} />
                        </View>
                      )}
                      <Text style={styles.bankOptionText}>{bank.name}</Text>
                    </View>
                    {selectedBank?.id === bank.id && (
                      <Check size={20} color={colors.primary} />
                    )}
                  </Pressable>
                ))
              )}
              
              {filteredBanks.length === 0 && !banksLoading && (
                <View style={styles.noResultsContainer}>
                  <Text style={styles.noResultsText}>
                    {banks.length === 0 
                      ? 'No banks available. Please check your connection.' 
                      : `No banks match "${bankSearchQuery}"`
                    }
                  </Text>
                  {banks.length === 0 && (
                    <Text style={[styles.noResultsText, { fontSize: 12, marginTop: 8 }]}>
                      Total banks loaded: {banks.length}
                    </Text>
                  )}
                </View>
              )}
            </ScrollView>
          </Animated.View>
        </KeyboardAvoidingView>
      </Animated.View>
    </Modal>
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
  keyboardAvoidingContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    width: '100%',
    height: '90%',
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
  subtitle: {
    fontSize: isSmallScreen ? 14 : 16,
    color: colors.textSecondary,
    marginBottom: isSmallScreen ? 16 : 24,
  },
  closeButton: {
    width: isSmallScreen ? 36 : 40,
    height: isSmallScreen ? 36 : 40,
    borderRadius: isSmallScreen ? 18 : 20,
    backgroundColor: colors.backgroundTertiary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    // Removed maxHeight property to allow content to expand properly
  },
  contentInner: {
    padding: isSmallScreen ? 16 : 20,
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
  field: {
    marginBottom: isSmallScreen ? 16 : 20,
  },
  label: {
    fontSize: isSmallScreen ? 13 : 14,
    fontWeight: '500',
    color: colors.text,
    marginBottom: isSmallScreen ? 6 : 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 12,
    padding: isSmallScreen ? 12 : 16,
    backgroundColor: colors.background,
  },
  inputContainerFilled: {
    borderColor: colors.accent,
    backgroundColor: colors.accentBackground || colors.background,
  },
  inputContainerError: {
    borderColor: colors.error || '#DC2626',
  },
  input: {
    flex: 1,
    fontSize: isSmallScreen ? 14 : 16,
    color: colors.text,
  },
  bankSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
    borderColor: colors.error || '#DC2626',
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
    fontSize: isSmallScreen ? 11 : 12,
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
    flex: 1,
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
    height: 55,
    borderRadius: 20,
    justifyContent: 'center',
  },
  cancelButton: {
    borderColor: colors.border,
    height: 55,
    borderRadius: 20,
    justifyContent: 'center',
  },
  bankListModal: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    width: '100%',
    maxHeight: '85%',
    minHeight: '50%',
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
      },
    }),
  },
  bankListHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: isSmallScreen ? 16 : 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  bankListTitle: {
    fontSize: isSmallScreen ? 18 : 20,
    fontWeight: '600',
    color: colors.text,
  },
  searchContainer: {
    padding: isSmallScreen ? 12 : 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  searchInput: {
    fontSize: isSmallScreen ? 14 : 16,
    color: colors.text,
    borderRadius: 10,
    padding: isSmallScreen ? 12 : 16,
    height: 48,
    backgroundColor: colors.backgroundTertiary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bankList: {
    flex: 1,
    maxHeight: '70%',
  },
  bankOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: isSmallScreen ? 12 : 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  bankOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  bankOptionLogo: {
    width: 32,
    height: 32,
    borderRadius: 6,
    marginRight: 12,
  },
  bankOptionIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 6,
    marginRight: 12,
    backgroundColor: colors.backgroundTertiary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bankOptionText: {
    fontSize: isSmallScreen ? 14 : 16,
    fontWeight: '500',
    color: colors.text,
  },
  loadingContainer: {
    padding: isSmallScreen ? 32 : 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: isSmallScreen ? 14 : 16,
    color: colors.textSecondary,
    marginTop: 16,
  },
  noResultsContainer: {
    padding: isSmallScreen ? 32 : 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noResultsText: {
    fontSize: isSmallScreen ? 14 : 16,
    color: colors.textSecondary,
  },
});