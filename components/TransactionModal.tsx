import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { X, Copy, ArrowUpRight, ArrowDownRight } from 'lucide-react-native';
import Button from '@/components/Button';
import { useTheme } from '@/contexts/ThemeContext';

type TransactionModalProps = {
  isVisible: boolean;
  onClose: () => void;
  transaction: {
    amount: string;
    status: string;
    date: string;
    time: string;
    type: string;
    source: string;
    destination: string;
    transactionId: string;
    planRef: string;
    paymentMethod: string;
    initiatedBy: string;
    processingTime: string;
  };
};

export default function TransactionModal({ isVisible, onClose, transaction }: TransactionModalProps) {
  const { colors } = useTheme();
  
  if (!isVisible) return null;

  const handleCopyTransactionId = () => {
    // Implement copy functionality
  };

  const isPositive = transaction.amount.startsWith('+');

  const styles = createStyles(colors);

  return (
    <View style={styles.overlay}>
      <View style={styles.modal}>
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <Text style={styles.title}>Transaction Details</Text>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <X size={24} color="#FFFFFF" />
            </Pressable>
          </View>
          <View style={styles.amountSection}>
            <View style={[styles.amountIcon, { backgroundColor: isPositive ? '#DCFCE7' : '#FEE2E2' }]}>
              {isPositive ? (
                <ArrowUpRight size={24} color="#22C55E" />
              ) : (
                <ArrowDownRight size={24} color="#EF4444" />
              )}
            </View>
            <View>
              <Text style={[styles.amount, isPositive ? styles.positiveAmount : styles.negativeAmount]}>
                {transaction.amount}
              </Text>
              <Text style={[styles.status, isPositive ? styles.positiveStatus : styles.negativeStatus]}>
                {transaction.status}
              </Text>
            </View>
          </View>
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Transaction Information</Text>
            <View style={styles.field}>
              <Text style={styles.label}>Date & Time</Text>
              <Text style={styles.value}>{transaction.date} at {transaction.time}</Text>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Transaction Type</Text>
              <Text style={styles.value}>{transaction.type}</Text>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Source</Text>
              <Text style={styles.value}>{transaction.source}</Text>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Destination</Text>
              <Text style={styles.value}>{transaction.destination}</Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Reference Details</Text>
            <View style={styles.field}>
              <Text style={styles.label}>Transaction ID</Text>
              <View style={styles.idContainer}>
                <Text style={styles.value}>{transaction.transactionId}</Text>
                <Pressable onPress={handleCopyTransactionId} style={styles.copyButton}>
                  <Copy size={20} color="#3B82F6" />
                </Pressable>
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Payout Plan Ref</Text>
              <Text style={styles.value}>{transaction.planRef}</Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Additional Details</Text>
            <View style={styles.field}>
              <Text style={styles.label}>Payment Method</Text>
              <Text style={styles.value}>{transaction.paymentMethod}</Text>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Initiated By</Text>
              <Text style={styles.value}>{transaction.initiatedBy}</Text>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Processing Time</Text>
              <Text style={styles.value}>{transaction.processingTime}</Text>
            </View>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Button
            title="Download Receipt"
            style={styles.receiptButton}
          />
          <Button
            title="Report an Issue"
            variant="outline"
            style={styles.reportButton}
          />
        </View>
      </View>
    </View>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modal: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    width: '100%',
    maxWidth: 480,
    maxHeight: '90%',
    overflow: 'hidden',
  },
  header: {
    backgroundColor: '#1E3A8A',
    padding: 24,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  closeButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 20,
  },
  amountSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  amountIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  amount: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  positiveAmount: {
    color: '#22C55E',
  },
  negativeAmount: {
    color: '#EF4444',
  },
  status: {
    fontSize: 14,
    fontWeight: '500',
  },
  positiveStatus: {
    color: '#22C55E',
  },
  negativeStatus: {
    color: '#EF4444',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 16,
  },
  field: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  value: {
    fontSize: 16,
    color: colors.text,
    fontWeight: '500',
  },
  idContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.backgroundTertiary,
    padding: 12,
    borderRadius: 8,
  },
  copyButton: {
    padding: 8,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 8,
  },
  footer: {
    padding: 24,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  receiptButton: {
    backgroundColor: '#1E3A8A',
  },
  reportButton: {
    borderColor: colors.border,
  },
});