import Button from '@/components/Button';
import { router } from 'expo-router';
import { ArrowLeft, Copy, Info } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View, useWindowDimensions, ToastAndroid } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import KeyboardAvoidingWrapper from '@/components/KeyboardAvoidingWrapper';
import { useHaptics } from '@/hooks/useHaptics';
import * as Clipboard from 'expo-clipboard';

export default function AddFundsScreen() {
  const { colors } = useTheme();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const haptics = useHaptics();
  
  // Determine if we're on a small screen
  const isSmallScreen = width < 380 || height < 700;

  const handleCopyAccountNumber = () => {
    haptics.selection();
    // Implement copy functionality
    Clipboard.setStringAsync("9002893892");
    ToastAndroid.show('Account number copied to clipboard', ToastAndroid.SHORT);
  };

  const handleMoreDepositMethods = () => {
    haptics.mediumImpact();
    router.push('/deposit-flow/payment-methods');
  };

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

          <View style={styles.accountDetailsCard}>
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