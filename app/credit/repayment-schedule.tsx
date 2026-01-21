import { ScrollView, View, Text, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ArrowLeft, Clock, CheckCircle, AlertTriangle, RotateCcw } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useCreditRepayments } from '@/hooks/useCreditRepayments';

export default function CreditRepaymentScheduleScreen() {
  const { colors } = useTheme();
  const { schedule, isLoading } = useCreditRepayments();
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
        <Text style={styles.headerTitle}>Repayment Schedule</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {isLoading && <Text style={{ color: colors.textSecondary }}>Loading...</Text>}
        {!isLoading && schedule.length === 0 && (
          <Text style={{ color: colors.textSecondary }}>No repayments scheduled yet.</Text>
        )}
        {!isLoading &&
          schedule.map((item) => (
            <View key={item.id} style={styles.card}>
              <View style={styles.row}>
                <Text style={styles.label}>Due</Text>
                <Text style={styles.value}>{item.dueDate}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.label}>Amount</Text>
                <Text style={styles.value}>₦{item.amount.toLocaleString()}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.label}>Status</Text>
                <Status status={item.status} />
              </View>
              <View style={styles.row}>
                <Text style={styles.label}>Attempts</Text>
                <Text style={styles.value}>{item.attempts} attempt(s)</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.label}>Successful Account</Text>
                <Text style={styles.value}>{item.successfulAccount || 'Pending'}</Text>
              </View>
            </View>
          ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function Status({ status }: { status: 'pending' | 'processing' | 'completed' | 'failed' }) {
  const { colors } = useTheme();
  const iconColor =
    status === 'completed' ? '#22c55e' : status === 'failed' ? '#ef4444' : colors.textSecondary;
  const Icon =
    status === 'completed' ? CheckCircle : status === 'failed' ? AlertTriangle : Clock;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <Icon size={16} color={iconColor} />
      <Text style={{ color: colors.text, fontSize: 14, textTransform: 'capitalize' }}>{status}</Text>
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
    content: { padding: 16, paddingBottom: 32, gap: 12 },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 8,
    },
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    label: { fontSize: 13, color: colors.textSecondary },
    value: { fontSize: 14, fontWeight: '600', color: colors.text },
  });
