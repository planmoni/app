import Button from '@/components/Button';
import { router } from 'expo-router';
import { ArrowLeft, Copy, Info } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View, useWindowDimensions, ToastAndroid } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import KeyboardAvoidingWrapper from '@/components/KeyboardAvoidingWrapper';
import { useHaptics } from '@/hooks/useHaptics';
import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';

type VirtualAccount = {
  account_number: string;
  bank_name: string;
  account_name: string;
};

export default function AddFundsScreen() {
  const { colors } = useTheme();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const haptics = useHaptics();

  // const styles = createStyles(colors);
  const [virtualAccount, setVirtualAccount] = useState<VirtualAccount | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  // Determine if we're on a small screen
  const isSmallScreen = width < 380 || height < 700;

  const handleCopyAccountNumber = () => {
    haptics.selection();
    // Implement copy functionality
    // if (virtualAccount?.account_number) {
    //   Clipboard.setStringAsync(virtualAccount.account_number);
    //   ToastAndroid.show('Account number copied to clipboard', ToastAndroid.SHORT);
    // }
    Clipboard.setStringAsync("muhammed@gmail.com");
    ToastAndroid.show('Account number copied to clipboard', ToastAndroid.SHORT);
  };
  
  const handleCreateVirtualAccount = async () => {
    setIsLoading(true);

    try{
      const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/create-virtual-account`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: (await supabase.auth.getUser()).data.user?.id,
        }),
      });

      const result = await response.json();
      if (response.ok) {
        setVirtualAccount(result.virtualAccount);
        ToastAndroid.show('Virtual account created successfully', ToastAndroid.SHORT);
      } else {
        ToastAndroid.show(result.message || 'Failed to create account', ToastAndroid.SHORT);
      }
    } catch (error) {
      console.error('Something went wrong', error);
      ToastAndroid.show('Something went wrong', ToastAndroid.SHORT);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMoreDepositMethods = () => {
    haptics.mediumImpact();
    router.push('/deposit-flow/payment-methods');
  };

  
  const fetchVirtualAccount = async () => {

    const { data, error } = await supabase
    .from('users')
    .select('paystack_account_number, paystack_account_name, paystack_bank_name')
    .eq('id', (await supabase.auth.getUser()).data.user?.id)
    .single();

    if (data && data.paystack_account_number) {
      setVirtualAccount({
        account_number: data.paystack_account_number,
        bank_name: data.paystack_bank_name, 
        account_name: data.paystack_account_name,
      });
    }

    if (error) {
      console.error('Error fetching virtual account:', error);
    }
   
  };

  useEffect(() => {
    fetchVirtualAccount();
  }, []);
  


  const handleBack = () => {
    haptics.lightImpact();
    router.back();
  };

  const handleDone = () => {
    haptics.mediumImpact();
    router.back();
  };

  const styles = createStyles(colors, isSmallScreen);

  // Calculate footer height including safe area
  const footerHeight = 80 + insets.bottom;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={handleBack} style={styles.backButton}>
          <ArrowLeft size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Add Funds</Text>
      </View>

      <KeyboardAvoidingWrapper 
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: footerHeight } // Add padding to account for fixed footer
        ]}
      >
        <View style={styles.content}>
          <Text style={styles.title}>Add funds via <Text style={styles.highlight}>Bank Transfer</Text></Text>
          <Text style={styles.description}>
            Money Transfers sent to this bank account number will automatically top up your Planmoni available wallet.
          </Text>

          {virtualAccount ? (
            <View style={styles.accountDetailsCard}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>9PBS Account Details</Text>
                <Text style={styles.cardDescription}>Use these details to receive funds directly</Text>
              </View>

              <View style={styles.fieldsContainer}>
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>Account Number</Text>
                  <View style={styles.accountNumberContainer}>
                    <Text style={styles.accountNumber}>9002893892</Text>
                    <Pressable onPress={handleCopyAccountNumber} style={styles.copyButton}>
                      <Copy size={20} color={colors.primary} />
                    </Pressable>
                  </View>
                </View>

                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>Bank Name</Text>
                  <View style={styles.fieldValueContainer}>
                    <Text style={styles.fieldValue}>9Payment Service Bank (9PSB)</Text>
                  </View>
                </View>

                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>Account Name</Text>
                  <View style={styles.fieldValueContainer}>
                    <Text style={styles.fieldValue}>John Doe Planmoni</Text>
                  </View>
                </View>
              </View>
            </View>
          ) : (
            <View style={{ marginTop: 40, marginBottom: 24 }}>
              <Text style={{ fontWeight: 900, color: "#f3f3f3" }}>Create Vituals Account</Text>
              <Button
                title="Create Account"
                onPress={handleCreateVirtualAccount}
                isLoading={isLoading}
                style={[commonStyles.buttonBase, commonStyles.primaryButton]}
              />
            </View>
          )}

          <View style={styles.infoSection}>
            <View style={styles.infoCard}>
              <View style={styles.infoHeader}>
                <View style={styles.infoIconContainer}>
                  <Info size={20} color={colors.primary} />
                </View>
                <Text style={styles.infoTitle}>Security Notice</Text>
              </View>
              <Text style={styles.infoText}>
                Funds will be added to your secure wallet and can be used for transactions or investments. Processing time is typically instant to 5 minutes.
              </Text>
            </View>
          </View>
        </View>
      </KeyboardAvoidingWrapper>

      {/* Fixed footer with safe area padding */}
      <View style={[
        styles.footer, 
        { paddingBottom: Math.max(16, insets.bottom) }
      ]}>
        <Button 
          title="Done"
          onPress={handleDone}
          style={styles.doneButton}
          hapticType="medium"
        />
        <Pressable onPress={handleMoreDepositMethods} style={styles.moreMethodsButton}>
          <Text style={styles.moreMethodsText}>More deposit methods</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const createStyles = (colors: any, isSmallScreen: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundSecondary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: isSmallScreen ? 12 : 16,
    paddingVertical: isSmallScreen ? 12 : 16,
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
    fontSize: isSmallScreen ? 16 : 18,
    fontWeight: '600',
    color: colors.text,
  },
  scrollContent: {
    padding: isSmallScreen ? 16 : 20,
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: isSmallScreen ? 20 : 24,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  highlight: {
    color: colors.primary,
  },
  description: {
    fontSize: isSmallScreen ? 13 : 14,
    color: colors.textSecondary,
    marginBottom: isSmallScreen ? 20 : 24,
    lineHeight: 20,
  },
  accountDetailsCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: isSmallScreen ? 20 : 24,
    overflow: 'hidden',
  },
  cardHeader: {
    padding: isSmallScreen ? 16 : 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.backgroundTertiary,
  },
  cardTitle: {
    fontSize: isSmallScreen ? 16 : 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  cardDescription: {
    fontSize: isSmallScreen ? 13 : 14,
    color: colors.textSecondary,
  },
  fieldsContainer: {
    padding: isSmallScreen ? 16 : 20,
    gap: isSmallScreen ? 16 : 20,
  },
  field: {
    marginBottom: 0, // Using gap in fieldsContainer instead
  },
  fieldLabel: {
    fontSize: isSmallScreen ? 13 : 14,
    fontWeight: '500',
    color: colors.textSecondary,
    marginBottom: 8,
  },
  accountNumberContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.backgroundTertiary,
    borderWidth: 1,
    borderColor: colors.border,
    padding: isSmallScreen ? 12 : 16,
    borderRadius: 12,
  },
  accountNumber: {
    fontSize: isSmallScreen ? 16 : 18,
    fontWeight: '600',
    color: colors.text,
    letterSpacing: 1,
  },
  copyButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  fieldValueContainer: {
    backgroundColor: colors.backgroundTertiary,
    borderWidth: 1,
    borderColor: colors.border,
    padding: isSmallScreen ? 12 : 16,
    borderRadius: 12,
  },
  fieldValue: {
    fontSize: isSmallScreen ? 14 : 16,
    fontWeight: '500',
    color: colors.text,
  },
  infoSection: {
    marginBottom: isSmallScreen ? 24 : 32,
  },
  infoCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: isSmallScreen ? 16 : 20,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.backgroundTertiary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  infoTitle: {
    fontSize: isSmallScreen ? 14 : 16,
    fontWeight: '600',
    color: colors.text,
  },
  infoText: {
    fontSize: isSmallScreen ? 13 : 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    padding: 16,
    gap: 16,
    alignItems: 'center',
  },
  doneButton: {
    width: '100%',
    backgroundColor: colors.primary,
  },
  moreMethodsButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  moreMethodsText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '500',
  },
});