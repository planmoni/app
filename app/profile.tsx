import Button from '@/components/Button';
import InitialsAvatar from '@/components/InitialsAvatar';
import { useAuth } from '@/contexts/AuthContext';
import { router } from 'expo-router';
import { ArrowLeft, Mail, User, Shield, CircleCheck as CheckCircle, CircleAlert as AlertCircle, Clock, ChevronRight, LocationEdit as Edit3 } from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';

type KYCLevel = 'unverified' | 'tier1' | 'tier2' | 'tier3';

export default function ProfileScreen() {
  const { session } = useAuth();
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const firstName = session?.user?.user_metadata?.first_name || '';
  const lastName = session?.user?.user_metadata?.last_name || '';
  const email = session?.user?.email || '';

  // Mock KYC status - in real app, this would come from your backend
  const kycLevel: KYCLevel = 'tier1';
  const kycStatus = getKYCStatus(kycLevel);

  const handleEditProfile = () => {
    router.push('/edit-profile');
  };

  const handleUpgradeKYC = () => {
    router.push('/kyc-upgrade');
  };

  const isTablet = width >= 768;
  const isDesktop = width >= 1024;

  const styles = createStyles(colors, isTablet, isDesktop);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Profile</Text>
        <Pressable onPress={handleEditProfile} style={styles.editButton}>
          <Edit3 size={20} color={colors.primary} />
        </Pressable>
      </View>

      <ScrollView 
        style={styles.content} 
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.profileHeader}>
          <InitialsAvatar 
            firstName={firstName} 
            lastName={lastName} 
            size={isDesktop ? 140 : isTablet ? 120 : 100}
            fontSize={isDesktop ? 48 : isTablet ? 40 : 32}
          />
          <Text style={styles.userName}>{firstName} {lastName}</Text>
          <Text style={styles.userEmail}>{email}</Text>
          <View style={styles.verifiedBadge}>
            <CheckCircle size={16} color="#22C55E" />
            <Text style={styles.verifiedText}>Verified Account</Text>
          </View>
        </View>

        <View style={styles.mainContent}>
          <View style={styles.kycSection}>
            <View style={styles.kycCard}>
              <View style={styles.kycHeader}>
                <View style={styles.kycTitleContainer}>
                  <Shield size={24} color={kycStatus.color} />
                  <Text style={styles.kycTitle}>Verification Status</Text>
                </View>
                <View style={[styles.kycBadge, { backgroundColor: kycStatus.backgroundColor }]}>
                  <kycStatus.icon size={16} color={kycStatus.color} />
                  <Text style={[styles.kycBadgeText, { color: kycStatus.color }]}>
                    {kycStatus.label}
                  </Text>
                </View>
              </View>
              
              <Text style={styles.kycDescription}>{kycStatus.description}</Text>
              
              <View style={styles.kycLimits}>
                <Text style={styles.kycLimitsTitle}>Current Transaction Limits</Text>
                <View style={styles.limitsGrid}>
                  <View style={styles.limitItem}>
                    <Text style={styles.limitLabel}>Daily</Text>
                    <Text style={styles.limitValue}>{kycStatus.limits.daily}</Text>
                  </View>
                  <View style={styles.limitItem}>
                    <Text style={styles.limitLabel}>Monthly</Text>
                    <Text style={styles.limitValue}>{kycStatus.limits.monthly}</Text>
                  </View>
                  <View style={styles.limitItem}>
                    <Text style={styles.limitLabel}>Single</Text>
                    <Text style={styles.limitValue}>{kycStatus.limits.single}</Text>
                  </View>
                </View>
              </View>

              {kycLevel !== 'tier3' && (
                <Pressable style={styles.upgradeButton} onPress={handleUpgradeKYC}>
                  <Text style={styles.upgradeButtonText}>Upgrade Verification</Text>
                  <ChevronRight size={20} color={colors.primary} />
                </Pressable>
              )}
            </View>
          </View>

          <View style={styles.sectionsContainer}>
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
                  <View style={styles.emailVerifiedBadge}>
                    <CheckCircle size={16} color="#22C55E" />
                    <Text style={styles.emailVerifiedText}>Verified</Text>
                  </View>
                </View>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Quick Actions</Text>
              
              <View style={styles.actionsGrid}>
                <Pressable style={styles.actionCard} onPress={handleEditProfile}>
                  <View style={[styles.actionIcon, { backgroundColor: '#EFF6FF' }]}>
                    <Edit3 size={24} color="#3B82F6" />
                  </View>
                  <Text style={styles.actionTitle}>Edit Profile</Text>
                  <Text style={styles.actionDescription}>Update your personal information</Text>
                </Pressable>

                <Pressable style={styles.actionCard} onPress={() => router.push('/change-password')}>
                  <View style={[styles.actionIcon, { backgroundColor: '#FEF3C7' }]}>
                    <Shield size={24} color="#D97706" />
                  </View>
                  <Text style={styles.actionTitle}>Security</Text>
                  <Text style={styles.actionDescription}>Change password & 2FA</Text>
                </Pressable>

                <Pressable style={styles.actionCard} onPress={() => router.push('/linked-accounts')}>
                  <View style={[styles.actionIcon, { backgroundColor: '#F0F9FF' }]}>
                    <User size={24} color="#0EA5E9" />
                  </View>
                  <Text style={styles.actionTitle}>Bank Accounts</Text>
                  <Text style={styles.actionDescription}>Manage linked accounts</Text>
                </Pressable>

                <Pressable style={styles.actionCard} onPress={() => router.push('/transaction-limits')}>
                  <View style={[styles.actionIcon, { backgroundColor: '#F0FDF4' }]}>
                    <Shield size={24} color="#22C55E" />
                  </View>
                  <Text style={styles.actionTitle}>Limits</Text>
                  <Text style={styles.actionDescription}>View transaction limits</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function getKYCStatus(level: KYCLevel) {
  switch (level) {
    case 'unverified':
      return {
        label: 'Unverified',
        description: 'Complete your verification to unlock higher transaction limits and additional features.',
        color: '#EF4444',
        backgroundColor: '#FEE2E2',
        icon: AlertCircle,
        limits: {
          daily: '₦50,000',
          monthly: '₦200,000',
          single: '₦10,000'
        }
      };
    case 'tier1':
      return {
        label: 'Tier 1 Verified',
        description: 'Basic verification completed. Upgrade to Tier 2 for higher limits and premium features.',
        color: '#F59E0B',
        backgroundColor: '#FEF3C7',
        icon: Clock,
        limits: {
          daily: '₦500,000',
          monthly: '₦2,000,000',
          single: '₦100,000'
        }
      };
    case 'tier2':
      return {
        label: 'Tier 2 Verified',
        description: 'Enhanced verification completed. Upgrade to Tier 3 for maximum limits and exclusive features.',
        color: '#3B82F6',
        backgroundColor: '#EFF6FF',
        icon: Shield,
        limits: {
          daily: '₦2,000,000',
          monthly: '₦10,000,000',
          single: '₦1,000,000'
        }
      };
    case 'tier3':
      return {
        label: 'Tier 3 Verified',
        description: 'Maximum verification level achieved. You have access to all features and highest limits.',
        color: '#22C55E',
        backgroundColor: '#F0FDF4',
        icon: CheckCircle,
        limits: {
          daily: 'Unlimited',
          monthly: 'Unlimited',
          single: '₦10,000,000'
        }
      };
  }
}

const createStyles = (colors: any, isTablet: boolean, isDesktop: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundSecondary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: isDesktop ? 32 : isTablet ? 24 : 16,
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
    borderRadius: 20,
    backgroundColor: colors.backgroundTertiary,
  },
  headerTitle: {
    fontSize: isDesktop ? 24 : isTablet ? 22 : 18,
    fontWeight: '600',
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
    paddingHorizontal: isDesktop ? 32 : isTablet ? 24 : 16,
    paddingVertical: isDesktop ? 32 : isTablet ? 24 : 16,
    paddingBottom: 40,
    maxWidth: isDesktop ? 1200 : undefined,
    alignSelf: 'center',
    width: '100%',
  },
  profileHeader: {
    alignItems: 'center',
    marginBottom: isDesktop ? 40 : isTablet ? 32 : 24,
    paddingVertical: isDesktop ? 32 : isTablet ? 24 : 16,
  },
  userName: {
    fontSize: isDesktop ? 32 : isTablet ? 28 : 24,
    fontWeight: '700',
    color: colors.text,
    marginTop: isDesktop ? 24 : isTablet ? 20 : 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  userEmail: {
    fontSize: isDesktop ? 18 : isTablet ? 16 : 14,
    color: colors.textSecondary,
    marginBottom: 16,
    textAlign: 'center',
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  verifiedText: {
    fontSize: 14,
    color: '#22C55E',
    fontWeight: '600',
  },
  mainContent: {
    flex: 1,
    gap: isDesktop ? 32 : isTablet ? 24 : 20,
  },
  kycSection: {
    marginBottom: isDesktop ? 32 : isTablet ? 24 : 20,
  },
  kycCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: isDesktop ? 32 : isTablet ? 24 : 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  kycHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    flexWrap: 'wrap',
    gap: 12,
  },
  kycTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    minWidth: 200,
  },
  kycTitle: {
    fontSize: isDesktop ? 20 : isTablet ? 18 : 16,
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
    fontSize: isDesktop ? 16 : 14,
    color: colors.textSecondary,
    lineHeight: isDesktop ? 24 : 20,
    marginBottom: 24,
  },
  kycLimits: {
    backgroundColor: colors.backgroundTertiary,
    borderRadius: 12,
    padding: isDesktop ? 24 : isTablet ? 20 : 16,
    marginBottom: 20,
  },
  kycLimitsTitle: {
    fontSize: isDesktop ? 16 : 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 16,
  },
  limitsGrid: {
    flexDirection: isTablet ? 'row' : 'column',
    gap: isTablet ? 24 : 12,
    justifyContent: isTablet ? 'space-between' : 'flex-start',
  },
  limitItem: {
    flex: isTablet ? 1 : undefined,
    flexDirection: isTablet ? 'column' : 'row',
    justifyContent: isTablet ? 'center' : 'space-between',
    alignItems: isTablet ? 'center' : 'center',
    gap: isTablet ? 4 : 0,
  },
  limitLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: isTablet ? 'center' : 'left',
  },
  limitValue: {
    fontSize: isDesktop ? 16 : 14,
    fontWeight: '600',
    color: colors.text,
    textAlign: isTablet ? 'center' : 'right',
  },
  upgradeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.backgroundTertiary,
    borderWidth: 1,
    borderColor: colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  upgradeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  sectionsContainer: {
    gap: isDesktop ? 32 : isTablet ? 24 : 20,
  },
  section: {
    gap: 16,
  },
  sectionTitle: {
    fontSize: isDesktop ? 20 : isTablet ? 18 : 16,
    fontWeight: '600',
    color: colors.text,
  },
  infoCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: isDesktop ? 24 : isTablet ? 20 : 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
  },
  fieldIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.backgroundTertiary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  fieldContent: {
    flex: 1,
  },
  fieldLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  fieldValue: {
    fontSize: isDesktop ? 16 : 15,
    color: colors.text,
    fontWeight: '500',
  },
  emailVerifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  emailVerifiedText: {
    fontSize: 12,
    color: '#22C55E',
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 8,
  },
  actionsGrid: {
    flexDirection: isTablet ? 'row' : 'column',
    gap: isDesktop ? 20 : isTablet ? 16 : 12,
    flexWrap: isTablet ? 'wrap' : 'nowrap',
  },
  actionCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: isDesktop ? 24 : isTablet ? 20 : 16,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    flex: isTablet ? 1 : undefined,
    minWidth: isTablet ? 200 : undefined,
    maxWidth: isTablet ? 250 : undefined,
  },
  actionIcon: {
    width: isDesktop ? 56 : isTablet ? 48 : 40,
    height: isDesktop ? 56 : isTablet ? 48 : 40,
    borderRadius: isDesktop ? 28 : isTablet ? 24 : 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  actionTitle: {
    fontSize: isDesktop ? 16 : 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
    textAlign: 'center',
  },
  actionDescription: {
    fontSize: isDesktop ? 14 : 12,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: isDesktop ? 18 : 16,
  },
});