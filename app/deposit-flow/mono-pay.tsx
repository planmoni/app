/**
 * Mono DirectDebit Authorization Screen
 * Handles mandate creation and payment initiation from linked Mono bank accounts
 */

import { View, Text, StyleSheet, Pressable, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { ArrowLeft } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { useHaptics } from '@/hooks/useHaptics';

export default function MonoPayScreen() {
  const { colors } = useTheme();
  const haptics = useHaptics();
  const params = useLocalSearchParams();
  const accountId = params.accountId as string;
  const monoAccountId = params.monoAccountId as string;
  const bankName = params.bankName as string;

  useEffect(() => {
    // If required params are missing, redirect back
    if (!accountId || !monoAccountId) {
      Alert.alert(
        'Error',
        'Account information is missing. Please try again.',
        [
          {
            text: 'OK',
            onPress: () => {
              haptics.lightImpact();
              router.back();
            }
          }
        ]
      );
    }
  }, [accountId, monoAccountId, haptics]);

  const handleContinue = () => {
    if (!accountId || !monoAccountId) {
      Alert.alert('Error', 'Account information is missing');
      return;
    }

    haptics.mediumImpact();
    // Navigate to amount screen with mono-pay method type
    router.push({
      pathname: '/deposit-flow/amount',
      params: {
        newMethodType: 'mono-pay',
        accountId: accountId,
        monoAccountId: monoAccountId,
        bankName: bankName
      }
    });
  };

  const styles = createStyles(colors);

  if (!accountId || !monoAccountId) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft size={24} color={colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Error</Text>
        </View>
        <View style={styles.content}>
          <Text style={styles.message}>
            Account information is missing.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Pay with {bankName || 'Bank Account'}</Text>
      </View>
      <View style={styles.content}>
        <Text style={styles.message}>
          Pay directly from your linked {bankName || 'bank'} account
        </Text>
        <Text style={styles.subMessage}>
          You'll be able to authorize the payment after entering the amount.
        </Text>
        
        <Pressable 
          style={[styles.continueButton, { backgroundColor: colors.primary }]}
          onPress={handleContinue}
        >
          <Text style={styles.continueButtonText}>Continue</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
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
    padding: 8,
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  message: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 12,
  },
  subMessage: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 32,
  },
  continueButton: {
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    minWidth: 200,
    alignItems: 'center',
  },
  continueButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
