import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
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
import * as Sharing from 'expo-sharing';
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

  useEffect(() => {
    if (session?.user?.id) {
      fetchReferralData();
    }
  }, [session?.user?.id]);

  const fetchReferralData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Fetch the user's referral code
      const response = await fetch('/referral-code', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch referral code: ${response.status} ${response.statusText}`);
      }

      // Check if the response is JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const textResponse = await response.text();
        throw new Error(`Expected JSON response but received: ${contentType}. Response: ${textResponse.substring(0, 200)}`);
      }

      const data = await response.json();
      setReferralCode(data.referralCode);
      setReferralLink(`https://planmoni.app/ref/${data.referralCode}`);

      // Fetch the count of users who used this referral code
      const { count: referredCount, error: countError } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('referral_code', data.referralCode);

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

  const handleCopyCode = async () => {
    try {
      await Clipboard.setStringAsync(referralCode);
      showToast('Referral code copied to clipboard', 'success');
    } catch (error) {
      showToast('Failed to copy to clipboard', 'error');
    }
  };

  const handleShare = async () => {
    const shareMessage = `Join me on Planmoni! Use my referral code ${referralCode} to get started. Download the app at https://planmoni.app`;
    
    if (Platform.OS === 'web') {
      // Web sharing
      if (navigator.share) {
        try {
          await navigator.share({
            title: 'Join me on Planmoni',
            text: shareMessage,
            url: referralLink,
          });
        } catch (error) {
          console.error('Error sharing:', error);
          // Fallback to copying to clipboard
          await Clipboard.setStringAsync(shareMessage);
          showToast('Share text copied to clipboard', 'success');
        }
      } else {
        // Fallback for browsers that don't support sharing
        await Clipboard.setStringAsync(shareMessage);
        showToast('Share text copied to clipboard', 'success');
      }
    } else {
      // Native sharing
      try {
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(referralLink, {
            dialogTitle: 'Share your referral code',
            mimeType: 'text/plain',
            UTI: 'public.plain-text',
          });
        } else {
          await Clipboard.setStringAsync(shareMessage);
          showToast('Share text copied to clipboard', 'success');
        }
      } catch (error) {
        console.error('Error sharing:', error);
        showToast('Failed to share referral code', 'error');
      }
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
});