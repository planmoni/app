import { View, Text, StyleSheet, Pressable, ScrollView, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { ArrowLeft, Copy, Building2, CreditCard, Smartphone, Landmark, ChevronRight, Info } from 'lucide-react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { useHaptics } from '@/hooks/useHaptics';
import { useToast } from '@/contexts/ToastContext';
import Button from '@/components/Button';

export default function AddFundsScreen() {
  const { colors, isDark } = useTheme();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const haptics = useHaptics();
  const { showToast } = useToast();
  
  // Determine if we're on a small screen
  const isSmallScreen = width < 380 || height < 700;

  const handleCopyAccountNumber = () => {
    haptics.selection();
    showToast('Account number copied to clipboard', 'success');
  };

  const handleNavigateToPaymentMethod = (route: string) => {
    haptics.mediumImpact();
    router.push(route);
  };

  const handleBack = () => {
    haptics.lightImpact();
    router.back();
  };

  const styles = createStyles(colors, isDark, isSmallScreen);

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

      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: footerHeight } // Add padding to account for fixed footer
        ]}
      >
        <Text style={styles.title}>Choose Payment Method</Text>
        <Text style={styles.description}>
          Select your preferred method to add funds to your Planmoni wallet
        </Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Bank Transfer</Text>
          <View style={styles.accountDetailsCard}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Account Details</Text>
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
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Other Payment Methods</Text>
          
          <Pressable 
            style={styles.paymentMethodButton}
            onPress={() => handleNavigateToPaymentMethod('/add-card')}
          >
            <View style={styles.methodLeft}>
              <View style={styles.methodIcon}>
                <CreditCard size={24} color={colors.primary} />
              </View>
              <View style={styles.methodInfo}>
                <Text style={styles.methodTitle}>Debit/Credit Card</Text>
                <Text style={styles.methodDescription}>Pay with Visa, Mastercard, or Verve</Text>
              </View>
            </View>
            <ChevronRight size={20} color={colors.textSecondary} />
          </Pressable>
          
          <Pressable 
            style={styles.paymentMethodButton}
            onPress={() => handleNavigateToPaymentMethod('/add-ussd')}
          >
            <View style={styles.methodLeft}>
              <View style={styles.methodIcon}>
                <Smartphone size={24} color={colors.primary} />
              </View>
              <View style={styles.methodInfo}>
                <Text style={styles.methodTitle}>USSD</Text>
                <Text style={styles.methodDescription}>Pay using your bank's USSD code</Text>
              </View>
            </View>
            <ChevronRight size={20} color={colors.textSecondary} />
          </Pressable>
          
          <Pressable 
            style={styles.paymentMethodButton}
            onPress={() => handleNavigateToPaymentMethod('/linked-accounts')}
          >
            <View style={styles.methodLeft}>
              <View style={styles.methodIcon}>
                <Building2 size={24} color={colors.primary} />
              </View>
              <View style={styles.methodInfo}>
                <Text style={styles.methodTitle}>Link Bank Account</Text>
                <Text style={styles.methodDescription}>Connect your bank account for direct transfers</Text>
              </View>
            </View>
            <ChevronRight size={20} color={colors.textSecondary} />
          </Pressable>
        </View>

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
      </ScrollView>

      {/* Fixed footer with safe area padding */}
      <View style={[
        styles.footer, 
        { paddingBottom: Math.max(16, insets.bottom) }
      ]}>
        <Button 
          title="Go to Payment Methods"
          onPress={() => handleNavigateToPaymentMethod('/deposit-flow/payment-methods')}
          style={styles.footerButton}
          hapticType="medium"
        />
      </View>
    </SafeAreaView>
  );
}

const createStyles = (colors: any, isDark: boolean, isSmallScreen: boolean) => StyleSheet.create({
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: isSmallScreen ? 16 : 20,
  },
  title: {
    fontSize: isSmallScreen ? 20 : 24,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  description: {
    fontSize: isSmallScreen ? 13 : 14,
    color: colors.textSecondary,
    marginBottom: isSmallScreen ? 20 : 24,
    lineHeight: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
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
  paymentMethodButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  methodLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  methodIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: isDark ? 'rgba(59, 130, 246, 0.1)' : '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  methodInfo: {
    flex: 1,
  },
  methodTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
    marginBottom: 4,
  },
  methodDescription: {
    fontSize: 14,
    color: colors.textSecondary,
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
  },
  footerButton: {
    width: '100%',
    backgroundColor: colors.primary,
  },
});