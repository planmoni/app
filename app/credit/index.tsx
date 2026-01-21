import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ArrowLeft, Info, Clock, ShieldCheck } from 'lucide-react-native';
import Button from '@/components/Button';
import { useTheme } from '@/contexts/ThemeContext';
import { useCreditAssessment } from '@/hooks/useCreditAssessment';
import { useCreditRepayments } from '@/hooks/useCreditRepayments';
import CreditLimitCard from '@/components/CreditLimitCard';
import RepaymentScheduleCard from '@/components/RepaymentScheduleCard';
import CreditMandateBanner from '@/components/CreditMandateBanner';

export default function CreditHomeScreen() {
  const { colors } = useTheme();
  const { assessment, isLoading: isLoadingAssessment } = useCreditAssessment();
  const { nextRepayment, schedule, isLoading: isLoadingRepayments } = useCreditRepayments();

  const styles = createStyles(colors);

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={handleBack} style={styles.headerButton}>
          <ArrowLeft size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Credit</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <CreditMandateBanner />

        <CreditLimitCard
          isLoading={isLoadingAssessment}
          limit={assessment?.creditLimit || 0}
          outstanding={assessment?.outstanding || 0}
          recommended={assessment?.recommended || 0}
          mandateStatus={assessment?.mandateStatus || 'pending'}
          readyToDebitAt={assessment?.readyToDebitAt || null}
          gsmEnabled={assessment?.gsmEnabled || false}
          onApplyPress={() => router.push('/credit/apply')}
          onManageMandatePress={() => router.push('/linked-accounts')}
        />

        <RepaymentScheduleCard
          isLoading={isLoadingRepayments}
          nextRepayment={nextRepayment}
          schedule={schedule}
          onViewAll={() => router.push('/credit/repayment-schedule')}
        />

        <View style={styles.actions}>
          <Button
            title="Apply for Credit"
            onPress={() => router.push('/credit/apply')}
            size="large"
          />
          <Button
            title="View Terms"
            type="secondary"
            onPress={() => router.push('/credit/terms')}
            size="large"
          />
        </View>

        <View style={styles.infoCard}>
          <View style={styles.infoHeader}>
            <Info size={18} color={colors.text} />
            <Text style={styles.infoTitle}>How this works</Text>
          </View>
          <View style={styles.infoRow}>
            <ShieldCheck size={16} color={colors.textSecondary} />
            <Text style={styles.infoText}>
              Repayment is automatic via mandate (BVN-based, can debit any linked account).
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Clock size={16} color={colors.textSecondary} />
            <Text style={styles.infoText}>
              “Ready-to-debit” may take ~24h after mandate approval (per Mono).
            </Text>
          </View>
          <Text style={styles.infoText}>
            Payout scheduling controls how you access borrowed funds; it does not change repayment dates.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.backgroundSecondary,
    },
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
    headerButton: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
    },
    headerSpacer: {
      width: 40,
      height: 40,
    },
    content: {
      padding: 16,
      gap: 16,
      paddingBottom: 32,
    },
    actions: {
      gap: 12,
      marginTop: 4,
    },
    infoCard: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 10,
    },
    infoHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    infoTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
    },
    infoRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
    },
    infoText: {
      flex: 1,
      fontSize: 13,
      color: colors.textSecondary,
      lineHeight: 18,
    },
  });
