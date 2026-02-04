import { View, Text, StyleSheet, Pressable, TextInput, Alert, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator } from 'react-native';
import { useState, useEffect } from 'react';
import { router } from 'expo-router';
import { ArrowLeft, Banknote, ShieldCheck } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { PaymentService } from '@/services/PaymentService';
import { useHaptics } from '@/hooks/useHaptics';
import { useAuth } from '@/contexts/AuthContext';
import { useBalance } from '@/contexts/BalanceContext';
import FloatingButton from '@/components/FloatingButton';
import SafeFooter from '@/components/SafeFooter';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';

export default function QuickDepositScreen() {
  const { colors } = useTheme();
  const { session } = useAuth();
  const { refreshWallet } = useBalance();
  const haptics = useHaptics();
  
  const [amount, setAmount] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [reference, setReference] = useState<string | null>(null);

  // Handle Return from Browser
  useEffect(() => {
    const handleDeepLink = async (event: { url: string }) => {
      if (event.url.includes('payment-return')) {
        console.log("Returned from payment. Verifying reference:", reference);
        if (reference) {
          verifyPayment(reference);
        }
      }
    };

    const subscription = Linking.addEventListener('url', handleDeepLink);
    return () => subscription.remove();
  }, [reference]);

  const verifyPayment = async (ref: string) => {
    try {
      setIsProcessing(true);
      const result = await PaymentService.verifyTransaction(ref);
      
      if (result.success && (result.data?.status === 'successful' || result.data?.status === 'paid')) {
        haptics.success();
        refreshWallet();
        router.replace({
          pathname: '/deposit-flow/success',
          params: { amount, methodTitle: 'Quick Deposit (Mono)' }
        });
      } else {
        Alert.alert("Pending", "Payment is still processing. We will update your wallet once confirmed.");
        router.replace('/(tabs)');
      }
    } catch (error) {
      console.error("Verification error:", error);
      Alert.alert("Verification Failed", "Please check your transaction history in a moment.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePayNow = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount.');
      return;
    }

    if (!session?.user?.id) return;

    try {
      setIsProcessing(true);
      haptics.mediumImpact();

      const numericAmount = parseFloat(amount.replace(/,/g, ''));
      const email = session.user.email || '';
      const name = `${session.user.user_metadata?.first_name || ''} ${session.user.user_metadata?.last_name || ''}`.trim() || 'Planmoni User';

      // 1. Initiate One-Time Deposit
      const { payment_link, reference: newRef } = await PaymentService.initiateInstantDeposit(
        numericAmount,
        email,
        name,
        `Quick Deposit: ₦${amount}`
      );

      if (payment_link) {
        setReference(newRef);
        // 2. Open Secure Browser
        await WebBrowser.openBrowserAsync(payment_link);
        
        // Note: For one-time payments, the user returns manually or via redirect.
        // We set processing false so the button is active if they come back without finishing.
        setIsProcessing(false);
      }
    } catch (error: any) {
      console.error("Quick Deposit Error:", error);
      haptics.error();
      Alert.alert('Deposit Failed', error.message || 'Failed to initiate payment.');
      setIsProcessing(false);
    }
  };

  const styles = createStyles(colors);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Quick Deposit</Text>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.iconContainer}>
            <Banknote size={48} color={colors.primary} />
          </View>
          
          <Text style={styles.title}>Instant Funding</Text>
          <Text style={styles.subtitle}>Enter an amount to fund your wallet instantly without linking a bank.</Text>

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

          <View style={styles.infoBox}>
            <ShieldCheck size={20} color={colors.textSecondary} />
            <Text style={styles.infoText}>
              Powered by Mono DirectPay. Secure one-time transaction.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <FloatingButton 
        title={isProcessing ? "Processing..." : "Pay Now"}
        onPress={handlePayNow}
        disabled={isProcessing || !amount}
      />
      
      <SafeFooter />
    </SafeAreaView>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.backgroundSecondary },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  backButton: { padding: 8, marginRight: 8 },
  headerTitle: { fontSize: 18, fontWeight: '600', color: colors.text },
  content: { padding: 24, alignItems: 'center' },
  iconContainer: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.backgroundTertiary, justifyContent: 'center', alignItems: 'center', marginBottom: 24 },
  title: { fontSize: 24, fontWeight: '700', color: colors.text, textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 16, color: colors.textSecondary, textAlign: 'center', marginBottom: 32 },
  inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 20, paddingVertical: 16, marginBottom: 24, width: '100%' },
  currencySymbol: { fontSize: 24, fontWeight: '600', color: colors.text, marginRight: 8 },
  input: { flex: 1, fontSize: 24, fontWeight: '600', color: colors.text },
  infoBox: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.backgroundTertiary, padding: 16, borderRadius: 12, width: '100%' },
  infoText: { flex: 1, fontSize: 14, color: colors.textSecondary, lineHeight: 20 }
});
