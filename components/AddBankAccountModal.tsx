import { Modal, View, Text, StyleSheet, Pressable, TextInput, ScrollView, Animated, Dimensions, Platform } from 'react-native';
import { ChevronDown, ChevronRight, Search } from 'lucide-react-native';
import { useState, useMemo, useRef, useEffect } from 'react';
import Button from '@/components/Button';
import KeyboardAvoidingWrapper from '@/components/KeyboardAvoidingWrapper';
import { useTheme } from '@/contexts/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useHaptics } from '@/hooks/useHaptics';

interface AddBankAccountModalProps {
  isVisible: boolean;
  onClose: () => void;
  onAdd: (account: {
    bankName: string;
    accountNumber: string;
    accountName: string;
  }) => Promise<void>;
  loading?: boolean;
}

const BANKS = [
  'Access Bank',
  'Citibank',
  'Ecobank',
  'Fidelity Bank',
  'First Bank',
  'First City Monument Bank',
  'Guaranty Trust Bank',
  'Heritage Bank',
  'Keystone Bank',
  'Polaris Bank',
  'Stanbic IBTC Bank',
  'Standard Chartered Bank',
  'Sterling Bank',
  'Union Bank',
  'United Bank for Africa',
  'Unity Bank',
  'Wema Bank',
  'Zenith Bank',
];

export default function AddBankAccountModal({ isVisible, onClose, onAdd, loading = false }: AddBankAccountModalProps) {
  const [selectedBank, setSelectedBank] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  const [showBankList, setShowBankList] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Get theme colors
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = Dimensions.get('window');
  const haptics = useHaptics();

  // Animation values
  const slideAnim = useRef(new Animated.Value(screenHeight)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const bankListSlideAnim = useRef(new Animated.Value(screenHeight)).current;

  const filteredBanks = useMemo(() => {
    return BANKS.filter(bank => 
      bank.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery]);

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
    if (showBankList) {
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
  }, [showBankList]);

  const handleAddAccount = async () => {
    if (!accountNumber || accountNumber.length !== 10) {
      setError('Please enter a valid 10-digit account number');
      haptics.error();
      return;
    }
    if (!selectedBank) {
      setError('Please select a bank');
      haptics.error();
      return;
    }
    if (!accountName) {
      setError('Please enter account name');
      haptics.error();
      return;
    }

    setIsSubmitting(true);
    try {
      await onAdd({
        bankName: selectedBank,
        accountNumber,
        accountName,
      });

      // Reset form
      setSelectedBank('');
      setAccountNumber('');
      setAccountName('');
      setSearchQuery('');
      setError(null);
      
      // Animate out before closing
      handleClose();
    } catch (error) {
      setError('Failed to add bank account. Please try again.');
      haptics.error();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAccountNumberChange = (text: string) => {
    // Only allow numbers and limit to 10 digits
    const numbers = text.replace(/[^0-9]/g, '');
    if (numbers.length <= 10) {
      setAccountNumber(numbers);
      setError(null);
    }
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
        
        <View style={styles.header}>
          <Text style={styles.title}>Add Bank Account</Text>
          <Pressable 
            style={styles.closeButton} 
            onPress={handleClose}
            disabled={isSubmitting}
          >
            <X size={24} color={colors.text} />
          </Pressable>
        </View>

        <KeyboardAvoidingWrapper style={styles.content} disableScrollView={false}>
          <View style={styles.contentInner}>
            <Text style={styles.subtitle}>Enter your bank account details</Text>
            
            {error && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <View style={styles.field}>
              <Text style={styles.label}>Account Number</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter 10-digit account number"
                placeholderTextColor={colors.textTertiary}
                keyboardType="numeric"
                value={accountNumber}
                onChangeText={handleAccountNumberChange}
                maxLength={10}
                editable={!isSubmitting}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Select Bank</Text>
              <Pressable
                style={styles.bankSelector}
                onPress={() => {
                  if (!isSubmitting) {
                    setShowBankList(true);
                    haptics.selection();
                  }
                }}
                disabled={isSubmitting}
              >
                <Text style={selectedBank ? styles.selectedBank : styles.bankPlaceholder}>
                  {selectedBank || 'Choose your bank'}
                </Text>
                <ChevronDown size={20} color={colors.textSecondary} />
              </Pressable>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Account Name</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter account name"
                placeholderTextColor={colors.textTertiary}
                value={accountName}
                onChangeText={(text) => {
                  setAccountName(text);
                  setError(null);
                }}
                editable={!isSubmitting}
              />
            </View>
          </View>
        </KeyboardAvoidingWrapper>

        <View style={styles.footer}>
          <Button
            title={isSubmitting ? "Adding..." : "Add Account"}
            onPress={handleAddAccount}
            style={styles.addButton}
            disabled={isSubmitting || loading}
            isLoading={isSubmitting}
          />
          <Button
            title="Cancel"
            onPress={handleClose}
            variant="outline"
            style={styles.cancelButton}
            disabled={isSubmitting}
          />
        </View>
      </Animated.View>

      {/* Bank Selection Modal */}
      <Animated.View 
        style={[
          styles.overlay,
          { 
            opacity: showBankList ? 1 : 0,
            zIndex: showBankList ? 1100 : -1,
          }
        ]}
        pointerEvents={showBankList ? 'auto' : 'none'}
      >
        <Pressable 
          style={styles.overlayPressable} 
          onPress={() => {
            setShowBankList(false);
            haptics.lightImpact();
          }} 
        />
        
        <Animated.View 
          style={[
            styles.bankListModal,
            { 
              transform: [{ translateY: bankListSlideAnim }],
              maxHeight: modalMaxHeight
            }
          ]}
        >
          <View style={styles.dragIndicator} />
          
          <View style={styles.bankListHeader}>
            <Text style={styles.bankListTitle}>Select Bank</Text>
            <Pressable 
              style={styles.closeButton}
              onPress={() => {
                setShowBankList(false);
                haptics.lightImpact();
              }}
            >
              <X size={24} color={colors.text} />
            </Pressable>
          </View>
          
          <View style={styles.searchContainer}>
            <Search size={20} color={colors.textSecondary} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search banks..."
              placeholderTextColor={colors.textTertiary}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus
            />
          </View>
          
          <ScrollView style={styles.bankList} nestedScrollEnabled>
            {filteredBanks.map((bank) => (
              <Pressable
                key={bank}
                style={styles.bankOption}
                onPress={() => {
                  if (!isSubmitting) {
                    setSelectedBank(bank);
                    setShowBankList(false);
                    setSearchQuery('');
                    setError(null);
                    haptics.selection();
                  }
                }}
                disabled={isSubmitting}
              >
                <Text style={styles.bankOptionText}>{bank}</Text>
                {selectedBank === bank && (
                  <ChevronRight size={20} color={colors.primary} />
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
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    marginBottom: 24,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.backgroundTertiary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    maxHeight: 400,
  },
  contentInner: {
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
  field: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    color: colors.text,
    marginBottom: 8,
    fontWeight: '500',
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
  bankSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 16,
    backgroundColor: colors.backgroundTertiary,
  },
  bankPlaceholder: {
    fontSize: 16,
    color: colors.textTertiary,
  },
  selectedBank: {
    fontSize: 16,
    color: colors.text,
  },
  bankListModal: {
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
  bankListHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  bankListTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.backgroundTertiary,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
    marginLeft: 12,
  },
  bankList: {
    maxHeight: 400,
  },
  bankOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  bankOptionText: {
    fontSize: 16,
    color: colors.text,
  },
  noResultsContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noResultsText: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  footer: {
    padding: 20,
    paddingBottom: Math.max(20, insets.bottom),
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