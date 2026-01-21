import { useState, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ArrowLeft, Info, ShieldCheck, CheckSquare, Square } from 'lucide-react-native';
import Button from '@/components/Button';
import { useTheme } from '@/contexts/ThemeContext';
import { useCreditAssessment } from '@/hooks/useCreditAssessment';
import { useCreditApplication } from '@/hooks/useCreditApplication';
import { useToast } from '@/contexts/ToastContext';

const TENOR_OPTIONS = [30, 60, 90];

export default function CreditApplyScreen() {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const { assessment, isLoading } = useCreditAssessment();
  const { applyCredit, isApplying } = useCreditApplication();
  const { showToast } = useToast();

  const [amount, setAmount] = useState('');
  const [tenor, setTenor] = useState<number>(TENOR_OPTIONS[0]);
  const [agreeMandate, setAgreeMandate] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreeGSM, setAgreeGSM] = useState(false);

  const maxAmount = useMemo(() => assessment?.creditLimit || 0, [assessment]);

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/credit');
    }
  };

  const handleSubmit = async () => {
    const numericAmount = parseFloat((amount || '').replace(/,/g, ''));
    if (!numericAmount || numericAmount <= 0) {
      showToast('Enter a valid amount', 'error');
      return;
    }
    if (numericAmount > maxAmount) {
      showToast('Amount exceeds your limit', 'error');
      return;
    }
    if (!agreeMandate || !agreeTerms) {
      showToast('Please accept the required consents', 'error');
      return;
    }
    await applyCredit({
      amount: numericAmount,
      tenorDays: tenor,
      agreeGSM,
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={handleBack} style={styles.headerButton}>
          <ArrowLeft size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Apply for Credit</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <Text style={styles.label}>Amount</Text>
          <View style={styles.inputRow}>
            <Text style={styles.currency}>₦</Text>
            <TextInput
              style={styles.input}
              value={amount}
              onChangeText={setAmount}
              keyboardType="numeric"
              placeholder="0.00"
              placeholderTextColor={colors.textSecondary}
            />
          </View>
          <Text style={styles.hint}>Max: ₦{maxAmount.toLocaleString()}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Tenor</Text>
          <View style={styles.pillRow}>
            {TENOR_OPTIONS.map((option) => {
              const selected = option === tenor;
              return (
                <Pressable
                  key={option}
                  onPress={() => setTenor(option)}
                  style={[styles.pill, selected && styles.pillSelected]}
                >
                  <Text style={[styles.pillText, selected && styles.pillTextSelected]}>
                    {option} days
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <ShieldCheck size={18} color={colors.text} />
            <Text style={styles.sectionTitle}>Consents</Text>
          </View>

          <ConsentRow
            checked={agreeMandate}
            onToggle={() => setAgreeMandate(!agreeMandate)}
            text="I authorize mandate-based debits (BVN multi-account)."
          />
          <ConsentRow
            checked={agreeTerms}
            onToggle={() => setAgreeTerms(!agreeTerms)}
            text="I have read and accept the credit terms."
          />
          <ConsentRow
            checked={agreeGSM}
            onToggle={() => setAgreeGSM(!agreeGSM)}
            text="I consent to Global Standing Mandate (if applicable)."
          />

          <View style={styles.infoRow}>
            <Info size={16} color={colors.textSecondary} />
            <Text style={styles.infoText}>
              E-mandate may require a ₦50 authorization transfer (Mono/NIBSS) and up to ~24h to become ready-to-debit.
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Info size={16} color={colors.textSecondary} />
            <Text style={styles.infoText}>
              Payout scheduling only controls how you access funds; repayment is automatic via the mandate.
            </Text>
          </View>
        </View>

        <Button
          title="Submit Application"
          onPress={handleSubmit}
          loading={isApplying || isLoading}
          size="large"
        />
      </ScrollView>
    </SafeAreaView>
  );
}

function ConsentRow({
  checked,
  onToggle,
  text,
}: {
  checked: boolean;
  onToggle: () => void;
  text: string;
}) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onToggle} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 6 }}>
      {checked ? <CheckSquare size={20} color={colors.primary} /> : <Square size={20} color={colors.textSecondary} />}
      <Text style={{ flex: 1, color: colors.text, fontSize: 14, lineHeight: 20 }}>{text}</Text>
    </Pressable>
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
    content: { padding: 16, gap: 16, paddingBottom: 32 },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 12,
    },
    label: { fontSize: 14, fontWeight: '600', color: colors.text },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 12,
      backgroundColor: colors.backgroundTertiary,
    },
    currency: { fontSize: 16, color: colors.textSecondary, marginRight: 6 },
    input: { flex: 1, fontSize: 16, color: colors.text, paddingVertical: 12 },
    hint: { fontSize: 12, color: colors.textSecondary },
    pillRow: { flexDirection: 'row', gap: 8 },
    pill: {
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.backgroundTertiary,
    },
    pillSelected: { borderColor: colors.primary, backgroundColor: colors.accentBackground },
    pillText: { fontSize: 14, color: colors.text },
    pillTextSelected: { color: colors.primary, fontWeight: '600' },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    sectionTitle: { fontSize: 14, fontWeight: '600', color: colors.text },
    infoRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
    infoText: { flex: 1, fontSize: 12, color: colors.textSecondary, lineHeight: 18 },
  });
