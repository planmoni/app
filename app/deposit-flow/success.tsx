import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Button from '@/components/Button';
import SuccessAnimation from '@/components/SuccessAnimation';
import { Download, Info } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';

export default function SuccessScreen() {
  const { colors } = useTheme();
  const params = useLocalSearchParams();
  const amount = params.amount as string;
  const methodTitle = params.methodTitle as string;
  
  const handleBackToDashboard = () => {
    router.replace('/(tabs)');
  };

  const handleViewReceipt = () => {
    // Handle receipt download/view
  };

  const styles = createStyles(colors);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <SuccessAnimation />

        <Text style={styles.title}>Funds Added Successfully!</Text>
        <Text style={styles.subtitle}>Your wallet has been credited with the specified amount</Text>

        <View style={styles.summaryCard}>
          <Text style={styles.amount}>₦{amount}</Text>
          <Text style={styles.description}>
            has been added to your{'\n'}
            <Text style={styles.highlight}>Planmoni Wallet</Text>
          </Text>

          <View style={styles.detailsContainer}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Transaction ID</Text>
              <Text style={styles.detailValue}>TXN123456789</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Payment Method</Text>
              <Text style={styles.detailValue}>{methodTitle}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Date & Time</Text>
              <Text style={styles.detailValue}>{new Date().toLocaleString()}</Text>
            </View>
          </View>
        </View>

        <View style={styles.infoCard}>
          <View style={styles.infoHeader}>
            <View style={styles.infoIconContainer}>
              <Info size={20} color={colors.primary} />
            </View>
            <Text style={styles.infoTitle}>Wallet Updated</Text>
          </View>
          <Text style={styles.infoText}>
            Your wallet balance has been updated and ready to use
          </Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Button 
          title="Back to Dashboard"
          onPress={handleBackToDashboard}
          style={styles.dashboardButton}
        />
        <Button 
          title="View Transaction Receipt"
          onPress={handleViewReceipt}
          variant="outline"
          style={styles.receiptButton}
          icon={Download}
        />
      </View>
    </SafeAreaView>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundSecondary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    marginBottom: 32,
    textAlign: 'center',
  },
  summaryCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 24,
    width: '100%',
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 4,
    borderLeftColor: '#22C55E',
  },
  amount: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },
  description: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  highlight: {
    color: '#22C55E',
    fontWeight: '600',
  },
  detailsContainer: {
    width: '100%',
    gap: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
  },
  infoCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 20,
    width: '100%',
    marginBottom: 20,
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
    padding: 24,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  dashboardButton: {
    backgroundColor: colors.primary,
  },
  receiptButton: {
    borderColor: colors.border,
  },
});