import { View, Text, StyleSheet, Pressable, TextInput, Alert, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator } from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { router } from 'expo-router';
import { ArrowLeft, Building2, ShieldCheck, Link, Banknote } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { PaymentService } from '@/services/PaymentService';
import { useHaptics } from '@/hooks/useHaptics';
import { useAuth } from '@/contexts/AuthContext';
import { useBalance } from '@/contexts/BalanceContext';
import FloatingButton from '@/components/FloatingButton';
import SafeFooter from '@/components/SafeFooter';
import { MonoProvider, useMonoConnect } from '@mono.co/connect-react-native'; // SDK
import { supabase } from '@/lib/supabase';

function DepositContent({ hasMandate, onLinkSuccess, isLinking, monoCustomerId }: { hasMandate: boolean; onLinkSuccess: () => void; isLinking: boolean; monoCustomerId?: string }) {
  const { colors } = useTheme();
  const { session } = useAuth();
  const { refreshWallet } = useBalance();
  const haptics = useHaptics();
  const { init } = useMonoConnect();
  
  const [amount, setAmount] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleLinkBank = () => {
    if (!monoCustomerId) {
      Alert.alert("Please Wait", "Preparing your secure connection...");
      return;
    }
    haptics.mediumImpact();
    init(); // Open SDK Widget
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
      setIsProcessing(false);
      Alert.alert('Success', 'Deposit successful!', [{ text: 'OK', onPress: () => router.replace('/(tabs)') }]);

    } catch (error: any) {
      haptics.error();
      setIsProcessing(false);
      Alert.alert('Charge Failed', error.message || 'Could not charge your saved bank.');
    }
  };

  const styles = createStyles(colors);

  if (isLinking) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.text, { marginTop: 16 }]}>Finalizing bank link...</Text>
      </View>
    );
  }

  return (
    <>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.iconContainer}>
            <Building2 size={48} color={colors.primary} />
          </View>
          
          <Text style={styles.title}>{hasMandate ? 'Instant Deposit' : 'Link Bank for Deposits'}</Text>
          <Text style={styles.subtitle}>
            {hasMandate ? 'Enter amount to charge your saved bank.' : 'Link your bank once, deposit instantly forever.'}
          </Text>

          {hasMandate ? (
            <View style={{ width: '100%' }}>
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
              
              <Pressable 
                onPress={handleLinkBank}
                style={({ pressed }) => ({
                  marginTop: 16,
                  alignItems: 'center',
                  padding: 8,
                  opacity: pressed ? 0.7 : 1
                })}
                disabled={isProcessing}
              >
                <Text style={{ 
                  color: colors.primary, 
                  fontWeight: '600',
                  fontSize: 14 
                }}>
                  Link a different bank
                </Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.benefitList}>
              <View style={styles.benefitItem}>
                <Banknote size={20} color={colors.primary} />
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
              {hasMandate ? 'Secured by Mono Direct Debit.' : 'We use Mono to securely link your account.'}
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <FloatingButton 
        title={isProcessing ? "Processing..." : hasMandate ? "Pay Now" : "Link Bank Account"}
        onPress={hasMandate ? handlePayNow : handleLinkBank}
        disabled={isProcessing || (hasMandate && !amount)}
      />
    </>
  );
}

export default function DepositScreen() {
  const { colors } = useTheme();
  const { session } = useAuth();
  
  // DEBUG: Check which key is actually loaded
  console.log("[MONO DEBUG] Public Key:", process.env.EXPO_PUBLIC_MONO_PUBLIC_KEY);
  
  const [hasMandate, setHasMandate] = useState(false);
  const [monoCustomerId, setMonoCustomerId] = useState<string | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [isLinking, setIsLinking] = useState(false);

  const initializeUser = useCallback(async () => {
    if (!session?.user?.id) return;
    try {
      const { data } = await supabase
        .from('profiles')
        .select('mandate_id, mono_customer_id')
        .eq('id', session.user.id)
        .single();
        
      if (data?.mandate_id) setHasMandate(true);
      
      const prep = await PaymentService.prepareMonoUser(
          session.user.id,
          session.user.email || "",
          `${session.user.user_metadata.first_name} ${session.user.user_metadata.last_name}`
      );
      
      if (prep.customer_id) setMonoCustomerId(prep.customer_id);

    } catch (e) {
      console.error("Init Error:", e);
    } finally {
      setIsLoading(false);
    }
  }, [session]);

  useEffect(() => {
    initializeUser();
  }, [initializeUser]);

  const handleMonoSuccess = async (data: any) => {
    const code = data.code; 
    if (code && session?.user?.id) {
      try {
        setIsLinking(true);
        await PaymentService.exchangeMandate(code, session.user.id);
        setHasMandate(true);
        Alert.alert('Success', 'Bank linked successfully!');
      } catch (error: any) {
        Alert.alert('Linking Failed', error.message);
      } finally {
        setIsLinking(false);
      }
    }
  };

  const monoConfig = {
    publicKey: "live_pk_k5pombyvwunpk5kj5q4r",
    scope: "auth", 
    data: {
      type: 'recurring-debit', 
      period: 'variable',      
      amount: 0,
      ...(monoCustomerId ? { customer: { id: monoCustomerId } } : {})
    },
    onSuccess: handleMonoSuccess
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
    <MonoProvider {...monoConfig}>
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft size={24} color={colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Direct Deposit</Text>
        </View>

        <DepositContent 
          hasMandate={hasMandate} 
          onLinkSuccess={() => setHasMandate(true)}
          isLinking={isLinking}
          monoCustomerId={monoCustomerId}
        />
        <SafeFooter />
      </SafeAreaView>
    </MonoProvider>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.backgroundSecondary },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
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
  infoText: { flex: 1, fontSize: 14, color: colors.textSecondary, lineHeight: 20 },
  text: { color: colors.text, fontSize: 16 },
  benefitList: { width: '100%', gap: 16, marginBottom: 32 },
  benefitItem: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.card, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: colors.border },
  benefitText: { fontSize: 16, fontWeight: '500', color: colors.text }
});
