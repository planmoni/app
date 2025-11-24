import Button from '@/components/Button';
import InitialsAvatar from '@/components/InitialsAvatar';
import SafeFooter from '@/components/SafeFooter';
import { useAuth } from '@/contexts/AuthContext';
import { useKYCProgress, KYCProgress } from '@/hooks/useKYCProgress';
import { useKYCData } from '@/hooks/useKYCData';
import UtilityBillUploadModal from '@/components/UtilityBillUploadModal';
import { router } from 'expo-router';
import { ArrowLeft, Mail, User, Shield, CircleCheck as CheckCircle, CircleAlert as AlertCircle, Clock, ChevronRight, LocationEdit as Edit3, Upload } from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useState, useEffect } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/lib/formatters';

type KYCLevel = 'unverified' | 'tier1' | 'tier2' | 'tier3';

export default function ProfileScreen() {
  const { session, signOut } = useAuth();
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const { progress, loading: kycLoading } = useKYCProgress();
  const { formData: kycData, loading: kycDataLoading } = useKYCData();
  
  // Utility bill upload modal
  const [showUtilityBillModal, setShowUtilityBillModal] = useState(false);
  const [tierLimits, setTierLimits] = useState<{
    max_daily_deposit: number;
    max_weekly_deposit: number;
    max_monthly_deposit: number;
    max_single_deposit: number;
    max_account_balance: number;
  } | null>(null);
  
  const firstName = session?.user?.user_metadata?.first_name || '';
  const lastName = session?.user?.user_metadata?.last_name || '';
  const email = session?.user?.email || '';

  // Fetch tier limits
  useEffect(() => {
    const fetchTierLimits = async () => {
      if (!session?.user?.id) return;

      try {
        const { data, error } = await supabase.rpc('get_user_deposit_limits', {
          p_user_id: session.user.id
        });

        if (error) throw error;
        if (data && data[0]) {
          setTierLimits(data[0]);
        }
      } catch (error) {
        console.error('Error fetching tier limits:', error);
      }
    };

    fetchTierLimits();
  }, [session?.user?.id, progress]);

  // Determine KYC level based on actual progress data
  const getKYCLevel = (): KYCLevel => {
    if (!progress) return 'unverified';
    
    // Tier 3: overall_completed + utility_bill_url present + approved
    if (progress.overall_completed && kycData?.utility_bill_url && kycData?.approved) {
      return 'tier3';
    }
    
    // Tier 2: BVN + documents + address completed
    if (progress.bvn_verified && progress.documents_verified && progress.address_completed) {
      return 'tier2';
    }
    
    // Tier 1: BVN verification only
    if (progress.bvn_verified) {
      return 'tier1';
    }
    
    return 'unverified';
  };

  const kycLevel = getKYCLevel();
  const kycStatus = getKYCStatus(kycLevel, progress, tierLimits);

  // Calculate responsive sizes based on screen width
  const avatarSize = Math.max(80, Math.min(width * 0.25, 140));
  const avatarFontSize = Math.max(24, Math.min(width * 0.08, 48));
  const titleFontSize = Math.max(20, Math.min(width * 0.06, 28));
  const emailFontSize = Math.max(14, Math.min(width * 0.04, 18));

  const handleSignOut = async () => {
    await signOut();
    router.replace('/');
  };

  const handleEditProfile = () => {
    router.push('/edit-profile');
  };

  const handleUpgradeKYC = () => {
    // If user is Tier 2 and needs to upload utility bill, show the modal
    if (kycLevel === 'tier2' && (!kycData?.utility_bill_url || !kycData?.approved)) {
      setShowUtilityBillModal(true);
    } else {
      // For other tiers, go to the full KYC upgrade flow
      router.push('/kyc-upgrade');
    }
  };

  const styles = createStyles(colors, width);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Profile</Text>
        
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <View style={styles.profileHeader}>
          <InitialsAvatar 
            firstName={firstName} 
            lastName={lastName} 
            size={avatarSize}
            fontSize={avatarFontSize}
          />
          <Text style={[styles.userName, { fontSize: titleFontSize }]}>{firstName} {lastName}</Text>
          <Text style={[styles.userEmail, { fontSize: emailFontSize }]}>{email}</Text>
          <View style={styles.verifiedBadge}>
            <Text style={styles.verifiedText}>Verified</Text>
          </View>
        </View>

        <View style={styles.kycSection}>
          <View style={styles.kycCard}>
            {kycLoading || kycDataLoading ? (
              <View style={styles.loadingContainer}>
                <Text style={styles.loadingText}>Loading verification status...</Text>
              </View>
            ) : (
              <>
                <View style={styles.kycHeader}>
                  <View style={styles.kycTitleContainer}>
                    <Text style={styles.kycTitle}>Verification Status</Text>
                  </View>
                </View>
                
                <Text style={styles.kycDescription}>{kycStatus.description}</Text>
                
                <View style={styles.kycLimits}>
                  <Text style={styles.kycLimitsTitle}>Current Limits</Text>
                  {tierLimits ? (
                    <>
                      <View style={styles.limitRow}>
                        <Text style={styles.limitLabel}>Daily Deposit</Text>
                        <Text style={styles.limitValue}>
                          {formatCurrency(tierLimits.max_daily_deposit / 100)}
                        </Text>
                      </View>
                      <View style={styles.limitRow}>
                        <Text style={styles.limitLabel}>Weekly Deposit</Text>
                        <Text style={styles.limitValue}>
                          {formatCurrency(tierLimits.max_weekly_deposit / 100)}
                        </Text>
                      </View>
                      <View style={styles.limitRow}>
                        <Text style={styles.limitLabel}>Monthly Deposit</Text>
                        <Text style={styles.limitValue}>
                          {formatCurrency(tierLimits.max_monthly_deposit / 100)}
                        </Text>
                      </View>
                      <View style={styles.limitRow}>
                        <Text style={styles.limitLabel}>Single Transaction</Text>
                        <Text style={styles.limitValue}>
                          {formatCurrency(tierLimits.max_single_deposit / 100)}
                        </Text>
                      </View>
                      <View style={styles.limitRow}>
                        <Text style={styles.limitLabel}>Maximum Balance</Text>
                        <Text style={styles.limitValue}>
                          {formatCurrency(tierLimits.max_account_balance / 100)}
                        </Text>
                      </View>
                    </>
                  ) : (
                    <View style={styles.limitRow}>
                      <Text style={styles.limitLabel}>Daily Transaction</Text>
                      <Text style={styles.limitValue}>{kycStatus.limits.daily}</Text>
                    </View>
                  )}
                </View>

                {/* Show upgrade message for different scenarios */}
                {progress && (
                  <>
                    {/* Tier 1: Show message to complete documents and address */}
                    {kycLevel === 'tier1' && (
                      <View style={styles.upgradeMessage}>
                        <Upload size={16} color="#F59E0B" />
                        <Text style={styles.upgradeMessageText}>
                          Complete document verification and address details to unlock higher limits
                        </Text>
                      </View>
                    )}
                    
                    {/* Tier 2: Show message to upload utility bill or wait for approval */}
                    {kycLevel === 'tier2' && (
                      <>
                        {!kycData?.utility_bill_url && (
                          <View style={styles.upgradeMessage}>
                            <Upload size={16} color="#F59E0B" />
                            <Text style={styles.upgradeMessageText}>
                              Click "Upload Utility Bill" to unlock maximum transaction limits
                            </Text>
                          </View>
                        )}
                        {kycData?.utility_bill_url && !kycData?.approved && (
                          <View style={styles.upgradeMessage}>
                            <Clock size={16} color="#1E3A8A" />
                            <Text style={styles.upgradeMessageText}>
                              Utility bill uploaded. Waiting for admin approval to unlock maximum limits.
                            </Text>
                          </View>
                        )}
                      </>
                    )}
                  </>
                )}

                {/* Show upgrade button if not at tier 3 */}
                {progress && kycLevel !== 'tier3' && (
                  <Pressable style={styles.upgradeButton} onPress={handleUpgradeKYC}>
                    <Text style={styles.upgradeButtonText}>
                      {kycLevel === 'tier2' && (!kycData?.utility_bill_url || !kycData?.approved) 
                        ? 'Upload Utility Bill' 
                        : 'Upgrade Verification'
                      }
                    </Text>
                    <ChevronRight size={20} color={colors.primary} />
                  </Pressable>
                )}
              </>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account Information</Text>
          
          <View style={styles.infoCard}>
            <View style={styles.field}>
              <View style={styles.fieldIcon}>
                <User size={20} color={colors.textSecondary} />
              </View>
              <View style={styles.fieldContent}>
                <Text style={styles.fieldLabel}>Full Name</Text>
                <Text style={styles.fieldValue}>
                  {firstName} {lastName}
                </Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.field}>
              <View style={styles.fieldIcon}>
                <Mail size={20} color={colors.textSecondary} />
              </View>
              <View style={styles.fieldContent}>
                <Text style={styles.fieldLabel}>Email Address</Text>
                <Text style={styles.fieldValue}>{email}</Text>
              </View>
              <View style={styles.verifiedBadge}>
                <CheckCircle size={16} color="#22C55E" />
                <Text style={styles.verifiedText}>Verified</Text>
              </View>
            </View>
          </View>
        </View>

        
      </ScrollView>

      <View style={styles.footer}>
        <Button
          title="Sign Out"
          onPress={handleSignOut}
          style={styles.signOutButton}
          variant="outline"
        />
      </View>
      
      <SafeFooter />
      
      {/* Utility Bill Upload Modal */}
      <UtilityBillUploadModal
        visible={showUtilityBillModal}
        onClose={() => setShowUtilityBillModal(false)}
        onSuccess={() => {
          setShowUtilityBillModal(false);
          // Refresh KYC data to show updated status
          // The modal will handle the data refresh internally
        }}
      />
    </SafeAreaView>
  );
}

function getKYCStatus(
  level: KYCLevel, 
  progress?: KYCProgress,
  tierLimits?: {
    max_daily_deposit: number;
    max_weekly_deposit: number;
    max_monthly_deposit: number;
    max_single_deposit: number;
    max_account_balance: number;
  } | null
) {
  // Use tier limits from database if available, otherwise use fallback values
  const getLimit = (amount: number) => {
    return tierLimits ? formatCurrency(amount / 100) : 'Loading...';
  };

  switch (level) {
    case 'unverified':
      return {
        label: 'Unverified',
        description: 'Complete your BVN verification to unlock basic transaction limits and get a virtual account.',
        color: '#C8A2FF',
        backgroundColor: '#2D005B',
        icon: AlertCircle,
        limits: {
          daily: tierLimits ? getLimit(tierLimits.max_daily_deposit) : '₦100,000',
          weekly: tierLimits ? getLimit(tierLimits.max_weekly_deposit) : '₦500,000',
          monthly: tierLimits ? getLimit(tierLimits.max_monthly_deposit) : '₦2,000,000',
          single: tierLimits ? getLimit(tierLimits.max_single_deposit) : '₦50,000',
          maxBalance: tierLimits ? getLimit(tierLimits.max_account_balance) : '₦5,000,000'
        }
      };
    case 'tier1':
      return {
        label: 'Tier 1 Verified',
        description: 'Liveness test, BVN verification, and NIN verification completed. Complete document verification and address details to unlock higher limits.',
        color: '#F59E0B',
        backgroundColor: '#FEF3C7',
        icon: Clock,
        limits: {
          daily: tierLimits ? getLimit(tierLimits.max_daily_deposit) : '₦100,000',
          weekly: tierLimits ? getLimit(tierLimits.max_weekly_deposit) : '₦500,000',
          monthly: tierLimits ? getLimit(tierLimits.max_monthly_deposit) : '₦2,000,000',
          single: tierLimits ? getLimit(tierLimits.max_single_deposit) : '₦50,000',
          maxBalance: tierLimits ? getLimit(tierLimits.max_account_balance) : '₦5,000,000'
        }
      };
    case 'tier2':
      return {
        label: 'Tier 2 Verified',
        description: 'Complete personal information and document verification completed. Upload utility bill to unlock maximum transaction limits and complete final verification.',
        color: '#1E3A8A',
        backgroundColor: '#EFF6FF',
        icon: Shield,
        limits: {
          daily: tierLimits ? getLimit(tierLimits.max_daily_deposit) : '₦500,000',
          weekly: tierLimits ? getLimit(tierLimits.max_weekly_deposit) : '₦2,000,000',
          monthly: tierLimits ? getLimit(tierLimits.max_monthly_deposit) : '₦10,000,000',
          single: tierLimits ? getLimit(tierLimits.max_single_deposit) : '₦200,000',
          maxBalance: tierLimits ? getLimit(tierLimits.max_account_balance) : '₦50,000,000'
        }
      };
    case 'tier3':
      return {
        label: 'Tier 3 Verified',
        description: 'Address details and utility bill verification completed. Maximum verification level achieved. You have access to all features, highest limits, and virtual account.',
        color: '#22C55E',
        backgroundColor: '#F0FDF4',
        icon: CheckCircle,
        limits: {
          daily: tierLimits ? getLimit(tierLimits.max_daily_deposit) : '₦5,000,000',
          weekly: tierLimits ? getLimit(tierLimits.max_weekly_deposit) : '₦20,000,000',
          monthly: tierLimits ? getLimit(tierLimits.max_monthly_deposit) : '₦100,000,000',
          single: tierLimits ? getLimit(tierLimits.max_single_deposit) : '₦5,000,000',
          maxBalance: tierLimits ? getLimit(tierLimits.max_account_balance) : '₦500,000,000'
        }
      };
  }
}

const createStyles = (colors: any, screenWidth: number) => {
  // Calculate responsive padding and margins
  const horizontalPadding = Math.max(16, Math.min(screenWidth * 0.05, 32));
  const verticalSpacing = Math.max(16, Math.min(screenWidth * 0.04, 24));
  
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.backgroundSecondary,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: horizontalPadding,
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
    },
    headerTitle: {
      fontSize: Math.max(16, Math.min(screenWidth * 0.045, 20)),
      fontWeight: '600',
      textAlign: 'center',
      flex: 1,
      color: colors.text,
    },
    editButton: {
      width: 40,
      height: 40,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.backgroundTertiary,
      borderRadius: 20,
    },
    content: {
      flex: 1,
    },
    contentContainer: {
      padding: horizontalPadding,
      paddingBottom: 100,
    },
    profileHeader: {
      alignItems: 'center',
      marginBottom: verticalSpacing * 1.5,
      paddingVertical: verticalSpacing,
    },
    userName: {
      fontWeight: '700',
      color: colors.text,
      marginTop: Math.max(12, screenWidth * 0.03),
      marginBottom: 4,
      textAlign: 'center',
    },
    userEmail: {
      color: colors.textSecondary,
      marginBottom: Math.max(8, screenWidth * 0.02),
      textAlign: 'center',
    },
    kycSection: {
      marginBottom: verticalSpacing,
    },
    kycCard: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: Math.max(16, screenWidth * 0.04),
      borderWidth: 1,
      borderColor: colors.border,
    },
    kycHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
      flexWrap: 'wrap',
      gap: 8,
    },
    kycTitleContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      flex: 1,
      minWidth: 150,
    },
    kycTitle: {
      fontSize: Math.max(16, Math.min(screenWidth * 0.045, 20)),
      fontWeight: '600',
      color: colors.text,
    },
    kycBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 20,
    },
    kycBadgeText: {
      fontSize: 12,
      fontWeight: '600',
    },
    kycDescription: {
      fontSize: Math.max(13, Math.min(screenWidth * 0.035, 16)),
      color: colors.textSecondary,
      lineHeight: 20,
      marginBottom: 20,
    },
    kycLimits: {
      backgroundColor: colors.backgroundTertiary,
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
    },
    kycLimitsTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 12,
    },
    limitRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
      flexWrap: 'wrap',
      gap: 8,
    },
    limitLabel: {
      fontSize: Math.max(12, Math.min(screenWidth * 0.035, 14)),
      color: colors.textSecondary,
      flex: 1,
      minWidth: 100,
    },
    limitValue: {
      fontSize: Math.max(12, Math.min(screenWidth * 0.035, 14)),
      fontWeight: '600',
      color: colors.text,
    },
    upgradeButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: colors.backgroundTertiary,
      borderWidth: 1,
      borderColor: colors.primary,
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 20,
    },
    upgradeButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.primary,
    },
    upgradeMessage: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: '#FEF3C7',
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 8,
      marginTop: 16,
      marginBottom: 16,
    },
    upgradeMessageText: {
      fontSize: 14,
      color: '#D97706',
      fontWeight: '600',
    },
    loadingContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 40,
    },
    loadingText: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    section: {
      marginBottom: verticalSpacing,
    },
    sectionTitle: {
      fontSize: Math.max(16, Math.min(screenWidth * 0.045, 20)),
      fontWeight: '600',
      color: colors.text,
      marginBottom: 16,
    },
    infoCard: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: Math.max(16, screenWidth * 0.04),
      borderWidth: 1,
      borderColor: colors.border,
    },
    field: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      flexWrap: 'wrap',
      gap: 12,
    },
    fieldIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.backgroundTertiary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    fieldContent: {
      flex: 1,
      minWidth: 150,
    },
    fieldLabel: {
      fontSize: Math.max(12, Math.min(screenWidth * 0.035, 14)),
      color: colors.textSecondary,
      marginBottom: 4,
    },
    fieldValue: {
      fontSize: Math.max(14, Math.min(screenWidth * 0.04, 16)),
      color: colors.text,
      fontWeight: '500',
    },
    verifiedBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: colors.primary,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
    },
    verifiedText: {
      fontSize: 12,
      color: colors.accent,
      fontWeight: '600',
    },
    divider: {
      height: 1,
      backgroundColor: colors.border,
      marginVertical: 8,
    },
    actionsCard: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 4,
      borderWidth: 1,
      borderColor: colors.border,
    },
    actionItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 16,
      paddingHorizontal: 16,
      flexWrap: 'wrap',
      gap: 12,
    },
    actionLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
      flex: 1,
      minWidth: 150,
    },
    actionIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      justifyContent: 'center',
      alignItems: 'center',
    },
    actionText: {
      fontSize: Math.max(14, Math.min(screenWidth * 0.04, 16)),
      fontWeight: '500',
      color: colors.text,
    },
    footer: {
      padding: horizontalPadding,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.surface,
    },
    signOutButton: {
      borderColor: '#EF4444',
      borderWidth: 1,
      borderRadius: 20,
    },
  });
};