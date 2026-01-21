import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Clock, CheckCircle, AlertTriangle, ChevronRight } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';

type Repayment = {
  id: string;
  amount: number;
  dueDate: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
};

type Props = {
  isLoading?: boolean;
  nextRepayment: Repayment | null;
  schedule: Repayment[];
  onViewAll: () => void;
};

export default function RepaymentScheduleCard({ isLoading, nextRepayment, schedule, onViewAll }: Props) {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const statusCopy = (status: Repayment['status']) => {
    if (status === 'completed') return 'Completed';
    if (status === 'failed') return 'Failed';
    if (status === 'processing') return 'Processing';
    return 'Pending';
  };

  const statusIcon = (status: Repayment['status']) => {
    if (status === 'completed') return <CheckCircle size={16} color="#22c55e" />;
    if (status === 'failed') return <AlertTriangle size={16} color="#ef4444" />;
    if (status === 'processing') return <Clock size={16} color={colors.textSecondary} />;
    return <Clock size={16} color={colors.textSecondary} />;
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>Repayments</Text>
        <Pressable onPress={onViewAll} style={styles.viewAll}>
          <Text style={styles.viewAllText}>View all</Text>
          <ChevronRight size={16} color={colors.textSecondary} />
        </Pressable>
      </View>

      {isLoading && <Text style={styles.subText}>Loading...</Text>}
      {!isLoading && !nextRepayment && (
        <Text style={styles.subText}>No repayments scheduled yet.</Text>
      )}

      {!isLoading && nextRepayment && (
        <View style={styles.nextCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {statusIcon(nextRepayment.status)}
            <Text style={styles.nextLabel}>Next due</Text>
          </View>
          <Text style={styles.amount}>₦{nextRepayment.amount.toLocaleString()}</Text>
          <Text style={styles.subText}>{nextRepayment.dueDate}</Text>
          <Text style={styles.subText}>{statusCopy(nextRepayment.status)}</Text>
        </View>
      )}

      {!isLoading &&
        schedule.slice(0, 3).map((item) => (
          <View key={item.id} style={styles.row}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {statusIcon(item.status)}
              <Text style={styles.subText}>{item.dueDate}</Text>
            </View>
            <Text style={styles.value}>₦{item.amount.toLocaleString()}</Text>
          </View>
        ))}
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
      gap: 10,
    },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    title: { fontSize: 14, fontWeight: '700', color: colors.text },
    viewAll: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    viewAllText: { fontSize: 13, color: colors.textSecondary },
    nextCard: {
      backgroundColor: colors.backgroundTertiary,
      borderRadius: 12,
      padding: 12,
      gap: 4,
    },
    nextLabel: { fontSize: 12, color: colors.textSecondary },
    amount: { fontSize: 20, fontWeight: '700', color: colors.text },
    subText: { fontSize: 12, color: colors.textSecondary },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 6,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    value: { fontSize: 14, fontWeight: '600', color: colors.text },
  });
