import { ScrollView, View, Text, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';

export default function CreditTermsScreen() {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/credit');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={handleBack} style={styles.headerButton}>
          <ArrowLeft size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Credit Terms</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Key Points</Text>
        <Bullet>Interest is calculated on a simple basis; see offer for exact rate.</Bullet>
        <Bullet>Repayment is automatic via Mono mandate (BVN multi-account debit).</Bullet>
        <Bullet>Mandate “ready-to-debit” may take ~24h after approval (per Mono).</Bullet>
        <Bullet>E-mandate may require a ₦50 authorization transfer to NIBSS.</Bullet>
        <Bullet>Funds access (payout schedule) is separate from repayment schedule.</Bullet>
        <Bullet>Settlement-only crediting: wallet credits occur only after settled debits.</Bullet>
        <Bullet>Reversals: any reversed debit will be reversed from wallet/transactions.</Bullet>
        <Bullet>Name match required for mandate approval (per bank rules).</Bullet>
        <Bullet>Global Standing Mandate (GSM) provides broader debit authority.</Bullet>

        <Text style={styles.title}>Your Consents</Text>
        <Bullet>You authorize recurring debits up to your agreed credit amount + fees.</Bullet>
        <Bullet>You consent to debits from any account linked to your BVN after authorization.</Bullet>
        <Bullet>You agree to provide accurate identity details for mandate approval.</Bullet>
        <Bullet>You acknowledge that missed payments may trigger retries and fees.</Bullet>

        <Text style={styles.title}>Support</Text>
        <Text style={styles.paragraph}>
          For help with mandates, GSM, or repayments, contact support from the Help section. If your mandate was cancelled, you may need to re-authorize it before further debit attempts can be made.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: 10, marginBottom: 8 }}>
      <Text style={{ color: colors.primary, fontSize: 12, marginTop: 2 }}>•</Text>
      <Text style={{ flex: 1, color: colors.text, fontSize: 14, lineHeight: 20 }}>{children}</Text>
    </View>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.backgroundSecondary },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 14,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { fontSize: 18, fontWeight: '600', color: colors.text },
    headerSpacer: { width: 40, height: 40 },
    content: { padding: 16, paddingBottom: 32 },
    title: { fontSize: 16, fontWeight: '700', color: colors.text, marginTop: 12, marginBottom: 8 },
    paragraph: { fontSize: 14, color: colors.textSecondary, lineHeight: 20, marginBottom: 12 },
  });
