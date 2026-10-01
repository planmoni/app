import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, X, Lock, Unlock, Bell, Shield, Key } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useTextSize } from '@/contexts/TextSizeContext';
import { getScaledFontSize } from '@/lib/textSize';
import { useHaptics } from '@/hooks/useHaptics';
import KeyboardAvoidingWrapper from '@/components/KeyboardAvoidingWrapper';
import FloatingButton from '@/components/FloatingButton';
import { Platform } from 'react-native';
import { useExpensePlans } from '@/hooks/useExpensePlans';

type SpendingPermission = 'open' | 'restricted';
type LockType = 'none' | 'instant' | '24h_delay' | 'pin_required';

export default function WalletRulesScreen() {
  const { colors, isDark } = useTheme();
  const { textSizeMultiplier } = useTextSize();
  const haptics = useHaptics();
  const params = useLocalSearchParams();
  const { saveDraftExpensePlan, saveLastStep } = useExpensePlans();
  
  const planId = params.planId as string | undefined;
  const planName = params.planName as string;
  const targetAmount = params.targetAmount as string;
  const maturityDateStr = (params.maturityDate as string) || (params.startDate as string);
  const dateType = params.dateType as string;
  const payoutSchedule = params.payoutSchedule as string;
  const requiredPerCycle = params.requiredPerCycle as string;
  const fundingMethod = params.fundingMethod as string;
  const autoFundMinimum = params.autoFundMinimum as string;
  const subCategories = params.subCategories as string | undefined;
  const planTypesParam = params.planTypes as string | undefined;

  const [spendingPermission, setSpendingPermission] = useState<SpendingPermission>('open');
  const [lockType, setLockType] = useState<LockType>('none');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [showPinInput, setShowPinInput] = useState(false);
  const [alertAt70Percent, setAlertAt70Percent] = useState(true);
  const [alertRiskFailure, setAlertRiskFailure] = useState(true);
  const [alertWeeklyProgress, setAlertWeeklyProgress] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleContinue = async () => {
    // Validate PIN if required
    if (lockType === 'pin_required') {
      if (!pin || pin.length !== 4) {
        Alert.alert('Invalid PIN', 'Please enter a 4-digit PIN');
        haptics.notification();
        return;
      }
      if (pin !== confirmPin) {
        Alert.alert('PIN Mismatch', 'PINs do not match. Please try again.');
        haptics.notification();
        return;
      }
    }

    haptics.mediumImpact();
    setIsSaving(true);

    try {
      // Update draft plan with wallet rules
      if (planId) {
        await saveDraftExpensePlan({
          planId,
          // Store wallet rules in metadata for now
          // Will be moved to proper tables after database migration
        });
      }

      // Navigate to review
      router.push({
        pathname: '/create-vault/review',
        params: {
          planName,
          targetAmount,
          maturityDate: maturityDateStr,
          dateType,
          payoutSchedule,
          requiredPerCycle,
          fundingMethod,
          autoFundMinimum: autoFundMinimum || '',
          spendingPermission,
          lockType,
          pin: lockType === 'pin_required' ? pin : '',
          alertAt70Percent: alertAt70Percent.toString(),
          alertRiskFailure: alertRiskFailure.toString(),
          alertWeeklyProgress: alertWeeklyProgress.toString(),
          planId: planId || '',
          ...(subCategories && { subCategories }),
          ...(planTypesParam && { planTypes: planTypesParam }),
        },
      });
    } catch (error) {
      console.error('Error saving wallet rules:', error);
      Alert.alert('Error', 'Failed to save plan. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const styles = createStyles(colors, isDark, textSizeMultiplier);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
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
        <Text style={styles.headerTitle}>Wallet Rules</Text>
        <Pressable
          onPress={async () => {
            if (Platform.OS !== 'web') {
              haptics.lightImpact();
            }
            if (planId) {
              await saveLastStep(planId, '/create-vault/wallet-rules');
            }
            router.push('/(tabs)');
          }}
          style={styles.cancelButton}
        >
          <X size={24} color={colors.text} />
        </Pressable>
      </View>

      <KeyboardAvoidingWrapper contentContainerStyle={styles.scrollContent}>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
          <Text style={styles.title}>Set up wallet rules</Text>
          <Text style={styles.subtitle}>
            Configure how money can be spent from this plan's wallet
          </Text>

          {/* Spending Permission */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Unlock size={20} color={colors.primary} />
              <Text style={styles.sectionTitle}>Spending Permission</Text>
            </View>
            <View style={styles.optionsContainer}>
              <Pressable
                style={[
                  styles.optionButton,
                  spendingPermission === 'open' && styles.optionButtonSelected,
                ]}
                onPress={() => {
                  haptics.selection();
                  setSpendingPermission('open');
                }}
              >
                <Text style={[
                  styles.optionText,
                  spendingPermission === 'open' && styles.optionTextSelected,
                ]}>
                  Open
                </Text>
                <Text style={styles.optionDescription}>
                  Free to spend from wallet
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.optionButton,
                  spendingPermission === 'restricted' && styles.optionButtonSelected,
                ]}
                onPress={() => {
                  haptics.selection();
                  setSpendingPermission('restricted');
                }}
              >
                <Text style={[
                  styles.optionText,
                  spendingPermission === 'restricted' && styles.optionTextSelected,
                ]}>
                  Restricted
                </Text>
                <Text style={styles.optionDescription}>
                  Requires approval to spend
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Lock Settings */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Lock size={20} color={colors.primary} />
              <Text style={styles.sectionTitle}>Lock Settings</Text>
            </View>
            <View style={styles.optionsContainer}>
              <Pressable
                style={[
                  styles.optionButton,
                  lockType === 'none' && styles.optionButtonSelected,
                ]}
                onPress={() => {
                  haptics.selection();
                  setLockType('none');
                  setShowPinInput(false);
                }}
              >
                <Text style={[
                  styles.optionText,
                  lockType === 'none' && styles.optionTextSelected,
                ]}>
                  No Lock
                </Text>
                <Text style={styles.optionDescription}>
                  No restrictions on withdrawals
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.optionButton,
                  lockType === 'instant' && styles.optionButtonSelected,
                ]}
                onPress={() => {
                  haptics.selection();
                  setLockType('instant');
                  setShowPinInput(false);
                }}
              >
                <Shield size={20} color={lockType === 'instant' ? colors.primary : colors.textSecondary} />
                <Text style={[
                  styles.optionText,
                  lockType === 'instant' && styles.optionTextSelected,
                ]}>
                  Instant Lock
                </Text>
                <Text style={styles.optionDescription}>
                  Requires confirmation to unlock
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.optionButton,
                  lockType === '24h_delay' && styles.optionButtonSelected,
                ]}
                onPress={() => {
                  haptics.selection();
                  setLockType('24h_delay');
                  setShowPinInput(false);
                }}
              >
                <Text style={[
                  styles.optionText,
                  lockType === '24h_delay' && styles.optionTextSelected,
                ]}>
                  24 Hour Delay
                </Text>
                <Text style={styles.optionDescription}>
                  Unlock request delayed by 24 hours
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.optionButton,
                  lockType === 'pin_required' && styles.optionButtonSelected,
                ]}
                onPress={() => {
                  haptics.selection();
                  setLockType('pin_required');
                  setShowPinInput(true);
                }}
              >
                <Key size={20} color={lockType === 'pin_required' ? colors.primary : colors.textSecondary} />
                <Text style={[
                  styles.optionText,
                  lockType === 'pin_required' && styles.optionTextSelected,
                ]}>
                  PIN Required
                </Text>
                <Text style={styles.optionDescription}>
                  Requires PIN to unlock
                </Text>
              </Pressable>
            </View>

            {/* PIN Input */}
            {lockType === 'pin_required' && (
              <View style={styles.pinContainer}>
                <Text style={styles.pinLabel}>Set 4-Digit PIN</Text>
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
                <Text style={styles.pinLabel}>Confirm PIN</Text>
                <TextInput
                  style={styles.pinInput}
                  placeholder="0000"
                  placeholderTextColor={colors.textTertiary}
                  keyboardType="number-pad"
                  maxLength={4}
                  secureTextEntry
                  value={confirmPin}
                  onChangeText={(text) => {
                    if (/^\d*$/.test(text) && text.length <= 4) {
                      setConfirmPin(text);
                    }
                  }}
                />
                {pin && confirmPin && pin !== confirmPin && (
                  <Text style={styles.pinError}>PINs do not match</Text>
                )}
              </View>
            )}
          </View>

          {/* Alerts */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Bell size={20} color={colors.primary} />
              <Text style={styles.sectionTitle}>Alerts</Text>
            </View>
            <View style={styles.alertsContainer}>
              <Pressable
                style={styles.alertItem}
                onPress={() => {
                  haptics.selection();
                  setAlertAt70Percent(!alertAt70Percent);
                }}
              >
                <View style={[
                  styles.checkbox,
                  alertAt70Percent && styles.checkboxSelected,
                ]}>
                  {alertAt70Percent && <View style={styles.checkboxInner} />}
                </View>
                <View style={styles.alertTextContainer}>
                  <Text style={styles.alertTitle}>Notify at 70% spent</Text>
                  <Text style={styles.alertDescription}>
                    Get notified when you've spent 70% of your plan budget
                  </Text>
                </View>
              </Pressable>

              <Pressable
                style={styles.alertItem}
                onPress={() => {
                  haptics.selection();
                  setAlertRiskFailure(!alertRiskFailure);
                }}
              >
                <View style={[
                  styles.checkbox,
                  alertRiskFailure && styles.checkboxSelected,
                ]}>
                  {alertRiskFailure && <View style={styles.checkboxInner} />}
                </View>
                <View style={styles.alertTextContainer}>
                  <Text style={styles.alertTitle}>Notify when plan risks failing</Text>
                  <Text style={styles.alertDescription}>
                    Get notified if your plan is at risk of not meeting its deadline
                  </Text>
                </View>
              </Pressable>

              <Pressable
                style={styles.alertItem}
                onPress={() => {
                  haptics.selection();
                  setAlertWeeklyProgress(!alertWeeklyProgress);
                }}
              >
                <View style={[
                  styles.checkbox,
                  alertWeeklyProgress && styles.checkboxSelected,
                ]}>
                  {alertWeeklyProgress && <View style={styles.checkboxInner} />}
                </View>
                <View style={styles.alertTextContainer}>
                  <Text style={styles.alertTitle}>Notify weekly progress</Text>
                  <Text style={styles.alertDescription}>
                    Receive weekly updates on your plan's progress
                  </Text>
                </View>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingWrapper>

      <FloatingButton
        title="Continue"
        onPress={handleContinue}
        disabled={isSaving || (lockType === 'pin_required' && (!pin || pin.length !== 4 || pin !== confirmPin))}
        hapticType="medium"
      />
    </SafeAreaView>
  );
}

const createStyles = (colors: any, isDark: boolean, textSizeMultiplier: number) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
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
    title: {
      fontSize: getScaledFontSize(24, textSizeMultiplier),
      fontWeight: '700',
      color: colors.text,
      marginBottom: 8,
    },
    subtitle: {
      fontSize: getScaledFontSize(14, textSizeMultiplier),
      color: colors.textSecondary,
      marginBottom: 32,
      lineHeight: 20,
    },
    section: {
      marginBottom: 32,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 16,
    },
    sectionTitle: {
      fontSize: getScaledFontSize(16, textSizeMultiplier),
      fontWeight: '600',
      color: colors.text,
    },
    optionsContainer: {
      gap: 12,
    },
    optionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      backgroundColor: colors.card,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: colors.border,
      gap: 12,
    },
    optionButtonSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.primary + '10',
    },
    optionText: {
      fontSize: getScaledFontSize(16, textSizeMultiplier),
      fontWeight: '500',
      color: colors.text,
      flex: 1,
    },
    optionTextSelected: {
      color: colors.primary,
      fontWeight: '600',
    },
    optionDescription: {
      fontSize: getScaledFontSize(12, textSizeMultiplier),
      color: colors.textSecondary,
      marginTop: 4,
    },
    pinContainer: {
      marginTop: 16,
      padding: 16,
      backgroundColor: colors.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    pinLabel: {
      fontSize: getScaledFontSize(14, textSizeMultiplier),
      fontWeight: '500',
      color: colors.text,
      marginBottom: 8,
      marginTop: 8,
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
      borderColor: colors.border,
      marginBottom: 8,
    },
    pinError: {
      fontSize: getScaledFontSize(12, textSizeMultiplier),
      color: colors.error || '#DC2626',
      marginTop: 4,
    },
    alertsContainer: {
      gap: 12,
    },
    alertItem: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      padding: 16,
      backgroundColor: colors.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 12,
    },
    checkbox: {
      width: 24,
      height: 24,
      borderRadius: 6,
      borderWidth: 2,
      borderColor: colors.border,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.background,
      marginTop: 2,
    },
    checkboxSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.primary,
    },
    checkboxInner: {
      width: 8,
      height: 8,
      borderRadius: 2,
      backgroundColor: '#fff',
    },
    alertTextContainer: {
      flex: 1,
    },
    alertTitle: {
      fontSize: getScaledFontSize(15, textSizeMultiplier),
      fontWeight: '600',
      color: colors.text,
      marginBottom: 4,
    },
    alertDescription: {
      fontSize: getScaledFontSize(13, textSizeMultiplier),
      color: colors.textSecondary,
      lineHeight: 18,
    },
  });
