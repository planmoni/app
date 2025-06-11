import Button from '@/components/Button';
import InitialsAvatar from '@/components/InitialsAvatar';
import { useAuth } from '@/contexts/AuthContext';
import { router } from 'expo-router';
import { ArrowLeft, Mail, User, Shield, CircleCheck as CheckCircle, CircleAlert as AlertCircle, Clock, ChevronRight, LocationEdit as Edit3 } from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';

type KYCLevel = 'unverified' | 'tier1' | 'tier2' | 'tier3';

export default function ProfileScreen() {
  const { session } = useAuth();
  const { colors } = useTheme();
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

  const styles = createStyles(colors);

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

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <View style={styles.profileHeader}>
          <InitialsAvatar 
            firstName={firstName} 
            lastName={lastName} 
            size={120}
            fontSize={40}
          />
          <Text style={styles.userName}>{firstName} {lastName}</Text>
          <Text style={styles.userEmail}>{email}</Text>
        </View>

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
              <Text style={styles.kycLimitsTitle}>Current Limits</Text>
              <View style={styles.limitRow}>
                <Text style={styles.limitLabel}>Daily Transaction</Text>
                <Text style={styles.limitValue}>{kycStatus.limits.daily}</Text>
              </View>
              <View style={styles.limitRow}>
                <Text style={styles.limitLabel}>Monthly Transaction</Text>
                <Text style={styles.limitValue}>{kycStatus.limits.monthly}</Text>
              </View>
              <View style={styles.limitRow}>
                <Text style={styles.limitLabel}>Single Transaction</Text>
                <Text style={styles.limitValue}>{kycStatus.limits.single}</Text>
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

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account Actions</Text>
          
          <View style={styles.actionsCard}>
            <Pressable style={styles.actionItem} onPress={handleEditProfile}>
              <View style={styles.actionLeft}>
                <View style={[styles.actionIcon, { backgroundColor: '#EFF6FF' }]}>
                  <Edit3 size={20} color="#3B82F6" />
                </View>
                <Text style={styles.actionText}>Edit Profile</Text>
              </View>
              <ChevronRight size={20} color={colors.textTertiary} />
            </Pressable>

            <View style={styles.divider} />

            <Pressable style={styles.actionItem} onPress={() => router.push('/change-password')}>
              <View style={styles.actionLeft}>
                <View style={[styles.actionIcon, { backgroundColor: '#FEF3C7' }]}>
                  <Shield size={20} color="#D97706" />
                </View>
                <Text style={styles.actionText}>Change Password</Text>
              </View>
              <ChevronRight size={20} color={colors.textTertiary} />
            </Pressable>

            <View style={styles.divider} />

            <Pressable style={styles.actionItem} onPress={() => router.push('/privacy-settings')}>
              <View style={styles.actionLeft}>
                <View style={[styles.actionIcon, { backgroundColor: '#F0FDF4' }]}>
                  <Shield size={20} color="#22C55E" />
                </View>
                <Text style={styles.actionText}>Privacy Settings</Text>
              </View>
              <ChevronRight size={20} color={colors.textTertiary} />
            </Pressable>
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

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundSecondary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  },
  headerTitle: {
    fontSize: 18,
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
    padding: 24,
    paddingBottom: 100,
  },
  profileHeader: {
    alignItems: 'center',
    marginBottom: 32,
  },
  userName: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginTop: 16,
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  kycSection: {
    marginBottom: 32,
  },
  kycCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  kycHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  kycTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  kycTitle: {
    fontSize: 18,
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
    fontSize: 14,
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
    borderRadius: 8,
  },
  upgradeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 16,
  },
  infoCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
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
    fontSize: 16,
    color: colors.text,
    fontWeight: '500',
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  verifiedText: {
    fontSize: 12,
    color: '#22C55E',
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
  },
  actionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionText: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
  },
});