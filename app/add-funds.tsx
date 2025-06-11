import Button from '@/components/Button';
import SafeFooter from '@/components/SafeFooter';
import { router } from 'expo-router';
import { ArrowLeft, Copy, Info } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import KeyboardAvoidingWrapper from '@/components/KeyboardAvoidingWrapper';

export default function AddFundsScreen() {
  const { colors } = useTheme();

  const handleCopyAccountNumber = () => {
    // Implement copy functionality
  };

  const handleMoreDepositMethods = () => {
    router.push('/deposit-flow/payment-methods');
  };

  const styles = createStyles(colors);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Add Funds</Text>
      </View>

      <KeyboardAvoidingWrapper contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          <Text style={styles.title}>Add funds via <Text style={styles.highlight}>Bank Transfer</Text></Text>
          <Text style={styles.description}>
            Money Transfers sent to this bank account number will automatically top up your Planmoni available wallet.
          </Text>

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

          <View style={styles.footer}>
            <Button 
              title="Done"
              onPress={() => router.back()}
              style={styles.doneButton}
            />
            <Pressable onPress={handleMoreDepositMethods} style={styles.moreMethodsButton}>
              <Text style={styles.moreMethodsText}>More deposit methods</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingWrapper>
      
      <SafeFooter />
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
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  highlight: {
    color: colors.primary,
  },
  description: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 24,
    lineHeight: 20,
  },
  accountDetailsCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 24,
    overflow: 'hidden',
  },
  cardHeader: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.backgroundTertiary,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  cardDescription: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  fieldsContainer: {
    padding: 20,
  },
  field: {
    marginBottom: 20,
  },
  fieldLabel: {
    fontSize: 14,
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
    padding: 16,
    borderRadius: 12,
  },
  accountNumber: {
    fontSize: 18,
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
    padding: 16,
    borderRadius: 12,
  },
  fieldValue: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
  },
  infoSection: {
    marginBottom: 32,
  },
  infoCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 20,
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
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  infoText: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  footer: {
    gap: 16,
    alignItems: 'center',
    marginTop: 'auto',
  },
  doneButton: {
    width: '100%',
    backgroundColor: colors.primary,
  },
  moreMethodsButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  moreMethodsText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '500',
  },
});