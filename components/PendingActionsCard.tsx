import { View, Text, StyleSheet, Pressable, ScrollView, Platform } from 'react-native';
import SkeletonBox from '@/components/SkeletonBox';
import { ChevronRight, X, Mail, Lock, Fingerprint, CircleAlert as AlertCircle, Clock, ShieldCheck } from 'lucide-react-native';
import { router, useFocusEffect } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useHaptics } from '@/hooks/useHaptics';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { usePin } from '@/contexts/PinContext';
import { useOnlineStatus } from './OnlineStatusProvider';
import OfflineNotice from './OfflineNotice';
import { useKYCProgress } from '@/hooks/useKYCProgress';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { useRegisterForegroundRefetch } from '@/hooks/useForegroundRefreshCoordinator';
import { fetchWithRetry, CACHE_KEYS, readCache, writeCache } from '@/lib/supabase-fetch';
import Tier1Icon from '@/assets/kyc/1.svg';
import Tier2Icon from '@/assets/kyc/2.svg';
import Tier3Icon from '@/assets/kyc/3.svg';
import React from 'react';
import { useTextSize } from '@/contexts/TextSizeContext';
import { getScaledFontSize } from '@/lib/textSize';

type PendingAction = {
  id: string;
  title: string;
  description?: string;
  icon: React.ComponentType<any>;
  iconBg: string;
  iconColor: string;
  route: string;
  priority: 'high' | 'medium' | 'low';
  disabled?: boolean;
  disabledReason?: string;
};

export default function PendingActionsCard() {
  const { colors, isDark } = useTheme();
  const { textSizeMultiplier } = useTextSize();
  const [profileData, setProfileData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pinWaitTimedOut, setPinWaitTimedOut] = useState(false);
  const { session } = useAuth();
  const { isAuthenticated } = useRequireAuth();
  const { hasAppLockPin, isLoading: pinLoading } = usePin();
  const haptics = useHaptics();
  const { isOnline } = useOnlineStatus();
  const { progress, currentTier = 0, getTierInfo } = useKYCProgress();
  const [tierInfo, setTierInfo] = useState<any>(null);
  const hasCachedDataRef = useRef(false);

  const fetchProfileData = useCallback(async () => {
    if (!session?.user?.id) {
      setIsLoading(false);
      return;
    }

    if (!isOnline) {
      setIsLoading(false);
      return;
    }

    try {
      if (!hasCachedDataRef.current) {
        setIsLoading(true);
      }

      const result = await fetchWithRetry(
        () =>
          supabase
            .from('profiles')
            .select('email_verified, app_lock_enabled, two_factor_enabled, account_verified')
            .eq('id', session.user.id)
            .single(),
        'Profile fetch'
      );
      const { data, error } = result as { data: typeof profileData; error: { message?: string } | null };

      if (error) throw error;
      setProfileData(data);
      void writeCache(CACHE_KEYS.pendingProfile(session.user.id), data);
    } catch (error) {
      console.warn('Error loading profile data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [session?.user?.id, isOnline]);

  const loadTierInfo = useCallback(async () => {
    if (!isOnline) return;
    try {
      const info = await getTierInfo();
      setTierInfo(info);
    } catch (error) {
      console.error('Error loading tier info:', error);
    }
  }, [getTierInfo, isOnline]);

  useEffect(() => {
    if (!session?.user?.id) {
      hasCachedDataRef.current = false;
      return;
    }

    let isMounted = true;

    const init = async () => {
      try {
        const cached = await readCache<any>(CACHE_KEYS.pendingProfile(session.user.id));
        if (cached && isMounted) {
          setProfileData(cached);
          setIsLoading(false);
          hasCachedDataRef.current = true;
        }
      } catch (_) {}

      if (!isMounted) return;
      void fetchProfileData();
      void loadTierInfo();
    };

    void init();

    return () => {
      isMounted = false;
    };
  }, [session?.user?.id, fetchProfileData, loadTierInfo]);

  useRegisterForegroundRefetch(
    'pending-profile',
    3,
    () => {
      void fetchProfileData();
      void loadTierInfo();
    },
    !!session?.user?.id
  );

  useFocusEffect(
    useCallback(() => {
      if (session?.user?.id) {
        void fetchProfileData();
      }
    }, [session?.user?.id, fetchProfileData])
  );

  // Don't block the card forever if PIN state is slow to load (e.g. SecureStore hang).
  useEffect(() => {
    if (!pinLoading) {
      setPinWaitTimedOut(false);
      return;
    }
    const timer = setTimeout(() => setPinWaitTimedOut(true), 6000);
    return () => clearTimeout(timer);
  }, [pinLoading]);

  // Get tier-specific pending actions - permanently hidden
  const getTierPendingActions = (): PendingAction[] => {
    return [];
  };

  // Get standard pending actions (non-KYC)
  const getStandardPendingActions = (): PendingAction[] => {
    const actions: PendingAction[] = [];

    // Verify Identity - show if KYC is not completed
    // if (progress && !Boolean(progress.id_face_verified)) {
    //   actions.push({
    //     id: 'verify-identity',
    //     title: 'Verify your Identity',
    //     description: 'Complete KYC verification with just your BVN and a selfie',
    //     icon: ShieldCheck,
    //     iconBg: colors.primary + '20',
    //     iconColor: isDark ? '#fff' : colors.primary,
    //     route: '/kyc/simplified',
    //     priority: 'high',
    //   });
    // }

    if (!profileData?.email_verified && !session?.user?.email_confirmed_at) {
      actions.push({
        id: 'verify-email',
        title: 'Verify your email address',
        description: 'Verify your email to secure your account',
        icon: Mail,
        iconBg: colors.backgroundTertiary,
        iconColor: colors.text,
        route: '/verify-email',
        priority: 'high',
      });
    }

    // Only check PIN status if PIN loading is complete (or timed out)
    if ((!pinLoading || pinWaitTimedOut) && !hasAppLockPin) {
      actions.push({
        id: 'setup-app-lock',
        title: 'Setup App PIN',
        description: 'Add an extra layer of security',
        icon: Lock,
        iconBg: colors.backgroundTertiary,
        iconColor: colors.text,
        route: '/settings/setup-pin',
        priority: 'high',
      });
    }

    // Setup 2FA is permanently hidden from PendingActionsCard
    // if (!profileData?.two_factor_enabled) {
    //   actions.push({
    //     id: 'setup-2fa',
    //     title: 'Setup 2FA',
    //     description: 'Enable two-factor authentication',
    //     icon: Fingerprint,
    //     iconBg: colors.backgroundTertiary,
    //     iconColor: colors.text,
    //     route: '/two-factor-auth',
    //     priority: 'medium',
    //   });
    // }

    return actions;
  };

  // Combine tier actions with standard actions
  const pendingActions: PendingAction[] = [
    ...getTierPendingActions(),
    ...getStandardPendingActions(),
  ];

  // Check if an action is completed
  const isActionCompleted = (actionId: string): boolean => {
    if (!profileData && !progress) return false;
    
    switch (actionId) {
      case 'verify-identity':
        return Boolean(progress?.id_face_verified);
      case 'verify-email':
        return !!profileData?.email_verified || !!session?.user?.email_confirmed_at;
      case 'setup-app-lock':
        // Only consider PIN setup completed if PIN loading is done and PIN exists
        return (!pinLoading || pinWaitTimedOut) && hasAppLockPin;
      case 'account-verification':
        return !!profileData?.account_verified;
      case 'setup-2fa':
        return !!profileData?.two_factor_enabled;
      case 'tier-1-verification':
        return currentTier >= 1;
      case 'tier-2-verification':
        return currentTier >= 2;
      case 'tier-3-verification':
        return currentTier >= 3;
      default:
        return false;
    }
  };

  // Handle navigation to action route
  const handleActionPress = (action: PendingAction) => {
    haptics.mediumImpact();
    
    // Simplified flow: Go directly to kyc-upgrade page for Tier 1 verification
    // The page will automatically show the camera permission modal when on liveness step
    if (action.id === 'tier-1-verification') {
      router.push('/kyc-upgrade');
      return;
    }
    
    router.push(action.route);
  };


  // Filter out completed actions
  const filteredActions = pendingActions.filter(action => !isActionCompleted(action.id));

  // Create styles before any conditional returns
  const styles = createStyles(colors, isDark, textSizeMultiplier);

  // Don't render if user is not authenticated
  if (!isAuthenticated) {
    return null;
  }

  const pinStatePending = pinLoading && !pinWaitTimedOut;

  // Don't render if there are no pending actions and data is loaded (including PIN state)
  if (!isLoading && !pinStatePending && filteredActions.length === 0) {
    return null;
  }

  // Show skeleton only when we have no cached profile data yet
  if ((isLoading && !profileData) || pinStatePending) {
    const cardWidth = Platform.OS === 'ios' ? 300 : 250;
    return (
      <View>
        <SkeletonBox width={120} height={Platform.OS === 'ios' ? 15 : 13} borderRadius={6} style={{ marginBottom: 20, marginTop: 1 }} />
        <View style={[styles.container, { flexDirection: 'row', gap: 12 }]}>
          {[0, 1].map((i) => (
            <View
              key={i}
              style={{
                width: cardWidth,
                height: 110,
                borderRadius: 12,
                padding: 16,
                backgroundColor: isDark ? colors.card : '#fff',
                borderWidth: 0.5,
                borderColor: colors.border,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <SkeletonBox
                width={Platform.OS === 'ios' ? 48 : 40}
                height={Platform.OS === 'ios' ? 48 : 40}
                borderRadius={Platform.OS === 'ios' ? 24 : 20}
              />
              <View style={{ flex: 1, gap: 8 }}>
                <SkeletonBox width="75%" height={13} borderRadius={6} />
                <SkeletonBox width="55%" height={12} borderRadius={6} />
              </View>
            </View>
          ))}
        </View>
      </View>
    );
  }

  if (!isOnline) {
    return (
      <View>
        <Text style={styles.sectionTitle}>Pending Actions</Text>
        <View style={styles.container}>
          <OfflineNotice message="Pending actions are unavailable while offline" />
        </View>
      </View>
    );
  }

  return (
    <View>
      <View style={styles.titleContainer}>
        <Text style={styles.sectionTitle}>Pending Actions</Text>
       
      </View>
      <View style={styles.container}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {filteredActions.map((action) => (
            <Pressable 
              key={action.id} 
              style={[
                styles.actionCard,
                action.disabled && styles.actionCardDisabled
              ]}
              onPress={() => !action.disabled && handleActionPress(action)}
              disabled={action.disabled}
            >
              <View style={[
                styles.iconContainer, 
                { backgroundColor: action.iconBg },
                action.disabled && styles.iconContainerDisabled
              ]}>
                {action.id.startsWith('tier-') ? (
                  <action.icon width={24} height={24} />
                ) : (
                  <action.icon size={24} color={action.iconColor} />
                )}
              </View>
              <View style={styles.actionContent}>
                <Text style={[
                  styles.actionTitle,
                  action.disabled && styles.actionTitleDisabled
                ]}>
                  {action.title}
                </Text>
                {action.description && (
                  <Text style={[
                    styles.actionDescription,
                    action.disabled && styles.actionDescriptionDisabled
                  ]}>
                    {action.description}
                  </Text>
                )}
              </View>
              <View style={styles.actionButtons}>
                <View style={styles.actionArrow}>
                  <ChevronRight 
                    size={20} 
                    color={action.disabled ? colors.textTertiary + '60' : colors.textTertiary} 
                  />
                </View>
              </View>
              {action.priority === 'high' && !action.disabled && (
                <View style={styles.priorityBadge}>
                  <AlertCircle size={12} color="#FFFFFF" />
                </View>
              )}
              {action.disabled && (
                <View style={styles.disabledBadge}>
                  <Clock size={12} color="#9CA3AF" />
                </View>
              )}
            </Pressable>
          ))}
        </ScrollView>
      </View>
    </View>
  );
}

const createStyles = (colors: any, isDark: boolean, textSizeMultiplier: number) => StyleSheet.create({
  container: {
    marginTop: 20,
    marginBottom: 10,
    borderRadius: 16,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  scrollContent: {
    padding: 1,
    gap: 12,
  },
  actionCard: {
    width: Platform.OS === 'ios' ? 300 : 250,
    backgroundColor: colors.card,
    borderRadius: 12,
    height: 110,
    padding: 16,
    borderWidth: 0.5,
    borderColor: colors.border,
   
  
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  iconContainer: {
    width: Platform.OS === 'ios' ? 48 : 40,
    height: Platform.OS === 'ios' ? 48 : 40,
    borderRadius: Platform.OS === 'ios' ? 24 : 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Platform.OS === 'ios' ? 12 : 10,
  },
  actionContent: {
    flex: 1,
    marginRight: 8,
  },
  actionTitle: {
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 13 : 12, textSizeMultiplier),
    fontWeight: '500',
    color: colors.text,
    marginTop: 10,
  },
  actionDescription: {
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 13 : 12, textSizeMultiplier),
    color: colors.textSecondary,
    lineHeight: getScaledFontSize(16, textSizeMultiplier),
  },
  actionButtons: {
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: 8,
  },
  actionArrow: {
    width: Platform.OS === 'ios' ? 24 : 20,
    height: Platform.OS === 'ios' ? 24 : 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  priorityBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: Platform.OS === 'ios' ? 16 : 12,
    height: Platform.OS === 'ios' ? 16 : 12,
    borderRadius: Platform.OS === 'ios' ? 8 : 6,
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 15 : 13, textSizeMultiplier),
    fontWeight: '500',
    color: colors.text,
    marginBottom: -20,
    marginTop: 1,
  },
  titleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: -20,
  },
  progressBar: {
    height: 6,
    backgroundColor: colors.backgroundTertiary,
    borderRadius: 3,
    width: 60,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  progressText: {
    fontSize: getScaledFontSize(12, textSizeMultiplier),
    fontWeight: '600',
    color: colors.textSecondary,
    minWidth: 25,
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: getScaledFontSize(14, textSizeMultiplier),
    color: colors.textSecondary,
    fontWeight: '500',
  },
  actionCardDisabled: {
    opacity: 0.6,
  },
  iconContainerDisabled: {
    opacity: 0.5,
  },
  actionTitleDisabled: {
    color: colors.textTertiary,
  },
  actionDescriptionDisabled: {
    color: colors.textTertiary + '80',
  },
  disabledBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: Platform.OS === 'ios' ? 16 : 12,
    height: Platform.OS === 'ios' ? 16 : 12,
    borderRadius: Platform.OS === 'ios' ? 8 : 6,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
});