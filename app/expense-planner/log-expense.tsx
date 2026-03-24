import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useTextSize } from '@/contexts/TextSizeContext';
import { getScaledFontSize } from '@/lib/textSize';
import { useHaptics } from '@/hooks/useHaptics';
import KeyboardAvoidingWrapper from '@/components/KeyboardAvoidingWrapper';
import Button from '@/components/Button';
import ExpenseWarningModal from '@/components/expense-planner/ExpenseWarningModal';
import { ExpenseBucket } from '@/types/expense-planner';
import { useExpenseBuckets } from '@/hooks/useExpenseBuckets';
import { useExpenseTransactions } from '@/hooks/useExpenseTransactions';

export default function LogExpenseScreen() {
  const { colors, isDark } = useTheme();
  const { textSizeMultiplier } = useTextSize();
  const haptics = useHaptics();
  const params = useLocalSearchParams();
  const planId = params.planId as string;

  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [selectedBucketId, setSelectedBucketId] = useState<string | null>(null);
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [warningData, setWarningData] = useState<{
    expenseAmount: number;
    bucketName: string;
    overageAmount: number;
  } | null>(null);

  const { buckets } = useExpenseBuckets(planId);

  const amountInputRef = useRef<TextInput>(null);

  useEffect(() => {
    const timeout = setTimeout(() => {
      amountInputRef.current?.focus();
    }, 300);
    return () => clearTimeout(timeout);
  }, []);

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
  };

  const handleSave = () => {
    if (!amount) {
      Alert.alert('Invalid Input', 'Please enter an expense amount');
      haptics.notification();
      return;
    }

    if (!description.trim()) {
      Alert.alert('Invalid Input', 'Please enter a description');
      haptics.notification();
      return;
    }

    if (!selectedBucketId) {
      Alert.alert('Invalid Input', 'Please select an expense bucket');
      haptics.notification();
      return;
    }

    const numericAmount = parseFloat(amount.replace(/,/g, ''));
    if (isNaN(numericAmount) || numericAmount <= 0) {
      Alert.alert('Invalid Input', 'Please enter a valid amount');
      haptics.notification();
      return;
    }

    const selectedBucket = buckets.find(b => b.id === selectedBucketId);
    if (!selectedBucket) {
      Alert.alert('Error', 'Selected bucket not found');
      return;
    }

    const newAmountSpent = selectedBucket.amount_spent + numericAmount;
    const overageAmount = newAmountSpent - selectedBucket.target_amount;

    if (newAmountSpent > selectedBucket.target_amount) {
      setWarningData({
        expenseAmount: numericAmount,
        bucketName: selectedBucket.name,
        overageAmount,
      });
      setShowWarningModal(true);
      return;
    }

    // Proceed with saving
    handleProceedWithSave(numericAmount);
  };

  const { createTransaction } = useExpenseTransactions(selectedBucketId || null);

  const handleProceedWithSave = async (numericAmount: number) => {
    if (!selectedBucketId || !description.trim()) return;

    try {
      await createTransaction({
        expense_bucket_id: selectedBucketId,
        amount: numericAmount,
        description: description.trim(),
      });
      haptics.success();
      Alert.alert('Success', 'Expense logged successfully!', [
        {
          text: 'OK',
          onPress: () => {
            router.back();
          },
        },
      ]);
    } catch (error) {
      console.error('Error saving expense:', error);
      Alert.alert('Error', 'Failed to save expense. Please try again.');
      haptics.notification();
    }
  };

  const handleWarningProceed = () => {
    if (!warningData) return;
    setShowWarningModal(false);
    handleProceedWithSave(warningData.expenseAmount);
  };

  const styles = createStyles(colors, isDark, textSizeMultiplier);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>Log Expense</Text>
        <View style={styles.placeholder} />
      </View>

      <KeyboardAvoidingWrapper>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.sectionTitle}>Expense Details</Text>
          <Text style={styles.sectionDescription}>
            Record a new expense and assign it to an expense bucket
          </Text>

          <View style={styles.formContainer}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Amount Spent</Text>
              <View style={styles.amountInputContainer}>
                <Text style={styles.currencySymbol}>₦</Text>
                <TextInput
                  ref={amountInputRef}
                  style={styles.amountInput}
                  placeholder="0"
                  placeholderTextColor={colors.textTertiary}
                  value={amount}
                  onChangeText={handleAmountChange}
                  keyboardType="numeric"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Description</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., Emirates Round-trip Ticket"
                placeholderTextColor={colors.textTertiary}
                value={description}
                onChangeText={setDescription}
                autoCapitalize="sentences"
                multiline
                numberOfLines={3}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Allocate to Bucket</Text>
              <View style={styles.bucketsList}>
                {buckets.length === 0 ? (
                  <Text style={styles.noBucketsText}>No expense buckets available</Text>
                ) : (
                  buckets.map(bucket => {
                    const isSelected = selectedBucketId === bucket.id;
                    const percentage = bucket.target_amount > 0
                      ? (bucket.amount_spent / bucket.target_amount) * 100
                      : 0;
                    return (
                      <Pressable
                        key={bucket.id}
                        onPress={() => {
                          setSelectedBucketId(bucket.id);
                          haptics.selection();
                        }}
                        style={[
                          styles.bucketOption,
                          isSelected && styles.bucketOptionSelected,
                        ]}
                      >
                        <View style={styles.bucketOptionContent}>
                          <Text style={styles.bucketName}>{bucket.name}</Text>
                          <Text style={styles.bucketInfo}>
                            ₦{bucket.amount_spent.toLocaleString()} / ₦{bucket.target_amount.toLocaleString()} ({Math.round(percentage)}%)
                          </Text>
                        </View>
                        {isSelected && (
                          <View style={styles.selectedIndicator} />
                        )}
                      </Pressable>
                    );
                  })
                )}
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingWrapper>

      <View style={styles.footer}>
        <Button title="Save Expense" onPress={handleSave} disabled={!amount || !description || !selectedBucketId} />
      </View>

      {warningData && (
        <ExpenseWarningModal
          isVisible={showWarningModal}
          onClose={() => setShowWarningModal(false)}
          onProceed={handleWarningProceed}
          expenseAmount={warningData.expenseAmount}
          bucketName={warningData.bucketName}
          overageAmount={warningData.overageAmount}
        />
      )}
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
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    backButton: {
      padding: 8,
    },
    title: {
      fontSize: getScaledFontSize(20, textSizeMultiplier),
      fontWeight: '700',
      color: colors.text,
    },
    placeholder: {
      width: 40,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      padding: 16,
    },
    sectionTitle: {
      fontSize: getScaledFontSize(24, textSizeMultiplier),
      fontWeight: '700',
      color: colors.text,
      marginBottom: 8,
    },
    sectionDescription: {
      fontSize: getScaledFontSize(14, textSizeMultiplier),
      color: colors.textSecondary,
      marginBottom: 24,
      lineHeight: 20,
    },
    formContainer: {
      gap: 24,
    },
    inputGroup: {
      gap: 8,
    },
    label: {
      fontSize: getScaledFontSize(14, textSizeMultiplier),
      fontWeight: '600',
      color: colors.text,
    },
    input: {
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 16,
      fontSize: getScaledFontSize(16, textSizeMultiplier),
      color: colors.text,
      borderWidth: 1,
      borderColor: colors.border,
      minHeight: 80,
      textAlignVertical: 'top',
    },
    amountInputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 16,
    },
    currencySymbol: {
      fontSize: getScaledFontSize(20, textSizeMultiplier),
      fontWeight: '600',
      color: colors.text,
      marginRight: 8,
    },
    amountInput: {
      flex: 1,
      paddingVertical: 16,
      fontSize: getScaledFontSize(20, textSizeMultiplier),
      fontWeight: '600',
      color: colors.text,
    },
    bucketsList: {
      gap: 12,
    },
    bucketOption: {
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 16,
      borderWidth: 2,
      borderColor: colors.border,
    },
    bucketOptionSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.primary + '10',
    },
    bucketOptionContent: {
      flex: 1,
    },
    bucketName: {
      fontSize: getScaledFontSize(16, textSizeMultiplier),
      fontWeight: '600',
      color: colors.text,
      marginBottom: 4,
    },
    bucketInfo: {
      fontSize: getScaledFontSize(14, textSizeMultiplier),
      color: colors.textSecondary,
    },
    selectedIndicator: {
      position: 'absolute',
      top: 12,
      right: 12,
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: colors.primary,
      borderWidth: 4,
      borderColor: colors.card,
    },
    noBucketsText: {
      fontSize: getScaledFontSize(14, textSizeMultiplier),
      color: colors.textSecondary,
      textAlign: 'center',
      padding: 20,
    },
    footer: {
      padding: 16,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.backgroundSecondary,
    },
  });

