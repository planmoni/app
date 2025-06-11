import { Modal, View, Text, StyleSheet, Pressable, TextInput, ScrollView } from 'react-native';
import { ChevronDown, ChevronRight, Search } from 'lucide-react-native';
import { useState, useMemo } from 'react';
import Button from '@/components/Button';
import KeyboardAvoidingWrapper from '@/components/KeyboardAvoidingWrapper';

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

  const filteredBanks = useMemo(() => {
    return BANKS.filter(bank => 
      bank.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery]);

  const handleAddAccount = async () => {
    if (!accountNumber || accountNumber.length !== 10) {
      setError('Please enter a valid 10-digit account number');
      return;
    }
    if (!selectedBank) {
      setError('Please select a bank');
      return;
    }
    if (!accountName) {
      setError('Please enter account name');
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
    } catch (error) {
      setError('Failed to add bank account. Please try again.');
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
    if (!isSubmitting) {
      onClose();
    }
  };

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={isVisible}
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.header}>
            <Text style={styles.title}>Add Bank Account</Text>
            <Text style={styles.subtitle}>Enter your bank account details</Text>
          </View>

          <KeyboardAvoidingWrapper style={styles.content} disableScrollView={false}>
            <View style={styles.contentInner}>
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
                  onPress={() => !isSubmitting && setShowBankList(!showBankList)}
                  disabled={isSubmitting}
                >
                  <Text style={selectedBank ? styles.selectedBank : styles.bankPlaceholder}>
                    {selectedBank || 'Choose your bank'}
                  </Text>
                  <ChevronDown size={20} color="#64748B" />
                </Pressable>

                {showBankList && (
                  <View style={styles.bankListContainer}>
                    <View style={styles.searchContainer}>
                      <Search size={20} color="#64748B" />
                      <TextInput
                        style={styles.searchInput}
                        placeholder="Search banks..."
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        editable={!isSubmitting}
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
                            }
                          }}
                          disabled={isSubmitting}
                        >
                          <Text style={styles.bankOptionText}>{bank}</Text>
                          {selectedBank === bank && (
                            <ChevronRight size={20} color="#1E3A8A" />
                          )}
                        </Pressable>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Account Name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter account name"
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
            />
            <Button
              title="Cancel"
              onPress={handleClose}
              variant="outline"
              style={styles.cancelButton}
              disabled={isSubmitting}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    width: '100%',
    maxWidth: 400,
    maxHeight: '90%',
  },
  header: {
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748B',
  },
  content: {
    flex: 1,
    maxHeight: 400,
  },
  contentInner: {
    padding: 24,
  },
  errorContainer: {
    backgroundColor: '#FEE2E2',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 14,
  },
  field: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#1E293B',
  },
  bankSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    padding: 12,
  },
  bankPlaceholder: {
    fontSize: 16,
    color: '#94A3B8',
  },
  selectedBank: {
    fontSize: 16,
    color: '#1E293B',
  },
  bankListContainer: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    marginTop: 8,
    backgroundColor: '#FFFFFF',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#1E293B',
  },
  bankList: {
    maxHeight: 200,
  },
  bankOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  bankOptionText: {
    fontSize: 16,
    color: '#1E293B',
  },
  footer: {
    padding: 24,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  addButton: {
    backgroundColor: '#1E3A8A',
  },
  cancelButton: {
    borderColor: '#E2E8F0',
  },
});