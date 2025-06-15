import { View, Text, StyleSheet, Pressable, ScrollView, Dimensions, useWindowDimensions } from 'react-native';
import { X, Copy, ArrowUpRight, ArrowDownRight, Download, TriangleAlert as AlertTriangle } from 'lucide-react-native';
import Button from '@/components/Button';
import { useTheme } from '@/contexts/ThemeContext';
import { useHaptics } from '@/hooks/useHaptics';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import { useToast } from '@/contexts/ToastContext';

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
  const { colors, isDark } = useTheme();
  const haptics = useHaptics();
  const { showToast } = useToast();
  const { width, height } = useWindowDimensions();
  
  // Determine if we're on a small screen
  const isSmallScreen = width < 380 || height < 700;
  
  if (!isVisible) return null;

  const handleCopyTransactionId = async () => {
    haptics.selection();
    try {
      await Clipboard.setStringAsync(transaction.transactionId);
      showToast('Transaction ID copied to clipboard', 'success');
    } catch (error) {
      showToast('Failed to copy to clipboard', 'error');
    }
  };

  const handleClose = () => {
    haptics.lightImpact();
    onClose();
  };

  const handleDownloadReceipt = () => {
    haptics.mediumImpact();
    showToast('Receipt download started', 'info');
    // Implement download functionality
  };

  const handleReportIssue = () => {
    haptics.notification(Haptics.NotificationFeedbackType.Warning);
    showToast('Issue reported', 'info');
    // Implement report functionality
  };

  const isPositive = transaction.type === 'Deposit';

  // Calculate responsive sizes
  const headerPadding = isSmallScreen ? 16 : 24;
  const contentPadding = isSmallScreen ? 16 : 24;
  const iconSize = isSmallScreen ? 40 : 48;
  const titleSize = isSmallScreen ? 18 : 20;
  const amountSize = isSmallScreen ? 20 : 24;
  const labelSize = isSmallScreen ? 12 : 14;
  const valueSize = isSmallScreen ? 14 : 16;
  const sectionTitleSize = isSmallScreen ? 14 : 16;
  const buttonPadding = isSmallScreen ? 12 : 16;

  const styles = createStyles(colors, isDark, {
    headerPadding,
    contentPadding,
    iconSize,
    titleSize,
    amountSize,
    labelSize,
    valueSize,
    sectionTitleSize,
    buttonPadding
  });

  return (
    <View style={styles.overlay}>
      <View style={styles.modal}>
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <Text style={styles.title}>Transaction Details</Text>
            <Pressable onPress={handleClose} style={styles.closeButton}>
              <X size={isSmallScreen ? 20 : 24} color="#FFFFFF" />
            </Pressable>
          </View>
          <View style={styles.amountSection}>
            <View style={[styles.amountIcon, { backgroundColor: isPositive ? '#DCFCE7' : '#FEE2E2' }]}>
              {isPositive ? (
                <ArrowUpRight size={isSmallScreen ? 20 : 24} color="#22C55E" />
              ) : (
                <ArrowDownRight size={isSmallScreen ? 20 : 24} color="#EF4444" />
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
              <Text style={styles.label}>Payment Method</Text>
              <Text style={styles.value}>{transaction.paymentMethod}</Text>
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
                <Text style={styles.value} numberOfLines={1} ellipsizeMode="middle">
                  {transaction.transactionId}
                </Text>
                <Pressable onPress={handleCopyTransactionId} style={styles.copyButton}>
                  <Copy size={isSmallScreen ? 16 : 20} color={colors.primary} />
                </Pressable>
              </View>
            </View>

            {transaction.planRef && (
              <View style={styles.field}>
                <Text style={styles.label}>Payout Plan Ref</Text>
                <Text style={styles.value} numberOfLines={1} ellipsizeMode="middle">
                  {transaction.planRef}
                </Text>
              </View>
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Additional Details</Text>
            <View style={styles.field}>
              <Text style={styles.label}>Initiated By</Text>
              <Text style={styles.value}>{transaction.initiatedBy}</Text>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Processing Time</Text>
              <Text style={styles.value}>{transaction.processingTime}</Text>
            </View>
            
            <View style={styles.noteContainer}>
              <AlertTriangle size={isSmallScreen ? 16 : 20} color={colors.textSecondary} />
              <Text style={styles.noteText}>
                If you have any questions about this transaction, please contact our support team.
              </Text>
            </View>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Button
            title="Download Receipt"
            style={styles.receiptButton}
            onPress={handleDownloadReceipt}
            hapticType="medium"
            icon={Download}
          />
          <Button
            title="Report an Issue"
            variant="outline"
            style={styles.reportButton}
            onPress={handleReportIssue}
            hapticType="warning"
          />
        </View>
      </View>
    </View>
  );
}

const createStyles = (colors: any, isDark: boolean, sizes: any) => StyleSheet.create({
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
    zIndex: 1000,
  },
  modal: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    width: '100%',
    maxWidth: 480,
    maxHeight: '90%',
    overflow: 'hidden',
    ...(isDark ? {
      borderWidth: 1,
      borderColor: colors.border,
    } : {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 5,
    }),
  },
  header: {
    backgroundColor: '#1E3A8A',
    padding: sizes.headerPadding,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: sizes.headerPadding,
  },
  title: {
    fontSize: sizes.titleSize,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  closeButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 18,
  },
  amountSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  amountIcon: {
    width: sizes.iconSize,
    height: sizes.iconSize,
    borderRadius: sizes.iconSize / 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  amount: {
    fontSize: sizes.amountSize,
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
    fontSize: sizes.labelSize,
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
    padding: sizes.contentPadding,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: sizes.sectionTitleSize,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  field: {
    marginBottom: 16,
  },
  label: {
    fontSize: sizes.labelSize,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  value: {
    fontSize: sizes.valueSize,
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
    marginTop: 4,
  },
  copyButton: {
    padding: 8,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 8,
    marginLeft: 8,
  },
  noteContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: isDark ? 'rgba(59, 130, 246, 0.1)' : '#EFF6FF',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
    gap: 12,
  },
  noteText: {
    flex: 1,
    fontSize: sizes.labelSize,
    color: colors.textSecondary,
    lineHeight: sizes.labelSize * 1.5,
  },
  footer: {
    padding: sizes.contentPadding,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  receiptButton: {
    backgroundColor: '#1E3A8A',
    paddingVertical: sizes.buttonPadding,
  },
  reportButton: {
    borderColor: colors.border,
    paddingVertical: sizes.buttonPadding,
  },
});