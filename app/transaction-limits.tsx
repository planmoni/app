import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { ArrowLeft, Shield, ChevronRight, TriangleAlert as AlertTriangle } from 'lucide-react-native';
import { router } from 'expo-router';
import SafeFooter from '@/components/SafeFooter';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { useState, useEffect } from 'react';
import { formatCurrency } from '@/lib/formatters';

type KYCTier = 0 | 1 | 2 | 3;

interface TierLimitData {
  tier_number: number;
  tier_name: string;
  max_daily_deposit: number;
  max_weekly_deposit: number;
  max_monthly_deposit: number;
  max_single_deposit: number;
  max_account_balance: number;
}

export default function TransactionLimitsScreen() {
  const { colors } = useTheme();
  const { session } = useAuth();
  const [currentTier, setCurrentTier] = useState<KYCTier>(0);
  const [tierLimits, setTierLimits] = useState<Record<number, TierLimitData>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTierData();
  }, [session?.user?.id]);

  const fetchTierData = async () => {
    if (!session?.user?.id) {
      setLoading(false);
      return;
    }

    try {
      // Get current tier
      const { data: tier, error: tierError } = await supabase.rpc('calculate_user_kyc_tier', {
        p_user_id: session.user.id
      });

      if (tierError) throw tierError;
      setCurrentTier((tier || 0) as KYCTier);

      // Fetch limits for all tiers (1, 2, 3)
      const tierNumbers = [1, 2, 3];
      const limitsPromises = tierNumbers.map(async (tierNum) => {
        const { data, error } = await supabase.rpc('get_tier_deposit_limits', {
          p_tier_number: tierNum
        });
        if (error) throw error;
        return data && data[0] ? { tierNum, data: data[0] } : null;
      });

      const limitsResults = await Promise.all(limitsPromises);
      const limitsMap: Record<number, TierLimitData> = {};
      
      limitsResults.forEach((result) => {
        if (result) {
          limitsMap[result.tierNum] = result.data;
        }
      });

      setTierLimits(limitsMap);
    } catch (error) {
      console.error('Error fetching tier data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = () => {
    // Navigate to KYC upgrade flow
    router.push('/kyc-upgrade');
  };

  // Filter out current tier and lower tiers from available tiers
  const availableTiers = Object.entries(tierLimits)
    .filter(([tier]) => parseInt(tier) > currentTier)
    .sort(([a], [b]) => parseInt(a) - parseInt(b));

  const formatAmount = (amount: number): string => {
    return formatCurrency(amount);
  };

  const currentTierLimits = tierLimits[currentTier] || tierLimits[1]; // Fallback to tier 1 if current tier not found

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
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Loading limits...</Text>
          </View>
        ) : (
          <>
            <View style={styles.currentTierCard}>
              <View style={styles.tierBadge}>
                <Text style={styles.tierText}>
                  {currentTier === 0 ? 'Unverified' : `Tier ${currentTier}`}
                </Text>
              </View>
              <Text style={styles.tierTitle}>Current Limits</Text>
              {currentTierLimits ? (
                <View style={styles.limitsContainer}>
                  <View style={styles.limitItem}>
                    <Text style={styles.limitLabel}>Daily Deposit Limit</Text>
                    <Text style={styles.limitValue}>
                      {formatAmount(currentTierLimits.max_daily_deposit / 100)}
                    </Text>
                  </View>
                  <View style={styles.limitItem}>
                    <Text style={styles.limitLabel}>Weekly Deposit Limit</Text>
                    <Text style={styles.limitValue}>
                      {formatAmount(currentTierLimits.max_weekly_deposit / 100)}
                    </Text>
                  </View>
                  <View style={styles.limitItem}>
                    <Text style={styles.limitLabel}>Monthly Deposit Limit</Text>
                    <Text style={styles.limitValue}>
                      {formatAmount(currentTierLimits.max_monthly_deposit / 100)}
                    </Text>
                  </View>
                  <View style={styles.limitItem}>
                    <Text style={styles.limitLabel}>Single Transaction Limit</Text>
                    <Text style={styles.limitValue}>
                      {formatAmount(currentTierLimits.max_single_deposit / 100)}
                    </Text>
                  </View>
                  <View style={styles.limitItem}>
                    <Text style={styles.limitLabel}>Maximum Account Balance</Text>
                    <Text style={styles.limitValue}>
                      {formatAmount(currentTierLimits.max_account_balance / 100)}
                    </Text>
                  </View>
                </View>
              ) : (
                <Text style={styles.errorText}>Unable to load limits</Text>
              )}
            </View>

            {availableTiers.length > 0 && (
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
                        <ChevronRight size={16} color="#1E3A8A" />
                      </Pressable>
                    </View>

                    <View style={styles.tierLimits}>
                      <View style={styles.tierLimit}>
                        <Text style={styles.limitType}>Daily Deposit:</Text>
                        <Text style={styles.limitAmount}>
                          {formatAmount(limits.max_daily_deposit / 100)}
                        </Text>
                      </View>
                      <View style={styles.tierLimit}>
                        <Text style={styles.limitType}>Weekly Deposit:</Text>
                        <Text style={styles.limitAmount}>
                          {formatAmount(limits.max_weekly_deposit / 100)}
                        </Text>
                      </View>
                      <View style={styles.tierLimit}>
                        <Text style={styles.limitType}>Monthly Deposit:</Text>
                        <Text style={styles.limitAmount}>
                          {formatAmount(limits.max_monthly_deposit / 100)}
                        </Text>
                      </View>
                      <View style={styles.tierLimit}>
                        <Text style={styles.limitType}>Single Transaction:</Text>
                        <Text style={styles.limitAmount}>
                          {formatAmount(limits.max_single_deposit / 100)}
                        </Text>
                      </View>
                      <View style={styles.tierLimit}>
                        <Text style={styles.limitType}>Max Balance:</Text>
                        <Text style={styles.limitAmount}>
                          {formatAmount(limits.max_account_balance / 100)}
                        </Text>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </>
        )}

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
    borderLeftColor: '#1E3A8A',
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
    color: '#1E3A8A',
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
    color: '#1E3A8A',
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
    color: '#1E3A8A',
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
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 12,
  },
  errorText: {
    fontSize: 14,
    color: colors.error || '#EF4444',
    textAlign: 'center',
    marginTop: 16,
  },
});