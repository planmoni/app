import { View, Text, StyleSheet, Pressable, ScrollView, Share, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { useState, useEffect } from 'react';
import { ArrowLeft, Gift, Copy, Share2, Users, Info } from 'lucide-react-native';
import Button from '@/components/Button';
import SafeFooter from '@/components/SafeFooter';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import * as Clipboard from 'expo-clipboard';
import { Platform } from 'react-native';
import { useToast } from '@/contexts/ToastContext';

export default function ReferralScreen() {
  const { colors } = useTheme();
  const { session } = useAuth();
  const { showToast } = useToast();
  
  const [referralCode, setReferralCode] = useState('');
  const [referralLink, setReferralLink] = useState('');
  const [invitedCount, setInvitedCount] = useState(0);
  const [totalEarned, setTotalEarned] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [referredUsers, setReferredUsers] = useState<any[]>([]);
  const [rewardTransactions, setRewardTransactions] = useState<any[]>([]);
  const [loadingReferred, setLoadingReferred] = useState(false);
  const [loadingRewards, setLoadingRewards] = useState(false);

  useEffect(() => {
    if (session?.user?.id) {
      fetchReferralData();
      fetchReferredUsers();
      fetchRewardTransactions();
    }
  }, [session?.user?.id]);

  const fetchReferralData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // First check if user already has a referral code
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('referral_code')
        .eq('id', session?.user?.id)
        .single();

      if (profileError) throw profileError;
      
      let code = profileData?.referral_code;
      
      // If no referral code exists, generate one
      if (!code) {
        // Get user's first name for code generation
        const { data: userData, error: userError } = await supabase
          .from('profiles')
          .select('first_name')
          .eq('id', session?.user?.id)
          .single();
          
        if (userError) throw userError;
        
        // Generate a referral code
        const firstName = userData?.first_name || '';
        code = generateReferralCode(firstName, session?.user?.id || '');
        
        // Save the generated code
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ referral_code: code })
          .eq('id', session?.user?.id);
        
        if (updateError) throw updateError;
      }
      
      setReferralCode(code || '');
      setReferralLink(`https://planmoni.com/ref/${code}`);

      // Fetch the count of users who were referred by this user
      const { count: referredCount, error: countError } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('referred_by', session?.user?.id);

      if (countError) throw countError;
      setInvitedCount(referredCount || 0);

      // Fetch the total amount earned from referral bonuses
      const { data: transactions, error: transactionsError } = await supabase
        .from('transactions')
        .select('amount')
        .eq('user_id', session?.user?.id)
        .eq('type', 'referral_bonus')
        .eq('status', 'completed');

      if (transactionsError) throw transactionsError;

      const earned = transactions?.reduce((sum, tx) => sum + tx.amount, 0) || 0;
      setTotalEarned(earned);

    } catch (err) {
      console.error('Error fetching referral data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load referral data');
      showToast('Failed to load referral data', 'error');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Generate a unique referral code
  const generateReferralCode = (firstName: string, userId: string): string => {
    // Take first 3 characters of first name (or fewer if name is shorter)
    const namePrefix = firstName.substring(0, 3).toUpperCase();
    
    // Take last 6 characters of user ID
    const idSuffix = userId.substring(userId.length - 6).toUpperCase();
    
    // Combine to create a unique code
    return `${namePrefix}${idSuffix}`;
  };

  const handleCopyCode = async () => {
    try {
      await Clipboard.setStringAsync(referralCode);
      showToast('Referral code copied to clipboard', 'success');
    } catch (error) {
      showToast('Failed to copy to clipboard', 'error');
    }
  };

  const handleShare = async () => {
    const shareMessage = `Join me on Planmoni! Use my referral code ${referralCode} to get started. Download the app at https://planmoni.com`;
    
    try {
      await Share.share({
        message: shareMessage,
        url: referralLink,
      });
    } catch (error) {
      console.error('Error sharing:', error);
      showToast('Failed to share referral code', 'error');
    }
  };

  // Fetch referred users and their deposit/reward status
  const fetchReferredUsers = async () => {
    setLoadingReferred(true);
    try {
      // Get all referrals where current user is referrer
      const { data: referrals, error: refErr } = await supabase
        .from('referrals')
        .select('*, referred:profiles!referrals_referred_id_fkey(first_name, last_name, id)')
        .eq('referrer_id', session?.user?.id);
      if (refErr) throw refErr;
      // For each referred user, get their total deposits
      const usersWithDeposits = await Promise.all((referrals || []).map(async (ref: any) => {
        const { data: deposits, error: depErr } = await supabase
          .from('deposits')
          .select('amount')
          .eq('user_id', ref.referred_id)
          .eq('status', 'completed');
        const totalDeposits = (deposits || []).reduce((sum, d) => sum + Number(d.amount), 0);
        return {
          id: ref.referred_id,
          name: ref.referred?.first_name + ' ' + (ref.referred?.last_name || ''),
          totalDeposits,
          status: ref.status
        };
      }));
      setReferredUsers(usersWithDeposits);
    } catch (err) {
      setReferredUsers([]);
    } finally {
      setLoadingReferred(false);
    }
  };

  // Fetch reward transactions
  const fetchRewardTransactions = async () => {
    setLoadingRewards(true);
    try {
      const { data: rewards, error: rewardsErr } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', session?.user?.id)
        .eq('type', 'reward')
        .order('created_at', { ascending: false });
      if (rewardsErr) throw rewardsErr;
      setRewardTransactions(rewards || []);
    } catch (err) {
      setRewardTransactions([]);
    } finally {
      setLoadingRewards(false);
    }
  };

  const styles = createStyles(colors);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Referral Program</Text>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <View style={styles.heroSection}>
          <View style={styles.giftIcon}>
            <Gift size={32} color="#EC4899" />
          </View>
          <Text style={styles.heroTitle}>Invite Friends & Earn</Text>
          <Text style={styles.heroDescription}>
            Share Planmoni with friends and earn ₦1,000 when they make their first payout
          </Text>
        </View>

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading your referral data...</Text>
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <Button 
              title="Try Again" 
              onPress={fetchReferralData} 
              style={styles.retryButton}
            />
          </View>
        ) : (
          <>
            <View style={styles.referralCard}>
              <Text style={styles.cardLabel}>Your Referral Code</Text>
              <View style={styles.codeContainer}>
                <Text style={styles.referralCode}>{referralCode}</Text>
                <Pressable style={styles.copyButton} onPress={handleCopyCode}>
                  <Copy size={20} color="#1E3A8A" />
                </Pressable>
              </View>
            </View>

            <View style={styles.referralCard}>
              <Text style={styles.cardLabel}>Referral Link</Text>
              <View style={styles.linkContainer}>
                <Text style={styles.referralLink} numberOfLines={1}>
                  {referralLink}
                </Text>
                <Pressable style={styles.copyButton} onPress={handleCopyCode}>
                  <Copy size={20} color="#1E3A8A" />
                </Pressable>
              </View>
            </View>

            <View style={styles.statsSection}>
              <View style={styles.statCard}>
                <Users size={24} color="#1E3A8A" />
                <Text style={styles.statValue}>{invitedCount}</Text>
                <Text style={styles.statLabel}>Friends Invited</Text>
              </View>
              <View style={styles.statCard}>
                <Gift size={24} color="#EC4899" />
                <Text style={styles.statValue}>₦{totalEarned.toLocaleString()}</Text>
                <Text style={styles.statLabel}>Total Earned</Text>
              </View>
            </View>

            {/* New: Referred Users List */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Your Referrals</Text>
              {loadingReferred ? (
                <ActivityIndicator size="small" />
              ) : referredUsers.length === 0 ? (
                <Text style={styles.emptyText}>No referrals yet.</Text>
              ) : (
                referredUsers.map(user => (
                  <View key={user.id} style={styles.referredCard}>
                    <Text style={styles.referredName}>{user.name}</Text>
                    <Text style={styles.referredDeposits}>Deposits: ₦{user.totalDeposits.toLocaleString()}</Text>
                    <Text style={styles.referredStatus}>Status: {user.status === 'rewarded' ? 'Rewarded' : user.status === 'qualified' ? 'Qualified' : 'Pending'}</Text>
                  </View>
                ))
              )}
            </View>

            {/* New: Reward Transactions List */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Reward History</Text>
              {loadingRewards ? (
                <ActivityIndicator size="small" />
              ) : rewardTransactions.length === 0 ? (
                <Text style={styles.emptyText}>No rewards yet.</Text>
              ) : (
                rewardTransactions.map(tx => (
                  <View key={tx.id} style={styles.rewardCard}>
                    <Text style={styles.rewardAmount}>+₦{tx.amount.toLocaleString()}</Text>
                    <Text style={styles.rewardDate}>{new Date(tx.created_at).toLocaleDateString()}</Text>
                  </View>
                ))
              )}
            </View>
          </>
        )}

        <View style={styles.howItWorks}>
          <Text style={styles.sectionTitle}>How it Works</Text>
          <View style={styles.steps}>
            <View style={styles.step}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>1</Text>
              </View>
              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>Share Your Code</Text>
                <Text style={styles.stepDescription}>
                  Share your unique referral code with friends and family
                </Text>
              </View>
            </View>
            <View style={styles.step}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>2</Text>
              </View>
              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>Friend Signs Up</Text>
                <Text style={styles.stepDescription}>
                  They create an account using your referral code
                </Text>
              </View>
            </View>
            <View style={styles.step}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>3</Text>
              </View>
              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>Both Get Rewarded</Text>
                <Text style={styles.stepDescription}>
                  You both receive ₦1,000 when they make their first payout
                </Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.infoSection}>
          <View style={styles.infoCard}>
            <View style={styles.infoHeader}>
              <View style={styles.infoIconContainer}>
                <Info size={20} color="#1E3A8A" />
              </View>
              <Text style={styles.infoTitle}>Terms & Conditions</Text>
            </View>
            <Text style={styles.infoText}>
              Referral rewards are credited within 24 hours after your friend completes their first payout. Maximum of 10 referrals per month.
            </Text>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Button
          title="Share Referral Link"
          onPress={handleShare}
          style={styles.shareButton}
          icon={Share2}
        />
      </View>
      
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
  heroSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  giftIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FDF2F8',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  heroDescription: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  errorContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    fontSize: 16,
    color: colors.error,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    minWidth: 120,
    backgroundColor: colors.primary,
  },
  referralCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  codeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.backgroundTertiary,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  referralCode: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
    letterSpacing: 1,
  },
  linkContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.backgroundTertiary,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  referralLink: {
    flex: 1,
    fontSize: 14,
    color: '#1E3A8A',
    marginRight: 12,
  },
  copyButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statsSection: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 32,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '600',
    color: colors.text,
    marginVertical: 8,
  },
  statLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  howItWorks: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 16,
  },
  steps: {
    gap: 16,
  },
  step: {
    flexDirection: 'row',
    gap: 16,
  },
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1E3A8A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepNumberText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
    marginBottom: 4,
  },
  stepDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  infoSection: {
    marginBottom: 32,
  },
  infoCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 4,
    borderLeftColor: '#1E3A8A',
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
    backgroundColor: '#EFF6FF',
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
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  shareButton: {
    backgroundColor: '#1E3A8A',
  },
  section: {
    marginBottom: 24,
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: 14,
    marginBottom: 8,
  },
  referredCard: {
    backgroundColor: colors.backgroundTertiary,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  referredName: {
    fontWeight: '600',
    color: colors.text,
    fontSize: 15,
  },
  referredDeposits: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  referredStatus: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '500',
  },
  rewardCard: {
    backgroundColor: colors.backgroundTertiary,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rewardAmount: {
    color: colors.success,
    fontWeight: '600',
    fontSize: 15,
  },
  rewardDate: {
    color: colors.textSecondary,
    fontSize: 13,
  },
});