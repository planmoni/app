import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, X, ShoppingCart, Lock, Key } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useTextSize } from '@/contexts/TextSizeContext';
import { getScaledFontSize } from '@/lib/textSize';
import { useHaptics } from '@/hooks/useHaptics';
import KeyboardAvoidingWrapper from '@/components/KeyboardAvoidingWrapper';
import FloatingButton from '@/components/FloatingButton';
import { Platform } from 'react-native';
import { useExpensePlans } from '@/hooks/useExpensePlans';
import { supabase } from '@/lib/supabase';
import { processPlanSpend, checkWalletLock } from '@/lib/wallet/planWalletSpend';
import { CATEGORIES } from '@/app/create-vault/plan-details';

export default function PlanSpendScreen() {
  const { colors, isDark } = useTheme();
  const { textSizeMultiplier } = useTextSize();
  const haptics = useHaptics();
  const params = useLocalSearchParams();
  const { fetchExpensePlans } = useExpensePlans();
  const planId = params.id as string;

  const [amount, setAmount] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedSubCategory, setSelectedSubCategory] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [pin, setPin] = useState('');
  const [showPinInput, setShowPinInput] = useState(false);
  const [walletLocked, setWalletLocked] = useState(false);
  const [lockType, setLockType] = useState<'none' | 'instant' | '24h_delay' | 'pin_required'>('none');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check wallet lock status
    const checkLock = async () => {
      try {
        const lockStatus = await checkWalletLock(planId);
        setWalletLocked(lockStatus.isLocked);
        setLockType(lockStatus.lockType);
        setShowPinInput(lockStatus.requiresPin);
      } catch (error) {
        console.error('Error checking wallet lock:', error);
      }
    };

    checkLock();
  }, [planId]);

  const formatAmount = (value: string) => {
    let cleanValue = value.replace(/[^0-9.]/g, '');
    const parts = cleanValue.split('.');
    if (parts.length > 2) {
      const integerPart = parts[0];
      const decimalPart = parts.slice(1).join('');
      cleanValue = integerPart + '.' + decimalPart;
    }
    if (parts.length === 2 && parts[1].length > 2) {
      cleanValue = parts[0] + '.' + parts[1].substring(0, 2);
    }
    const numericValue = parseFloat(cleanValue);
    if (!isNaN(numericValue)) {
      return numericValue.toLocaleString('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      });
    }
    return cleanValue;
  };

  const handleAmountChange = (value: string) => {
    const formatted = formatAmount(value);
    setAmount(formatted);
    setError(null);
  };

  const handleSpend = async () => {
    if (!amount) {
      setError('Please enter an amount');
      haptics.notification();
      return;
    }

    const numericAmount = parseFloat(amount.replace(/,/g, ''));
    if (isNaN(numericAmount) || numericAmount <= 0) {
      setError('Please enter a valid amount');
      haptics.notification();
      return;
    }

    if (!selectedCategory || !selectedSubCategory) {
      setError('Please select a category and subcategory');
      haptics.notification();
      return;
    }

    if (lockType === 'pin_required' && !pin) {
      setError('PIN is required');
      haptics.notification();
      return;
    }

    haptics.mediumImpact();
    setIsProcessing(true);
    setError(null);

    try {
      const result = await processPlanSpend({
        planId,
        amount: numericAmount,
        categoryId: selectedCategory,
        subcategoryId: selectedSubCategory,
        description: description || undefined,
        pin: lockType === 'pin_required' ? pin : undefined,
      });

      if (!result.success) {
        if (result.requiresConfirmation) {
          // Show confirmation dialog
          Alert.alert(
            'Wallet Locked',
            result.error || 'This wallet requires confirmation to unlock.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Request Unlock', onPress: () => {
                // TODO: Implement unlock request
                Alert.alert('Unlock Request', 'Unlock request functionality coming soon');
              }},
            ]
          );
        } else {
          setError(result.error || 'Failed to process spend');
        }
        return;
      }

      // Refresh plans
      await fetchExpensePlans();

      Alert.alert(
        'Spending Recorded',
        `₦${numericAmount.toLocaleString('en-US')} spent from plan wallet.`,
        [
          {
            text: 'OK',
            onPress: () => router.back(),
          },
        ]
      );
    } catch (error: any) {
      console.error('Error processing spend:', error);
      setError(error.message || 'Failed to process spend');
    } finally {
      setIsProcessing(false);
    }
  };

  const styles = createStyles(colors, isDark, textSizeMultiplier);

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
        <Text style={styles.headerTitle}>Spend from Plan</Text>
        <Pressable
          onPress={() => {
            haptics.lightImpact();
            router.replace('/(tabs)');
          }}
          style={styles.cancelButton}
          hitSlop={8}
        >
          <X size={24} color={colors.text} />
        </Pressable>
      </View>

      <KeyboardAvoidingWrapper contentContainerStyle={styles.scrollContent}>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
          {walletLocked && (
            <View style={styles.lockWarning}>
              <Lock size={20} color={colors.primary} />
              <Text style={styles.lockWarningText}>
                {lockType === 'pin_required' 
                  ? 'This wallet requires a PIN to spend'
                  : lockType === '24h_delay'
                  ? 'This wallet has a 24-hour unlock delay'
                  : 'This wallet requires confirmation to unlock'}
              </Text>
            </View>
          )}

          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Amount Input */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Amount</Text>
            <View style={styles.amountContainer}>
              <Text style={styles.currencySymbol}>₦</Text>
              <TextInput
                style={styles.amountInput}
                placeholder="0"
                placeholderTextColor={colors.textTertiary}
                keyboardType="decimal-pad"
                value={amount}
                onChangeText={handleAmountChange}
              />
            </View>
          </View>

          {/* Category Selection */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoriesScroll}>
              {CATEGORIES.map(category => (
                <Pressable
                  key={category.id}
                  style={[
                    styles.categoryChip,
                    selectedCategory === category.id && styles.categoryChipSelected,
                  ]}
                  onPress={() => {
                    haptics.selection();
                    setSelectedCategory(category.id);
                    setSelectedSubCategory(null);
                  }}
                >
                  {React.createElement(category.icon, { size: 20, color: selectedCategory === category.id ? colors.primary : colors.textSecondary })}
                  <Text style={[
                    styles.categoryChipText,
                    selectedCategory === category.id && styles.categoryChipTextSelected,
                  ]}>
                    {category.name}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>

          {/* Subcategory Selection */}
          {selectedCategory && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Subcategory</Text>
              <View style={styles.subcategoriesContainer}>
                {CATEGORIES.find(c => c.id === selectedCategory)?.subCategories.map(subCat => (
                  <Pressable
                    key={subCat.id}
                    style={[
                      styles.subcategoryChip,
                      selectedSubCategory === subCat.id && styles.subcategoryChipSelected,
                    ]}
                    onPress={() => {
                      haptics.selection();
                      setSelectedSubCategory(subCat.id);
                    }}
                  >
                    <Text style={[
                      styles.subcategoryChipText,
                      selectedSubCategory === subCat.id && styles.subcategoryChipTextSelected,
                    ]}>
                      {subCat.name}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          {/* Description */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Description (Optional)</Text>
            <TextInput
              style={styles.descriptionInput}
              placeholder="Add a note..."
              placeholderTextColor={colors.textTertiary}
              value={description}
              onChangeText={setDescription}
              multiline
            />
          </View>

          {/* PIN Input */}
          {showPinInput && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Enter PIN</Text>
              <TextInput
                style={styles.pinInput}
                placeholder="0000"
                placeholderTextColor={colors.textTertiary}
                keyboardType="number-pad"
                maxLength={4}
                secureTextEntry
                value={pin}
                onChangeText={(text) => {
                  if (/^\d*$/.test(text) && text.length <= 4) {
                    setPin(text);
                  }
                }}
              />
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingWrapper>

      <FloatingButton
        title="Record Spending"
        onPress={handleSpend}
        disabled={!amount || !selectedCategory || !selectedSubCategory || isProcessing || (lockType === 'pin_required' && pin.length !== 4)}
        hapticType="medium"
      />
    </SafeAreaView>
  );
}

const createStyles = (colors: any, isDark: boolean, textSizeMultiplier: number) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.backgroundSecondary,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
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
      fontSize: getScaledFontSize(18, textSizeMultiplier),
      fontWeight: '600',
      color: colors.text,
      flex: 1,
      textAlign: 'center',
    },
    cancelButton: {
      width: 40,
      height: 40,
      justifyContent: 'center',
      alignItems: 'center',
      marginLeft: 8,
    },
    scrollContent: {
      paddingBottom: 100,
    },
    scrollView: {
      flex: 1,
    },
    content: {
      padding: 20,
    },
    lockWarning: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      padding: 16,
      backgroundColor: colors.primary + '20',
      borderRadius: 12,
      marginBottom: 20,
      borderWidth: 1,
      borderColor: colors.primary,
    },
    lockWarningText: {
      fontSize: getScaledFontSize(14, textSizeMultiplier),
      color: colors.text,
      flex: 1,
    },
    errorContainer: {
      backgroundColor: colors.errorLight || '#FEE2E2',
      borderRadius: 8,
      padding: 12,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.error || '#DC2626',
    },
    errorText: {
      color: colors.error || '#DC2626',
      fontSize: getScaledFontSize(14, textSizeMultiplier),
    },
    section: {
      marginBottom: 24,
    },
    sectionTitle: {
      fontSize: getScaledFontSize(16, textSizeMultiplier),
      fontWeight: '600',
      color: colors.text,
      marginBottom: 12,
    },
    amountContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.background,
      borderRadius: 12,
      paddingLeft: 16,
      paddingRight: 16,
      paddingVertical: Platform.OS === 'ios' ? 4 : 0,
      borderWidth: 2,
      borderColor: colors.border,
      minHeight: 64,
    },
    currencySymbol: {
      fontSize: getScaledFontSize(28, textSizeMultiplier),
      fontWeight: '600',
      color: colors.text,
      marginRight: 8,
    },
    amountInput: {
      flex: 1,
      fontSize: getScaledFontSize(28, textSizeMultiplier),
      fontWeight: '600',
      color: colors.text,
      paddingVertical: 12,
    },
    categoriesScroll: {
      marginHorizontal: -20,
      paddingHorizontal: 20,
    },
    categoryChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 16,
      paddingVertical: 10,
      backgroundColor: colors.card,
      borderRadius: 20,
      borderWidth: 2,
      borderColor: colors.border,
      marginRight: 8,
    },
    categoryChipSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.primary + '20',
    },
    categoryChipText: {
      fontSize: getScaledFontSize(14, textSizeMultiplier),
      fontWeight: '500',
      color: colors.text,
    },
    categoryChipTextSelected: {
      color: colors.primary,
      fontWeight: '600',
    },
    subcategoriesContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    subcategoryChip: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      backgroundColor: colors.card,
      borderRadius: 20,
      borderWidth: 2,
      borderColor: colors.border,
    },
    subcategoryChipSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.primary + '20',
    },
    subcategoryChipText: {
      fontSize: getScaledFontSize(14, textSizeMultiplier),
      fontWeight: '500',
      color: colors.text,
    },
    subcategoryChipTextSelected: {
      color: colors.primary,
      fontWeight: '600',
    },
    descriptionInput: {
      backgroundColor: colors.background,
      borderRadius: 12,
      padding: 16,
      fontSize: getScaledFontSize(16, textSizeMultiplier),
      color: colors.text,
      borderWidth: 2,
      borderColor: colors.border,
      minHeight: 100,
      textAlignVertical: 'top',
    },
    pinInput: {
      backgroundColor: colors.background,
      borderRadius: 12,
      padding: 16,
      fontSize: getScaledFontSize(24, textSizeMultiplier),
      fontWeight: '600',
      color: colors.text,
      textAlign: 'center',
      letterSpacing: 8,
      borderWidth: 2,
      borderColor: colors.primary,
    },
  });
