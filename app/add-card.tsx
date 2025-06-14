import { View, Text, StyleSheet, Pressable, TextInput, ScrollView, Alert } from 'react-native';
import { router } from 'expo-router';
import { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, CreditCard, Calendar, Lock, Info, Shield } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useToast } from '@/contexts/ToastContext';
import Button from '@/components/Button';
import KeyboardAvoidingWrapper from '@/components/KeyboardAvoidingWrapper';
import FloatingButton from '@/components/FloatingButton';
import { useHaptics } from '@/hooks/useHaptics';

export default function AddCardScreen() {
  const { colors, isDark } = useTheme();
  const { showToast } = useToast();
  const haptics = useHaptics();
  
  const [cardNumber, setCardNumber] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [cvv, setCvv] = useState('');
  const [cardholderName, setCardholderName] = useState('');
  const [saveCard, setSaveCard] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  
  const [errors, setErrors] = useState<Record<string, string>>({});

  const formatCardNumber = (value: string) => {
    // Remove all non-digit characters
    const digits = value.replace(/\D/g, '');
    
    // Format with spaces after every 4 digits
    let formatted = '';
    for (let i = 0; i < digits.length; i += 4) {
      formatted += digits.slice(i, i + 4) + ' ';
    }
    
    // Trim the trailing space and limit to 19 characters (16 digits + 3 spaces)
    return formatted.trim().slice(0, 19);
  };

  const formatExpiryDate = (value: string) => {
    // Remove all non-digit characters
    const digits = value.replace(/\D/g, '');
    
    // Format as MM/YY
    if (digits.length > 2) {
      return digits.slice(0, 2) + '/' + digits.slice(2, 4);
    } else {
      return digits;
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    // Validate card number (should be 16 digits)
    const cardDigits = cardNumber.replace(/\D/g, '');
    if (!cardDigits) {
      newErrors.cardNumber = 'Card number is required';
    } else if (cardDigits.length !== 16) {
      newErrors.cardNumber = 'Card number must be 16 digits';
    }
    
    // Validate expiry date (should be in MM/YY format)
    const expiryDigits = expiryDate.replace(/\D/g, '');
    if (!expiryDigits) {
      newErrors.expiryDate = 'Expiry date is required';
    } else if (expiryDigits.length !== 4) {
      newErrors.expiryDate = 'Expiry date must be in MM/YY format';
    } else {
      const month = parseInt(expiryDigits.slice(0, 2), 10);
      const year = parseInt(expiryDigits.slice(2, 4), 10);
      const currentYear = new Date().getFullYear() % 100;
      const currentMonth = new Date().getMonth() + 1;
      
      if (month < 1 || month > 12) {
        newErrors.expiryDate = 'Invalid month';
      } else if (year < currentYear || (year === currentYear && month < currentMonth)) {
        newErrors.expiryDate = 'Card has expired';
      }
    }
    
    // Validate CVV (should be 3 or 4 digits)
    if (!cvv) {
      newErrors.cvv = 'CVV is required';
    } else if (!/^\d{3,4}$/.test(cvv)) {
      newErrors.cvv = 'CVV must be 3 or 4 digits';
    }
    
    // Validate cardholder name
    if (!cardholderName.trim()) {
      newErrors.cardholderName = 'Cardholder name is required';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleAddCard = async () => {
    if (!validateForm()) {
      haptics.error();
      showToast('Please correct the errors in the form', 'error');
      return;
    }
    
    try {
      setIsLoading(true);
      haptics.impact();
      
      // In a real app, this would call the Paystack API to tokenize the card
      // For demo purposes, we'll simulate a successful tokenization
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      haptics.success();
      showToast('Card added successfully', 'success');
      router.back();
    } catch (error) {
      haptics.error();
      showToast('Failed to add card. Please try again.', 'error');
    } finally {
      setIsLoading(false);
    }
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
        <Text style={styles.headerTitle}>Add Card</Text>
      </View>

      <KeyboardAvoidingWrapper contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          <Text style={styles.title}>Add a Debit or Credit Card</Text>
          <Text style={styles.description}>
            Add your card details to make quick and secure payments
          </Text>

          <View style={styles.cardPreview}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardType}>
                {cardNumber.startsWith('4') ? 'VISA' : 
                 cardNumber.startsWith('5') ? 'MASTERCARD' : 
                 cardNumber.startsWith('6') ? 'VERVE' : 'CARD'}
              </Text>
              <CreditCard size={24} color="#FFFFFF" />
            </View>
            <Text style={styles.cardNumberPreview}>
              {cardNumber || '•••• •••• •••• ••••'}
            </Text>
            <View style={styles.cardFooter}>
              <View>
                <Text style={styles.cardholderLabel}>CARD HOLDER</Text>
                <Text style={styles.cardholderPreview}>
                  {cardholderName || 'YOUR NAME'}
                </Text>
              </View>
              <View>
                <Text style={styles.expiryLabel}>EXPIRES</Text>
                <Text style={styles.expiryPreview}>
                  {expiryDate || 'MM/YY'}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.form}>
            <View style={styles.formGroup}>
              <Text style={styles.label}>Card Number</Text>
              <View style={[styles.inputContainer, errors.cardNumber && styles.inputError]}>
                <CreditCard size={20} color={colors.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="1234 5678 9012 3456"
                  placeholderTextColor={colors.textTertiary}
                  value={cardNumber}
                  onChangeText={(text) => {
                    const formatted = formatCardNumber(text);
                    setCardNumber(formatted);
                    if (errors.cardNumber) {
                      setErrors({...errors, cardNumber: ''});
                    }
                  }}
                  keyboardType="numeric"
                  maxLength={19} // 16 digits + 3 spaces
                />
              </View>
              {errors.cardNumber && <Text style={styles.errorText}>{errors.cardNumber}</Text>}
            </View>

            <View style={styles.formRow}>
              <View style={[styles.formGroup, styles.halfWidth]}>
                <Text style={styles.label}>Expiry Date</Text>
                <View style={[styles.inputContainer, errors.expiryDate && styles.inputError]}>
                  <Calendar size={20} color={colors.textSecondary} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="MM/YY"
                    placeholderTextColor={colors.textTertiary}
                    value={expiryDate}
                    onChangeText={(text) => {
                      const formatted = formatExpiryDate(text);
                      setExpiryDate(formatted);
                      if (errors.expiryDate) {
                        setErrors({...errors, expiryDate: ''});
                      }
                    }}
                    keyboardType="numeric"
                    maxLength={5} // MM/YY
                  />
                </View>
                {errors.expiryDate && <Text style={styles.errorText}>{errors.expiryDate}</Text>}
              </View>

              <View style={[styles.formGroup, styles.halfWidth]}>
                <Text style={styles.label}>CVV</Text>
                <View style={[styles.inputContainer, errors.cvv && styles.inputError]}>
                  <Lock size={20} color={colors.textSecondary} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="123"
                    placeholderTextColor={colors.textTertiary}
                    value={cvv}
                    onChangeText={(text) => {
                      // Only allow numbers and limit to 4 digits
                      const digits = text.replace(/\D/g, '').slice(0, 4);
                      setCvv(digits);
                      if (errors.cvv) {
                        setErrors({...errors, cvv: ''});
                      }
                    }}
                    keyboardType="numeric"
                    maxLength={4}
                    secureTextEntry
                  />
                </View>
                {errors.cvv && <Text style={styles.errorText}>{errors.cvv}</Text>}
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Cardholder Name</Text>
              <View style={[styles.inputContainer, errors.cardholderName && styles.inputError]}>
                <TextInput
                  style={styles.input}
                  placeholder="Name as it appears on card"
                  placeholderTextColor={colors.textTertiary}
                  value={cardholderName}
                  onChangeText={(text) => {
                    setCardholderName(text);
                    if (errors.cardholderName) {
                      setErrors({...errors, cardholderName: ''});
                    }
                  }}
                  autoCapitalize="words"
                />
              </View>
              {errors.cardholderName && <Text style={styles.errorText}>{errors.cardholderName}</Text>}
            </View>

            <View style={styles.checkboxContainer}>
              <Pressable 
                style={styles.checkbox}
                onPress={() => setSaveCard(!saveCard)}
              >
                <View style={[styles.checkboxBox, saveCard && styles.checkboxChecked]}>
                  {saveCard && <View style={styles.checkboxInner} />}
                </View>
                <Text style={styles.checkboxLabel}>Save this card for future payments</Text>
              </Pressable>
            </View>

            <View style={styles.securityInfo}>
              <View style={styles.securityIconContainer}>
                <Shield size={20} color={colors.primary} />
              </View>
              <Text style={styles.securityText}>
                Your card information is securely encrypted and processed by Paystack. We do not store your full card details.
              </Text>
            </View>
          </View>
        </View>
      </KeyboardAvoidingWrapper>

      <FloatingButton 
        title="Add Card"
        onPress={handleAddCard}
        loading={isLoading}
        disabled={isLoading}
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
  cardPreview: {
    backgroundColor: '#1E3A8A',
    borderRadius: 16,
    padding: 24,
    marginBottom: 24,
    height: 200,
    justifyContent: 'space-between',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardType: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  cardNumberPreview: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '600',
    letterSpacing: 2,
    marginVertical: 20,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cardholderLabel: {
    color: '#FFFFFF80',
    fontSize: 10,
    marginBottom: 4,
  },
  cardholderPreview: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  expiryLabel: {
    color: '#FFFFFF80',
    fontSize: 10,
    marginBottom: 4,
  },
  expiryPreview: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  form: {
    gap: 20,
  },
  formGroup: {
    gap: 8,
  },
  formRow: {
    flexDirection: 'row',
    gap: 16,
  },
  halfWidth: {
    flex: 1,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    height: 56,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
  },
  inputError: {
    borderColor: colors.error,
  },
  errorText: {
    fontSize: 12,
    color: colors.error,
    marginTop: 4,
  },
  checkboxContainer: {
    marginTop: 8,
  },
  checkbox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  checkboxBox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  checkboxInner: {
    width: 10,
    height: 10,
    borderRadius: 2,
    backgroundColor: '#FFFFFF',
  },
  checkboxLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  securityInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: isDark ? 'rgba(59, 130, 246, 0.1)' : '#EFF6FF',
    padding: 16,
    borderRadius: 12,
    marginTop: 16,
  },
  securityIconContainer: {
    marginTop: 2,
  },
  securityText: {
    flex: 1,
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
});