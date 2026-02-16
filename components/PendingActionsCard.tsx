import { View, Text, StyleSheet, Pressable, ScrollView, Platform } from 'react-native';
import { ChevronRight, Mail, Lock, CircleAlert as AlertCircle, Clock } from 'lucide-react-native';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useHaptics } from '@/hooks/useHaptics';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { usePin } from '@/contexts/PinContext';
import { useOnlineStatus } from './OnlineStatusProvider';
import OfflineNotice from './OfflineNotice';
import { useKYCProgress } from '@/hooks/useKYCProgress';
import { useRequireAuth } from '@/hooks/useRequireAuth';
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

const PendingActionsCard = () => {
  const { colors, isDark } = useTheme();
  const { textSizeMultiplier } = useTextSize();
  const [profileData, setProfileData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { session } = useAuth();
  const { isAuthenticated } = useRequireAuth();
  const { hasAppLockPin, isLoading: pinLoading } = usePin();
  const haptics = useHaptics();
  const { isOnline } = useOnlineStatus();
  const { progress, currentTier = 0, getTierInfo } = useKYCProgress();

  const styles = useMemo(() => createStyles(colors, isDark, textSizeMultiplier), [colors, isDark, textSizeMultiplier]);

  const loadTierInfo = useCallback(async () => {
    if (!isOnline) return;
    try {
      await getTierInfo();
    } catch (error) {
      console.error('Error loading tier info:', error);
    }
  }, [isOnline, getTierInfo]);

  const fetchProfileData = useCallback(async () => {
    if (!isOnline) {
      setIsLoading(false);
      return;
    }
    
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('email_verified, app_lock_enabled, two_factor_enabled, account_verified')
        .eq('id', session?.user?.id)
        .single();

      if (error) throw error;
      setProfileData(data);
    } catch (error) {
      console.error('Error loading profile data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [isOnline, session?.user?.id]);

  useEffect(() => {
    if (session?.user?.id) {
      fetchProfileData();
      loadTierInfo();
    }
  }, [session?.user?.id, progress, fetchProfileData, loadTierInfo]);

  const getStandardPendingActions = useCallback((): PendingAction[] => {
    const actions: PendingAction[] = [];

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

    if (!pinLoading && !hasAppLockPin) {
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

    return actions;
  }, [profileData, session?.user?.email_confirmed_at, pinLoading, hasAppLockPin, colors]);

  const isActionCompleted = useCallback((actionId: string): boolean => {
    if (!profileData && !progress) return false;
    
    switch (actionId) {
      case 'verify-identity':
        return Boolean(progress?.id_face_verified);
      case 'verify-email':
        return !!profileData?.email_verified || !!session?.user?.email_confirmed_at;
      case 'setup-app-lock':
        return !pinLoading && hasAppLockPin;
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
  }, [profileData, progress, pinLoading, hasAppLockPin, session?.user?.email_confirmed_at, currentTier]);

  const handleActionPress = useCallback((action: PendingAction) => {
    haptics.mediumImpact();
    if (action.id === 'tier-1-verification') {
      router.push('/kyc-upgrade');
      return;
    }
    router.push(action.route);
  }, [haptics]);

  const filteredActions = useMemo(() => {
    return getStandardPendingActions().filter(action => !isActionCompleted(action.id));
  }, [getStandardPendingActions, isActionCompleted]);

  if (!isAuthenticated) return null;

  if (!isLoading && !pinLoading && filteredActions.length === 0) return null;

  if (isLoading || pinLoading) {
    return (
      <View>
        <Text style={styles.sectionTitle}>Pending Actions</Text>
        <View style={styles.container}>
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading pending actions...</Text>
          </View>
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
                <action.icon size={24} color={action.iconColor} />
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
};

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
    marginTop: 10,
  },
  titleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
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

export default React.memo(PendingActionsCard);
