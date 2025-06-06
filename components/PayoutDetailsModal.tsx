import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { X, Calendar, Building2, Clock, Wallet, ChevronRight, TriangleAlert as AlertTriangle, Pause, Play } from 'lucide-react-native';
import Button from '@/components/Button';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';

type PayoutDetailsModalProps = {
  isVisible: boolean;
  onClose: () => void;
  isPaused?: boolean;
  onPauseToggle?: () => void;
};

export default function PayoutDetailsModal({ 
  isVisible, 
  onClose,
  isPaused = false,
  onPauseToggle
}: PayoutDetailsModalProps) {
  const { colors } = useTheme();
  
  if (!isVisible) return null;

  const handlePausePress = () => {
    if (!isPaused) {
      router.push('/pause-confirmation');
    } else if (onPauseToggle) {
      onPauseToggle();
    }
  };

  const styles = createStyles(colors);

  return (
    <View style={styles.overlay}>
      <View style={styles.modal}>
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <Text style={styles.title}>Payout Details</Text>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <X size={24} color="#FFFFFF" />
            </Pressable>
          </View>
          <View style={styles.statusSection}>
            <View style={[styles.statusTag, isPaused && styles.pausedTag]}>
              <Text style={[styles.statusText, isPaused && styles.pausedText]}>
                {isPaused ? 'Paused' : 'Active'}
              </Text>
            </View>
            <Text style={styles.amount}>₦500,000.00</Text>
            <Text style={styles.nextPayout}>Next payout in 5 days</Text>
          </View>
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: '30%' }]} />
            </View>
            <View style={styles.progressStats}>
              <Text style={styles.progressText}>₦1,500,000 of ₦5,000,000</Text>
              <Text style={styles.progressCount}>3/10 payouts</Text>
            </View>
          </View>
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Schedule Information</Text>
            <View style={styles.scheduleCard}>
              <View style={styles.scheduleGroup}>
                <View style={[styles.scheduleIcon, { backgroundColor: '#EFF6FF' }]}>
                  <Calendar size={24} color="#3B82F6" />
                </View>
                <View style={styles.scheduleInfo}>
                  <Text style={styles.scheduleLabel}>Next Payout Date</Text>
                  <Text style={styles.scheduleValue}>December 15, 2024</Text>
                </View>
              </View>

              <View style={styles.divider} />

              <View style={styles.scheduleGroup}>
                <View style={[styles.scheduleIcon, { backgroundColor: '#F5F3FF' }]}>
                  <Clock size={24} color="#8B5CF6" />
                </View>
                <View style={styles.scheduleInfo}>
                  <Text style={styles.scheduleLabel}>Frequency</Text>
                  <Text style={styles.scheduleValue}>Monthly</Text>
                </View>
              </View>

              <View style={styles.divider} />

              <View style={styles.scheduleGroup}>
                <View style={[styles.scheduleIcon, { backgroundColor: '#DCFCE7' }]}>
                  <Wallet size={24} color="#22C55E" />
                </View>
                <View style={styles.scheduleInfo}>
                  <Text style={styles.scheduleLabel}>Amount per payout</Text>
                  <Text style={styles.scheduleValue}>₦500,000.00</Text>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Destination Account</Text>
            <View style={styles.destinationCard}>
              <View style={styles.bankInfo}>
                <View style={styles.bankIcon}>
                  <Building2 size={28} color="#3B82F6" />
                </View>
                <View style={styles.bankDetails}>
                  <Text style={styles.bankName}>GTBank •••• 6721</Text>
                  <Text style={styles.accountName}>John Doe</Text>
                </View>
              </View>
              <Pressable style={styles.changeButton}>
                <Text style={styles.changeButtonText}>Change</Text>
                <ChevronRight size={16} color="#3B82F6" />
              </Pressable>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Emergency Access</Text>
            <View style={styles.emergencyCard}>
              <View style={styles.warningHeader}>
                <AlertTriangle size={24} color="#F97316" />
                <Text style={styles.warningTitle}>Emergency Withdrawal Available</Text>
              </View>
              <Text style={styles.warningDescription}>
                You can withdraw your funds before the scheduled date, but this will attract a fee and a 72-hour processing time.
              </Text>
              <Button
                title="Request Emergency Withdrawal"
                variant="outline"
                style={styles.withdrawButton}
              />
            </View>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Button 
            title={isPaused ? "Start Payouts" : "Pause Payouts"}
            onPress={handlePausePress}
            style={[styles.actionButton, isPaused ? styles.startButton : styles.pauseButton]}
            icon={isPaused ? Play : Pause}
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
    borderRadius: 24,
    width: '100%',
    maxWidth: 480,
    maxHeight: '90%',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  header: {
    backgroundColor: '#1E3A8A',
    padding: 32,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 28,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  closeButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 22,
  },
  statusSection: {
    marginBottom: 28,
  },
  statusTag: {
    alignSelf: 'flex-start',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 24,
    marginBottom: 16,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#22C55E',
  },
  pausedTag: {
    backgroundColor: '#FEE2E2',
  },
  pausedText: {
    color: '#EF4444',
  },
  amount: {
    fontSize: 36,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  nextPayout: {
    fontSize: 16,
    color: '#93C5FD',
  },
  progressContainer: {
    marginTop: 20,
  },
  progressBar: {
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 3,
    marginBottom: 16,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 3,
  },
  progressStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  progressText: {
    fontSize: 14,
    color: '#93C5FD',
  },
  progressCount: {
    fontSize: 14,
    color: '#93C5FD',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 32,
  },
  section: {
    marginBottom: 40,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 20,
  },
  scheduleCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  scheduleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    paddingVertical: 16,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 8,
  },
  scheduleIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scheduleInfo: {
    flex: 1,
  },
  scheduleLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  scheduleValue: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  destinationCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  bankInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  bankIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bankDetails: {
    gap: 6,
  },
  bankName: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  accountName: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  changeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: colors.backgroundTertiary,
    borderRadius: 8,
  },
  changeButtonText: {
    fontSize: 14,
    color: '#3B82F6',
    fontWeight: '600',
  },
  emergencyCard: {
    backgroundColor: '#FFF7ED',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  warningHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 16,
  },
  warningTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#F97316',
  },
  warningDescription: {
    fontSize: 15,
    color: colors.textSecondary,
    lineHeight: 24,
    marginBottom: 20,
  },
  withdrawButton: {
    borderColor: '#F97316',
    borderWidth: 2,
  },
  footer: {
    padding: 32,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 56,
    borderRadius: 16,
  },
  pauseButton: {
    backgroundColor: '#EF4444',
  },
  startButton: {
    backgroundColor: '#22C55E',
  },
});