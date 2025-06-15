import { View, Text, StyleSheet, Pressable, TextInput, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Smartphone, Copy, Info } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useToast } from '@/contexts/ToastContext';
import Button from '@/components/Button';
import KeyboardAvoidingWrapper from '@/components/KeyboardAvoidingWrapper';
import FloatingButton from '@/components/FloatingButton';
import { useHaptics } from '@/hooks/useHaptics';

type Bank = {
  id: string;
  name: string;
  ussdCode: string;
};

export default function AddUSSDScreen() {
  const { colors, isDark } = useTheme();
  const { showToast } = useToast();
  const haptics = useHaptics();
  
  const [selectedBank, setSelectedBank] = useState<Bank | null>(null);
  const [amount, setAmount] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [ussdCode, setUssdCode] = useState('');
  
  // Mock banks with USSD codes
  const banks: Bank[] = [
    { id: '1', name: 'Access Bank', ussdCode: '*901#' },
    { id: '2', name: 'GTBank', ussdCode: '*737#' },
    { id: '3', name: 'UBA', ussdCode: '*919#' },
    { id: '4', name: 'Zenith Bank', ussdCode: '*966#' },
    { id: '5', name: 'First Bank', ussdCode: '*894#' },
  ];

  const handleBankSelect = (bank: Bank) => {
    haptics.selection();
    setSelectedBank(bank);
  };

  const handleAmountChange = (text: string) => {
    // Only allow numbers
    const numericValue = text.replace(/[^0-9]/g, '');
    setAmount(numericValue);
    
    // Generate USSD code if bank is selected
    if (selectedBank && numericValue) {
      generateUSSDCode(selectedBank, numericValue);
    } else {
      setUssdCode('');
    }
  };

  const generateUSSDCode = (bank: Bank, amountValue: string) => {
    // This is a mock implementation - in a real app, you would use the actual USSD code format for each bank
    const code = `${bank.ussdCode.replace('#', '')}*000*${amountValue}#`;
    setUssdCode(code);
  };

  const handleCopyCode = () => {
    haptics.selection();
    // In a real app, you would copy the code to clipboard
    showToast('USSD code copied to clipboard', 'success');
  };

  const handleContinue = () => {
    if (!selectedBank) {
      haptics.error();
      showToast('Please select a bank', 'error');
      return;
    }
    
    if (!amount) {
      haptics.error();
      showToast('Please enter an amount', 'error');
      return;
    }
    
    setIsLoading(true);
    haptics.impact();
    
    // In a real app, you would process the USSD payment
    // For demo purposes, we'll simulate a successful payment
    setTimeout(() => {
      setIsLoading(false);
      haptics.success();
      showToast('USSD payment initiated successfully', 'success');
      router.replace('/deposit-flow/success');
    }, 2000);
  };

  const styles = createStyles(colors, isDark);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable 
          onPress={() => {
            haptics.lightImpact();
            router.back();
          }} 
          style={styles.backButton}
        >
          <ArrowLeft size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>USSD Payment</Text>
      </View>

      <KeyboardAvoidingWrapper contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          <Text style={styles.title}>Pay with USSD</Text>
          <Text style={styles.description}>
            Make a payment using your bank's USSD code
          </Text>

          <View style={styles.form}>
            <View style={styles.formGroup}>
              <Text style={styles.label}>Select Bank</Text>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.banksContainer}
              >
                {banks.map(bank => (
                  <Pressable
                    key={bank.id}
                    style={[
                      styles.bankOption,
                      selectedBank?.id === bank.id && styles.selectedBankOption
                    ]}
                    onPress={() => handleBankSelect(bank)}
                  >
                    <Text 
                      style={[
                        styles.bankName,
                        selectedBank?.id === bank.id && styles.selectedBankName
                      ]}
                    >
                      {bank.name}
                    </Text>
                    <Text 
                      style={[
                        styles.bankCode,
                        selectedBank?.id === bank.id && styles.selectedBankCode
                      ]}
                    >
                      {bank.ussdCode}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Amount</Text>
              <View style={styles.amountContainer}>
                <Text style={styles.currencySymbol}>₦</Text>
                <TextInput
                  style={styles.amountInput}
                  placeholder="Enter amount"
                  placeholderTextColor={colors.textTertiary}
                  value={amount}
                  onChangeText={handleAmountChange}
                  keyboardType="numeric"
                />
              </View>
            </View>

            {ussdCode && (
              <View style={styles.ussdCodeContainer}>
                <View style={styles.ussdCodeHeader}>
                  <Text style={styles.ussdCodeLabel}>USSD Code</Text>
                  <Pressable style={styles.copyButton} onPress={handleCopyCode}>
                    <Copy size={16} color={colors.primary} />
                    <Text style={styles.copyText}>Copy</Text>
                  </Pressable>
                </View>
                <View style={styles.ussdCodeBox}>
                  <Text style={styles.ussdCode}>{ussdCode}</Text>
                </View>
                <Text style={styles.ussdInstructions}>
                  Dial this code on your phone to complete the payment
                </Text>
              </View>
            )}

            <View style={styles.infoContainer}>
              <Info size={20} color={colors.primary} />
              <Text style={styles.infoText}>
                USSD payments are processed immediately. Make sure you have sufficient balance in your account.
              </Text>
            </View>
          </View>
        </View>
      </KeyboardAvoidingWrapper>

      <FloatingButton 
        title="Continue"
        onPress={handleContinue}
        loading={isLoading}
        disabled={!selectedBank || !amount || isLoading}
        hapticType="medium"
      />
    </SafeAreaView>
  );
}

const createStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundSecondary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  scrollContent: {
    paddingBottom: 100, // Extra padding for the floating button
  },
  content: {
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },
  description: {
    fontSize: 16,
    color: colors.textSecondary,
    marginBottom: 24,
  },
  form: {
    gap: 24,
  },
  formGroup: {
    gap: 12,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
  },
  banksContainer: {
    paddingVertical: 8,
    gap: 12,
  },
  bankOption: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 16,
    minWidth: 140,
    alignItems: 'center',
  },
  selectedBankOption: {
    borderColor: colors.primary,
    backgroundColor: colors.backgroundTertiary,
  },
  bankName: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
    marginBottom: 4,
  },
  selectedBankName: {
    color: colors.primary,
  },
  bankCode: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  selectedBankCode: {
    color: colors.primary,
  },
  amountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    height: 56,
  },
  currencySymbol: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.textSecondary,
    marginRight: 8,
  },
  amountInput: {
    flex: 1,
    fontSize: 20,
    color: colors.text,
  },
  ussdCodeContainer: {
    backgroundColor: colors.backgroundTertiary,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  ussdCodeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  ussdCodeLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  copyText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '500',
  },
  ussdCodeBox: {
    backgroundColor: isDark ? colors.backgroundSecondary : colors.surface,
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  ussdCode: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.primary,
    letterSpacing: 1,
  },
  ussdInstructions: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  infoContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: isDark ? 'rgba(59, 130, 246, 0.1)' : '#EFF6FF',
    padding: 16,
    borderRadius: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
});