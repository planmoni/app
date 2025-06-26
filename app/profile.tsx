import Button from '@/components/Button';
import InitialsAvatar from '@/components/InitialsAvatar';
import SafeFooter from '@/components/SafeFooter';
import { useAuth } from '@/contexts/AuthContext';
import { router } from 'expo-router';
import { ArrowLeft, Mail, User, Shield, CircleCheck as CheckCircle, CircleAlert as AlertCircle, Clock, ChevronRight, LocationEdit as Edit3 } from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';

type KYCLevel = 'unverified' | 'tier1' | 'tier2' | 'tier3';

export default function ProfileScreen() {
  const { session, signOut } = useAuth();
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  
  const firstName = session?.user?.user_metadata?.first_name || '';
  const lastName = session?.user?.user_metadata?.last_name || '';
  const email = session?.user?.email || '';

  // Mock KYC status - in real app, this would come from your backend
  const kycLevel: KYCLevel = 'tier1';
  const kycStatus = getKYCStatus(kycLevel);

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
    router.push('/kyc-upgrade');
  };

  const styles = createStyles(colors, width);

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
                  <Edit3 size={20} color="#1E3A8A" />
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

      <View style={styles.footer}>
        <Button
          title="Sign Out"
          onPress={handleSignOut}
          style={styles.signOutButton}
          variant="outline"
        />
      </View>
      
      <SafeFooter />
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
        color: '#1E3A8A',
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
      borderRadius: 8,
    },
    upgradeButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.primary,
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
    },
  });
};