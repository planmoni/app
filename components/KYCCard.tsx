import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { BadgeCheck, BadgeAlert, Clock } from 'lucide-react-native';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useHaptics } from '@/hooks/useHaptics';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { useKYCProgress, KYCProgress } from '@/hooks/useKYCProgress';
import KYCVerificationModal from '@/components/KYCVerificationModal';

type KYCStatus = 'starting' | 'continuing' | 'pending';

export default function KYCCard() {
  const { colors, isDark } = useTheme();
  const haptics = useHaptics();
  const { session } = useAuth();
  const { progress, loading: progressLoading } = useKYCProgress();
  const [verificationStatus, setVerificationStatus] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const styles = createStyles(colors, isDark);

  // Check verification status from kyc_verifications table
  useEffect(() => {
    const checkVerificationStatus = async () => {
      if (!session?.user?.id) {
        setIsLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('kyc_verifications')
          .select('status')
          .eq('user_id', session.user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error && error.code !== 'PGRST116') {
          console.warn('Error checking verification status:', error);
        } else if (data) {
          setVerificationStatus(data.status);
        }
      } catch (err) {
        console.warn('Error checking verification status:', err);
      } finally {
        setIsLoading(false);
      }
    };

    if (!progressLoading) {
      checkVerificationStatus();
    }
  }, [session?.user?.id, progressLoading]);

  // Determine KYC status
  const getKYCStatus = (): KYCStatus => {
    // Check if overall completed and verification is pending
    if (progress.overall_completed && (verificationStatus === 'pending' || verificationStatus === 'reviewing')) {
      return 'pending';
    }

    // Check if user has started KYC (has progress beyond initial state)
    const hasStarted = progress.current_step !== 'personal' || 
                      progress.personal_info_completed || 
                      progress.bvn_verified || 
                      progress.documents_verified ||
                      progress.id_face_verified ||
                      progress.address_completed;

    if (hasStarted && !progress.overall_completed) {
      return 'continuing';
    }

    return 'starting';
  };

  const kycStatus = getKYCStatus();
  const isLoadingStatus = isLoading || progressLoading;

  // Don't show card if KYC is fully completed and verified
  if (progress.overall_completed && verificationStatus === 'verified') {
    return null;
  }

  const handlePress = () => {
    haptics.mediumImpact();
    console.log('KYCCard handlePress called, kycStatus:', kycStatus);
    if (kycStatus === 'starting') {
      console.log('Setting showVerificationModal to true');
      setShowVerificationModal(true);
    } else {
      router.push('/kyc-upgrade');
    }
  };

  const handleStartVerification = () => {
    router.push('/kyc-upgrade');
  };

  const renderCardContent = () => {
    switch (kycStatus) {
      case 'starting':
        return (
          <>
            <View style={styles.iconContainer}>
              <BadgeCheck size={25} color="#1E3A8A" />
            </View>
            <Text style={styles.cardText}>Let's verify your identity</Text>
            <View style={styles.actionButton}>
              <Text style={styles.actionButtonText}>Verify</Text>
            </View>
          </>
        );

      case 'continuing':
        return (
          <>
            <View style={styles.iconContainer}>
              <BadgeAlert size={25} color="#1E3A8A" />
            </View>
            <Text style={styles.cardText}>Continue your KYC Verification</Text>
            <View style={styles.actionButton}>
              <Text style={styles.actionButtonText}>Continue</Text>
            </View>
          </>
        );

      case 'pending':
        return (
          <>
            <View style={styles.iconContainer}>
              <Clock size={20} color="#1E3A8A" />
            </View>
            <Text style={styles.cardText}>Your KYC Verification Status is pending</Text>
            <View style={styles.statusIndicator}>
              <Text style={styles.statusIndicatorText}>Pending</Text>
            </View>
          </>
        );
    }
  };

  return (
    <>
      {!isLoadingStatus && (
        <Pressable style={styles.card} onPress={handlePress}>
          {renderCardContent()}
        </Pressable>
      )}
      <KYCVerificationModal
        isVisible={showVerificationModal}
        onClose={() => setShowVerificationModal(false)}
        onStartVerification={handleStartVerification}
      />
    </>
  );
}

const createStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  card: {
    backgroundColor: colors.accentBackground,
    borderRadius: 12,
    marginTop: 10,
    padding: 16,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 64,
    shadowColor: '#000000',
    shadowOffset: { width: 1, height: 6},
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 3,
    width: '100%',
    borderWidth: 0.5,
    borderColor: colors.border,
    flexWrap: 'wrap',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
    backgroundColor: isDark ? colors.backgroundTertiary : '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  cardText: {
    flex: 1,
    fontSize: 17,
    fontWeight: '500',
    color: isDark ? colors.text : '#374151',
    flexShrink: 1,
    marginRight: 10,
  },
  actionButton: {
    backgroundColor: colors.accent,
    borderRadius: 100,
    paddingVertical: 10,
    paddingHorizontal: 20,
    minWidth: 90,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#065F46',
  },
  statusIndicator: {
    backgroundColor: isDark ? colors.backgroundTertiary : '#E5E7EB',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
    minWidth: 90,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  statusIndicatorText: {
    fontSize: 14,
    fontWeight: '600',
    color: isDark ? colors.textSecondary : '#6B7280',
  },
});

