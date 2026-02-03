import { View, Text, StyleSheet, Pressable, TextInput, Alert, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator } from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { router } from 'expo-router';
import { ArrowLeft, Building2, ShieldCheck, Zap } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { PaymentService } from '@/services/PaymentService';
import { useHaptics } from '@/hooks/useHaptics';
import { useAuth } from '@/contexts/AuthContext';
import { useBalance } from '@/contexts/BalanceContext';
import FloatingButton from '@/components/FloatingButton';
import SafeFooter from '@/components/SafeFooter';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from '@/lib/supabase';
import * as Linking from 'expo-linking';

export default function DepositScreen() {
  const { colors } = useTheme();
  const { session } = useAuth();
  const { refreshWallet } = useBalance();
  const haptics = useHaptics();
  
  const [hasMandate, setHasMandate] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [amount, setAmount] = useState('');

  const checkMandate = useCallback(async () => {
    if (!session?.user?.id) return;
    try {
      const { data } = await supabase
        .from('profiles')
        .select('mandate_id')
        .eq('id', session.user.id)
        .single();
        
      if (data?.mandate_id) {
        setHasMandate(true);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }, [session]);

  useEffect(() => {
    checkMandate();
  }, [checkMandate]);

  // Handle Deep Link Return
  useEffect(() => {
    const handleDeepLink = (event: { url: string }) => {
      if (event.url.includes('mandate-status')) {
        console.log("Deep link received:", event.url);
        // Close browser and proceed
        WebBrowser.dismissBrowser();
        haptics.success();
        Alert.alert('Success', 'Bank linking initiated! Please wait a few moments for verification.');
        checkMandate();
      }
    };

    const subscription = Linking.addEventListener('url', handleDeepLink);
    return () => subscription.remove();
  }, []);

  const handleLinkBank = async () => {
    if (!session?.user?.id) return;
    
    try {
      setIsProcessing(true);
      haptics.mediumImpact();

      const email = session.user.email || '';
      const firstName = session.user.user_metadata?.first_name || '';
      const lastName = session.user.user_metadata?.last_name || '';
      const fullName = `${firstName} ${lastName}`.trim() || 'Planmoni User';

      // 1. Get Mandate Setup URL from Backend
      const { mono_url } = await PaymentService.initiateMandateSetup(
        session.user.id,
        email,
        fullName
      );

      if (mono_url) {
        // 2. Open external system browser (Best for app switching/bank transfers)
        await Linking.openURL(mono_url);
        // Note: Success is handled by the Linking listener above when Mono redirects to planmoni://
      }
    } catch (error: any) {
      console.error("Linking Error:", error);
      haptics.error();
      Alert.alert('Linking Failed', error.message || 'Failed to initiate bank linking.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePayNow = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount.');
      return;
    }

    try {
      setIsProcessing(true);
      haptics.mediumImpact();

      const numericAmount = parseFloat(amount.replace(/,/g, ''));
      
      await PaymentService.chargeSavedBank(
        numericAmount,
        session?.user?.id!,
        `Deposit: ₦${amount}`
      );

      haptics.success();
      refreshWallet();
      
      Alert.alert('Success', 'Deposit successful!', [
        { text: 'OK', onPress: () => router.replace('/(tabs)') }
      ]);

    } catch (error: any) {
      haptics.error();
      if (error.message.includes('Insufficient funds')) {
        Alert.alert('Failed', 'Insufficient funds in your linked bank account.');
      } else {
        Alert.alert(
          'Charge Failed', 
          'We could not charge your saved bank. Please try linking it again.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Re-link Bank', onPress: handleLinkBank }
          ]
        );
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const styles = createStyles(colors);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
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
        <Text style={styles.headerTitle}>Direct Deposit</Text>
      </View>

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.iconContainer}>
            <Building2 size={48} color={colors.primary} />
          </View>
          
          <Text style={styles.title}>
            {hasMandate ? 'Instant Deposit' : 'Link Bank for Deposits'}
          </Text>
          <Text style={styles.subtitle}>
            {hasMandate 
              ? 'Enter amount to charge your saved bank.' 
              : 'Link your bank once, deposit instantly forever.'}
          </Text>

          {hasMandate ? (
            <View style={styles.inputContainer}>
              <Text style={styles.currencySymbol}>₦</Text>
              <TextInput
                style={styles.input}
                placeholder="0.00"
                placeholderTextColor={colors.textSecondary}
                keyboardType="numeric"
                value={amount}
                onChangeText={setAmount}
                editable={!isProcessing}
              />
            </View>
          ) : (
            <View style={styles.benefitList}>
              <View style={styles.benefitItem}>
                <Zap size={20} color={colors.primary} />
                <Text style={styles.benefitText}>Instant funding anytime</Text>
              </View>
              <View style={styles.benefitItem}>
                <ShieldCheck size={20} color={colors.primary} />
                <Text style={styles.benefitText}>Bank-grade security</Text>
              </View>
            </View>
          )}

          <View style={styles.infoBox}>
            <ShieldCheck size={20} color={colors.textSecondary} />
            <Text style={styles.infoText}>
              {hasMandate 
                ? 'Secured by Mono Direct Debit.' 
                : 'We use Mono to securely link your account.'}
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <FloatingButton 
        title={
          isProcessing 
            ? "Processing..." 
            : hasMandate 
              ? "Pay Now" 
              : "Link Bank Account"
        }
        onPress={hasMandate ? handlePayNow : handleLinkBank}
        disabled={isProcessing || (hasMandate && !amount)}
      />
      
      <SafeFooter />
    </SafeAreaView>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundSecondary,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
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
    padding: 24,
    alignItems: 'center',
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.backgroundTertiary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 32,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 20,
    paddingVertical: 16,
    marginBottom: 24,
    width: '100%',
  },
  currencySymbol: {
    fontSize: 24,
    fontWeight: '600',
    color: colors.text,
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 24,
    fontWeight: '600',
    color: colors.text,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.backgroundTertiary,
    padding: 16,
    borderRadius: 12,
    width: '100%',
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  benefitList: {
    width: '100%',
    gap: 16,
    marginBottom: 32,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.card,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  benefitText: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
  }
});