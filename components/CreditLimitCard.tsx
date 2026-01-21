import { View, Text, StyleSheet, Pressable } from 'react-native';
import { ShieldCheck, Clock, CheckCircle, AlertTriangle, Zap } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import Button from '@/components/Button';

type MandateStatus = 'pending' | 'approved' | 'ready' | 'cancelled';

type Props = {
  isLoading?: boolean;
  limit: number;
  outstanding: number;
  recommended: number;
  mandateStatus: MandateStatus;
  readyToDebitAt: string | null;
  gsmEnabled: boolean;
  onApplyPress: () => void;
  onManageMandatePress: () => void;
};

export default function CreditLimitCard({
  isLoading,
  limit,
  outstanding,
  recommended,
  mandateStatus,
  readyToDebitAt,
  gsmEnabled,
  onApplyPress,
  onManageMandatePress,
}: Props) {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const mandateCopy =
    mandateStatus === 'ready'
      ? 'Mandate ready to debit (per Mono).'
      : mandateStatus === 'approved'
      ? 'Mandate approved. Waiting for ready-to-debit (~24h).'
      : mandateStatus === 'pending'
      ? 'Mandate required before credit.'
      : 'Mandate cancelled. Please re-authorize.';

  const statusIcon =
    mandateStatus === 'ready'
      ? <CheckCircle size={16} color="#22c55e" />
      : mandateStatus === 'approved'
      ? <Clock size={16} color={colors.textSecondary} />
      : mandateStatus === 'pending'
      ? <AlertTriangle size={16} color="#f59e0b" />
      : <AlertTriangle size={16} color="#ef4444" />;

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Text style={styles.title}>Credit Limit</Text>
        {gsmEnabled && (
          <View style={styles.badge}>
            <Zap size={14} color="#fff" />
            <Text style={styles.badgeText}>GSM</Text>
          </View>
        )}
      </View>
      <Text style={styles.limitValue}>
        {isLoading ? '...' : `₦${limit.toLocaleString()}`}
      </Text>
      <Text style={styles.subText}>Recommended: ₦{recommended.toLocaleString()}</Text>
      <Text style={styles.subText}>Outstanding: ₦{outstanding.toLocaleString()}</Text>

      <View style={styles.mandateRow}>
        {statusIcon}
        <Text style={styles.mandateText}>{mandateCopy}</Text>
      </View>
      {readyToDebitAt && (
        <Text style={styles.subText}>Ready-to-debit ETA: {readyToDebitAt}</Text>
      )}

      <View style={styles.actions}>
        <Button title="Apply" onPress={onApplyPress} size="large" />
        <Pressable onPress={onManageMandatePress} style={styles.secondaryButton}>
          <ShieldCheck size={16} color={colors.text} />
          <Text style={styles.secondaryText}>Manage Mandate</Text>
        </Pressable>
      </View>
    </View>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 8,
    },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    title: { fontSize: 14, fontWeight: '700', color: colors.text },
    limitValue: { fontSize: 28, fontWeight: '700', color: colors.text },
    subText: { fontSize: 12, color: colors.textSecondary },
    mandateRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
    mandateText: { fontSize: 13, color: colors.text },
    actions: { flexDirection: 'column', gap: 8, marginTop: 6 },
    secondaryButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      justifyContent: 'center',
      paddingVertical: 12,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.backgroundTertiary,
    },
    secondaryText: { color: colors.text, fontSize: 14, fontWeight: '600' },
    badge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: colors.primary,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
    },
    badgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  });
