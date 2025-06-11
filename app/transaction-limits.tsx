import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { ArrowLeft, Shield, ChevronRight, TriangleAlert as AlertTriangle } from 'lucide-react-native';
import { router } from 'expo-router';
import SafeFooter from '@/components/SafeFooter';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';

type KYCTier = 1 | 2 | 3;

interface TierLimit {
  deposit: string;
  singlePayout: string;
  dailyPayout: string;
}

const TIER_LIMITS: Record<KYCTier, TierLimit> = {
  1: {
    deposit: '500,000',
    singlePayout: '100,000',
    dailyPayout: '200,000',
  },
  2: {
    deposit: '2,000,000',
    singlePayout: '1,000,000',
    dailyPayout: '5,000,000',
  },
  3: {
    deposit: 'Unlimited',
    singlePayout: '10,000,000',
    dailyPayout: '50,000,000',
  },
};

export default function TransactionLimitsScreen() {
  const { colors } = useTheme();
  // Current tier is 1
  const currentTier: KYCTier = 1;

  const handleUpgrade = () => {
    // Navigate to KYC upgrade flow
    router.push('/kyc-upgrade');
  };

  // Filter out current tier from available tiers
  const availableTiers = Object.entries(TIER_LIMITS).filter(
    ([tier]) => parseInt(tier) > currentTier
  );

  const styles = createStyles(colors);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Transaction Limits</Text>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <View style={styles.currentTierCard}>
          <View style={styles.tierBadge}>
            <Shield size={20} color="#3B82F6" />
            <Text style={styles.tierText}>Tier {currentTier}</Text>
          </View>
          <Text style={styles.tierTitle}>Current Limits</Text>
          <View style={styles.limitsContainer}>
            <View style={styles.limitItem}>
              <Text style={styles.limitLabel}>Deposit Limit</Text>
              <Text style={styles.limitValue}>₦{TIER_LIMITS[currentTier].deposit}</Text>
            </View>
            <View style={styles.limitItem}>
              <Text style={styles.limitLabel}>Single Payout Limit</Text>
              <Text style={styles.limitValue}>₦{TIER_LIMITS[currentTier].singlePayout}</Text>
            </View>
            <View style={styles.limitItem}>
              <Text style={styles.limitLabel}>Daily Payout Limit</Text>
              <Text style={styles.limitValue}>₦{TIER_LIMITS[currentTier].dailyPayout}</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Available Upgrades</Text>
          
          {availableTiers.map(([tier, limits]) => (
            <View 
              key={tier} 
              style={styles.tierCard}
            >
              <View style={styles.tierHeader}>
                <View style={styles.tierInfo}>
                  <Text style={styles.tierName}>Tier {tier}</Text>
                  <View style={styles.upgradeTag}>
                    <Text style={styles.upgradeTagText}>Available</Text>
                  </View>
                </View>
                <Pressable 
                  style={styles.upgradeButton}
                  onPress={handleUpgrade}
                >
                  <Text style={styles.upgradeButtonText}>Upgrade</Text>
                  <ChevronRight size={16} color="#3B82F6" />
                </Pressable>
              </View>

              <View style={styles.tierLimits}>
                <View style={styles.tierLimit}>
                  <Text style={styles.limitType}>Deposit Limit:</Text>
                  <Text style={styles.limitAmount}>₦{limits.deposit}</Text>
                </View>
                <View style={styles.tierLimit}>
                  <Text style={styles.limitType}>Single Payout:</Text>
                  <Text style={styles.limitAmount}>₦{limits.singlePayout}</Text>
                </View>
                <View style={styles.tierLimit}>
                  <Text style={styles.limitType}>Daily Payout:</Text>
                  <Text style={styles.limitAmount}>₦{limits.dailyPayout}</Text>
                </View>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.infoSection}>
          <View style={styles.infoCard}>
            <View style={styles.infoHeader}>
              <View style={styles.infoIconContainer}>
                <AlertTriangle size={20} color="#F59E0B" />
              </View>
              <Text style={styles.infoTitle}>How to Upgrade?</Text>
            </View>
            <Text style={styles.infoText}>
              To increase your transaction limits, complete the KYC verification process for the desired tier. Higher tiers require additional documentation for verification.
            </Text>
          </View>
        </View>
      </ScrollView>
      
      <SafeFooter />
    </SafeAreaView>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundSecondary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 24,
    paddingBottom: 32,
  },
  currentTierCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 24,
    marginBottom: 32,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 4,
    borderLeftColor: '#3B82F6',
  },
  tierBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    alignSelf: 'flex-start',
    marginBottom: 16,
  },
  tierText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3B82F6',
  },
  tierTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 16,
  },
  limitsContainer: {
    gap: 12,
  },
  limitItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  limitLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  limitValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 16,
  },
  tierCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
  },
  tierHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  tierInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tierName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  upgradeTag: {
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  upgradeTagText: {
    fontSize: 12,
    color: '#3B82F6',
    fontWeight: '500',
  },
  upgradeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
  },
  upgradeButtonText: {
    fontSize: 14,
    color: '#3B82F6',
    fontWeight: '500',
  },
  tierLimits: {
    gap: 8,
  },
  tierLimit: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  limitType: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  limitAmount: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
  },
  infoSection: {
    marginBottom: 24,
  },
  infoCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
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
    backgroundColor: '#FEF3C7',
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
});